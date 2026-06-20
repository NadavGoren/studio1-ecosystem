/* ============================================================
   3D ISOMETRIC GRID
   Draws a grid on the floor plane to visualize 3D space
============================================================ */

import { project3DTo2D } from '../core/projection.js';
import { createWavyLine } from '../utils/jitter.js';

/**
 * Draw isometric grid on the floor plane
 * @param {SVGElement} svg - SVG element to draw into
 * @param {Number} floorZ - Z coordinate of floor plane
 * @param {Number} x0 - Canvas left bound
 * @param {Number} y0 - Canvas top bound
 * @param {Number} x1 - Canvas right bound
 * @param {Number} y1 - Canvas bottom bound
 * @param {Number} canvasCenterX - Canvas center X
 * @param {Number} canvasCenterY - Canvas center Y
 * @param {Number} projCenterX - Projection center X
 * @param {Number} projCenterY - Projection center Y
 * @param {String} strokeColor - Grid line color
 * @param {Number} strokeWidth - Base stroke width
 * @param {SVGElement} frame - Frame element to insert after
 * @param {String} viewMode - View mode ('isometric' or 'perspective')
 * @param {Number} perspectiveStrength - Perspective strength (0-1)
 * @param {Number} lineJitter - Line jitter intensity (0-100)
 * @param {Number} jitterFrequency - Wave frequency control (0-100)
 * @param {Number} jitterRandomness - Randomness control (0-100)
 */
export function drawIsometricGrid(svg, floorZ, x0, y0, x1, y1, canvasCenterX, canvasCenterY, projCenterX, projCenterY, strokeColor, strokeWidth, frame, viewMode, perspectiveStrength, lineJitter = 0, jitterFrequency = 50, jitterRandomness = 50) {
  // Grid parameters - scale with canvas size proportionally
  const canvasWidth = x1 - x0;
  const canvasHeight = y1 - y0;
  const canvasDiagonal = Math.sqrt(canvasWidth * canvasWidth + canvasHeight * canvasHeight);
  
  // Scale grid to be proportional to canvas (use a fixed ratio)
  // For A5 (210x148), we want a reasonable grid size
  // Scale factor: use canvas diagonal as reference
  const baseCanvasSize = Math.sqrt(210 * 210 + 148 * 148); // A5 diagonal as reference
  const scaleFactor = canvasDiagonal / baseCanvasSize;
  const baseGridSize = 100; // Base grid size for A5
  
  const gridSize = baseGridSize * scaleFactor;
  const gridSpacing = gridSize / 10; // 10 grid lines across
  const gridOpacity = 0.4; // Grid opacity
  const majorGridSpacing = gridSize / 2; // Major grid lines at half
  const majorGridOpacity = 0.6; // Major grid lines more visible
  
  // Draw grid lines on the floor plane (z = floorZ)
  // Grid lines in X direction (varying Y)
  for (let y = -gridSize; y <= gridSize; y += gridSpacing) {
    // Create line from x = -gridSize to x = +gridSize at y = y, z = floorZ
    const p1_3D = { x: -gridSize, y: y, z: floorZ };
    const p2_3D = { x: gridSize, y: y, z: floorZ };
    
    // Project to 2D
    const p1_2D = project3DTo2D(p1_3D.x, p1_3D.y, p1_3D.z, viewMode, perspectiveStrength);
    const p2_2D = project3DTo2D(p2_3D.x, p2_3D.y, p2_3D.z, viewMode, perspectiveStrength);
    
    // Center on canvas
    const x1 = p1_2D.x - projCenterX + canvasCenterX;
    const y1 = p1_2D.y - projCenterY + canvasCenterY;
    const x2 = p2_2D.x - projCenterX + canvasCenterX;
    const y2 = p2_2D.y - projCenterY + canvasCenterY;
    
    // Determine if this is a major grid line
    const isMajor = Math.abs(y % majorGridSpacing) < 0.1;
    
    // Create wavy line if jitter is enabled, otherwise use straight line
    let line;
    if (lineJitter > 0) {
      const wavyPoints = createWavyLine(x1, y1, x2, y2, lineJitter, jitterFrequency, jitterRandomness);
      const pointsString = wavyPoints.map(p => `${p.x},${p.y}`).join(' ');
      line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      line.setAttribute("points", pointsString);
      line.setAttribute("fill", "none");
    } else {
      line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
    }
    line.setAttribute("stroke", strokeColor);
    line.setAttribute("stroke-width", isMajor ? strokeWidth * 0.7 : strokeWidth * 0.4);
    line.setAttribute("opacity", isMajor ? majorGridOpacity : gridOpacity);
    line.setAttribute("data-preview-only", "true");
    // Insert after frame so it appears behind cube
    svg.insertBefore(line, frame.nextSibling);
  }
  
  // Draw grid lines in Y direction (varying X)
  for (let x = -gridSize; x <= gridSize; x += gridSpacing) {
    // Create line from y = -gridSize to y = +gridSize at x = x, z = floorZ
    const p1_3D = { x: x, y: -gridSize, z: floorZ };
    const p2_3D = { x: x, y: gridSize, z: floorZ };
    
    // Project to 2D
    const p1_2D = project3DTo2D(p1_3D.x, p1_3D.y, p1_3D.z, viewMode, perspectiveStrength);
    const p2_2D = project3DTo2D(p2_3D.x, p2_3D.y, p2_3D.z, viewMode, perspectiveStrength);
    
    // Center on canvas
    const x1 = p1_2D.x - projCenterX + canvasCenterX;
    const y1 = p1_2D.y - projCenterY + canvasCenterY;
    const x2 = p2_2D.x - projCenterX + canvasCenterX;
    const y2 = p2_2D.y - projCenterY + canvasCenterY;
    
    // Determine if this is a major grid line
    const isMajor = Math.abs(x % majorGridSpacing) < 0.1;
    
    // Create wavy line if jitter is enabled, otherwise use straight line
    let line;
    if (lineJitter > 0) {
      const wavyPoints = createWavyLine(x1, y1, x2, y2, lineJitter, jitterFrequency, jitterRandomness);
      const pointsString = wavyPoints.map(p => `${p.x},${p.y}`).join(' ');
      line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      line.setAttribute("points", pointsString);
      line.setAttribute("fill", "none");
    } else {
      line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
    }
    line.setAttribute("stroke", strokeColor);
    line.setAttribute("stroke-width", isMajor ? strokeWidth * 0.7 : strokeWidth * 0.4);
    line.setAttribute("opacity", isMajor ? majorGridOpacity : gridOpacity);
    line.setAttribute("data-preview-only", "true");
    // Insert after frame so it appears behind cube
    svg.insertBefore(line, frame.nextSibling);
  }
  
  // Draw a highlighted floor plane indicator (thick line at origin)
  const originLine1_3D = { x: -50, y: 0, z: floorZ };
  const originLine2_3D = { x: 50, y: 0, z: floorZ };
  const originLine1_2D = project3DTo2D(originLine1_3D.x, originLine1_3D.y, originLine1_3D.z, viewMode, perspectiveStrength);
  const originLine2_2D = project3DTo2D(originLine2_3D.x, originLine2_3D.y, originLine2_3D.z, viewMode, perspectiveStrength);
  const originX1 = originLine1_2D.x - projCenterX + canvasCenterX;
  const originY1 = originLine1_2D.y - projCenterY + canvasCenterY;
  const originX2 = originLine2_2D.x - projCenterX + canvasCenterX;
  const originY2 = originLine2_2D.y - projCenterY + canvasCenterY;
  let originLine;
  if (lineJitter > 0) {
    const wavyPoints = createWavyLine(originX1, originY1, originX2, originY2, lineJitter);
    const pointsString = wavyPoints.map(p => `${p.x},${p.y}`).join(' ');
    originLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    originLine.setAttribute("points", pointsString);
    originLine.setAttribute("fill", "none");
  } else {
    originLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    originLine.setAttribute("x1", originX1);
    originLine.setAttribute("y1", originY1);
    originLine.setAttribute("x2", originX2);
    originLine.setAttribute("y2", originY2);
  }
  originLine.setAttribute("stroke", "#ff0000");
  originLine.setAttribute("stroke-width", strokeWidth * 1.2);
  originLine.setAttribute("opacity", 0.8);
  originLine.setAttribute("data-preview-only", "true");
  svg.insertBefore(originLine, frame.nextSibling);
  
  const originLineY1_3D = { x: 0, y: -50, z: floorZ };
  const originLineY2_3D = { x: 0, y: 50, z: floorZ };
  const originLineY1_2D = project3DTo2D(originLineY1_3D.x, originLineY1_3D.y, originLineY1_3D.z, viewMode, perspectiveStrength);
  const originLineY2_2D = project3DTo2D(originLineY2_3D.x, originLineY2_3D.y, originLineY2_3D.z, viewMode, perspectiveStrength);
  const originY_X1 = originLineY1_2D.x - projCenterX + canvasCenterX;
  const originY_Y1 = originLineY1_2D.y - projCenterY + canvasCenterY;
  const originY_X2 = originLineY2_2D.x - projCenterX + canvasCenterX;
  const originY_Y2 = originLineY2_2D.y - projCenterY + canvasCenterY;
  let originLineY;
  if (lineJitter > 0) {
    const wavyPoints = createWavyLine(originY_X1, originY_Y1, originY_X2, originY_Y2, lineJitter);
    const pointsString = wavyPoints.map(p => `${p.x},${p.y}`).join(' ');
    originLineY = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    originLineY.setAttribute("points", pointsString);
    originLineY.setAttribute("fill", "none");
  } else {
    originLineY = document.createElementNS("http://www.w3.org/2000/svg", "line");
    originLineY.setAttribute("x1", originY_X1);
    originLineY.setAttribute("y1", originY_Y1);
    originLineY.setAttribute("x2", originY_X2);
    originLineY.setAttribute("y2", originY_Y2);
  }
  originLineY.setAttribute("stroke", "#00ff00");
  originLineY.setAttribute("stroke-width", strokeWidth * 1.2);
  originLineY.setAttribute("opacity", 0.8);
  originLineY.setAttribute("data-preview-only", "true");
  svg.insertBefore(originLineY, frame.nextSibling);
  
  // Draw axis lines (X, Y, Z) for reference - make them more visible
  const axisOpacity = 0.8;
  const axisLength = gridSize;
  
  // X axis (red) - along X direction at y=0, z=floorZ
  const xAxis1_3D = { x: -axisLength, y: 0, z: floorZ };
  const xAxis2_3D = { x: axisLength, y: 0, z: floorZ };
  const xAxis1_2D = project3DTo2D(xAxis1_3D.x, xAxis1_3D.y, xAxis1_3D.z, viewMode, perspectiveStrength);
  const xAxis2_2D = project3DTo2D(xAxis2_3D.x, xAxis2_3D.y, xAxis2_3D.z, viewMode, perspectiveStrength);
  const xAxisX1 = xAxis1_2D.x - projCenterX + canvasCenterX;
  const xAxisY1 = xAxis1_2D.y - projCenterY + canvasCenterY;
  const xAxisX2 = xAxis2_2D.x - projCenterX + canvasCenterX;
  const xAxisY2 = xAxis2_2D.y - projCenterY + canvasCenterY;
  let xAxisLine;
  if (lineJitter > 0) {
    const wavyPoints = createWavyLine(xAxisX1, xAxisY1, xAxisX2, xAxisY2, lineJitter);
    const pointsString = wavyPoints.map(p => `${p.x},${p.y}`).join(' ');
    xAxisLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    xAxisLine.setAttribute("points", pointsString);
    xAxisLine.setAttribute("fill", "none");
  } else {
    xAxisLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    xAxisLine.setAttribute("x1", xAxisX1);
    xAxisLine.setAttribute("y1", xAxisY1);
    xAxisLine.setAttribute("x2", xAxisX2);
    xAxisLine.setAttribute("y2", xAxisY2);
  }
  xAxisLine.setAttribute("stroke", "#ff0000");
  xAxisLine.setAttribute("stroke-width", strokeWidth * 1.0);
  xAxisLine.setAttribute("opacity", axisOpacity);
  xAxisLine.setAttribute("data-preview-only", "true");
  svg.insertBefore(xAxisLine, frame.nextSibling);
  
  // Y axis (green) - along Y direction at x=0, z=floorZ
  const yAxis1_3D = { x: 0, y: -axisLength, z: floorZ };
  const yAxis2_3D = { x: 0, y: axisLength, z: floorZ };
  const yAxis1_2D = project3DTo2D(yAxis1_3D.x, yAxis1_3D.y, yAxis1_3D.z, viewMode, perspectiveStrength);
  const yAxis2_2D = project3DTo2D(yAxis2_3D.x, yAxis2_3D.y, yAxis2_3D.z, viewMode, perspectiveStrength);
  const yAxisX1 = yAxis1_2D.x - projCenterX + canvasCenterX;
  const yAxisY1 = yAxis1_2D.y - projCenterY + canvasCenterY;
  const yAxisX2 = yAxis2_2D.x - projCenterX + canvasCenterX;
  const yAxisY2 = yAxis2_2D.y - projCenterY + canvasCenterY;
  let yAxisLine;
  if (lineJitter > 0) {
    const wavyPoints = createWavyLine(yAxisX1, yAxisY1, yAxisX2, yAxisY2, lineJitter);
    const pointsString = wavyPoints.map(p => `${p.x},${p.y}`).join(' ');
    yAxisLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    yAxisLine.setAttribute("points", pointsString);
    yAxisLine.setAttribute("fill", "none");
  } else {
    yAxisLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    yAxisLine.setAttribute("x1", yAxisX1);
    yAxisLine.setAttribute("y1", yAxisY1);
    yAxisLine.setAttribute("x2", yAxisX2);
    yAxisLine.setAttribute("y2", yAxisY2);
  }
  yAxisLine.setAttribute("stroke", "#00ff00");
  yAxisLine.setAttribute("stroke-width", strokeWidth * 1.0);
  yAxisLine.setAttribute("opacity", axisOpacity);
  yAxisLine.setAttribute("data-preview-only", "true");
  svg.insertBefore(yAxisLine, frame.nextSibling);
  
  // Z axis (blue) - vertical line at x=0, y=0, from floor upward
  const zAxis1_3D = { x: 0, y: 0, z: floorZ };
  const zAxis2_3D = { x: 0, y: 0, z: floorZ + axisLength };
  const zAxis1_2D = project3DTo2D(zAxis1_3D.x, zAxis1_3D.y, zAxis1_3D.z, viewMode, perspectiveStrength);
  const zAxis2_2D = project3DTo2D(zAxis2_3D.x, zAxis2_3D.y, zAxis2_3D.z, viewMode, perspectiveStrength);
  const zAxisX1 = zAxis1_2D.x - projCenterX + canvasCenterX;
  const zAxisY1 = zAxis1_2D.y - projCenterY + canvasCenterY;
  const zAxisX2 = zAxis2_2D.x - projCenterX + canvasCenterX;
  const zAxisY2 = zAxis2_2D.y - projCenterY + canvasCenterY;
  let zAxisLine;
  if (lineJitter > 0) {
    const wavyPoints = createWavyLine(zAxisX1, zAxisY1, zAxisX2, zAxisY2, lineJitter);
    const pointsString = wavyPoints.map(p => `${p.x},${p.y}`).join(' ');
    zAxisLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    zAxisLine.setAttribute("points", pointsString);
    zAxisLine.setAttribute("fill", "none");
  } else {
    zAxisLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    zAxisLine.setAttribute("x1", zAxisX1);
    zAxisLine.setAttribute("y1", zAxisY1);
    zAxisLine.setAttribute("x2", zAxisX2);
    zAxisLine.setAttribute("y2", zAxisY2);
  }
  zAxisLine.setAttribute("stroke", "#0000ff");
  zAxisLine.setAttribute("stroke-width", strokeWidth * 1.0);
  zAxisLine.setAttribute("opacity", axisOpacity);
  zAxisLine.setAttribute("data-preview-only", "true");
  svg.insertBefore(zAxisLine, frame.nextSibling);
  
  // Add axis labels
  const labelOffset = 15; // Offset for labels from axis endpoints
  const labelFontSize = 12;
  
  // X axis label (at positive end)
  const xLabelPos_3D = { x: axisLength + labelOffset, y: 0, z: floorZ };
  const xLabelPos_2D = project3DTo2D(xLabelPos_3D.x, xLabelPos_3D.y, xLabelPos_3D.z, viewMode, perspectiveStrength);
  const xLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  xLabel.setAttribute("x", xLabelPos_2D.x - projCenterX + canvasCenterX);
  xLabel.setAttribute("y", xLabelPos_2D.y - projCenterY + canvasCenterY);
  xLabel.setAttribute("fill", "#ff0000");
  xLabel.setAttribute("font-size", labelFontSize);
  xLabel.setAttribute("font-weight", "bold");
  xLabel.setAttribute("text-anchor", "middle");
  xLabel.setAttribute("data-preview-only", "true");
  xLabel.textContent = "X";
  svg.insertBefore(xLabel, frame.nextSibling);
  
  // Y axis label (at positive end)
  const yLabelPos_3D = { x: 0, y: axisLength + labelOffset, z: floorZ };
  const yLabelPos_2D = project3DTo2D(yLabelPos_3D.x, yLabelPos_3D.y, yLabelPos_3D.z, viewMode, perspectiveStrength);
  const yLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  yLabel.setAttribute("x", yLabelPos_2D.x - projCenterX + canvasCenterX);
  yLabel.setAttribute("y", yLabelPos_2D.y - projCenterY + canvasCenterY);
  yLabel.setAttribute("fill", "#00ff00");
  yLabel.setAttribute("font-size", labelFontSize);
  yLabel.setAttribute("font-weight", "bold");
  yLabel.setAttribute("text-anchor", "middle");
  yLabel.setAttribute("data-preview-only", "true");
  yLabel.textContent = "Y";
  svg.insertBefore(yLabel, frame.nextSibling);
  
  // Z axis label (at top end)
  const zLabelPos_3D = { x: 0, y: 0, z: floorZ + axisLength + labelOffset };
  const zLabelPos_2D = project3DTo2D(zLabelPos_3D.x, zLabelPos_3D.y, zLabelPos_3D.z, viewMode, perspectiveStrength);
  const zLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  zLabel.setAttribute("x", zLabelPos_2D.x - projCenterX + canvasCenterX);
  zLabel.setAttribute("y", zLabelPos_2D.y - projCenterY + canvasCenterY);
  zLabel.setAttribute("fill", "#0000ff");
  zLabel.setAttribute("font-size", labelFontSize);
  zLabel.setAttribute("font-weight", "bold");
  zLabel.setAttribute("text-anchor", "middle");
  zLabel.setAttribute("data-preview-only", "true");
  zLabel.textContent = "Z";
  svg.insertBefore(zLabel, frame.nextSibling);
  
  // Draw a reference plane above the floor to show depth
  const refPlaneZ = floorZ + 50; // 50mm above floor
  for (let y = -gridSize; y <= gridSize; y += majorGridSpacing) {
    const p1_3D = { x: -gridSize, y: y, z: refPlaneZ };
    const p2_3D = { x: gridSize, y: y, z: refPlaneZ };
    const p1_2D = project3DTo2D(p1_3D.x, p1_3D.y, p1_3D.z, viewMode, perspectiveStrength);
    const p2_2D = project3DTo2D(p2_3D.x, p2_3D.y, p2_3D.z, viewMode, perspectiveStrength);
    const refX1 = p1_2D.x - projCenterX + canvasCenterX;
    const refY1 = p1_2D.y - projCenterY + canvasCenterY;
    const refX2 = p2_2D.x - projCenterX + canvasCenterX;
    const refY2 = p2_2D.y - projCenterY + canvasCenterY;
    let line;
    if (lineJitter > 0) {
      const wavyPoints = createWavyLine(refX1, refY1, refX2, refY2, lineJitter);
      const pointsString = wavyPoints.map(p => `${p.x},${p.y}`).join(' ');
      line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      line.setAttribute("points", pointsString);
      line.setAttribute("fill", "none");
    } else {
      line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", refX1);
      line.setAttribute("y1", refY1);
      line.setAttribute("x2", refX2);
      line.setAttribute("y2", refY2);
    }
    line.setAttribute("stroke", "#8888ff");
    line.setAttribute("stroke-width", strokeWidth * 0.3);
    line.setAttribute("opacity", 0.2);
    line.setAttribute("stroke-dasharray", "2,2");
    line.setAttribute("data-preview-only", "true");
    svg.insertBefore(line, frame.nextSibling);
  }
  for (let x = -gridSize; x <= gridSize; x += majorGridSpacing) {
    const p1_3D = { x: x, y: -gridSize, z: refPlaneZ };
    const p2_3D = { x: x, y: gridSize, z: refPlaneZ };
    const p1_2D = project3DTo2D(p1_3D.x, p1_3D.y, p1_3D.z, viewMode, perspectiveStrength);
    const p2_2D = project3DTo2D(p2_3D.x, p2_3D.y, p2_3D.z, viewMode, perspectiveStrength);
    const refX1 = p1_2D.x - projCenterX + canvasCenterX;
    const refY1 = p1_2D.y - projCenterY + canvasCenterY;
    const refX2 = p2_2D.x - projCenterX + canvasCenterX;
    const refY2 = p2_2D.y - projCenterY + canvasCenterY;
    let line;
    if (lineJitter > 0) {
      const wavyPoints = createWavyLine(refX1, refY1, refX2, refY2, lineJitter);
      const pointsString = wavyPoints.map(p => `${p.x},${p.y}`).join(' ');
      line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      line.setAttribute("points", pointsString);
      line.setAttribute("fill", "none");
    } else {
      line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", refX1);
      line.setAttribute("y1", refY1);
      line.setAttribute("x2", refX2);
      line.setAttribute("y2", refY2);
    }
    line.setAttribute("stroke", "#8888ff");
    line.setAttribute("stroke-width", strokeWidth * 0.3);
    line.setAttribute("opacity", 0.2);
    line.setAttribute("stroke-dasharray", "2,2");
    line.setAttribute("data-preview-only", "true");
    svg.insertBefore(line, frame.nextSibling);
  }
}

