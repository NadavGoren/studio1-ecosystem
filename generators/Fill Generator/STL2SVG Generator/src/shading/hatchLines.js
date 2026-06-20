/* ============================================================
   HATCH LINE GENERATION
   Generate hatch lines for shading polygons
============================================================ */

import { pointInPolygon } from '../core/geometry.js';

/**
 * Generate hatch lines for a polygon with uniform spacing based on shading
 * @param {Array} polygon - Array of {x, y} points representing the polygon
 * @param {Number} shading - Shading value (0 = dark, 1 = light)
 * @param {Number} spacing - Maximum spacing between lines (mm)
 * @param {Number} minSpacing - Minimum spacing for dark areas (mm)
 * @param {Number} angle - Hatch angle in degrees
 * @param {Object} bounds - Bounding box {x0, y0, x1, y1}
 * @returns {Array} Array of line objects {x1, y1, x2, y2}
 */
export function generateHatchLines(polygon, shading, spacing, minSpacing, angle, bounds) {
  const lines = [];
  
  // Validate inputs
  if (polygon.length < 3) return [];
  if (spacing <= 0 || minSpacing <= 0) return [];
  if (minSpacing > spacing) return []; // Invalid range
  
  // Calculate density based on shading
  // Shading: 0 = fully dark, 1 = fully lit
  // Density: 0 = fully lit (few lines), 1 = fully dark (many lines)
  // Simple linear mapping - no curves, clean and predictable
  const density = Math.max(0, Math.min(1, 1 - shading));
  
  // Calculate local spacing based on density
  // When density = 0 (fully lit): use max spacing
  // When density = 1 (fully dark): use min spacing
  const localSpacing = minSpacing + (spacing - minSpacing) * (1 - density);
  
  // Ensure valid spacing
  if (localSpacing <= 0) return [];
  
  // Hatch direction
  const angleRad = angle * Math.PI / 180;
  const dx = Math.cos(angleRad);
  const dy = Math.sin(angleRad);
  
  // Perpendicular direction for spacing
  const perpX = -dy;
  const perpY = dx;
  
  // Project polygon vertices onto perpendicular direction
  const projMin = polygon.reduce((min, p) => {
    const proj = p.x * perpX + p.y * perpY;
    return Math.min(min, proj);
  }, Infinity);
  
  const projMax = polygon.reduce((max, p) => {
    const proj = p.x * perpX + p.y * perpY;
    return Math.max(max, proj);
  }, -Infinity);
  
  // Extend the range to ensure full coverage at edges
  // This prevents gaps at polygon boundaries due to numerical precision
  const COVERAGE_PADDING = localSpacing * 0.15; // Minimal padding - just enough for precision
  const extendedMin = projMin - COVERAGE_PADDING;
  const extendedMax = projMax + COVERAGE_PADDING;
  
  // Generate hatch lines with extended range
  // Add extra lines to ensure coverage at boundaries
  const numLines = Math.ceil((extendedMax - extendedMin) / localSpacing) + 1;
  
  for (let i = 0; i <= numLines; i++) {
    const offset = extendedMin + i * localSpacing;
    
    // Find intersections with polygon edges using ray casting
    const intersections = [];
    
    for (let j = 0; j < polygon.length; j++) {
      const p1 = polygon[j];
      const p2 = polygon[(j + 1) % polygon.length];
      
      // Edge vector
      const edgeDx = p2.x - p1.x;
      const edgeDy = p2.y - p1.y;
      
      // Project edge endpoints onto perpendicular direction
      const proj1 = p1.x * perpX + p1.y * perpY;
      const proj2 = p2.x * perpX + p2.y * perpY;
      
      // Check if offset is between proj1 and proj2
      // Very tight tolerance for precision
      const EDGE_TOLERANCE = 0.001; // Fixed 0.001mm tolerance
      const minProj = Math.min(proj1, proj2) - EDGE_TOLERANCE;
      const maxProj = Math.max(proj1, proj2) + EDGE_TOLERANCE;
      
      if (offset >= minProj && offset <= maxProj) {
        // Calculate intersection point
        const denom = proj2 - proj1;
        if (Math.abs(denom) > 1e-10) { // Tight denominator check for precision
          const t = (offset - proj1) / denom;
          // Clamp t to [0, 1] to ensure point is exactly on edge
          const tClamped = Math.max(0, Math.min(1, t));
          const ix = p1.x + tClamped * edgeDx;
          const iy = p1.y + tClamped * edgeDy;
          intersections.push({ x: ix, y: iy });
        }
      }
    }
    
    // Remove duplicate intersections (within tolerance)
    // Use a very tight tolerance to avoid merging valid edge intersections
    const uniqueIntersections = [];
    const DUPLICATE_TOLERANCE = 0.001; // mm - very tight tolerance for maximum precision
    intersections.forEach(p => {
      const isDuplicate = uniqueIntersections.some(existing => {
        const dx = existing.x - p.x;
        const dy = existing.y - p.y;
        return Math.sqrt(dx * dx + dy * dy) < DUPLICATE_TOLERANCE;
      });
      if (!isDuplicate) {
        uniqueIntersections.push(p);
      }
    });
    
    // Sort intersections along hatch line direction
    if (uniqueIntersections.length >= 2) {
      uniqueIntersections.sort((a, b) => {
        const aProj = a.x * dx + a.y * dy;
        const bProj = b.x * dx + b.y * dy;
        return aProj - bProj;
      });
      
      // Create line segments (every pair of intersections)
      for (let k = 0; k < uniqueIntersections.length - 1; k += 2) {
        const start = uniqueIntersections[k];
        const end = uniqueIntersections[k + 1];
        
        // NO extension - keep lines strictly within polygon boundaries
        // Occlusion will handle visibility, no need for aggressive extension
        const lineLen = Math.hypot(end.x - start.x, end.y - start.y);
        if (lineLen > 0.01) { // Minimum line length filter
          // Add line exactly as calculated (no extension)
          lines.push({
            x1: start.x,
            y1: start.y,
            x2: end.x,
            y2: end.y
          });
        }
      }
    }
  }
  
  return lines;
}

/**
 * Generate adaptive hatch lines with gradient-based spacing
 * This function calculates shading at each position and adjusts line spacing accordingly
 * @param {Array} polygon - Array of {x, y} points representing the polygon
 * @param {Number} baseSpacing - Base spacing between lines (mm)
 * @param {Number} minSpacing - Minimum spacing for dark areas (mm)
 * @param {Number} angle - Hatch angle in degrees
 * @param {Object} bounds - Bounding box {x0, y0, x1, y1}
 * @param {Function} calculateShading - Function(point2D) => shading (0-1)
 * @param {Boolean} crossHatch - Whether to generate perpendicular cross-hatch lines
 * @param {Number} crossHatchDensity - Cross-hatch density (0-1, where 1 = same density as primary)
 * @returns {Array} Array of line objects {x1, y1, x2, y2}
 */
export function generateAdaptiveHatchLines(polygon, baseSpacing, minSpacing, angle, bounds, calculateShading, crossHatch = false, crossHatchDensity = 1.0) {
  // Generate primary hatch lines
  const lines = generateAdaptiveHatchLinesForAngle(
    polygon,
    baseSpacing,
    minSpacing,
    angle,
    bounds,
    calculateShading
  );
  
  // Generate cross-hatch lines if enabled
  if (crossHatch && crossHatchDensity > 0) {
    // Perpendicular angle (90 degrees offset)
    const crossAngle = (angle + 90) % 180;
    
    // Adjust spacing for cross-hatch based on density
    // Density of 1.0 means same spacing as primary, 0.5 means twice the spacing
    const crossBaseSpacing = baseSpacing / crossHatchDensity;
    const crossMinSpacing = minSpacing / crossHatchDensity;
    
    // Generate cross-hatch lines using the same adaptive algorithm
    const crossLines = generateAdaptiveHatchLinesForAngle(
      polygon,
      crossBaseSpacing,
      crossMinSpacing,
      crossAngle,
      bounds,
      calculateShading
    );
    
    // Add cross-hatch lines to the result
    lines.push(...crossLines);
  }
  
  return lines;
}

/**
 * Helper function to generate adaptive hatch lines for a single angle
 * This avoids recursion when generating cross-hatch lines
 */
export function generateAdaptiveHatchLinesForAngle(polygon, baseSpacing, minSpacing, angle, bounds, calculateShading) {
  const lines = [];
  
  // Validate inputs
  if (polygon.length < 3) return [];
  if (baseSpacing <= 0 || minSpacing <= 0) return [];
  if (minSpacing > baseSpacing) return [];
  if (!calculateShading) return [];
  
  // Hatch direction
  const angleRad = angle * Math.PI / 180;
  const dx = Math.cos(angleRad);
  const dy = Math.sin(angleRad);
  
  // Perpendicular direction for spacing
  const perpX = -dy;
  const perpY = dx;
  
  // Project polygon vertices onto perpendicular direction
  const projMin = polygon.reduce((min, p) => {
    const proj = p.x * perpX + p.y * perpY;
    return Math.min(min, proj);
  }, Infinity);
  
  const projMax = polygon.reduce((max, p) => {
    const proj = p.x * perpX + p.y * perpY;
    return Math.max(max, proj);
  }, -Infinity);
  
  // Generate lines at fine resolution, then filter based on adaptive spacing
  const FINE_RESOLUTION = Math.min(minSpacing * 0.3, 0.3);
  const extendedMin = projMin - baseSpacing * 0.1;
  const extendedMax = projMax + baseSpacing * 0.1;
  
  // Generate candidate lines at fine resolution
  const candidateOffsets = [];
  for (let offset = extendedMin; offset <= extendedMax; offset += FINE_RESOLUTION) {
    candidateOffsets.push(offset);
  }
  
  // Generate lines adaptively based on shading
  let lastLineOffset = -Infinity;
  
  for (const currentOffset of candidateOffsets) {
    // Find a representative point on the hatch line at this offset
    let sampleX = 0, sampleY = 0;
    let foundSample = false;
    
    // Try to find intersection points to get a good sample
    const tempIntersections = [];
    for (let j = 0; j < polygon.length; j++) {
      const p1 = polygon[j];
      const p2 = polygon[(j + 1) % polygon.length];
      const edgeDx = p2.x - p1.x;
      const edgeDy = p2.y - p1.y;
      const proj1 = p1.x * perpX + p1.y * perpY;
      const proj2 = p2.x * perpX + p2.y * perpY;
      const EDGE_TOLERANCE = 0.001;
      const minProj = Math.min(proj1, proj2) - EDGE_TOLERANCE;
      const maxProj = Math.max(proj1, proj2) + EDGE_TOLERANCE;
      
      if (currentOffset >= minProj && currentOffset <= maxProj) {
        const denom = proj2 - proj1;
        if (Math.abs(denom) > 1e-10) {
          const t = (currentOffset - proj1) / denom;
          const tClamped = Math.max(0, Math.min(1, t));
          const ix = p1.x + tClamped * edgeDx;
          const iy = p1.y + tClamped * edgeDy;
          tempIntersections.push({ x: ix, y: iy });
        }
      }
    }
    
    // Use midpoint of intersections as sample point
    if (tempIntersections.length >= 2) {
      tempIntersections.sort((a, b) => {
        const aProj = a.x * dx + a.y * dy;
        const bProj = b.x * dx + b.y * dy;
        return aProj - bProj;
      });
      sampleX = (tempIntersections[0].x + tempIntersections[1].x) / 2;
      sampleY = (tempIntersections[0].y + tempIntersections[1].y) / 2;
      foundSample = true;
    } else if (tempIntersections.length === 1) {
      sampleX = tempIntersections[0].x;
      sampleY = tempIntersections[0].y;
      foundSample = true;
    } else {
      const centerX = polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length;
      const centerY = polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length;
      const centerProj = centerX * perpX + centerY * perpY;
      sampleX = centerX + (currentOffset - centerProj) * perpX;
      sampleY = centerY + (currentOffset - centerProj) * perpY;
      foundSample = pointInPolygon({ x: sampleX, y: sampleY }, polygon);
    }
    
    if (!foundSample) continue;
    
    // Calculate shading at this point
    const shading = calculateShading({ x: sampleX, y: sampleY });
    
    // Calculate required spacing based on shading
    const requiredSpacing = minSpacing + (baseSpacing - minSpacing) * shading;
    
    // Only generate line if we've moved far enough from the last line
    if (currentOffset - lastLineOffset >= requiredSpacing * 0.85) {
      // Find intersections with polygon edges
      const intersections = [];
      
      for (let j = 0; j < polygon.length; j++) {
        const p1 = polygon[j];
        const p2 = polygon[(j + 1) % polygon.length];
        const edgeDx = p2.x - p1.x;
        const edgeDy = p2.y - p1.y;
        const proj1 = p1.x * perpX + p1.y * perpY;
        const proj2 = p2.x * perpX + p2.y * perpY;
        const EDGE_TOLERANCE = 0.001;
        const minProj = Math.min(proj1, proj2) - EDGE_TOLERANCE;
        const maxProj = Math.max(proj1, proj2) + EDGE_TOLERANCE;
        
        if (currentOffset >= minProj && currentOffset <= maxProj) {
          const denom = proj2 - proj1;
          if (Math.abs(denom) > 1e-10) {
            const t = (currentOffset - proj1) / denom;
            const tClamped = Math.max(0, Math.min(1, t));
            const ix = p1.x + tClamped * edgeDx;
            const iy = p1.y + tClamped * edgeDy;
            intersections.push({ x: ix, y: iy });
          }
        }
      }
      
      // Remove duplicate intersections
      const uniqueIntersections = [];
      const DUPLICATE_TOLERANCE = 0.001;
      intersections.forEach(p => {
        const isDuplicate = uniqueIntersections.some(existing => {
          const dx = existing.x - p.x;
          const dy = existing.y - p.y;
          return Math.sqrt(dx * dx + dy * dy) < DUPLICATE_TOLERANCE;
        });
        if (!isDuplicate) {
          uniqueIntersections.push(p);
        }
      });
      
      // Sort intersections along hatch line direction
      if (uniqueIntersections.length >= 2) {
        uniqueIntersections.sort((a, b) => {
          const aProj = a.x * dx + a.y * dy;
          const bProj = b.x * dx + b.y * dy;
          return aProj - bProj;
        });
        
        // Create line segments (every pair of intersections)
        for (let k = 0; k < uniqueIntersections.length - 1; k += 2) {
          const start = uniqueIntersections[k];
          const end = uniqueIntersections[k + 1];
          const lineLen = Math.hypot(end.x - start.x, end.y - start.y);
          if (lineLen > 0.01) {
            lines.push({
              x1: start.x,
              y1: start.y,
              x2: end.x,
              y2: end.y
            });
          }
        }
      }
      
      lastLineOffset = currentOffset;
    }
  }
  
  return lines;
}



