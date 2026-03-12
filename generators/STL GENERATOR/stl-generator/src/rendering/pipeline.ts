import { Mesh, Vector2, Vector3, RenderingMode, CanvasConfig, ViewMode, Metrics } from '../core/types';
import { extractEdges, edgesToLineSegments, filterShortEdges, LineSegment3D } from './edges';
import { fitToCanvas, calculate2DBounds } from '../utils/canvasFitter';
import { SVGLine, filterShortLines, generateSVG } from '../export/svgGenerator';
import { calculateMetricsFromSVG } from '../utils/metrics';
import { ViewRotation } from '../ui/store/svgViewportSlice';
import {
  projectFacesToScreenSpace,
  ScreenLineSegment,
  removeHiddenLines,
} from './hiddenLineRemoval';
import { project3DToScreenSpace } from '../core/projection';

/**
 * Rendering pipeline result
 */
export interface RenderingResult {
  svgLines: SVGLine[];
  svgContent: string;
  metrics: Metrics;
  scale: number;
  offset: { x: number; y: number };
}

/**
 * Full rendering pipeline: from 3D mesh to SVG
 * 
 * @param mesh - The 3D mesh to render
 * @param cameraPosition - Camera position for visibility calculation
 * @param renderingMode - Edge extraction mode
 * @param viewMode - Projection mode (isometric/perspective)
 * @param canvas - Canvas configuration
 * @param perspectiveStrength - Perspective blend strength
 * @param viewRotation - View rotation (azimuth, elevation) for orbit control
 * @param fixedScale - Optional fixed scale to use instead of auto-fitting
 * @returns Rendering result with SVG content and metrics
 */
export function renderMeshToSVG(
  mesh: Mesh,
  cameraPosition: Vector3,
  renderingMode: RenderingMode,
  viewMode: ViewMode,
  canvas: CanvasConfig,
  perspectiveStrength: number = 1.0,
  viewRotation?: ViewRotation,
  fixedScale?: number
): RenderingResult {
  // Step 1: Extract edges based on rendering mode
  const edgeResult = extractEdges(mesh, cameraPosition, renderingMode);
  const visibleFacesSet = new Set(edgeResult.visibleFaces);
  const lineSegments3D = edgesToLineSegments(mesh, edgeResult.allEdges, 'internal', visibleFacesSet);

  // Step 2: Filter out very short edges
  const filteredSegments = filterShortEdges(lineSegments3D, 0.001);

  // Step 2.5: Filter out hidden edges completely (back-face culling)
  const visibleSegments = filteredSegments.filter((seg) => !(seg.isHidden ?? false));

  if (visibleSegments.length === 0) {
    // No geometry to render
    return {
      svgLines: [],
      svgContent: generateSVG([], canvas),
      metrics: { lineCount: 0, pathLength: 0, estimatedPlotTime: 0 },
      scale: 1,
      offset: { x: 0, y: 0 },
    };
  }

  // Calculate dynamic camera distance from camera position to mesh center
  const meshCenter = mesh.centerOfMass || { x: 0, y: 0, z: 0 };
  const dx = cameraPosition.x - meshCenter.x;
  const dy = cameraPosition.y - meshCenter.y;
  const dz = cameraPosition.z - meshCenter.z;
  const cameraDistance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 100; // Fallback to 100 if zero
  const fov = 45;

  // Step 3: Project visible faces to screen space for occlusion testing
  const projectedTriangles = projectFacesToScreenSpace(
    mesh,
    edgeResult.visibleFaces,
    viewMode,
    perspectiveStrength,
    cameraDistance,
    fov,
    viewRotation
  );

  // Step 4: Project line segments to screen space
  const screenSegments: ScreenLineSegment[] = visibleSegments.map((seg, idx) => ({
    p0: project3DToScreenSpace(seg.start, viewMode, perspectiveStrength, cameraDistance, fov, viewRotation),
    p1: project3DToScreenSpace(seg.end, viewMode, perspectiveStrength, cameraDistance, fov, viewRotation),
    originalIndex: idx,
    edgeFaces: seg.faceIndices ? new Set(seg.faceIndices) : undefined,
  }));

  // Step 5: Remove hidden lines using geometric occlusion testing
  // Based on Plotter Vision (https://plotter.vision/) geometric approach
  // Uses screen map spatial index for efficient triangle lookup
  console.log(`[Pipeline] Rendering: ${screenSegments.length} segments, ${projectedTriangles.length} triangles, mode: ${renderingMode}`);
  const visibleScreenSegments = projectedTriangles.length > 0 
    ? removeHiddenLines(screenSegments, projectedTriangles)
    : screenSegments;
  console.log(`[Pipeline] After hidden line removal: ${visibleScreenSegments.length} segments visible`);

  if (visibleScreenSegments.length === 0) {
    // All lines are occluded
    return {
      svgLines: [],
      svgContent: generateSVG([], canvas),
      metrics: { lineCount: 0, pathLength: 0, estimatedPlotTime: 0 },
      scale: 1,
      offset: { x: 0, y: 0 },
    };
  }

  // Step 6: Extract 2D points from visible screen segments
  const points2D: Vector2[] = [];
  for (const seg of visibleScreenSegments) {
    points2D.push({ x: seg.p0.x, y: seg.p0.y });
    points2D.push({ x: seg.p1.x, y: seg.p1.y });
  }

  // Step 7: Fit to canvas (either using fixed scale or auto-fitting)
  let fittedPoints: Vector2[];
  let scale: number;
  let offset: { x: number; y: number };
  
  if (fixedScale !== undefined && fixedScale > 0) {
    // Use fixed scale - manually scale and center points
    const bounds = calculate2DBounds(points2D);
    if (!bounds) {
      return {
        svgLines: [],
        svgContent: generateSVG([], canvas),
        metrics: { lineCount: 0, pathLength: 0, estimatedPlotTime: 0 },
        scale: fixedScale,
        offset: { x: 0, y: 0 },
      };
    }
    
    scale = fixedScale;
    const canvasCenterX = canvas.width / 2;
    const canvasCenterY = canvas.height / 2;
    
    fittedPoints = points2D.map((p) => {
      const relX = p.x - bounds.centerX;
      const relY = p.y - bounds.centerY;
      const scaledX = relX * scale;
      const scaledY = relY * scale;
      return {
        x: scaledX + canvasCenterX,
        y: scaledY + canvasCenterY,
      };
    });
    
    offset = {
      x: canvasCenterX - bounds.centerX * scale,
      y: canvasCenterY - bounds.centerY * scale,
    };
  } else {
    // Auto-fit to canvas
    const fitResult = fitToCanvas(points2D, canvas);
    fittedPoints = fitResult.points;
    scale = fitResult.scale;
    offset = fitResult.offset;
  }

  // Step 8: Create SVG lines from fitted points
  const svgLines: SVGLine[] = [];
  for (let i = 0; i < visibleScreenSegments.length; i++) {
    const startIdx = i * 2;
    const endIdx = i * 2 + 1;
    
    if (startIdx < fittedPoints.length && endIdx < fittedPoints.length) {
      const originalIdx = visibleScreenSegments[i].originalIndex ?? i;
      const segment = visibleSegments[originalIdx];
      
      svgLines.push({
        x1: fittedPoints[startIdx].x,
        y1: fittedPoints[startIdx].y,
        x2: fittedPoints[endIdx].x,
        y2: fittedPoints[endIdx].y,
        layer: segment?.type || 'internal',
        strokeWidth: canvas.strokeWidth,
        color: '#000000',
      });
    }
  }

  // Step 9: Filter short lines in 2D space
  const cleanedLines = filterShortLines(svgLines, 0.1);

  // Step 10: Generate SVG content
  const svgContent = generateSVG(cleanedLines, canvas);

  // Step 11: Calculate metrics
  const metrics = calculateMetricsFromSVG(cleanedLines);

  return {
    svgLines: cleanedLines,
    svgContent,
    metrics,
    scale,
    offset,
  };
}

/**
 * Quick render for preview (doesn't generate full SVG)
 */
export function quickRenderForPreview(
  mesh: Mesh,
  cameraPosition: Vector3,
  renderingMode: RenderingMode
): LineSegment3D[] {
  const edgeResult = extractEdges(mesh, cameraPosition, renderingMode);
  const lineSegments3D = edgesToLineSegments(mesh, edgeResult.allEdges, 'internal');
  return filterShortEdges(lineSegments3D, 0.001);
}

