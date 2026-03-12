import { Mesh, Edge, Vector3, RenderingMode, EdgeExtractionResult } from '../core/types';
import { computeVisibleFaces } from './visibility';
import {
  extractSilhouetteEdges,
  extractBoundaryEdges,
  extractSharpEdges,
  extractAllVisibleEdges,
  deduplicateEdges,
  filterCoplanarEdges,
} from './silhouette';

/**
 * Extract edges from mesh based on rendering mode
 * 
 * @param mesh - The mesh with adjacency information
 * @param cameraPosition - Camera position for visibility calculation
 * @param mode - Rendering mode (contour-only, contour-sharp, wireframe)
 * @param sharpAngleThreshold - Minimum angle for sharp edges (default: 30°)
 * @returns Edge extraction result with categorized edges
 */
export function extractEdges(
  mesh: Mesh,
  cameraPosition: Vector3,
  mode: RenderingMode,
  sharpAngleThreshold: number = 30
): EdgeExtractionResult {
  // Compute visible faces
  const visibleFaceIndices = computeVisibleFaces(mesh, cameraPosition);
  const visibleFacesSet = new Set(visibleFaceIndices);

  // Extract different types of edges
  const silhouetteEdges = extractSilhouetteEdges(mesh, visibleFacesSet);
  const boundaryEdges = extractBoundaryEdges(mesh);
  
  // Combine silhouette and boundary edges for contour
  const contourEdges = deduplicateEdges([...silhouetteEdges, ...boundaryEdges]);

  let resultEdges: Edge[] = [];

  switch (mode) {
    case 'contour-only':
      // Only silhouette/boundary edges
      resultEdges = contourEdges;
      break;

    case 'contour-sharp':
      // Silhouette + sharp edges
      const sharpEdges = extractSharpEdges(mesh, visibleFacesSet, sharpAngleThreshold);
      resultEdges = deduplicateEdges([...contourEdges, ...sharpEdges]);
      break;

    case 'wireframe':
      // All visible edges, but filter out coplanar edges (internal edges on flat surfaces)
      // Based on Plotter Vision's coplanar triangle elimination technique
      // @see https://trmm.net/Plotter-Vision/
      // Use very small threshold (0.5°) to only remove truly coplanar edges
      // This preserves edges on curved surfaces while removing flat surface internals
      const allEdges = extractAllVisibleEdges(mesh, visibleFacesSet);
      resultEdges = filterCoplanarEdges(mesh, allEdges, visibleFacesSet, 0.5);
      break;

    default:
      resultEdges = contourEdges;
  }

  return {
    silhouetteEdges,
    sharpEdges: mode === 'contour-sharp' ? extractSharpEdges(mesh, visibleFacesSet, sharpAngleThreshold) : [],
    allEdges: resultEdges,
    visibleFaces: visibleFaceIndices,
  };
}

/**
 * Convert edges to line segments (3D coordinates)
 */
export interface LineSegment3D {
  start: Vector3;
  end: Vector3;
  type: 'silhouette' | 'sharp' | 'internal';
  isHidden?: boolean; // True if edge is on a back-facing face
  faceIndices?: number[]; // Face indices this edge belongs to (for self-occlusion prevention)
}

export function edgesToLineSegments(
  mesh: Mesh,
  edges: Edge[],
  type: 'silhouette' | 'sharp' | 'internal' = 'internal',
  visibleFaces?: Set<number>
): LineSegment3D[] {
  return edges.map((edge) => {
    // Determine if edge is hidden (both adjacent faces are back-facing)
    let isHidden = false;
    const faceIndices: number[] = [];
    
    if (visibleFaces && (edge.face1 !== undefined || edge.face2 !== undefined)) {
      const face1Visible = edge.face1 !== undefined ? visibleFaces.has(edge.face1) : false;
      const face2Visible = edge.face2 !== undefined ? visibleFaces.has(edge.face2) : false;
      // Edge is hidden if neither face is visible
      isHidden = !face1Visible && !face2Visible;
    }
    
    // Collect face indices for self-occlusion prevention
    if (edge.face1 !== undefined) {
      faceIndices.push(edge.face1);
    }
    if (edge.face2 !== undefined) {
      faceIndices.push(edge.face2);
    }
    
    return {
      start: mesh.vertices[edge.v1],
      end: mesh.vertices[edge.v2],
      type,
      isHidden,
      faceIndices: faceIndices.length > 0 ? faceIndices : undefined,
    };
  });
}

/**
 * Filter out very short edges (degenerate edges)
 */
export function filterShortEdges(
  segments: LineSegment3D[],
  minLength: number = 0.001
): LineSegment3D[] {
  return segments.filter((seg) => {
    const dx = seg.end.x - seg.start.x;
    const dy = seg.end.y - seg.start.y;
    const dz = seg.end.z - seg.start.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return length >= minLength;
  });
}
