import { Mesh, Edge, Vector3 } from '../core/types';

/**
 * Edge key for consistent edge identification
 */
function edgeKey(v1: number, v2: number): string {
  return v1 < v2 ? `${v1},${v2}` : `${v2},${v1}`;
}

/**
 * Extract silhouette edges from mesh based on visible faces
 * 
 * Silhouette edges are edges where one adjacent face is visible and the other is hidden
 * 
 * @param mesh - The mesh with adjacency information
 * @param visibleFaces - Set of visible face indices
 * @returns Array of silhouette edges
 */
export function extractSilhouetteEdges(
  mesh: Mesh,
  visibleFaces: Set<number>
): Edge[] {
  if (!mesh.adjacency) {
    throw new Error('Mesh must have adjacency information to extract silhouette edges');
  }

  const silhouetteEdges: Edge[] = [];

  // Check each edge in the adjacency graph
  for (const edge of mesh.adjacency.edges) {
    const face1Visible = edge.face1 !== undefined && visibleFaces.has(edge.face1);
    const face2Visible = edge.face2 !== undefined && visibleFaces.has(edge.face2);

    // Silhouette edge: exactly one adjacent face is visible
    if (face1Visible !== face2Visible) {
      silhouetteEdges.push(edge);
    }
  }

  return silhouetteEdges;
}

/**
 * Extract boundary edges (edges with only one adjacent face)
 * These are always part of the silhouette for open meshes
 */
export function extractBoundaryEdges(mesh: Mesh): Edge[] {
  if (!mesh.adjacency) {
    throw new Error('Mesh must have adjacency information');
  }

  const boundaryEdges: Edge[] = [];

  for (const edge of mesh.adjacency.edges) {
    // Boundary edge: only one adjacent face
    if (edge.face2 === undefined) {
      boundaryEdges.push(edge);
    }
  }

  return boundaryEdges;
}

/**
 * Calculate the angle between two face normals (in degrees)
 */
export function calculateDihedralAngle(
  mesh: Mesh,
  face1Index: number,
  face2Index: number
): number {
  const face1 = mesh.faces[face1Index];
  const face2 = mesh.faces[face2Index];

  const n1 = face1.normal;
  const n2 = face2.normal;

  // Normalize normals
  const len1 = Math.sqrt(n1.x * n1.x + n1.y * n1.y + n1.z * n1.z);
  const len2 = Math.sqrt(n2.x * n2.x + n2.y * n2.y + n2.z * n2.z);

  if (len1 < 1e-10 || len2 < 1e-10) return 0;

  const norm1: Vector3 = { x: n1.x / len1, y: n1.y / len1, z: n1.z / len1 };
  const norm2: Vector3 = { x: n2.x / len2, y: n2.y / len2, z: n2.z / len2 };

  // Dot product
  const dot = norm1.x * norm2.x + norm1.y * norm2.y + norm1.z * norm2.z;

  // Clamp to avoid numerical errors
  const clampedDot = Math.max(-1, Math.min(1, dot));

  // Angle in degrees
  return (Math.acos(clampedDot) * 180) / Math.PI;
}

/**
 * Check if two faces are coplanar (on the same plane)
 * Based on Plotter Vision's coplanar triangle elimination technique
 * @see https://trmm.net/Plotter-Vision/
 */
export function areFacesCoplanar(
  mesh: Mesh,
  face1Index: number,
  face2Index: number,
  angleThreshold: number = 1.0 // Faces are coplanar if angle < 1 degree
): boolean {
  const angle = calculateDihedralAngle(mesh, face1Index, face2Index);
  return angle < angleThreshold;
}

/**
 * Extract sharp edges (edges with large dihedral angle between adjacent faces)
 * 
 * @param mesh - The mesh with adjacency information
 * @param visibleFaces - Set of visible face indices
 * @param angleThreshold - Minimum angle in degrees to be considered "sharp" (default: 30°)
 * @returns Array of sharp edges (both faces must be visible)
 */
export function extractSharpEdges(
  mesh: Mesh,
  visibleFaces: Set<number>,
  angleThreshold: number = 30
): Edge[] {
  if (!mesh.adjacency) {
    throw new Error('Mesh must have adjacency information');
  }

  const sharpEdges: Edge[] = [];

  for (const edge of mesh.adjacency.edges) {
    // Both adjacent faces must exist and be visible
    if (
      edge.face1 !== undefined &&
      edge.face2 !== undefined &&
      visibleFaces.has(edge.face1) &&
      visibleFaces.has(edge.face2)
    ) {
      const angle = calculateDihedralAngle(mesh, edge.face1, edge.face2);

      // Sharp edge if angle exceeds threshold
      if (angle >= angleThreshold) {
        sharpEdges.push(edge);
      }
    }
  }

  return sharpEdges;
}

/**
 * Filter out coplanar edges - edges between two coplanar visible faces
 * These are internal edges that shouldn't be drawn
 * Based on Plotter Vision's coplanar triangle elimination
 * @see https://trmm.net/Plotter-Vision/
 */
export function filterCoplanarEdges(
  mesh: Mesh,
  edges: Edge[],
  visibleFaces: Set<number>,
  coplanarThreshold: number = 2.0 // degrees
): Edge[] {
  if (!mesh.adjacency) {
    return edges;
  }

  return edges.filter(edge => {
    // Keep boundary edges (only one adjacent face)
    if (edge.face2 === undefined) {
      return true;
    }

    // Keep silhouette edges (one visible, one hidden)
    const face1Visible = edge.face1 !== undefined && visibleFaces.has(edge.face1);
    const face2Visible = edge.face2 !== undefined && visibleFaces.has(edge.face2);
    
    if (face1Visible !== face2Visible) {
      return true; // Silhouette edge, always keep
    }

    // For edges where both faces are visible, filter out coplanar edges
    if (face1Visible && face2Visible && edge.face1 !== undefined) {
      const angle = calculateDihedralAngle(mesh, edge.face1, edge.face2);
      // Remove edge if faces are nearly coplanar (flat surface)
      if (angle < coplanarThreshold) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Extract all edges between visible faces
 * Used for wireframe mode
 */
export function extractAllVisibleEdges(
  mesh: Mesh,
  visibleFaces: Set<number>
): Edge[] {
  if (!mesh.adjacency) {
    throw new Error('Mesh must have adjacency information');
  }

  const visibleEdges: Edge[] = [];

  for (const edge of mesh.adjacency.edges) {
    // Include edge if at least one adjacent face is visible
    const face1Visible = edge.face1 !== undefined && visibleFaces.has(edge.face1);
    const face2Visible = edge.face2 !== undefined && visibleFaces.has(edge.face2);

    if (face1Visible || face2Visible) {
      visibleEdges.push(edge);
    }
  }

  return visibleEdges;
}

/**
 * Deduplicate edges (remove duplicates based on vertex indices)
 */
export function deduplicateEdges(edges: Edge[]): Edge[] {
  const edgeSet = new Set<string>();
  const uniqueEdges: Edge[] = [];

  for (const edge of edges) {
    const key = edgeKey(edge.v1, edge.v2);
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      uniqueEdges.push(edge);
    }
  }

  return uniqueEdges;
}
