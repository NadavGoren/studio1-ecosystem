import type { Segment, Vec2 } from '../types'

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
 * Clip a segment so only the parts covered by FEWER than `maxLayers` nearer
 * faces survive. maxLayers = Infinity → x-ray (nothing clips); 1 → solid (any
 * nearer face hides it). `occluders` should already be depth-nearer than the
 * segment's face and bbox-filtered.
 */
export function clipByCoverage(seg: Segment, occluders: Vec2[][], maxLayers: number): Segment[] {
  const [A, B] = seg
  if (!isFinite(maxLayers)) return [seg]

  const intervals: [number, number][] = []
  for (const poly of occluders) {
    const iv = segInsideConvex(A, B, poly)
    if (iv && iv[1] - iv[0] > 1e-7) intervals.push(iv)
  }
  if (intervals.length === 0) return [seg]

  // breakpoints
  const pts: number[] = [0, 1]
  for (const [a, b] of intervals) {
    if (a > 0 && a < 1) pts.push(a)
    if (b > 0 && b < 1) pts.push(b)
  }
  pts.sort((u, v) => u - v)

  const out: Segment[] = []
  let pending: [number, number] | null = null
  for (let i = 0; i + 1 < pts.length; i++) {
    const ta = pts[i]
    const tb = pts[i + 1]
    if (tb - ta < 1e-7) continue
    const mid = (ta + tb) / 2
    let count = 0
    for (const [a, b] of intervals) if (mid > a && mid < b) count++
    if (count < maxLayers) {
      // accumulate contiguous kept pieces into one segment
      if (pending && Math.abs(pending[1] - ta) < 1e-6) pending[1] = tb
      else {
        if (pending) out.push([lerp2(A, B, pending[0]), lerp2(A, B, pending[1])])
        pending = [ta, tb]
      }
    }
  }
  if (pending) out.push([lerp2(A, B, pending[0]), lerp2(A, B, pending[1])])
  return out
}
