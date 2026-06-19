import type { Segment, Vec2 } from '../types'
import { segInsideConvex } from './occlusion'

/**
 * Fill a convex polygon with parallel hatch lines at `angleRad`, spaced
 * `spacing` apart. Each line is clipped to the polygon with the same robust
 * Cyrus–Beck routine the occluder uses, so a line crossing a vertex can never
 * mis-pair or leak. Spacing encodes tone; the angle encodes face orientation.
 */
export function hatchPolygon(poly: Vec2[], angleRad: number, spacing: number): Segment[] {
  const out: Segment[] = []
  const n = poly.length
  if (n < 3 || spacing <= 1e-4) return out

  const dx = Math.cos(angleRad)
  const dy = Math.sin(angleRad)
  const nx = -dy // hatch-line normal
  const ny = dx

  let nMin = Infinity
  let nMax = -Infinity
  let dMin = Infinity
  let dMax = -Infinity
  for (const v of poly) {
    const sn = v[0] * nx + v[1] * ny
    const sd = v[0] * dx + v[1] * dy
    if (sn < nMin) nMin = sn
    if (sn > nMax) nMax = sn
    if (sd < dMin) dMin = sd
    if (sd > dMax) dMax = sd
  }
  if (!isFinite(nMin) || !isFinite(dMin)) return out

  const extent = nMax - nMin
  // cap lines per face: a tiny spacing on a large projected face must not
  // explode into thousands of lines and stall the render
  const MAX_LINES = 240
  const sp = extent / spacing > MAX_LINES ? extent / MAX_LINES : spacing
  if (extent < sp * 0.25) return out

  const pad = 1 // span the test line a touch past the polygon along its direction
  const start = Math.ceil(nMin / sp) * sp
  for (let off = start; off <= nMax; off += sp) {
    // a long segment along the hatch direction at this normal offset
    const bx = nx * off
    const by = ny * off
    const A: Vec2 = [bx + dx * (dMin - pad), by + dy * (dMin - pad)]
    const B: Vec2 = [bx + dx * (dMax + pad), by + dy * (dMax + pad)]
    const iv = segInsideConvex(A, B, poly)
    if (!iv) continue
    out.push([
      [A[0] + (B[0] - A[0]) * iv[0], A[1] + (B[1] - A[1]) * iv[0]],
      [A[0] + (B[0] - A[0]) * iv[1], A[1] + (B[1] - A[1]) * iv[1]],
    ])
  }
  return out
}
