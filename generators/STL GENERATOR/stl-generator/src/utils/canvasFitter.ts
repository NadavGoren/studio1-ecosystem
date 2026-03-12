import { Vector2, Vector3, CanvasConfig } from '../core/types';
import { project3DTo2D, ViewMode } from '../core/projection';
import { ViewRotation } from '../ui/store/svgViewportSlice';

/**
 * Bounding box for 2D points
 */
export interface BoundingBox2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/**
 * Calculate bounding box for array of 2D points
 */
export function calculate2DBounds(points: Vector2[]): BoundingBox2D | null {
  if (points.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX,
    centerY,
  };
}

/**
 * Project 3D points to 2D based on view mode
 */
export function projectPoints(
  points3D: Vector3[],
  viewMode: ViewMode,
  perspectiveStrength: number = 1.0,
  viewRotation?: ViewRotation
): Vector2[] {
  return points3D.map((p) => project3DTo2D(p, viewMode, perspectiveStrength, 100, 45, viewRotation));
}

/**
 * Fit and scale 2D points to canvas with margins
 * 
 * @param points2D - Array of 2D points to fit
 * @param canvas - Canvas configuration
 * @returns Scaled and centered points
 */
export function fitToCanvas(
  points2D: Vector2[],
  canvas: CanvasConfig
): { points: Vector2[]; scale: number; offset: Vector2 } {
  const bounds = calculate2DBounds(points2D);

  if (!bounds || bounds.width === 0 || bounds.height === 0) {
    // Return original points if bounds are invalid
    return {
      points: points2D,
      scale: 1,
      offset: { x: 0, y: 0 },
    };
  }

  // Calculate available space (canvas size minus margins on both sides)
  const availableWidth = canvas.width - 2 * canvas.margins;
  const availableHeight = canvas.height - 2 * canvas.margins;

  // Calculate scale to fit within available space
  const scaleX = availableWidth / bounds.width;
  const scaleY = availableHeight / bounds.height;
  const scale = Math.min(scaleX, scaleY);

  // Calculate canvas center
  const canvasCenterX = canvas.width / 2;
  const canvasCenterY = canvas.height / 2;

  // Scale and center points
  const scaledPoints = points2D.map((p) => {
    // Translate to origin (relative to bounds center)
    const relX = p.x - bounds.centerX;
    const relY = p.y - bounds.centerY;

    // Scale
    const scaledX = relX * scale;
    const scaledY = relY * scale;

    // Translate to canvas center
    return {
      x: scaledX + canvasCenterX,
      y: scaledY + canvasCenterY,
    };
  });

  const offset = {
    x: canvasCenterX - bounds.centerX * scale,
    y: canvasCenterY - bounds.centerY * scale,
  };

  return {
    points: scaledPoints,
    scale,
    offset,
  };
}

/**
 * Transform a single 2D point using scale and offset
 */
export function transformPoint(
  point: Vector2,
  scale: number,
  offset: Vector2,
  boundsCenter: Vector2
): Vector2 {
  const relX = point.x - boundsCenter.x;
  const relY = point.y - boundsCenter.y;

  const scaledX = relX * scale;
  const scaledY = relY * scale;

  return {
    x: scaledX + offset.x,
    y: scaledY + offset.y,
  };
}

/**
 * Full pipeline: project 3D to 2D and fit to canvas
 */
export function projectAndFitToCanvas(
  points3D: Vector3[],
  canvas: CanvasConfig,
  viewMode: ViewMode,
  perspectiveStrength: number = 1.0,
  viewRotation?: ViewRotation
): {
  points2D: Vector2[];
  scale: number;
  offset: Vector2;
  bounds: BoundingBox2D | null;
} {
  // Project to 2D
  const projected = projectPoints(points3D, viewMode, perspectiveStrength, viewRotation);

  // Calculate bounds before fitting
  const bounds = calculate2DBounds(projected);

  // Fit to canvas
  const { points, scale, offset } = fitToCanvas(projected, canvas);

  return {
    points2D: points,
    scale,
    offset,
    bounds,
  };
}
