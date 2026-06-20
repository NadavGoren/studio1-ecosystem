import type { CanvasConfig } from '../config/types';
import { PAPER_SIZES } from '../config/defaults';

/**
 * Resolves the actual canvas dimensions in millimeters
 * based on the canvas configuration
 */
export function resolveCanvasDimensions(config: CanvasConfig): { 
  widthMm: number; 
  heightMm: number; 
} {
  let widthMm: number;
  let heightMm: number;

  if (config.preset === 'CUSTOM') {
    widthMm = config.widthMm;
    heightMm = config.heightMm;
  } else {
    const size = PAPER_SIZES[config.preset];
    widthMm = size.width;
    heightMm = size.height;
  }

  // Apply orientation
  if (config.orientation === 'landscape') {
    return { widthMm: heightMm, heightMm: widthMm };
  }

  return { widthMm, heightMm };
}

/**
 * Creates an SVG viewBox attribute value from canvas dimensions
 */
export function createViewBox(widthMm: number, heightMm: number): string {
  return `0 0 ${widthMm} ${heightMm}`;
}






