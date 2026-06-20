/* ============================================================
   PROJECTION SYSTEM
   Converts 3D coordinates to 2D view (isometric or perspective)
============================================================ */

import { ISO_ANGLE } from './constants.js';

export function projectToIsometric(x, y, z) {
  // Standard isometric projection
  // Z is up, Y is forward/back, X is left/right
  // In SVG, Y increases downward, so we need to flip the Y coordinate
  // so that higher Z values (up) appear higher on screen
  const isoX = (x - y) * Math.cos(ISO_ANGLE);
  const isoY = -(z + (x + y) * Math.sin(ISO_ANGLE)); // Negate Y so Z-up appears correctly
  return { x: isoX, y: isoY };
}

export function projectToPerspective(x, y, z, fov, cameraDistance) {
  // Simple perspective projection that maintains isometric-like viewing angle
  // but adds depth-based scaling
  
  // First, apply the same isometric rotation as the isometric projection
  // This gives us the same viewing angle
  const isoX = (x - y) * Math.cos(ISO_ANGLE);
  const isoY = (z + (x + y) * Math.sin(ISO_ANGLE));
  
  // Calculate depth: distance from camera to the point
  // Camera is conceptually at (0, 0, cameraDistance) looking down
  // Points further from camera (larger Y + smaller Z) should be smaller
  const depthOffset = (x + y) * 0.3 - z * 0.5;  // Depth along viewing direction
  const depth = cameraDistance + depthOffset;
  
  // Prevent division by zero - ensure depth is always positive
  const safeDepth = Math.max(depth, 1);
  
  // Apply perspective: scale = fov / depth
  // Points further away (larger depth) get scaled down more
  const perspectiveScale = fov / safeDepth;
  
  // Apply perspective scaling to the isometric coordinates
  const projX = isoX * perspectiveScale;
  const projY = -isoY * perspectiveScale; // Negate for SVG coordinates (Y down)
  
  return { x: projX, y: projY };
}

export function project3DTo2D(x, y, z, viewMode, perspectiveStrength) {
  // Unified projection function that handles both isometric and perspective
  if (viewMode === 'isometric') {
    return projectToIsometric(x, y, z);
  } else {
    // Perspective mode
    // Map perspectiveStrength (0-4) to FOV and camera distance
    // 0 = minimal perspective (almost isometric)
    // 4 = maximum perspective (strong vanishing point)
    
    // FOV controls the overall scale/zoom
    // Higher FOV = larger image
    // Range: 150 to 250 (moderate variation to keep cube visible)
    const fov = 150 + (perspectiveStrength * 25);
    
    // Camera distance: affects perspective strength
    // Further camera = weaker perspective (more parallel lines)
    // Closer camera = stronger perspective (more converging lines)
    // Range: 400 (far, weak) to 200 (close, strong)
    const cameraDistance = 400 - (perspectiveStrength * 50);
    
    return projectToPerspective(x, y, z, fov, cameraDistance);
  }
}



