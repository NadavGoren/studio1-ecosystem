import { Vector3, LightingState } from '../core/types';
import { normalize, dot } from './visibility';

/**
 * Calculate light direction vector from azimuth and elevation
 * 
 * @param azimuth - Rotation around Z-axis (0-360°)
 * @param elevation - Angle from horizontal (0-90°)
 * @returns Normalized light direction vector
 */
export function calculateLightDirection(azimuth: number, elevation: number): Vector3 {
  const azimuthRad = (azimuth * Math.PI) / 180;
  const elevationRad = (elevation * Math.PI) / 180;

  // Light direction components
  return {
    x: Math.cos(elevationRad) * Math.cos(azimuthRad),
    y: Math.cos(elevationRad) * Math.sin(azimuthRad),
    z: -Math.sin(elevationRad), // Negative because light points downward
  };
}

/**
 * Calculate basic shading for a face based on lighting
 * 
 * @param faceNormal - The face normal vector
 * @param lightDir - The light direction vector
 * @param intensity - Light intensity (0-2.0)
 * @param contrast - Contrast adjustment (0-1.0)
 * @returns Shading value (0 = dark, 1 = bright)
 */
export function calculateShading(
  faceNormal: Vector3,
  lightDir: Vector3,
  intensity: number = 1.0,
  contrast: number = 0.5
): number {
  // Normalize vectors
  const normalizedNormal = normalize(faceNormal);
  // Light direction should point FROM light source, so we negate it
  const normalizedLight = normalize({ x: -lightDir.x, y: -lightDir.y, z: -lightDir.z });

  // Calculate dot product (cosine of angle between normal and light)
  const dotProduct = dot(normalizedNormal, normalizedLight);

  // Clamp to [0, 1]
  const clampedDot = Math.max(0, dotProduct);

  // Apply intensity
  const diffuse = clampedDot * Math.max(0, intensity);

  // Apply contrast (ambient light component)
  const ambient = 1 - contrast;
  const shading = Math.min(1, Math.max(0, ambient + (1 - ambient) * diffuse));

  return shading;
}

/**
 * Calculate shading with lighting state
 */
export function calculateShadingWithState(
  faceNormal: Vector3,
  lighting: LightingState
): number {
  const lightDir = calculateLightDirection(lighting.azimuth, lighting.elevation);
  return calculateShading(faceNormal, lightDir, lighting.intensity, lighting.contrast);
}

/**
 * Calculate gradient shading across a face using key-point interpolation
 * 
 * @param point2D - The 2D point to calculate shading for
 * @param vertices2D - All 2D vertices of the face
 * @param vertices3D - All 3D vertices of the face
 * @param faceNormal - The face normal
 * @param lightDir - The light direction
 * @param intensity - Light intensity
 * @param contrast - Contrast/ambient light
 * @param falloff - Falloff strength for smooth gradients (default: 2.0)
 * @returns Shading value at the point
 */
export function calculateGradientShading(
  _point2D: { x: number; y: number },
  _vertices2D: Array<{ x: number; y: number }>,
  _vertices3D: Vector3[],
  faceNormal: Vector3,
  lightDir: Vector3,
  intensity: number,
  contrast: number,
  _falloff: number = 2.0
): number {
  // Calculate base shading for the face
  const baseShading = calculateShading(faceNormal, lightDir, intensity, contrast);

  // For simple implementation, just return base shading
  // Advanced gradient shading will be in advanced-shading todo
  return baseShading;
}

/**
 * Calculate key point shadings for gradient interpolation
 * (To be implemented in advanced shading phase)
 */
export function calculateKeyPointShadings(
  vertices2D: Array<{ x: number; y: number }>,
  _vertices3D: Vector3[],
  faceNormal: Vector3,
  lightDir: Vector3,
  intensity: number,
  contrast: number
): Array<{ point: { x: number; y: number }; shading: number }> {
  // For now, return uniform shading
  const shading = calculateShading(faceNormal, lightDir, intensity, contrast);
  
  return vertices2D.map((point) => ({
    point,
    shading,
  }));
}

/**
 * Interpolate shading at a point using barycentric coordinates
 * (To be implemented in advanced shading phase)
 */
export function interpolateShading(
  point: { x: number; y: number },
  keyPoints: Array<{ point: { x: number; y: number }; shading: number }>
): number {
  if (keyPoints.length === 0) return 0.5;

  // Find 3 closest key points
  const distances = keyPoints.map((kp) => ({
    point: kp.point,
    shading: kp.shading,
    dist: Math.hypot(point.x - kp.point.x, point.y - kp.point.y),
  }));

  distances.sort((a, b) => a.dist - b.dist);
  const closest = distances.slice(0, Math.min(3, distances.length));

  // Weighted average based on inverse distance
  let totalWeight = 0;
  let weightedSum = 0;

  for (const c of closest) {
    const weight = 1 / (c.dist + 0.1); // Add small epsilon to avoid division by zero
    totalWeight += weight;
    weightedSum += c.shading * weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : closest[0].shading;
}
