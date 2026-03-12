import { Mesh, Vector3, TransformState, CoordinateSystem } from './types';
import { calculateCenterOfMass } from './geometry';

/**
 * 4x4 matrix type
 */
type Matrix4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number
];

/**
 * Create identity matrix
 */
function identityMatrix(): Matrix4 {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

/**
 * Create translation matrix
 */
function translationMatrix(tx: number, ty: number, tz: number): Matrix4 {
  return [
    1, 0, 0, tx,
    0, 1, 0, ty,
    0, 0, 1, tz,
    0, 0, 0, 1,
  ];
}

/**
 * Create rotation matrix around X axis
 */
function rotationXMatrix(angleDeg: number): Matrix4 {
  const angle = (angleDeg * Math.PI) / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    1, 0, 0, 0,
    0, c, -s, 0,
    0, s, c, 0,
    0, 0, 0, 1,
  ];
}

/**
 * Create rotation matrix around Y axis
 */
function rotationYMatrix(angleDeg: number): Matrix4 {
  const angle = (angleDeg * Math.PI) / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    c, 0, s, 0,
    0, 1, 0, 0,
    -s, 0, c, 0,
    0, 0, 0, 1,
  ];
}

/**
 * Create rotation matrix around Z axis
 */
function rotationZMatrix(angleDeg: number): Matrix4 {
  const angle = (angleDeg * Math.PI) / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    c, -s, 0, 0,
    s, c, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

/**
 * Create scale/flip matrix
 */
function scaleMatrix(sx: number, sy: number, sz: number): Matrix4 {
  return [
    sx, 0, 0, 0,
    0, sy, 0, 0,
    0, 0, sz, 0,
    0, 0, 0, 1,
  ];
}

/**
 * Multiply two 4x4 matrices
 */
function multiplyMatrices(a: Matrix4, b: Matrix4): Matrix4 {
  const result: Matrix4 = [
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
  ];

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 4; k++) {
        result[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
      }
    }
  }

  return result;
}

/**
 * Apply matrix to 3D point
 */
function applyMatrixToPoint(matrix: Matrix4, point: Vector3): Vector3 {
  const x = point.x * matrix[0] + point.y * matrix[1] + point.z * matrix[2] + matrix[3];
  const y = point.x * matrix[4] + point.y * matrix[5] + point.z * matrix[6] + matrix[7];
  const z = point.x * matrix[8] + point.y * matrix[9] + point.z * matrix[10] + matrix[11];
  return { x, y, z };
}

/**
 * Apply matrix to normal vector (no translation)
 */
function applyMatrixToNormal(matrix: Matrix4, normal: Vector3): Vector3 {
  const x = normal.x * matrix[0] + normal.y * matrix[1] + normal.z * matrix[2];
  const y = normal.x * matrix[4] + normal.y * matrix[5] + normal.z * matrix[6];
  const z = normal.x * matrix[8] + normal.y * matrix[9] + normal.z * matrix[10];
  
  // Normalize
  const len = Math.sqrt(x * x + y * y + z * z);
  if (len > 0) {
    return { x: x / len, y: y / len, z: z / len };
  }
  return { x, y, z };
}

/**
 * Build transformation matrix from transform state
 */
export function buildTransformMatrix(transform: TransformState): Matrix4 {
  let matrix = identityMatrix();

  // Apply coordinate system orientation first (base rotation)
  const coordRotation = getCoordinateSystemRotation(transform.coordinateSystem);
  if (coordRotation.x !== 0) {
    matrix = multiplyMatrices(matrix, rotationXMatrix(coordRotation.x));
  }
  if (coordRotation.y !== 0) {
    matrix = multiplyMatrices(matrix, rotationYMatrix(coordRotation.y));
  }
  if (coordRotation.z !== 0) {
    matrix = multiplyMatrices(matrix, rotationZMatrix(coordRotation.z));
  }

  // Apply flips (before user rotation)
  if (transform.flipX || transform.flipY || transform.flipZ) {
    const scale = scaleMatrix(
      transform.flipX ? -1 : 1,
      transform.flipY ? -1 : 1,
      transform.flipZ ? -1 : 1
    );
    matrix = multiplyMatrices(matrix, scale);
  }

  // Apply user rotations (Euler angles: X, Y, Z)
  if (transform.rotation.x !== 0) {
    matrix = multiplyMatrices(matrix, rotationXMatrix(transform.rotation.x));
  }
  if (transform.rotation.y !== 0) {
    matrix = multiplyMatrices(matrix, rotationYMatrix(transform.rotation.y));
  }
  if (transform.rotation.z !== 0) {
    matrix = multiplyMatrices(matrix, rotationZMatrix(transform.rotation.z));
  }

  // Apply translation last
  if (transform.translation.x !== 0 || transform.translation.y !== 0 || transform.translation.z !== 0) {
    const translation = translationMatrix(
      transform.translation.x,
      transform.translation.y,
      transform.translation.z
    );
    matrix = multiplyMatrices(matrix, translation);
  }

  return matrix;
}

/**
 * Apply transformations to mesh while maintaining COM alignment
 */
export function applyTransforms(mesh: Mesh, transform: TransformState): Mesh {
  if (!mesh.originalVertices) {
    // Store original if not already stored
    mesh.originalVertices = mesh.vertices.map(v => ({ ...v }));
  }

  const matrix = buildTransformMatrix(transform);

  // Get current COM
  const com = mesh.centerOfMass || calculateCenterOfMass(mesh.originalVertices);

  // Transform vertices relative to COM, then translate back
  const transformedVertices = mesh.originalVertices.map((v) => {
    // Translate to origin (relative to COM)
    const relative = {
      x: v.x - com.x,
      y: v.y - com.y,
      z: v.z - com.z,
    };

    // Apply transformation
    const transformed = applyMatrixToPoint(matrix, relative);

    // Translate back to COM position
    return {
      x: transformed.x + com.x,
      y: transformed.y + com.y,
      z: transformed.z + com.z,
    };
  });

  // Transform normals (no translation for normals)
  const transformedNormals = mesh.faces.map((face) => {
    return applyMatrixToNormal(matrix, face.normal);
  });

  // Update faces with transformed normals
  const transformedFaces = mesh.faces.map((face, idx) => ({
    ...face,
    normal: transformedNormals[idx],
  }));

  // After applying transforms, ensure model sits on floor (Z=0)
  // Find minimum Z value and adjust all vertices
  let minZ = Infinity;
  for (const vertex of transformedVertices) {
    minZ = Math.min(minZ, vertex.z);
  }

  // Apply floor correction if needed
  const floorCorrectionZ = Math.abs(minZ) > 1e-10 ? -minZ : 0;
  
  const finalVertices = floorCorrectionZ !== 0
    ? transformedVertices.map((v) => ({
        x: v.x,
        y: v.y,
        z: v.z + floorCorrectionZ,
      }))
    : transformedVertices;

  // Recalculate center of mass after floor correction
  const newCenterOfMass = calculateCenterOfMass(finalVertices);

  return {
    ...mesh,
    vertices: finalVertices,
    faces: transformedFaces,
    centerOfMass: newCenterOfMass,
  };
}

/**
 * Reset mesh to original state
 */
export function resetMesh(mesh: Mesh): Mesh {
  if (!mesh.originalVertices) {
    return mesh;
  }

  return {
    ...mesh,
    vertices: mesh.originalVertices.map(v => ({ ...v })),
  };
}

/**
 * Calculate rotation to orient a principal face downward
 * Faces are: +X, -X, +Y, -Y, +Z, -Z
 * For Z-up coordinate system: align face with negative Z (down)
 */
export function calculateFaceOrientation(face: '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z'): Vector3 {
  // Rotation angles in degrees to align face with -Z (down) for Z-up coordinate system
  switch (face) {
    case '+X':
      // Rotate +X to -Z: rotate -90° around Y axis
      return { x: 0, y: -90, z: 0 };
    case '-X':
      // Rotate -X to -Z: rotate 90° around Y axis
      return { x: 0, y: 90, z: 0 };
    case '+Y':
      // Rotate +Y to -Z: rotate 90° around X axis
      return { x: 90, y: 0, z: 0 };
    case '-Y':
      // Rotate -Y to -Z: rotate -90° around X axis
      return { x: -90, y: 0, z: 0 };
    case '+Z':
      // +Z is already up, so rotate 180° around X to make it down
      return { x: 180, y: 0, z: 0 };
    case '-Z':
      // -Z is already down, no rotation needed
      return { x: 0, y: 0, z: 0 };
    default:
      return { x: 0, y: 0, z: 0 };
  }
}

/**
 * Get base rotation for coordinate system orientation
 * This applies a base transformation to convert between coordinate systems
 */
export function getCoordinateSystemRotation(system: CoordinateSystem = 'Z-up'): Vector3 {
  switch (system) {
    case 'Z-up':
      // Z is vertical, X-Y is horizontal (flow plane) - no rotation needed
      return { x: 0, y: 0, z: 0 };
    case 'Y-up':
      // Convert Y-up to Z-up: rotate -90° around X axis
      return { x: -90, y: 0, z: 0 };
    case 'X-up':
      // Convert X-up to Z-up: rotate 90° around Y axis
      return { x: 0, y: 90, z: 0 };
    default:
      return { x: 0, y: 0, z: 0 };
  }
}




