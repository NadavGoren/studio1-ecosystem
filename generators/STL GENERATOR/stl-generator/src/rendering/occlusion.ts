import { Vector2, HatchLine } from '../core/types';

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
export function pointInPolygon(point: Vector2, polygon: Vector2[]): boolean {
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calculate intersection between two line segments
 * 
 * @returns Intersection point or null if no intersection
 */
export function lineLineIntersection(
  p1: Vector2,
  p2: Vector2,
  p3: Vector2,
  p4: Vector2
): Vector2 | null {
  const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);

  if (Math.abs(denom) < 1e-10) {
    return null; // Lines are parallel
  }

  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    return {
      x: p1.x + ua * (p2.x - p1.x),
      y: p1.y + ua * (p2.y - p1.y),
    };
  }

  return null;
}

/**
 * Clip a line segment against a polygon
 * 
 * @param line - Line segment to clip
 * @param polygon - Occluding polygon
 * @returns Array of visible line segments (may be 0, 1, or 2 segments)
 */
export function clipLineAgainstPolygon(
  line: { start: Vector2; end: Vector2 },
  polygon: Vector2[]
): Array<{ start: Vector2; end: Vector2 }> {
  const p1 = line.start;
  const p2 = line.end;

  const p1Inside = pointInPolygon(p1, polygon);
  const p2Inside = pointInPolygon(p2, polygon);

  // Case 1: Both endpoints inside = fully occluded
  if (p1Inside && p2Inside) {
    return [];
  }

  // Find all intersections with polygon edges
  const intersections: Vector2[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const edge1 = polygon[i];
    const edge2 = polygon[(i + 1) % polygon.length];

    const intersection = lineLineIntersection(p1, p2, edge1, edge2);
    if (intersection) {
      intersections.push(intersection);
    }
  }

  // Case 2: No intersections
  if (intersections.length === 0) {
    if (!p1Inside && !p2Inside) {
      // Both outside, no clipping needed
      return [{ start: p1, end: p2 }];
    }
    // One inside, one outside (shouldn't happen with 0 intersections, but handle it)
    return [];
  }

  // Case 3: One endpoint inside
  if (p1Inside && !p2Inside) {
    // Start is occluded, clip to first intersection
    if (intersections.length > 0) {
      return [{ start: intersections[0], end: p2 }];
    }
    return [];
  }

  if (!p1Inside && p2Inside) {
    // End is occluded, clip to first intersection
    if (intersections.length > 0) {
      return [{ start: p1, end: intersections[0] }];
    }
    return [];
  }

  // Case 4: Both endpoints outside with intersections
  // Line passes through polygon, creating up to 2 segments
  if (intersections.length >= 2) {
    // Sort intersections by distance from p1
    intersections.sort((a, b) => {
      const distA = Math.hypot(a.x - p1.x, a.y - p1.y);
      const distB = Math.hypot(b.x - p1.x, b.y - p1.y);
      return distA - distB;
    });

    // Return segments before first intersection and after last intersection
    return [
      { start: p1, end: intersections[0] },
      { start: intersections[intersections.length - 1], end: p2 },
    ];
  } else if (intersections.length === 1) {
    // One intersection (edge case)
    return [{ start: p1, end: intersections[0] }];
  }

  // Default: return original line
  return [{ start: p1, end: p2 }];
}

/**
 * Clip multiple lines against a polygon
 */
export function clipLinesAgainstPolygon(
  lines: HatchLine[],
  polygon: Vector2[]
): HatchLine[] {
  const clippedLines: HatchLine[] = [];

  for (const line of lines) {
    const segments = clipLineAgainstPolygon(
      { start: { x: line.x1, y: line.y1 }, end: { x: line.x2, y: line.y2 } },
      polygon
    );

    for (const seg of segments) {
      clippedLines.push({
        x1: seg.start.x,
        y1: seg.start.y,
        x2: seg.end.x,
        y2: seg.end.y,
        shading: line.shading,
      });
    }
  }

  return clippedLines;
}

/**
 * Expand polygon by a factor (for occlusion safety margin)
 * 
 * @param polygon - Original polygon
 * @param factor - Expansion factor (e.g., 1.01 for 1% expansion)
 * @returns Expanded polygon
 */
export function expandPolygon(polygon: Vector2[], factor: number): Vector2[] {
  // Calculate center
  const center = {
    x: polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length,
    y: polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length,
  };

  // Expand each vertex away from center
  return polygon.map((p) => ({
    x: center.x + (p.x - center.x) * factor,
    y: center.y + (p.y - center.y) * factor,
  }));
}

/**
 * Clip lines against multiple polygons (depth-sorted)
 * 
 * @param lines - Lines to clip
 * @param occluders - Array of occluding polygons (front to back)
 * @param expansionFactor - Safety margin expansion (default: 1.002 = 0.2%)
 * @returns Clipped lines
 */
export function clipLinesAgainstMultiplePolygons(
  lines: HatchLine[],
  occluders: Vector2[][],
  expansionFactor: number = 1.002
): HatchLine[] {
  let result = lines;

  // Clip against each occluder
  for (const occluder of occluders) {
    const expandedOccluder = expandPolygon(occluder, expansionFactor);
    result = clipLinesAgainstPolygon(result, expandedOccluder);
    
    // Early exit if all lines are occluded
    if (result.length === 0) break;
  }

  return result;
}
