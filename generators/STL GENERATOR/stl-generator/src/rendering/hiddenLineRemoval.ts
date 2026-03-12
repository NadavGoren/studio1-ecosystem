/**
 * Hidden Line Removal Algorithm
 * Based on Plotter Vision (https://plotter.vision/) by Trammell Hudson
 * @see https://trmm.net/Plotter-Vision/
 * 
 * Implements the geometric occlusion testing method from the reference implementation.
 * Key techniques:
 * 1. Back-face culling (handled in visibility.ts)
 * 2. Coplanar triangle elimination (handled in silhouette.ts)
 * 3. Segment-triangle occlusion testing with proper clipping using screen map spatial index
 */

import { Mesh, Vector2 } from '../core/types';
import { ProjectedPoint, project3DToScreenSpace, ViewMode } from '../core/projection';
import { ViewRotation } from '../ui/store/svgViewportSlice';

const EPS = 0.0000001;
const STL_KEY2D_SCALE = 16; // Spatial grid scale (matches reference)

export const OcclusionResult = {
  NO_OCCLUSION: 0,      // no occlusion and processing should continue
  IN_FRONT: 1,          // no occlusion and processing should stop
  FULLY_OCCLUDED: 2,    // occlusion and the segment is totally hidden
  PARTIALLY_OCCLUDED: 3, // occlusion and either p0 or p1 has been updated
  SPLIT: 4,             // occlusion and p0/p1 have been updated and p2/p3 have been created
} as const;

export interface ProjectedTriangle {
  screen: [ProjectedPoint, ProjectedPoint, ProjectedPoint];
  min: ProjectedPoint;
  max: ProjectedPoint;
  faceIndex: number;
  invisible: boolean;
  // Cached triangle geometry for barycentric calculations (relative to screen[0])
  t1?: Vector2; // screen[1] - screen[0]
  t2?: Vector2; // screen[2] - screen[0]
}

export interface ScreenLineSegment {
  p0: ProjectedPoint;
  p1: ProjectedPoint;
  originalIndex?: number;
  edgeFaces?: Set<number>;
}

// Screen map: spatial hash grid for efficient triangle lookup
// Key format: "x,y" where x,y are grid cell indices
export type ScreenMap = Map<string, ProjectedTriangle[]>;

/**
 * Project visible faces to screen space for occlusion testing
 */
export function projectFacesToScreenSpace(
  mesh: Mesh,
  visibleFaceIndices: number[],
  viewMode: ViewMode,
  perspectiveStrength: number = 1.0,
  cameraDistance: number = 100,
  fov: number = 45,
  viewRotation?: ViewRotation
): ProjectedTriangle[] {
  const triangles: ProjectedTriangle[] = [];
  
  for (const faceIndex of visibleFaceIndices) {
    const face = mesh.faces[faceIndex];
    if (face.indices.length < 3) continue;

    const v0 = project3DToScreenSpace(mesh.vertices[face.indices[0]], viewMode, perspectiveStrength, cameraDistance, fov, viewRotation);
    const v1 = project3DToScreenSpace(mesh.vertices[face.indices[1]], viewMode, perspectiveStrength, cameraDistance, fov, viewRotation);
    const v2 = project3DToScreenSpace(mesh.vertices[face.indices[2]], viewMode, perspectiveStrength, cameraDistance, fov, viewRotation);

    // Skip if any vertex is behind camera (negative Z after projection means behind)
    // Note: In our projection, larger Z = further away, so we check if Z is valid
    if (v0.z === undefined || v1.z === undefined || v2.z === undefined) continue;

    // Skip degenerate triangles (very small area)
    const area = Math.abs((v1.x - v0.x) * (v2.y - v0.y) - (v2.x - v0.x) * (v1.y - v0.y)) / 2;
    if (area < EPS) continue;

    // Cache t1 and t2 (vectors from screen[0] to screen[1] and screen[2])
    // These are used for efficient barycentric coordinate calculation
    const t1: Vector2 = { x: v1.x - v0.x, y: v1.y - v0.y };
    const t2: Vector2 = { x: v2.x - v0.x, y: v2.y - v0.y };

    triangles.push({
      screen: [v0, v1, v2],
      min: { 
        x: Math.min(v0.x, v1.x, v2.x), 
        y: Math.min(v0.y, v1.y, v2.y), 
        z: Math.min(v0.z, v1.z, v2.z) 
      },
      max: { 
        x: Math.max(v0.x, v1.x, v2.x), 
        y: Math.max(v0.y, v1.y, v2.y), 
        z: Math.max(v0.z, v1.z, v2.z) 
      },
      faceIndex,
      invisible: false,
      t1,
      t2,
    });
  }
  
  return triangles;
}

/**
 * Build screen map spatial index for efficient triangle lookup
 * Based on reference implementation from stl.js lines 245-262
 */
export function buildScreenMap(triangles: ProjectedTriangle[]): ScreenMap {
  const screenMap: ScreenMap = new Map();

  for (const tri of triangles) {
    if (tri.invisible) continue;

    // Calculate grid cell bounds for this triangle
    const min_key_x = Math.trunc(tri.min.x / STL_KEY2D_SCALE);
    const min_key_y = Math.trunc(tri.min.y / STL_KEY2D_SCALE);
    const max_key_x = Math.trunc(tri.max.x / STL_KEY2D_SCALE);
    const max_key_y = Math.trunc(tri.max.y / STL_KEY2D_SCALE);

    // Add triangle to all grid cells it overlaps
    for (let x = min_key_x; x <= max_key_x; x++) {
      for (let y = min_key_y; y <= max_key_y; y++) {
        const key = `${x},${y}`;
        if (!screenMap.has(key)) {
          screenMap.set(key, []);
        }
        screenMap.get(key)!.push(tri);
      }
    }
  }

  // Sort triangles in each cell by minimum Z (closest first)
  // This allows early termination when segment is in front
  for (const triangles of screenMap.values()) {
    triangles.sort((a, b) => a.min.z - b.min.z);
  }

  return screenMap;
}

/**
 * Compute barycentric coordinates for point p in triangle
 * Based on reference implementation from triangle.js lines 197-213
 * Returns: [a, b, z] where (a, b) are barycentric coords and z is interpolated depth
 */
function barycentricCoords(p: Vector2, tri: ProjectedTriangle): { a: number; b: number; z: number } {
  const t1 = tri.t1!;
  const t2 = tri.t2!;
  const px = p.x - tri.screen[0].x;
  const py = p.y - tri.screen[0].y;

  const d = t1.x * t2.y - t2.x * t1.y;
  if (Math.abs(d) < EPS) {
    return { a: -1, b: -1, z: Infinity }; // Degenerate triangle
  }

  const a = (px * t2.y - py * t2.x) / d;
  const b = (py * t1.x - px * t1.y) / d;
  const z = tri.screen[0].z + a * (tri.screen[1].z - tri.screen[0].z) + b * (tri.screen[2].z - tri.screen[0].z);

  return { a, b, z };
}

/**
 * Check if barycentric coordinates indicate point is inside triangle
 */
function insideBarycentric(a: number, b: number): boolean {
  return -EPS <= a && -EPS <= b && a + b <= 1 + EPS;
}

/**
 * Distance squared between two 2D points (for comparing closeness)
 */
function dist2(p0: Vector2, p1: Vector2): number {
  const dx = p0.x - p1.x;
  const dy = p0.y - p1.y;
  return dx * dx + dy * dy;
}

/**
 * Check if two points are close enough (for duplicate detection)
 */
function closeEnough(p0: ProjectedPoint, p1: ProjectedPoint): boolean {
  const dx = p0.x - p1.x;
  if (dx < -EPS || EPS < dx) return false;
  
  const dy = p0.y - p1.y;
  if (dy < -EPS || EPS < dy) return false;
  
  const dz = p0.z - p1.z;
  if (dz < -EPS || EPS < dz) return false;
  
  return true;
}

/**
 * Find intersection between two line segments
 * Based on reference implementation from hidden.js lines 231-260
 * Returns: [ratio, intercept_s, intercept_t] where:
 *   - ratio is parameter along segment (p0->p1) [0,1]
 *   - intercept_s is intersection point on segment (p0->p1)
 *   - intercept_t is intersection point on edge (p2->p3)
 * Returns null if no intersection
 */
function interceptLines(
  p0: ProjectedPoint,
  p1: ProjectedPoint,
  p2: ProjectedPoint,
  p3: ProjectedPoint
): [number, ProjectedPoint, ProjectedPoint] | null {
  const s0x = p1.x - p0.x;
  const s0y = p1.y - p0.y;
  const s1x = p3.x - p2.x;
  const s1y = p3.y - p2.y;

  // Compute s0 x s1 (cross product in 2D)
  const d = s0x * s1y - s1x * s0y;

  // If they are close to parallel then we define that as non-intersecting
  if (-EPS < d && d < EPS) {
    return null;
  }

  // Compute how far along each line they would intersect
  const r0 = (s1x * (p0.y - p2.y) - s1y * (p0.x - p2.x)) / d;
  const r1 = (s0x * (p0.y - p2.y) - s0y * (p0.x - p2.x)) / d;

  // If they are outside of (0,1) then the intersection occurs outside of either segment
  if (r0 < 0 || r0 > 1 || r1 < 0 || r1 > 1) {
    return null;
  }

  // Compute the points of intersections for the two segments
  const intercept_s: ProjectedPoint = {
    x: p0.x + r0 * s0x,
    y: p0.y + r0 * s0y,
    z: p0.z + r0 * (p1.z - p0.z),
  };

  const intercept_t: ProjectedPoint = {
    x: p2.x + r1 * s1x,
    y: p2.y + r1 * s1y,
    z: p2.z + r1 * (p3.z - p2.z),
  };

  return [r0, intercept_s, intercept_t];
}

/**
 * Test if a line segment is occluded by a triangle
 * Based on reference implementation from hidden.js lines 20-207
 */
function testOcclusion(
  triangle: ProjectedTriangle,
  seg: ScreenLineSegment,
  workQueue: ScreenLineSegment[]
): number {
  // Skip self-occlusion - edge cannot be occluded by faces it belongs to
  if (seg.edgeFaces?.has(triangle.faceIndex)) {
    return OcclusionResult.NO_OCCLUSION;
  }

  // If triangle is not visible, skip it
  if (triangle.invisible) {
    return OcclusionResult.NO_OCCLUSION;
  }

  // If the segment is too short in screen space we are done
  const segLen = dist2(seg.p0, seg.p1);
  if (segLen < 1) {
    return OcclusionResult.FULLY_OCCLUDED;
  }

  // Depth early rejection - if segment max z is closer than triangle min z, no occlusion
  const segMaxZ = Math.max(seg.p0.z, seg.p1.z);
  if (segMaxZ <= triangle.min.z) {
    return OcclusionResult.IN_FRONT;
  }

  // Perform a screen coordinates bounding box check
  const segMinX = Math.min(seg.p0.x, seg.p1.x);
  const segMaxX = Math.max(seg.p0.x, seg.p1.x);
  const segMinY = Math.min(seg.p0.y, seg.p1.y);
  const segMaxY = Math.max(seg.p0.y, seg.p1.y);

  if (segMaxX < triangle.min.x || triangle.max.x < segMinX ||
      segMaxY < triangle.min.y || triangle.max.y < segMinY) {
    return OcclusionResult.NO_OCCLUSION;
  }

  // Compute barycentric coordinates for segment endpoints
  const tp0 = barycentricCoords(seg.p0, triangle);
  const tp1 = barycentricCoords(seg.p1, triangle);
  const p0Inside = insideBarycentric(tp0.a, tp0.b);
  const p1Inside = insideBarycentric(tp1.a, tp1.b);

  // If both endpoints are inside the triangle
  if (p0Inside && p1Inside) {
    // If the segment z is closer than the triangle z, then the segment is in front
    // Equality check in case the segment shares a vertex with the triangle
    if (seg.p0.z < tp0.z + EPS && seg.p1.z < tp1.z + EPS) {
      return OcclusionResult.NO_OCCLUSION;
    }

    // This segment is fully occluded
    return OcclusionResult.FULLY_OCCLUDED;
  }

  // One or neither of the points are inside - find intersections with triangle edges
  const intercepts: Array<{ ratio: number; segPoint: ProjectedPoint; triPoint: ProjectedPoint }> = [];

  for (let i = 0; i < 3; i++) {
    const edgeStart = triangle.screen[i];
    const edgeEnd = triangle.screen[(i + 1) % 3];
    
    const result = interceptLines(seg.p0, seg.p1, edgeStart, edgeEnd);
    if (!result) continue;

    const [ratio, segPoint, triPoint] = result;

    // If the segment intercept is closer than the triangle intercept, skip it
    if (segPoint.z <= triPoint.z) {
      continue;
    }

      intercepts.push({ ratio, segPoint, triPoint });
    }

  // Remove duplicate intercepts (tangent lines can create duplicates)
  if (intercepts.length === 3) {
    if (closeEnough(intercepts[0].segPoint, intercepts[2].segPoint)) {
      intercepts.pop();
    } else if (closeEnough(intercepts[1].segPoint, intercepts[2].segPoint)) {
      intercepts.pop();
    } else if (closeEnough(intercepts[0].segPoint, intercepts[1].segPoint)) {
      intercepts[1] = intercepts[2];
      intercepts.pop();
    } else {
      // Shouldn't happen with valid triangles - discard this triangle
      return OcclusionResult.FULLY_OCCLUDED;
    }
  }

  if (intercepts.length === 2) {
    if (closeEnough(intercepts[0].segPoint, intercepts[1].segPoint)) {
      intercepts.pop();
    }
  }

  // If no intersections, no occlusion
  if (intercepts.length === 0) {
    return OcclusionResult.NO_OCCLUSION;
  }

  // One intercept: clip the segment
  if (intercepts.length === 1) {
    if (p0Inside) {
      // p0 is inside, clip from intercept to p1
      seg.p0 = intercepts[0].segPoint;
      return OcclusionResult.PARTIALLY_OCCLUDED;
    }
    if (p1Inside) {
      // p1 is inside, clip from p0 to intercept
      seg.p1 = intercepts[0].segPoint;
      return OcclusionResult.PARTIALLY_OCCLUDED;
    }
    // Both outside with one intercept - might be tangent, no occlusion
    return OcclusionResult.NO_OCCLUSION;
  }

  // Two intercepts: figure out which is closer to which endpoint
  const d00 = dist2(intercepts[0].segPoint, seg.p0);
  const d01 = dist2(intercepts[1].segPoint, seg.p0);
  const d10 = dist2(intercepts[0].segPoint, seg.p1);
  const d11 = dist2(intercepts[1].segPoint, seg.p1);

  // Check if intercepts match endpoints exactly (fully occluded)
  if (d00 < EPS && d11 < EPS) {
    return OcclusionResult.FULLY_OCCLUDED;
  }
  if (d01 < EPS && d10 < EPS) {
    return OcclusionResult.FULLY_OCCLUDED;
  }

  // Clip based on which intercept is closer to which endpoint
  if (d00 < EPS) {
    seg.p0 = intercepts[1].segPoint;
    return OcclusionResult.PARTIALLY_OCCLUDED;
  }
  if (d01 < EPS) {
    seg.p0 = intercepts[0].segPoint;
    return OcclusionResult.PARTIALLY_OCCLUDED;
  }
  if (d10 < EPS) {
    seg.p1 = intercepts[1].segPoint;
    return OcclusionResult.PARTIALLY_OCCLUDED;
  }
  if (d11 < EPS) {
    seg.p1 = intercepts[0].segPoint;
    return OcclusionResult.PARTIALLY_OCCLUDED;
  }

  // Neither endpoint matches - split the segment
  // Keep the part before the first intercept and after the last intercept
  const midpoint = d00 > d01 ? 1 : 0;

  // Add the segment from p0 to the first intercept
  workQueue.push({
    p0: { ...seg.p0 },
    p1: intercepts[midpoint].segPoint,
    originalIndex: seg.originalIndex,
    edgeFaces: seg.edgeFaces,
  });

  // Update current segment to start from the second intercept
  seg.p0 = intercepts[midpoint ? 0 : 1].segPoint;

  return OcclusionResult.SPLIT;
}

/**
 * Process a segment against triangles in the screen map
 * Based on reference implementation from hidden.js lines 267-326
 */
function hiddenWire(
  seg: ScreenLineSegment,
  screenMap: ScreenMap,
  workQueue: ScreenLineSegment[]
): ScreenLineSegment | null {
  // Get grid cells this segment overlaps
  const min_key_x = Math.trunc(Math.min(seg.p0.x, seg.p1.x) / STL_KEY2D_SCALE);
  const min_key_y = Math.trunc(Math.min(seg.p0.y, seg.p1.y) / STL_KEY2D_SCALE);
  const max_key_x = Math.trunc(Math.max(seg.p0.x, seg.p1.x) / STL_KEY2D_SCALE);
  const max_key_y = Math.trunc(Math.max(seg.p0.y, seg.p1.y) / STL_KEY2D_SCALE);

  // Test against triangles in overlapping grid cells
  for (let x = min_key_x; x <= max_key_x; x++) {
    for (let y = min_key_y; y <= max_key_y; y++) {
      const key = `${x},${y}`;
      const triangles = screenMap.get(key);
      if (!triangles) continue;

      for (const tri of triangles) {
        if (tri.invisible) continue;

        const result = testOcclusion(tri, seg, workQueue);

        // Segment is fully occluded
        if (result === OcclusionResult.FULLY_OCCLUDED) {
          return null;
        }

        // Segment is in front of this triangle and all subsequent ones (they're sorted by Z)
        if (result === OcclusionResult.IN_FRONT) {
          break; // Break out of triangle loop, continue with next grid cell
        }

        // Segment was clipped or split - continue processing
        if (result === OcclusionResult.PARTIALLY_OCCLUDED || result === OcclusionResult.SPLIT) {
          // Continue checking the modified segment
          continue;
        }

        // NO_OCCLUSION - continue to next triangle
      }
    }
  }

  // If we made it here, the segment (or remaining part) is visible
  return seg;
}

/**
 * Remove hidden lines by testing against triangles using screen map
 * Based on reference implementation from stl.js lines 294-320
 */
export function removeHiddenLines(
  lineSegments: ScreenLineSegment[],
  triangles: ProjectedTriangle[]
): ScreenLineSegment[] {
  console.log(`[HiddenLineRemoval] GEOMETRIC METHOD: Processing ${lineSegments.length} segments against ${triangles.length} triangles`);
  
  if (triangles.length === 0 || lineSegments.length === 0) {
    return lineSegments;
  }

  // Build screen map spatial index
  const screenMap = buildScreenMap(triangles);

  // Work queue for segments (allows splitting)
  const workQueue: ScreenLineSegment[] = lineSegments.map(seg => ({
    p0: { ...seg.p0 },
    p1: { ...seg.p1 },
    originalIndex: seg.originalIndex,
    edgeFaces: seg.edgeFaces,
  }));

  const visibleSegments: ScreenLineSegment[] = [];
  const MIN_LENGTH_SQ = 1; // Match reference: segments with squared length < 1 are discarded

  let processedCount = 0;
  let hiddenCount = 0;

  // Process segments from work queue
  while (workQueue.length > 0) {
    const seg = workQueue.shift()!;
    processedCount++;

    // Skip degenerate segments (using squared distance to match reference)
    const lenSq = dist2(seg.p0, seg.p1);
    if (lenSq < MIN_LENGTH_SQ) {
      hiddenCount++;
      continue;
    }

    // Test segment against triangles
    const visibleSeg = hiddenWire(seg, screenMap, workQueue);

    if (visibleSeg) {
      const finalLenSq = dist2(visibleSeg.p0, visibleSeg.p1);
      if (finalLenSq >= MIN_LENGTH_SQ) {
        visibleSegments.push(visibleSeg);
      } else {
        hiddenCount++;
      }
    } else {
      hiddenCount++;
    }
  }

  console.log(`[HiddenLineRemoval] Result: ${visibleSegments.length} visible, ${hiddenCount} hidden, ${processedCount} processed`);
  
  return visibleSegments;
}

