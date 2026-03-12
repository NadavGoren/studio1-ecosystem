import { Vector3, Vector2 } from './types';
import { ViewRotation } from '../ui/store/svgViewportSlice';

export type ViewMode = 'isometric' | 'perspective';

/**
 * Projected point in screen space (2D + Z depth)
 */
export interface ProjectedPoint {
  x: number;
  y: number;
  z: number; // Depth from camera (larger = further away)
}

/**
 * Transform a 3D point from world space to camera space using spherical orbit
 * This implements CAD-style constrained orbit where Z is always up
 */
function rotatePointByView(point: Vector3, rotation: ViewRotation): Vector3 {
  const azRad = (rotation.azimuth * Math.PI) / 180;
  const elRad = (rotation.elevation * Math.PI) / 180;

  // Calculate camera position on a sphere (Z-up coordinate system)
  // Elevation: 0° = top view (looking down Z-axis), 90° = side view (horizon), 180° = bottom view
  const cosEl = Math.cos(elRad);
  const sinEl = Math.sin(elRad);
  const cosAz = Math.cos(azRad);
  const sinAz = Math.sin(azRad);

  // Camera position on unit sphere (will be scaled based on distance)
  // For Z-up: elevation measures angle from +Z axis (top) down through XY plane to -Z axis (bottom)
  const camX = sinEl * cosAz;
  const camY = sinEl * sinAz;
  const camZ = cosEl;

  // Build camera coordinate system (view matrix components)
  // Camera looks at origin (0,0,0) with Z-up as the up vector
  
  // Forward vector (from camera to origin, normalized)
  const fwdX = -camX;
  const fwdY = -camY;
  const fwdZ = -camZ;
  
  // Up vector in world space (always Z-up)
  const upX = 0;
  const upY = 0;
  const upZ = 1;
  
  // Right vector = forward × up (cross product)
  const rightX = fwdY * upZ - fwdZ * upY;
  const rightY = fwdZ * upX - fwdX * upZ;
  const rightZ = fwdX * upY - fwdY * upX;
  
  // Normalize right vector
  const rightLen = Math.sqrt(rightX * rightX + rightY * rightY + rightZ * rightZ);
  const normRightX = rightLen > 0 ? rightX / rightLen : 1;
  const normRightY = rightLen > 0 ? rightY / rightLen : 0;
  const normRightZ = rightLen > 0 ? rightZ / rightLen : 0;
  
  // Recalculate up vector = right × forward (to ensure orthogonality)
  const camUpX = normRightY * fwdZ - normRightZ * fwdY;
  const camUpY = normRightZ * fwdX - normRightX * fwdZ;
  const camUpZ = normRightX * fwdY - normRightY * fwdX;
  
  // Normalize camera up vector
  const camUpLen = Math.sqrt(camUpX * camUpX + camUpY * camUpY + camUpZ * camUpZ);
  const normUpX = camUpLen > 0 ? camUpX / camUpLen : 0;
  const normUpY = camUpLen > 0 ? camUpY / camUpLen : 0;
  const normUpZ = camUpLen > 0 ? camUpZ / camUpLen : 1;
  
  // Transform point from world space to camera space
  // This is equivalent to applying the inverse view matrix
  const x = point.x * normRightX + point.y * normRightY + point.z * normRightZ;
  const y = point.x * normUpX + point.y * normUpY + point.z * normUpZ;
  const z = point.x * fwdX + point.y * fwdY + point.z * fwdZ;

  return { x, y, z };
}

/**
 * Project 3D point to 2D using isometric projection
 */
export function projectIsometric(point: Vector3, viewRotation?: ViewRotation): Vector2 {
  // Apply view rotation if provided (transforms to camera space)
  const cameraPoint = viewRotation ? rotatePointByView(point, viewRotation) : point;

  // In camera space after the view transform:
  // - x is the right direction (screen horizontal)
  // - y is the up direction (screen vertical)
  // - z is the depth (forward from camera, used for depth sorting)
  
  // For orthographic/isometric projection from camera space, we simply take x and y
  // Negate y because screen coordinates have y-down, but we want y-up in 3D
  return { x: cameraPoint.x, y: -cameraPoint.y };
}

/**
 * Project 3D point to screen space (2D + Z depth) using isometric projection
 */
export function projectIsometricToScreenSpace(point: Vector3, viewRotation?: ViewRotation): ProjectedPoint {
  const cameraPoint = viewRotation ? rotatePointByView(point, viewRotation) : point;
  return { 
    x: cameraPoint.x, 
    y: -cameraPoint.y,
    z: cameraPoint.z // Z depth (larger = further from camera)
  };
}

/**
 * Project 3D point to 2D using perspective projection
 */
export function projectPerspective(
  point: Vector3,
  cameraDistance: number = 100,
  fov: number = 45,
  viewRotation?: ViewRotation
): Vector2 {
  // Apply view rotation if provided (transforms to camera space)
  const cameraPoint = viewRotation ? rotatePointByView(point, viewRotation) : point;

  // In camera space:
  // - x is right
  // - y is up
  // - z is depth (distance from camera)
  
  // Apply perspective division
  // Objects further away (larger z) appear smaller
  const depth = cameraDistance + cameraPoint.z;
  const scale = depth > 0 ? fov / depth : 1;

  return {
    x: cameraPoint.x * scale,
    y: -cameraPoint.y * scale, // Negate for SVG coordinate system (y-down)
  };
}

/**
 * Project 3D point to screen space (2D + Z depth) using perspective projection
 */
export function projectPerspectiveToScreenSpace(
  point: Vector3,
  cameraDistance: number = 100,
  fov: number = 45,
  viewRotation?: ViewRotation
): ProjectedPoint {
  const cameraPoint = viewRotation ? rotatePointByView(point, viewRotation) : point;
  const depth = cameraDistance + cameraPoint.z;
  const scale = depth > 0 ? fov / depth : 1;

  return {
    x: cameraPoint.x * scale,
    y: -cameraPoint.y * scale,
    z: cameraPoint.z // Z depth (larger = further from camera)
  };
}

/**
 * Project 3D point to 2D based on view mode
 */
export function project3DTo2D(
  point: Vector3,
  viewMode: ViewMode = 'isometric',
  perspectiveStrength: number = 1.0,
  cameraDistance: number = 100,
  fov: number = 45,
  viewRotation?: ViewRotation
): Vector2 {
  if (viewMode === 'isometric') {
    return projectIsometric(point, viewRotation);
  } else {
    // Perspective mode
    const iso = projectIsometric(point, viewRotation);
    const persp = projectPerspective(point, cameraDistance, fov, viewRotation);

    // Blend between isometric and perspective based on strength
    const blend = Math.min(1, Math.max(0, perspectiveStrength));
    return {
      x: iso.x * (1 - blend) + persp.x * blend,
      y: iso.y * (1 - blend) + persp.y * blend,
    };
  }
}

/**
 * Project array of 3D points to 2D
 */
export function projectPoints3DTo2D(
  points: Vector3[],
  viewMode: ViewMode = 'isometric',
  perspectiveStrength: number = 1.0,
  cameraDistance: number = 100,
  fov: number = 45,
  viewRotation?: ViewRotation
): Vector2[] {
  return points.map((point) =>
    project3DTo2D(point, viewMode, perspectiveStrength, cameraDistance, fov, viewRotation)
  );
}

/**
 * Project 3D point to screen space (2D + Z depth) based on view mode
 */
export function project3DToScreenSpace(
  point: Vector3,
  viewMode: ViewMode = 'isometric',
  perspectiveStrength: number = 1.0,
  cameraDistance: number = 100,
  fov: number = 45,
  viewRotation?: ViewRotation
): ProjectedPoint {
  if (viewMode === 'isometric') {
    return projectIsometricToScreenSpace(point, viewRotation);
  } else {
    // Perspective mode - blend between isometric and perspective
    const iso = projectIsometricToScreenSpace(point, viewRotation);
    const persp = projectPerspectiveToScreenSpace(point, cameraDistance, fov, viewRotation);

    // Blend between isometric and perspective based on strength
    const blend = Math.min(1, Math.max(0, perspectiveStrength));
    return {
      x: iso.x * (1 - blend) + persp.x * blend,
      y: iso.y * (1 - blend) + persp.y * blend,
      z: iso.z * (1 - blend) + persp.z * blend, // Blend Z depth as well
    };
  }
}

/**
 * Project array of 3D points to screen space (2D + Z depth)
 */
export function projectPoints3DToScreenSpace(
  points: Vector3[],
  viewMode: ViewMode = 'isometric',
  perspectiveStrength: number = 1.0,
  cameraDistance: number = 100,
  fov: number = 45,
  viewRotation?: ViewRotation
): ProjectedPoint[] {
  return points.map((point) =>
    project3DToScreenSpace(point, viewMode, perspectiveStrength, cameraDistance, fov, viewRotation)
  );
}


