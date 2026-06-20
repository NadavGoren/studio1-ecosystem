import type { HomeGeneratorConfig, PathGroup } from '../config/types';
import { resolveCanvasDimensions, createViewBox } from '../utils/canvas';

/**
 * Statistics about the generated SVG
 */
export interface SvgStats {
  lineCount: number;
  totalLengthMm: number;
}

/**
 * Calculate lightweight statistics for path groups.
 * Only computes line count and total drawn length — kept cheap so it
 * can run on every slider change without lagging the preview.
 */
export function calculateSvgStats(pathGroups: PathGroup[]): SvgStats {
  let totalLines = 0;
  let totalLength = 0;

  for (const group of pathGroups) {
    for (const pathData of group.paths) {
      const metrics = analyzePath(pathData);
      totalLines += metrics.subpaths;
      totalLength += metrics.lengthMm;
    }
  }

  return { lineCount: totalLines, totalLengthMm: totalLength };
}

/**
 * Walk an SVG path string and compute its total drawn length and subpath count.
 */
function analyzePath(pathData: string) {
  const commands = pathData.match(/[a-zA-Z][^a-zA-Z]*/g) || [];

  let currentX = 0;
  let currentY = 0;
  let subpathStartX = 0;
  let subpathStartY = 0;
  let lengthMm = 0;
  let subpaths = 0;

  for (const command of commands) {
    const type = command[0];
    const coords = command
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(parseFloat)
      .filter((n) => !isNaN(n));

    if (type === 'M' || type === 'm') {
      for (let i = 0; i < coords.length; i += 2) {
        if (i + 1 >= coords.length) break;
        const targetX = type === 'm' ? currentX + coords[i] : coords[i];
        const targetY = type === 'm' ? currentY + coords[i + 1] : coords[i + 1];
        currentX = targetX;
        currentY = targetY;
        subpathStartX = targetX;
        subpathStartY = targetY;
        subpaths += 1;

        if (i + 2 < coords.length) {
          const lx = type === 'm' ? targetX + coords[i + 2] : coords[i + 2];
          const ly = type === 'm' ? targetY + coords[i + 3] : coords[i + 3];
          lengthMm += Math.hypot(lx - currentX, ly - currentY);
          currentX = lx;
          currentY = ly;
        }
      }
    } else if (type === 'L' || type === 'l') {
      for (let i = 0; i < coords.length; i += 2) {
        if (i + 1 >= coords.length) break;
        const targetX = type === 'l' ? currentX + coords[i] : coords[i];
        const targetY = type === 'l' ? currentY + coords[i + 1] : coords[i + 1];
        lengthMm += Math.hypot(targetX - currentX, targetY - currentY);
        currentX = targetX;
        currentY = targetY;
      }
    } else if (type === 'H' || type === 'h') {
      for (const coord of coords) {
        const targetX = type === 'h' ? currentX + coord : coord;
        lengthMm += Math.abs(targetX - currentX);
        currentX = targetX;
      }
    } else if (type === 'V' || type === 'v') {
      for (const coord of coords) {
        const targetY = type === 'v' ? currentY + coord : coord;
        lengthMm += Math.abs(targetY - currentY);
        currentY = targetY;
      }
    } else if (type === 'A' || type === 'a') {
      for (let i = 0; i < coords.length; i += 7) {
        if (i + 6 >= coords.length) break;
        const rx = coords[i];
        const ry = coords[i + 1];
        const largeArcFlag = coords[i + 3] === 1;
        const targetX = type === 'a' ? currentX + coords[i + 5] : coords[i + 5];
        const targetY = type === 'a' ? currentY + coords[i + 6] : coords[i + 6];

        // Circular approximation — generator only emits quarter-circle arcs
        const radius = Math.max((rx + ry) / 2, 0);
        if (radius === 0) {
          lengthMm += Math.hypot(targetX - currentX, targetY - currentY);
        } else {
          const chord = Math.hypot(targetX - currentX, targetY - currentY);
          const clamped = Math.min(1, Math.max(-1, chord / (2 * radius)));
          let angle = 2 * Math.asin(clamped);
          if (largeArcFlag) angle = 2 * Math.PI - angle;
          lengthMm += radius * angle;
        }
        currentX = targetX;
        currentY = targetY;
      }
    } else if (type === 'Z' || type === 'z') {
      lengthMm += Math.hypot(subpathStartX - currentX, subpathStartY - currentY);
      currentX = subpathStartX;
      currentY = subpathStartY;
    }
  }

  return { lengthMm, subpaths };
}

/**
 * Generates an SVG element from path groups
 */
export function generateHomeSvg(
  config: HomeGeneratorConfig,
  pathGroups: PathGroup[]
): SVGSVGElement {
  const dimensions = resolveCanvasDimensions(config.canvas);
  const viewBox = createViewBox(dimensions.widthMm, dimensions.heightMm);

  // Create SVG element
  // viewBox starts at (0, 0) and spans full canvas including margins
  // This ensures margins are properly centered and respected
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', viewBox);
  // Use viewBox for scaling - don't set explicit width/height for display
  // This allows the SVG to scale proportionally based on container
  // xMidYMid meet: scale to fit, maintain aspect ratio, center both axes
  // This ensures the entire viewBox is visible and centered
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  
  // Store dimensions as data attributes for export (when we need physical size)
  svg.setAttribute('data-width-mm', `${dimensions.widthMm}`);
  svg.setAttribute('data-height-mm', `${dimensions.heightMm}`);

  // Add metadata
  const metadata = document.createElementNS('http://www.w3.org/2000/svg', 'metadata');
  metadata.textContent = `Generated by HOME Generator | Seed: ${config.randomSeed} | Mood: ${config.style.mood}`;
  svg.appendChild(metadata);

  // Add visible margin boundaries for debugging
  const margin = config.canvas.marginMm || 0;
  if (margin > 0) {
    // Draw margin boundary rectangle - THIN BLACK STROKE for visibility
    const boundaryGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    boundaryGroup.setAttribute('data-pen', 'boundary-debug');
    boundaryGroup.setAttribute('stroke', '#000000');
    boundaryGroup.setAttribute('stroke-width', '0.15');
    boundaryGroup.setAttribute('fill', 'none');
    boundaryGroup.setAttribute('stroke-linecap', 'round');
    boundaryGroup.setAttribute('stroke-linejoin', 'round');
    
    // Outer canvas boundary - very thin dashed line
    const outerRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    outerRect.setAttribute('x', '0');
    outerRect.setAttribute('y', '0');
    outerRect.setAttribute('width', dimensions.widthMm.toString());
    outerRect.setAttribute('height', dimensions.heightMm.toString());
    outerRect.setAttribute('stroke', '#000000');
    outerRect.setAttribute('stroke-width', '0.1');
    outerRect.setAttribute('fill', 'none');
    outerRect.setAttribute('stroke-dasharray', '2,2');
    boundaryGroup.appendChild(outerRect);
    
    // Inner margin boundary (drawable area) - very thin solid line
    const innerRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    innerRect.setAttribute('x', margin.toString());
    innerRect.setAttribute('y', margin.toString());
    innerRect.setAttribute('width', (dimensions.widthMm - 2 * margin).toString());
    innerRect.setAttribute('height', (dimensions.heightMm - 2 * margin).toString());
    innerRect.setAttribute('stroke', '#000000');
    innerRect.setAttribute('stroke-width', '0.15');
    innerRect.setAttribute('fill', 'none');
    boundaryGroup.appendChild(innerRect);
    
    // Insert boundary group BEFORE path groups so it appears behind
    svg.insertBefore(boundaryGroup, svg.firstChild);
  }

  // Create groups for each pen role
  for (const group of pathGroups) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('data-pen', group.role);
    g.setAttribute('data-pen-name', group.pen.name);
    g.setAttribute('stroke', group.pen.colorHex);
    g.setAttribute('stroke-width', group.pen.strokeWidthMm.toString());
    g.setAttribute('fill', 'none');
    g.setAttribute('stroke-linecap', 'round');
    g.setAttribute('stroke-linejoin', 'round');

    // Add all paths in this group
    for (const pathData of group.paths) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      g.appendChild(path);
    }

    svg.appendChild(g);
  }

  return svg;
}

/**
 * Converts an SVG element to a string
 */
export function svgToString(svg: SVGSVGElement): string {
  // Restore width/height for export (they were stored as data attributes)
  const widthMm = svg.getAttribute('data-width-mm');
  const heightMm = svg.getAttribute('data-height-mm');
  if (widthMm && heightMm) {
    svg.setAttribute('width', `${widthMm}mm`);
    svg.setAttribute('height', `${heightMm}mm`);
  }
  
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svg);
  
  // Add XML declaration
  svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
  
  return svgString;
}

/**
 * Downloads an SVG element as a file
 */
export function downloadSvg(svg: SVGSVGElement, filename: string): void {
  const svgString = svgToString(svg);
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads an SVG from configuration
 */
export function exportHome(config: HomeGeneratorConfig, pathGroups: PathGroup[]): void {
  const svg = generateHomeSvg(config, pathGroups);
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
  const filename = `home-${config.style.mood}-${config.randomSeed}-${timestamp}.svg`;
  downloadSvg(svg, filename);
}





