/* ============================================================
   SHADOW PROJECTION
   Project shadows onto floor plane
============================================================ */

/**
 * Project vertices onto floor plane along light direction
 * @param {Array} vertices - Array of {x, y, z} points
 * @param {Object} lightDir - {x, y, z} light direction vector
 * @param {Number} floorZ - Z coordinate of floor plane
 * @returns {Array} Array of {x, y, z} shadow vertices on floor
 */
export function projectShadow(vertices, lightDir, floorZ) {
  // Project vertices onto floor plane (z = floorZ, since Z is up)
  // Floor is a fixed horizontal plane, independent of cube rotation
  // Using simple parallel projection along light direction
  const shadowVertices = [];
  
  // Maximum shadow distance to prevent infinite projections
  // When light is nearly horizontal, shadows can project to infinity
  const MAX_SHADOW_DISTANCE = 500; // mm - reasonable shadow projection limit
  
  for (const v of vertices) {
    // Find intersection of light ray with floor
    // Ray: v + t * lightDir, find t where z = floorZ
    // lightDir.z should be negative (pointing down) for shadows
    
    if (Math.abs(lightDir.z) < 1e-6) {
      // Light is horizontal - project vertically down to floor
      shadowVertices.push({
        x: v.x,
        y: v.y,
        z: floorZ
      });
      continue;
    }
    
    const t = (floorZ - v.z) / lightDir.z;
    
    // For downward light (lightDir.z < 0), t will be positive if v.z > floorZ
    // For vertices on floor (v.z = floorZ), t = 0, so they project to themselves
    // For vertices above floor, t > 0, project along light direction
    if (t >= 0 && t < MAX_SHADOW_DISTANCE) { // Clamp to reasonable distance
      const shadowX = v.x + t * lightDir.x;
      const shadowY = v.y + t * lightDir.y;
      
      // Additional check: ensure shadow point isn't absurdly far from original vertex
      const projectionDistance = Math.hypot(shadowX - v.x, shadowY - v.y);
      
      if (projectionDistance < MAX_SHADOW_DISTANCE) {
        shadowVertices.push({
          x: shadowX,
          y: shadowY,
          z: floorZ
        });
      } else {
        // Shadow projects too far - use clamped version
        const angle = Math.atan2(shadowY - v.y, shadowX - v.x);
        shadowVertices.push({
          x: v.x + Math.cos(angle) * MAX_SHADOW_DISTANCE,
          y: v.y + Math.sin(angle) * MAX_SHADOW_DISTANCE,
          z: floorZ
        });
      }
    } else if (t >= 0) {
      // t is too large - clamp shadow to maximum distance in light direction
      const normalizedT = MAX_SHADOW_DISTANCE;
      shadowVertices.push({
        x: v.x + normalizedT * lightDir.x,
        y: v.y + normalizedT * lightDir.y,
        z: floorZ
      });
    }
  }
  
  return shadowVertices;
}

