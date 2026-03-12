import { Vector3, Vector2 } from '../core/types';

/**
 * Maximum distance for shadow projection
 */
const MAX_SHADOW_DISTANCE = 500; // mm

/**
 * Project a 3D point onto a floor plane along light direction
 * 
 * @param point - 3D point to project
 * @param lightDir - Light direction vector
 * @param floorZ - Z coordinate of floor plane
 * @returns Projected 2D point (or null if projection is invalid)
 */
export function projectShadowPoint(
  point: Vector3,
  lightDir: Vector3,
  floorZ: number = 0
): Vector3 | null {
  // If light is horizontal or pointing upward, no shadow
  if (Math.abs(lightDir.z) < 1e-6) {
    // Light is horizontal - project vertically down
    return { x: point.x, y: point.y, z: floorZ };
  }

  // Calculate intersection parameter
  const t = (floorZ - point.z) / lightDir.z;

  // Only project downward shadows
  if (t < 0 || t > MAX_SHADOW_DISTANCE) {
    return null;
  }

  return {
    x: point.x + t * lightDir.x,
    y: point.y + t * lightDir.y,
    z: floorZ,
  };
}

/**
 * Project multiple 3D points to create shadow polygon
 * 
 * @param points - Array of 3D points
 * @param lightDir - Light direction
 * @param floorZ - Floor Z coordinate
 * @returns Array of projected shadow points
 */
export function projectShadowPolygon(
  points: Vector3[],
  lightDir: Vector3,
  floorZ: number = 0
): Vector3[] {
  const shadowPoints: Vector3[] = [];

  for (const point of points) {
    const shadowPoint = projectShadowPoint(point, lightDir, floorZ);
    if (shadowPoint) {
      shadowPoints.push(shadowPoint);
    }
  }

  return shadowPoints;
}

/**
 * Shadow layer configuration
 */
export interface ShadowLayer {
  type: 'contact' | 'blend' | 'project' | 'directionalBlur';
  scale?: number; // For blend/project layers
  darkness: number; // Shading value (0 = dark, 1 = light)
  crossHatch?: boolean;
  blurExtension?: number; // For directional blur
}

/**
 * Create multi-layer shadow configuration
 * 
 * @param softEdges - Enable soft shadow edges
 * @param blurIntensity - Blur intensity (0-1)
 * @returns Array of shadow layers
 */
export function createShadowLayers(
  softEdges: boolean = false,
  blurIntensity: number = 0.5
): ShadowLayer[] {
  const layers: ShadowLayer[] = [
    { type: 'contact', scale: 1.0, darkness: 0.45, crossHatch: true },
    { type: 'blend', scale: 0.25, darkness: 0.38, crossHatch: true },
    { type: 'project', scale: 0.5, darkness: 0.28, crossHatch: true },
    { type: 'project', scale: 0.75, darkness: 0.18, crossHatch: false },
    { type: 'project', scale: 1.0, darkness: 0.1, crossHatch: false },
  ];

  // Add directional blur layers if soft edges enabled
  if (softEdges && blurIntensity > 0) {
    const numBlurLayers = Math.ceil(2 + blurIntensity * 2);
    const maxBlurExtension = 5 * blurIntensity; // Max 5mm blur

    for (let i = 1; i <= numBlurLayers; i++) {
      const t = i / numBlurLayers;
      const blurExtension = t * maxBlurExtension;
      const falloffPower = 2.0;
      const blurDarkness = 0.08 * Math.pow(1 - t, falloffPower);

      layers.push({
        type: 'directionalBlur',
        blurExtension,
        darkness: blurDarkness,
        crossHatch: false,
      });
    }
  }

  return layers;
}

/**
 * Calculate shadow gradient based on distance from contact point
 * 
 * @param point - Point to calculate gradient for
 * @param contactPoint - Where object touches floor
 * @param shadowPolygon - Full shadow polygon
 * @param falloff - Falloff strength (default: 2.0)
 * @returns Shading value for shadow at this point
 */
export function calculateShadowGradient(
  point: Vector2,
  contactPoint: Vector2,
  shadowPolygon: Vector2[],
  falloff: number = 2.0
): number {
  // Distance from contact point
  const distFromContact = Math.hypot(point.x - contactPoint.x, point.y - contactPoint.y);

  // Calculate max distance from contact to edge
  let maxDist = 0;
  for (const v of shadowPolygon) {
    const dist = Math.hypot(v.x - contactPoint.x, v.y - contactPoint.y);
    maxDist = Math.max(maxDist, dist);
  }

  // Normalize distance (0 = at contact, 1 = at edge)
  const normalizedDist = maxDist > 0 ? Math.min(1, distFromContact / maxDist) : 0;

  // Apply falloff using power function
  const exponent = 1.0 / (falloff * 0.25);
  const falloffDist = Math.pow(normalizedDist, exponent);

  // Shadow gradient: darker near contact (0.3), lighter at edges (0.8)
  const shadowShading = 0.3 + 0.5 * falloffDist;

  return shadowShading;
}

/**
 * Apply directional blur to shadow polygon
 * 
 * @param shadowPoint - Point on shadow polygon
 * @param contactPoint - Contact point (object base center)
 * @param lightDir2D - 2D light direction
 * @param blurExtension - Amount of blur extension
 * @returns Blurred point
 */
export function applyDirectionalBlur(
  shadowPoint: Vector2,
  contactPoint: Vector2,
  lightDir2D: Vector2,
  blurExtension: number
): Vector2 {
  // Calculate direction from contact to shadow point
  const dx = shadowPoint.x - contactPoint.x;
  const dy = shadowPoint.y - contactPoint.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 1.0) {
    return shadowPoint; // Too close to contact, no blur
  }

  const dirX = dx / dist;
  const dirY = dy / dist;

  // Dot product with light direction
  const dotWithLight = dirX * lightDir2D.x + dirY * lightDir2D.y;

  // Smooth transition zone (smoothstep function)
  let blurFactor = 0;
  if (dotWithLight < -0.2) {
    blurFactor = 0; // Fully lit side - no blur
  } else if (dotWithLight > 0.5) {
    blurFactor = 1; // Fully shadow side - full blur
  } else {
    const t = (dotWithLight + 0.2) / 0.7; // Map [-0.2, 0.5] to [0, 1]
    blurFactor = t * t * (3 - 2 * t); // Smoothstep
  }

  if (blurFactor > 0.01) {
    const extensionAmount = dist * blurExtension * blurFactor;
    return {
      x: shadowPoint.x + dirX * extensionAmount,
      y: shadowPoint.y + dirY * extensionAmount,
    };
  }

  return shadowPoint;
}

/**
 * Compute convex hull using gift wrapping algorithm
 * Used for shadow silhouette
 */
export function computeConvexHull(points: Vector2[]): Vector2[] {
  if (points.length < 3) return points;

  // Find bottommost-leftmost point
  let startIdx = 0;
  for (let i = 1; i < points.length; i++) {
    if (
      points[i].y < points[startIdx].y ||
      (points[i].y === points[startIdx].y && points[i].x < points[startIdx].x)
    ) {
      startIdx = i;
    }
  }

  const hull: Vector2[] = [];
  let currentIdx = startIdx;

  do {
    hull.push(points[currentIdx]);
    let nextIdx = (currentIdx + 1) % points.length;

    // Find point that makes smallest left turn
    for (let i = 0; i < points.length; i++) {
      const cross = crossProduct(
        points[currentIdx],
        points[nextIdx],
        points[i]
      );
      
      if (cross < 0 || (cross === 0 && 
          distance(points[currentIdx], points[i]) > distance(points[currentIdx], points[nextIdx]))) {
        nextIdx = i;
      }
    }

    currentIdx = nextIdx;
  } while (currentIdx !== startIdx && hull.length < points.length);

  return hull;
}

/**
 * Calculate cross product for convex hull
 */
function crossProduct(o: Vector2, a: Vector2, b: Vector2): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * Calculate distance between two points
 */
function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
