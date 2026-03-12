import { Vector3, Face, Mesh } from '../core/types';

/**
 * Normalize a vector
 */
export function normalize(v: Vector3): Vector3 {
  const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (length < 1e-10) return { x: 0, y: 0, z: 0 };
  return {
    x: v.x / length,
    y: v.y / length,
    z: v.z / length,
  };
}

/**
 * Calculate dot product between two vectors
 */
export function dot(v1: Vector3, v2: Vector3): number {
  return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
}

/**
 * Check if a face is visible from the camera viewpoint
 * 
 * @param faceNormal - The face normal vector
 * @param viewDirection - The direction from face to camera (camera - faceCenter)
 * @param threshold - Visibility threshold (default: 0.01, smaller = more strict)
 * @returns true if face is visible (facing camera)
 */
export function isFaceVisible(
  faceNormal: Vector3,
  viewDirection: Vector3,
  threshold: number = 0.01
): boolean {
  // Normalize both vectors
  const normalizedNormal = normalize(faceNormal);
  const normalizedView = normalize(viewDirection);

  // Calculate dot product
  // If dot product is negative, face normal points towards camera (visible)
  // If positive, face normal points away from camera (hidden)
  const dotProduct = dot(normalizedNormal, normalizedView);

  return dotProduct < -threshold;
}

/**
 * Calculate the center point of a face
 */
export function getFaceCenter(mesh: Mesh, face: Face): Vector3 {
  const vertices = face.indices.map((idx) => mesh.vertices[idx]);
  
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
 * Compute visible faces based on camera position
 * 
 * @param mesh - The mesh to process
 * @param cameraPosition - Camera position in world space
 * @returns Array of visible face indices
 */
export function computeVisibleFaces(
  mesh: Mesh,
  cameraPosition: Vector3
): number[] {
  const visibleFaces: number[] = [];

  for (let i = 0; i < mesh.faces.length; i++) {
    const face = mesh.faces[i];
    const faceCenter = getFaceCenter(mesh, face);

    // View direction: from face center to camera
    const viewDirection: Vector3 = {
      x: cameraPosition.x - faceCenter.x,
      y: cameraPosition.y - faceCenter.y,
      z: cameraPosition.z - faceCenter.z,
    };

    if (isFaceVisible(face.normal, viewDirection)) {
      visibleFaces.push(i);
    }
  }

  return visibleFaces;
}

/**
 * Calculate depth (distance from camera) for a face
 * Used for depth sorting
 */
export function calculateFaceDepth(
  mesh: Mesh,
  faceIndex: number,
  cameraPosition: Vector3
): number {
  const face = mesh.faces[faceIndex];
  const faceCenter = getFaceCenter(mesh, face);

  // Calculate distance from camera to face center
  const dx = faceCenter.x - cameraPosition.x;
  const dy = faceCenter.y - cameraPosition.y;
  const dz = faceCenter.z - cameraPosition.z;

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Sort faces by depth (back to front)
 * @returns Sorted array of face indices (farthest first)
 */
export function sortFacesByDepth(
  mesh: Mesh,
  faceIndices: number[],
  cameraPosition: Vector3
): number[] {
  return [...faceIndices].sort((a, b) => {
    const depthA = calculateFaceDepth(mesh, a, cameraPosition);
    const depthB = calculateFaceDepth(mesh, b, cameraPosition);
    return depthB - depthA; // Sort descending (farthest first)
  });
}
