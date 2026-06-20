/* ============================================================
   CUBE GEOMETRY
   Cube creation and geometric utility functions
============================================================ */

export function createCube(size) {
  const s = size / 2;
  // Cube centered on origin with bottom face on floor (z=0)
  // Z is up/down, Y is forward/back, X is left/right
  // Bottom face at z=0, top face at z=size
  // All planes (XY, XZ, YZ) cut the cube exactly in half
  const vertices = [
    { x: -s, y: -s, z: 0 }, // 0: bottom-left-back
    { x:  s, y: -s, z: 0 }, // 1: bottom-right-back
    { x:  s, y: -s, z: size }, // 2: top-right-back
    { x: -s, y: -s, z: size }, // 3: top-left-back
    { x: -s, y:  s, z: 0 }, // 4: bottom-left-front
    { x:  s, y:  s, z: 0 }, // 5: bottom-right-front
    { x:  s, y:  s, z: size }, // 6: top-right-front
    { x: -s, y:  s, z: size }  // 7: top-left-front
  ];

  // Faces defined by vertex indices
  // Bottom face at z=0, top face at z=size
  // Vertices: 0=BLB, 1=BRB, 2=TRB, 3=TLB, 4=BLF, 5=BRF, 6=TRF, 7=TLF
  // Normals point OUTWARD from the cube
  const faces = [
    { indices: [0, 1, 2, 3], normal: { x: 0, y: -1, z: 0 }, name: 'back', hatchAngleOffset: 0 },    // back (y = -s): outward = negative Y
    { indices: [4, 7, 6, 5], normal: { x: 0, y: 1, z: 0 }, name: 'front', hatchAngleOffset: 60 },    // front (y = +s): outward = positive Y
    { indices: [0, 4, 5, 1], normal: { x: 0, y: 0, z: -1 }, name: 'bottom', hatchAngleOffset: 30 },  // bottom (z = 0): outward = negative Z
    { indices: [3, 2, 6, 7], normal: { x: 0, y: 0, z: 1 }, name: 'top', hatchAngleOffset: 90 },      // top (z = +size): outward = positive Z
    { indices: [0, 3, 7, 4], normal: { x: -1, y: 0, z: 0 }, name: 'left', hatchAngleOffset: 120 },    // left (x = -s): outward = negative X
    { indices: [1, 5, 6, 2], normal: { x: 1, y: 0, z: 0 }, name: 'right', hatchAngleOffset: 150 }     // right (x = +s): outward = positive X
  ];

  return { vertices, faces };
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function convexHull(points) {
  if (points.length < 3) return points;
  
  // Remove duplicate points first with tighter tolerance
  const uniquePoints = [];
  const POINT_EPSILON = 0.001; // Tighter tolerance: 0.001mm for better precision
  
  for (const p of points) {
    const isDuplicate = uniquePoints.some(existing => 
      Math.hypot(p.x - existing.x, p.y - existing.y) < POINT_EPSILON
    );
    if (!isDuplicate) {
      uniquePoints.push(p);
    }
  }
  
  if (uniquePoints.length < 3) return uniquePoints;
  
  // Find leftmost-bottommost point (guaranteed to be on hull)
  // Use bottommost first (largest Y in SVG coordinates), then leftmost
  let start = uniquePoints[0];
  for (const p of uniquePoints) {
    // In SVG, Y increases downward, so bottommost = largest Y
    if (p.y > start.y || (Math.abs(p.y - start.y) < 1e-10 && p.x < start.x)) {
      start = p;
    }
  }
  
  const hull = [];
  let current = start;
  let iterations = 0;
  const maxIterations = uniquePoints.length * 2; // Safety limit
  
  // Numerical tolerance for floating point comparisons
  const ANGLE_EPSILON = 1e-10;
  const DISTANCE_EPSILON = 1e-10;
  
  do {
    hull.push(current);
    let next = uniquePoints[0];
    
    // Find the point that makes the smallest left turn (most counterclockwise)
    for (const candidate of uniquePoints) {
      // Skip current point (with tighter tolerance)
      if (Math.hypot(candidate.x - current.x, candidate.y - current.y) < DISTANCE_EPSILON) {
        continue;
      }
      
      // Calculate cross product to determine turn direction
      // Positive = left turn (counterclockwise), Negative = right turn (clockwise)
      const cross = (next.x - current.x) * (candidate.y - current.y) - 
                   (next.y - current.y) * (candidate.x - current.x);
      
      // If next == current, or candidate is more counterclockwise, update next
      if (Math.hypot(next.x - current.x, next.y - current.y) < DISTANCE_EPSILON || cross > ANGLE_EPSILON) {
        next = candidate;
      } else if (Math.abs(cross) < ANGLE_EPSILON) {
        // Collinear points - choose the farthest point to ensure we capture all hull vertices
        const distToNext = Math.hypot(next.x - current.x, next.y - current.y);
        const distToCandidate = Math.hypot(candidate.x - current.x, candidate.y - current.y);
        if (distToCandidate > distToNext) {
          next = candidate;
        }
      }
    }
    
    current = next;
    iterations++;
    
    // Break if we've gone too many iterations (safety check)
    if (iterations > maxIterations) {
      console.warn("Convex hull: Too many iterations, breaking");
      break;
    }
    
  } while (Math.hypot(current.x - start.x, current.y - start.y) > DISTANCE_EPSILON && hull.length < uniquePoints.length);
  
  // Remove duplicate start point if it was added
  if (hull.length > 1 && Math.hypot(hull[hull.length - 1].x - hull[0].x, hull[hull.length - 1].y - hull[0].y) < DISTANCE_EPSILON) {
    hull.pop();
  }
  
  // Validation: Verify hull encloses all original points
  // This is a safety check to ensure the algorithm worked correctly
  if (hull.length >= 3) {
    const allPointsEnclosed = uniquePoints.every(point => {
      // Check if point is on or inside the hull
      // Either the point is a hull vertex, or it's inside the hull polygon
      const isHullVertex = hull.some(hullPoint => 
        Math.hypot(hullPoint.x - point.x, hullPoint.y - point.y) < POINT_EPSILON
      );
      return isHullVertex || pointInPolygon(point, hull);
    });
    
    if (!allPointsEnclosed) {
      console.warn("Convex hull validation failed: not all points enclosed");
      // Fallback: return bounding box as a safe conservative hull
      const minX = Math.min(...uniquePoints.map(p => p.x));
      const maxX = Math.max(...uniquePoints.map(p => p.x));
      const minY = Math.min(...uniquePoints.map(p => p.y));
      const maxY = Math.max(...uniquePoints.map(p => p.y));
      return [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY }
      ];
    }
  }
  
  return hull;
}

