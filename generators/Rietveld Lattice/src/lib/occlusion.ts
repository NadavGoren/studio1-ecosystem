import type { Vec2 } from '../types'

export interface BBox {
  minx: number
  miny: number
  maxx: number
  maxy: number
}

export function polyBBox(poly: Vec2[]): BBox {
  let minx = Infinity
  let miny = Infinity
  let maxx = -Infinity
  let maxy = -Infinity
  for (const p of poly) {
    if (p[0] < minx) minx = p[0]
    if (p[0] > maxx) maxx = p[0]
    if (p[1] < miny) miny = p[1]
    if (p[1] > maxy) maxy = p[1]
  }
  return { minx, miny, maxx, maxy }
}

export function bboxOverlap(a: BBox, b: BBox): boolean {
  return a.minx <= b.maxx && a.maxx >= b.minx && a.miny <= b.maxy && a.maxy >= b.miny
}

/**
 * Separating-axis test: do two convex polygons share any area? Used to drop
 * occluder faces that only share a bounding box (not actual overlap) so a
 * nearest-K cap can never evict the face that genuinely covers a target.
 */
export function convexOverlap(a: Vec2[], b: Vec2[]): boolean {
  for (const poly of [a, b]) {
    const n = poly.length
    for (let i = 0; i < n; i++) {
      const p0 = poly[i]
      const p1 = poly[(i + 1) % n]
      const ax = -(p1[1] - p0[1]) // edge normal
      const ay = p1[0] - p0[0]
      if (ax === 0 && ay === 0) continue
      let minA = Infinity
      let maxA = -Infinity
      let minB = Infinity
      let maxB = -Infinity
      for (const p of a) {
        const d = p[0] * ax + p[1] * ay
        if (d < minA) minA = d
        if (d > maxA) maxA = d
      }
      for (const p of b) {
        const d = p[0] * ax + p[1] * ay
        if (d < minB) minB = d
        if (d > maxB) maxB = d
      }
      if (maxA < minB || maxB < minA) return false // a gap on this axis → separated
    }
  }
  return true
}

const lerp2 = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

/**
 * Cyrus–Beck clip: the [t0, t1] sub-interval of segment A→B that lies inside a
 * convex polygon, or null if it never enters. Winding-agnostic.
 */
export function segInsideConvex(A: Vec2, B: Vec2, poly: Vec2[]): [number, number] | null {
  const n = poly.length
  if (n < 3) return null
  // signed area → winding
  let area = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += poly[i][0] * poly[j][1] - poly[j][0] * poly[i][1]
  }
  const ccw = area > 0
  const dx = B[0] - A[0]
  const dy = B[1] - A[1]
  let t0 = 0
  let t1 = 1
  for (let i = 0; i < n; i++) {
    const p0 = poly[i]
    const p1 = poly[(i + 1) % n]
    const ex = p1[0] - p0[0]
    const ey = p1[1] - p0[1]
    // inward normal
    let nx = -ey
    let ny = ex
    if (!ccw) {
      nx = ey
      ny = -ex
    }
    const c = (A[0] - p0[0]) * nx + (A[1] - p0[1]) * ny // value at A
    const m = dx * nx + dy * ny
    if (Math.abs(m) < 1e-12) {
      if (c < 0) return null // parallel & outside
    } else {
      const t = -c / m
      if (m > 0) {
        if (t > t0) t0 = t
      } else {
        if (t < t1) t1 = t
      }
      if (t0 > t1) return null
    }
  }
  if (t1 - t0 < 1e-6) return null
  return [t0, t1]
}

/**
 * A planar occluder face: its 2D polygon plus an affine depth function
 * depth(px, py) = dA·px + dB·py + dC (exact under parallel projection).
 */
export interface PlaneFace {
  poly: Vec2[]
  dA: number
  dB: number
  dC: number
}

/** where along [t0,t1] is g(t)=g0+g1·t > eps (the face is nearer than the line) */
function nearerRange(t0: number, t1: number, g0: number, g1: number, eps: number): [number, number] | null {
  if (Math.abs(g1) < 1e-12) return g0 > eps ? [t0, t1] : null
  const tc = (eps - g0) / g1
  if (g1 > 0) {
    const lo = Math.max(t0, tc)
    return lo < t1 ? [lo, t1] : null
  }
  const hi = Math.min(t1, tc)
  return t0 < hi ? [t0, hi] : null
}

/**
 * The visible t-ranges of segment A→B under hidden-line removal with a TRUE
 * local depth test. Endpoint depths da, db (larger = nearer). For each occluder
 * face we take the sub-interval where A→B is (a) inside the face in 2D AND (b)
 * behind the face's plane in depth — both affine, so the comparison is exact per
 * point. Keep where FEWER than `maxLayers` faces hide it (Infinity = x-ray).
 */
export function keptRanges(
  A: Vec2,
  B: Vec2,
  da: number,
  db: number,
  faces: PlaneFace[],
  maxLayers: number,
  eps: number,
): [number, number][] {
  if (!isFinite(maxLayers)) return [[0, 1]]

  const intervals: [number, number][] = []
  for (const f of faces) {
    const cov = segInsideConvex(A, B, f.poly)
    if (!cov) continue
    const fA = f.dA * A[0] + f.dB * A[1] + f.dC // face depth under the segment's A
    const fB = f.dA * B[0] + f.dB * B[1] + f.dC
    const g0 = fA - da
    const g1 = fB - fA - (db - da)
    const occ = nearerRange(cov[0], cov[1], g0, g1, eps)
    if (occ && occ[1] - occ[0] > 1e-7) intervals.push(occ)
  }
  if (intervals.length === 0) return [[0, 1]]

  const pts: number[] = [0, 1]
  for (const [a, b] of intervals) {
    if (a > 0 && a < 1) pts.push(a)
    if (b > 0 && b < 1) pts.push(b)
  }
  pts.sort((u, v) => u - v)

  const out: [number, number][] = []
  let pending: [number, number] | null = null
  for (let i = 0; i + 1 < pts.length; i++) {
    const ta = pts[i]
    const tb = pts[i + 1]
    if (tb - ta < 1e-7) continue
    const mid = (ta + tb) / 2
    let count = 0
    for (const [a, b] of intervals) if (mid > a && mid < b) count++
    if (count < maxLayers) {
      if (pending && Math.abs(pending[1] - ta) < 1e-6) pending[1] = tb
      else {
        if (pending) out.push(pending)
        pending = [ta, tb]
      }
    }
  }
  if (pending) out.push(pending)
  return out
}

/**
 * Clip a whole polyline (lying on `faces`-comparable depth) by hidden-line
 * removal, returning continuous sub-polylines. A run survives across a vertex
 * only if that vertex is unoccluded — so a connected (serpentine) hatch stays a
 * few long pen strokes instead of shattering into one segment per scan line.
 * `depths[i]` is the true view-depth of point i.
 */
export function clipPolyline(
  points: Vec2[],
  depths: number[],
  faces: PlaneFace[],
  maxLayers: number,
  eps: number,
): Vec2[][] {
  if (points.length < 2) return []
  if (!isFinite(maxLayers) || faces.length === 0) return [points]

  const out: Vec2[][] = []
  let current: Vec2[] = []
  const flush = () => {
    if (current.length >= 2) out.push(current)
    current = []
  }
  for (let i = 0; i + 1 < points.length; i++) {
    const A = points[i]
    const B = points[i + 1]
    const ranges = keptRanges(A, B, depths[i], depths[i + 1], faces, maxLayers, eps)
    if (ranges.length === 0) {
      flush() // segment fully hidden
      continue
    }
    for (const [t0, t1] of ranges) {
      if (t1 - t0 < 1e-9) continue
      const p0 = lerp2(A, B, t0)
      const p1 = lerp2(A, B, t1)
      if (t0 <= 1e-9 && current.length > 0) {
        current.push(p1) // continues from the shared (visible) vertex
      } else {
        flush()
        current = [p0, p1]
      }
      if (t1 < 1 - 1e-9) flush() // hidden before reaching the next vertex
    }
  }
  flush()
  return out
}
