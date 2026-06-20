/* ============================================================
   GRADIENT SHADING SYSTEM
   Advanced gradient shading using key points and interpolation
============================================================ */

import { calculateShading, calculateLightDirection } from './lightCalculation.js';

/**
 * Calculate shading at key points based on light direction
 * Uses 5 points: 4 corners + center
 * @param {Array} vertices2D - Array of {x, y} points (polygon vertices)
 * @param {Array} vertices3D - Array of {x, y, z} points (3D positions, optional)
 * @param {Object} faceNormal - {x, y, z} face normal (for faces) or null (for shadow)
 * @param {Object} lightDir - {x, y, z} light direction
 * @param {Number} brightness - Light brightness
 * @param {Number} ambient - Ambient light level
 * @returns {Array} Array of {point: {x, y}, shading: number} for each key point
 */
export function calculateKeyPointShadings(vertices2D, vertices3D, faceNormal, lightDir, brightness, ambient) {
  const keyPoints = [];
  
  // Calculate center point
  const center2D = {
    x: vertices2D.reduce((sum, p) => sum + p.x, 0) / vertices2D.length,
    y: vertices2D.reduce((sum, p) => sum + p.y, 0) / vertices2D.length
  };
  
  // Get 4 corner points (or use all vertices if less than 4)
  const corners = vertices2D.length >= 4 
    ? [vertices2D[0], vertices2D[Math.floor(vertices2D.length * 0.25)], 
       vertices2D[Math.floor(vertices2D.length * 0.5)], vertices2D[Math.floor(vertices2D.length * 0.75)]]
    : vertices2D;
  
  // Calculate center 3D position if available
  let center3D = null;
  if (vertices3D && vertices3D.length > 0) {
    center3D = {
      x: vertices3D.reduce((sum, p) => sum + p.x, 0) / vertices3D.length,
      y: vertices3D.reduce((sum, p) => sum + p.y, 0) / vertices3D.length,
      z: vertices3D.reduce((sum, p) => sum + p.z, 0) / vertices3D.length
    };
  }
  
  // Calculate shading for each key point
  const allPoints = [...corners, center2D];
  
  for (const point2D of allPoints) {
    let shading;
    
    if (faceNormal) {
      // For cube faces: use face normal and calculate based on light direction
      shading = calculateShading(faceNormal, lightDir, brightness, ambient);
      
      // Add gradient based on distance from light source
      // Points closer to light (in light direction) are brighter
      if (center3D) {
        // Calculate vector from center to this point
        const pointIndex = corners.indexOf(point2D);
        let point3D = center3D;
        if (pointIndex >= 0 && vertices3D && pointIndex < vertices3D.length) {
          point3D = vertices3D[pointIndex];
        }
        
        // Vector from center to point
        const toPoint = {
          x: point3D.x - center3D.x,
          y: point3D.y - center3D.y,
          z: point3D.z - center3D.z
        };
        
        // Project light direction onto face plane
        const lightLen = Math.sqrt(lightDir.x ** 2 + lightDir.y ** 2 + lightDir.z ** 2);
        if (lightLen > 1e-6) {
          const normalizedLight = {
            x: lightDir.x / lightLen,
            y: lightDir.y / lightLen,
            z: lightDir.z / lightLen
          };
          
          // Dot product: how much this point is in the light direction
          const dot = (toPoint.x * normalizedLight.x + toPoint.y * normalizedLight.y + toPoint.z * normalizedLight.z);
          
          // Points in light direction get brighter, points away get darker
          // Use gentler gradient adjustment for smoother transitions
          const gradientAdjustment = dot * 0.08; // Very gentle gradient
          shading = Math.max(0, Math.min(1, shading + gradientAdjustment));
        }
      }
    } else {
      // For shadow: calculate based on distance from contact point
      // This will be handled by the interpolation function
      shading = 0.5; // Default, will be adjusted
    }
    
    keyPoints.push({ point: point2D, shading });
  }
  
  return keyPoints;
}

/**
 * Interpolate shading at any point using barycentric interpolation from key points
 * @param {Object} point - {x, y} point to calculate shading for
 * @param {Array} keyPoints - Array of {point: {x, y}, shading: number}
 * @returns {Number} Interpolated shading value (0-1)
 */
export function interpolateShading(point, keyPoints) {
  if (keyPoints.length === 0) return 0.5;
  if (keyPoints.length === 1) return keyPoints[0].shading;
  
  // Find the 3 closest key points for barycentric interpolation
  const distances = keyPoints.map(kp => ({
    point: kp.point,
    shading: kp.shading,
    dist: Math.hypot(point.x - kp.point.x, point.y - kp.point.y)
  }));
  
  distances.sort((a, b) => a.dist - b.dist);
  
  // Use closest 3 points
  const p1 = distances[0];
  const p2 = distances[1];
  const p3 = distances[2] || distances[0]; // Fallback if less than 3 points
  
  // Barycentric interpolation
  const d1 = p1.dist;
  const d2 = p2.dist;
  const d3 = p3.dist;
  
  // Avoid division by zero
  if (d1 < 1e-6) return p1.shading;
  if (d2 < 1e-6) return p2.shading;
  if (d3 < 1e-6) return p3.shading;
  
  // Weighted average based on inverse distance
  const w1 = 1 / (d1 + 0.1);
  const w2 = 1 / (d2 + 0.1);
  const w3 = 1 / (d3 + 0.1);
  const totalWeight = w1 + w2 + w3;
  
  const shading = (p1.shading * w1 + p2.shading * w2 + p3.shading * w3) / totalWeight;
  
  return Math.max(0, Math.min(1, shading));
}

/**
 * Unified gradient shading calculation - works for both faces and shadow
 * @param {Object} point2D - {x, y} point in 2D screen space
 * @param {Array} vertices2D - Array of {x, y} points (polygon vertices)
 * @param {Array} vertices3D - Array of {x, y, z} points (3D positions, optional)
 * @param {Object} faceNormal - {x, y, z} face normal (for faces) or null (for shadow)
 * @param {Object} lightDir - {x, y, z} light direction
 * @param {Number} brightness - Light brightness
 * @param {Number} ambient - Ambient light level
 * @param {Object} contactPoint2D - {x, y} contact point for shadow (optional)
 * @param {Number} falloff - Shadow falloff strength (2.0 = moderate/balanced, 10.0 = very soft/gradual)
 * @returns {Number} Shading value (0 = dark, 1 = light)
 */
export function calculateUnifiedGradient(point2D, vertices2D, vertices3D, faceNormal, lightDir, brightness, ambient, contactPoint2D = null, falloff = 2.0) {
  // Calculate key point shadings
  const keyPoints = calculateKeyPointShadings(vertices2D, vertices3D, faceNormal, lightDir, brightness, ambient);
  
  // For shadow, adjust based on distance from contact point
  if (!faceNormal && contactPoint2D) {
    // Shadow gradient: darker near contact, lighter at edges
    const distFromContact = Math.hypot(point2D.x - contactPoint2D.x, point2D.y - contactPoint2D.y);
    
    // Calculate max distance from contact to edge
    let maxDist = 0;
    vertices2D.forEach(v => {
      const dist = Math.hypot(v.x - contactPoint2D.x, v.y - contactPoint2D.y);
      maxDist = Math.max(maxDist, dist);
    });
    
    // Normalize distance (0 = at contact, 1 = at edge)
    const normalizedDist = maxDist > 0 ? Math.min(1, distFromContact / maxDist) : 0;
    
    // Apply falloff using power function for smooth gradient
    // Lower falloff (2.0) = moderate transition
    // Higher falloff (10.0) = very soft, gradual transition
    // Map falloff 2.0-10.0 to exponent range that produces smooth results
    // Using inverse relationship: higher falloff = lower exponent = softer gradient
    const exponent = 1.0 / (falloff * 0.25); // Maps 2.0->2.0, 6.0->0.67, 10.0->0.4
    const falloffDist = Math.pow(normalizedDist, exponent);
    
    // Gentle gradient: contact is dark (0.3), edges are light (0.8)
    const shadowShading = 0.3 + (0.5 * falloffDist); // Smooth range: 0.3 to 0.8
    
    // Blend with key point shading
    const baseShading = interpolateShading(point2D, keyPoints);
    return baseShading * 0.4 + shadowShading * 0.6; // Balanced blend
  }
  
  // For faces: use interpolated shading from key points with falloff
  // Apply subtle falloff to face gradients as well
  const baseShading = interpolateShading(point2D, keyPoints);
  
  // For faces, apply gentler falloff effect based on gradient variation
  if (faceNormal && vertices3D) {
    // Calculate how much the shading varies across the face
    const shadingValues = keyPoints.map(kp => kp.shading);
    const minShading = Math.min(...shadingValues);
    const maxShading = Math.max(...shadingValues);
    const shadingRange = maxShading - minShading;
    
    // Only apply falloff if there's significant variation (gradient)
    if (shadingRange > 0.1) {
      // Normalize current shading within the range
      const normalizedShading = (baseShading - minShading) / shadingRange;
      
      // Apply falloff (gentler for faces)
      // Use inverse relationship for smooth face gradients
      const faceExponent = 1.0 / (falloff * 0.35); // Gentler effect on faces
      const falloffShading = Math.pow(normalizedShading, faceExponent);
      
      // Map back to original range
      return minShading + (falloffShading * shadingRange);
    }
  }
  
  return baseShading;
}

/**
 * Calculate gradient shading for a point on a face (now uses unified system)
 * @param {Object} point2D - {x, y} point in 2D screen space
 * @param {Array} faceVertices2D - Array of {x, y} points representing face in 2D
 * @param {Array} faceVertices3D - Array of {x, y, z} points representing face in 3D
 * @param {Object} faceNormal - {x, y, z} face normal vector
 * @param {Object} lightDir - {x, y, z} light direction
 * @param {Number} brightness - Light brightness
 * @param {Number} ambient - Ambient light level
 * @param {Number} falloff - Shadow falloff strength (2.0 = moderate/balanced, 10.0 = very soft/gradual)
 * @returns {Number} Shading value (0 = dark, 1 = light)
 */
export function calculateFaceGradientShading(point2D, faceVertices2D, faceVertices3D, faceNormal, lightDir, brightness, ambient, falloff = 2.0) {
  // Use unified gradient calculation
  return calculateUnifiedGradient(
    point2D,
    faceVertices2D,
    faceVertices3D,
    faceNormal,
    lightDir,
    brightness,
    ambient,
    null, // No contact point for faces
    falloff
  );
}

/**
 * Calculate gradient shading value for a point in the shadow (legacy function, now uses unified system)
 * @param {Object} point - {x, y} point in shadow (2D screen coordinates)
 * @param {Array} cubeBottomFace2D - Array of {x, y} points representing cube bottom face
 * @param {Array} shadowPolygon - Array of {x, y} points representing shadow polygon
 * @param {Number} lightAngle - Light angle in degrees
 * @param {Number} lightElevation - Light elevation in degrees (0-90)
 * @param {Number} lightBrightness - Light brightness
 * @param {Number} ambientLight - Ambient light level
 * @param {Number} falloff - Shadow falloff strength (2.0 = moderate/balanced, 10.0 = very soft/gradual)
 * @returns {Number} Shading value (0 = darkest/contact, 1 = lightest/edge)
 */
export function calculateShadowGradient(point, cubeBottomFace2D, shadowPolygon, lightAngle, lightElevation, lightBrightness, ambientLight, falloff = 2.0) {
  // Use unified gradient system
  const contactPoint = {
    x: cubeBottomFace2D.reduce((sum, p) => sum + p.x, 0) / cubeBottomFace2D.length,
    y: cubeBottomFace2D.reduce((sum, p) => sum + p.y, 0) / cubeBottomFace2D.length
  };
  
  // Calculate light direction (we need it for unified system)
  const lightDir = calculateLightDirection(lightAngle, lightElevation);
  
  // Use unified gradient calculation with falloff
  return calculateUnifiedGradient(
    point,
    shadowPolygon,
    null, // No 3D vertices for shadow
    null, // No face normal for shadow
    lightDir,
    lightBrightness,
    ambientLight,
    contactPoint,
    falloff
  );
}

