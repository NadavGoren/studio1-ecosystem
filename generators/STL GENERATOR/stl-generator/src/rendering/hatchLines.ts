import { Vector2, HatchLine } from '../core/types';

/**
 * Polygon for hatch line generation
 */
export interface Polygon2D {
  vertices: Vector2[];
}

/**
 * Generate parallel hatch lines within a polygon
 * 
 * @param polygon - 2D polygon to fill with hatch lines
 * @param shading - Shading value (0 = dark, 1 = bright)
 * @param baseSpacing - Base line spacing in mm
 * @param minSpacing - Minimum line spacing in mm (for darkest areas)
 * @param angle - Hatch angle in degrees (0-180)
 * @returns Array of hatch lines
 */
export function generateHatchLines(
  polygon: Polygon2D,
  shading: number,
  baseSpacing: number,
  minSpacing: number,
  angle: number
): HatchLine[] {
  const vertices = polygon.vertices;
  if (vertices.length < 3) return [];

  // Calculate density from shading (darker = denser lines)
  const density = 1 - shading;
  const localSpacing = minSpacing + (baseSpacing - minSpacing) * (1 - density);

  // If spacing is too large, skip hatching
  if (localSpacing > baseSpacing * 2) return [];

  // Calculate hatch direction
  const angleRad = (angle * Math.PI) / 180;
  const dx = Math.cos(angleRad);
  const dy = Math.sin(angleRad);
  const perpX = -dy; // Perpendicular for spacing
  const perpY = dx;

  // Project polygon vertices onto perpendicular axis
  const projections = vertices.map((v) => v.x * perpX + v.y * perpY);
  const projMin = Math.min(...projections);
  const projMax = Math.max(...projections);

  const lines: HatchLine[] = [];

  // Generate hatch lines at regular intervals
  for (let offset = projMin; offset <= projMax; offset += localSpacing) {
    // Find intersections with polygon edges
    const intersections = findLinePolygonIntersections(
      offset,
      vertices,
      perpX,
      perpY,
      dx,
      dy
    );

    // Create line segments from intersection pairs
    for (let i = 0; i < intersections.length - 1; i += 2) {
      const p1 = intersections[i];
      const p2 = intersections[i + 1];

      // Filter out very short lines
      const length = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (length > 0.1) {
        // Minimum 0.1mm line length
        lines.push({
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y,
          shading,
        });
      }
    }
  }

  return lines;
}

/**
 * Find intersections between a line and polygon edges
 * 
 * @param offset - Distance along perpendicular axis
 * @param vertices - Polygon vertices
 * @param perpX - Perpendicular X component
 * @param perpY - Perpendicular Y component
 * @param dx - Line direction X
 * @param dy - Line direction Y
 * @returns Array of intersection points, sorted along line direction
 */
function findLinePolygonIntersections(
  offset: number,
  vertices: Vector2[],
  perpX: number,
  perpY: number,
  dx: number,
  dy: number
): Vector2[] {
  const intersections: Vector2[] = [];

  // Check each edge of the polygon
  for (let i = 0; i < vertices.length; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % vertices.length];

    // Calculate intersection of hatch line with edge
    const intersection = lineSegmentIntersection(offset, v1, v2, perpX, perpY, dx, dy);
    if (intersection) {
      intersections.push(intersection);
    }
  }

  // Sort intersections along the line direction
  intersections.sort((a, b) => {
    const projA = a.x * dx + a.y * dy;
    const projB = b.x * dx + b.y * dy;
    return projA - projB;
  });

  return intersections;
}

/**
 * Calculate intersection between hatch line and polygon edge
 */
function lineSegmentIntersection(
  offset: number,
  v1: Vector2,
  v2: Vector2,
  perpX: number,
  perpY: number,
  _dx: number,
  _dy: number
): Vector2 | null {
  // Project edge endpoints onto perpendicular
  const proj1 = v1.x * perpX + v1.y * perpY;
  const proj2 = v2.x * perpX + v2.y * perpY;

  // Check if line crosses the edge
  if ((proj1 - offset) * (proj2 - offset) > 0) {
    return null; // No intersection
  }

  // Calculate interpolation parameter
  const denom = proj2 - proj1;
  if (Math.abs(denom) < 1e-10) {
    return null; // Edge is parallel to hatch line
  }

  const t = (offset - proj1) / denom;

  // Calculate intersection point
  return {
    x: v1.x + t * (v2.x - v1.x),
    y: v1.y + t * (v2.y - v1.y),
  };
}

/**
 * Generate adaptive hatch lines with varying spacing based on local shading
 * (To be fully implemented in advanced shading phase)
 */
export function generateAdaptiveHatchLines(
  polygon: Polygon2D,
  baseSpacing: number,
  minSpacing: number,
  angle: number,
  calculateShading: (point: Vector2) => number
): HatchLine[] {
  // For now, use uniform shading
  // Sample shading at polygon center
  const center = {
    x: polygon.vertices.reduce((sum, v) => sum + v.x, 0) / polygon.vertices.length,
    y: polygon.vertices.reduce((sum, v) => sum + v.y, 0) / polygon.vertices.length,
  };

  const shading = calculateShading(center);
  return generateHatchLines(polygon, shading, baseSpacing, minSpacing, angle);
}

/**
 * Generate cross-hatch lines (perpendicular to primary hatch)
 */
export function generateCrossHatch(
  polygon: Polygon2D,
  shading: number,
  baseSpacing: number,
  minSpacing: number,
  angle: number,
  densityFactor: number = 0.5
): HatchLine[] {
  // Cross-hatch at 90° angle
  const crossAngle = (angle + 90) % 180;

  // Adjust spacing by density factor
  const crossBaseSpacing = baseSpacing / densityFactor;
  const crossMinSpacing = minSpacing / densityFactor;

  const crossLines = generateHatchLines(
    polygon,
    shading,
    crossBaseSpacing,
    crossMinSpacing,
    crossAngle
  );

  // Reduce density by keeping only every Nth line
  const keepRatio = 0.5;
  return crossLines.filter((_line, idx) => idx % Math.ceil(1 / keepRatio) === 0);
}

/**
 * Calculate bounds of 2D polygon
 */
export function calculatePolygonBounds(vertices: Vector2[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const v of vertices) {
    minX = Math.min(minX, v.x);
    minY = Math.min(minY, v.y);
    maxX = Math.max(maxX, v.x);
    maxY = Math.max(maxY, v.y);
  }

  const width = maxX - minX;
  const height = maxY - minY;

  return { minX, minY, maxX, maxY, width, height };
}
