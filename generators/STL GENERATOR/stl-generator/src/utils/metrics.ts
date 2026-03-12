import { HatchLine, ProjectedEdge, Metrics } from '../core/types';
import { SVGLine } from '../export/svgGenerator';

/**
 * Calculate total path length from lines
 */
function calculatePathLength(lines: HatchLine[]): number {
  return lines.reduce((total, line) => {
    const length = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
    return total + length;
  }, 0);
}

/**
 * Calculate total path length from SVG lines
 */
function calculateSVGPathLength(lines: SVGLine[]): number {
  return lines.reduce((total, line) => {
    const length = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
    return total + length;
  }, 0);
}

/**
 * Calculate total path length from edges
 */
function calculateEdgeLength(edges: ProjectedEdge[]): number {
  return edges.reduce((total, edge) => {
    const length = Math.hypot(edge.v2.x - edge.v1.x, edge.v2.y - edge.v1.y);
    return total + length;
  }, 0);
}

/**
 * Calculate metrics from lines and edges
 */
export function calculateMetrics(
  lines: HatchLine[],
  edges: ProjectedEdge[]
): Metrics {
  const lineCount = lines.length + edges.length;
  const pathLength = calculatePathLength(lines) + calculateEdgeLength(edges);

  // Estimate plot time
  // Drawing velocity: 40 mm/s
  // Travel velocity: 120 mm/s
  // Pen up/down time: 0.15s each
  // Acceleration overhead: 0.1s per line
  // Calibration factor: 0.8 (20% reduction)
  const DRAWING_VELOCITY = 40; // mm/s
  const TRAVEL_VELOCITY = 120; // mm/s
  const PEN_UP_TIME = 0.15; // s
  const PEN_DOWN_TIME = 0.15; // s
  const ACCELERATION_OVERHEAD = 0.1; // s per line
  const CALIBRATION_FACTOR = 0.8;

  const drawingTime = pathLength / DRAWING_VELOCITY;
  const travelTime = (pathLength * 0.3) / TRAVEL_VELOCITY; // Estimate 30% travel
  const penOperationsTime = lineCount * (PEN_UP_TIME + PEN_DOWN_TIME);
  const accelerationTime = lineCount * ACCELERATION_OVERHEAD;

  const totalSeconds =
    (drawingTime + travelTime + penOperationsTime + accelerationTime) *
    CALIBRATION_FACTOR;

  return {
    lineCount,
    pathLength,
    estimatedPlotTime: totalSeconds,
  };
}

/**
 * Calculate metrics from SVG lines
 */
export function calculateMetricsFromSVG(lines: SVGLine[]): Metrics {
  const lineCount = lines.length;
  const pathLength = calculateSVGPathLength(lines);

  const DRAWING_VELOCITY = 40; // mm/s
  const TRAVEL_VELOCITY = 120; // mm/s
  const PEN_UP_TIME = 0.15; // s
  const PEN_DOWN_TIME = 0.15; // s
  const ACCELERATION_OVERHEAD = 0.1; // s per line
  const CALIBRATION_FACTOR = 0.8;

  const drawingTime = pathLength / DRAWING_VELOCITY;
  const travelTime = (pathLength * 0.3) / TRAVEL_VELOCITY;
  const penOperationsTime = lineCount * (PEN_UP_TIME + PEN_DOWN_TIME);
  const accelerationTime = lineCount * ACCELERATION_OVERHEAD;

  const totalSeconds =
    (drawingTime + travelTime + penOperationsTime + accelerationTime) *
    CALIBRATION_FACTOR;

  return {
    lineCount,
    pathLength,
    estimatedPlotTime: totalSeconds,
  };
}

/**
 * Format time as HH:MM:SS or MM:SS
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}


