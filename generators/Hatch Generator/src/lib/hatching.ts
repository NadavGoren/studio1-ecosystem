import type { Shape, HatchParams, PolylineShape } from '../types';
import { getShapeVertices, generateRoundedPolylinePoints } from './geometry';

interface Point { x: number; y: number; }

// Helper: Calculate intersection of two line segments
function intersect(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const det = (p2.x - p1.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p2.y - p1.y);
  if (det === 0) return null; // Parallel lines
  
  const lambda = ((p4.y - p3.y) * (p4.x - p1.x) + (p3.x - p4.x) * (p4.y - p1.y)) / det;
  const gamma = ((p1.y - p2.y) * (p4.x - p1.x) + (p2.x - p1.x) * (p4.y - p1.y)) / det;
  
  if (0 <= lambda && lambda <= 1 && 0 <= gamma && gamma <= 1) {
    return { x: p1.x + lambda * (p2.x - p1.x), y: p1.y + lambda * (p2.y - p1.y) };
  }
  return null;
}

export function generateHatchLines(shape: Shape, params: HatchParams): string[] {
  if (!params.enabled) return [];
  // Groups can't be hatched directly (they're containers)
  if (shape.type === 'group') return [];

  // 1. Gather all contours (Main Outline + Holes)
  // getShapeVertices returns the main outline as absolute rotated coordinates
  const contours: Point[][] = [];
  let outline = getShapeVertices(shape);
  if (!outline || outline.length < 2) return [];
  
  // Apply rounded corners for polylines if cornerRadius is set
  if (shape.type === 'polyline') {
    const s = shape as PolylineShape;
    const cornerRadius = s.cornerRadius || 0;
    if (cornerRadius > 0 && outline.length >= 3) {
      outline = generateRoundedPolylinePoints(outline, cornerRadius);
    }
  }
  
  contours.push(outline);
  
  // Handle Holes (Polyline/Boolean shapes)
  if (shape.type === 'polyline') {
    const s = shape as PolylineShape;
    if (s.holes && s.holes.length > 0) {
       // We must rotate the holes to match the shape's current world transform
       // Holes are stored relative to the shape center (unrotated)
       const rad = (s.rotation * Math.PI) / 180;
       const cos = Math.cos(rad), sin = Math.sin(rad);
       const cornerRadius = s.cornerRadius || 0;
       
       s.holes.forEach(hole => {
          // Convert to world coordinates (rotated)
          const worldHole = hole.map(p => ({
             x: s.x + p.x * cos - p.y * sin,
             y: s.y + p.y * cos + p.x * sin
          }));
          
          // Apply rounded corners if specified
          if (cornerRadius > 0 && worldHole.length >= 3) {
            contours.push(generateRoundedPolylinePoints(worldHole, cornerRadius));
          } else {
            contours.push(worldHole);
          }
       });
    }
  }

  // 2. Calculate Bounding Box & Scan Vectors
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  outline.forEach(p => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  });

  // Diagonal covers the entire shape regardless of angle
  const diag = Math.sqrt((maxX-minX)**2 + (maxY-minY)**2) * 1.5;
  
  const angle = params.spaceMode === 'local' ? params.angle + shape.rotation : params.angle;
  const rad = (angle * Math.PI) / 180;
  
  const dirX = Math.cos(rad), dirY = Math.sin(rad); // Line direction
  const perpX = -Math.sin(rad), perpY = Math.cos(rad); // Scan direction

  // 3. Determine Scan Range (Project shape onto perpendicular axis)
  let minP = Infinity, maxP = -Infinity;
  outline.forEach(p => {
    const val = p.x * perpX + p.y * perpY;
    minP = Math.min(minP, val);
    maxP = Math.max(maxP, val);
  });

  // Safety check: if shape has no extent in scan direction, return empty
  if (minP >= maxP || !isFinite(minP) || !isFinite(maxP)) {
    return [];
  }

  // Calculate shape center for scan line construction
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  
  // Calculate the center's projection along the perpendicular axis
  const centerProj = centerX * perpX + centerY * perpY;

  // Calculate gradient direction if gradient is enabled
  let gradientDirX = 0, gradientDirY = 0;
  let gradientMinProj = Infinity, gradientMaxProj = -Infinity;
  if (params.gradientEnabled) {
    const gradientAngle = params.gradientAngle ?? 90;
    const gradientRad = (gradientAngle * Math.PI) / 180;
    gradientDirX = Math.cos(gradientRad);
    gradientDirY = Math.sin(gradientRad);
    
    // Project ALL points from ALL contours (main outline + holes) onto gradient direction
    // This ensures we capture the true extent of complex unioned shapes
    contours.forEach(contour => {
      contour.forEach(p => {
        const proj = p.x * gradientDirX + p.y * gradientDirY;
        gradientMinProj = Math.min(gradientMinProj, proj);
        gradientMaxProj = Math.max(gradientMaxProj, proj);
      });
    });
    
    // Also project bounding box corners as a safety net
    // This ensures we capture the full extent even for very complex geometries
    const bboxCorners = [
      { x: minX, y: minY }, // Top-left
      { x: maxX, y: minY }, // Top-right
      { x: maxX, y: maxY }, // Bottom-right
      { x: minX, y: maxY }  // Bottom-left
    ];
    
    bboxCorners.forEach(corner => {
      const proj = corner.x * gradientDirX + corner.y * gradientDirY;
      gradientMinProj = Math.min(gradientMinProj, proj);
      gradientMaxProj = Math.max(gradientMaxProj, proj);
    });
    
    // Safety check: if shape has no extent in gradient direction, use default bounds
    if (!isFinite(gradientMinProj) || !isFinite(gradientMaxProj) || gradientMinProj >= gradientMaxProj) {
      gradientMinProj = 0;
      gradientMaxProj = 1;
    }
  }

  // Store segments for zig-zag connection
  const segments: { start: Point; end: Point }[] = [];
  let currentPos = minP + params.offset;
  
  // 4. Raycast Scan
  // We march along the perpendicular axis, casting rays across the shape
  while (currentPos <= maxP) {
     // Find a point on the scan line at distance currentPos along the perpendicular axis
     // The scan line equation: x*perpX + y*perpY = currentPos
     // We start from the bounding box center and move along the perpendicular direction
     // to reach the correct projection value
     const delta = currentPos - centerProj;
     const origin = { 
       x: centerX + delta * perpX, 
       y: centerY + delta * perpY 
     };
     
     // Construct a line segment that is definitely longer than the shape
     const p1 = { x: origin.x - dirX * diag, y: origin.y - dirY * diag };
     const p2 = { x: origin.x + dirX * diag, y: origin.y + dirY * diag };

     const hits: { t: number, p: Point }[] = [];

     // Intersect ray with ALL contours (outline + holes)
     contours.forEach(poly => {
        for (let i = 0; i < poly.length; i++) {
           const a = poly[i];
           const b = poly[(i+1) % poly.length];
           
           const hit = intersect(p1, p2, a, b);
           if (hit) {
              // Store distance 't' along the ray for sorting
              const t = (hit.x - p1.x)*dirX + (hit.y - p1.y)*dirY;
              hits.push({ t, p: hit });
           }
        }
     });

     // Sort hits by distance along the ray
     hits.sort((a, b) => a.t - b.t);

     // Connect pairs: (Enter, Exit), (Enter Hole, Exit Hole)... 
     // Even-odd rule naturally handles holes if we just connect pairs.
     for (let i = 0; i < hits.length - 1; i += 2) {
        const start = hits[i].p;
        const end = hits[i+1].p;
        
        // Filter out tiny segments (< 0.1mm) to clean up output
        if (Math.hypot(end.x - start.x, end.y - start.y) > 0.1) {
           segments.push({ start, end });
        }
     }
     
     // Increment Position (Linear or Gradient)
     let step = params.density;
     if (params.gradientEnabled) {
       // Project the scan line origin onto the gradient direction
       const gradientProj = origin.x * gradientDirX + origin.y * gradientDirY;
       // Calculate progress along gradient direction (0 to 1)
       const progress = gradientMaxProj > gradientMinProj 
         ? (gradientProj - gradientMinProj) / (gradientMaxProj - gradientMinProj)
         : 0;
       const cleanProgress = Math.max(0, Math.min(1, progress));
       step = params.gradientStart + (params.gradientEnd - params.gradientStart) * cleanProgress;
     }
     
     // Safety: prevent infinite loops if step is 0 or negative
     currentPos += Math.max(0.1, step);
  }

  // 5. Generate output: either zig-zag connected or individual segments
  if (params.zigZagEnabled && segments.length > 0) {
    // Connect segments in zig-zag pattern
    let path = `M ${segments[0].start.x.toFixed(2)} ${segments[0].start.y.toFixed(2)}`;
    let currentPoint = segments[0].end;
    path += ` L ${currentPoint.x.toFixed(2)} ${currentPoint.y.toFixed(2)}`;
    
    // Connect remaining segments, alternating which end to use
    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];
      // Find which end is closer to current point
      const distToStart = Math.hypot(seg.start.x - currentPoint.x, seg.start.y - currentPoint.y);
      const distToEnd = Math.hypot(seg.end.x - currentPoint.x, seg.end.y - currentPoint.y);
      
      if (distToStart < distToEnd) {
        // Connect to start, then draw to end
        path += ` L ${seg.start.x.toFixed(2)} ${seg.start.y.toFixed(2)}`;
        currentPoint = seg.end;
        path += ` L ${currentPoint.x.toFixed(2)} ${currentPoint.y.toFixed(2)}`;
      } else {
        // Connect to end, then draw to start (reverse)
        path += ` L ${seg.end.x.toFixed(2)} ${seg.end.y.toFixed(2)}`;
        currentPoint = seg.start;
        path += ` L ${currentPoint.x.toFixed(2)} ${currentPoint.y.toFixed(2)}`;
      }
    }
    
    return [path];
  } else {
    // Return individual segments as separate paths
    return segments.map(seg => 
      `M ${seg.start.x.toFixed(2)} ${seg.start.y.toFixed(2)} L ${seg.end.x.toFixed(2)} ${seg.end.y.toFixed(2)}`
    );
  }
}

export function generateAllHatchLines(shape: Shape, params: HatchParams): string[] {
   const pass1 = generateHatchLines(shape, params);
   
   if (params.crossHatchEnabled) {
      const angle2 = params.crossHatchPerpendicular ? params.angle + 90 : params.crossHatchAngle;
      // Pass 2: Clone params but change angle
      const pass2 = generateHatchLines(shape, { ...params, angle: angle2 });
      return [...pass1, ...pass2];
   }
   
   return pass1;
}



