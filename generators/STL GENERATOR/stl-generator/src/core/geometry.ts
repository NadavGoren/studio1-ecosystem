import { Mesh, BoundingBox, Vector3, AdjacencyGraph, Edge } from './types';

/**
 * Calculate bounding box of mesh
 */
export function calculateBoundingBox(vertices: Vector3[]): BoundingBox {
  if (vertices.length === 0) {
    throw new Error('Cannot calculate bounding box: No vertices');
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const vertex of vertices) {
    minX = Math.min(minX, vertex.x);
    minY = Math.min(minY, vertex.y);
    minZ = Math.min(minZ, vertex.z);
    maxX = Math.max(maxX, vertex.x);
    maxY = Math.max(maxY, vertex.y);
    maxZ = Math.max(maxZ, vertex.z);
  }

  const min: Vector3 = { x: minX, y: minY, z: minZ };
  const max: Vector3 = { x: maxX, y: maxY, z: maxZ };
  const size: Vector3 = {
    x: maxX - minX,
    y: maxY - minY,
    z: maxZ - minZ,
  };
  const center: Vector3 = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    z: (minZ + maxZ) / 2,
  };

  return { min, max, size, center };
}

/**
 * Calculate center of mass (average of all vertices)
 */
export function calculateCenterOfMass(vertices: Vector3[]): Vector3 {
  if (vertices.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  const sum = vertices.reduce(
    (acc, v) => ({
      x: acc.x + v.x,
      y: acc.y + v.y,
      z: acc.z + v.z,
    }),
    { x: 0, y: 0, z: 0 }
  );

  return {
    x: sum.x / vertices.length,
    y: sum.y / vertices.length,
    z: sum.z / vertices.length,
  };
}

/**
 * Rotate model 90 degrees around X-axis to stand it upright
 * This rotates something laying horizontally (along Y) to standing vertically (along Z)
 */
export function rotateToStandUpright(mesh: Mesh): Mesh {
  // Rotate 90° around X-axis: Y -> Z, Z -> -Y, X stays
  // This makes something laying along Y axis stand along Z axis
  const rotatedVertices = mesh.vertices.map((v) => ({
    x: v.x,      // X stays X
    y: -v.z,     // Z becomes -Y
    z: v.y,      // Y becomes Z (up)
  }));

  // Transform face normals similarly
  const rotatedFaces = mesh.faces.map((face) => ({
    ...face,
    normal: {
      x: face.normal.x,
      y: -face.normal.z,
      z: face.normal.y,
    },
  }));

  // Update original vertices if they exist
  const rotatedOriginalVertices = mesh.originalVertices
    ? mesh.originalVertices.map((v) => ({
        x: v.x,
        y: -v.z,
        z: v.y,
      }))
    : undefined;

  return {
    ...mesh,
    vertices: rotatedVertices,
    faces: rotatedFaces,
    originalVertices: rotatedOriginalVertices || rotatedVertices.map(v => ({ ...v })),
  };
}

/**
 * Legacy function names kept for backwards compatibility
 */
export function convertYUpToZUp(mesh: Mesh): Mesh {
  return rotateToStandUpright(mesh);
}

/**
 * Legacy function kept for backwards compatibility
 * @deprecated Use convertYUpToZUp instead
 */
export function normalizeOrientation(mesh: Mesh): Mesh {
  return convertYUpToZUp(mesh);
}

/**
 * Normalize mesh to unit size, center in X-Y, and position on floor (Z=0)
 */
export function normalizeMesh(mesh: Mesh, targetSize?: number): Mesh {
  const bbox = calculateBoundingBox(mesh.vertices);
  const com = calculateCenterOfMass(mesh.vertices);

  // Calculate scale factor
  const maxSize = Math.max(bbox.size.x, bbox.size.y, bbox.size.z);
  const scale = targetSize ? targetSize / maxSize : 1.0 / maxSize;

  // Apply transformations: center in X-Y, scale, then position on floor
  const normalizedVertices = mesh.vertices.map((v) => {
    // Translate to center in X-Y only (keep Z relative to bottom)
    const centered = {
      x: v.x - com.x,
      y: v.y - com.y,
      z: v.z - bbox.min.z, // Relative to bottom, not COM
    };

    // Scale
    return {
      x: centered.x * scale,
      y: centered.y * scale,
      z: centered.z * scale, // Bottom is now at z=0
    };
  });

  // Update normals if needed (for now, keep original normals)
  const normalizedNormals = mesh.normals.length > 0 
    ? mesh.normals 
    : computeVertexNormals(normalizedVertices, mesh.faces);

  return {
    ...mesh,
    vertices: normalizedVertices,
    normals: normalizedNormals,
    boundingBox: calculateBoundingBox(normalizedVertices),
    centerOfMass: calculateCenterOfMass(normalizedVertices),
  };
}

/**
 * Compute vertex normals from faces
 */
function computeVertexNormals(vertices: Vector3[], faces: { indices: number[]; normal: Vector3 }[]): Vector3[] {
  const normals: Vector3[] = new Array(vertices.length).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));
  const counts = new Array(vertices.length).fill(0);

  for (const face of faces) {
    for (const idx of face.indices) {
      normals[idx].x += face.normal.x;
      normals[idx].y += face.normal.y;
      normals[idx].z += face.normal.z;
      counts[idx]++;
    }
  }

  // Normalize
  for (let i = 0; i < normals.length; i++) {
    if (counts[i] > 0) {
      const len = Math.sqrt(
        normals[i].x * normals[i].x +
        normals[i].y * normals[i].y +
        normals[i].z * normals[i].z
      );
      if (len > 0) {
        normals[i].x /= len;
        normals[i].y /= len;
        normals[i].z /= len;
      }
    }
  }

  return normals;
}

/**
 * Create edge key for map lookup
 */
function edgeKey(v1: number, v2: number): string {
  return v1 < v2 ? `${v1},${v2}` : `${v2},${v1}`;
}

/**
 * Build adjacency graph from mesh
 */
export function buildAdjacencyGraph(mesh: Mesh): AdjacencyGraph {
  const edges: Edge[] = [];
  const edgeToFaces = new Map<string, number[]>();
  const faceToEdges = new Map<number, Edge[]>();

  // Process each face
  for (let faceIdx = 0; faceIdx < mesh.faces.length; faceIdx++) {
    const face = mesh.faces[faceIdx];
    const faceEdges: Edge[] = [];

    // Create edges from face indices
    for (let i = 0; i < face.indices.length; i++) {
      const v1 = face.indices[i];
      const v2 = face.indices[(i + 1) % face.indices.length];
      const key = edgeKey(v1, v2);

      // Check if edge already exists
      if (!edgeToFaces.has(key)) {
        const edge: Edge = { v1, v2 };
        edges.push(edge);
        edgeToFaces.set(key, [faceIdx]);
        faceEdges.push(edge);
      } else {
        // Edge exists, add this face to adjacency
        const existingFaces = edgeToFaces.get(key)!;
        if (!existingFaces.includes(faceIdx)) {
          existingFaces.push(faceIdx);
        }
        // Find existing edge
        const existingEdge = edges.find(e => edgeKey(e.v1, e.v2) === key);
        if (existingEdge) {
          faceEdges.push(existingEdge);
        }
      }
    }

    faceToEdges.set(faceIdx, faceEdges);
  }

  // Update edge face references
  for (const edge of edges) {
    const key = edgeKey(edge.v1, edge.v2);
    const faces = edgeToFaces.get(key) || [];
    if (faces.length > 0) {
      edge.face1 = faces[0];
    }
    if (faces.length > 1) {
      edge.face2 = faces[1];
    }
  }

  return {
    edges,
    edgeToFaces,
    faceToEdges,
  };
}

/**
 * Position mesh so its bottom face sits on the floor (Z=0)
 * Finds the minimum Z value and translates all vertices so lowest point touches Z=0
 */
export function positionOnFloor(mesh: Mesh): Mesh {
  if (mesh.vertices.length === 0) {
    return mesh;
  }

  // Find minimum Z value across all vertices
  let minZ = Infinity;
  for (const vertex of mesh.vertices) {
    minZ = Math.min(minZ, vertex.z);
  }

  // If already exactly on floor, no adjustment needed
  if (Math.abs(minZ) < 1e-10) {
    return mesh;
  }

  // Translate all vertices by -minZ so bottom touches Z=0
  const offsetZ = -minZ;
  const positionedVertices = mesh.vertices.map((v) => ({
    x: v.x,
    y: v.y,
    z: v.z + offsetZ,
  }));

  // Also update originalVertices to preserve the floor position
  const positionedOriginalVertices = mesh.originalVertices
    ? mesh.originalVertices.map((v) => ({
        x: v.x,
        y: v.y,
        z: v.z + offsetZ,
      }))
    : positionedVertices.map(v => ({ ...v }));

  return {
    ...mesh,
    vertices: positionedVertices,
    originalVertices: positionedOriginalVertices,
  };
}

/**
 * Process mesh: calculate bbox, COM, and build adjacency
 */
export function processMesh(mesh: Mesh): Mesh {
  const bbox = calculateBoundingBox(mesh.vertices);
  const com = calculateCenterOfMass(mesh.vertices);
  const adjacency = buildAdjacencyGraph(mesh);

  return {
    ...mesh,
    boundingBox: bbox,
    centerOfMass: com,
    adjacency,
  };
}




