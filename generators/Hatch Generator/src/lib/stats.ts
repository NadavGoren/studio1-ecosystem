/**
 * Plotter stats: how many lines are on the canvas and how far the pen travels.
 * Mirrors the draw conditions in svg-export.ts so the numbers match what gets plotted.
 */

import type { Shape, HatchParams } from '../types';
import { shapeToPath } from './geometry';
import { generateAllHatchLines } from './hatching';

export interface CanvasStats {
  /** Number of distinct stroke paths the pen will draw (each hatch line + each rendered outline). */
  lineCount: number;
  /** Total pen-down travel distance, in millimetres. */
  totalLengthMm: number;
}

/**
 * Length of a path built from straight M/L commands (hatch lines are always straight).
 * Numbers are parsed in order: the first pair is the start point, each following pair a line-to.
 */
function polylineLength(d: string): number {
  const nums = d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!nums || nums.length < 4) return 0;
  let len = 0;
  let px = parseFloat(nums[0]);
  let py = parseFloat(nums[1]);
  for (let i = 2; i + 1 < nums.length; i += 2) {
    const x = parseFloat(nums[i]);
    const y = parseFloat(nums[i + 1]);
    len += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return len;
}

// Reused, detached <path> for measuring outlines that contain arcs (ellipses, rounded corners).
let measureEl: SVGPathElement | null = null;

function measurePathLength(d: string): number {
  if (!d) return 0;
  if (typeof document !== 'undefined') {
    try {
      if (!measureEl) {
        measureEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      }
      measureEl.setAttribute('d', d);
      const len = measureEl.getTotalLength();
      if (isFinite(len)) return len;
    } catch {
      // Fall through to the straight-line approximation.
    }
  }
  return polylineLength(d);
}

/**
 * Compute stats for everything that will actually be drawn/exported.
 * Zig-zag hatching merges a fill into one continuous path, so it counts as a single line.
 */
export function computeCanvasStats(
  shapes: Shape[],
  hatchParams: Record<string, HatchParams>
): CanvasStats {
  let lineCount = 0;
  let totalLengthMm = 0;

  for (const shape of shapes) {
    if (!shape.visible) continue;
    const params = hatchParams[shape.id];

    // Hatch lines — straight segments, so measure analytically (fast even on dense fills).
    if (params && params.enabled) {
      const hatchPaths = generateAllHatchLines(shape, params);
      for (const d of hatchPaths) {
        lineCount++;
        totalLengthMm += polylineLength(d);
      }
    }

    // Outline — may contain arcs, so measure precisely. Groups are containers, never plotted.
    const shouldRenderOutline = params?.renderOutline || shape.type === 'line' || !params?.enabled;
    if (shouldRenderOutline && shape.type !== 'group') {
      const d = shapeToPath(shape, shapes);
      if (d) {
        lineCount++;
        totalLengthMm += measurePathLength(d);
      }
    }
  }

  return { lineCount, totalLengthMm };
}

/** Human-friendly length: metres for long plots, centimetres in the middle, millimetres when tiny. */
export function formatLength(mm: number): string {
  if (!isFinite(mm) || mm <= 0) return '0 mm';
  if (mm >= 1000) return `${(mm / 1000).toFixed(2)} m`;
  if (mm >= 10) return `${(mm / 10).toFixed(1)} cm`;
  return `${mm.toFixed(1)} mm`;
}
