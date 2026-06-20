/* ============================================================
   MAIN RENDERER
   Main draw() function and canvas dimension utilities
============================================================ */

// Import core modules
import { DEFAULT_CANVAS, ISO_ANGLE } from '../core/constants.js';
import { project3DTo2D } from '../core/projection.js';
import { rotatePoint } from '../core/transformations.js';
import { createCube, pointInPolygon, convexHull, convertSTLMesh } from '../core/geometry.js';
import { getCurrentMesh, getMeshMode, getSTLRotation, getCachedGeometry, setCachedGeometry } from '../loaders/stlLoader.js';

// Import lighting modules
import { calculateLightDirection, calculateShading } from '../lighting/lightCalculation.js';
import { calculateFaceGradientShading, calculateShadowGradient } from '../lighting/gradientShading.js';

// Import shading modules
import { generateHatchLines, generateAdaptiveHatchLines } from '../shading/hatchLines.js';
import { projectShadow } from '../shading/shadow.js';

// Import rendering modules
import { drawIsometricGrid } from './grid.js';
import { clipLineAgainstPolygon, clipLineAgainstPolygonPrecise, insetLine } from './clipping.js';

// Import visibility checker (Three.js GPU-based)
import { getVisibleFaces, initVisibilityChecker } from '../visibility/visibilityChecker.js';

// Import UI modules
import { getPositionOffsets } from '../ui/controls.js';

// Import jitter utility
import { createWavyLine } from '../utils/jitter.js';

const SVG_NS = "http://www.w3.org/2000/svg";

function computePolygonBounds(points = []) {
  if (!points.length) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  for (const pt of points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }
  return { minX, maxX, minY, maxY };
}

function boundsOverlap(a, b, padding = 0) {
  return !(
    a.maxX < b.minX - padding ||
    b.maxX < a.minX - padding ||
    a.maxY < b.minY - padding ||
    b.maxY < a.minY - padding
  );
}

function expandPolygon(points = [], factor = 1.0) {
  if (points.length === 0 || Math.abs(factor - 1.0) < 1e-6) {
    return points.map(p => ({ ...p }));
  }
  const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return points.map(p => ({
    x: centerX + (p.x - centerX) * factor,
    y: centerY + (p.y - centerY) * factor
  }));
}

/**
 * Get canvas dimensions from input fields
 * @returns {Object} {width, height}
 */
export function getCanvasDimensions() {
  const widthInput = document.getElementById("canvasWidth");
  const heightInput = document.getElementById("canvasHeight");

  let width = parseFloat(widthInput?.value);
  let height = parseFloat(heightInput?.value);

  if (isNaN(width) || width <= 0) width = DEFAULT_CANVAS.width;
  if (isNaN(height) || height <= 0) height = DEFAULT_CANVAS.height;

  return { width, height };
}

/**
 * Draw faces as solid grayscale fills (fast preview mode)
 * @param {SVGElement} svg - SVG element
 * @param {Array} faceData - Array of face data with normals and projections
 * @param {Object} faceColors - Face colors (ignored in grayscale mode)
 * @param {number} strokeWidth - Edge stroke width
 */
function drawSolidFaces(svg, faceData, faceColors, strokeWidth) {
  for (const faceInfo of faceData) {
    const { projectedFace, shading, face } = faceInfo;
    
    // Create polygon path
    const points = projectedFace.map(p => `${p.x},${p.y}`).join(' ');
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", points);
    
    // Calculate grayscale value from shading (0-1 range)
    // shading = 1 (bright), shading = 0 (dark)
    const brightness = Math.round(shading * 255);
    const fillColor = `rgb(${brightness}, ${brightness}, ${brightness})`;
    
    polygon.setAttribute("fill", fillColor);
    polygon.setAttribute("stroke", "#000000");
    polygon.setAttribute("stroke-width", strokeWidth * 0.5); // Thinner edges for solid mode
    polygon.setAttribute("data-face", face.name);
    
    svg.appendChild(polygon);
  }
}

/**
 * Draw faces as wireframe (edges only, ultra-fast)
 * @param {SVGElement} svg - SVG element
 * @param {Array} faceData - Array of face data
 * @param {number} strokeWidth - Line width
 */
function drawWireframe(svg, faceData, strokeWidth) {
  // Track drawn edges to avoid duplicates
  const drawnEdges = new Set();
  
  for (const faceInfo of faceData) {
    const { projectedFace } = faceInfo;
    
    // Draw each edge
    for (let i = 0; i < projectedFace.length; i++) {
      const p1 = projectedFace[i];
      const p2 = projectedFace[(i + 1) % projectedFace.length];
      
      // Create edge key (sorted to avoid duplicates)
      const edgeKey = [
        `${p1.x.toFixed(2)},${p1.y.toFixed(2)}`,
        `${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
      ].sort().join('|');
      
      if (drawnEdges.has(edgeKey)) continue;
      drawnEdges.add(edgeKey);
      
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", p1.x);
      line.setAttribute("y1", p1.y);
      line.setAttribute("x2", p2.x);
      line.setAttribute("y2", p2.y);
      line.setAttribute("stroke", "#000000");
      line.setAttribute("stroke-width", strokeWidth);
      svg.appendChild(line);
    }
  }
}

/**
 * Main draw function - renders the 3D cube with shading, shadows, and grid
 * @param {Number} orbitHorizontal - Horizontal orbit angle in degrees (for cube rotation around Z-axis)
 */
export function draw(orbitHorizontal) {
  const svg = document.getElementById("svg");
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions();
  svg.setAttribute("viewBox", `0 0 ${canvasWidth} ${canvasHeight}`);
  // Use "meet" to ensure entire canvas is visible, scaled proportionally to fit container
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  // Remove fixed dimensions - let CSS handle the sizing
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  // Set to fill container - preserveAspectRatio will ensure it scales proportionally
  svg.style.width = "100%";
  svg.style.height = "100%";
  const defs = document.createElementNS(SVG_NS, "defs");
  svg.appendChild(defs);

  // Get parameters
  const margin = +document.getElementById("margin").value;
  const strokeWidth = +document.getElementById("strokeWidth").value;
  // Get stroke color for grid (use black as default)
  const strokeColor = "#000000";
  
  // Get cross-hatch settings
  const crossHatch = document.getElementById("crossHatch")?.checked ?? false;
  const crossHatchDensity = crossHatch ? (+document.getElementById("crossHatchDensity")?.value ?? 100) / 100 : 0;
  
  const cubeSize = +document.getElementById("cubeSize").value;
  
  // Get projection parameters
  const viewMode = document.getElementById("viewMode").value;
  const perspectiveStrength = +document.getElementById("perspectiveStrength").value;
  
  // Orbit angles are now controlled by mouse (stored in global variables)
  // These define the CAMERA position around the cube
  // The cube itself is NOT rotated - the camera orbits around it
  
  const lightAngle = +document.getElementById("lightAngle").value;
  const lightElevation = +document.getElementById("lightElevation").value;
  const lightBrightness = +document.getElementById("lightBrightness").value;
  const ambientLight = +document.getElementById("ambientLight").value;
  
  const hatchSpacing = +document.getElementById("hatchSpacing").value;
  const minSpacing = +document.getElementById("minSpacing").value;
  const hatchAngle = +document.getElementById("hatchAngle").value;
  
  // Get line jitter settings
  const lineJitterEnabled = document.getElementById("lineJitterEnabled")?.checked ?? false;
  const lineJitter = lineJitterEnabled ? (+document.getElementById("lineJitter")?.value ?? 50) : 0;
  const jitterFrequency = +document.getElementById("jitterFrequency")?.value ?? 50;
  const jitterRandomness = +document.getElementById("jitterRandomness")?.value ?? 50;
  
  const showEdges = document.getElementById("showEdges").checked;
  const showShadow = document.getElementById("showShadow").checked;
  const showGrid = document.getElementById("showGrid").checked;
  const debugOcclusion = document.getElementById("debugOcclusion")?.checked ?? false;
  const advancedShading = document.getElementById("advancedShading")?.checked ?? false;
  const shadowFalloff = advancedShading ? (+document.getElementById("shadowFalloff")?.value ?? 2.0) : 2.0;
  const shadowSoftEdges = document.getElementById("shadowSoftEdges")?.checked ?? false;
  
  // Get shadow occlusion expansion factor (configurable for testing)
  // Reduced from 2.5% to 0.2% for minimal gap while preventing leaks
  const shadowExpansionPercent = +(document.getElementById("shadowExpansion")?.value ?? 0.2);
  const shadowExpansionFactor = 1.0 + (shadowExpansionPercent / 100.0);
  
  // Get shadow line inset amount (pulls lines away from boundaries)
  const shadowInsetAmount = +(document.getElementById("shadowInset")?.value ?? 0.05);

  // Canvas bounds
  const x0 = margin;
  const y0 = margin;
  const x1 = canvasWidth - margin;
  const y1 = canvasHeight - margin;
  
  const bounds = { x0, y0, x1, y1 };

  // Draw canvas boundary (full canvas size) - dim red outline
  const canvasBoundary = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  canvasBoundary.setAttribute("x", 0);
  canvasBoundary.setAttribute("y", 0);
  canvasBoundary.setAttribute("width", canvasWidth);
  canvasBoundary.setAttribute("height", canvasHeight);
  canvasBoundary.setAttribute("stroke", "#ff6b6b");
  canvasBoundary.setAttribute("stroke-width", 0.5);
  canvasBoundary.setAttribute("stroke-opacity", "0.4");
  canvasBoundary.setAttribute("stroke-dasharray", "4,4");
  canvasBoundary.setAttribute("fill", "none");
  canvasBoundary.setAttribute("data-preview-only", "true");
  svg.appendChild(canvasBoundary);

  // Draw frame (margin rectangle)
  const frame = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  frame.setAttribute("x", x0);
  frame.setAttribute("y", y0);
  frame.setAttribute("width", x1 - x0);
  frame.setAttribute("height", y1 - y0);
  frame.setAttribute("stroke", "black");
  frame.setAttribute("stroke-width", 0.3);
  frame.setAttribute("fill", "none");
  frame.setAttribute("data-preview-only", "true");
  svg.appendChild(frame);

  // Fixed floor position - always at z = 0 (horizontal plane)
  // Floor is static and never moves
  const FLOOR_Z = 0;
  
  // Get render mode early (needed for LOD selection)
  const renderMode = document.getElementById("renderMode")?.value || "full";
  
  // ============================================================
  // GEOMETRY: Create cube or use STL mesh with LOD caching
  // ============================================================
  let geometry;
  const meshMode = getMeshMode();
  
  if (meshMode === 'stl') {
    // Use loaded STL mesh
    const stlMesh = getCurrentMesh();
    if (stlMesh) {
      // Determine LOD level based on render mode
      // Full mode = high quality (strict merging)
      // Solid/Wireframe = low quality (aggressive merging for speed)
      const lodLevel = (renderMode === 'full') ? 'high' : 'low';
      
      // Create cache wrapper for convertSTLMesh
      const cacheWrapper = {
        get: (lod) => getCachedGeometry(lod),
        set: (lod, geom) => setCachedGeometry(lod, geom)
      };
      
      // Convert with LOD and caching
      geometry = convertSTLMesh(stlMesh, lodLevel, cacheWrapper);
      
      // Log detailed statistics
      const vertexCounts = {};
      for (const face of geometry.faces) {
        const count = face.indices.length;
        vertexCounts[count] = (vertexCounts[count] || 0) + 1;
      }
      console.log('STL mesh ready:', {
        lodLevel,
        vertices: geometry.vertices.length,
        faces: geometry.faces.length,
        faceTypes: vertexCounts
      });
      
      // Validate face data
      let invalidFaces = 0;
      for (const face of geometry.faces) {
        if (!face.indices || face.indices.length < 3) {
          invalidFaces++;
        }
      }
      if (invalidFaces > 0) {
        console.warn(`Warning: ${invalidFaces} invalid faces (< 3 vertices) detected`);
      }
    } else {
      // Fallback to cube if STL not loaded
      geometry = createCube(cubeSize);
      console.warn('STL mode active but no mesh loaded, using cube');
    }
  } else {
    // Use cube geometry
    geometry = createCube(cubeSize);
  }
  
  // ============================================================
  // STL ROTATION: Apply fixed rotations first (for STL meshes)
  // ============================================================
  let stlRotatedVertices = geometry.vertices;
  let stlRotatedGeometry = geometry; // Store rotated geometry with updated normals
  
  if (meshMode === 'stl') {
    const stlRotation = getSTLRotation();
    
    // Apply STL rotations (X, Y, Z in that order)
    const stlRotX = stlRotation.x * Math.PI / 180;
    const stlRotY = stlRotation.y * Math.PI / 180;
    const stlRotZ = stlRotation.z * Math.PI / 180;
    
    if (stlRotX !== 0 || stlRotY !== 0 || stlRotZ !== 0) {
      stlRotatedVertices = geometry.vertices.map(v => 
        rotatePoint(v, stlRotX, stlRotY, stlRotZ)
      );
      
      // STICK TO FLOOR: Re-normalize after rotation
      // Find the minimum Z value and shift everything up so min Z = 0
      const minZ = Math.min(...stlRotatedVertices.map(v => v.z));
      stlRotatedVertices = stlRotatedVertices.map(v => ({
        x: v.x,
        y: v.y,
        z: v.z - minZ // Shift to floor
      }));
      
      // Rotate face normals to match vertex rotation
      const rotatedFaces = geometry.faces.map(face => ({
        ...face,
        normal: rotatePoint(face.normal, stlRotX, stlRotY, stlRotZ)
      }));
      
      // Create updated geometry with rotated vertices and normals
      stlRotatedGeometry = {
        vertices: stlRotatedVertices,
        faces: rotatedFaces
      };
    }
  }
  
  // ============================================================
  // ORBIT ROTATION: Rotate around Z-axis (spinning on floor)
  // ============================================================
  // The geometry only rotates around the Z-axis (vertical axis)
  // This makes it spin on the floor like a top
  // orbitHorizontal controls the rotation angle around Z-axis
  
  const rotationX = 0; // No X rotation
  const rotationY = 0; // No Y rotation
  const rotationZ = orbitHorizontal * Math.PI / 180; // Only Z-axis rotation
  
  // Rotate geometry vertices (only around Z-axis)
  // Apply orbit rotation AFTER STL rotation
  const rotatedVertices = stlRotatedVertices.map(v => 
    rotatePoint(v, rotationX, rotationY, rotationZ)
  );
  
  // Geometry is already positioned correctly (bottom at z=0)
  // No need to adjust position - it's already on the floor
  const transformedVertices = rotatedVertices;
  
  // Step 4: Project to 2D and find bounding box to center on canvas
  const projected2D = transformedVertices.map(v => {
    const proj = project3DTo2D(v.x, v.y, v.z, viewMode, perspectiveStrength);
    return { x: proj.x, y: proj.y, z: v.z };
  });
  
  // Find bounding box of projected cube
  const projMinX = Math.min(...projected2D.map(p => p.x));
  const projMaxX = Math.max(...projected2D.map(p => p.x));
  const projMinY = Math.min(...projected2D.map(p => p.y));
  const projMaxY = Math.max(...projected2D.map(p => p.y));
  
  const projCenterX = (projMinX + projMaxX) / 2;
  const projCenterY = (projMinY + projMaxY) / 2;
  
  // Get position offsets from controls module
  const positionOffsets = getPositionOffsets();
  const canvasCenterX = (x0 + x1) / 2 + positionOffsets.x;
  const canvasCenterY = (y0 + y1) / 2 + positionOffsets.y;
  
  // Draw 3D isometric grid (on floor plane) if enabled - BEFORE cube
  if (showGrid) {
    drawIsometricGrid(svg, FLOOR_Z, x0, y0, x1, y1, canvasCenterX, canvasCenterY, projCenterX, projCenterY, strokeColor, strokeWidth, frame, viewMode, perspectiveStrength, lineJitter, jitterFrequency, jitterRandomness);
  }
  
  // Center the cube on canvas (with position offset applied)
  const projectedVertices = projected2D.map(p => ({
    x: p.x - projCenterX + canvasCenterX,
    y: p.y - projCenterY + canvasCenterY,
    z: p.z
  }));

  // Calculate light direction
  const lightDir = calculateLightDirection(lightAngle, lightElevation);

  // ============================================================
  // VIEW DIRECTION: Derived from isometric projection formula
  // ============================================================
  // The isometric projection formula is:
  //   isoX = (x - y) * cos(30°)
  //   isoY = -(z + (x + y) * sin(30°))
  //
  // This projection can be thought of as viewing from a direction where:
  // - We see the X-Y plane rotated 45° (from the (1,1,0) direction)
  // - We're elevated to see Z from above
  //
  // For depth calculation, we need the view direction that matches what we actually see.
  // In the 2D projection, "front" means closer along the view direction.
  //
  // The key insight: In isometric, depth is primarily determined by:
  // - Z coordinate (vertical) - higher Z is further back
  // - But also by the (x + y) component - larger (x+y) is further back
  //
  // Actually, let's think about it differently: In the projection, isoY = -(z + (x + y) * sin(30°))
  // This means that points with larger (z + (x + y) * sin(30°)) appear LOWER on screen.
  // So "front" (closer) should have SMALLER (z + (x + y) * sin(30°))
  // And "back" (further) should have LARGER (z + (x + y) * sin(30°))
  //
  // For depth calculation, we can use: depth = z + (x + y) * sin(30°)
  // This matches what the projection actually shows!
  
  // Use the actual projection-based depth calculation
  // This matches what we see in the 2D projection
  const ISO_SIN = Math.sin(ISO_ANGLE);
  
  // View direction for back-face culling
  // For isometric view, camera looks DOWN and INTO the scene from above-front-right
  // We need the direction FROM scene TO camera (opposite of view direction)
  // In isometric, this points UP and OUT from the scene
  const viewDirFromScene = {
    x: Math.cos(ISO_ANGLE) / Math.sqrt(2),  // Positive X (right)
    y: Math.cos(ISO_ANGLE) / Math.sqrt(2),  // Positive Y (forward)
    z: ISO_SIN                               // Positive Z (up)
  };
  
  // Normalize (should already be normalized, but let's be sure)
  const viewDirLen = Math.sqrt(viewDirFromScene.x ** 2 + viewDirFromScene.y ** 2 + viewDirFromScene.z ** 2);
  viewDirFromScene.x /= viewDirLen;
  viewDirFromScene.y /= viewDirLen;
  viewDirFromScene.z /= viewDirLen;
  
  // ============================================================
  // PROCESS FACES: Calculate visibility, shading, depth, and projection
  // ============================================================
  // Use stlRotatedGeometry which has updated normals if STL rotations were applied
  let faceData = stlRotatedGeometry.faces.map((face, originalFaceIndex) => {
    // Get 3D vertices of this face (after rotation and floor positioning)
    const faceVertices = face.indices.map(i => transformedVertices[i]);
    
    // Calculate face center in 3D space
    const faceCenter = {
      x: faceVertices.reduce((sum, v) => sum + v.x, 0) / faceVertices.length,
      y: faceVertices.reduce((sum, v) => sum + v.y, 0) / faceVertices.length,
      z: faceVertices.reduce((sum, v) => sum + v.z, 0) / faceVertices.length
    };
    
    // Rotate face normal to match cube rotation
    const rotatedNormal = rotatePoint(face.normal, rotationX, rotationY, rotationZ);
    
    // Normalize the rotated normal
    const normalLen = Math.sqrt(rotatedNormal.x ** 2 + rotatedNormal.y ** 2 + rotatedNormal.z ** 2);
    const normalizedNormal = normalLen > 1e-6 ? {
      x: rotatedNormal.x / normalLen,
      y: rotatedNormal.y / normalLen,
      z: rotatedNormal.z / normalLen
    } : { x: 0, y: 0, z: 0 };
    
    // ============================================================
    // BACK-FACE CULLING: Pre-filter obviously hidden faces before GPU check
    // ============================================================
    // This is a FAST pre-filter that reduces GPU work by eliminating faces
    // that are clearly facing away from the camera. The GPU check is still
    // the authoritative source for complex occlusion.
    
    // Dot product between rotated face normal and fixed view direction (from scene to camera)
    // viewDirFromScene points FROM the scene TOWARD the camera
    // So a face normal pointing TOWARD camera has POSITIVE dot product with viewDir
    // Positive dot product = face points toward camera = potentially VISIBLE
    // Negative dot product = face points away from camera = definitely HIDDEN
    const dotProduct = normalizedNormal.x * viewDirFromScene.x + 
                       normalizedNormal.y * viewDirFromScene.y + 
                       normalizedNormal.z * viewDirFromScene.z;
    
    // PRE-FILTER: Use back-face culling to quickly eliminate obviously hidden faces
    // This reduces GPU work significantly for complex STL models
    // Use a conservative threshold (-0.1) to avoid culling edge cases at grazing angles
    const BACKFACE_THRESHOLD = -0.1; // Faces with dot < -0.1 are clearly back-facing
    
    if (dotProduct < BACKFACE_THRESHOLD) {
      // Face is clearly back-facing (normal points away from camera) - skip it
      return null;
    }
    
    // Track back-face culling result for later GPU verification
    // Faces near threshold (-0.1 to 0) will be verified by GPU
    
    // If face is nearly perpendicular but slightly facing away, still show it
    // This handles edge cases at rotation boundaries
    
    // ============================================================
    // SHADING: Calculate light intensity on this face
    // ============================================================
    const shading = calculateShading(normalizedNormal, lightDir, lightBrightness, ambientLight);
    
    // ============================================================
    // PROJECTION: Convert 3D face vertices to 2D screen coordinates
    // ============================================================
    const projectedFace = face.indices.map(i => {
      const proj = project3DTo2D(transformedVertices[i].x, transformedVertices[i].y, transformedVertices[i].z, viewMode, perspectiveStrength);
      // Center on canvas
      return {
        x: proj.x - projCenterX + canvasCenterX,
        y: proj.y - projCenterY + canvasCenterY
      };
    });
    const faceBounds = computePolygonBounds(projectedFace);
    
    // ============================================================
    // DEPTH CALCULATION: IMPROVED Multi-point depth approach
    // ============================================================
    // CRITICAL FIX: Using only centroid depth fails for large faces that span depth ranges
    // Solution: Calculate depth for ALL vertices and use appropriate statistics
    // 
    // Strategy:
    // 1. Calculate depth for each vertex along view direction
    // 2. Use MAXIMUM depth (closest point to camera) as primary sort key
    //    This ensures faces with ANY part closer are drawn last
    // 3. Use average depth as secondary for tie-breaking
    // 4. Use screen Y as tertiary for final ordering
    
    // Calculate depth for ALL vertices (not just centroid)
    const vertexDepths = faceVertices.map(v => 
      v.x * viewDirFromScene.x + v.y * viewDirFromScene.y + v.z * viewDirFromScene.z
    );
    
    // Find min (furthest), max (closest), and average depth
    const minDepth3D = Math.min(...vertexDepths);  // Furthest vertex from camera
    const maxDepth3D = Math.max(...vertexDepths);  // Closest vertex to camera
    const avgDepth3D = vertexDepths.reduce((sum, d) => sum + d, 0) / vertexDepths.length;
    
    // Depth range (for debugging large faces)
    const depthRange = maxDepth3D - minDepth3D;
    
    // Screen Y for tie-breaking (tertiary key)
    // In SVG, Y increases downward:
    // - SMALLER Y = appears HIGHER on screen = CLOSER/FRONT = draw LAST
    // - LARGER Y = appears LOWER on screen = FARTHER/BACK = draw FIRST
    const avgScreenY = projectedFace.reduce((sum, p) => sum + p.y, 0) / projectedFace.length;
    
    // SIMPLIFIED DEPTH FORMULA:
    // Use average depth as primary sorting key
    // This gives consistent results without numerical precision issues
    const depth = avgDepth3D;
    
    // Calculate per-face hatch angle (base angle + face-specific offset)
    const faceHatchAngle = (hatchAngle + (face.hatchAngleOffset || 0)) % 180;
    
    return {
      face,
      originalFaceIndex,        // Track original index for GPU visibility matching
      faceVertices3D: faceVertices, // Store 3D vertices for gradient calculation
      projectedFace,
      normalizedNormal,
      shading,
      depth: depth,
      minDepth: minDepth3D,     // For debugging and analysis
      maxDepth: maxDepth3D,     // For debugging and analysis
      avgDepth: avgDepth3D,     // For debugging and analysis
      depthRange: depthRange,   // For debugging large face issues
      faceHatchAngle,
      faceCenter,
      bounds: faceBounds
    };
  }).filter(f => f !== null); // Remove back-facing faces (pre-filter)

  // Track pre-filter results
  const afterBackfaceCull = faceData.length;
  const totalFacesOriginal = stlRotatedGeometry.faces.length;
  const backfaceCulled = totalFacesOriginal - afterBackfaceCull;
  
  // ============================================================
  // THREE.JS VISIBILITY CHECK: Use GPU to determine truly visible faces
  // This handles complex occlusion that back-face culling can't detect
  // ============================================================
  const beforeGPUCount = faceData.length;
  
  // Get visible face indices from Three.js GPU rendering
  const visibleFaceIndices = getVisibleFaces(
    transformedVertices,
    stlRotatedGeometry.faces,
    {
      viewMode,
      perspectiveStrength
    }
  );
  
  // Filter faceData to only include GPU-visible faces
  // Each faceData entry has originalFaceIndex that corresponds to the GPU's face indices
  faceData = faceData.filter(data => visibleFaceIndices.has(data.originalFaceIndex));
  
  const gpuCulled = beforeGPUCount - faceData.length;
  
  // Detailed visibility logging
  console.log(`Face Visibility Pipeline:`);
  console.log(`  Total faces: ${totalFacesOriginal}`);
  console.log(`  After back-face pre-filter: ${afterBackfaceCull} (${backfaceCulled} culled, saved ${((backfaceCulled / totalFacesOriginal) * 100).toFixed(1)}% GPU work)`);
  console.log(`  After GPU occlusion check: ${faceData.length} (${gpuCulled} additional culled)`);
  console.log(`  Final visible: ${faceData.length}/${totalFacesOriginal} (${((faceData.length / totalFacesOriginal) * 100).toFixed(1)}%)`)

  // ============================================================
  // DEPTH SORTING: Render back faces first, front faces last
  // Uses optimized bucket sort for large meshes (>100 faces)
  // ============================================================
  // Sort ASCENDING: smaller depth (further from camera) drawn first (back)
  // Larger depth (closer to camera) drawn last (front)
  
  const BUCKET_SORT_THRESHOLD = 100; // Use bucket sort for meshes with >100 faces
  
  if (faceData.length > BUCKET_SORT_THRESHOLD) {
    // OPTIMIZED: Bucket sort for large meshes
    // O(n) bucket assignment + O(n/k * log(n/k)) per-bucket sort
    // Much faster than O(n log n) full sort for large n
    
    const startSort = performance.now();
    
    // Find depth range
    let sortMinDepth = Infinity, sortMaxDepth = -Infinity;
    for (const f of faceData) {
      if (f.depth < sortMinDepth) sortMinDepth = f.depth;
      if (f.depth > sortMaxDepth) sortMaxDepth = f.depth;
    }
    
    const sortDepthRange = sortMaxDepth - sortMinDepth;
    
    if (sortDepthRange < 0.001) {
      // All faces at same depth - no sorting needed
    } else {
      // Create buckets (sqrt(n) buckets is optimal for bucket sort)
      const numBuckets = Math.ceil(Math.sqrt(faceData.length));
      const buckets = Array.from({ length: numBuckets }, () => []);
      const bucketSize = sortDepthRange / numBuckets;
      
      // Distribute faces into buckets
      for (const f of faceData) {
        const bucketIndex = Math.min(
          numBuckets - 1,
          Math.floor((f.depth - sortMinDepth) / bucketSize)
        );
        buckets[bucketIndex].push(f);
      }
      
      // Sort each bucket individually (small arrays = fast)
      for (const bucket of buckets) {
        if (bucket.length > 1) {
          bucket.sort((a, b) => a.depth - b.depth);
        }
      }
      
      // Flatten buckets back into faceData
      let idx = 0;
      for (const bucket of buckets) {
        for (const f of bucket) {
          faceData[idx++] = f;
        }
      }
    }
    
    const sortTime = (performance.now() - startSort).toFixed(2);
    console.log(`Bucket sort: ${faceData.length} faces in ${sortTime}ms (${Math.ceil(Math.sqrt(faceData.length))} buckets)`);
    
  } else {
    // Standard sort for small meshes
    faceData.sort((a, b) => a.depth - b.depth);
  }
  
  // Debug logging for depth sorting (STL mode only)
  if (meshMode === 'stl' && faceData.length > 0) {
    console.log(`Depth sorting: ${faceData.length} faces`);
    console.log(`First face (back): depth=${faceData[0].depth.toFixed(2)}, ` +
      `range=${faceData[0].depthRange.toFixed(3)}, ` +
      `min/max=[${faceData[0].minDepth.toFixed(2)}, ${faceData[0].maxDepth.toFixed(2)}]`);
    console.log(`Last face (front): depth=${faceData[faceData.length - 1].depth.toFixed(2)}, ` +
      `range=${faceData[faceData.length - 1].depthRange.toFixed(3)}, ` +
      `min/max=[${faceData[faceData.length - 1].minDepth.toFixed(2)}, ${faceData[faceData.length - 1].maxDepth.toFixed(2)}]`);
    console.log(`Total depth range: ${(faceData[faceData.length - 1].depth - faceData[0].depth).toFixed(2)}`);
    
    // Find faces with large depth ranges (potential problem faces)
    const largeFaces = faceData.filter(f => f.depthRange > 5.0).length;
    if (largeFaces > 0) {
      console.warn(`⚠️ Warning: ${largeFaces} faces with depth range > 5.0 (may cause layering issues)`);
      // Show top 3 largest faces
      const sorted = [...faceData].sort((a, b) => b.depthRange - a.depthRange).slice(0, 3);
      sorted.forEach((f, i) => {
        console.log(`  Large face #${i + 1}: range=${f.depthRange.toFixed(2)}, vertices=${f.face.indices.length}`);
      });
    }
  }
  
  // Calculate depth range for depth-based rendering
  const minDepth = faceData.length > 0 ? Math.min(...faceData.map(f => f.depth)) : 0;
  const maxDepth = faceData.length > 0 ? Math.max(...faceData.map(f => f.depth)) : 0;
  const depthRange = maxDepth - minDepth;

  let totalLines = 0;
  let totalLength = 0; // Total drawing length in mm
  let totalTravel = 0; // Total travel distance in mm
  let lastX = null;
  let lastY = null;

  // Store shadow elements to draw them FIRST (before cube)
  const shadowElements = [];

  // ============================================================
  // FLOOR SHADOW WITH CREATIVE CROSS-HATCHING (proper occlusion)
  // ============================================================
  if (showShadow) {
    // Project all cube vertices onto floor to create shadow polygon
    const shadowVertices3D = projectShadow(transformedVertices, lightDir, FLOOR_Z);
    
    // Project shadow vertices to 2D and center on canvas
    let shadowPolygon = shadowVertices3D.map(v => {
      const proj = project3DTo2D(v.x, v.y, v.z, viewMode, perspectiveStrength);
      return {
        x: proj.x - projCenterX + canvasCenterX,
        y: proj.y - projCenterY + canvasCenterY
      };
    });
    
    // CRITICAL FIX: Clip shadow polygon to canvas bounds with generous margin
    // This prevents shadow lines from leaking outside canvas at extreme angles
    const SHADOW_MARGIN = Math.max(canvasWidth, canvasHeight) * 0.3; // 30% margin for safety
    const shadowBounds = {
      minX: -SHADOW_MARGIN,
      maxX: canvasWidth + SHADOW_MARGIN,
      minY: -SHADOW_MARGIN,
      maxY: canvasHeight + SHADOW_MARGIN
    };
    
    // Filter out shadow vertices that are way outside canvas bounds
    // This prevents infinite/huge shadow projections at certain light angles
    shadowPolygon = shadowPolygon.filter(p => {
      return p.x > shadowBounds.minX && p.x < shadowBounds.maxX &&
             p.y > shadowBounds.minY && p.y < shadowBounds.maxY;
    });
    
    // Validate and clean up shadow polygon
    // Remove duplicate points and ensure we have a valid polygon
    const cleanedShadow = [];
    const MIN_DIST = 0.1;
    
    for (let i = 0; i < shadowPolygon.length; i++) {
      const current = shadowPolygon[i];
      const isDuplicate = cleanedShadow.some(p => 
        Math.hypot(p.x - current.x, p.y - current.y) < MIN_DIST
      );
      if (!isDuplicate) {
        cleanedShadow.push(current);
      }
    }
    
    // SAFETY CHECK: Ensure we have enough points for a valid shadow
    if (cleanedShadow.length < 3) {
      // Shadow polygon invalid or outside bounds - skip shadow rendering
      // This prevents artifacts when shadow projects to infinity
    } else if (cleanedShadow.length >= 3) {
      // Helper function for shadow convex hull (simpler version)
      const computeShadowConvexHull = (points) => {
        if (points.length < 3) return points;
        
        // Find bottom-left point
        let start = points[0];
        for (const p of points) {
          if (p.y > start.y || (Math.abs(p.y - start.y) < 1e-9 && p.x < start.x)) {
            start = p;
          }
        }
        
        // Sort points by polar angle from start point
        const sorted = points.filter(p => p !== start).sort((a, b) => {
          const angleA = Math.atan2(a.y - start.y, a.x - start.x);
          const angleB = Math.atan2(b.y - start.y, b.x - start.x);
          if (Math.abs(angleA - angleB) < 1e-9) {
            // Same angle, sort by distance
            const distA = Math.hypot(a.x - start.x, a.y - start.y);
            const distB = Math.hypot(b.x - start.x, b.y - start.y);
            return distA - distB;
          }
          return angleA - angleB;
        });
        
        const hull = [start];
        
        for (const point of sorted) {
          // Remove points that make a clockwise turn
          while (hull.length > 1) {
            const p1 = hull[hull.length - 2];
            const p2 = hull[hull.length - 1];
            const cross = (p2.x - p1.x) * (point.y - p1.y) - (p2.y - p1.y) * (point.x - p1.x);
            if (cross <= 0) {
              hull.pop();
            } else {
              break;
            }
          }
          hull.push(point);
        }
        
        return hull;
      };
      
      shadowPolygon = computeShadowConvexHull(cleanedShadow);
    } else {
      shadowPolygon = cleanedShadow;
    }
    
    // Get cube's bottom face vertices (where it touches the floor)
    const cubeBottomVertices3D = [
      transformedVertices[0], // bottom-left-back
      transformedVertices[1], // bottom-right-back
      transformedVertices[5], // bottom-right-front
      transformedVertices[4]  // bottom-left-front
    ];
    
    // Project bottom face to 2D screen coordinates
    const cubeBottomFace2D = cubeBottomVertices3D.map(v => {
      const proj = project3DTo2D(v.x, v.y, v.z, viewMode, perspectiveStrength);
      return {
        x: proj.x - projCenterX + canvasCenterX,
        y: proj.y - projCenterY + canvasCenterY
      };
    });
    
    // Calculate center of bottom face for expansion
    const bottomFaceCenterX = cubeBottomFace2D.reduce((sum, p) => sum + p.x, 0) / cubeBottomFace2D.length;
    const bottomFaceCenterY = cubeBottomFace2D.reduce((sum, p) => sum + p.y, 0) / cubeBottomFace2D.length;
    
    // Create PROPER occlusion polygon using ALL visible cube faces
    // We need to collect ALL projected vertices from visible faces to create the silhouette
    const cubeOcclusionPolygon = [];
    
    // Get all visible face vertices (these are faces that passed back-face culling)
    faceData.forEach(face => {
      face.projectedFace.forEach(vertex => {
        cubeOcclusionPolygon.push(vertex);
      });
    });
    
    // Create PROPER cube silhouette for occlusion
    // Collect ALL vertices from all visible faces to create complete silhouette
    const allVisibleVertices = [];
    faceData.forEach(face => {
      face.projectedFace.forEach(vertex => {
        allVisibleVertices.push(vertex);
      });
    });
    
    // Compute convex hull using improved gift wrapping algorithm (Jarvis march)
    // convexHull is now imported from src/core/geometry.js
    
    // Get convex hull of all visible cube vertices
    const cubeFootprintBase = convexHull(allVisibleVertices);
    
    // Calculate center of footprint
    const footprintCenterX = cubeFootprintBase.reduce((sum, p) => sum + p.x, 0) / cubeFootprintBase.length;
    const footprintCenterY = cubeFootprintBase.reduce((sum, p) => sum + p.y, 0) / cubeFootprintBase.length;
    
    // Expand silhouette to ensure no shadow lines leak through at any rotation angle
    // Increased expansion to prevent leakage at all angles including grazing angles
    // Use configurable expansion factor from UI (default 2.5%)
    const cubeFootprint = cubeFootprintBase.map(p => ({
      x: footprintCenterX + (p.x - footprintCenterX) * shadowExpansionFactor,
      y: footprintCenterY + (p.y - footprintCenterY) * shadowExpansionFactor
    }));
    
    // CREATIVE SHADOW LAYERS with CROSS-HATCHING
    // Shadow uses light projection for directionality
    // Start with contact shadow (bottom face), then transition to projected shadow
    
    // Build shadow layers dynamically based on shadowFalloff
    // Higher falloff = softer edges (more blur layers extending beyond shadow)
    // REDUCED darkness values for much lighter, realistic shadow
    const shadowLayers = [
      { type: 'contact', scale: 1.00, darkness: 0.45, crossHatch: true },   // Contact: cube bottom face (lighter)
      { type: 'blend',   scale: 0.25, darkness: 0.38, crossHatch: true },   // Blend: 25% to projected shadow
      { type: 'project', scale: 0.50, darkness: 0.28, crossHatch: true },   // Projected: 50%
      { type: 'project', scale: 0.75, darkness: 0.18, crossHatch: false },  // Projected: 75%
      { type: 'project', scale: 1.00, darkness: 0.10, crossHatch: false }   // Projected: full shadow (much lighter)
    ];
    
    // Add DIRECTIONAL soft edge blur layers based on shadowFalloff
    // shadowFalloff typically ranges from 1.0 (sharp) to 4.0 (very soft)
    // Blur extends ONLY in the direction AWAY from the light source (physically accurate)
    // ONLY add blur layers if Shadow Soft Edges is enabled
    if (shadowSoftEdges && advancedShading && shadowFalloff > 1.0) {
      // Calculate blur intensity and reach based on falloff
      const blurIntensity = (shadowFalloff - 1.0) / 3.0; // Normalize to 0-1 range (assuming max falloff ~4.0)
      const numBlurLayers = Math.ceil(2 + blurIntensity * 2); // 2-4 blur layers (fewer for lighter shadow)
      const maxBlurExtension = 0.03 + blurIntensity * 0.08; // Extend 3-11% beyond shadow edge
      
      // Add blur layers that extend DIRECTIONALLY beyond the main shadow
      for (let i = 1; i <= numBlurLayers; i++) {
        const t = i / numBlurLayers; // 0 to 1
        const blurExtension = t * maxBlurExtension;
        
        // Smoother darkness curve for more gradual transitions
        // Use power function that creates gentle fadeout
        // REDUCED darkness for lighter blur layers
        const falloffPower = 2.0 + shadowFalloff * 0.25; // 2.0 to 3.0 range
        const blurDarkness = 0.08 * Math.pow(1 - t, falloffPower); // Much lighter blur
        
        shadowLayers.push({
          type: 'directionalBlur',
          blurExtension: blurExtension, // How much to extend in light direction
          darkness: blurDarkness,
          crossHatch: false,
          isBlurLayer: true, // Mark as blur layer for special handling
          blurLayerIndex: i // Track blur layer depth
          // NO angle variation - keep all lines parallel for clean hatch infill style
        });
      }
    }
    
    // Calculate light direction in 2D (for directional blur)
    // Use the 3D light direction projected onto the floor plane
    // This correctly accounts for both angle and elevation
    const lightDir3D = lightDir; // Already calculated above
    
    // Project 3D light direction onto floor (X-Y plane)
    // The shadow extends in this direction
    const lightDir2DLength = Math.sqrt(lightDir3D.x * lightDir3D.x + lightDir3D.y * lightDir3D.y);
    const lightDir2D = lightDir2DLength > 0.001 ? {
      x: lightDir3D.x / lightDir2DLength,
      y: lightDir3D.y / lightDir2DLength
    } : {
      x: Math.cos(lightAngle * Math.PI / 180),
      y: Math.sin(lightAngle * Math.PI / 180)
    };
    
    /**
     * Round/fillet corners of a polygon for soft shadow effect
     * @param {Array} polygon - Array of {x, y} points
     * @param {Number} radius - Corner rounding radius
     * @returns {Array} New polygon with rounded corners
     */
    const roundPolygonCorners = (polygon, radius) => {
      if (polygon.length < 3 || radius <= 0) return polygon;
      
      const rounded = [];
      const numPoints = polygon.length;
      
      for (let i = 0; i < numPoints; i++) {
        const prev = polygon[(i - 1 + numPoints) % numPoints];
        const curr = polygon[i];
        const next = polygon[(i + 1) % numPoints];
        
        // Vectors from current to prev and next
        const toPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
        const toNext = { x: next.x - curr.x, y: next.y - curr.y };
        
        const distPrev = Math.sqrt(toPrev.x * toPrev.x + toPrev.y * toPrev.y);
        const distNext = Math.sqrt(toNext.x * toNext.x + toNext.y * toNext.y);
        
        // Normalize
        if (distPrev > 0) {
          toPrev.x /= distPrev;
          toPrev.y /= distPrev;
        }
        if (distNext > 0) {
          toNext.x /= distNext;
          toNext.y /= distNext;
        }
        
        // Use smaller radius if edges are too short
        const actualRadius = Math.min(radius, distPrev * 0.4, distNext * 0.4);
        
        // Points where rounding starts/ends
        const startPt = {
          x: curr.x + toPrev.x * actualRadius,
          y: curr.y + toPrev.y * actualRadius
        };
        const endPt = {
          x: curr.x + toNext.x * actualRadius,
          y: curr.y + toNext.y * actualRadius
        };
        
        // Add start point
        rounded.push(startPt);
        
        // Add arc points for smooth curve
        // More points for larger radius = smoother curves
        const numArcPoints = Math.max(3, Math.ceil(actualRadius / 5)); // 3-6 points based on radius
        for (let j = 1; j <= numArcPoints; j++) {
          const t = j / (numArcPoints + 1);
          // Quadratic bezier with control point at corner
          const s = 1 - t;
          const arcPt = {
            x: s * s * startPt.x + 2 * s * t * curr.x + t * t * endPt.x,
            y: s * s * startPt.y + 2 * s * t * curr.y + t * t * endPt.y
          };
          rounded.push(arcPt);
        }
        
        // End point will be added as start point of next iteration
      }
      
      return rounded;
    };
    
    shadowLayers.forEach((layer, layerIndex) => {
      let scaledShadow;
      
      if (layer.type === 'contact') {
        // Contact shadow: use cube's bottom face (no light direction)
        scaledShadow = cubeBottomFace2D.map(p => {
          const dx = p.x - bottomFaceCenterX;
          const dy = p.y - bottomFaceCenterY;
          return {
            x: bottomFaceCenterX + dx * layer.scale,
            y: bottomFaceCenterY + dy * layer.scale
          };
        });
      } else if (layer.type === 'directionalBlur') {
        // DIRECTIONAL BLUR: Extend shadow only in the direction AWAY from light
        // This creates physically accurate soft shadows
        
        // Calculate cube bottom center (contact point with floor)
        const cubeBottomCenterX = cubeBottomFace2D.reduce((sum, p) => sum + p.x, 0) / cubeBottomFace2D.length;
        const cubeBottomCenterY = cubeBottomFace2D.reduce((sum, p) => sum + p.y, 0) / cubeBottomFace2D.length;
        
        // The shadow polygon was created by projecting the cube along light rays
        // To add blur, we extend each shadow point further along its ray from the cube base
        scaledShadow = shadowPolygon.map((shadowPt, idx) => {
          // Vector from cube bottom center to shadow point
          const dx = shadowPt.x - cubeBottomCenterX;
          const dy = shadowPt.y - cubeBottomCenterY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Only extend points that are AWAY from the light (in shadow direction)
          // Check if this point is in the shadow direction (away from light)
          if (dist > 1.0) { // Threshold to avoid division by zero
            const dirX = dx / dist;
            const dirY = dy / dist;
            
            // Dot product with light direction to check if point is in shadow direction
            // Light direction points FROM light TO scene, so shadow extends in SAME direction
            const dotWithLight = dirX * lightDir2D.x + dirY * lightDir2D.y;
            
            // Use SMOOTH transition instead of hard cutoff to prevent jumping
            // Smoothstep function: smooth transition from 0 to 1 in range [-0.2, 0.5]
            // This prevents discontinuities as cube rotates
            let blurFactor = 0;
            if (dotWithLight < -0.2) {
              blurFactor = 0; // Fully lit side - no blur
            } else if (dotWithLight > 0.5) {
              blurFactor = 1; // Fully shadow side - full blur
            } else {
              // Smooth transition zone
              const t = (dotWithLight + 0.2) / 0.7; // Map [-0.2, 0.5] to [0, 1]
              blurFactor = t * t * (3 - 2 * t); // Smoothstep formula
            }
            
            if (blurFactor > 0.01) { // Only extend if blur factor is significant
              // Extension amount scales with distance AND blur factor
              // Blur factor creates smooth transition at edges
              const baseExtension = Math.min(dist * layer.blurExtension, 20); // Cap at 20mm
              const extensionAmount = baseExtension * blurFactor;
              
              return {
                x: shadowPt.x + dirX * extensionAmount,
                y: shadowPt.y + dirY * extensionAmount
              };
            }
          }
          
          // Point is at cube base or on lit side - no blur (sharp)
          return { x: shadowPt.x, y: shadowPt.y };
        });
      } else if (layer.type === 'blend') {
        // Blend between contact and projected shadow
        // Use proper polygon interpolation to handle different vertex counts
        scaledShadow = [];
        const blendFactor = layer.scale; // 0 = all contact, 1 = all projected
        
        // Resample both polygons to have the same number of points for smooth blending
        const targetPointCount = Math.max(cubeBottomFace2D.length, shadowPolygon.length, 8);
        
        // Helper function to resample a polygon to have N points
        const resamplePolygon = (poly, n) => {
          if (poly.length === 0) return [];
          if (poly.length === 1) return Array(n).fill(poly[0]);
          
          const result = [];
          const totalLength = poly.reduce((sum, p, i) => {
            const next = poly[(i + 1) % poly.length];
            return sum + Math.hypot(next.x - p.x, next.y - p.y);
          }, 0);
          
          const segmentLength = totalLength / n;
          let accumulatedLength = 0;
          let currentEdge = 0;
          
          for (let i = 0; i < n; i++) {
            const targetLength = i * segmentLength;
            
            // Find the edge containing this point
            while (accumulatedLength < targetLength && currentEdge < poly.length) {
              const p1 = poly[currentEdge];
              const p2 = poly[(currentEdge + 1) % poly.length];
              const edgeLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);
              
              if (accumulatedLength + edgeLength >= targetLength) {
                // Interpolate along this edge
                const t = (targetLength - accumulatedLength) / edgeLength;
                result.push({
                  x: p1.x + t * (p2.x - p1.x),
                  y: p1.y + t * (p2.y - p1.y)
                });
                break;
              }
              
              accumulatedLength += edgeLength;
              currentEdge++;
            }
            
            // Fallback if we've gone past the end
            if (result.length <= i) {
              result.push(poly[poly.length - 1]);
            }
          }
          
          return result;
        };
        
        const contactResampled = resamplePolygon(cubeBottomFace2D, targetPointCount);
        const shadowResampled = resamplePolygon(shadowPolygon, targetPointCount);
        
        // Blend the resampled polygons
        for (let i = 0; i < targetPointCount; i++) {
          const contactPt = contactResampled[i];
          const shadowPt = shadowResampled[i];
          
          scaledShadow.push({
            x: contactPt.x * (1 - blendFactor) + shadowPt.x * blendFactor,
            y: contactPt.y * (1 - blendFactor) + shadowPt.y * blendFactor
          });
        }
      } else {
        // Projected shadow: use light-projected shadow polygon
        // Calculate center of shadow for scaling
        const shadowCenterX = shadowPolygon.reduce((sum, p) => sum + p.x, 0) / shadowPolygon.length;
        const shadowCenterY = shadowPolygon.reduce((sum, p) => sum + p.y, 0) / shadowPolygon.length;
        
        scaledShadow = shadowPolygon.map(p => {
          const dx = p.x - shadowCenterX;
          const dy = p.y - shadowCenterY;
          return {
            x: shadowCenterX + dx * layer.scale,
            y: shadowCenterY + dy * layer.scale
          };
        });
      }
      
      // Apply corner rounding based on shadowFalloff (higher falloff = more rounding)
      // This creates soft, natural-looking shadow edges
      // ONLY apply if Shadow Soft Edges is enabled
      if (shadowSoftEdges && advancedShading && shadowFalloff > 1.0) {
        // Calculate rounding radius based on falloff with smooth curve
        // Higher falloff = larger radius = rounder corners
        const falloffIntensity = (shadowFalloff - 1.0) / 3.0; // 0-1 range
        
        // Use power curve for more natural rounding progression
        const roundingCurve = Math.pow(falloffIntensity, 0.8); // Gentle curve
        
        // Base radius on cube size and layer
        const baseRadius = cubeSize * 0.06; // 6% of cube size (slightly increased)
        
        // Blur layers get progressively more rounding for smooth gradient effect
        const layerMultiplier = layer.isBlurLayer ? 
          (1.0 + layer.blurExtension * 4.0) : // Blur layers: 1.0x to 1.44x
          1.0; // Regular layers: no multiplier
        
        const roundingRadius = baseRadius * roundingCurve * layerMultiplier;
        
        // Apply rounding if radius is significant
        if (roundingRadius > 0.5) {
          scaledShadow = roundPolygonCorners(scaledShadow, roundingRadius);
        }
      }
      
      // Calculate "shading" value for shadow
      // In advanced mode, this will be overridden per-line with gradient calculation
      // For blur layers in simple mode, boost lightness for softer appearance
      let shadowShading = 1.0 - layer.darkness;
      if (layer.isBlurLayer && !advancedShading) {
        // In simple mode, use smooth gradient curve for blur layers (MUCH lighter)
        const normalizedExtension = Math.min(1.0, layer.blurExtension / 0.11);
        const gradientCurve = Math.pow(normalizedExtension, 0.7);
        shadowShading = Math.max(shadowShading, 0.80 + gradientCurve * 0.18); // Much lighter
      }
      
      // Define hatch angle - ALL shadow layers use the SAME angle for consistent, clean hatch infill
      // No variations - parallel lines only, matching cube face style
      const primaryAngle = (lightAngle + 90) % 180;
      
      // Use new cross-hatch system if enabled, otherwise fall back to old layer-based system
      const useNewCrossHatch = crossHatch;
      const useOldCrossHatch = !useNewCrossHatch && layer.crossHatch;
      
      // Generate hatch lines
      let shadowHatchLines;
      
      // For blur layers, use progressively wider spacing for softer appearance
      // Wider spacing = fewer lines = softer, lighter appearance
      // SIGNIFICANTLY INCREASED spacing for much lighter shadow
      const layerHatchSpacing = layer.isBlurLayer ? 
        hatchSpacing * (1.5 + layer.blurExtension * 12.0) : // Blur layers: 1.5x to 2.8x spacing (much wider)
        hatchSpacing * 1.3; // Regular shadow layers: 30% wider than cube (lighter shadow)
      const layerMinSpacing = layer.isBlurLayer ?
        minSpacing * (1.0 + layer.blurExtension * 6.0) : // Blur layers: 1x to 1.6x (much looser)
        minSpacing * 0.8; // Regular shadow layers: looser minimum
      
      // Use the SAME gradient system as cube faces for consistent, neat hatch infill
      // This creates smooth, professional gradient shading
      shadowHatchLines = generateAdaptiveHatchLines(
        scaledShadow,
        layerHatchSpacing,
        layerMinSpacing,
        primaryAngle,
        bounds,
        (point2D) => {
          // Use the proper shadow gradient calculation (same quality as cube faces)
          return calculateShadowGradient(
            point2D,
            cubeBottomFace2D,
            scaledShadow, // Use current layer's polygon for smooth gradient
            lightAngle,
            lightElevation,
            lightBrightness,
            ambientLight,
            shadowFalloff
          );
        },
        false, // No cross-hatch in main pass
        0
      );
      
      // Add cross-hatch if enabled (using same gradient system)
      if (useNewCrossHatch || useOldCrossHatch) {
        // Shadow cross-hatch is PERPENDICULAR (90°) to primary hatch
        const crossAngle = (primaryAngle + 90) % 180;
        
        // Calculate cross-hatch spacing (wider for lighter appearance)
        const crossSpacing = layerHatchSpacing * (layer.isBlurLayer ? 1.8 : 1.5);
        const crossMinSpacing = layerMinSpacing * (layer.isBlurLayer ? 1.3 : 1.2);
        
        // Use same proper gradient calculation for cross-hatch
        const crossLines = generateAdaptiveHatchLines(
          scaledShadow,
          crossSpacing,
          crossMinSpacing,
          crossAngle,
          bounds,
          (point2D) => {
            // Same gradient system as primary hatch
            return calculateShadowGradient(
              point2D,
              cubeBottomFace2D,
              scaledShadow,
              lightAngle,
              lightElevation,
              lightBrightness,
              ambientLight,
              shadowFalloff
            );
          },
          false,
          0
        );
        
        // For new cross-hatch system, reduce density
        if (useNewCrossHatch) {
          const keepRatio = layer.isBlurLayer ? 0.3 : 0.5;
          const filteredCross = crossLines.filter((_, idx) => idx % Math.ceil(1 / keepRatio) === 0);
          shadowHatchLines.push(...filteredCross);
        } else {
          // Old cross-hatch system: keep all lines
          shadowHatchLines.push(...crossLines);
        }
      }
      
      
      // SAFETY ZONE: Create additional conservative occlusion polygon
      // This acts as an extra safety net to catch any leaks at problematic angles
      // Use slightly larger expansion than main footprint (adds 0.3% buffer)
      const SAFETY_EXPANSION = shadowExpansionFactor + 0.003; // Main expansion + 0.3% buffer
      const safetyZone = cubeFootprintBase.map(p => ({
        x: footprintCenterX + (p.x - footprintCenterX) * SAFETY_EXPANSION,
        y: footprintCenterY + (p.y - footprintCenterY) * SAFETY_EXPANSION
      }));
      
      // IMPROVED OCCLUSION: Clip against cube footprint AND all visible faces
      const occludedShadowLines = [];
      const MIN_SEGMENT_LENGTH = 0.3; // Consistent minimum length
      
      for (const line of shadowHatchLines) {
        let currentSegments = [line];
        
        // STEP 1: Clip against cube footprint (silhouette) - PRECISE for minimal gap
        const clipped = clipLineAgainstPolygonPrecise(line, cubeFootprint);
        
        if (clipped === null) {
          // Line is completely inside cube silhouette (occluded), skip it
          continue;
        } else if (Array.isArray(clipped)) {
          // Line was split into multiple segments
          currentSegments = clipped;
        } else {
          currentSegments = [clipped];
        }
        
        // STEP 1.5: Clip against safety zone (additional protection) - PRECISE
        // This catches any edge cases that slip through the main footprint
        const safetySegments = [];
        for (const segment of currentSegments) {
          const safetyClipped = clipLineAgainstPolygonPrecise(segment, safetyZone);
          
          if (safetyClipped === null) {
            // Segment inside safety zone (occluded)
            continue;
          } else if (Array.isArray(safetyClipped)) {
            safetySegments.push(...safetyClipped);
          } else {
            safetySegments.push(safetyClipped);
          }
        }
        
        currentSegments = safetySegments;
        
        // Early exit if all segments caught by safety zone
        if (currentSegments.length === 0) {
          continue;
        }
        
        // STEP 2: Clip against ALL visible cube faces
        // This prevents shadow lines from passing THROUGH the cube body
        for (let faceIdx = 0; faceIdx < faceData.length; faceIdx++) {
          const face = faceData[faceIdx];
          const newSegments = [];
          
          // Expand face for shadow occlusion - needs larger margin than face-to-face occlusion
          const faceCenterX = face.projectedFace.reduce((sum, p) => sum + p.x, 0) / face.projectedFace.length;
          const faceCenterY = face.projectedFace.reduce((sum, p) => sum + p.y, 0) / face.projectedFace.length;
          // Use configurable expansion factor from UI (default 2.5%)
          
          const expandedFace = face.projectedFace.map(p => ({
            x: faceCenterX + (p.x - faceCenterX) * shadowExpansionFactor,
            y: faceCenterY + (p.y - faceCenterY) * shadowExpansionFactor
          }));
          
          // Clip each segment against this face - PRECISE for minimal gap
          for (const segment of currentSegments) {
            const faceClipped = clipLineAgainstPolygonPrecise(segment, expandedFace);
            
            if (faceClipped === null) {
              // Segment fully occluded by this face
              continue;
            } else if (Array.isArray(faceClipped)) {
              // Segment split into multiple parts
              newSegments.push(...faceClipped);
            } else {
              // Segment clipped or unchanged
              newSegments.push(faceClipped);
            }
          }
          
          currentSegments = newSegments;
          
          // Early exit if all segments occluded
          if (currentSegments.length === 0) {
            break;
          }
        }
        
        // Add valid segments that survived all occlusion checks
        // Apply inset to pull lines away from cube boundary for extra safety
        currentSegments.forEach(segment => {
          const len = Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1);
          if (len >= MIN_SEGMENT_LENGTH && 
              !isNaN(segment.x1) && !isNaN(segment.y1) && 
              !isNaN(segment.x2) && !isNaN(segment.y2)) {
            // Apply inset to pull line endpoints inward (prevents leaks)
            const insetSegment = insetLine(segment, shadowInsetAmount);
            if (insetSegment !== null) {
              occludedShadowLines.push(insetSegment);
            }
          }
        });
      }
      
      // Store shadow lines (will be drawn FIRST, before cube)
      occludedShadowLines.forEach(line => {
        // FINAL SAFETY CHECK: Ensure line is within reasonable canvas bounds
        // This prevents any stray lines from appearing at extreme rotation angles
        const CANVAS_MARGIN = 50; // 50mm margin for safety
        const isLineInBounds = 
          line.x1 > (x0 - CANVAS_MARGIN) && line.x1 < (x1 + CANVAS_MARGIN) &&
          line.y1 > (y0 - CANVAS_MARGIN) && line.y1 < (y1 + CANVAS_MARGIN) &&
          line.x2 > (x0 - CANVAS_MARGIN) && line.x2 < (x1 + CANVAS_MARGIN) &&
          line.y2 > (y0 - CANVAS_MARGIN) && line.y2 < (y1 + CANVAS_MARGIN);
        
        if (!isLineInBounds) {
          // Line is way outside canvas - skip it
          return;
        }
        
        // Create wavy line if jitter is enabled, otherwise use straight line
        let lineEl;
        if (lineJitter > 0) {
          const wavyPoints = createWavyLine(line.x1, line.y1, line.x2, line.y2, lineJitter, jitterFrequency, jitterRandomness);
          const pointsString = wavyPoints.map(p => `${p.x},${p.y}`).join(' ');
          lineEl = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
          lineEl.setAttribute("points", pointsString);
          lineEl.setAttribute("fill", "none");
        } else {
          lineEl = document.createElementNS("http://www.w3.org/2000/svg", "line");
          lineEl.setAttribute("x1", line.x1);
          lineEl.setAttribute("y1", line.y1);
          lineEl.setAttribute("x2", line.x2);
          lineEl.setAttribute("y2", line.y2);
        }
        lineEl.setAttribute("stroke", "#000000");
        lineEl.setAttribute("stroke-width", strokeWidth); // Full stroke width
        
        // NO transparency - solid lines for maximum definition
        // Density creates the darkness gradient, not opacity
        lineEl.setAttribute("opacity", 1.0);
        lineEl.setAttribute("data-shadow-layer", `${layerIndex}`);
        
        // Store instead of appending immediately
        shadowElements.push(lineEl);
        
        totalLines++;
        const lineLength = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
        totalLength += lineLength;
        
        if (lastX !== null && lastY !== null) {
          const travelDist = Math.hypot(line.x1 - lastX, line.y1 - lastY);
          totalTravel += travelDist;
        }
        
        lastX = line.x2;
        lastY = line.y2;
      });
  });
  
    // ============================================================
    // DEBUG VISUALIZATION: Show occlusion polygons (inside shadow block)
    // ============================================================
    if (debugOcclusion) {
    // Helper function to draw a debug polygon
    const drawDebugPolygon = (polygon, color, label, strokeWidth = 1.0, opacity = 0.7) => {
      if (!polygon || polygon.length < 2) return;
      
      // Draw polygon outline
      const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      const points = polygon.map(p => `${p.x},${p.y}`).join(' ');
      polyline.setAttribute("points", points + ` ${polygon[0].x},${polygon[0].y}`);
      polyline.setAttribute("stroke", color);
      polyline.setAttribute("stroke-width", strokeWidth);
      polyline.setAttribute("stroke-opacity", opacity);
      polyline.setAttribute("fill", "none");
      polyline.setAttribute("stroke-dasharray", "3,3");
      polyline.setAttribute("data-debug", "occlusion");
      polyline.setAttribute("data-preview-only", "true");
      svg.appendChild(polyline);
      
      // Add label at polygon center
      if (label) {
        const centerX = polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length;
        const centerY = polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length;
        
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", centerX);
        text.setAttribute("y", centerY);
        text.setAttribute("fill", color);
        text.setAttribute("font-size", "10");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("data-debug", "occlusion");
        text.setAttribute("data-preview-only", "true");
        text.textContent = label;
        svg.appendChild(text);
      }
    };
    
    // Draw safety zone (largest, most conservative) - RED
    if (typeof safetyZone !== 'undefined' && safetyZone.length > 0) {
      const safetyPercent = (shadowExpansionPercent + 0.3).toFixed(2);
      drawDebugPolygon(safetyZone, "#FF0000", `Safety Zone (${safetyPercent}%)`, 3.0, 1.0);
    }
    
    // Draw cube footprint (the main occlusion polygon) - MAGENTA
    if (typeof cubeFootprint !== 'undefined' && cubeFootprint.length > 0) {
      drawDebugPolygon(cubeFootprint, "#FF00FF", `Footprint (${shadowExpansionPercent}%)`, 2.5, 1.0);
    }
    
    // Draw shadow polygon outline for reference - CYAN
    if (typeof shadowPolygon !== 'undefined' && shadowPolygon.length > 0) {
      drawDebugPolygon(shadowPolygon, "#00FFFF", "Shadow Poly", 2.0, 0.9);
    }
    
    // Draw cube bottom face for reference - YELLOW
    if (typeof cubeBottomFace2D !== 'undefined' && cubeBottomFace2D.length > 0) {
      drawDebugPolygon(cubeBottomFace2D, "#FFFF00", "Cube Bottom", 1.5, 0.8);
    }
  }
  }

  // ============================================================
  // DRAW SHADOW FIRST (proper z-order: shadow behind cube)
  // ============================================================
  shadowElements.forEach(shadowLine => {
    svg.appendChild(shadowLine);
  });

  // Check if we should use face-specific colors or single color
  const useFaceColors = document.getElementById("useFaceColors")?.checked ?? true;
  
  // Get single color for monochromatic mode
  const singleColor = document.getElementById("singleColor")?.value || "#000000";
  
  // Get face colors from controls (only if useFaceColors is enabled)
  const faceColors = useFaceColors ? {
    top: document.getElementById("faceTopColor")?.value || "#FF6B6B",
    front: document.getElementById("faceFrontColor")?.value || "#4ECDC4",
    back: document.getElementById("faceBackColor")?.value || "#45B7D1",
    left: document.getElementById("faceLeftColor")?.value || "#96CEB4",
    right: document.getElementById("faceRightColor")?.value || "#FFEAA7",
    bottom: document.getElementById("faceBottomColor")?.value || "#DDA15E"
  } : null;

  // renderMode already defined earlier (needed for LOD selection)
  
  // ============================================================
  // RENDER BASED ON MODE
  // ============================================================
  if (renderMode === "solid") {
    // SOLID GRAYSCALE MODE - Fast preview with lighting
    console.log('Rendering in SOLID mode (fast preview)');
    drawSolidFaces(svg, faceData, faceColors, strokeWidth);
    
  } else if (renderMode === "wireframe") {
    // WIREFRAME MODE - Ultra-fast edges only
    console.log('Rendering in WIREFRAME mode (ultra-fast)');
    drawWireframe(svg, faceData, strokeWidth);
    
  } else {
    // FULL MODE - High-quality line art rendering
    // Visibility is handled by Three.js GPU check - no white fills needed!
    console.log('Rendering in FULL mode (high quality with GPU visibility)');
    
    // ============================================================
    // DRAW EACH VISIBLE FACE: Hatch lines only (no white fills needed)
    // Three.js GPU visibility check already filtered to only visible faces
    // ============================================================
    faceData.forEach(faceInfo => {
      const { projectedFace, shading, face, faceHatchAngle, faceVertices3D, normalizedNormal } = faceInfo;
      const faceColor = useFaceColors ? (faceColors[face.name] || singleColor) : singleColor;
      
      // ============================================================
      // GENERATE HATCH LINES FOR THIS FACE
      // ============================================================
      let hatchLines;
      if (advancedShading) {
        hatchLines = generateAdaptiveHatchLines(
          projectedFace,
          hatchSpacing,
          minSpacing,
          faceHatchAngle,
          bounds,
          (point2D) => {
            return calculateFaceGradientShading(
              point2D,
              projectedFace,
              faceVertices3D,
              normalizedNormal,
              lightDir,
              lightBrightness,
              ambientLight,
              shadowFalloff
            );
          },
          crossHatch,
          crossHatchDensity
        );
      } else {
        hatchLines = generateHatchLines(projectedFace, shading, hatchSpacing, minSpacing, faceHatchAngle, bounds);
      }
      
      // ============================================================
      // DRAW HATCH LINES
      // ============================================================
      hatchLines.forEach(line => {
        let lineEl;
        if (lineJitter > 0) {
          const wavyPoints = createWavyLine(line.x1, line.y1, line.x2, line.y2, lineJitter, jitterFrequency, jitterRandomness);
          const pointsString = wavyPoints.map(p => `${p.x},${p.y}`).join(' ');
          lineEl = document.createElementNS(SVG_NS, "polyline");
          lineEl.setAttribute("points", pointsString);
          lineEl.setAttribute("fill", "none");
        } else {
          lineEl = document.createElementNS(SVG_NS, "line");
          lineEl.setAttribute("x1", line.x1);
          lineEl.setAttribute("y1", line.y1);
          lineEl.setAttribute("x2", line.x2);
          lineEl.setAttribute("y2", line.y2);
        }
        lineEl.setAttribute("stroke", faceColor);
        lineEl.setAttribute("stroke-width", strokeWidth);
        lineEl.setAttribute("data-face", face.name);
        svg.appendChild(lineEl);
        
        totalLines++;
        const lineLength = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
        totalLength += lineLength;
        
        if (lastX !== null && lastY !== null) {
          const travelDist = Math.hypot(line.x1 - lastX, line.y1 - lastY);
          totalTravel += travelDist;
        }
        
        lastX = line.x2;
        lastY = line.y2;
      });
      
      // ============================================================
      // DRAW FACE EDGES (if enabled)
      // ============================================================
      if (showEdges) {
        for (let i = 0; i < projectedFace.length; i++) {
          const p1 = projectedFace[i];
          const p2 = projectedFace[(i + 1) % projectedFace.length];
          
          let edge;
          if (lineJitter > 0) {
            const wavyPoints = createWavyLine(p1.x, p1.y, p2.x, p2.y, lineJitter, jitterFrequency, jitterRandomness);
            const pointsString = wavyPoints.map(p => `${p.x},${p.y}`).join(' ');
            edge = document.createElementNS(SVG_NS, "polyline");
            edge.setAttribute("points", pointsString);
            edge.setAttribute("fill", "none");
          } else {
            edge = document.createElementNS(SVG_NS, "line");
            edge.setAttribute("x1", p1.x);
            edge.setAttribute("y1", p1.y);
            edge.setAttribute("x2", p2.x);
            edge.setAttribute("y2", p2.y);
          }
          edge.setAttribute("stroke", faceColor);
          edge.setAttribute("stroke-width", strokeWidth * 1.5);
          edge.setAttribute("data-face", face.name);
          svg.appendChild(edge);
          totalLines++;
          
          const edgeLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          totalLength += edgeLength;
          
          if (lastX !== null && lastY !== null) {
            const travelDist = Math.hypot(p1.x - lastX, p1.y - lastY);
            totalTravel += travelDist;
          }
          
          lastX = p2.x;
          lastY = p2.y;
        }
      }
    });
  
  } // End of full mode rendering
  
  // ============================================================
  // DEBUG VISUALIZATION: Show face occlusion polygons
  // ============================================================
  if (debugOcclusion && renderMode === "full") {
    // Helper function to draw a debug polygon
    const drawDebugPolygon = (polygon, color, label, strokeWidth = 1.0, opacity = 0.7) => {
      if (!polygon || polygon.length < 2) return;
      
      // Draw polygon outline
      const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      const points = polygon.map(p => `${p.x},${p.y}`).join(' ');
      polyline.setAttribute("points", points + ` ${polygon[0].x},${polygon[0].y}`);
      polyline.setAttribute("stroke", color);
      polyline.setAttribute("stroke-width", strokeWidth);
      polyline.setAttribute("stroke-opacity", opacity);
      polyline.setAttribute("fill", "none");
      polyline.setAttribute("stroke-dasharray", "2,2");
      polyline.setAttribute("data-debug", "occlusion");
      polyline.setAttribute("data-preview-only", "true");
      svg.appendChild(polyline);
      
      // Add small label near first vertex
      if (label) {
        const labelX = polygon[0].x + 3;
        const labelY = polygon[0].y - 3;
        
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", labelX);
        text.setAttribute("y", labelY);
        text.setAttribute("fill", color);
        text.setAttribute("font-size", "8");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("text-anchor", "start");
        text.setAttribute("data-debug", "occlusion");
        text.setAttribute("data-preview-only", "true");
        text.textContent = label;
        svg.appendChild(text);
      }
    };
    
    // Draw each visible face's expanded occlusion polygon
    faceData.forEach((faceInfo, idx) => {
      const faceCenterX = faceInfo.projectedFace.reduce((sum, p) => sum + p.x, 0) / faceInfo.projectedFace.length;
      const faceCenterY = faceInfo.projectedFace.reduce((sum, p) => sum + p.y, 0) / faceInfo.projectedFace.length;
      // Use same configurable expansion factor as shadow occlusion
      
      const expandedFace = faceInfo.projectedFace.map(p => ({
        x: faceCenterX + (p.x - faceCenterX) * shadowExpansionFactor,
        y: faceCenterY + (p.y - faceCenterY) * shadowExpansionFactor
      }));
      
      // Color by depth range: red=large range (problematic), green=small range (good)
      // Large depth range can cause layering issues
      const rangeNormalized = Math.min(faceInfo.depthRange / 10.0, 1.0); // Normalize to 0-1
      const red = Math.round(255 * rangeNormalized);
      const green = Math.round(255 * (1 - rangeNormalized));
      const color = `rgb(${red}, ${green}, 0)`;
      
      const label = `F${idx}[${faceInfo.depthRange.toFixed(1)}]`;
      drawDebugPolygon(expandedFace, color, label, 1.0, 0.7);
    });
  }

  // Update line count
  const lineCountEl = document.getElementById("lineCount");
  if (lineCountEl) lineCountEl.textContent = totalLines;
  
  // Calculate plotting time (same as previous project)
  const DRAWING_VELOCITY = 40; // mm per second
  const TRAVEL_VELOCITY = 120; // mm per second
  const PEN_UP_TIME = 0.15; // seconds per pen up
  const PEN_DOWN_TIME = 0.15; // seconds per pen down
  const ACCELERATION_OVERHEAD = 0.1; // seconds per line
  
  const drawingTime = totalLength / DRAWING_VELOCITY;
  const travelTime = totalTravel / TRAVEL_VELOCITY;
  const penOperationsTime = totalLines * (PEN_UP_TIME + PEN_DOWN_TIME);
  const accelerationTime = totalLines * ACCELERATION_OVERHEAD;
  
  // Total time with 20% reduction for calibration
  const totalSeconds = (drawingTime + travelTime + penOperationsTime + accelerationTime) * 0.8;
  
  // Format time
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  
  let formattedTime;
  if (hours > 0) {
    formattedTime = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  const plotTimeEl = document.getElementById("plotTime");
  if (plotTimeEl) plotTimeEl.textContent = formattedTime;
}

