import type { Point } from '../config/types';
import type { SeededRNG } from './rng';

/**
 * Clamps a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Maps a value from one range to another
 */
export function map(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Smooth interpolation function for creating rounded, continuous variations
 * Uses cosine interpolation for smooth, child-like wobble
 */
function smoothInterpolate(t: number): number {
  // Cosine interpolation: smooth ease-in-out curve
  return (1 - Math.cos(t * Math.PI)) / 2;
}

/**
 * Applies smooth, rounded, continuous jitter to a set of points
 * Creates a "child-like" wobble quality with no sharp, abrupt deviations
 * Uses correlated noise and smooth interpolation for organic, hand-drawn effect
 * Automatically subdivides lines to create more breakpoints for stronger jitter effect
 * @param points Original points
 * @param jitterMm Maximum jitter amount in mm
 * @param rng Seeded random number generator
 * @param preserveEndpoints If true, first and last points have reduced jitter
 */
export function applyLineJitter(
  points: Point[],
  jitterMm: number,
  rng: SeededRNG,
  preserveEndpoints: boolean = true
): Point[] {
  if (jitterMm === 0 || points.length === 0) {
    return points;
  }

  if (points.length === 1) {
    // Single point - apply minimal jitter
    const effectiveJitter = preserveEndpoints ? jitterMm * 0.2 : jitterMm;
    return [{
      x: points[0].x + rng.randomRange(-effectiveJitter, effectiveJitter),
      y: points[0].y + rng.randomRange(-effectiveJitter, effectiveJitter)
    }];
  }

  // Automatically subdivide lines to create more breakpoints for stronger jitter
  // Kids draw with many small wobbly segments, not smooth long lines
  // Calculate desired point density: at least 1 point per 2mm of line length
  let subdividedPoints = [...points];
  if (points.length < 3) {
    // Very short lines: subdivide into at least 8-12 points for visible jitter
    subdividedPoints = smoothLine(points, 6);
  } else {
    // Calculate average segment length
    let totalLength = 0;
    for (let i = 0; i < points.length - 1; i++) {
      totalLength += distance(points[i], points[i + 1]);
    }
    const avgSegmentLength = totalLength / (points.length - 1);
    
    // If segments are too long (>2mm), subdivide to create more breakpoints
    if (avgSegmentLength > 2) {
      const subdivisionsNeeded = Math.ceil(avgSegmentLength / 2);
      subdividedPoints = smoothLine(points, subdivisionsNeeded);
    } else if (points.length < 10) {
      // Even for shorter segments, ensure minimum point density for visible jitter
      subdividedPoints = smoothLine(points, Math.max(2, Math.ceil(10 / points.length)));
    }
  }

  // Generate smooth, correlated noise values for X and Y offsets
  // This creates continuous, rounded variations instead of sharp jumps
  const noiseX: number[] = [];
  const noiseY: number[] = [];
  
  // Generate base noise values with some correlation
  for (let i = 0; i < subdividedPoints.length; i++) {
    // Create correlated noise by mixing previous value with new random
    // This ensures smooth transitions between points
    const prevX = i > 0 ? noiseX[i - 1] : 0;
    const prevY = i > 0 ? noiseY[i - 1] : 0;
    
    // Mix previous value (65%) with new random (35%) for smooth correlation
    // Slightly less correlation for more visible wobble (child-like)
    const newX = rng.randomRange(-1, 1);
    const newY = rng.randomRange(-1, 1);
    
    noiseX.push(prevX * 0.65 + newX * 0.35);
    noiseY.push(prevY * 0.65 + newY * 0.35);
  }

  // Apply smoothing pass to ensure rounded, continuous variations
  // This removes any remaining sharp transitions while maintaining wobble
  const smoothedX: number[] = [];
  const smoothedY: number[] = [];
  
  for (let i = 0; i < subdividedPoints.length; i++) {
    if (i === 0 || i === subdividedPoints.length - 1) {
      // Endpoints: use original noise but reduced
      smoothedX.push(noiseX[i] * 0.5);
      smoothedY.push(noiseY[i] * 0.5);
    } else {
      // Middle points: average with neighbors for extra smoothness
      // Use weighted average (center point has more weight) to maintain wobble
      const avgX = (noiseX[i - 1] * 0.25 + noiseX[i] * 0.5 + noiseX[i + 1] * 0.25);
      const avgY = (noiseY[i - 1] * 0.25 + noiseY[i] * 0.5 + noiseY[i + 1] * 0.25);
      smoothedX.push(avgX);
      smoothedY.push(avgY);
    }
  }

  // Apply jitter with smooth interpolation and endpoint preservation
  // Increase jitter strength for more visible child-like wobble
  const jitterMultiplier = 1.3; // Make jitter 30% stronger for more visible effect
  return subdividedPoints.map((point, index) => {
    const t = index / (subdividedPoints.length - 1); // Normalized position 0-1
    const smoothFactor = smoothInterpolate(t); // Smooth curve for endpoints
    
    // Reduce jitter for endpoints if requested
    let effectiveJitter = jitterMm * jitterMultiplier;
    if (preserveEndpoints) {
      // Use smooth interpolation to gradually reduce jitter at endpoints
      // Creates natural fade-out effect
      const endpointFactor = index === 0 || index === subdividedPoints.length - 1 
        ? 0.2 
        : 1.0 - (1.0 - smoothFactor) * 0.3; // Slight reduction near endpoints
      effectiveJitter = jitterMm * jitterMultiplier * endpointFactor;
    }

    // Apply smoothed, correlated noise
    return {
      x: point.x + smoothedX[index] * effectiveJitter,
      y: point.y + smoothedY[index] * effectiveJitter
    };
  });
}

/**
 * Converts an array of points to an SVG path string
 * @param points Array of points
 * @param closed If true, closes the path
 */
export function pointsToPath(points: Point[], closed: boolean = false): string {
  if (points.length === 0) return '';
  
  let path = `M ${points[0].x.toFixed(3)} ${points[0].y.toFixed(3)}`;
  
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x.toFixed(3)} ${points[i].y.toFixed(3)}`;
  }
  
  if (closed) {
    path += ' Z';
  }
  
  return path;
}

/**
 * Subdivides a line segment into multiple points
 * @param p1 Start point
 * @param p2 End point
 * @param segments Number of segments to create
 */
export function subdivideLine(p1: Point, p2: Point, segments: number): Point[] {
  const points: Point[] = [p1];
  
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    points.push({
      x: lerp(p1.x, p2.x, t),
      y: lerp(p1.y, p2.y, t)
    });
  }
  
  points.push(p2);
  return points;
}

/**
 * Creates intermediate points for a smoother line
 * Useful before applying jitter
 */
export function smoothLine(points: Point[], subdivisions: number = 2): Point[] {
  if (points.length < 2) return points;
  
  const result: Point[] = [];
  
  for (let i = 0; i < points.length - 1; i++) {
    const subPoints = subdivideLine(points[i], points[i + 1], subdivisions);
    result.push(...subPoints.slice(0, -1));
  }
  
  result.push(points[points.length - 1]);
  return result;
}

/**
 * Randomly breaks a path into segments based on probability
 * Returns an array of path strings
 */
export function breakPath(
  points: Point[],
  breakProbability: number,
  rng: SeededRNG
): Point[][] {
  if (breakProbability === 0 || points.length < 2) {
    return [points];
  }

  const segments: Point[][] = [];
  let currentSegment: Point[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    if (i < points.length - 1 && rng.chance(breakProbability)) {
      // Break here
      currentSegment.push(points[i]);
      segments.push(currentSegment);
      currentSegment = [points[i]];
    } else {
      currentSegment.push(points[i]);
    }
  }

  if (currentSegment.length > 1) {
    segments.push(currentSegment);
  }

  return segments;
}

/**
 * Checks if a point is inside a triangle using barycentric coordinates
 */
function pointInTriangle(
  point: Point,
  v1: Point,
  v2: Point,
  v3: Point
): boolean {
  const d1 = sign(point, v1, v2);
  const d2 = sign(point, v2, v3);
  const d3 = sign(point, v3, v1);
  
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  
  return !(hasNeg && hasPos);
}

function sign(p1: Point, p2: Point, p3: Point): number {
  return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

/**
 * Finds intersection point between two line segments
 */
function lineSegmentIntersection(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): Point | null {
  const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(denom) < 1e-9) return null; // Parallel lines
  
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
  const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / denom;
  
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y)
    };
  }
  
  return null;
}

/**
 * Clips a path string against a triangle, removing parts that fall inside the triangle
 * Returns an array of path strings (may be empty if fully occluded, or multiple if split)
 */
export function clipPathAgainstTriangle(
  pathString: string,
  triangle: [Point, Point, Point]
): string[] {
  // Parse path string to points
  const points: Point[] = [];
  const pathMatch = pathString.match(/M\s+([\d.]+)\s+([\d.]+)((?:\s+L\s+[\d.]+\s+[\d.]+)*)/);
  if (!pathMatch) return [pathString]; // Can't parse, return as-is
  
  points.push({ x: parseFloat(pathMatch[1]), y: parseFloat(pathMatch[2]) });
  
  const lineMatches = pathMatch[3].matchAll(/L\s+([\d.]+)\s+([\d.]+)/g);
  for (const match of lineMatches) {
    points.push({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
  }
  
  if (points.length < 2) return [pathString];
  
  // Clip the path by checking each segment
  const clippedSegments: Point[][] = [];
  let currentSegment: Point[] = [];
  
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    
    const p1Inside = pointInTriangle(p1, triangle[0], triangle[1], triangle[2]);
    const p2Inside = pointInTriangle(p2, triangle[0], triangle[1], triangle[2]);
    
    // If both points are inside, skip this segment (fully occluded)
    if (p1Inside && p2Inside) {
      // End current segment if any
      if (currentSegment.length > 1) {
        clippedSegments.push([...currentSegment]);
        currentSegment = [];
      }
      continue;
    }
    
    // If one point is inside, find intersection with triangle edge
    if (p1Inside !== p2Inside) {
      let intersection: Point | null = null;
      // Check intersection with each triangle edge
      for (let j = 0; j < 3; j++) {
        const edgeStart = triangle[j];
        const edgeEnd = triangle[(j + 1) % 3];
        const inter = lineSegmentIntersection(p1, p2, edgeStart, edgeEnd);
        if (inter) {
          intersection = inter;
          break;
        }
      }
      
      if (intersection) {
        if (p1Inside) {
          // p1 inside, p2 outside - start from intersection
          if (currentSegment.length > 1) {
            clippedSegments.push([...currentSegment]);
          }
          currentSegment = [intersection, p2];
        } else {
          // p1 outside, p2 inside - end at intersection
          if (currentSegment.length === 0) {
            currentSegment.push(p1);
          }
          currentSegment.push(intersection);
          clippedSegments.push([...currentSegment]);
          currentSegment = [];
        }
      }
    } else {
      // Both outside - check if line passes through triangle
      let passesThrough = false;
      for (let j = 0; j < 3; j++) {
        const edgeStart = triangle[j];
        const edgeEnd = triangle[(j + 1) % 3];
        const inter = lineSegmentIntersection(p1, p2, edgeStart, edgeEnd);
        if (inter) {
          passesThrough = true;
          break;
        }
      }
      
      if (!passesThrough) {
        // Line doesn't pass through - keep it
        if (currentSegment.length === 0) {
          currentSegment.push(p1);
        }
        currentSegment.push(p2);
      } else {
        // Line passes through - clip it (skip for now, or could split)
        // End current segment
        if (currentSegment.length > 1) {
          clippedSegments.push([...currentSegment]);
        }
        currentSegment = [];
      }
    }
  }
  
  // Add final segment if any
  if (currentSegment.length > 1) {
    clippedSegments.push(currentSegment);
  }
  
  // Convert back to path strings
  return clippedSegments.map(seg => pointsToPath(seg, false));
}

/**
 * Clips a path to stay inside a triangle (keeps only parts inside)
 * Returns an array of path strings (may be empty if fully outside)
 */
export function clipPathInsideTriangle(
  pathString: string,
  triangle: [Point, Point, Point]
): string[] {
  // Parse path string to points
  const points: Point[] = [];
  const pathMatch = pathString.match(/M\s+([\d.]+)\s+([\d.]+)((?:\s+L\s+[\d.]+\s+[\d.]+)*)/);
  if (!pathMatch) return []; // Can't parse, return empty
  
  points.push({ x: parseFloat(pathMatch[1]), y: parseFloat(pathMatch[2]) });
  
  const lineMatches = pathMatch[3].matchAll(/L\s+([\d.]+)\s+([\d.]+)/g);
  for (const match of lineMatches) {
    points.push({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
  }
  
  if (points.length < 2) return [];
  
  // Clip the path by keeping only parts inside the triangle
  const clippedSegments: Point[][] = [];
  let currentSegment: Point[] = [];
  
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    
    const p1Inside = pointInTriangle(p1, triangle[0], triangle[1], triangle[2]);
    const p2Inside = pointInTriangle(p2, triangle[0], triangle[1], triangle[2]);
    
    // If both points are inside, keep this segment
    if (p1Inside && p2Inside) {
      if (currentSegment.length === 0) {
        currentSegment.push(p1);
      }
      currentSegment.push(p2);
    } else if (p1Inside !== p2Inside) {
      // One point inside, one outside - find intersection
      let intersection: Point | null = null;
      for (let j = 0; j < 3; j++) {
        const edgeStart = triangle[j];
        const edgeEnd = triangle[(j + 1) % 3];
        const inter = lineSegmentIntersection(p1, p2, edgeStart, edgeEnd);
        if (inter) {
          intersection = inter;
          break;
        }
      }
      
      if (intersection) {
        if (p1Inside) {
          // p1 inside, p2 outside - keep up to intersection
          if (currentSegment.length === 0) {
            currentSegment.push(p1);
          }
          currentSegment.push(intersection);
          if (currentSegment.length > 1) {
            clippedSegments.push([...currentSegment]);
          }
          currentSegment = [];
        } else {
          // p1 outside, p2 inside - start from intersection
          if (currentSegment.length > 1) {
            clippedSegments.push([...currentSegment]);
          }
          currentSegment = [intersection, p2];
        }
      }
    } else {
      // Both outside - end current segment if any
      if (currentSegment.length > 1) {
        clippedSegments.push([...currentSegment]);
        currentSegment = [];
      }
    }
  }
  
  // Add final segment if any
  if (currentSegment.length > 1) {
    clippedSegments.push(currentSegment);
  }
  
  // Convert back to path strings
  return clippedSegments.map(seg => pointsToPath(seg, false));
}

/**
 * Checks if a point is inside a polygon using ray casting algorithm
 */
function pointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  
  return inside;
}

/**
 * Clips a path string against a polygon, removing parts that fall inside the polygon
 * Returns an array of path strings (may be empty if fully occluded, or multiple if split)
 */
export function clipPathAgainstPolygon(
  pathString: string,
  polygon: Point[]
): string[] {
  if (polygon.length < 3) return [pathString]; // Invalid polygon
  
  // Parse path string to points
  const points: Point[] = [];
  const pathMatch = pathString.match(/M\s+([\d.]+)\s+([\d.]+)((?:\s+L\s+[\d.]+\s+[\d.]+)*)/);
  if (!pathMatch) return [pathString]; // Can't parse, return as-is
  
  points.push({ x: parseFloat(pathMatch[1]), y: parseFloat(pathMatch[2]) });
  
  const lineMatches = pathMatch[3].matchAll(/L\s+([\d.]+)\s+([\d.]+)/g);
  for (const match of lineMatches) {
    points.push({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
  }
  
  if (points.length < 2) return [pathString];
  
  // Clip the path by checking each segment
  const clippedSegments: Point[][] = [];
  let currentSegment: Point[] = [];
  
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    
    const p1Inside = pointInPolygon(p1, polygon);
    const p2Inside = pointInPolygon(p2, polygon);
    
    // If both points are inside, skip this segment (fully occluded)
    if (p1Inside && p2Inside) {
      if (currentSegment.length > 1) {
        clippedSegments.push([...currentSegment]);
        currentSegment = [];
      }
      continue;
    }
    
    // If one point is inside, find intersection with polygon edge
    if (p1Inside !== p2Inside) {
      let intersection: Point | null = null;
      // Check intersection with each polygon edge
      for (let j = 0; j < polygon.length; j++) {
        const edgeStart = polygon[j];
        const edgeEnd = polygon[(j + 1) % polygon.length];
        const inter = lineSegmentIntersection(p1, p2, edgeStart, edgeEnd);
        if (inter) {
          intersection = inter;
          break;
        }
      }
      
      if (intersection) {
        if (p1Inside) {
          // p1 inside, p2 outside - start from intersection
          if (currentSegment.length > 1) {
            clippedSegments.push([...currentSegment]);
          }
          currentSegment = [intersection, p2];
        } else {
          // p1 outside, p2 inside - end at intersection
          if (currentSegment.length === 0) {
            currentSegment.push(p1);
          }
          currentSegment.push(intersection);
          clippedSegments.push([...currentSegment]);
          currentSegment = [];
        }
      }
    } else {
      // Both outside - check if line passes through polygon
      let passesThrough = false;
      for (let j = 0; j < polygon.length; j++) {
        const edgeStart = polygon[j];
        const edgeEnd = polygon[(j + 1) % polygon.length];
        const inter = lineSegmentIntersection(p1, p2, edgeStart, edgeEnd);
        if (inter) {
          passesThrough = true;
          break;
        }
      }
      
      if (!passesThrough) {
        // Line doesn't pass through - keep it
        if (currentSegment.length === 0) {
          currentSegment.push(p1);
        }
        currentSegment.push(p2);
      } else {
        // Line passes through - clip it
        if (currentSegment.length > 1) {
          clippedSegments.push([...currentSegment]);
        }
        currentSegment = [];
      }
    }
  }
  
  // Add final segment if any
  if (currentSegment.length > 1) {
    clippedSegments.push(currentSegment);
  }
  
  // Convert back to path strings
  return clippedSegments.map(seg => pointsToPath(seg, false));
}

/**
 * Clips a path to stay inside a rectangle (keeps only parts inside)
 * Returns an array of path strings (may be empty if fully outside)
 */
export function clipPathInsideRect(
  pathString: string,
  rect: { x: number; y: number; width: number; height: number }
): string[] {
  // Create rectangle polygon
  const rectPolygon: Point[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height }
  ];
  
  // Parse path string to points
  const points: Point[] = [];
  const pathMatch = pathString.match(/M\s+([\d.]+)\s+([\d.]+)((?:\s+L\s+[\d.]+\s+[\d.]+)*)/);
  if (!pathMatch) return []; // Can't parse, return empty
  
  points.push({ x: parseFloat(pathMatch[1]), y: parseFloat(pathMatch[2]) });
  
  const lineMatches = pathMatch[3].matchAll(/L\s+([\d.]+)\s+([\d.]+)/g);
  for (const match of lineMatches) {
    points.push({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
  }
  
  if (points.length < 2) return [];
  
  // Clip the path by keeping only parts inside the rectangle
  const clippedSegments: Point[][] = [];
  let currentSegment: Point[] = [];
  
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    
    const p1Inside = pointInPolygon(p1, rectPolygon);
    const p2Inside = pointInPolygon(p2, rectPolygon);
    
    // If both points are inside, keep this segment
    if (p1Inside && p2Inside) {
      if (currentSegment.length === 0) {
        currentSegment.push(p1);
      }
      currentSegment.push(p2);
    } else if (p1Inside !== p2Inside) {
      // One point inside, one outside - find intersection
      let intersection: Point | null = null;
      for (let j = 0; j < rectPolygon.length; j++) {
        const edgeStart = rectPolygon[j];
        const edgeEnd = rectPolygon[(j + 1) % rectPolygon.length];
        const inter = lineSegmentIntersection(p1, p2, edgeStart, edgeEnd);
        if (inter) {
          intersection = inter;
          break;
        }
      }
      
      if (intersection) {
        if (p1Inside) {
          // p1 inside, p2 outside - keep up to intersection
          if (currentSegment.length === 0) {
            currentSegment.push(p1);
          }
          currentSegment.push(intersection);
          if (currentSegment.length > 1) {
            clippedSegments.push([...currentSegment]);
          }
          currentSegment = [];
        } else {
          // p1 outside, p2 inside - start from intersection
          if (currentSegment.length > 1) {
            clippedSegments.push([...currentSegment]);
          }
          currentSegment = [intersection, p2];
        }
      }
    } else {
      // Both outside - end current segment if any
      if (currentSegment.length > 1) {
        clippedSegments.push([...currentSegment]);
        currentSegment = [];
      }
    }
  }
  
  // Add final segment if any
  if (currentSegment.length > 1) {
    clippedSegments.push(currentSegment);
  }
  
  // Convert back to path strings
  return clippedSegments.map(seg => pointsToPath(seg, false));
}

/**
 * Adds random slope (1-3 degrees) to a line for kid-sketch feel
 * Automatically detects perfectly horizontal or vertical lines and applies deviation
 * Also adds endpoint jitter (1-2mm) to ensure no perfect alignment
 */
export function addRandomSlope(
  points: Point[],
  rng: SeededRNG,
  maxDegrees: number = 3
): Point[] {
  if (points.length < 2) return points;
  
  const maxRadians = (maxDegrees * Math.PI) / 180;
  
  // Calculate line direction from first to last point
  const dx = points[points.length - 1].x - points[0].x;
  const dy = points[points.length - 1].y - points[0].y;
  const lineLength = Math.sqrt(dx * dx + dy * dy);
  
  if (lineLength < 0.1) return points; // Too short to apply slope
  
  // Detect perfectly horizontal or vertical lines
  const tolerance = 0.1; // 0.1mm tolerance for "perfect" alignment
  const isHorizontal = Math.abs(dy) < tolerance;
  const isVertical = Math.abs(dx) < tolerance;
  
  let slopeAngle: number;
  
  if (isHorizontal || isVertical) {
    // For perfectly horizontal/vertical lines, always apply deviation (1-3 degrees)
    slopeAngle = rng.randomRange(-maxRadians, maxRadians);
  } else {
    // For other lines, apply slight random deviation (0-1 degree) for natural feel
    slopeAngle = rng.randomRange(-maxRadians * 0.33, maxRadians * 0.33);
  }
  
  // Apply rotation to all points except first
  const cos = Math.cos(slopeAngle);
  const sin = Math.sin(slopeAngle);
  const centerX = points[0].x;
  const centerY = points[0].y;
  
  // Apply endpoint jitter (1-2mm) to ensure no perfect alignment
  const endpointJitter = rng.randomRange(1, 2);
  
  return points.map((p, i) => {
    const relX = p.x - centerX;
    const relY = p.y - centerY;
    
    // Apply rotation
    let newX = centerX + relX * cos - relY * sin;
    let newY = centerY + relX * sin + relY * cos;
    
    // Add endpoint jitter to all points (stronger at endpoints)
    if (i === 0 || i === points.length - 1) {
      // Endpoints get full jitter
      newX += rng.randomRange(-endpointJitter, endpointJitter);
      newY += rng.randomRange(-endpointJitter, endpointJitter);
    } else {
      // Middle points get reduced jitter
      newX += rng.randomRange(-endpointJitter * 0.3, endpointJitter * 0.3);
      newY += rng.randomRange(-endpointJitter * 0.3, endpointJitter * 0.3);
    }
    
    return { x: newX, y: newY };
  });
}

/**
 * Converts a perfect geometric shape into an irregular polygon
 * Applies 1-3° angle variation to each edge, adds endpoint jitter (1-2mm),
 * and ensures no parallel lines remain
 * @param points Original shape points (should form a closed polygon)
 * @param rng Random number generator
 * @param maxDegrees Maximum angle variation in degrees (default 3)
 * @param endpointJitterMm Endpoint jitter amount in mm (default 1-2mm)
 */
export function makeIrregularPolygon(
  points: Point[],
  rng: SeededRNG,
  maxDegrees: number = 3,
  endpointJitterMm: number = 1.5
): Point[] {
  if (points.length < 3) return points;
  
  const maxRadians = (maxDegrees * Math.PI) / 180;
  const irregularPoints: Point[] = [];
  
  // Process each edge of the polygon
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    
    // Calculate edge direction
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const edgeLength = Math.sqrt(dx * dx + dy * dy);
    
    if (edgeLength < 0.1) {
      // Very short edge, just add jitter
      irregularPoints.push({
        x: p1.x + rng.randomRange(-endpointJitterMm, endpointJitterMm),
        y: p1.y + rng.randomRange(-endpointJitterMm, endpointJitterMm)
      });
      continue;
    }
    
    // Detect if edge is horizontal or vertical
    const tolerance = 0.1;
    const isHorizontal = Math.abs(dy) < tolerance;
    const isVertical = Math.abs(dx) < tolerance;
    
    // Apply angle variation to edge
    let angleVariation: number;
    if (isHorizontal || isVertical) {
      // Perfect alignment: apply full 1-3° variation
      angleVariation = rng.randomRange(-maxRadians, maxRadians);
    } else {
      // Already angled: apply smaller variation (0-1°)
      angleVariation = rng.randomRange(-maxRadians * 0.33, maxRadians * 0.33);
    }
    
    // Calculate rotated endpoint
    const cos = Math.cos(angleVariation);
    const sin = Math.sin(angleVariation);
    const rotatedX = p1.x + (dx * cos - dy * sin);
    const rotatedY = p1.y + (dx * sin + dy * cos);
    
    // Add endpoint jitter
    irregularPoints.push({
      x: rotatedX + rng.randomRange(-endpointJitterMm, endpointJitterMm),
      y: rotatedY + rng.randomRange(-endpointJitterMm, endpointJitterMm)
    });
  }
  
  return irregularPoints;
}

/**
 * Generates hatching lines (parallel lines) for shading
 * @param bounds Rectangle bounds to fill with hatching
 * @param spacing Distance between hatch lines in mm
 * @param angle Angle of hatch lines in radians (0 = horizontal)
 * @param jitterMm Jitter amount for hand-drawn feel
 * @param rng Random number generator
 */
export function drawHatching(
  bounds: { x: number; y: number; width: number; height: number },
  spacing: number,
  angle: number = Math.PI / 4,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  
  // Calculate how many lines we need
  const diagonal = Math.sqrt(bounds.width * bounds.width + bounds.height * bounds.height);
  const lineCount = Math.ceil(diagonal / spacing) + 2;
  
  // Generate lines
  for (let i = -1; i <= lineCount; i++) {
    const offset = i * spacing;
    
    // Find intersection points with rectangle bounds
    const corners: Point[] = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      { x: bounds.x, y: bounds.y + bounds.height }
    ];
    
    // Calculate line equation: y = mx + b (rotated)
    // For a line at angle through origin: y = tan(angle) * x
    // Shifted by offset perpendicular to the line direction
    const perpCos = -sin;
    const perpSin = cos;
    const lineX = bounds.x + bounds.width / 2 + offset * perpCos;
    const lineY = bounds.y + bounds.height / 2 + offset * perpSin;
    
    // Find intersections with rectangle edges
    const intersections: Point[] = [];
    
    // Check each edge
    for (let j = 0; j < 4; j++) {
      const p1 = corners[j];
      const p2 = corners[(j + 1) % 4];
      
      // Line through (lineX, lineY) with direction (cos, sin)
      // Edge from p1 to p2
      const edgeDx = p2.x - p1.x;
      const edgeDy = p2.y - p1.y;
      
      // Solve intersection
      const denom = edgeDx * sin - edgeDy * cos;
      if (Math.abs(denom) > 1e-6) {
        const t = ((lineX - p1.x) * sin - (lineY - p1.y) * cos) / denom;
        if (t >= 0 && t <= 1) {
          const intersectX = p1.x + t * edgeDx;
          const intersectY = p1.y + t * edgeDy;
          
          // Check if intersection is within bounds
          if (intersectX >= bounds.x - 0.1 && intersectX <= bounds.x + bounds.width + 0.1 &&
              intersectY >= bounds.y - 0.1 && intersectY <= bounds.y + bounds.height + 0.1) {
            intersections.push({ x: intersectX, y: intersectY });
          }
        }
      }
    }
    
    // If we have 2 intersections, draw the line
    if (intersections.length >= 2) {
      // Remove duplicates and sort
      const unique: Point[] = [];
      for (const p of intersections) {
        let isDuplicate = false;
        for (const u of unique) {
          if (distance(p, u) < 0.1) {
            isDuplicate = true;
            break;
          }
        }
        if (!isDuplicate) unique.push(p);
      }
      
      if (unique.length >= 2) {
        // Sort by distance along the line
        unique.sort((a, b) => {
          const distA = (a.x - lineX) * cos + (a.y - lineY) * sin;
          const distB = (b.x - lineX) * cos + (b.y - lineY) * sin;
          return distA - distB;
        });
        
        let linePoints: Point[] = [unique[0], unique[unique.length - 1]];
        
        if (jitterMm > 0 && rng) {
          linePoints = smoothLine(linePoints, 4);
          linePoints = applyLineJitter(linePoints, jitterMm * 0.5, rng, true);
        }
        
        paths.push(pointsToPath(linePoints, false));
      }
    }
  }
  
  return paths;
}

