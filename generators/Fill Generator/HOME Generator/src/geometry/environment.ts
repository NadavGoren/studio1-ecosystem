import type { Point } from '../config/types';
import { pointsToPath, applyLineJitter, smoothLine, addRandomSlope, makeIrregularPolygon } from '../utils/math';
import type { SeededRNG } from '../utils/rng';
import { drawRect } from './primitives';

/**
 * Draws a more detailed dog with body, head, tail, legs, ears, and features
 * Positioned at anchor point (bottom center of dog)
 */
export function drawDogIcon(
  anchorX: number,
  anchorY: number,
  scaleMm: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  if (!rng) return paths;

  // Scale everything relative to scaleMm (base size ~10mm)
  const s = scaleMm / 10;

  // Body (elongated oval/rectangle with more detail)
  const bodyWidth = 8 * s;
  const bodyHeight = 5 * s;
  const bodyX = anchorX - bodyWidth / 2;
  const bodyY = anchorY - bodyHeight - 3 * s;

  // Body with rounded edges
  let bodyPoints: Point[] = [];
  const bodySegments = 16;
  for (let i = 0; i <= bodySegments; i++) {
    const t = i / bodySegments;
    const angle = t * Math.PI * 2;
    const radiusX = bodyWidth / 2;
    const radiusY = bodyHeight / 2;
    bodyPoints.push({
      x: bodyX + bodyWidth / 2 + radiusX * Math.cos(angle),
      y: bodyY + bodyHeight / 2 + radiusY * Math.sin(angle)
    });
  }

  // Head (more detailed circle with snout)
  const headRadius = 2.5 * s;
  const headX = bodyX - headRadius * 0.5;
  const headY = bodyY + bodyHeight / 2;
  
  let headPoints: Point[] = [];
  const segments = 16;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    headPoints.push({
      x: headX + headRadius * Math.cos(angle),
      y: headY + headRadius * Math.sin(angle)
    });
  }

  // Snout (protruding from head)
  const snoutLength = headRadius * 0.8;
  const snoutWidth = headRadius * 0.6;
  const snoutX = headX - headRadius;
  const snoutY = headY;
  
  let snoutPoints: Point[] = [
    { x: snoutX, y: snoutY },
    { x: snoutX - snoutLength, y: snoutY - snoutWidth * 0.3 },
    { x: snoutX - snoutLength, y: snoutY + snoutWidth * 0.3 },
    { x: snoutX, y: snoutY }
  ];

  // Ears (floppy or pointy)
  const earStyle = rng.randomInt(0, 2);
  const earSize = headRadius * 0.6;
  
  // Left ear
  const leftEarX = headX - headRadius * 0.7;
  const leftEarY = headY - headRadius * 0.5;
  let leftEarPoints: Point[] = [];
  
  if (earStyle === 0) {
    // Floppy ear
    leftEarPoints = [
      { x: leftEarX, y: leftEarY },
      { x: leftEarX - earSize * 0.5, y: leftEarY - earSize },
      { x: leftEarX - earSize * 0.3, y: leftEarY - earSize * 0.7 },
      { x: leftEarX, y: leftEarY }
    ];
  } else {
    // Pointy ear
    leftEarPoints = [
      { x: leftEarX, y: leftEarY },
      { x: leftEarX - earSize * 0.3, y: leftEarY - earSize },
      { x: leftEarX, y: leftEarY }
    ];
  }
  
  // Right ear
  const rightEarX = headX + headRadius * 0.7;
  const rightEarY = headY - headRadius * 0.5;
  let rightEarPoints: Point[] = [];
  
  if (earStyle === 0) {
    rightEarPoints = [
      { x: rightEarX, y: rightEarY },
      { x: rightEarX + earSize * 0.5, y: rightEarY - earSize },
      { x: rightEarX + earSize * 0.3, y: rightEarY - earSize * 0.7 },
      { x: rightEarX, y: rightEarY }
    ];
  } else {
    rightEarPoints = [
      { x: rightEarX, y: rightEarY },
      { x: rightEarX + earSize * 0.3, y: rightEarY - earSize },
      { x: rightEarX, y: rightEarY }
    ];
  }

  // Eyes
  const eyeSize = headRadius * 0.15;
  const leftEyeX = headX - headRadius * 0.3;
  const rightEyeX = headX + headRadius * 0.3;
  const eyeY = headY - headRadius * 0.2;
  
  const leftEyePoints: Point[] = [];
  const rightEyePoints: Point[] = [];
  for (let i = 0; i <= 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    leftEyePoints.push({
      x: leftEyeX + eyeSize * Math.cos(angle),
      y: eyeY + eyeSize * Math.sin(angle)
    });
    rightEyePoints.push({
      x: rightEyeX + eyeSize * Math.cos(angle),
      y: eyeY + eyeSize * Math.sin(angle)
    });
  }

  // Nose (small triangle on snout)
  const noseX = snoutX - snoutLength;
  const nosePoints: Point[] = [
    { x: noseX, y: snoutY - snoutWidth * 0.15 },
    { x: noseX - snoutLength * 0.2, y: snoutY },
    { x: noseX, y: snoutY + snoutWidth * 0.15 },
    { x: noseX, y: snoutY - snoutWidth * 0.15 }
  ];

  // Tail (curved with more detail)
  let tailPoints: Point[] = [
    { x: bodyX + bodyWidth, y: bodyY + bodyHeight / 2 },
    { x: bodyX + bodyWidth + 2 * s, y: bodyY },
    { x: bodyX + bodyWidth + 3.5 * s, y: bodyY - 1.5 * s },
    { x: bodyX + bodyWidth + 4 * s, y: bodyY - 0.5 * s }
  ];

  // Legs (more detailed with paws)
  const legHeight = 3 * s;
  const legWidth = 1.2 * s;
  const legs: Point[][] = [];
  
  const legPositions = [
    { x: bodyX + 1.5 * s, side: -1 },
    { x: bodyX + 3.5 * s, side: -1 },
    { x: bodyX + bodyWidth - 3.5 * s, side: 1 },
    { x: bodyX + bodyWidth - 1.5 * s, side: 1 }
  ];
  
  for (const legPos of legPositions) {
    // Leg line
    const legLine: Point[] = [
      { x: legPos.x, y: bodyY + bodyHeight },
      { x: legPos.x, y: anchorY }
    ];
    legs.push(legLine);
    
    // Paw (small oval at bottom)
    const pawSize = legWidth * 0.8;
    const pawPoints: Point[] = [];
    for (let i = 0; i <= 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      pawPoints.push({
        x: legPos.x + pawSize * Math.cos(angle),
        y: anchorY + pawSize * 0.6 * Math.sin(angle)
      });
    }
    legs.push(pawPoints);
  }

  // Apply jitter if specified
  if (jitterMm > 0) {
    bodyPoints = applyLineJitter(bodyPoints, jitterMm, rng, true);
    headPoints = applyLineJitter(headPoints, jitterMm * 0.8, rng, true);
    snoutPoints = applyLineJitter(snoutPoints, jitterMm * 0.6, rng, true);
    leftEarPoints = applyLineJitter(leftEarPoints, jitterMm * 0.7, rng, true);
    rightEarPoints = applyLineJitter(rightEarPoints, jitterMm * 0.7, rng, true);
    tailPoints = smoothLine(tailPoints, 3);
    tailPoints = applyLineJitter(tailPoints, jitterMm, rng, true);
  }

  paths.push(pointsToPath(bodyPoints, false));
  paths.push(pointsToPath(headPoints, false));
  paths.push(pointsToPath(snoutPoints, false));
  paths.push(pointsToPath(leftEarPoints, false));
  paths.push(pointsToPath(rightEarPoints, false));
  paths.push(pointsToPath(leftEyePoints, false));
  paths.push(pointsToPath(rightEyePoints, false));
  paths.push(pointsToPath(nosePoints, false));
  paths.push(pointsToPath(tailPoints, false));
  
  for (let leg of legs) {
    if (jitterMm > 0) {
      leg = applyLineJitter(leg, jitterMm * 0.5, rng, true);
    }
    paths.push(pointsToPath(leg, false));
  }

  return paths;
}

/**
 * Draws a tree icon with randomized trunk, branches, and canopy
 */
export function drawTreeIcon(
  anchorX: number,
  anchorY: number,
  scaleMm: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  const s = scaleMm / 15;

  // Trunk with random width variation and more natural shape
  const trunkWidthVariation = rng ? rng.randomRange(0.8, 1.2) : 1.0;
  const trunkWidth = 2 * s * trunkWidthVariation;
  const trunkHeightVariation = rng ? rng.randomRange(0.9, 1.1) : 1.0;
  const trunkHeight = 8 * s * trunkHeightVariation;
  const trunkX = anchorX - trunkWidth / 2;
  const trunkY = anchorY - trunkHeight;

  // Trunk with slight taper (wider at bottom)
  const trunkTopWidth = trunkWidth * 0.7;
  const trunkTopX = anchorX - trunkTopWidth / 2;
  
  let trunkPoints: Point[] = [
    { x: trunkX, y: anchorY }, // Bottom left
    { x: trunkX + trunkWidth, y: anchorY }, // Bottom right
    { x: trunkTopX + trunkTopWidth, y: trunkY }, // Top right
    { x: trunkTopX, y: trunkY }, // Top left
    { x: trunkX, y: anchorY } // Close
  ];
  
  // Add random slope to trunk
  if (rng) {
    trunkPoints = addRandomSlope(trunkPoints, rng, 1.5);
  }

  // Add more detailed branches with better structure
  if (rng) {
    const branchCount = rng.randomInt(5, 9);
    for (let i = 0; i < branchCount; i++) {
      const branchY = trunkY + (trunkHeight * 0.15) + (i * trunkHeight * 0.12);
      const branchSide = i % 2 === 0 ? 1 : -1;
      const branchLength = s * rng.randomRange(3, 6);
      const branchAngle = rng.randomRange(0.3, 0.8);
      
      // Main branch with slight curve
      const branchStartX = anchorX + (branchSide * trunkWidth * 0.4);
      const branchEndX = branchStartX + branchSide * branchLength * Math.cos(branchAngle);
      const branchEndY = branchY - branchLength * Math.sin(branchAngle);
      
      // Add mid-point for slight curve
      const midX = branchStartX + branchSide * branchLength * 0.5 * Math.cos(branchAngle);
      const midY = branchY - branchLength * 0.5 * Math.sin(branchAngle) + rng.randomRange(-s * 0.5, s * 0.5);
      
      let branchPoints: Point[] = [
        { x: branchStartX, y: branchY },
        { x: midX, y: midY },
        { x: branchEndX, y: branchEndY }
      ];
      
      branchPoints = smoothLine(branchPoints, 2);
      branchPoints = addRandomSlope(branchPoints, rng, 2);
      
      // Add small twigs (50% chance per branch, more realistic)
      if (rng.chance(0.5)) {
        const twigStartX = branchEndX;
        const twigStartY = branchEndY;
        const twigLength = branchLength * rng.randomRange(0.3, 0.6);
        const twigAngle = branchAngle + rng.randomRange(-0.4, 0.4);
        
        let twigPoints: Point[] = [
          { x: twigStartX, y: twigStartY },
          { x: twigStartX + branchSide * twigLength * Math.cos(twigAngle),
            y: twigStartY - twigLength * Math.sin(twigAngle) }
        ];
        
        twigPoints = addRandomSlope(twigPoints, rng, 2);
        if (jitterMm > 0) {
          twigPoints = applyLineJitter(twigPoints, jitterMm * 0.4, rng, true);
        }
        paths.push(pointsToPath(twigPoints, false));
      }
      
      if (jitterMm > 0) {
        branchPoints = applyLineJitter(branchPoints, jitterMm * 0.5, rng, true);
      }
      paths.push(pointsToPath(branchPoints, false));
    }
  }
  
  // Add trunk texture (bark lines)
  if (rng && trunkHeight > s * 5) {
    const barkLineCount = rng.randomInt(2, 4);
    for (let i = 0; i < barkLineCount; i++) {
      const barkY = trunkY + (trunkHeight * 0.2) + (i * trunkHeight * 0.3);
      let barkLine: Point[] = [
        { x: trunkX + trunkWidth * 0.2, y: barkY },
        { x: trunkX + trunkWidth * 0.8, y: barkY }
      ];
      
      if (jitterMm > 0) {
        barkLine = applyLineJitter(barkLine, jitterMm * 0.2, rng, true);
      }
      paths.push(pointsToPath(barkLine, false));
    }
  }

  // Multi-lobed irregular canopy (replaces circular canopies)
  const canopyRadiusVariation = rng ? rng.randomRange(0.8, 1.3) : 1.0;
  const baseCanopyRadius = 6 * s * canopyRadiusVariation;
  const canopyY = trunkY - baseCanopyRadius * 0.3;
  
  if (!rng) {
    // Fallback: simple irregular shape
    const canopyPoints: Point[] = [];
    const segments = 16;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      canopyPoints.push({
        x: anchorX + baseCanopyRadius * Math.cos(angle),
        y: canopyY + baseCanopyRadius * Math.sin(angle)
      });
    }
    paths.push(pointsToPath(canopyPoints, false));
  } else {
    // Create multi-lobed irregular canopy (3-5 lobes)
    const lobeCount = rng.randomInt(3, 6);
    const canopyPoints: Point[] = [];
    
    // Generate lobes with varying sizes and positions
    const lobes: Array<{ angle: number; radius: number; size: number }> = [];
    for (let i = 0; i < lobeCount; i++) {
      const angle = (i / lobeCount) * Math.PI * 2 + rng.randomRange(-0.3, 0.3);
      const radius = baseCanopyRadius * rng.randomRange(0.6, 1.0);
      const size = baseCanopyRadius * rng.randomRange(0.4, 0.7);
      lobes.push({ angle, radius, size });
    }
    
    // Create outline by combining lobes
    const segments = 32; // More segments for smoother outline
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const baseAngle = t * Math.PI * 2;
      
      // Find the dominant lobe at this angle
      let maxRadius = 0;
      for (const lobe of lobes) {
        const angleDiff = Math.abs(baseAngle - lobe.angle);
        const normalizedDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);
        const influence = Math.max(0, 1 - normalizedDiff / (Math.PI / 2));
        const lobeRadius = lobe.radius + lobe.size * influence;
        maxRadius = Math.max(maxRadius, lobeRadius);
      }
      
      // Add variation for irregularity
      const radiusVariation = 1 + rng.randomRange(-0.15, 0.15);
      const finalRadius = maxRadius * radiusVariation;
      
      canopyPoints.push({
        x: anchorX + finalRadius * Math.cos(baseAngle),
        y: canopyY + finalRadius * Math.sin(baseAngle)
      });
    }
    
    // Add layered outlines (3-5 overlapping shapes for depth)
    const layerCount = rng.randomInt(3, 5);
    for (let layer = 0; layer < layerCount; layer++) {
      const layerScale = 1 - layer * 0.15; // Each layer slightly smaller
      const layerOffsetX = rng.randomRange(-baseCanopyRadius * 0.1, baseCanopyRadius * 0.1);
      const layerOffsetY = rng.randomRange(-baseCanopyRadius * 0.1, baseCanopyRadius * 0.1);
      
      const layerPoints: Point[] = canopyPoints.map(p => ({
        x: anchorX + (p.x - anchorX) * layerScale + layerOffsetX,
        y: canopyY + (p.y - canopyY) * layerScale + layerOffsetY
      }));
      
      // Always apply irregularity
      const irregularLayer = makeIrregularPolygon(layerPoints, rng, 2, 1.0);
      irregularLayer.push(irregularLayer[0]); // Close polygon
      
      if (jitterMm > 0) {
        const jitteredLayer = applyLineJitter(irregularLayer, jitterMm * (1 - layer * 0.2), rng, true);
        paths.push(pointsToPath(jitteredLayer, false));
      } else {
        paths.push(pointsToPath(irregularLayer, false));
      }
    }
    
    // Add small detail strokes within canopy (20-30% of canopy area)
    // Small curved lines suggesting leaf clusters
    const detailStrokeCount = Math.floor(baseCanopyRadius * 0.25); // Proportional to canopy size
    for (let ds = 0; ds < detailStrokeCount; ds++) {
      // Random position within canopy
      const detailAngle = rng.randomRange(0, Math.PI * 2);
      const detailRadius = baseCanopyRadius * rng.randomRange(0.3, 0.7);
      const detailX = anchorX + detailRadius * Math.cos(detailAngle);
      const detailY = canopyY + detailRadius * Math.sin(detailAngle);
      
      // Small curved line (leaf cluster suggestion)
      const detailLength = baseCanopyRadius * rng.randomRange(0.1, 0.2);
      const detailAngle2 = detailAngle + rng.randomRange(-0.5, 0.5);
      const detailEndX = detailX + detailLength * Math.cos(detailAngle2);
      const detailEndY = detailY + detailLength * Math.sin(detailAngle2);
      
      // Add mid-point for curve
      const midX = (detailX + detailEndX) / 2 + rng.randomRange(-detailLength * 0.2, detailLength * 0.2);
      const midY = (detailY + detailEndY) / 2 + rng.randomRange(-detailLength * 0.2, detailLength * 0.2);
      
      let detailPoints: Point[] = [
        { x: detailX, y: detailY },
        { x: midX, y: midY },
        { x: detailEndX, y: detailEndY }
      ];
      
      detailPoints = smoothLine(detailPoints, 2);
      detailPoints = addRandomSlope(detailPoints, rng, 2);
      
      if (jitterMm > 0) {
        detailPoints = applyLineJitter(detailPoints, jitterMm * 0.3, rng, true);
      }
      paths.push(pointsToPath(detailPoints, false));
    }
  }

  if (jitterMm > 0 && rng) {
    trunkPoints = applyLineJitter(trunkPoints, jitterMm * 0.5, rng, true);
  }
  paths.push(pointsToPath(trunkPoints, false));

  return paths;
}

/**
 * Draws a more detailed sun or moon with optional rays and facial features
 */
export function drawSunOrMoon(
  centerX: number,
  centerY: number,
  radius: number,
  addRays: boolean = true,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  if (!rng) return paths;

  // Main circle with more segments for smoother detail
  const circlePoints: Point[] = [];
  const segments = 32; // Increased from 24 for more detail
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    // Add slight variation for more organic look
    const radiusVariation = 1 + rng.randomRange(-0.02, 0.02);
    circlePoints.push({
      x: centerX + radius * radiusVariation * Math.cos(angle),
      y: centerY + radius * radiusVariation * Math.sin(angle)
    });
  }

  if (jitterMm > 0) {
    const jitteredCircle = applyLineJitter(circlePoints, jitterMm, rng, true);
    paths.push(pointsToPath(jitteredCircle, false));
  } else {
    paths.push(pointsToPath(circlePoints, false));
  }

  // Add eyes to sun (always show eyes, never smile)
  if (addRays) {
    const eyeSize = radius * 0.15;
    const eyeY = centerY - radius * 0.2;
    
    // Left eye
    const leftEyeX = centerX - radius * 0.3;
    const leftEyePoints: Point[] = [];
    for (let i = 0; i <= 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      leftEyePoints.push({
        x: leftEyeX + eyeSize * Math.cos(angle),
        y: eyeY + eyeSize * Math.sin(angle)
      });
    }
    
    // Right eye
    const rightEyeX = centerX + radius * 0.3;
    const rightEyePoints: Point[] = [];
    for (let i = 0; i <= 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      rightEyePoints.push({
        x: rightEyeX + eyeSize * Math.cos(angle),
        y: eyeY + eyeSize * Math.sin(angle)
      });
    }
    
    if (jitterMm > 0) {
      paths.push(pointsToPath(applyLineJitter(leftEyePoints, jitterMm * 0.3, rng, true), false));
      paths.push(pointsToPath(applyLineJitter(rightEyePoints, jitterMm * 0.3, rng, true), false));
    } else {
      paths.push(pointsToPath(leftEyePoints, false));
      paths.push(pointsToPath(rightEyePoints, false));
    }
  }

  // Rays (if sun) - with more detail and variation
  if (addRays) {
    const baseRayCount = 12;
    const rayCount = rng.randomInt(12, 16); // More rays for detail
    
    for (let i = 0; i < rayCount; i++) {
      // Base angle with random offset for irregular spacing
      const baseAngle = (i / rayCount) * Math.PI * 2;
      const angleOffset = rng.randomRange(-0.12, 0.12); // Random rotation
      const angle = baseAngle + angleOffset;
      
      // Randomized ray length with more variation
      const baseRayLength = radius * 0.7;
      const lengthVariation = rng.randomRange(0.6, 1.4);
      const rayLength = baseRayLength * lengthVariation;
      
      // Ray width variation (some rays are thicker)
      const rayWidth = rng.chance(0.3) ? 1.5 : 1.0;
      
      const innerX = centerX + radius * Math.cos(angle);
      const innerY = centerY + radius * Math.sin(angle);
      const outerX = centerX + (radius + rayLength) * Math.cos(angle);
      const outerY = centerY + (radius + rayLength) * Math.sin(angle);

      // Create ray as a small line segment with slight width
      let rayPoints: Point[] = [
        { x: innerX, y: innerY },
        { x: outerX, y: outerY }
      ];
      
      // Some rays have a slight curve
      if (rng.chance(0.3)) {
        const midX = (innerX + outerX) / 2 + rng.randomRange(-radius * 0.1, radius * 0.1) * Math.cos(angle + Math.PI / 2);
        const midY = (innerY + outerY) / 2 + rng.randomRange(-radius * 0.1, radius * 0.1) * Math.sin(angle + Math.PI / 2);
        rayPoints = [
          { x: innerX, y: innerY },
          { x: midX, y: midY },
          { x: outerX, y: outerY }
        ];
      }

      if (jitterMm > 0) {
        rayPoints = applyLineJitter(rayPoints, jitterMm * 0.4, rng, true);
      }

      paths.push(pointsToPath(rayPoints, false));
    }
  }

  return paths;
}

/**
 * Draws a path from bottom of canvas to the door
 */
export function drawPathToDoor(
  canvasBottomY: number,
  doorCenterX: number,
  doorBottomY: number,
  pathWidthMm: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];

  // Tapered path (wider at bottom, narrower at door)
  const bottomWidth = pathWidthMm;
  const topWidth = pathWidthMm * 0.5;

  let leftEdge: Point[] = [
    { x: doorCenterX - topWidth / 2, y: doorBottomY },
    { x: doorCenterX - bottomWidth / 2, y: canvasBottomY }
  ];

  let rightEdge: Point[] = [
    { x: doorCenterX + topWidth / 2, y: doorBottomY },
    { x: doorCenterX + bottomWidth / 2, y: canvasBottomY }
  ];

  if (jitterMm > 0 && rng) {
    leftEdge = smoothLine(leftEdge, 4);
    rightEdge = smoothLine(rightEdge, 4);
    leftEdge = applyLineJitter(leftEdge, jitterMm, rng, true);
    rightEdge = applyLineJitter(rightEdge, jitterMm, rng, true);
  }

  paths.push(pointsToPath(leftEdge, false));
  paths.push(pointsToPath(rightEdge, false));

  return paths;
}

/**
 * Draws a simple ground line
 */
export function drawGroundLine(
  startX: number,
  endX: number,
  y: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  let points: Point[] = [
    { x: startX, y },
    { x: endX, y }
  ];

  // Add random slope for kid-sketch feel
  if (rng) {
    points = addRandomSlope(points, rng, 3);
  }

  if (jitterMm > 0 && rng) {
    points = smoothLine(points, 8);
    points = applyLineJitter(points, jitterMm, rng, true);
  }

  return [pointsToPath(points, false)];
}

/**
 * Draws ground area infill/sketch like sky fill
 * Creates dense, organic coloring strokes for the ground area
 */
export function drawGroundFill(
  x: number,
  y: number,
  width: number,
  height: number,
  jitterMm: number = 0,
  fillDensity: number = 1.4,
  patternRandomness: number = 0.8,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  
  if (!rng) {
    return paths;
  }
  
  // Use configurable density parameter
  // Higher density = more strokes = more intensive fill
  const area = width * height;
  const targetDensity = fillDensity; // Use passed-in density parameter
  const avgStrokeArea = 6 * 10; // Account for shorter stroke coverage
  const strokeCount = Math.max(120, Math.ceil((area * targetDensity) / avgStrokeArea));
  
  // IMPROVED DISTRIBUTION: Shuffle stratified samples for perfect balance
  // Create array of thirds, shuffle to avoid patterns, ensures exact 33/33/33 distribution
  const thirds: number[] = [];
  const third_width = width / 3;
  for (let i = 0; i < strokeCount; i++) {
    thirds.push(i % 3);
  }
  // Shuffle using Fisher-Yates with our RNG
  for (let i = thirds.length - 1; i > 0; i--) {
    const j = Math.floor(rng.random() * (i + 1));
    [thirds[i], thirds[j]] = [thirds[j], thirds[i]];
  }
  
  for (let i = 0; i < strokeCount; i++) {
    // Use shuffled third assignment for perfectly balanced randomness
    const third_index = thirds[i];
    const third_start_x = x + (third_index * third_width);
    
    // CENTER-BASED: Position is the visual CENTER of the stroke, not the start
    // This ensures perfect horizontal balance
    const centerX = third_start_x + rng.random() * third_width;
    const centerY = y + rng.random() * height;
    
    // Stroke length and angle
    const minLength = Math.max(width, height) * 0.18;
    const maxLength = Math.max(width, height) * 0.35;
    const strokeLength = rng.randomRange(minLength, maxLength);
    const halfLength = strokeLength / 2;
    
    // PATTERN RANDOMNESS CONTROL:
    // patternRandomness = 0: clean, all horizontal (angle = 0)
    // patternRandomness = 1: messy, full angle range
    const angleRange = Math.PI * 0.6 * patternRandomness; // 0 to ±108°
    const baseAngle = rng.randomRange(-angleRange, angleRange);
    
    // Generate stroke bidirectionally from center
    const controlPointCount = rng.randomInt(2, 3);
    let linePoints: Point[] = [];
    
    // Wavy variation parameters - also scaled by patternRandomness
    const maxAngleVariation = rng.randomRange(0.05, 0.1) + (patternRandomness * 0.2);
    const angleVariationDirection = rng.chance(0.5) ? 1 : -1;
    const waveFrequency = rng.randomRange(1, 2) + (patternRandomness * 2); // 1-2 or 1-4 waves
    
    // Generate points from -halfLength to +halfLength (bidirectional)
    const totalPoints = controlPointCount + 2; // start + control points + end
    for (let p = 0; p < totalPoints; p++) {
      // t goes from -1 to +1 (symmetric around center)
      const t = (p / (totalPoints - 1)) * 2 - 1;
      const absT = Math.abs(t);
      const smoothT = (1 - Math.cos(absT * Math.PI)) / 2;
      
      // Angle variation
      const angleVariation = angleVariationDirection * maxAngleVariation * smoothT * Math.sign(t);
      const waveVariation = Math.sin(absT * Math.PI * waveFrequency) * maxAngleVariation * 0.3;
      const currentAngle = baseAngle + angleVariation + waveVariation;
      
      // Distance from center (symmetric)
      const distFromCenter = absT * halfLength;
      
      // Calculate position relative to center
      const pointX = centerX + distFromCenter * Math.cos(currentAngle) * Math.sign(t);
      const pointY = centerY + distFromCenter * Math.sin(currentAngle) * Math.sign(t);
      
      // Bounds checking
      const margin = Math.min(width, height) * 0.1;
      const leftBound = x - margin;
      const rightBound = x + width + margin;
      const boundedX = Math.max(leftBound, Math.min(rightBound, pointX));
      const boundedY = Math.max(y, Math.min(y + height, pointY));
      
      linePoints.push({ x: boundedX, y: boundedY });
    }
    
    const subdivisions = rng.randomInt(8, 15);
    linePoints = smoothLine(linePoints, subdivisions);
    linePoints = applyLineJitter(linePoints, jitterMm, rng, true);
    linePoints = smoothLine(linePoints, 2);
    
    paths.push(pointsToPath(linePoints, false));
  }
  
  return paths;
}

/**
 * Draws a sky band with child-like coloring strokes
 * Creates dense, fluid, organic coloring strokes that look like a child coloring the sky
 * Uses smooth, curved, flowing paths without sharp or thunder-like appearances
 * Mimics coloring technique with many short, overlapping strokes
 * Sky band has organic, wavy boundaries instead of rigid rectangle
 */
export function drawSkyBand(
  x: number,
  y: number,
  width: number,
  height: number,
  jitterMm: number = 0,
  fillDensity: number = 1.2,
  patternRandomness: number = 0.8,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  
  if (!rng) {
    // Fallback if no RNG provided
    return paths;
  }
  
  // Create organic boundary for sky band (wavy top and bottom edges)
  const wavePoints = 12; // Number of wave segments
  const waveAmplitude = height * 0.15; // How wavy the boundary is
  const topBoundary: Point[] = [];
  const bottomBoundary: Point[] = [];
  
  for (let i = 0; i <= wavePoints; i++) {
    const t = i / wavePoints;
    const waveX = x + t * width;
    
    // Top boundary with organic waves
    const topWave = Math.sin(t * Math.PI * 3) * waveAmplitude * rng.randomRange(0.5, 1.0) +
                    Math.sin(t * Math.PI * 5) * waveAmplitude * 0.3 * rng.randomRange(0.5, 1.0);
    topBoundary.push({
      x: waveX,
      y: y + topWave
    });
    
    // Bottom boundary with organic waves
    const bottomWave = Math.sin(t * Math.PI * 3 + Math.PI) * waveAmplitude * rng.randomRange(0.5, 1.0) +
                       Math.sin(t * Math.PI * 5 + Math.PI) * waveAmplitude * 0.3 * rng.randomRange(0.5, 1.0);
    bottomBoundary.push({
      x: waveX,
      y: y + height + bottomWave
    });
  }
  
  // Apply jitter to boundaries for more organic feel
  if (jitterMm > 0) {
    topBoundary.forEach((p, i) => {
      if (i > 0 && i < topBoundary.length - 1) {
        p.y += rng.randomRange(-jitterMm * 0.3, jitterMm * 0.3);
      }
    });
    bottomBoundary.forEach((p, i) => {
      if (i > 0 && i < bottomBoundary.length - 1) {
        p.y += rng.randomRange(-jitterMm * 0.3, jitterMm * 0.3);
      }
    });
  }
  
  // Use configurable density parameter
  // Higher density = more strokes = more intensive fill
  const area = width * height;
  const targetDensity = fillDensity; // Use passed-in density parameter
  const avgStrokeArea = 6 * 10; // Very short strokes cover less area
  const strokeCount = Math.max(150, Math.ceil((area * targetDensity) / avgStrokeArea));
  
  // Allow strokes to go slightly outside bounds for natural feel
  const margin = Math.min(width, height) * 0.1;
  
  // IMPROVED DISTRIBUTION: Shuffle stratified samples for perfect balance
  // Create array of thirds, shuffle to avoid patterns, ensures exact 33/33/33 distribution
  const thirds: number[] = [];
  const third_width = width / 3;
  for (let i = 0; i < strokeCount; i++) {
    thirds.push(i % 3);
  }
  // Shuffle using Fisher-Yates with our RNG
  for (let i = thirds.length - 1; i > 0; i--) {
    const j = Math.floor(rng.random() * (i + 1));
    [thirds[i], thirds[j]] = [thirds[j], thirds[i]];
  }
  
  for (let i = 0; i < strokeCount; i++) {
    // Use shuffled third assignment for perfectly balanced randomness
    const third_index = thirds[i];
    const third_start_x = x + (third_index * third_width);
    
    // CENTER-BASED: Position is the visual CENTER of the stroke, not the start
    // This ensures perfect horizontal balance
    const centerX = third_start_x + rng.random() * third_width;
    const centerY = y + rng.random() * height;
    
    // Stroke length and angle
    const minLength = Math.max(width, height) * 0.15;
    const maxLength = Math.max(width, height) * 0.3;
    const strokeLength = rng.randomRange(minLength, maxLength);
    const halfLength = strokeLength / 2;
    
    // PATTERN RANDOMNESS CONTROL:
    // patternRandomness = 0: clean, all horizontal (angle = 0)
    // patternRandomness = 1: messy, full angle range
    const angleRange = Math.PI * 0.6 * patternRandomness; // 0 to ±108°
    const baseAngle = rng.randomRange(-angleRange, angleRange);
    
    // Generate stroke bidirectionally from center
    const controlPointCount = rng.randomInt(2, 3);
    let linePoints: Point[] = [];
    
    // Angle variation parameters - also scaled by patternRandomness
    const maxAngleVariation = rng.randomRange(0.05, 0.1) + (patternRandomness * 0.25);
    const angleVariationDirection = rng.chance(0.5) ? 1 : -1;
    
    // Generate points from -halfLength to +halfLength (bidirectional)
    const totalPoints = controlPointCount + 2; // start + control points + end
    for (let p = 0; p < totalPoints; p++) {
      // t goes from -1 to +1 (symmetric around center)
      const t = (p / (totalPoints - 1)) * 2 - 1;
      const absT = Math.abs(t);
      const smoothT = (1 - Math.cos(absT * Math.PI)) / 2;
      
      // Angle variation
      const angleVariation = angleVariationDirection * maxAngleVariation * smoothT * Math.sign(t);
      const currentAngle = baseAngle + angleVariation;
      
      // Distance from center (symmetric)
      const distFromCenter = absT * halfLength;
      
      // Calculate position relative to center
      const pointX = centerX + distFromCenter * Math.cos(currentAngle) * Math.sign(t);
      const pointY = centerY + distFromCenter * Math.sin(currentAngle) * Math.sign(t);
      
      // Bounds checking with organic boundaries
      const leftBound = x - margin;
      const rightBound = x + width + margin;
      const boundedX = Math.max(leftBound, Math.min(rightBound, pointX));
      
      // Find corresponding boundary Y values at this X
      let topY = y;
      let bottomY = y + height;
      for (let bi = 0; bi < topBoundary.length - 1; bi++) {
        if (boundedX >= topBoundary[bi].x && boundedX <= topBoundary[bi + 1].x) {
          const tBound = (boundedX - topBoundary[bi].x) / (topBoundary[bi + 1].x - topBoundary[bi].x);
          topY = topBoundary[bi].y + tBound * (topBoundary[bi + 1].y - topBoundary[bi].y);
          break;
        }
      }
      for (let bi = 0; bi < bottomBoundary.length - 1; bi++) {
        if (boundedX >= bottomBoundary[bi].x && boundedX <= bottomBoundary[bi + 1].x) {
          const tBound = (boundedX - bottomBoundary[bi].x) / (bottomBoundary[bi + 1].x - bottomBoundary[bi].x);
          bottomY = bottomBoundary[bi].y + tBound * (bottomBoundary[bi + 1].y - bottomBoundary[bi].y);
          break;
        }
      }
      
      // Clamp Y to be within organic boundaries
      const boundedY = Math.max(topY - margin, Math.min(bottomY + margin, pointY));
      
      linePoints.push({ x: boundedX, y: boundedY });
    }
    
    const subdivisions = rng.randomInt(8, 15);
    linePoints = smoothLine(linePoints, subdivisions);
    linePoints = applyLineJitter(linePoints, jitterMm, rng, true);
    linePoints = smoothLine(linePoints, 2);
    
    paths.push(pointsToPath(linePoints, false));
  }
  
  return paths;
}

/**
 * Draws a simple grass patch (several blades of grass)
 */
export function drawGrassPatch(
  centerX: number,
  baseY: number,
  patchWidth: number,
  bladeHeight: number,
  bladeCount: number = 5,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  const spacing = patchWidth / (bladeCount - 1);

  for (let i = 0; i < bladeCount; i++) {
    const x = centerX - patchWidth / 2 + i * spacing;
    const randomOffset = rng ? rng.randomRange(-spacing * 0.3, spacing * 0.3) : 0;
    const heightVariation = rng ? rng.randomRange(0.7, 1.0) : 1.0;
    const actualHeight = bladeHeight * heightVariation;

    // Simple curved blade of grass
    let bladePoints: Point[] = [
      { x: x + randomOffset, y: baseY },
      { x: x + randomOffset + (rng ? rng.randomRange(-2, 2) : 0), y: baseY - actualHeight * 0.5 },
      { x: x + randomOffset + (rng ? rng.randomRange(-3, 3) : 0), y: baseY - actualHeight }
    ];

    if (jitterMm > 0 && rng) {
      bladePoints = smoothLine(bladePoints, 2);
      bladePoints = applyLineJitter(bladePoints, jitterMm * 0.5, rng, true);
    }

    paths.push(pointsToPath(bladePoints, false));
  }

  return paths;
}

/**
 * Draws a detailed flower with richer construction
 */
export function drawFlower(
  centerX: number,
  baseY: number,
  flowerSize: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  if (!rng) return paths;
  
  // Stem with slight curve and leaves
  const stemHeight = flowerSize * 1.5;
  const stemCurve = rng.randomRange(-flowerSize * 0.2, flowerSize * 0.2);
  
  let stemPoints: Point[] = [
    { x: centerX, y: baseY },
    { x: centerX + stemCurve * 0.3, y: baseY - stemHeight * 0.5 },
    { x: centerX + stemCurve, y: baseY - stemHeight }
  ];
  
  stemPoints = smoothLine(stemPoints, 4);
  stemPoints = addRandomSlope(stemPoints, rng, 2);
  
  if (jitterMm > 0) {
    stemPoints = applyLineJitter(stemPoints, jitterMm * 0.5, rng, true);
  }
  paths.push(pointsToPath(stemPoints, false));

  // Add leaves on stem (1-2 leaves)
  const leafCount = rng.randomInt(1, 3);
  for (let i = 0; i < leafCount; i++) {
    const leafY = baseY - stemHeight * rng.randomRange(0.3, 0.7);
    const leafX = centerX + stemCurve * (leafY - baseY) / -stemHeight;
    const leafSide = rng.chance(0.5) ? 1 : -1;
    const leafSize = flowerSize * rng.randomRange(0.15, 0.25);
    
    // Leaf shape (simple oval)
    const leafPoints: Point[] = [];
    const leafSegments = 8;
    for (let j = 0; j <= leafSegments; j++) {
      const t = j / leafSegments;
      const angle = (t - 0.5) * Math.PI * 0.8;
      const radiusX = leafSize * 0.6;
      const radiusY = leafSize;
      leafPoints.push({
        x: leafX + leafSide * radiusX * Math.cos(angle),
        y: leafY + radiusY * Math.sin(angle)
      });
    }
    
    leafPoints.push(leafPoints[0]); // Close leaf
    
    if (jitterMm > 0) {
      const jitteredLeaf = applyLineJitter(leafPoints, jitterMm * 0.3, rng, true);
      paths.push(pointsToPath(jitteredLeaf, false));
    } else {
      paths.push(pointsToPath(leafPoints, false));
    }
  }

  // Flower head (circle with center detail)
  const headY = baseY - stemHeight;
  const headRadius = flowerSize * 0.4;
  
  // Center circle with detail
  const centerPoints: Point[] = [];
  const segments = 16;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const radiusVariation = 1 + rng.randomRange(-0.1, 0.1);
    centerPoints.push({
      x: centerX + headRadius * radiusVariation * Math.cos(angle),
      y: headY + headRadius * radiusVariation * Math.sin(angle)
    });
  }

  if (jitterMm > 0) {
    const jitteredCircle = applyLineJitter(centerPoints, jitterMm * 0.3, rng, true);
    paths.push(pointsToPath(jitteredCircle, false));
  } else {
    paths.push(pointsToPath(centerPoints, false));
  }
  
  // Add center detail (small dots or lines)
  if (rng.chance(0.6)) {
    const detailCount = rng.randomInt(3, 6);
    for (let i = 0; i < detailCount; i++) {
      const detailAngle = (i / detailCount) * Math.PI * 2;
      const detailRadius = headRadius * rng.randomRange(0.3, 0.6);
      const detailX = centerX + detailRadius * Math.cos(detailAngle);
      const detailY = headY + detailRadius * Math.sin(detailAngle);
      const detailSize = headRadius * 0.1;
      
      const detailPoints: Point[] = [];
      for (let j = 0; j <= 6; j++) {
        const t = j / 6;
        const a = t * Math.PI * 2;
        detailPoints.push({
          x: detailX + detailSize * Math.cos(a),
          y: detailY + detailSize * Math.sin(a)
        });
      }
      
      if (jitterMm > 0) {
        const jitteredDetail = applyLineJitter(detailPoints, jitterMm * 0.2, rng, true);
        paths.push(pointsToPath(jitteredDetail, false));
      } else {
        paths.push(pointsToPath(detailPoints, false));
      }
    }
  }

  // Detailed petals (6-9 petals with more shape and irregularities)
  const petalCount = rng.randomInt(6, 9);
  const petalLength = flowerSize * rng.randomRange(0.35, 0.45);
  
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2;
    const petalVariation = rng.randomRange(0.9, 1.1);
    const actualPetalLength = petalLength * petalVariation;
    
    // Create petal with more detail (wider, more curved)
    const petalPoints: Point[] = [];
    const petalSegments = 12;
    
    for (let j = 0; j <= petalSegments; j++) {
      const t = j / petalSegments;
      const petalAngle = angle + (t - 0.5) * (Math.PI / 2.5); // Wider petal
      const radius = headRadius + actualPetalLength * Math.sin(t * Math.PI);
      
      // Add slight width variation for more natural look
      const widthVariation = 1 + Math.sin(t * Math.PI * 2) * 0.1;
      
      // Add small irregularities (bumps/indentations) to petal outline
      const irregularity = rng.randomRange(-0.05, 0.05) * Math.sin(t * Math.PI * 3);
      const radiusWithIrregularity = radius * (1 + irregularity);
      
      petalPoints.push({
        x: centerX + radiusWithIrregularity * widthVariation * Math.cos(petalAngle),
        y: headY + radiusWithIrregularity * widthVariation * Math.sin(petalAngle)
      });
    }
    
    petalPoints.push(petalPoints[0]); // Close petal
    
    if (jitterMm > 0) {
      const jitteredPetal = applyLineJitter(petalPoints, jitterMm * 0.3, rng, true);
      paths.push(pointsToPath(jitteredPetal, false));
    } else {
      paths.push(pointsToPath(petalPoints, false));
    }
    
    // Add optional petal veins (30% chance, 1-2 lines per petal)
    if (rng.chance(0.3)) {
      const veinCount = rng.randomInt(1, 2);
      for (let v = 0; v < veinCount; v++) {
        const veinT = rng.randomRange(0.3, 0.7); // Vein position along petal
        const veinStartRadius = headRadius + actualPetalLength * Math.sin(veinT * Math.PI) * 0.3;
        const veinEndRadius = headRadius + actualPetalLength * Math.sin(veinT * Math.PI);
        const veinAngle = angle + (veinT - 0.5) * (Math.PI / 2.5);
        
        const veinStartX = centerX + veinStartRadius * Math.cos(veinAngle);
        const veinStartY = headY + veinStartRadius * Math.sin(veinAngle);
        const veinEndX = centerX + veinEndRadius * Math.cos(veinAngle);
        const veinEndY = headY + veinEndRadius * Math.sin(veinAngle);
        
        let veinPoints: Point[] = [
          { x: veinStartX, y: veinStartY },
          { x: veinEndX, y: veinEndY }
        ];
        
        if (jitterMm > 0) {
          veinPoints = applyLineJitter(veinPoints, jitterMm * 0.2, rng, true);
        }
        paths.push(pointsToPath(veinPoints, false));
      }
    }
  }

  return paths;
}

/**
 * Draws a simple cloud shape with "zigzag-based" (bumpy) outline
 * Reverted to previous style as per requirements for natural, playful look
 * Creates a soft, organic silhouette with multiple curved bumps
 * Returns both paths and outline points for masking
 */
export function drawCloud(
  centerX: number,
  centerY: number,
  width: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): { paths: string[]; outlinePoints: Point[] } {
  const paths: string[] = [];
  
  // Cloud proportions - slightly taller/fluffier than before
  const heightRatio = rng ? rng.randomRange(0.5, 0.7) : 0.6;
  const height = width * heightRatio;
  
  // Number of bumps (zigzags/curves) around the cloud
  const bumpCount = rng ? rng.randomInt(6, 9) : 7;
  const cloudPoints: Point[] = [];
  
  // Generate bumps around an ellipse
  for (let i = 0; i < bumpCount; i++) {
    const startAngle = (i / bumpCount) * Math.PI * 2;
    const endAngle = ((i + 1) / bumpCount) * Math.PI * 2;
    
    // Function to get point on base ellipse
    const getEllipsePoint = (ang: number) => ({
      x: centerX + (width/2) * Math.cos(ang),
      y: centerY + (height/2) * Math.sin(ang)
    });

    const startP = getEllipsePoint(startAngle);
    const endP = getEllipsePoint(endAngle);
    
    // Control point for the bump (bulge outward)
    const midAngle = (startAngle + endAngle) / 2;
    // Vary the bulge amount for organic feel
    const bulgeFactor = rng ? rng.randomRange(1.2, 1.5) : 1.3;
    
    const peakP = {
      x: centerX + (width/2) * bulgeFactor * Math.cos(midAngle),
      y: centerY + (height/2) * bulgeFactor * Math.sin(midAngle)
    };
    
    // Generate arc points using Quadratic Bezier
    const segments = 8; // segments per bump
    for (let j = 0; j < segments; j++) {
       const t = j / segments;
       // Quadratic Bezier: B(t) = (1-t)^2*P0 + 2(1-t)t*P1 + t^2*P2
       const x = (1-t)*(1-t)*startP.x + 2*(1-t)*t*peakP.x + t*t*endP.x;
       const y = (1-t)*(1-t)*startP.y + 2*(1-t)*t*peakP.y + t*t*endP.y;
       
       cloudPoints.push({x, y});
    }
  }
  
  // Store outline points before closing (for masking)
  const outlinePoints = [...cloudPoints];
  
  // Close the loop for rendering
  if (cloudPoints.length > 0) {
    cloudPoints.push(cloudPoints[0]);
  }

  // Apply smooth jitter for "child-like wobble"
  if (jitterMm > 0 && rng) {
     // Apply jitter
     let points = applyLineJitter(cloudPoints, jitterMm, rng, true);
     // Smooth the jittered line to ensure "rounded, continuous" look
     points = smoothLine(points, 3); 
     paths.push(pointsToPath(points, false));
  } else {
     paths.push(pointsToPath(cloudPoints, false));
  }

  return { paths, outlinePoints };
}

/**
 * Draws a kid-style bird - readable kid-style silhouette
 * Two distinct types: Type A (arc-shaped wings) and Type B (looped wings)
 */
export function drawBird(
  centerX: number,
  centerY: number,
  size: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  
  if (!rng) return paths;
  
  // Apply size variation
  const actualSize = size * rng.randomRange(0.8, 1.2);
  
  // Choose bird type: 50% Type A (arc wings), 50% Type B (looped wings)
  const birdType = rng.chance(0.5) ? 'arcWings' : 'loopedWings';
  
  if (birdType === 'arcWings') {
    // Type A: Classic M/V with curved arc-shaped wings
    const wingLength = actualSize * rng.randomRange(0.8, 1.3);
    const leftWingAngle = rng.randomRange(0.5, 0.9);
    const rightWingAngle = rng.randomRange(0.5, 0.9);
    
    // Left wing tip
    const leftTipX = centerX - wingLength * Math.cos(leftWingAngle);
    const leftTipY = centerY - wingLength * Math.sin(leftWingAngle);
    
    // Right wing tip
    const rightTipX = centerX + wingLength * Math.cos(rightWingAngle);
    const rightTipY = centerY - wingLength * Math.sin(rightWingAngle);
    
    // Body point (slightly below center) - where wings meet
    const bodyY = centerY + actualSize * 0.1;
    const bodyX = centerX;
    
    // Create curved arcs for wings (kid-style seagull shape)
    // Left wing arc: left tip -> center body (curved upward)
    const leftControlY = Math.min(leftTipY, bodyY) - actualSize * 0.3; // Control point above for upward curve
    const leftControlX = (leftTipX + bodyX) / 2 + rng.randomRange(-actualSize * 0.1, actualSize * 0.1);
    
    // Create left wing arc with control point
    const leftWingPoints: Point[] = [];
    const leftSegments = 8;
    for (let i = 0; i <= leftSegments; i++) {
      const t = i / leftSegments;
      // Quadratic Bezier: B(t) = (1-t)^2*P0 + 2(1-t)t*P1 + t^2*P2
      const x = (1-t)*(1-t)*leftTipX + 2*(1-t)*t*leftControlX + t*t*bodyX;
      const y = (1-t)*(1-t)*leftTipY + 2*(1-t)*t*leftControlY + t*t*bodyY;
      leftWingPoints.push({ x, y });
    }
    
    // Right wing arc: center body -> right tip (curved upward)
    const rightControlY = Math.min(rightTipY, bodyY) - actualSize * 0.3; // Control point above for upward curve
    const rightControlX = (bodyX + rightTipX) / 2 + rng.randomRange(-actualSize * 0.1, actualSize * 0.1);
    
    // Create right wing arc with control point
    const rightWingPoints: Point[] = [];
    const rightSegments = 8;
    for (let i = 0; i <= rightSegments; i++) {
      const t = i / rightSegments;
      // Quadratic Bezier: B(t) = (1-t)^2*P0 + 2(1-t)t*P1 + t^2*P2
      const x = (1-t)*(1-t)*bodyX + 2*(1-t)*t*rightControlX + t*t*rightTipX;
      const y = (1-t)*(1-t)*bodyY + 2*(1-t)*t*rightControlY + t*t*rightTipY;
      rightWingPoints.push({ x, y });
    }
    
    // Apply smoothing and irregularity to arcs
    let leftArc = smoothLine(leftWingPoints, 3);
    let rightArc = smoothLine(rightWingPoints, 3);
    leftArc = addRandomSlope(leftArc, rng, 2);
    rightArc = addRandomSlope(rightArc, rng, 2);
    
    if (jitterMm > 0) {
      leftArc = applyLineJitter(leftArc, jitterMm * 0.8, rng, true);
      rightArc = applyLineJitter(rightArc, jitterMm * 0.8, rng, true);
    }
    
    paths.push(pointsToPath(leftArc, false));
    paths.push(pointsToPath(rightArc, false));
    
    // Add small body circle/node at center (80% chance) for better recognition
    if (rng.chance(0.8)) {
      const bodySize = actualSize * 0.18;
      const bodyPoints: Point[] = [];
      for (let i = 0; i <= 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        bodyPoints.push({
          x: bodyX + bodySize * Math.cos(angle) * rng.randomRange(0.8, 1.2),
          y: bodyY + bodySize * Math.sin(angle) * rng.randomRange(0.8, 1.2)
        });
      }
      const irregularBody = makeIrregularPolygon(bodyPoints, rng, 2, 0.5);
      irregularBody.push(irregularBody[0]);
      
      if (jitterMm > 0) {
        paths.push(pointsToPath(applyLineJitter(irregularBody, jitterMm * 0.4, rng, true), false));
      } else {
        paths.push(pointsToPath(irregularBody, false));
      }
    }
    
  } else {
    // Type B: Looped-wing style - Two small loops for wings, body dot
    const wingSize = actualSize * 0.6;
    const loopRadius = actualSize * 0.2;
    
    // Left wing loop
    const leftLoopCenterX = centerX - wingSize * 0.4;
    const leftLoopCenterY = centerY - actualSize * 0.1;
    const leftLoopPoints: Point[] = [];
    for (let i = 0; i <= 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      leftLoopPoints.push({
        x: leftLoopCenterX + loopRadius * Math.cos(angle),
        y: leftLoopCenterY + loopRadius * 0.6 * Math.sin(angle)
      });
    }
    leftLoopPoints.push(leftLoopPoints[0]);
    
    // Right wing loop
    const rightLoopCenterX = centerX + wingSize * 0.4;
    const rightLoopCenterY = centerY - actualSize * 0.1;
    const rightLoopPoints: Point[] = [];
    for (let i = 0; i <= 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      rightLoopPoints.push({
        x: rightLoopCenterX + loopRadius * Math.cos(angle),
        y: rightLoopCenterY + loopRadius * 0.6 * Math.sin(angle)
      });
    }
    rightLoopPoints.push(rightLoopPoints[0]);
    
    // Apply irregularity and jitter
    const irregularLeft = makeIrregularPolygon(leftLoopPoints, rng, 2, 0.5);
    const irregularRight = makeIrregularPolygon(rightLoopPoints, rng, 2, 0.5);
    
    if (jitterMm > 0) {
      paths.push(pointsToPath(applyLineJitter(irregularLeft, jitterMm * 0.6, rng, true), false));
      paths.push(pointsToPath(applyLineJitter(irregularRight, jitterMm * 0.6, rng, true), false));
    } else {
      paths.push(pointsToPath(irregularLeft, false));
      paths.push(pointsToPath(irregularRight, false));
    }
    
    // Body dot (60% chance)
    if (rng.chance(0.6)) {
      const bodySize = actualSize * 0.15;
      const bodyPoints: Point[] = [];
      for (let i = 0; i <= 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        bodyPoints.push({
          x: centerX + bodySize * Math.cos(angle) * rng.randomRange(0.8, 1.2),
          y: centerY + bodySize * Math.sin(angle) * rng.randomRange(0.8, 1.2)
        });
      }
      const irregularBody = makeIrregularPolygon(bodyPoints, rng, 2, 0.5);
      irregularBody.push(irregularBody[0]);
      
      if (jitterMm > 0) {
        paths.push(pointsToPath(applyLineJitter(irregularBody, jitterMm * 0.3, rng, true), false));
      } else {
        paths.push(pointsToPath(irregularBody, false));
      }
    }
  }
  
  return paths;
}

/**
 * Draws a butterfly (symmetrical shape)
 */
export function drawButterfly(
  centerX: number,
  centerY: number,
  size: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  
  if (!rng) return paths;
  
  // Body (vertical line)
  const bodyHeight = size * 0.6;
  let bodyPoints: Point[] = [
    { x: centerX, y: centerY - bodyHeight / 2 },
    { x: centerX, y: centerY + bodyHeight / 2 }
  ];
  
  // Upper wings (symmetrical)
  const wingSize = size * 0.4;
  const upperWingY = centerY - bodyHeight * 0.2;
  
  // Left upper wing
  const leftUpperWing: Point[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const angle = Math.PI * t;
    leftUpperWing.push({
      x: centerX - wingSize * Math.cos(angle),
      y: upperWingY - wingSize * 0.6 * Math.sin(angle)
    });
  }
  
  // Right upper wing
  const rightUpperWing: Point[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const angle = Math.PI * t;
    rightUpperWing.push({
      x: centerX + wingSize * Math.cos(angle),
      y: upperWingY - wingSize * 0.6 * Math.sin(angle)
    });
  }
  
  // Lower wings (smaller)
  const lowerWingSize = size * 0.3;
  const lowerWingY = centerY + bodyHeight * 0.2;
  
  // Left lower wing
  const leftLowerWing: Point[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const angle = Math.PI * t;
    leftLowerWing.push({
      x: centerX - lowerWingSize * Math.cos(angle),
      y: lowerWingY - lowerWingSize * 0.5 * Math.sin(angle)
    });
  }
  
  // Right lower wing
  const rightLowerWing: Point[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const angle = Math.PI * t;
    rightLowerWing.push({
      x: centerX + lowerWingSize * Math.cos(angle),
      y: lowerWingY - lowerWingSize * 0.5 * Math.sin(angle)
    });
  }
  
  if (jitterMm > 0) {
    bodyPoints = applyLineJitter(bodyPoints, jitterMm * 0.3, rng, true);
    const jitteredLeftUpper = applyLineJitter(leftUpperWing, jitterMm * 0.3, rng, true);
    const jitteredRightUpper = applyLineJitter(rightUpperWing, jitterMm * 0.3, rng, true);
    const jitteredLeftLower = applyLineJitter(leftLowerWing, jitterMm * 0.3, rng, true);
    const jitteredRightLower = applyLineJitter(rightLowerWing, jitterMm * 0.3, rng, true);
    
    paths.push(pointsToPath(bodyPoints, false));
    paths.push(pointsToPath(jitteredLeftUpper, false));
    paths.push(pointsToPath(jitteredRightUpper, false));
    paths.push(pointsToPath(jitteredLeftLower, false));
    paths.push(pointsToPath(jitteredRightLower, false));
  } else {
    paths.push(pointsToPath(bodyPoints, false));
    paths.push(pointsToPath(leftUpperWing, false));
    paths.push(pointsToPath(rightUpperWing, false));
    paths.push(pointsToPath(leftLowerWing, false));
    paths.push(pointsToPath(rightLowerWing, false));
  }
  
  return paths;
}

/**
 * Draws a bush with layered organic curves (not single circles)
 * Creates 3-5 clustered organic shapes with irregular contours
 */
export function drawBush(
  centerX: number,
  baseY: number,
  width: number,
  height: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  
  if (!rng) return paths;
  
  // Create 4-7 clustered organic shapes (not simple circles)
  const shapeCount = rng.randomInt(4, 7);
  
  for (let i = 0; i < shapeCount; i++) {
    const offsetX = rng.randomRange(-width * 0.4, width * 0.4);
    const offsetY = rng.randomRange(-height * 0.3, 0);
    const shapeWidth = width * rng.randomRange(0.5, 1.0);
    const shapeHeight = height * rng.randomRange(0.6, 1.0);
    
    const shapeX = centerX + offsetX - shapeWidth / 2;
    const shapeY = baseY + offsetY - shapeHeight;
    
    // Create organic, irregular shape with multiple curves
    const shapePoints: Point[] = [];
    const segments = 16; // More segments for smoother curves
    
    // Create wavy, organic outline (not perfect semicircle)
    // Increased wave variation for more organic feel
    for (let j = 0; j <= segments; j++) {
      const t = j / segments;
      const baseAngle = t * Math.PI;
      
      // Add more wave variation for organic feel (increased amplitude)
      const wave1 = Math.sin(t * Math.PI * 3) * 0.2; // Increased from 0.15
      const wave2 = Math.sin(t * Math.PI * 5) * 0.15; // Increased from 0.1
      const waveVariation = wave1 + wave2;
      
      const radiusX = (shapeWidth / 2) * (1 + waveVariation);
      const radiusY = shapeHeight * (1 + waveVariation * 0.5);
      
      shapePoints.push({
        x: shapeX + shapeWidth / 2 + radiusX * Math.cos(baseAngle),
        y: shapeY + shapeHeight - radiusY * Math.sin(baseAngle)
      });
    }
    
    // Always apply irregularity to make it more organic
    const irregularShape = makeIrregularPolygon(shapePoints, rng, 2, 0.8);
    irregularShape.push(irregularShape[0]); // Close polygon
    
    if (jitterMm > 0) {
      const jitteredShape = applyLineJitter(irregularShape, jitterMm * 0.5, rng, true);
      paths.push(pointsToPath(jitteredShape, false));
    } else {
      paths.push(pointsToPath(irregularShape, false));
    }
    
    // Add small internal detail lines (40% chance per shape)
    // Short curved lines suggesting leaves
    if (rng.chance(0.4)) {
      const detailLineCount = rng.randomInt(2, 4);
      for (let dl = 0; dl < detailLineCount; dl++) {
        // Random position within shape
        const detailX = shapeX + shapeWidth * rng.randomRange(0.2, 0.8);
        const detailY = shapeY + shapeHeight * rng.randomRange(0.3, 0.9);
        
        // Short curved line
        const detailLength = shapeWidth * rng.randomRange(0.1, 0.2);
        const detailAngle = rng.randomRange(0, Math.PI * 2);
        const detailEndX = detailX + detailLength * Math.cos(detailAngle);
        const detailEndY = detailY + detailLength * Math.sin(detailAngle);
        
        // Add mid-point for curve
        const midX = (detailX + detailEndX) / 2 + rng.randomRange(-detailLength * 0.2, detailLength * 0.2);
        const midY = (detailY + detailEndY) / 2 + rng.randomRange(-detailLength * 0.2, detailLength * 0.2);
        
        let detailPoints: Point[] = [
          { x: detailX, y: detailY },
          { x: midX, y: midY },
          { x: detailEndX, y: detailEndY }
        ];
        
        detailPoints = smoothLine(detailPoints, 2);
        detailPoints = addRandomSlope(detailPoints, rng, 2);
        
        if (jitterMm > 0) {
          detailPoints = applyLineJitter(detailPoints, jitterMm * 0.2, rng, true);
        }
        paths.push(pointsToPath(detailPoints, false));
      }
    }
  }
  
  return paths;
}

/**
 * Draws a simple rock with organic, irregular shape
 */
export function drawRock(
  centerX: number,
  baseY: number,
  size: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  if (!rng) return paths;
  
  // Create irregular, organic rock shape
  const width = size * rng.randomRange(0.8, 1.2);
  const height = size * rng.randomRange(0.6, 1.0);
  
  const rockPoints: Point[] = [];
  const segments = 16;
  
  // Create wavy, irregular outline
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const baseAngle = t * Math.PI * 2;
    
    // Add wave variation for organic, rocky feel
    const wave1 = Math.sin(t * Math.PI * 2) * 0.15;
    const wave2 = Math.sin(t * Math.PI * 3) * 0.1;
    const wave3 = Math.sin(t * Math.PI * 5) * 0.05;
    const waveVariation = wave1 + wave2 + wave3;
    
    const radiusX = (width / 2) * (1 + waveVariation);
    const radiusY = (height / 2) * (1 + waveVariation * 0.8);
    
    rockPoints.push({
      x: centerX + radiusX * Math.cos(baseAngle),
      y: baseY - height / 2 + radiusY * Math.sin(baseAngle)
    });
  }
  
  // Apply irregularity to make it more organic
  const irregularRock = makeIrregularPolygon(rockPoints, rng, 3, size * 0.1);
  irregularRock.push(irregularRock[0]); // Close polygon
  
  if (jitterMm > 0) {
    const jitteredRock = applyLineJitter(irregularRock, jitterMm * 0.4, rng, true);
    paths.push(pointsToPath(jitteredRock, false));
  } else {
    paths.push(pointsToPath(irregularRock, false));
  }
  
  // Add internal detail lines (cracks/texture) - 60% chance
  if (rng.chance(0.6)) {
    const detailCount = rng.randomInt(2, 4);
    for (let i = 0; i < detailCount; i++) {
      const detailX = centerX + width * rng.randomRange(-0.3, 0.3);
      const detailY = baseY - height / 2 + height * rng.randomRange(0.2, 0.8);
      const detailLength = size * rng.randomRange(0.15, 0.3);
      const detailAngle = rng.randomRange(0, Math.PI * 2);
      
      const detailEndX = detailX + detailLength * Math.cos(detailAngle);
      const detailEndY = detailY + detailLength * Math.sin(detailAngle);
      
      let detailPoints: Point[] = [
        { x: detailX, y: detailY },
        { x: detailEndX, y: detailEndY }
      ];
      
      if (jitterMm > 0) {
        detailPoints = applyLineJitter(detailPoints, jitterMm * 0.3, rng, true);
      }
      paths.push(pointsToPath(detailPoints, false));
    }
  }
  
  return paths;
}

/**
 * Draws a sunflower with green stem and yellow flower with black center
 * Returns object with separate paths for stem and flower
 */
export function drawSunflower(
  centerX: number,
  baseY: number,
  flowerSize: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): { stemPaths: string[]; flowerPaths: string[]; centerPaths: string[] } {
  const stemPaths: string[] = [];
  const flowerPaths: string[] = [];
  const centerPaths: string[] = [];
  
  if (!rng) return { stemPaths, flowerPaths, centerPaths };
  
  // Stem (green) - taller than regular flowers
  const stemHeight = flowerSize * 2.5;
  const stemCurve = rng.randomRange(-flowerSize * 0.15, flowerSize * 0.15);
  
  let stemPoints: Point[] = [
    { x: centerX, y: baseY },
    { x: centerX + stemCurve * 0.3, y: baseY - stemHeight * 0.5 },
    { x: centerX + stemCurve, y: baseY - stemHeight }
  ];
  
  stemPoints = smoothLine(stemPoints, 4);
  stemPoints = addRandomSlope(stemPoints, rng, 2);
  
  if (jitterMm > 0) {
    stemPoints = applyLineJitter(stemPoints, jitterMm * 0.5, rng, true);
  }
  stemPaths.push(pointsToPath(stemPoints, false));
  
  // Add leaves on stem (2-3 large leaves)
  const leafCount = rng.randomInt(2, 4);
  for (let i = 0; i < leafCount; i++) {
    const leafY = baseY - stemHeight * rng.randomRange(0.2, 0.8);
    const leafX = centerX + stemCurve * (leafY - baseY) / -stemHeight;
    const leafSide = rng.chance(0.5) ? 1 : -1;
    const leafSize = flowerSize * rng.randomRange(0.3, 0.5); // Larger leaves
    
    // Leaf shape (heart-like, more detailed)
    const leafPoints: Point[] = [];
    const leafSegments = 12;
    for (let j = 0; j <= leafSegments; j++) {
      const t = j / leafSegments;
      const angle = (t - 0.5) * Math.PI * 1.2;
      const radiusX = leafSize * 0.7;
      const radiusY = leafSize;
      leafPoints.push({
        x: leafX + leafSide * radiusX * Math.cos(angle),
        y: leafY + radiusY * Math.sin(angle)
      });
    }
    
    leafPoints.push(leafPoints[0]); // Close leaf
    
    if (jitterMm > 0) {
      const jitteredLeaf = applyLineJitter(leafPoints, jitterMm * 0.3, rng, true);
      stemPaths.push(pointsToPath(jitteredLeaf, false));
    } else {
      stemPaths.push(pointsToPath(leafPoints, false));
    }
  }
  
  // Flower head (yellow) - large and prominent
  const headY = baseY - stemHeight;
  const headRadius = flowerSize * 0.6; // Larger than regular flowers
  
  // Black center circle (separate path for black color)
  const centerRadius = headRadius * 0.4;
  const centerPoints: Point[] = [];
  const centerSegments = 16;
  for (let i = 0; i <= centerSegments; i++) {
    const angle = (i / centerSegments) * Math.PI * 2;
    const radiusVariation = 1 + rng.randomRange(-0.05, 0.05);
    centerPoints.push({
      x: centerX + centerRadius * radiusVariation * Math.cos(angle),
      y: headY + centerRadius * radiusVariation * Math.sin(angle)
    });
  }
  
  if (jitterMm > 0) {
    const jitteredCenter = applyLineJitter(centerPoints, jitterMm * 0.2, rng, true);
    centerPaths.push(pointsToPath(jitteredCenter, false));
  } else {
    centerPaths.push(pointsToPath(centerPoints, false));
  }
  
  // Yellow petals (12-16 petals, larger and more prominent)
  const petalCount = rng.randomInt(12, 16);
  const petalLength = flowerSize * rng.randomRange(0.5, 0.65);
  
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2;
    const petalVariation = rng.randomRange(0.9, 1.1);
    const actualPetalLength = petalLength * petalVariation;
    
    // Create petal with more detail (wider, more curved)
    const petalPoints: Point[] = [];
    const petalSegments = 16;
    
    for (let j = 0; j <= petalSegments; j++) {
      const t = j / petalSegments;
      const petalAngle = angle + (t - 0.5) * (Math.PI / 3); // Wider petal
      const radius = headRadius + actualPetalLength * Math.sin(t * Math.PI);
      
      // Add width variation for more natural look
      const widthVariation = 1 + Math.sin(t * Math.PI * 2) * 0.15;
      
      // Add small irregularities
      const irregularity = rng.randomRange(-0.03, 0.03) * Math.sin(t * Math.PI * 3);
      const radiusWithIrregularity = radius * (1 + irregularity);
      
      petalPoints.push({
        x: centerX + radiusWithIrregularity * widthVariation * Math.cos(petalAngle),
        y: headY + radiusWithIrregularity * widthVariation * Math.sin(petalAngle)
      });
    }
    
    petalPoints.push(petalPoints[0]); // Close petal
    
    if (jitterMm > 0) {
      const jitteredPetal = applyLineJitter(petalPoints, jitterMm * 0.3, rng, true);
      flowerPaths.push(pointsToPath(jitteredPetal, false));
    } else {
      flowerPaths.push(pointsToPath(petalPoints, false));
    }
  }
  
  return { stemPaths, flowerPaths, centerPaths };
}

/**
 * Draws a simple fence with posts, rails, and optional details
 */
export function drawFence(
  startX: number,
  baseY: number,
  length: number,
  postHeight: number,
  postSpacing: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  
  if (!rng) return paths;
  
  const postCount = Math.floor(length / postSpacing) + 1;
  
  // Always show multiple rails for better fence recognition
  const hasBottomRail = true; // Always show bottom rail
  const hasMiddleRail = true; // Always show middle rail
  
  // Track which post gets a sign (30% chance, one per fence section)
  const signPostIndex = rng.chance(0.3) ? rng.randomInt(0, postCount) : -1;
  
  for (let i = 0; i < postCount; i++) {
    const postX = startX + i * postSpacing;
    
    // Post height variation (0.9-1.1 multiplier per post)
    const postHeightVariation = postHeight * rng.randomRange(0.9, 1.1);
    const actualPostTopY = baseY - postHeightVariation;
    
    // Post (vertical line) - always apply irregularity
    let postPoints: Point[] = [
      { x: postX, y: baseY },
      { x: postX, y: actualPostTopY }
    ];
    if (rng) {
      postPoints = addRandomSlope(postPoints, rng, 3);
    }
    
    if (jitterMm > 0 && rng) {
      postPoints = smoothLine(postPoints, 3);
      postPoints = applyLineJitter(postPoints, jitterMm * 0.5, rng, true);
    }
    paths.push(pointsToPath(postPoints, false));
    
    // Add decorative ball/ornament on top of each post for better fence recognition
    const ballRadius = postSpacing * 0.06;
    const ballY = actualPostTopY;
    const ballPoints: Point[] = [];
    for (let b = 0; b <= 12; b++) {
      const angle = (b / 12) * Math.PI * 2;
      const radiusVariation = rng.randomRange(0.85, 1.15);
      ballPoints.push({
        x: postX + ballRadius * radiusVariation * Math.cos(angle),
        y: ballY + ballRadius * radiusVariation * Math.sin(angle)
      });
    }
    const irregularBall = makeIrregularPolygon(ballPoints, rng, 2, 0.4);
    irregularBall.push(irregularBall[0]);
    
    if (jitterMm > 0) {
      paths.push(pointsToPath(applyLineJitter(irregularBall, jitterMm * 0.3, rng, true), false));
    } else {
      paths.push(pointsToPath(irregularBall, false));
    }
    
    // Top rail (horizontal line connecting posts) - always apply irregularity
    if (i < postCount - 1) {
      const nextPostX = startX + (i + 1) * postSpacing;
      // Use the shorter of the two post heights for rail alignment
      const nextPostHeightVariation = postHeight * rng.randomRange(0.9, 1.1);
      const railY = Math.min(actualPostTopY, baseY - nextPostHeightVariation);
      
      let topRailPoints: Point[] = [
        { x: postX, y: railY },
        { x: nextPostX, y: railY }
      ];
      
      // Always apply irregularity
      if (rng) {
        topRailPoints = addRandomSlope(topRailPoints, rng, 3);
      }
      
      if (jitterMm > 0 && rng) {
        topRailPoints = applyLineJitter(topRailPoints, jitterMm * 0.6, rng, true);
      }
      paths.push(pointsToPath(topRailPoints, false));
      
      // Middle rail - always show for better fence recognition
      if (hasMiddleRail) {
        const middleRailY = baseY - postHeight * 0.5;
        let middleRailPoints: Point[] = [
          { x: postX, y: middleRailY },
          { x: nextPostX, y: middleRailY }
        ];
        
        if (rng) {
          middleRailPoints = addRandomSlope(middleRailPoints, rng, 3);
        }
        
        if (jitterMm > 0 && rng) {
          middleRailPoints = applyLineJitter(middleRailPoints, jitterMm * 0.6, rng, true);
        }
        paths.push(pointsToPath(middleRailPoints, false));
      }
      
      // Bottom rail - always show for better fence recognition
      if (hasBottomRail) {
        const bottomRailY = baseY - postHeight * 0.25;
        let bottomRailPoints: Point[] = [
          { x: postX, y: bottomRailY },
          { x: nextPostX, y: bottomRailY }
        ];
        
        if (rng) {
          bottomRailPoints = addRandomSlope(bottomRailPoints, rng, 3);
        }
        
        if (jitterMm > 0 && rng) {
          bottomRailPoints = applyLineJitter(bottomRailPoints, jitterMm * 0.6, rng, true);
        }
        paths.push(pointsToPath(bottomRailPoints, false));
      }
      
      // Add decorative elements between posts (60% chance for better visibility)
      if (rng && rng.chance(0.6)) {
        const decorStyle = rng.randomInt(0, 2);
        const midX = (postX + nextPostX) / 2;
        const midY = baseY - postHeight * 0.5;
        
        if (decorStyle === 0) {
          // Small "X" pattern between posts (kid-style)
          const xSize = postSpacing * 0.15;
          let xLine1: Point[] = [
            { x: midX - xSize, y: midY - xSize },
            { x: midX + xSize, y: midY + xSize }
          ];
          let xLine2: Point[] = [
            { x: midX - xSize, y: midY + xSize },
            { x: midX + xSize, y: midY - xSize }
          ];
          
          xLine1 = addRandomSlope(xLine1, rng, 2);
          xLine2 = addRandomSlope(xLine2, rng, 2);
          
          if (jitterMm > 0) {
            xLine1 = applyLineJitter(xLine1, jitterMm * 0.3, rng, true);
            xLine2 = applyLineJitter(xLine2, jitterMm * 0.3, rng, true);
          }
          paths.push(pointsToPath(xLine1, false));
          paths.push(pointsToPath(xLine2, false));
        } else {
          // Small circle on post
          const circleRadius = postSpacing * 0.08;
          const circlePoints: Point[] = [];
          for (let c = 0; c <= 8; c++) {
            const angle = (c / 8) * Math.PI * 2;
            circlePoints.push({
              x: postX + circleRadius * Math.cos(angle) * rng.randomRange(0.9, 1.1),
              y: midY + circleRadius * Math.sin(angle) * rng.randomRange(0.9, 1.1)
            });
          }
          const irregularCircle = makeIrregularPolygon(circlePoints, rng, 2, 0.3);
          irregularCircle.push(irregularCircle[0]);
          
          if (jitterMm > 0) {
            paths.push(pointsToPath(applyLineJitter(irregularCircle, jitterMm * 0.3, rng, true), false));
          } else {
            paths.push(pointsToPath(irregularCircle, false));
          }
        }
      }
    }
    
    // Add small sign on one post (30% chance, one per fence section)
    if (i === signPostIndex) {
      const signY = baseY - postHeightVariation * 0.4;
      const signWidth = postSpacing * 0.15;
      const signHeight = postSpacing * 0.1;
      const signLeftX = postX - signWidth / 2;
      
      // Create irregular rectangle for sign
      const signPoints: Point[] = [
        { x: signLeftX, y: signY },
        { x: signLeftX + signWidth, y: signY },
        { x: signLeftX + signWidth, y: signY + signHeight },
        { x: signLeftX, y: signY + signHeight },
        { x: signLeftX, y: signY }
      ];
      
      const irregularSign = makeIrregularPolygon(signPoints, rng, 2, 0.3);
      irregularSign.push(irregularSign[0]);
      
      if (jitterMm > 0) {
        paths.push(pointsToPath(applyLineJitter(irregularSign, jitterMm * 0.3, rng, true), false));
      } else {
        paths.push(pointsToPath(irregularSign, false));
      }
    }
  }
  
  return paths;
}

/**
 * Draws a simple mailbox
 */
export function drawMailbox(
  centerX: number,
  baseY: number,
  width: number,
  height: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  
  // Post
  const postWidth = width * 0.15;
  const postHeight = height * 0.3;
  const postX = centerX - postWidth / 2;
  paths.push(...drawRect(postX, baseY - postHeight, postWidth, postHeight, 0, jitterMm, rng));
  
  // Mailbox body (rounded top)
  const boxY = baseY - postHeight - height;
  const boxWidth = width;
  const boxHeight = height;
  
  // Box outline
  let boxPoints: Point[] = [
    { x: centerX - boxWidth / 2, y: boxY },
    { x: centerX + boxWidth / 2, y: boxY },
    { x: centerX + boxWidth / 2, y: boxY + boxHeight * 0.7 }
  ];
  
  // Rounded top
  const topRadius = boxWidth / 2;
  const topSegments = 8;
  for (let i = 0; i <= topSegments; i++) {
    const t = i / topSegments;
    const angle = Math.PI * t;
    boxPoints.push({
      x: centerX + topRadius * Math.cos(angle),
      y: boxY - topRadius * Math.sin(angle)
    });
  }
  
  boxPoints.push({ x: centerX - boxWidth / 2, y: boxY });
  
  if (jitterMm > 0 && rng) {
    const jitteredBox = applyLineJitter(boxPoints, jitterMm * 0.4, rng, true);
    paths.push(pointsToPath(jitteredBox, false));
  } else {
    paths.push(pointsToPath(boxPoints, false));
  }
  
  // Flag (if up)
  if (rng && rng.chance(0.5)) {
    const flagX = centerX + boxWidth / 2;
    const flagY = boxY - boxHeight * 0.2;
    const flagWidth = boxWidth * 0.3;
    const flagHeight = boxHeight * 0.2;
    
    let flagPoints: Point[] = [
      { x: flagX, y: flagY },
      { x: flagX + flagWidth, y: flagY },
      { x: flagX + flagWidth, y: flagY - flagHeight },
      { x: flagX, y: flagY - flagHeight * 0.5 },
      { x: flagX, y: flagY }
    ];
    
    if (jitterMm > 0) {
      flagPoints = applyLineJitter(flagPoints, jitterMm * 0.3, rng, true);
    }
    paths.push(pointsToPath(flagPoints, false));
  }
  
  return paths;
}

/**
 * Draws a simple child-like human figure
 * Simple circle for head, lines for body, arms, and legs
 * Arms have randomized angles for variation
 */
export function drawHumanIcon(
  anchorX: number,
  anchorY: number,
  scaleMm: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  if (!rng) return paths;

  // Scale everything relative to scaleMm (base size ~15mm)
  const s = scaleMm / 15;

  // Head (simple circle)
  const headRadius = 2.5 * s;
  const headY = anchorY - 12 * s; // Head is above anchor point
  const headX = anchorX;

  let headPoints: Point[] = [];
  const headSegments = 16;
  for (let i = 0; i <= headSegments; i++) {
    const angle = (i / headSegments) * Math.PI * 2;
    headPoints.push({
      x: headX + headRadius * Math.cos(angle),
      y: headY + headRadius * Math.sin(angle)
    });
  }

  // Body (vertical line from head to waist)
  const bodyLength = 5 * s;
  const bodyStartY = headY + headRadius;
  const bodyEndY = bodyStartY + bodyLength;
  let bodyPoints: Point[] = [
    { x: anchorX, y: bodyStartY },
    { x: anchorX, y: bodyEndY }
  ];

  // Arms (two lines from shoulders, with randomized angles)
  // From VIEWER's perspective: one hand to canvas LEFT, one to canvas RIGHT
  const shoulderY = bodyStartY + 1 * s;
  const armLength = 4 * s;
  
  // Left hand (viewer's left, canvas left side) - extend to negative X direction
  // Angle around 140-150° (pointing left, tilted down ~10° more), with 5-7° variation
  const leftHandBaseAngle = Math.PI * 7/9; // ~140 degrees (pointing left, tilted down ~10° more from 150°)
  const leftHandVariation = rng.randomRange(-Math.PI * 5/180, Math.PI * 5/180); // ±5 degrees variation
  const leftHandAngle = leftHandBaseAngle + leftHandVariation;
  const leftHandEndX = anchorX + armLength * Math.cos(leftHandAngle); // cos(140°) is negative, so this goes left
  const leftHandEndY = shoulderY + armLength * Math.sin(leftHandAngle);
  let leftArmPoints: Point[] = [
    { x: anchorX, y: shoulderY },
    { x: leftHandEndX, y: leftHandEndY }
  ];

  // Right hand (viewer's right, canvas right side) - extend to positive X direction
  // Angle around 40-50° (pointing right, tilted down ~10° more), with 5-7° variation
  const rightHandBaseAngle = Math.PI * 2/9; // ~40 degrees (pointing right, tilted down ~10° more from 30°)
  const rightHandVariation = rng.randomRange(-Math.PI * 5/180, Math.PI * 5/180); // ±5 degrees variation
  const rightHandAngle = rightHandBaseAngle + rightHandVariation;
  const rightHandEndX = anchorX + armLength * Math.cos(rightHandAngle); // cos(15°) is positive, so this goes right
  const rightHandEndY = shoulderY + armLength * Math.sin(rightHandAngle);
  let rightArmPoints: Point[] = [
    { x: anchorX, y: shoulderY },
    { x: rightHandEndX, y: rightHandEndY }
  ];

  // Hands (simple circles at the end of arms)
  const handRadius = 0.8 * s;
  
  // Left hand (canvas left side)
  let leftHandPoints: Point[] = [];
  const handSegments = 12;
  for (let i = 0; i <= handSegments; i++) {
    const angle = (i / handSegments) * Math.PI * 2;
    leftHandPoints.push({
      x: leftHandEndX + handRadius * Math.cos(angle),
      y: leftHandEndY + handRadius * Math.sin(angle)
    });
  }

  // Right hand (canvas right side)
  let rightHandPoints: Point[] = [];
  for (let i = 0; i <= handSegments; i++) {
    const angle = (i / handSegments) * Math.PI * 2;
    rightHandPoints.push({
      x: rightHandEndX + handRadius * Math.cos(angle),
      y: rightHandEndY + handRadius * Math.sin(angle)
    });
  }

  // Legs (two lines from waist to ground)
  const legLength = 6 * s;
  const legStartY = bodyEndY;
  const legSpread = 2 * s; // How far apart the legs are
  
  // Left leg
  let leftLegPoints: Point[] = [
    { x: anchorX - legSpread * 0.3, y: legStartY },
    { x: anchorX - legSpread, y: anchorY }
  ];

  // Right leg
  let rightLegPoints: Point[] = [
    { x: anchorX + legSpread * 0.3, y: legStartY },
    { x: anchorX + legSpread, y: anchorY }
  ];

  // Apply jitter if specified
  if (jitterMm > 0) {
    headPoints = applyLineJitter(headPoints, jitterMm * 0.8, rng, true);
    bodyPoints = applyLineJitter(bodyPoints, jitterMm * 0.6, rng, true);
    leftArmPoints = applyLineJitter(leftArmPoints, jitterMm * 0.5, rng, true);
    rightArmPoints = applyLineJitter(rightArmPoints, jitterMm * 0.5, rng, true);
    leftLegPoints = applyLineJitter(leftLegPoints, jitterMm * 0.5, rng, true);
    rightLegPoints = applyLineJitter(rightLegPoints, jitterMm * 0.5, rng, true);
    leftHandPoints = applyLineJitter(leftHandPoints, jitterMm * 0.4, rng, true);
    rightHandPoints = applyLineJitter(rightHandPoints, jitterMm * 0.4, rng, true);
  }

  // Create sketchy bold effect by drawing multiple slightly varied versions
  // Each line is drawn 2-3 times with random jitter to create hand-drawn boldness
  const sketchyBoldCount = 3;
  const sketchyJitter = 0.4 * s; // Amount of random variation for sketchy effect

  // Helper to create sketchy bold paths with random variation
  const createSketchyBoldPath = (points: Point[]): string[] => {
    const sketchyPaths: string[] = [];
    for (let i = 0; i < sketchyBoldCount; i++) {
      // Add random jitter to each point for sketchy effect
      const sketchyPoints = points.map(p => ({
        x: p.x + rng.randomRange(-sketchyJitter, sketchyJitter),
        y: p.y + rng.randomRange(-sketchyJitter, sketchyJitter)
      }));
      sketchyPaths.push(pointsToPath(sketchyPoints, false));
    }
    return sketchyPaths;
  };

  // Add all paths with sketchy bold effect
  paths.push(...createSketchyBoldPath(headPoints));
  paths.push(...createSketchyBoldPath(bodyPoints));
  paths.push(...createSketchyBoldPath(leftArmPoints));
  paths.push(...createSketchyBoldPath(rightArmPoints));
  paths.push(...createSketchyBoldPath(leftLegPoints));
  paths.push(...createSketchyBoldPath(rightLegPoints));
  paths.push(...createSketchyBoldPath(leftHandPoints)); // Left hand (canvas left)
  paths.push(...createSketchyBoldPath(rightHandPoints)); // Right hand (canvas right)

  return paths;
}

