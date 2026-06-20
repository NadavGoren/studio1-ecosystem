/**
 * SVG export utilities
 * Ensures all exports use explicit mm units and include hatching
 */

import type { ProjectState } from '../types';
import { shapeToPath } from './geometry';
import { generateAllHatchLines } from './hatching';

/**
 * Export project to SVG with explicit mm units
 * Includes Hatch Lines and respects Global Stroke Width
 */
export function exportToSVG(state: ProjectState): string {
  const { paper, shapes, hatchParams } = state;
  const width = paper.width;
  const height = paper.height;
  const defaultStrokeWidth = paper.globalStrokeWidth || 0.1; // Fallback when a shape has no width
  
  // SVG header with explicit mm units
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     width="${width}mm" 
     height="${height}mm" 
     viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      /* Default styles if inline attributes are missing */
      .shape { fill: none; stroke-linecap: round; stroke-linejoin: round; }
    </style>
  </defs>
  <g id="paper">
    <rect x="0" y="0" width="${width}" height="${height}" fill="white" stroke="#ccc" stroke-width="0.1"/>
    
    <rect 
      x="${paper.margin}" 
      y="${paper.margin}" 
      width="${width - paper.margin * 2}" 
      height="${height - paper.margin * 2}" 
      fill="none" 
      stroke="#ddd" 
      stroke-width="0.1" 
      stroke-dasharray="2,2"/>
`;

  // Export shapes
  shapes.forEach((shape) => {
    if (!shape.visible) return;
    
    const params = hatchParams[shape.id];
    // Use global color if override is enabled, otherwise use shape's color
    const color = paper.globalColorOverride ? paper.globalColor : (shape.color || '#000000');
    // Each shape carries its own stroke width; fall back to the global default if unset.
    const strokeWidth = shape.strokeWidth ?? defaultStrokeWidth;

    // 1. Generate Hatch Paths
    if (params && params.enabled) {
      const hatchPaths = generateAllHatchLines(shape, params);
      hatchPaths.forEach(d => {
        svg += `    <path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" />\n`;
      });
    }
    
    // 2. Generate Outline Path
    // Render outline if explicitly enabled OR if it's a Line (lines always need outlines)
    // Note: Rectangle/Circle/Polygon/Polyline respect renderOutline setting
    const shouldRenderOutline = params?.renderOutline || shape.type === 'line' || !params?.enabled;
    
    if (shouldRenderOutline) {
      const path = shapeToPath(shape, shapes);
      if (path) {
        svg += `    <path d="${path}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" />\n`;
      }
    }
  });
  
  svg += `  </g>
</svg>`;
  
  return svg;
}

/**
 * Download SVG file
 */
export function downloadSVG(svgContent: string, filename: string = 'hatchstudio-export.svg'): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

