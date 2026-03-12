import { Vector2, CanvasConfig } from '../core/types';

/**
 * SVG Line element
 */
export interface SVGLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  layer?: string;
  strokeWidth?: number;
  color?: string;
}

/**
 * SVG Layer
 */
export interface SVGLayer {
  id: string;
  name: string;
  lines: SVGLine[];
}

/**
 * Generate SVG document from lines
 * 
 * @param lines - Array of line segments
 * @param canvas - Canvas configuration
 * @param layers - Optional layer organization
 * @returns SVG string
 */
export function generateSVG(
  lines: SVGLine[],
  canvas: CanvasConfig,
  layers?: SVGLayer[]
): string {
  const { width, height, strokeWidth } = canvas;

  // Create SVG header
  let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
  svg += `<svg\n`;
  svg += `  xmlns="http://www.w3.org/2000/svg"\n`;
  svg += `  xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"\n`;
  svg += `  width="${width}mm"\n`;
  svg += `  height="${height}mm"\n`;
  svg += `  viewBox="0 0 ${width} ${height}"\n`;
  svg += `  version="1.1">\n`;

  // If layers are provided, organize by layers
  if (layers && layers.length > 0) {
    for (const layer of layers) {
      svg += `  <g\n`;
      svg += `    id="${layer.id}"\n`;
      svg += `    inkscape:label="${layer.name}"\n`;
      svg += `    inkscape:groupmode="layer">\n`;

      for (const line of layer.lines) {
        svg += generateLineElement(line, strokeWidth);
      }

      svg += `  </g>\n`;
    }
  } else {
    // No layers, just add all lines
    for (const line of lines) {
      svg += generateLineElement(line, strokeWidth);
    }
  }

  svg += `</svg>\n`;

  return svg;
}

/**
 * Generate a single SVG line element
 */
function generateLineElement(line: SVGLine, defaultStrokeWidth: number): string {
  const sw = line.strokeWidth ?? defaultStrokeWidth;
  const color = line.color ?? '#000000';
  const isHidden = color === '#cccccc' || color === '#CCCCCC';

  // Round to 3 decimal places for cleaner output
  const x1 = line.x1.toFixed(3);
  const y1 = line.y1.toFixed(3);
  const x2 = line.x2.toFixed(3);
  const y2 = line.y2.toFixed(3);

  // Hidden lines: lighter color, dashed, thinner
  if (isHidden) {
    return `    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${sw * 0.5}" stroke-dasharray="2,2" opacity="0.5" />\n`;
  }

  return `    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${sw}" />\n`;
}

/**
 * Convert array of 2D line segments to SVG lines
 */
export function lineSegmentsToSVGLines(
  segments: Array<{ start: Vector2; end: Vector2; type?: string }>,
  strokeWidth?: number,
  color?: string
): SVGLine[] {
  return segments.map((seg) => ({
    x1: seg.start.x,
    y1: seg.start.y,
    x2: seg.end.x,
    y2: seg.end.y,
    layer: seg.type,
    strokeWidth,
    color,
  }));
}

/**
 * Group lines by type/layer
 */
export function groupLinesByLayer(lines: SVGLine[]): SVGLayer[] {
  const layerMap = new Map<string, SVGLine[]>();

  for (const line of lines) {
    const layerName = line.layer || 'default';
    if (!layerMap.has(layerName)) {
      layerMap.set(layerName, []);
    }
    layerMap.get(layerName)!.push(line);
  }

  const layers: SVGLayer[] = [];
  let layerIndex = 0;

  for (const [name, layerLines] of layerMap.entries()) {
    layers.push({
      id: `layer-${layerIndex}`,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      lines: layerLines,
    });
    layerIndex++;
  }

  return layers;
}

/**
 * Calculate total path length (mm)
 */
export function calculateTotalPathLength(lines: SVGLine[]): number {
  let total = 0;

  for (const line of lines) {
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    total += Math.sqrt(dx * dx + dy * dy);
  }

  return total;
}

/**
 * Filter out very short lines (degenerate lines)
 */
export function filterShortLines(lines: SVGLine[], minLength: number = 0.01): SVGLine[] {
  return lines.filter((line) => {
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    return length >= minLength;
  });
}

/**
 * Add canvas boundary rectangle (for preview)
 */
export function addCanvasBoundary(canvas: CanvasConfig): string {
  const { width, height, margins } = canvas;

  let svg = `  <!-- Canvas Boundary (preview only) -->\n`;
  svg += `  <rect x="0" y="0" width="${width}" height="${height}" `;
  svg += `fill="none" stroke="#cccccc" stroke-width="0.5" stroke-dasharray="5,5" />\n`;

  if (margins > 0) {
    svg += `  <!-- Margin Boundary (preview only) -->\n`;
    svg += `  <rect x="${margins}" y="${margins}" width="${width - 2 * margins}" height="${
      height - 2 * margins
    }" `;
    svg += `fill="none" stroke="#999999" stroke-width="0.3" stroke-dasharray="3,3" />\n`;
  }

  return svg;
}
