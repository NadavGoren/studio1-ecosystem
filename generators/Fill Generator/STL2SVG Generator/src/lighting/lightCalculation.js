/* ============================================================
   LIGHTING CALCULATION
   Basic lighting calculations for 3D rendering
============================================================ */

/**
 * Calculate light direction vector from angle and elevation
 * @param {Number} angle - Azimuth angle in degrees (rotation around Z-axis)
 * @param {Number} elevation - Elevation angle in degrees (0 = horizontal, 90 = straight down)
 * @returns {Object} Light direction vector {x, y, z} pointing FROM light source TO scene
 */
export function calculateLightDirection(angle, elevation) {
  // Light rotates around Z-axis (vertical axis)
  // angle (azimuth) = rotation around Z-axis (0-360°)
  // elevation = angle from horizontal (0 = horizontal, 90 = straight down)
  
  const angleRad = angle * Math.PI / 180;
  const elevRad = elevation * Math.PI / 180;
  
  // Z is up, so light direction in Z-up coordinate system
  // Rotate around Z-axis: angle controls X-Y plane direction
  // elevation controls how high/low the light is
  // elevation 0 = horizontal light, 90 = straight down
  
  // Light direction vector (pointing FROM light source TO scene)
  // Rotating around Z-axis means:
  // - X component: cos(elevation) * cos(angle) - horizontal component in X direction
  // - Y component: cos(elevation) * sin(angle) - horizontal component in Y direction  
  // - Z component: -sin(elevation) - vertical component (negative = pointing down)
  return {
    x: Math.cos(elevRad) * Math.cos(angleRad),  // X component (rotates around Z)
    y: Math.cos(elevRad) * Math.sin(angleRad),  // Y component (rotates around Z)
    z: -Math.sin(elevRad)  // Z component (negative = downward, Z is up)
  };
}

/**
 * Calculate shading value for a face based on light direction
 * @param {Object} faceNormal - {x, y, z} face normal vector
 * @param {Object} lightDir - {x, y, z} light direction (FROM light source TO scene)
 * @param {Number} brightness - Light brightness (0 = no light, 1 = full light, >1 = brighter)
 * @param {Number} ambient - Ambient light level (0-1)
 * @returns {Number} Shading value (0 = fully dark, 1 = fully lit)
 */
export function calculateShading(faceNormal, lightDir, brightness, ambient) {
  // Normalize face normal
  const normalLen = Math.sqrt(faceNormal.x ** 2 + faceNormal.y ** 2 + faceNormal.z ** 2);
  if (normalLen < 1e-6) return ambient;
  
  const normal = {
    x: faceNormal.x / normalLen,
    y: faceNormal.y / normalLen,
    z: faceNormal.z / normalLen
  };
  
  // Normalize light direction
  const lightLen = Math.sqrt(lightDir.x ** 2 + lightDir.y ** 2 + lightDir.z ** 2);
  if (lightLen < 1e-6) return ambient;
  
  // Light direction is FROM light source TO scene
  // For lighting calculation, we need direction FROM scene TO light source
  // So we negate it
  const light = {
    x: -lightDir.x / lightLen,  // Negate: direction TO light source
    y: -lightDir.y / lightLen,
    z: -lightDir.z / lightLen
  };
  
  // Dot product: cosine of angle between normal and direction to light
  // Range: -1 (opposite) to 1 (same direction)
  // Positive = face is facing the light, negative = face is away from light
  const dot = normal.x * light.x + normal.y * light.y + normal.z * light.z;
  
  // Clamp to [0, 1] - negative means face is away from light (back-facing)
  const clampedDot = Math.max(0, dot);
  
  // Diffuse lighting: how much light hits the face
  // brightness scales the intensity (0 = no light, 1 = full light, >1 = brighter)
  const diffuse = clampedDot * Math.max(0, brightness);
  
  // Combine ambient and diffuse
  // ambient: base light level (0-1)
  // diffuse: directional light contribution
  // Result: 0 = fully dark, 1 = fully lit
  const shading = Math.min(1, Math.max(0, ambient + (1 - ambient) * diffuse));
  
  return shading;
}



