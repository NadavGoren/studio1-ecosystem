import type { Shape, RectangleShape, EllipseShape, PolylineShape, PolygonShape, LineShape, GroupShape } from '../types';

export function isShapeValid(shape: any): boolean {
  return shape && Number.isFinite(shape.x) && Number.isFinite(shape.y);
}

export function rotatePoint(x: number, y: number, cx: number, cy: number, angle: number) {
  if (angle === 0) return { x, y };
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dy * cos + dx * sin };
}

export function unrotatePoint(x: number, y: number, cx: number, cy: number, angle: number) {
  if (angle === 0) return { x, y };
  const rad = (-angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dy * cos + dx * sin };
}

/**
 * Detects if a polyline already has rounded geometry (e.g., from boolean operations with rounded inputs).
 * Returns true if the points clearly represent rounded corners that should not be rounded again.
 * 
 * Strategy:
 * - Look for regions where many consecutive points form smooth arcs (rounded corners)
 * - Detect the characteristic pattern: clusters of points forming arcs at corner locations
 * - A rounded corner from boolean ops typically has 8-9 points forming a smooth 90° arc
 */
function hasRoundedGeometry(pts: {x: number, y: number}[]): boolean {
  if (pts.length < 10) return false; // Need enough points to detect rounded corners
  
  const n = pts.length;
  let roundedCornerRegions = 0;
  let totalSmoothArcPoints = 0;
  
  // Look for regions where consecutive points form smooth arcs
  // A rounded corner typically has 6-10 points forming a smooth curve
  const minArcLength = 5; // Minimum points in an arc to be considered a rounded corner
  const windowSize = 8; // Look at windows of this size to detect arcs
  
  for (let startIdx = 0; startIdx < n; startIdx++) {
    // Check if this region forms a smooth arc
    let smoothPoints = 0;
    let totalCurvature = 0;
    let lastDirection = null;
    
    for (let i = 0; i < windowSize && i < n; i++) {
      const idx = (startIdx + i) % n;
      const curr = pts[idx];
      const next = pts[(idx + 1) % n];
      
      // Calculate direction vector
      const vx = next.x - curr.x;
      const vy = next.y - curr.y;
      const len = Math.hypot(vx, vy);
      if (len < 1e-6) continue;
      
      const dirX = vx / len;
      const dirY = vy / len;
      
      if (lastDirection !== null) {
        // Check how much the direction changed
        const dot = lastDirection.x * dirX + lastDirection.y * dirY;
        const angleChange = Math.acos(Math.max(-1, Math.min(1, dot)));
        
        // If direction change is small and consistent, it's part of a smooth arc
        if (angleChange < 0.15) { // ~8.6 degrees per step - smooth curve
          smoothPoints++;
          totalCurvature += angleChange;
        } else {
          // Large direction change - not part of this arc
          break;
        }
      }
      
      lastDirection = { x: dirX, y: dirY };
    }
    
    // If we found a region with many smooth points forming an arc, it's likely a rounded corner
    if (smoothPoints >= minArcLength) {
      // Check if the total curvature suggests a rounded corner (typically 60-120 degrees)
      if (totalCurvature > 0.5 && totalCurvature < 2.5) { // ~30° to ~140°
        roundedCornerRegions++;
        totalSmoothArcPoints += smoothPoints;
      }
    }
  }
  
  // Also check overall smoothness: if most segments are very smooth (arc-like), geometry is rounded
  let verySmoothSegments = 0;
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const next2 = pts[(i + 2) % n];
    
    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const v3x = next2.x - next.x;
    const v3y = next2.y - next.y;
    
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    const len3 = Math.hypot(v3x, v3y);
    
    if (len1 < 1e-6 || len2 < 1e-6 || len3 < 1e-6) continue;
    
    const n1x = v1x / len1;
    const n1y = v1y / len1;
    const n2x = v2x / len2;
    const n2y = v2y / len2;
    const n3x = v3x / len3;
    const n3y = v3y / len3;
    
    const dot1 = n1x * n2x + n1y * n2y;
    const dot2 = n2x * n3x + n2y * n3y;
    
    // Very smooth: consecutive segments have very similar directions
    if (dot1 > 0.98 && dot2 > 0.98) {
      verySmoothSegments++;
    }
  }
  
  const smoothRatio = verySmoothSegments / n;
  
  // Also check for sharp corners - if we find sharp corners, allow rounding
  let sharpCorners = 0;
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    
    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    
    if (len1 < 1e-6 || len2 < 1e-6) continue;
    
    const n1x = v1x / len1;
    const n1y = v1y / len1;
    const n2x = v2x / len2;
    const n2y = v2y / len2;
    
    const dot = n1x * n2x + n1y * n2y;
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    
    // Sharp corner: significant angle change (e.g., < 140°)
    if (angle < Math.PI * 0.78) { // ~140 degrees
      sharpCorners++;
    }
  }
  
  // If we found sharp corners, the shape is NOT already rounded - allow rounding
  if (sharpCorners > 0) {
    return false;
  }
  
  // Only return true if we're confident the geometry is already rounded:
  // 1. Found multiple rounded corner regions (at least 2), OR
  // 2. Found at least one rounded corner region AND geometry is very smooth overall, OR
  // 3. Geometry is extremely smooth (>60% very smooth segments) AND has many points
  return (roundedCornerRegions >= 2) || 
         (roundedCornerRegions >= 1 && smoothRatio > 0.3 && pts.length > 15) ||
         (smoothRatio > 0.6 && pts.length > 20);
}

/**
 * Generates a sampled point array representing a rounded polyline path.
 * Samples points along arcs at corners to create a polyline approximation
 * suitable for hatching algorithms that need point arrays.
 */
export function generateRoundedPolylinePoints(pts: {x: number, y: number}[], cornerRadius: number): {x: number, y: number}[] {
  if (pts.length < 3 || cornerRadius <= 0) return pts;
  
  // CRITICAL: Don't apply rounding to geometry that's already rounded
  // This prevents double-rounding issues with boolean operation results
  if (hasRoundedGeometry(pts)) {
    return pts; // Return as-is, already rounded
  }
  
  const result: {x: number, y: number}[] = [];
  const n = pts.length;
  // Use adaptive sampling with higher base to ensure smooth curves
  // Higher sampling is critical for hatching to accurately follow rounded corners
  const baseCornerSamples = 16;
  const minSamples = 8;
  const maxSamples = 32;
  
  // Calculate polygon's signed area to determine winding order
  // This is important for unioned shapes which may have reversed winding
  let signedArea = 0;
  for (let i = 0; i < n; i++) {
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    signedArea += (next.x - curr.x) * (next.y + curr.y);
  }
  signedArea /= 2;
  const isCounterclockwise = signedArea < 0; // Negative = counterclockwise in screen coords
  
  // Use the EXACT same arc calculation as ptsToStrRounded to ensure hatching matches outline
  // Pre-calculate all arc points using the same logic
  const arcPoints: { start: {x: number, y: number}, end: {x: number, y: number}, radius: number, center: {x: number, y: number}, startAngle: number, endAngle: number }[] = [];
  
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    
    // Calculate vectors - same as ptsToStrRounded
    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    
    // Lengths
    const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const len2 = Math.sqrt(v2x * v2x + v2y * v2y);
    
    if (len1 < 1e-6 || len2 < 1e-6) {
      // Degenerate segment - no arc
      arcPoints.push({ start: curr, end: curr, radius: 0, center: curr, startAngle: 0, endAngle: 0 });
      continue;
    }
    
    // Normalize vectors - same as ptsToStrRounded
    const n1x = v1x / len1;
    const n1y = v1y / len1;
    const n2x = v2x / len2;
    const n2y = v2y / len2;
    
    // Angle between segments - same as ptsToStrRounded
    const dot = n1x * n2x + n1y * n2y;
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    
    // Calculate cross product to determine turn direction and detect concave corners
    const cross = n1x * n2y - n1y * n2x;
    
    // Skip if angle is too small or too large (nearly straight or reflex) - same as ptsToStrRounded
    if (angle < 0.01 || angle > Math.PI - 0.01) {
      arcPoints.push({ start: curr, end: curr, radius: 0, center: curr, startAngle: 0, endAngle: 0 });
      continue;
    }
    
    // Detect if this is a concave (internal) corner
    // For a concave corner in a polygon, the interior angle is > 180°
    // This happens when the turn direction goes "into" the polygon
    // We can detect this by checking if the cross product sign doesn't match
    // the expected direction for the polygon's winding order
    // For a CCW polygon: left turns (cross > 0) are convex, right turns (cross < 0) are concave
    // For a CW polygon: right turns (cross < 0) are convex, left turns (cross > 0) are concave
    const isConcave = isCounterclockwise ? (cross < 0) : (cross > 0);
    
    // Calculate the distance from corner to start of arc - same as ptsToStrRounded
    const r = Math.min(cornerRadius, len1 / 2, len2 / 2);
    
    const d = r / Math.tan(angle / 2);
    
    // Points where the arc starts and ends - same as ptsToStrRounded
    const arcStartX = curr.x - n1x * d;
    const arcStartY = curr.y - n1y * d;
    const arcEndX = curr.x + n2x * d;
    const arcEndY = curr.y + n2y * d;
    
    // Calculate arc center using perpendicular bisector method (chord-based)
    // This matches SVG arc center calculation more closely
    // cross was already calculated above
    
    // CRITICAL FIX: Use perpendicular bisector method (chord-based) to match SVG exactly
    // SVG arc centers are calculated using the chord (line from arcStart to arcEnd)
    // Let's switch to that method instead of angle bisector
    const chordX = arcEndX - arcStartX;
    const chordY = arcEndY - arcStartY;
    const chordLen = Math.sqrt(chordX * chordX + chordY * chordY);
    
    if (chordLen < 1e-6 || chordLen > 2 * r) {
      arcPoints.push({ start: { x: arcStartX, y: arcStartY }, end: { x: arcEndX, y: arcEndY }, radius: r, center: curr, startAngle: 0, endAngle: 0 });
      continue;
    }
    
    // Chord midpoint
    const midX = (arcStartX + arcEndX) / 2;
    const midY = (arcStartY + arcEndY) / 2;
    
    // Perpendicular to chord (points toward one possible center)
    const perpX = -chordY / chordLen;
    const perpY = chordX / chordLen;
    
    // Distance from chord midpoint to arc center
    const halfChord = chordLen / 2;
    const distToCenter = Math.sqrt(Math.max(0, r * r - halfChord * halfChord));
    
    // SVG chooses center based on sweep flag
    // CRITICAL: This works for external (convex) corners with sign = 1
    // For internal (concave) corners, we need to invert the sign
    const sign = isConcave ? -1 : 1;
    const centerX = midX + sign * perpX * distToCenter;
    const centerY = midY + sign * perpY * distToCenter;
    
    // Calculate angles for arc sampling
    const startAngle = Math.atan2(arcStartY - centerY, arcStartX - centerX);
    const endAngle = Math.atan2(arcEndY - centerY, arcEndX - centerX);
    
    // Determine if we need to wrap around (same logic as before)
    // cross was already calculated above
    let angleDiff = endAngle - startAngle;
    if (cross > 0 && angleDiff < 0) {
      angleDiff += Math.PI * 2;
    } else if (cross < 0 && angleDiff > 0) {
      angleDiff -= Math.PI * 2;
    }
    
    arcPoints.push({
      start: { x: arcStartX, y: arcStartY },
      end: { x: arcEndX, y: arcEndY },
      radius: r,
      center: { x: centerX, y: centerY },
      startAngle,
      endAngle: startAngle + angleDiff
    });
  }
  
  // Build the sampled point array - matching the path structure from ptsToStrRounded EXACTLY
  // This follows the same pattern as ptsToStrRounded but generates sampled points instead of SVG commands
  // Critical: The path must be continuous and closed for hatching to work correctly
  
  // Helper to add point only if it's significantly different from the last point
  const addPointIfDifferent = (p: {x: number, y: number}, tolerance: number = 1e-6) => {
    if (result.length === 0) {
      result.push(p);
      return true;
    }
    const last = result[result.length - 1];
    const dist = Math.hypot(p.x - last.x, p.y - last.y);
    if (dist > tolerance) {
      result.push(p);
      return true;
    }
    return false;
  };
  
  // Start at the first arc's start point (matching ptsToStrRounded: M ${arcPoints[0].start})
  if (arcPoints.length > 0 && arcPoints[0].radius > 0) {
    result.push(arcPoints[0].start);
  } else if (arcPoints.length > 0) {
    result.push(pts[0]);
  }
  
  for (let i = 0; i < n; i++) {
    const arc = arcPoints[i];
    const nextIdx = (i + 1) % n;
    const nextArc = arcPoints[nextIdx];
    
    if (arc.radius > 0) {
      // Calculate adaptive number of samples based on arc length
      // Ensure we have enough samples to accurately represent the curve for hatching
      const arcAngle = Math.abs(arc.endAngle - arc.startAngle);
      const arcLength = arcAngle * arc.radius;
      // For small arcs, use minimum samples. For larger arcs, scale up.
      // The key is ensuring line segments are short enough to accurately represent the curve
      // Use more aggressive sampling for better accuracy
      const minSegmentLength = 0.03; // Minimum segment length in mm for accuracy (very small for precision)
      const calculatedSamples = Math.ceil(arcLength / minSegmentLength);
      const cornerSamples = Math.max(minSamples, Math.min(maxSamples, Math.max(calculatedSamples, baseCornerSamples)));
      
      // For the first arc, we already have the start point, so skip j=0
      // For subsequent arcs, the start was added by the previous iteration's connection
      const startJ = (i === 0 && result.length > 0 && 
                      Math.hypot(result[result.length - 1].x - arc.start.x, 
                                 result[result.length - 1].y - arc.start.y) < 1e-6) ? 1 : 0;
      
      // Sample points along the arc
      for (let j = startJ; j < cornerSamples; j++) {
        const t = j / cornerSamples;
        const angle = arc.startAngle + t * (arc.endAngle - arc.startAngle);
        result.push({
          x: arc.center.x + arc.radius * Math.cos(angle),
          y: arc.center.y + arc.radius * Math.sin(angle)
        });
      }
      
      // Add the arc end point (if not already added as the last sample)
      addPointIfDifferent(arc.end);
      
      // After the arc, connect to the next segment (matching ptsToStrRounded logic)
      if (nextArc.radius > 0) {
        // Connect to next arc's start point (L ${nextArc.start})
        // For consecutive arcs, this should be very close to arc.end, but we add it explicitly
        // to ensure continuity
        addPointIfDifferent(nextArc.start);
      } else {
        // Connect to next corner point (L ${next})
        addPointIfDifferent(pts[nextIdx]);
      }
    } else {
      // No arc at this corner
      const curr = pts[i];
      addPointIfDifferent(curr);
      
      // Then connect to next segment (if it has an arc, draw to its start)
      if (nextArc.radius > 0) {
        addPointIfDifferent(nextArc.start);
      }
    }
  }
  
  // Ensure path is properly closed - the hatching algorithm uses (i+1) % length
  // The modulo indexing handles path closure automatically
  
  return result;
}

export function getShapeVertices(shape: Shape): {x: number, y: number}[] {
  if (!isShapeValid(shape)) return [];
  
  if (shape.type === 'rectangle') {
    const s = shape as RectangleShape;
    const hw = s.width/2; 
    const hh = s.height/2;
    const cornerRadius = s.cornerRadius || 0;
    const r = Math.max(0, Math.min(cornerRadius, hw, hh));
    
    if (r === 0) {
      // Sharp corners
      const pts = [{x:-hw, y:-hh}, {x:hw, y:-hh}, {x:hw, y:hh}, {x:-hw, y:hh}];
      return pts.map(p => rotatePoint(s.x + p.x, s.y + p.y, s.x, s.y, s.rotation));
    }
    
    // Rounded corners - sample points along the rounded rectangle
    // We'll sample each corner with a few points to approximate the arc
    const cornerSamples = 8; // Number of points per corner arc
    const points: {x: number, y: number}[] = [];
    
    // Start at top-left corner (after the arc starts)
    // Top-left corner: arc from (x-hw, y-hh+r) to (x-hw+r, y-hh)
    // Center at (x-hw+r, y-hh+r), going from 180° to 270° (or -90°)
    for (let i = 0; i <= cornerSamples; i++) {
      const angle = Math.PI + (i / cornerSamples) * (Math.PI / 2); // 180° to 270°
      points.push({
        x: s.x - hw + r + r * Math.cos(angle),
        y: s.y - hh + r + r * Math.sin(angle)
      });
    }
    
    // Top edge (left to right)
    points.push({x: s.x + hw - r, y: s.y - hh});
    
    // Top-right corner arc
    // Center at (x+hw-r, y-hh+r), going from 270° to 0° (or 360°)
    for (let i = 1; i <= cornerSamples; i++) {
      const angle = (3 * Math.PI / 2) + (i / cornerSamples) * (Math.PI / 2); // 270° to 360° (0°)
      points.push({
        x: s.x + hw - r + r * Math.cos(angle),
        y: s.y - hh + r + r * Math.sin(angle)
      });
    }
    
    // Right edge (top to bottom)
    points.push({x: s.x + hw, y: s.y + hh - r});
    
    // Bottom-right corner arc
    // Center at (x+hw-r, y+hh-r), going from 0° to 90°
    for (let i = 1; i <= cornerSamples; i++) {
      const angle = (i / cornerSamples) * (Math.PI / 2); // 0° to 90°
      points.push({
        x: s.x + hw - r + r * Math.cos(angle),
        y: s.y + hh - r + r * Math.sin(angle)
      });
    }
    
    // Bottom edge (right to left)
    points.push({x: s.x - hw + r, y: s.y + hh});
    
    // Bottom-left corner arc
    // Center at (x-hw+r, y+hh-r), going from 90° to 180°
    for (let i = 1; i <= cornerSamples; i++) {
      const angle = (Math.PI / 2) + (i / cornerSamples) * (Math.PI / 2); // 90° to 180°
      points.push({
        x: s.x - hw + r + r * Math.cos(angle),
        y: s.y + hh - r + r * Math.sin(angle)
      });
    }
    
    // Rotate all points
    return points.map(p => rotatePoint(p.x, p.y, s.x, s.y, s.rotation));
  }
  
  if (shape.type === 'ellipse') {
    const s = shape as EllipseShape;
    const points = [];
    const steps = 32;
    for(let i=0; i<steps; i++) {
       const t = (i/steps)*Math.PI*2;
       points.push(rotatePoint(s.x + s.radiusX*Math.cos(t), s.y + s.radiusY*Math.sin(t), s.x, s.y, s.rotation));
    }
    return points;
  }
  
  if (shape.type === 'polygon') {
    const s = shape as PolygonShape;
    const points = [];
    const sides = Math.max(3, Math.floor(s.sides || 6));
    const radius = s.radius || 0;
    // Generate polygon vertices: start at top (angle -90°) and go counter-clockwise
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2; // Start at top
      points.push({ x: s.x + radius * Math.cos(angle), y: s.y + radius * Math.sin(angle) });
    }
    return points.map(p => rotatePoint(p.x, p.y, s.x, s.y, s.rotation));
  }
  
  if (shape.type === 'polyline') {
    const s = shape as PolylineShape; 
    if (!s.points || s.points.length === 0) return [];
    // Always return the actual corner points for geometric operations
    // Rounding is applied only during rendering/hatching
    return s.points.map(p => rotatePoint(s.x + p.x, s.y + p.y, s.x, s.y, s.rotation));
  }
  
  if (shape.type === 'line') {
    const s = shape as LineShape;
    return [
      rotatePoint(s.x - s.width/2, s.y, s.x, s.y, s.rotation),
      rotatePoint(s.x + s.width/2, s.y, s.x, s.y, s.rotation)
    ];
  }
  
  return [];
}

export function getShapeBounds(shape: Shape, allShapes?: Shape[]): { x: number, y: number, width: number, height: number } {
  if (!isShapeValid(shape)) return { x: 0, y: 0, width: 0, height: 0 };
  
  // Handle groups - calculate bounds from children
  if (shape.type === 'group') {
    const group = shape as GroupShape;
    if (!allShapes || group.childrenIds.length === 0) {
      return { x: shape.x, y: shape.y, width: 0, height: 0 };
    }
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasValidBounds = false;
    
    group.childrenIds.forEach((childId: string) => {
      const child = allShapes.find(s => s.id === childId);
      if (child) {
        const childBounds = getShapeBounds(child, allShapes);
        if (childBounds.width > 0 || childBounds.height > 0) {
          minX = Math.min(minX, childBounds.x);
          minY = Math.min(minY, childBounds.y);
          maxX = Math.max(maxX, childBounds.x + childBounds.width);
          maxY = Math.max(maxY, childBounds.y + childBounds.height);
          hasValidBounds = true;
        }
      }
    });
    
    if (hasValidBounds) {
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    return { x: shape.x, y: shape.y, width: 0, height: 0 };
  }
  
  const v = getShapeVertices(shape);
  if (v.length === 0) return { x: shape.x, y: shape.y, width: 0, height: 0 };
  
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  for (const p of v) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return {x:minX, y:minY, width:maxX-minX, height:maxY-minY};
}

/**
 * Calculate the centroid (geometric center) of a shape using the shoelace formula.
 * This gives a better anchor point for rotation than the bounding box center,
 * especially for complex unioned shapes.
 */
export function getShapeCentroid(shape: Shape, allShapes?: Shape[]): { x: number; y: number } {
  if (!isShapeValid(shape)) return { x: shape.x || 0, y: shape.y || 0 };
  
  // Handle groups - calculate centroid from children
  if (shape.type === 'group') {
    const group = shape as GroupShape;
    if (!allShapes || group.childrenIds.length === 0) {
      return { x: shape.x, y: shape.y };
    }
    
    // Get all vertices from all children
    const allVertices: { x: number; y: number }[] = [];
    group.childrenIds.forEach((childId: string) => {
      const child = allShapes.find(s => s.id === childId);
      if (child) {
        const childVertices = getShapeVertices(child);
        allVertices.push(...childVertices);
      }
    });
    
    if (allVertices.length === 0) {
      return { x: shape.x, y: shape.y };
    }
    
    // Calculate centroid from all vertices
    return calculatePolygonCentroid(allVertices);
  }
  
  // For polylines with holes, we need to account for holes in centroid calculation
  if (shape.type === 'polyline') {
    const s = shape as PolylineShape;
    const outerVertices = getShapeVertices(shape);
    if (outerVertices.length === 0) {
      return { x: shape.x, y: shape.y };
    }
    
    // If there are no holes, use simple centroid calculation
    if (!s.holes || s.holes.length === 0) {
      return calculatePolygonCentroid(outerVertices);
    }
    
    // For shapes with holes, calculate weighted centroid
    // Outer polygon has positive area, holes have negative area
    const outerCentroid = calculatePolygonCentroid(outerVertices);
    const outerArea = calculatePolygonArea(outerVertices);
    
    if (Math.abs(outerArea) < 1e-10) {
      // Degenerate case - fall back to simple average
      return outerCentroid;
    }
    
    let totalArea = outerArea;
    let weightedX = outerCentroid.x * outerArea;
    let weightedY = outerCentroid.y * outerArea;
    
    // Process each hole (negative area)
    const rad = (s.rotation * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    
    s.holes.forEach(hole => {
      // Convert hole to world coordinates (rotated)
      const worldHole = hole.map(p => ({
        x: s.x + p.x * cos - p.y * sin,
        y: s.y + p.y * cos + p.x * sin
      }));
      
      if (worldHole.length >= 3) {
        const holeArea = calculatePolygonArea(worldHole);
        const holeCentroid = calculatePolygonCentroid(worldHole);
        
        // Subtract hole area and subtract weighted centroid
        totalArea -= holeArea;
        weightedX -= holeCentroid.x * holeArea;
        weightedY -= holeCentroid.y * holeArea;
      }
    });
    
    if (Math.abs(totalArea) < 1e-10) {
      // All area was holes - fall back to outer centroid
      return outerCentroid;
    }
    
    return {
      x: weightedX / totalArea,
      y: weightedY / totalArea
    };
  }
  
  const vertices = getShapeVertices(shape);
  if (vertices.length === 0) {
    return { x: shape.x, y: shape.y };
  }
  
  return calculatePolygonCentroid(vertices);
}

/**
 * Calculate the signed area of a polygon using the shoelace formula.
 */
function calculatePolygonArea(vertices: { x: number; y: number }[]): number {
  if (vertices.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
  }
  return area / 2;
}

/**
 * Calculate the centroid of a polygon using the shoelace formula.
 * This works for any polygon, including complex unioned shapes.
 */
function calculatePolygonCentroid(vertices: { x: number; y: number }[]): { x: number; y: number } {
  if (vertices.length === 0) return { x: 0, y: 0 };
  if (vertices.length === 1) return vertices[0];
  if (vertices.length === 2) {
    return {
      x: (vertices[0].x + vertices[1].x) / 2,
      y: (vertices[0].y + vertices[1].y) / 2
    };
  }
  
  // Shoelace formula for polygon centroid
  let area = 0;
  let cx = 0;
  let cy = 0;
  
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    const cross = vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
    area += cross;
    cx += (vertices[i].x + vertices[j].x) * cross;
    cy += (vertices[i].y + vertices[j].y) * cross;
  }
  
  area /= 2;
  
  // If area is zero or very small, fall back to average of vertices
  if (Math.abs(area) < 1e-10) {
    const sumX = vertices.reduce((sum, v) => sum + v.x, 0);
    const sumY = vertices.reduce((sum, v) => sum + v.y, 0);
    return {
      x: sumX / vertices.length,
      y: sumY / vertices.length
    };
  }
  
  return {
    x: cx / (6 * area),
    y: cy / (6 * area)
  };
}

export function shapeToPath(shape: Shape, allShapes?: Shape[]): string {
  if (!isShapeValid(shape)) return '';
  
  // Handle groups - create a rectangle path from bounds
  if (shape.type === 'group') {
    const bounds = getShapeBounds(shape, allShapes);
    if (bounds.width <= 0 || bounds.height <= 0) return '';
    // Create a rectangle path for the group bounds
    return `M ${bounds.x} ${bounds.y} L ${bounds.x + bounds.width} ${bounds.y} L ${bounds.x + bounds.width} ${bounds.y + bounds.height} L ${bounds.x} ${bounds.y + bounds.height} Z`;
  }

  if (shape.type === 'ellipse') {
    const s = shape as EllipseShape;
    const start = rotatePoint(s.x - s.radiusX, s.y, s.x, s.y, s.rotation);
    const end = rotatePoint(s.x + s.radiusX, s.y, s.x, s.y, s.rotation);
    return `M ${start.x} ${start.y} A ${s.radiusX} ${s.radiusY} ${s.rotation} 1 1 ${end.x} ${end.y} A ${s.radiusX} ${s.radiusY} ${s.rotation} 1 1 ${start.x} ${start.y} Z`;
  }

  // Handle rounded rectangles
  if (shape.type === 'rectangle') {
    const s = shape as RectangleShape;
    const cornerRadius = s.cornerRadius || 0;
    const hw = s.width / 2;
    const hh = s.height / 2;
    
    // Clamp corner radius to max half of width/height
    const r = Math.max(0, Math.min(cornerRadius, hw, hh));
    
    if (r === 0) {
      // Sharp corners - use simple rectangle
      const pts = [
        {x: s.x - hw, y: s.y - hh},
        {x: s.x + hw, y: s.y - hh},
        {x: s.x + hw, y: s.y + hh},
        {x: s.x - hw, y: s.y + hh}
      ];
      const rotatedPts = pts.map(p => rotatePoint(p.x, p.y, s.x, s.y, s.rotation));
      return `M ${rotatedPts[0].x} ${rotatedPts[0].y} L ${rotatedPts[1].x} ${rotatedPts[1].y} L ${rotatedPts[2].x} ${rotatedPts[2].y} L ${rotatedPts[3].x} ${rotatedPts[3].y} Z`;
    }
    
    // Rounded corners - build path with arcs
    // Define points in local coordinates (before rotation)
    // We'll build the path going clockwise from top-left
    const topLeft = {x: s.x - hw + r, y: s.y - hh};
    const topRight = {x: s.x + hw - r, y: s.y - hh};
    const topRightArcEnd = {x: s.x + hw, y: s.y - hh + r};
    const bottomRight = {x: s.x + hw, y: s.y + hh - r};
    const bottomRightArcEnd = {x: s.x + hw - r, y: s.y + hh};
    const bottomLeft = {x: s.x - hw + r, y: s.y + hh};
    const bottomLeftArcEnd = {x: s.x - hw, y: s.y + hh - r};
    const topLeftArcEnd = {x: s.x - hw, y: s.y - hh + r};
    
    // Rotate all points
    const rotate = (p: {x: number, y: number}) => rotatePoint(p.x, p.y, s.x, s.y, s.rotation);
    const tl = rotate(topLeft);
    const tr = rotate(topRight);
    const trArcEnd = rotate(topRightArcEnd);
    const br = rotate(bottomRight);
    const brArcEnd = rotate(bottomRightArcEnd);
    const bl = rotate(bottomLeft);
    const blArcEnd = rotate(bottomLeftArcEnd);
    const tlArcEnd = rotate(topLeftArcEnd);
    
    // Build path: start at top-left (after arc), go clockwise
    // SVG arc: A rx ry x-axis-rotation large-arc-flag sweep-flag x y
    // For circular arcs (rx = ry), x-axis-rotation should be 0 since we're already rotating the points
    // sweep-flag = 1 means clockwise arc direction
    let path = `M ${tl.x} ${tl.y}`;
    path += ` L ${tr.x} ${tr.y}`;  // Top edge
    path += ` A ${r} ${r} 0 0 1 ${trArcEnd.x} ${trArcEnd.y}`;  // Top-right arc
    path += ` L ${br.x} ${br.y}`;  // Right edge
    path += ` A ${r} ${r} 0 0 1 ${brArcEnd.x} ${brArcEnd.y}`;  // Bottom-right arc
    path += ` L ${bl.x} ${bl.y}`;  // Bottom edge
    path += ` A ${r} ${r} 0 0 1 ${blArcEnd.x} ${blArcEnd.y}`;  // Bottom-left arc
    path += ` L ${tlArcEnd.x} ${tlArcEnd.y}`;  // Left edge
    path += ` A ${r} ${r} 0 0 1 ${tl.x} ${tl.y}`;  // Top-left arc (close)
    path += ` Z`;
    
    return path;
  }

  const ptsToStr = (pts: {x:number, y:number}[]) => {
     if (pts.length === 0) return '';
     return `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') + ' Z';
  };

  /**
   * Creates an SVG path with rounded corners for a polyline
   * Applies fillet arcs at each corner where the direction changes
   */
  const ptsToStrRounded = (pts: {x:number, y:number}[], cornerRadius: number) => {
    if (pts.length === 0) return '';
    if (pts.length < 3 || cornerRadius <= 0) {
      // Not enough points or no rounding - use sharp corners
      return ptsToStr(pts);
    }
    
    // CRITICAL: Don't apply rounding to geometry that's already rounded
    // This prevents double-rounding issues with boolean operation results
    if (hasRoundedGeometry(pts)) {
      return ptsToStr(pts); // Return as sharp path, geometry already has rounded corners baked in
    }

    const pathParts: string[] = [];
    const n = pts.length;
    
    // Pre-calculate all arc points
    const arcPoints: { start: {x: number, y: number}, end: {x: number, y: number}, radius: number, sweepFlag: number }[] = [];
    
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const curr = pts[i];
      const next = pts[(i + 1) % n];
      
      // Calculate vectors
      const v1x = curr.x - prev.x;
      const v1y = curr.y - prev.y;
      const v2x = next.x - curr.x;
      const v2y = next.y - curr.y;
      
      // Lengths
      const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
      const len2 = Math.sqrt(v2x * v2x + v2y * v2y);
      
      if (len1 < 1e-6 || len2 < 1e-6) {
        // Degenerate segment - no arc
        arcPoints.push({ start: curr, end: curr, radius: 0, sweepFlag: 0 });
        continue;
      }
      
      // Normalize vectors
      const n1x = v1x / len1;
      const n1y = v1y / len1;
      const n2x = v2x / len2;
      const n2y = v2y / len2;
      
      // Angle between segments
      const dot = n1x * n2x + n1y * n2y;
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      
      // Skip if angle is too small or too large (nearly straight or reflex)
      if (angle < 0.01 || angle > Math.PI - 0.01) {
        arcPoints.push({ start: curr, end: curr, radius: 0, sweepFlag: 0 });
        continue;
      }
      
      // Calculate the distance from corner to start of arc
      const r = Math.min(cornerRadius, len1 / 2, len2 / 2);
      const d = r / Math.tan(angle / 2);
      
      // Points where the arc starts and ends
      const arcStartX = curr.x - n1x * d;
      const arcStartY = curr.y - n1y * d;
      const arcEndX = curr.x + n2x * d;
      const arcEndY = curr.y + n2y * d;
      
      // Direction of the arc (determine sweep flag)
      // Calculate cross product to determine turn direction
      const cross = n1x * n2y - n1y * n2x;
      const sweepFlag = cross > 0 ? 1 : 0;
      
      arcPoints.push({
        start: { x: arcStartX, y: arcStartY },
        end: { x: arcEndX, y: arcEndY },
        radius: r,
        sweepFlag
      });
    }
    
    // Build the path
    // Start at the first arc's start point
    pathParts.push(`M ${arcPoints[0].start.x} ${arcPoints[0].start.y}`);
    
    for (let i = 0; i < n; i++) {
      const arc = arcPoints[i];
      const nextIdx = (i + 1) % n;
      
      if (arc.radius > 0) {
        // Draw the arc from start to end
        pathParts.push(`A ${arc.radius} ${arc.radius} 0 0 ${arc.sweepFlag} ${arc.end.x} ${arc.end.y}`);
        
        // After the arc, we need to connect to the next segment
        // If next corner has an arc, draw line to its start
        // If next corner has no arc, draw line to the corner point
        // Note: For the last point, this connects back to the start (closed path)
        const nextArc = arcPoints[nextIdx];
        if (nextArc.radius > 0) {
          // Connect to next arc's start point (or back to first for last corner)
          pathParts.push(`L ${nextArc.start.x} ${nextArc.start.y}`);
        } else {
          // Connect to next corner point
          const next = pts[nextIdx];
          pathParts.push(`L ${next.x} ${next.y}`);
        }
      } else {
        // No arc - draw line to corner point
        const curr = pts[i];
        pathParts.push(`L ${curr.x} ${curr.y}`);
        
        // Then connect to next segment (if it has an arc, draw to its start)
        const nextArc = arcPoints[nextIdx];
        if (nextArc.radius > 0) {
          pathParts.push(`L ${nextArc.start.x} ${nextArc.start.y}`);
        }
      }
    }
    
    pathParts.push('Z');
    return pathParts.join(' ');
  };

  const mainVerts = getShapeVertices(shape);
  
  // Check if we should apply rounded corners for polylines
  if (shape.type === 'polyline') {
    const s = shape as PolylineShape;
    const cornerRadius = s.cornerRadius || 0;
    
    let d: string;
    if (cornerRadius > 0 && mainVerts.length >= 3) {
      d = ptsToStrRounded(mainVerts, cornerRadius);
    } else {
      d = ptsToStr(mainVerts);
    }
    
    // Append holes (holes also get rounded corners if specified)
    if (s.holes && s.holes.length > 0) {
      s.holes.forEach(hole => {
        const rotatedHole = hole.map(p => rotatePoint(s.x + p.x, s.y + p.y, s.x, s.y, s.rotation));
        if (cornerRadius > 0 && rotatedHole.length >= 3) {
          d += ` ${ptsToStrRounded(rotatedHole, cornerRadius)}`;
        } else {
          d += ` ${ptsToStr(rotatedHole)}`;
        }
      });
    }
    
    return d;
  }
  
  let d = ptsToStr(mainVerts);

  return d;
}

export function getShapePoints(s: Shape) { 
  return getShapeVertices(s).map((p, i) => ({ ...p, index: i })); 
}

export function convertPolygonToPolyline(shape: PolygonShape): Partial<PolylineShape> {
  // Get the vertices of the polygon in world coordinates
  const vertices = getShapeVertices(shape);
  
  // Convert to local coordinates (relative to shape center, unrotated)
  const localPoints = vertices.map(v => {
    const local = unrotatePoint(v.x, v.y, shape.x, shape.y, shape.rotation);
    return { x: local.x - shape.x, y: local.y - shape.y };
  });
  
  // Convert to polyline shape, preserving all properties
  return {
    type: 'polyline' as const,
    points: localPoints,
    // Preserve all other properties
    cornerRadius: shape.cornerRadius,
  };
}

export function convertRectangleToPolyline(shape: RectangleShape): Partial<PolylineShape> {
  // Get the vertices of the rectangle in world coordinates
  // This will include all sampled points for rounded corners
  const vertices = getShapeVertices(shape);
  
  // Convert to local coordinates (relative to shape center, unrotated)
  const localPoints = vertices.map(v => {
    const local = unrotatePoint(v.x, v.y, shape.x, shape.y, shape.rotation);
    return { x: local.x - shape.x, y: local.y - shape.y };
  });
  
  // Convert to polyline shape, preserving all properties
  return {
    type: 'polyline' as const,
    points: localPoints,
    // Preserve cornerRadius if it exists
    cornerRadius: shape.cornerRadius,
  };
}

export function moveShapePoint(shape: Shape, idx: number, targetX: number, targetY: number): Partial<Shape> {
  if (shape.type === 'polyline') {
     const s = shape as PolylineShape;
     if (!s.points) return {};
     const localAbs = unrotatePoint(targetX, targetY, s.x, s.y, s.rotation);
     const offsetX = localAbs.x - s.x;
     const offsetY = localAbs.y - s.y;
     const newPoints = [...s.points];
     newPoints[idx] = { x: offsetX, y: offsetY };
     return { points: newPoints };
  }
  
  if (shape.type === 'polygon') {
     // Convert polygon to polyline first, then move the point
     const converted = convertPolygonToPolyline(shape as PolygonShape);
     const convertedPoints = converted.points;
     if (!convertedPoints) return {};
     
     // Now move the point in the converted polyline
     const localAbs = unrotatePoint(targetX, targetY, shape.x, shape.y, shape.rotation);
     const offsetX = localAbs.x - shape.x;
     const offsetY = localAbs.y - shape.y;
     const newPoints = [...convertedPoints];
     newPoints[idx] = { x: offsetX, y: offsetY };
     
     return {
       type: 'polyline' as const,
       points: newPoints,
       cornerRadius: (shape as PolygonShape).cornerRadius,
     } as Partial<Shape>;
  }
  
  if (shape.type === 'rectangle') {
     // Convert rectangle to polyline first, then move the point
     const converted = convertRectangleToPolyline(shape as RectangleShape);
     const convertedPoints = converted.points;
     if (!convertedPoints) return {};
     
     // Now move the point in the converted polyline
     const localAbs = unrotatePoint(targetX, targetY, shape.x, shape.y, shape.rotation);
     const offsetX = localAbs.x - shape.x;
     const offsetY = localAbs.y - shape.y;
     const newPoints = [...convertedPoints];
     newPoints[idx] = { x: offsetX, y: offsetY };
     
     return {
       type: 'polyline' as const,
       points: newPoints,
       cornerRadius: (shape as RectangleShape).cornerRadius,
     } as Partial<Shape>;
  }
  
  return {};
}

export function pointInShape(x: number, y: number, s: Shape, allShapes?: Shape[]) { 
  const b = getShapeBounds(s, allShapes);
  return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height; 
}

/**
 * Rotate a shape around its centroid to a new rotation angle.
 * Returns the updates needed to apply the rotation.
 */
export function rotateShapeAroundCentroid(
  shape: Shape, 
  newRotation: number, 
  allShapes?: Shape[]
): Partial<Shape> {
  if (!allShapes) allShapes = [shape];
  
  // Calculate the centroid (rotation anchor)
  const centroid = getShapeCentroid(shape, allShapes);
  const anchorX = centroid.x;
  const anchorY = centroid.y;
  
  // Current rotation and position
  const currentRotation = shape.rotation || 0;
  const currentX = shape.x;
  const currentY = shape.y;
  
  // Calculate rotation delta
  const deltaDegrees = newRotation - currentRotation;
  const rad = (deltaDegrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  
  // Calculate offset from shape center to anchor
  const offsetX = currentX - anchorX;
  const offsetY = currentY - anchorY;
  
  // Rotate the offset
  const rotatedOffsetX = offsetX * cos - offsetY * sin;
  const rotatedOffsetY = offsetX * sin + offsetY * cos;
  
  // New shape center maintains the anchor point
  const newCenterX = anchorX + rotatedOffsetX;
  const newCenterY = anchorY + rotatedOffsetY;
  
  // For polylines, we need to transform points to rotate around centroid
  if (shape.type === 'polyline') {
    const polyline = shape as PolylineShape;
    const currentRad = (currentRotation * Math.PI) / 180;
    const currentCos = Math.cos(currentRad);
    const currentSin = Math.sin(currentRad);
    const newRad = (newRotation * Math.PI) / 180;
    const newCos = Math.cos(-newRad);
    const newSin = Math.sin(-newRad);
    
    // Transform points: rotate around anchor (centroid)
    const newPoints = polyline.points.map(p => {
      // Point in world coords relative to shape origin (accounting for current rotation)
      const rotatedPX = p.x * currentCos - p.y * currentSin;
      const rotatedPY = p.x * currentSin + p.y * currentCos;
      const worldX = currentX + rotatedPX;
      const worldY = currentY + rotatedPY;
      
      // Translate to anchor-relative coordinates (anchor is the centroid)
      const relToAnchorX = worldX - anchorX;
      const relToAnchorY = worldY - anchorY;
      
      // Rotate around anchor
      const rotatedRelX = relToAnchorX * cos - relToAnchorY * sin;
      const rotatedRelY = relToAnchorX * sin + relToAnchorY * cos;
      
      // Translate back: new world position
      const newWorldX = anchorX + rotatedRelX;
      const newWorldY = anchorY + rotatedRelY;
      
      // Convert back to local coordinates relative to new center (unrotated)
      const newRelX = newWorldX - newCenterX;
      const newRelY = newWorldY - newCenterY;
      
      // Unrotate to get local coordinates
      return {
        x: newRelX * newCos - newRelY * newSin,
        y: newRelX * newSin + newRelY * newCos
      };
    });
    
    // Transform holes the same way
    let newHoles: { x: number; y: number }[][] | undefined;
    if (polyline.holes && polyline.holes.length > 0) {
      newHoles = polyline.holes.map(hole =>
        hole.map(p => {
          const rotatedPX = p.x * currentCos - p.y * currentSin;
          const rotatedPY = p.x * currentSin + p.y * currentCos;
          const worldX = currentX + rotatedPX;
          const worldY = currentY + rotatedPY;
          const relToAnchorX = worldX - anchorX;
          const relToAnchorY = worldY - anchorY;
          const rotatedRelX = relToAnchorX * cos - relToAnchorY * sin;
          const rotatedRelY = relToAnchorX * sin + relToAnchorY * cos;
          const newWorldX = anchorX + rotatedRelX;
          const newWorldY = anchorY + rotatedRelY;
          const newRelX = newWorldX - newCenterX;
          const newRelY = newWorldY - newCenterY;
          return {
            x: newRelX * newCos - newRelY * newSin,
            y: newRelX * newSin + newRelY * newCos
          };
        })
      );
    }
    
    return {
      rotation: newRotation,
      x: newCenterX,
      y: newCenterY,
      points: newPoints,
      ...(newHoles && { holes: newHoles })
    };
  }
  
  // For other shape types, just update rotation and position
  return {
    rotation: newRotation,
    x: newCenterX,
    y: newCenterY
  };
}

// @ts-ignore - r parameter reserved for future rounded polygon implementation
export function getRoundedPolygonPoints(p: any[], r: number) { return p; }

/**
 * Recenters a polyline shape by calculating its actual geometric center
 * from bounds and adjusting all points to be relative to the new center.
 * This fixes the anchor point for rotation when a shape has been deformed.
 */
export function recenterPolylineShape(shape: PolylineShape): Partial<PolylineShape> {
  if (!shape.points || shape.points.length === 0) return {};
  
  // Get current vertices (in world coordinates, already rotated)
  const currentVertices = getShapeVertices(shape);
  if (currentVertices.length === 0) return {};
  
  // Calculate actual center from current bounds (unrotated)
  // First, unrotate all vertices to get the actual shape geometry
  const unrotatedVertices = currentVertices.map(v => 
    unrotatePoint(v.x, v.y, shape.x, shape.y, shape.rotation)
  );
  
  // Calculate bounds of unrotated shape
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of unrotatedVertices) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  
  const actualCenterX = (minX + maxX) / 2;
  const actualCenterY = (minY + maxY) / 2;
  
  // Calculate offset from old center to new center
  const offsetX = actualCenterX - shape.x;
  const offsetY = actualCenterY - shape.y;
  
  // Adjust all points to be relative to the new center
  const adjustedPoints = shape.points.map(p => ({
    x: p.x + offsetX,
    y: p.y + offsetY
  }));
  
  // Adjust holes if they exist
  let adjustedHoles: { x: number; y: number }[][] | undefined;
  if (shape.holes && shape.holes.length > 0) {
    adjustedHoles = shape.holes.map(hole =>
      hole.map(p => ({
        x: p.x + offsetX,
        y: p.y + offsetY
      }))
    );
  }
  
  const update: Partial<PolylineShape> = {
    x: actualCenterX,
    y: actualCenterY,
    points: adjustedPoints
  };
  
  if (adjustedHoles) {
    update.holes = adjustedHoles;
  }
  
  return update;
}