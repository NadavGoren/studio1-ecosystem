/**
 * Depth Buffer-based Hidden Line Removal
 * 
 * This implements the same approach used by Plotter Vision (https://plotter.vision/)
 * and described at https://jbaker.graphics/writings/hiddenLineRemoval.html
 * 
 * Instead of geometric segment-triangle intersection tests, we:
 * 1. Rasterize all triangles to a depth buffer
 * 2. Walk each line segment pixel by pixel
 * 3. Compare line depth vs depth buffer at each pixel
 * 4. Record visible/hidden transitions and split segments accordingly
 */

import { ProjectedPoint } from '../core/projection';
import { ProjectedTriangle, ScreenLineSegment } from './hiddenLineRemoval';

/**
 * Depth buffer for occlusion testing
 */
export class DepthBuffer {
  private buffer: Float32Array;
  private width: number;
  private height: number;
  private offsetX: number;
  private offsetY: number;
  private scale: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.buffer = new Float32Array(width * height);
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1;
    this.clear();
  }

  /**
   * Clear the depth buffer (set all depths to infinity)
   */
  clear(): void {
    this.buffer.fill(Infinity);
  }

  /**
   * Set the transform from world coords to buffer coords
   */
  setTransform(minX: number, minY: number, maxX: number, maxY: number): void {
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    const padding = 0.1; // 10% padding
    
    const scaleX = (this.width * (1 - 2 * padding)) / (rangeX || 1);
    const scaleY = (this.height * (1 - 2 * padding)) / (rangeY || 1);
    this.scale = Math.min(scaleX, scaleY);
    
    this.offsetX = this.width / 2 - (minX + rangeX / 2) * this.scale;
    this.offsetY = this.height / 2 - (minY + rangeY / 2) * this.scale;
  }

  /**
   * Transform world coordinates to buffer coordinates
   */
  private toBufferCoords(x: number, y: number): [number, number] {
    return [
      Math.round(x * this.scale + this.offsetX),
      Math.round(y * this.scale + this.offsetY)
    ];
  }

  /**
   * Get buffer index for coordinates
   */
  private getIndex(bx: number, by: number): number {
    if (bx < 0 || bx >= this.width || by < 0 || by >= this.height) {
      return -1;
    }
    return by * this.width + bx;
  }

  /**
   * Write depth at a buffer position (only if closer)
   */
  private writeDepth(bx: number, by: number, z: number): void {
    const idx = this.getIndex(bx, by);
    if (idx >= 0 && z < this.buffer[idx]) {
      this.buffer[idx] = z;
    }
  }

  /**
   * Read depth at a buffer position
   */
  private readDepth(bx: number, by: number): number {
    const idx = this.getIndex(bx, by);
    if (idx < 0) return Infinity;
    return this.buffer[idx];
  }

  /**
   * Rasterize a triangle to the depth buffer
   * Uses scanline rasterization with depth interpolation
   */
  rasterizeTriangle(tri: ProjectedTriangle): void {
    const [v0, v1, v2] = tri.screen;
    
    // Transform to buffer coordinates
    const [bx0, by0] = this.toBufferCoords(v0.x, v0.y);
    const [bx1, by1] = this.toBufferCoords(v1.x, v1.y);
    const [bx2, by2] = this.toBufferCoords(v2.x, v2.y);

    // Sort vertices by y coordinate
    let sorted = [
      { x: bx0, y: by0, z: v0.z },
      { x: bx1, y: by1, z: v1.z },
      { x: bx2, y: by2, z: v2.z }
    ].sort((a, b) => a.y - b.y);

    const [top, mid, bot] = sorted;

    // Skip degenerate triangles
    if (top.y === bot.y) return;

    // Rasterize using scanline algorithm
    const invDy1 = 1 / (bot.y - top.y);
    const invDy2 = mid.y !== top.y ? 1 / (mid.y - top.y) : 0;
    const invDy3 = bot.y !== mid.y ? 1 / (bot.y - mid.y) : 0;

    for (let y = Math.max(0, top.y); y <= Math.min(this.height - 1, bot.y); y++) {
      // Calculate x range for this scanline
      const t1 = (y - top.y) * invDy1;
      const x1 = top.x + t1 * (bot.x - top.x);
      const z1 = top.z + t1 * (bot.z - top.z);

      let x2: number, z2: number;
      if (y < mid.y) {
        const t2 = (y - top.y) * invDy2;
        x2 = top.x + t2 * (mid.x - top.x);
        z2 = top.z + t2 * (mid.z - top.z);
      } else {
        const t3 = (y - mid.y) * invDy3;
        x2 = mid.x + t3 * (bot.x - mid.x);
        z2 = mid.z + t3 * (bot.z - mid.z);
      }

      // Ensure x1 <= x2
      let xLeft = x1, xRight = x2, zLeft = z1, zRight = z2;
      if (xLeft > xRight) {
        [xLeft, xRight] = [xRight, xLeft];
        [zLeft, zRight] = [zRight, zLeft];
      }

      const xStart = Math.max(0, Math.floor(xLeft));
      const xEnd = Math.min(this.width - 1, Math.ceil(xRight));

      if (xEnd <= xStart) continue;

      const invDx = 1 / (xRight - xLeft || 1);
      for (let x = xStart; x <= xEnd; x++) {
        const t = (x - xLeft) * invDx;
        const z = zLeft + t * (zRight - zLeft);
        this.writeDepth(x, y, z);
      }
    }
  }

  /**
   * Rasterize all triangles to the depth buffer
   */
  rasterizeTriangles(triangles: ProjectedTriangle[]): void {
    for (const tri of triangles) {
      this.rasterizeTriangle(tri);
    }
  }

  /**
   * Test if a point is visible (in front of depth buffer)
   * Returns true if the point is visible
   */
  isVisible(x: number, y: number, z: number, bias: number = 0.001): boolean {
    const [bx, by] = this.toBufferCoords(x, y);
    const bufferZ = this.readDepth(bx, by);
    // Point is visible if it's in front of (less than) the buffer depth
    // Use bias to prevent z-fighting
    return z < bufferZ + bias;
  }

  /**
   * Walk a line segment and find visible portions
   * Returns array of visible segments
   */
  walkLineSegment(
    seg: ScreenLineSegment,
    bias: number = 0.001
  ): ScreenLineSegment[] {
    const [bx0, by0] = this.toBufferCoords(seg.p0.x, seg.p0.y);
    const [bx1, by1] = this.toBufferCoords(seg.p1.x, seg.p1.y);

    // Bresenham's line algorithm with depth interpolation
    const dx = Math.abs(bx1 - bx0);
    const dy = Math.abs(by1 - by0);
    const sx = bx0 < bx1 ? 1 : -1;
    const sy = by0 < by1 ? 1 : -1;
    let err = dx - dy;

    const steps = Math.max(dx, dy);
    if (steps === 0) {
      // Single point
      if (this.isVisible(seg.p0.x, seg.p0.y, seg.p0.z, bias)) {
        return [seg];
      }
      return [];
    }

    // Track visibility transitions
    const visibleSegments: ScreenLineSegment[] = [];
    let currentlyVisible = false;
    let visibleStart: ProjectedPoint | null = null;

    let bx = bx0, by = by0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const worldX = seg.p0.x + t * (seg.p1.x - seg.p0.x);
      const worldY = seg.p0.y + t * (seg.p1.y - seg.p0.y);
      const worldZ = seg.p0.z + t * (seg.p1.z - seg.p0.z);

      const isVis = this.isVisible(worldX, worldY, worldZ, bias);

      if (isVis && !currentlyVisible) {
        // Transition to visible
        currentlyVisible = true;
        visibleStart = { x: worldX, y: worldY, z: worldZ };
      } else if (!isVis && currentlyVisible) {
        // Transition to hidden
        currentlyVisible = false;
        if (visibleStart) {
          visibleSegments.push({
            p0: visibleStart,
            p1: { x: worldX, y: worldY, z: worldZ },
            originalIndex: seg.originalIndex,
            edgeFaces: seg.edgeFaces,
          });
        }
        visibleStart = null;
      }

      // Bresenham step
      if (i < steps) {
        const e2 = 2 * err;
        if (e2 > -dy) {
          err -= dy;
          bx += sx;
        }
        if (e2 < dx) {
          err += dx;
          by += sy;
        }
      }
    }

    // Close any open visible segment
    if (currentlyVisible && visibleStart) {
      visibleSegments.push({
        p0: visibleStart,
        p1: { ...seg.p1 },
        originalIndex: seg.originalIndex,
        edgeFaces: seg.edgeFaces,
      });
    }

    return visibleSegments;
  }
}

/**
 * Remove hidden lines using depth buffer approach
 * This matches the technique used by Plotter Vision
 */
export function removeHiddenLinesDepthBuffer(
  lineSegments: ScreenLineSegment[],
  triangles: ProjectedTriangle[],
  bufferSize: number = 1024
): ScreenLineSegment[] {
  console.log(`[DepthBuffer] Processing ${lineSegments.length} segments against ${triangles.length} triangles`);
  
  if (triangles.length === 0 || lineSegments.length === 0) {
    return lineSegments;
  }

  // Calculate bounds
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const tri of triangles) {
    minX = Math.min(minX, tri.min.x);
    maxX = Math.max(maxX, tri.max.x);
    minY = Math.min(minY, tri.min.y);
    maxY = Math.max(maxY, tri.max.y);
    minZ = Math.min(minZ, tri.min.z);
    maxZ = Math.max(maxZ, tri.max.z);
  }

  for (const seg of lineSegments) {
    minX = Math.min(minX, seg.p0.x, seg.p1.x);
    maxX = Math.max(maxX, seg.p0.x, seg.p1.x);
    minY = Math.min(minY, seg.p0.y, seg.p1.y);
    maxY = Math.max(maxY, seg.p0.y, seg.p1.y);
  }

  // Calculate adaptive bias based on Z range
  const zRange = maxZ - minZ;
  const bias = Math.max(0.001, zRange * 0.005); // 0.5% of Z range
  console.log(`[DepthBuffer] Z range: ${zRange.toFixed(4)}, bias: ${bias.toFixed(6)}`);

  // Create and populate depth buffer
  const depthBuffer = new DepthBuffer(bufferSize, bufferSize);
  depthBuffer.setTransform(minX, minY, maxX, maxY);
  depthBuffer.rasterizeTriangles(triangles);

  // Process each line segment
  const visibleSegments: ScreenLineSegment[] = [];
  
  for (const seg of lineSegments) {
    // Skip segments from triangles (self-occlusion would be handled by bias)
    const visible = depthBuffer.walkLineSegment(seg, bias);
    
    // Filter out very short segments
    for (const visSeg of visible) {
      const len = Math.hypot(
        visSeg.p1.x - visSeg.p0.x,
        visSeg.p1.y - visSeg.p0.y
      );
      if (len > 0.001) {
        visibleSegments.push(visSeg);
      }
    }
  }

  console.log(`[DepthBuffer] Result: ${visibleSegments.length} visible segments`);
  return visibleSegments;
}

