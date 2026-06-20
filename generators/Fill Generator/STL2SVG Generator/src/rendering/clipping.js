/* ============================================================
   LINE CLIPPING
   Functions for clipping lines against bounds and polygons
============================================================ */

import { pointInPolygon } from '../core/geometry.js';

/**
 * Clip a line to canvas bounds
 * @param {Number} x1 - Start X coordinate
 * @param {Number} y1 - Start Y coordinate
 * @param {Number} x2 - End X coordinate
 * @param {Number} y2 - End Y coordinate
 * @param {Object} bounds - Bounding box {x0, y0, x1, y1}
 * @returns {Object|null} Clipped line {x1, y1, x2, y2} or null if completely outside
 */
export function clipLineToBounds(x1, y1, x2, y2, bounds) {
  const { x0, y0, x1: bx1, y1: by1 } = bounds;
  
  // Simple clipping: if both points are outside, skip
  const p1In = x1 >= x0 && x1 <= bx1 && y1 >= y0 && y1 <= by1;
  const p2In = x2 >= x0 && x2 <= bx1 && y2 >= y0 && y2 <= by1;
  
  if (!p1In && !p2In) return null;
  
  // Clamp points to bounds
  const clampX = (x) => Math.max(x0, Math.min(bx1, x));
  const clampY = (y) => Math.max(y0, Math.min(by1, y));
  
  return {
    x1: clampX(x1),
    y1: clampY(y1),
    x2: clampX(x2),
    y2: clampY(y2)
  };
}

/**
 * Clip a line segment against a polygon (for hidden surface removal)
 * @param {Object} line - Line object {x1, y1, x2, y2}
 * @param {Array} polygon - Array of {x, y} points representing the polygon
 * @param {Boolean} strict - Whether to use strict clipping (currently unused, kept for compatibility)
 * @returns {Object|Array|null} Clipped line(s) or null if fully occluded
 */
export function clipLineAgainstPolygon(line, polygon, strict = false) {
  // Ultra-simple line clipping for occlusion
  // Returns null (fully occluded) or line/array of segments (visible)
  
  const p1 = { x: line.x1, y: line.y1 };
  const p2 = { x: line.x2, y: line.y2 };
  
  const p1Inside = pointInPolygon(p1, polygon);
  const p2Inside = pointInPolygon(p2, polygon);
  
  // Case 1: Both endpoints inside - completely occluded
  if (p1Inside && p2Inside) {
    return null;
  }
  
  // Case 2: Both endpoints outside - ALWAYS check for pass-through (strict mode for all)
  if (!p1Inside && !p2Inside) {
    // Always check pass-through for proper occlusion
    // This prevents lines from leaking through faces
  }
  
  // Find all intersections with polygon edges
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const lineLen = Math.hypot(dx, dy);
  
  if (lineLen < 0.01) return line; // Too short - keep it
  
  const intersections = [];
  
  for (let i = 0; i < polygon.length; i++) {
    const e1 = polygon[i];
    const e2 = polygon[(i + 1) % polygon.length];
    
    const edgeDx = e2.x - e1.x;
    const edgeDy = e2.y - e1.y;
    
    const denom = dx * edgeDy - dy * edgeDx;
    if (Math.abs(denom) < 1e-9) continue; // Parallel
    
    const t = ((e1.x - line.x1) * edgeDy - (e1.y - line.y1) * edgeDx) / denom;
    const u = ((e1.x - line.x1) * dy - (e1.y - line.y1) * dx) / denom;
    
    // Tight tolerance for precise clipping - prevents artifacts during rotation
    if (t > 0.001 && t < 0.999 && u >= -0.001 && u <= 1.001) {
      intersections.push({
        x: line.x1 + t * dx,
        y: line.y1 + t * dy,
        t: t
      });
    }
  }
  
  // Sort by t parameter
  intersections.sort((a, b) => a.t - b.t);
  
  // Remove duplicates with tight threshold
  const unique = [];
  const DUPLICATE_THRESHOLD = 0.01; // 0.01mm threshold for duplicates
  for (const pt of intersections) {
    if (unique.length === 0 || Math.hypot(pt.x - unique[unique.length - 1].x, pt.y - unique[unique.length - 1].y) > DUPLICATE_THRESHOLD) {
      unique.push(pt);
    }
  }
  
  // Case 3: One endpoint inside - clip at first intersection
  if ((p1Inside || p2Inside) && unique.length > 0) {
    if (p1Inside) {
      // p1 inside, p2 outside - keep from intersection to p2
      return {
        x1: unique[0].x,
        y1: unique[0].y,
        x2: line.x2,
        y2: line.y2
      };
    } else {
      // p2 inside, p1 outside - keep from p1 to intersection
      return {
        x1: line.x1,
        y1: line.y1,
        x2: unique[0].x,
        y2: unique[0].y
      };
    }
  }
  
  // Case 4: Both outside with intersections - ALWAYS handle (no strict flag needed)
  if (!p1Inside && !p2Inside && unique.length >= 2) {
    // Line passes through polygon - split into segments outside
    const segments = [];
    const T_THRESHOLD = 0.01; // Consistent threshold for segment creation
    
    // Add segment before first intersection
    if (unique[0].t > T_THRESHOLD) {
      segments.push({
        x1: line.x1,
        y1: line.y1,
        x2: unique[0].x,
        y2: unique[0].y
      });
    }
    
    // Add segment after last intersection
    if (unique[unique.length - 1].t < (1.0 - T_THRESHOLD)) {
      segments.push({
        x1: unique[unique.length - 1].x,
        y1: unique[unique.length - 1].y,
        x2: line.x2,
        y2: line.y2
      });
    }
    
    return segments.length > 0 ? segments : null;
  }
  
  // Default: keep the line (no intersections found)
  return line;
}

/**
 * Clip a line segment against a polygon with ultra-high precision (for shadow lines)
 * Uses tighter tolerances than clipLineAgainstPolygon for minimal gaps
 * @param {Object} line - Line object {x1, y1, x2, y2}
 * @param {Array} polygon - Array of {x, y} points representing the polygon
 * @returns {Object|Array|null} Clipped line(s) or null if fully occluded
 */
export function clipLineAgainstPolygonPrecise(line, polygon) {
  // Ultra-precise line clipping for shadow lines to minimize gaps
  // Uses 10x tighter tolerances than standard clipping
  
  const p1 = { x: line.x1, y: line.y1 };
  const p2 = { x: line.x2, y: line.y2 };
  
  const p1Inside = pointInPolygon(p1, polygon);
  const p2Inside = pointInPolygon(p2, polygon);
  
  // Case 1: Both endpoints inside - completely occluded
  if (p1Inside && p2Inside) {
    return null;
  }
  
  // Find all intersections with polygon edges
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const lineLen = Math.hypot(dx, dy);
  
  if (lineLen < 0.001) return line; // Too short - keep it (tighter threshold)
  
  const intersections = [];
  
  for (let i = 0; i < polygon.length; i++) {
    const e1 = polygon[i];
    const e2 = polygon[(i + 1) % polygon.length];
    
    const edgeDx = e2.x - e1.x;
    const edgeDy = e2.y - e1.y;
    
    const denom = dx * edgeDy - dy * edgeDx;
    if (Math.abs(denom) < 1e-10) continue; // Parallel (tighter tolerance)
    
    const t = ((e1.x - line.x1) * edgeDy - (e1.y - line.y1) * edgeDx) / denom;
    const u = ((e1.x - line.x1) * dy - (e1.y - line.y1) * dx) / denom;
    
    // Ultra-tight tolerance for sub-pixel precision
    if (t > 0.0001 && t < 0.9999 && u >= -0.0001 && u <= 1.0001) {
      intersections.push({
        x: line.x1 + t * dx,
        y: line.y1 + t * dy,
        t: t
      });
    }
  }
  
  // Sort by t parameter
  intersections.sort((a, b) => a.t - b.t);
  
  // Remove duplicates with ultra-tight threshold
  const unique = [];
  const DUPLICATE_THRESHOLD = 0.001; // 0.001mm threshold (10x tighter)
  for (const pt of intersections) {
    if (unique.length === 0 || Math.hypot(pt.x - unique[unique.length - 1].x, pt.y - unique[unique.length - 1].y) > DUPLICATE_THRESHOLD) {
      unique.push(pt);
    }
  }
  
  // Case 2: One endpoint inside - clip at first intersection
  if ((p1Inside || p2Inside) && unique.length > 0) {
    if (p1Inside) {
      // p1 inside, p2 outside - keep from intersection to p2
      return {
        x1: unique[0].x,
        y1: unique[0].y,
        x2: line.x2,
        y2: line.y2
      };
    } else {
      // p2 inside, p1 outside - keep from p1 to intersection
      return {
        x1: line.x1,
        y1: line.y1,
        x2: unique[0].x,
        y2: unique[0].y
      };
    }
  }
  
  // Case 3: Both outside with intersections - split into segments outside
  if (!p1Inside && !p2Inside && unique.length >= 2) {
    const segments = [];
    const T_THRESHOLD = 0.001; // Ultra-tight threshold (10x smaller)
    
    // Add segment before first intersection
    if (unique[0].t > T_THRESHOLD) {
      segments.push({
        x1: line.x1,
        y1: line.y1,
        x2: unique[0].x,
        y2: unique[0].y
      });
    }
    
    // Add segment after last intersection
    if (unique[unique.length - 1].t < (1.0 - T_THRESHOLD)) {
      segments.push({
        x1: unique[unique.length - 1].x,
        y1: unique[unique.length - 1].y,
        x2: line.x2,
        y2: line.y2
      });
    }
    
    return segments.length > 0 ? segments : null;
  }
  
  // Default: keep the line (no intersections found)
  return line;
}

/**
 * Inset a line segment endpoints inward by a specified amount
 * This pulls line endpoints away from boundaries to prevent visual leaks
 * @param {Object} line - Line object {x1, y1, x2, y2}
 * @param {Number} insetAmount - Amount to inset in mm
 * @returns {Object|null} Inset line or null if line too short
 */
export function insetLine(line, insetAmount) {
  if (insetAmount <= 0) return line;
  
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const lineLen = Math.hypot(dx, dy);
  
  // If line is too short to inset, skip it
  if (lineLen < insetAmount * 2) {
    return null;
  }
  
  // Normalize direction vector
  const dirX = dx / lineLen;
  const dirY = dy / lineLen;
  
  // Move endpoints inward
  return {
    x1: line.x1 + dirX * insetAmount,
    y1: line.y1 + dirY * insetAmount,
    x2: line.x2 - dirX * insetAmount,
    y2: line.y2 - dirY * insetAmount
  };
}

