import type { Point } from '../config/types';
import { pointsToPath, applyLineJitter, smoothLine, breakPath, addRandomSlope, makeIrregularPolygon } from '../utils/math';
import type { SeededRNG } from '../utils/rng';

/**
 * Draws a rectangle with optional corner radius and jitter
 * Always applies irregularity to ensure no perfect geometric shapes
 */
export function drawRect(
  x: number,
  y: number,
  width: number,
  height: number,
  cornerRadiusMm: number = 0,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  if (cornerRadiusMm > 0) {
    return drawRoundedRect(x, y, width, height, cornerRadiusMm, jitterMm, rng);
  }

  let points: Point[] = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
    { x, y }
  ];

  // Always apply irregularity (even when jitterMm=0) to ensure no perfect rectangles
  if (rng) {
    // First make it an irregular polygon
    points = makeIrregularPolygon(points.slice(0, 4), rng, 3, 1.5);
    points.push(points[0]); // Close the polygon
    
    // Then apply random slope to each edge
    points = addRandomSlope(points, rng, 3);
  }

  // Apply additional jitter if specified
  if (jitterMm > 0 && rng) {
    points = smoothLine(points, 3);
    points = applyLineJitter(points, jitterMm, rng, true);
  }

  return [pointsToPath(points, false)];
}

/**
 * Draws a rectangle with rounded corners
 */
function drawRoundedRect(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const r = Math.min(radius, width / 2, height / 2);

  if (jitterMm === 0 || !rng) {
    // Perfect rounded rectangle using SVG arcs
    const path = `
      M ${x + r} ${y}
      L ${x + width - r} ${y}
      A ${r} ${r} 0 0 1 ${x + width} ${y + r}
      L ${x + width} ${y + height - r}
      A ${r} ${r} 0 0 1 ${x + width - r} ${y + height}
      L ${x + r} ${y + height}
      A ${r} ${r} 0 0 1 ${x} ${y + height - r}
      L ${x} ${y + r}
      A ${r} ${r} 0 0 1 ${x + r} ${y}
      Z
    `.replace(/\s+/g, ' ').trim();
    return [path];
  }

  // With jitter, approximate corners with line segments
  const cornerPoints = 8; // points per corner arc
  let points: Point[] = [];

  // Top edge
  points.push({ x: x + r, y });
  points.push({ x: x + width - r, y });

  // Top-right corner
  for (let i = 0; i <= cornerPoints; i++) {
    const angle = (i / cornerPoints) * (Math.PI / 2) - Math.PI / 2;
    points.push({
      x: x + width - r + r * Math.cos(angle),
      y: y + r + r * Math.sin(angle)
    });
  }

  // Right edge
  points.push({ x: x + width, y: y + height - r });

  // Bottom-right corner
  for (let i = 0; i <= cornerPoints; i++) {
    const angle = (i / cornerPoints) * (Math.PI / 2);
    points.push({
      x: x + width - r + r * Math.cos(angle),
      y: y + height - r + r * Math.sin(angle)
    });
  }

  // Bottom edge
  points.push({ x: x + r, y: y + height });

  // Bottom-left corner
  for (let i = 0; i <= cornerPoints; i++) {
    const angle = (i / cornerPoints) * (Math.PI / 2) + Math.PI / 2;
    points.push({
      x: x + r + r * Math.cos(angle),
      y: y + height - r + r * Math.sin(angle)
    });
  }

  // Left edge
  points.push({ x, y: y + r });

  // Top-left corner
  for (let i = 0; i <= cornerPoints; i++) {
    const angle = (i / cornerPoints) * (Math.PI / 2) + Math.PI;
    points.push({
      x: x + r + r * Math.cos(angle),
      y: y + r + r * Math.sin(angle)
    });
  }

  points.push({ x: x + r, y });

  // Always apply irregularity even when jitterMm=0
  if (rng) {
    // Make the rounded rectangle irregular
    points = makeIrregularPolygon(points, rng, 3, 1.5);
    points = addRandomSlope(points, rng, 3);
  }
  
  // Apply additional jitter if specified
  if (jitterMm > 0 && rng) {
    points = applyLineJitter(points, jitterMm, rng, true);
  }
  
  return [pointsToPath(points, false)];
}

/**
 * Draws an isosceles triangle (roof shape)
 * Always applies irregularity to ensure no perfect geometric shapes
 */
export function drawTriangleRoof(
  baseCenterX: number,
  baseY: number,
  width: number,
  height: number,
  jitterMm: number = 0,
  lineBreakProbability: number = 0,
  rng?: SeededRNG
): string[] {
  let points: Point[] = [
    { x: baseCenterX - width / 2, y: baseY },
    { x: baseCenterX, y: baseY - height },
    { x: baseCenterX + width / 2, y: baseY },
    { x: baseCenterX - width / 2, y: baseY }
  ];

  // Always apply irregularity to ensure no perfect triangles
  if (rng) {
    // First make it an irregular polygon with endpoint jitter
    points = makeIrregularPolygon(points.slice(0, 3), rng, 3, 1.5);
    points.push(points[0]); // Close the polygon
    
    // Then apply random slope to each edge
    points = addRandomSlope(points, rng, 3);
  }

  // Apply jitter if specified
  if (jitterMm > 0 && rng) {
    points = smoothLine(points, 4);
    points = applyLineJitter(points, jitterMm, rng, true);
  }

  // Apply line breaks if specified
  if (lineBreakProbability > 0 && rng) {
    const segments = breakPath(points, lineBreakProbability, rng);
    return segments.map(seg => pointsToPath(seg, false));
  }

  return [pointsToPath(points, false)];
}

/**
 * Draws a simple window (glass area only, no crossbars)
 */
export function drawWindow(
  x: number,
  y: number,
  width: number,
  height: number,
  addCrossbars: boolean = true,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];

  // Window frame (inner glass area)
  paths.push(...drawRect(x, y, width, height, 0, jitterMm, rng));

  return paths;
}

/**
 * Draws window crossbars (separate function so they can use brown color)
 * Always applies irregularity to ensure no perfect lines
 */
export function drawWindowCrossbars(
  x: number,
  y: number,
  width: number,
  height: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
    const midX = x + width / 2;
    const midY = y + height / 2;

    // Vertical bar - always apply irregularity
    let vPoints: Point[] = [
      { x: midX, y },
      { x: midX, y: y + height }
    ];
    if (rng) {
      vPoints = addRandomSlope(vPoints, rng, 3); // Always apply, even when jitterMm=0
    }
    if (jitterMm > 0 && rng) {
      vPoints = smoothLine(vPoints, 3);
      vPoints = applyLineJitter(vPoints, jitterMm * 0.5, rng, true);
    }
    paths.push(pointsToPath(vPoints, false));

    // Horizontal bar - always apply irregularity
    let hPoints: Point[] = [
      { x, y: midY },
      { x: x + width, y: midY }
    ];
    if (rng) {
      hPoints = addRandomSlope(hPoints, rng, 3); // Always apply, even when jitterMm=0
    }
    if (jitterMm > 0 && rng) {
      hPoints = smoothLine(hPoints, 3);
      hPoints = applyLineJitter(hPoints, jitterMm * 0.5, rng, true);
    }
    paths.push(pointsToPath(hPoints, false));

  return paths;
}

/**
 * Draws a window frame (thicker outline around window)
 */
export function drawWindowFrame(
  x: number,
  y: number,
  width: number,
  height: number,
  frameWidth: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  const outerX = x - frameWidth;
  const outerY = y - frameWidth;
  const outerWidth = width + 2 * frameWidth;
  const outerHeight = height + 2 * frameWidth;
  
  paths.push(...drawRect(outerX, outerY, outerWidth, outerHeight, 0, jitterMm, rng));
  paths.push(...drawRect(x, y, width, height, 0, jitterMm, rng));
  
  return paths;
}

/**
 * Draws window shutters (on sides of window)
 */
export function drawWindowShutters(
  x: number,
  y: number,
  width: number,
  height: number,
  shutterWidth: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  
  // Left shutter
  const leftX = x - shutterWidth;
  paths.push(...drawRect(leftX, y, shutterWidth, height, 0, jitterMm, rng));
  
  // Right shutter
  const rightX = x + width;
  paths.push(...drawRect(rightX, y, shutterWidth, height, 0, jitterMm, rng));
  
  // Shutter slats (horizontal lines)
  const slatCount = rng ? rng.randomInt(3, 5) : 4;
  const slatSpacing = height / (slatCount + 1);
  
  for (let i = 1; i <= slatCount; i++) {
    const slatY = y + i * slatSpacing;
    let leftSlat: Point[] = [
      { x: leftX, y: slatY },
      { x: leftX + shutterWidth, y: slatY }
    ];
    let rightSlat: Point[] = [
      { x: rightX, y: slatY },
      { x: rightX + shutterWidth, y: slatY }
    ];
    
    // Always apply irregularity
    if (rng) {
      leftSlat = addRandomSlope(leftSlat, rng, 3);
      rightSlat = addRandomSlope(rightSlat, rng, 3);
    }
    
    if (jitterMm > 0 && rng) {
      leftSlat = applyLineJitter(leftSlat, jitterMm * 0.3, rng, true);
      rightSlat = applyLineJitter(rightSlat, jitterMm * 0.3, rng, true);
    }
    paths.push(pointsToPath(leftSlat, false));
    paths.push(pointsToPath(rightSlat, false));
  }
  
  return paths;
}

/**
 * Draws a window sill (ledge below window)
 */
export function drawWindowSill(
  x: number,
  y: number,
  width: number,
  sillDepth: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  const sillY = y;
  const sillHeight = sillDepth * 0.3;
  
  // Top of sill - ensure angular deviation
  let topLine: Point[] = [
    { x: x - sillDepth * 0.2, y: sillY },
    { x: x + width + sillDepth * 0.2, y: sillY }
  ];
  if (rng) {
    topLine = addRandomSlope(topLine, rng, 3);
  }
  
  // Bottom of sill (with perspective) - ensure angular deviation
  let bottomLine: Point[] = [
    { x: x - sillDepth * 0.2, y: sillY + sillHeight },
    { x: x + width + sillDepth * 0.2, y: sillY + sillHeight }
  ];
  if (rng) {
    bottomLine = addRandomSlope(bottomLine, rng, 3);
  }
  
  // Front edge - ensure angular deviation
  let frontLine: Point[] = [
    { x: x + width + sillDepth * 0.2, y: sillY },
    { x: x + width + sillDepth * 0.2, y: sillY + sillHeight }
  ];
  if (rng) {
    frontLine = addRandomSlope(frontLine, rng, 3);
  }
  
  if (jitterMm > 0 && rng) {
    topLine = applyLineJitter(topLine, jitterMm * 0.5, rng, true);
    bottomLine = applyLineJitter(bottomLine, jitterMm * 0.5, rng, true);
    frontLine = applyLineJitter(frontLine, jitterMm * 0.5, rng, true);
  }
  
  paths.push(pointsToPath(topLine, false));
  paths.push(pointsToPath(bottomLine, false));
  paths.push(pointsToPath(frontLine, false));
  
  return paths;
}

/**
 * Draws simple curtains inside window
 */
export function drawWindowCurtains(
  x: number,
  y: number,
  width: number,
  height: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  
  if (!rng) return paths;
  
  // Left curtain
  const curtainWidth = width * 0.4;
  const curtainX = x;
  
  // Curtain top (curved)
  const topPoints: Point[] = [];
  const segments = 8;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const curveY = y + height * 0.1 * Math.sin(t * Math.PI);
    topPoints.push({
      x: curtainX + t * curtainWidth,
      y: curveY
    });
  }
  
  // Curtain body (wavy)
  const bodyPoints: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const waveX = curtainX + t * curtainWidth;
    const waveY = y + height * (0.1 + t * 0.9) + (rng.randomRange(-2, 2) * t);
    bodyPoints.push({ x: waveX, y: waveY });
  }
  
  // Right curtain
  const rightCurtainX = x + width - curtainWidth;
  const rightTopPoints: Point[] = [];
  const rightBodyPoints: Point[] = [];
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const curveY = y + height * 0.1 * Math.sin(t * Math.PI);
    rightTopPoints.push({
      x: rightCurtainX + t * curtainWidth,
      y: curveY
    });
    
    const waveX = rightCurtainX + t * curtainWidth;
    const waveY = y + height * (0.1 + t * 0.9) + (rng.randomRange(-2, 2) * t);
    rightBodyPoints.push({ x: waveX, y: waveY });
  }
  
  if (jitterMm > 0) {
    const jitteredTop = applyLineJitter(topPoints, jitterMm * 0.3, rng, true);
    const jitteredBody = applyLineJitter(bodyPoints, jitterMm * 0.3, rng, true);
    const jitteredRightTop = applyLineJitter(rightTopPoints, jitterMm * 0.3, rng, true);
    const jitteredRightBody = applyLineJitter(rightBodyPoints, jitterMm * 0.3, rng, true);
    
    paths.push(pointsToPath(jitteredTop, false));
    paths.push(pointsToPath(jitteredBody, false));
    paths.push(pointsToPath(jitteredRightTop, false));
    paths.push(pointsToPath(jitteredRightBody, false));
  } else {
    paths.push(pointsToPath(topPoints, false));
    paths.push(pointsToPath(bodyPoints, false));
    paths.push(pointsToPath(rightTopPoints, false));
    paths.push(pointsToPath(rightBodyPoints, false));
  }

  return paths;
}

/**
 * Draws a door with optional rounded top
 */
export function drawDoor(
  x: number,
  y: number,
  width: number,
  height: number,
  cornerRadiusMm: number = 0,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];

  // Door outline
  paths.push(...drawRect(x, y, width, height, cornerRadiusMm, jitterMm, rng));

  // Door knob (small circle)
  const knobX = x + width * 0.75;
  const knobY = y + height * 0.5;
  const knobRadius = Math.min(width, height) * 0.06;

  if (jitterMm === 0 || !rng) {
    paths.push(`M ${knobX + knobRadius} ${knobY} A ${knobRadius} ${knobRadius} 0 1 1 ${knobX - knobRadius} ${knobY} A ${knobRadius} ${knobRadius} 0 1 1 ${knobX + knobRadius} ${knobY}`);
  } else {
    // Approximate circle with points
    const circlePoints: Point[] = [];
    const segments = 16;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      circlePoints.push({
        x: knobX + knobRadius * Math.cos(angle),
        y: knobY + knobRadius * Math.sin(angle)
      });
    }
    const jitteredCircle = applyLineJitter(circlePoints, jitterMm * 0.3, rng, true);
    paths.push(pointsToPath(jitteredCircle, false));
  }

  return paths;
}

/**
 * Draws door panels (rectangular divisions)
 */
export function drawDoorPanels(
  x: number,
  y: number,
  width: number,
  height: number,
  panelCount: number = 2,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  
  if (panelCount === 2) {
    // Two panels side by side
    const panelWidth = width / 2;
    const panelHeight = height * 0.7;
    const panelY = y + height * 0.15;
    
    // Left panel
    paths.push(...drawRect(x + width * 0.1, panelY, panelWidth * 0.8, panelHeight, 0, jitterMm, rng));
    // Right panel
    paths.push(...drawRect(x + width * 0.5 + width * 0.1, panelY, panelWidth * 0.8, panelHeight, 0, jitterMm, rng));
  } else if (panelCount === 4) {
    // Four panels (2x2 grid)
    const panelWidth = width * 0.4;
    const panelHeight = height * 0.3;
    const spacingX = width * 0.1;
    const spacingY = height * 0.1;
    
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const panelX = x + spacingX + col * (panelWidth + spacingX);
        const panelY = y + spacingY + row * (panelHeight + spacingY);
        paths.push(...drawRect(panelX, panelY, panelWidth, panelHeight, 0, jitterMm, rng));
      }
    }
  }
  
  return paths;
}

/**
 * Draws door frame (thicker outline around door)
 */
export function drawDoorFrame(
  x: number,
  y: number,
  width: number,
  height: number,
  frameWidth: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  const outerX = x - frameWidth;
  const outerY = y - frameWidth;
  const outerWidth = width + 2 * frameWidth;
  const outerHeight = height + 2 * frameWidth;
  
  paths.push(...drawRect(outerX, outerY, outerWidth, outerHeight, 0, jitterMm, rng));
  
  return paths;
}

/**
 * Draws door threshold (step at bottom)
 * Always applies irregularity to ensure no perfect lines
 */
export function drawDoorThreshold(
  x: number,
  y: number,
  width: number,
  thresholdHeight: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  const thresholdY = y;
  
  // Top line - always apply irregularity
  let topLine: Point[] = [
    { x: x - width * 0.1, y: thresholdY },
    { x: x + width * 1.1, y: thresholdY }
  ];
  if (rng) {
    topLine = addRandomSlope(topLine, rng, 3);
  }
  
  // Bottom line - always apply irregularity
  let bottomLine: Point[] = [
    { x: x - width * 0.1, y: thresholdY + thresholdHeight },
    { x: x + width * 1.1, y: thresholdY + thresholdHeight }
  ];
  if (rng) {
    bottomLine = addRandomSlope(bottomLine, rng, 3);
  }
  
  if (jitterMm > 0 && rng) {
    topLine = applyLineJitter(topLine, jitterMm * 0.5, rng, true);
    bottomLine = applyLineJitter(bottomLine, jitterMm * 0.5, rng, true);
  }
  
  paths.push(pointsToPath(topLine, false));
  paths.push(pointsToPath(bottomLine, false));
  
  return paths;
}

/**
 * Draws roof tiles/shingles following the triangle roof shape
 * Enhanced with varied spacing, jittered angles, and childlike imperfections
 */
export function drawRoofTiles(
  baseCenterX: number,
  baseY: number,
  width: number,
  height: number,
  tileHeight: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  
  if (!rng) return paths;
  
  // Calculate number of tile rows with varied spacing (10-20% variation)
  const baseTileHeight = tileHeight;
  const rowCount = Math.ceil(height / baseTileHeight);
  
  // Triangle vertices for calculating tile positions
  const leftBase = { x: baseCenterX - width / 2, y: baseY };
  const peak = { x: baseCenterX, y: baseY - height };
  const rightBase = { x: baseCenterX + width / 2, y: baseY };
  
  let currentY = baseY;
  for (let row = 0; row < rowCount; row++) {
    // Add 10-20% random variation to tile height spacing
    const tileHeightVariation = baseTileHeight * rng.randomRange(0.9, 1.1);
    currentY -= tileHeightVariation;
    
    const t = (baseY - currentY) / height; // 0 at base, 1 at peak
    
    // Calculate row width based on triangle shape
    // At base: full width, at peak: 0 width
    const rowWidth = width * (1 - t);
    const rowX = baseCenterX - rowWidth / 2;
    
    // Skip if row is too narrow
    if (rowWidth < tileHeight * 0.5) continue;
    
    // Each row has overlapping tiles with varied spacing
    const baseTileWidth = rowWidth * 0.25;
    const tileSpacingVariation = rng.randomRange(0.85, 1.15); // 15% variation
    const tileWidth = baseTileWidth * tileSpacingVariation;
    const tileCount = Math.ceil(rowWidth / (tileWidth * 0.6));
    
    let currentX = rowX;
    for (let i = 0; i < tileCount; i++) {
      // Add spacing variation (10-20% random offset)
      const spacingVariation = tileWidth * 0.6 * rng.randomRange(0.9, 1.1);
      currentX += spacingVariation;
      
      if (currentX > rowX + rowWidth) break;
      
      // Calculate tile corners following the triangle slope
      // Left edge: from leftBase to peak
      const leftT = t;
      const leftX = leftBase.x + (peak.x - leftBase.x) * leftT;
      const leftY = leftBase.y + (peak.y - leftBase.y) * leftT;
      
      // Right edge: from rightBase to peak  
      const rightT = t;
      const rightX = rightBase.x + (peak.x - rightBase.x) * rightT;
      const rightY = rightBase.y + (peak.y - rightBase.y) * rightT;
      
      // Calculate tile position within the row
      const tileProgress = (currentX - rowX) / rowWidth;
      const tileCenterX = leftX + (rightX - leftX) * tileProgress;
      const tileCenterY = leftY + (rightY - leftY) * tileProgress;
      
      // Tile dimensions with variation (slightly smaller for overlap)
      const actualTileWidth = tileWidth * rng.randomRange(0.85, 0.95);
      const actualTileHeight = tileHeightVariation * rng.randomRange(0.85, 0.95);
      
      // Add angle variation (±2-3°) to tile orientation
      const angleVariation = rng.randomRange(-3 * Math.PI / 180, 3 * Math.PI / 180);
      const cos = Math.cos(angleVariation);
      const sin = Math.sin(angleVariation);
      
      // Calculate tile corners relative to center with angle variation
      const halfWidth = actualTileWidth / 2;
      const halfHeight = actualTileHeight / 2;
      
      // Rotate tile corners
      const corners = [
        { x: -halfWidth, y: halfHeight },   // Bottom left
        { x: halfWidth, y: halfHeight },    // Bottom right
        { x: halfWidth, y: -halfHeight },   // Top right
        { x: -halfWidth, y: -halfHeight }  // Top left
      ];
      
      const tilePoints: Point[] = corners.map(corner => ({
        x: tileCenterX + corner.x * cos - corner.y * sin,
        y: tileCenterY + corner.x * sin + corner.y * cos
      }));
      tilePoints.push(tilePoints[0]); // Close the polygon
      
      // Always apply irregularity to tile edges
      const irregularTile = makeIrregularPolygon(tilePoints.slice(0, 4), rng, 2, 0.8);
      irregularTile.push(irregularTile[0]);
      
      // Apply additional jitter if specified
      if (jitterMm > 0) {
        const jitteredTile = applyLineJitter(irregularTile, jitterMm * 0.3, rng, true);
        paths.push(pointsToPath(jitteredTile, false));
      } else {
        paths.push(pointsToPath(irregularTile, false));
      }
    }
  }
  
  return paths;
}

/**
 * Draws a chimney
 */
export function drawChimney(
  x: number,
  y: number,
  width: number,
  height: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  
  // Chimney body
  paths.push(...drawRect(x, y, width, height, 0, jitterMm, rng));
  
  // Chimney top (slightly wider)
  const topWidth = width * 1.2;
  const topX = x - (topWidth - width) / 2;
  const topHeight = height * 0.15;
  paths.push(...drawRect(topX, y - height, topWidth, topHeight, 0, jitterMm, rng));
  
  return paths;
}

/**
 * Draws roof overhang (3D perspective effect)
 * Always applies irregularity to ensure no perfect lines
 */
export function drawRoofOverhang(
  baseCenterX: number,
  baseY: number,
  width: number,
  overhangDepth: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  
  // Bottom edge of overhang (slightly lower and wider)
  const overhangWidth = width * 1.1;
  const overhangY = baseY + overhangDepth * 0.3;
  
  let overhangLine: Point[] = [
    { x: baseCenterX - overhangWidth / 2, y: overhangY },
    { x: baseCenterX + overhangWidth / 2, y: overhangY }
  ];
  
  // Always apply irregularity
  if (rng) {
    overhangLine = addRandomSlope(overhangLine, rng, 3);
  }
  
  if (jitterMm > 0 && rng) {
    overhangLine = applyLineJitter(overhangLine, jitterMm * 0.5, rng, true);
  }
  
  paths.push(pointsToPath(overhangLine, false));
  
  return paths;
}

/**
 * Draws roof ridge line (top edge)
 * Always applies irregularity to ensure no perfect lines
 */
export function drawRoofRidge(
  baseCenterX: number,
  baseY: number,
  height: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  const ridgeY = baseY - height;
  
  // Simple horizontal line at top - always apply irregularity
  let ridgeLine: Point[] = [
    { x: baseCenterX - 5, y: ridgeY },
    { x: baseCenterX + 5, y: ridgeY }
  ];
  
  // Always apply irregularity
  if (rng) {
    ridgeLine = addRandomSlope(ridgeLine, rng, 3);
  }
  
  if (jitterMm > 0 && rng) {
    ridgeLine = applyLineJitter(ridgeLine, jitterMm * 0.3, rng, true);
  }
  
  paths.push(pointsToPath(ridgeLine, false));
  
  return paths;
}

/**
 * Draws childlike brick pattern on house walls
 * Creates jittered horizontal lines (brick rows) and imperfect vertical separators
 * with varied spacing, staggered pattern, and hand-drawn imperfections
 */
export function drawHouseSiding(
  x: number,
  y: number,
  width: number,
  height: number,
  boardHeight: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  if (!rng) return paths;
  
  // Brick row height with 10-15% variation
  const baseBrickHeight = boardHeight;
  const brickRowCount = Math.floor(height / baseBrickHeight);
  
  // Draw horizontal brick row lines with varied spacing
  let currentY = y;
  for (let row = 0; row < brickRowCount; row++) {
    // Add 10-15% random variation to row spacing
    const rowHeightVariation = baseBrickHeight * rng.randomRange(0.9, 1.1);
    currentY += rowHeightVariation;
    
    if (currentY > y + height) break;
    
    // Draw horizontal line for brick row (always jittered)
    let rowLine: Point[] = [
      { x: x, y: currentY },
      { x: x + width, y: currentY }
    ];
    
    // Always apply irregularity
    rowLine = addRandomSlope(rowLine, rng, 3);
    if (jitterMm > 0) {
      rowLine = applyLineJitter(rowLine, jitterMm * 0.7, rng, true); // Increased for better visibility
    }
    
    // Ensure line stays within bounds
    rowLine = rowLine.map(pt => ({
      x: Math.max(x, Math.min(x + width, pt.x)),
      y: pt.y
    }));
    
    paths.push(pointsToPath(rowLine, false));
  }
  
  // Draw vertical brick separators with staggered pattern
  // Base brick width with 10-15% variation
  const baseBrickWidth = width * rng.randomRange(0.15, 0.25);
  const brickCount = Math.ceil(width / baseBrickWidth);
  
  // Staggered pattern: offset every other row by half a brick
  let currentX = x;
  let rowOffset = 0;
  
  for (let row = 0; row < brickRowCount; row++) {
    // Alternate row offset for staggered pattern
    if (row % 2 === 1) {
      rowOffset = baseBrickWidth * 0.5;
    } else {
      rowOffset = 0;
    }
    
    const rowY = y + row * baseBrickHeight;
    const nextRowY = y + (row + 1) * baseBrickHeight;
    
    // Draw vertical separators for this row
    currentX = x + rowOffset;
    let brickIndex = 0;
    
    while (currentX < x + width && brickIndex < brickCount * 2) {
      // Add more variation to brick width (20% variation for kid-style imperfection)
      const brickWidthVariation = baseBrickWidth * rng.randomRange(0.8, 1.2); // Increased from 0.9-1.1
      currentX += brickWidthVariation;
      
      if (currentX > x + width) break;
      
      // Add small gap between bricks (1-2mm)
      const gapSize = rng.randomRange(1, 2);
      currentX += gapSize;
      
      // Occasional missing bricks (5% chance per brick position) for kid-style imperfection
      if (rng.chance(0.05)) {
        brickIndex++;
        continue; // Skip this brick
      }
      
      // Draw vertical separator line (imperfect, jittered)
      // Only draw if it's within bounds
      if (currentX >= x && currentX <= x + width) {
        // Make vertical separators slightly longer for better visibility
        const verticalStartY = Math.max(y, rowY - baseBrickHeight * 0.1);
        const verticalEndY = Math.min(y + height, nextRowY + baseBrickHeight * 0.1);
        
        let verticalLine: Point[] = [
          { x: currentX, y: verticalStartY },
          { x: currentX, y: verticalEndY }
        ];
        
        // Always apply irregularity
        verticalLine = addRandomSlope(verticalLine, rng, 3);
        if (jitterMm > 0) {
          verticalLine = applyLineJitter(verticalLine, jitterMm * 0.6, rng, true); // Increased for better visibility
        }
        
        // Ensure line stays within bounds
        verticalLine = verticalLine.map(pt => ({
          x: Math.max(x, Math.min(x + width, pt.x)),
          y: Math.max(y, Math.min(y + height, pt.y))
        }));
        
        paths.push(pointsToPath(verticalLine, false));
      }
      
      brickIndex++;
    }
  }
  
  return paths;
}

/**
 * Draws corner details (vertical lines at house corners)
 */
export function drawCornerDetails(
  x: number,
  y: number,
  width: number,
  height: number,
  cornerWidth: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  
  // Left corner - always apply irregularity
  let leftCorner: Point[] = [
    { x: x, y: y },
    { x: x, y: y + height }
  ];
  if (rng) {
    leftCorner = addRandomSlope(leftCorner, rng, 3);
  }
  
  // Right corner - always apply irregularity
  let rightCorner: Point[] = [
    { x: x + width, y: y },
    { x: x + width, y: y + height }
  ];
  if (rng) {
    rightCorner = addRandomSlope(rightCorner, rng, 3);
  }
  
  if (jitterMm > 0 && rng) {
    leftCorner = applyLineJitter(leftCorner, jitterMm * 0.3, rng, true);
    rightCorner = applyLineJitter(rightCorner, jitterMm * 0.3, rng, true);
  }
  
  paths.push(pointsToPath(leftCorner, false));
  paths.push(pointsToPath(rightCorner, false));
  
  return paths;
}

/**
 * Draws foundation line (at bottom of house)
 * Always applies irregularity to ensure no perfect lines
 */
export function drawFoundation(
  x: number,
  y: number,
  width: number,
  foundationHeight: number,
  jitterMm: number = 0,
  rng?: SeededRNG
): string[] {
  const paths: string[] = [];
  const foundationY = y;
  
  // Top line - always apply irregularity
  let topLine: Point[] = [
    { x: x, y: foundationY },
    { x: x + width, y: foundationY }
  ];
  if (rng) {
    topLine = addRandomSlope(topLine, rng, 3);
  }
  
  // Bottom line - always apply irregularity
  let bottomLine: Point[] = [
    { x: x, y: foundationY + foundationHeight },
    { x: x + width, y: foundationY + foundationHeight }
  ];
  if (rng) {
    bottomLine = addRandomSlope(bottomLine, rng, 3);
  }
  
  if (jitterMm > 0 && rng) {
    topLine = applyLineJitter(topLine, jitterMm * 0.5, rng, true);
    bottomLine = applyLineJitter(bottomLine, jitterMm * 0.5, rng, true);
  }
  
  paths.push(pointsToPath(topLine, false));
  paths.push(pointsToPath(bottomLine, false));
  
  return paths;
}





