import type { Segment, Vec2 } from '../types'

/**
 * Fill a convex polygon with parallel hatch lines at `angleRad`, spaced
 * `spacing` apart. Returns clipped line segments (plotter-ready). Spacing
 * encodes tone; the angle encodes face orientation.
 */
export function hatchPolygon(poly: Vec2[], angleRad: number, spacing: number): Segment[] {
  const out: Segment[] = []
  const n = poly.length
  if (n < 3 || spacing <= 1e-4) return out

  const dx = Math.cos(angleRad)
  const dy = Math.sin(angleRad)
  const nx = -dy // line normal
  const ny = dx

  let nMin = Infinity
  let nMax = -Infinity
  for (const v of poly) {
    const s = v[0] * nx + v[1] * ny
    if (s < nMin) nMin = s
    if (s > nMax) nMax = s
  }
  if (!isFinite(nMin)) return out
  const extent = nMax - nMin
  // cap lines per face: a tiny spacing on a large projected face must not
  // explode into thousands of lines and stall the render
  const MAX_LINES = 240
  const sp = extent / spacing > MAX_LINES ? extent / MAX_LINES : spacing
  if (extent < sp * 0.25) return out

  const ts: number[] = []
  const start = Math.ceil(nMin / sp) * sp
  for (let off = start; off <= nMax; off += sp) {
    ts.length = 0
    for (let i = 0; i < n; i++) {
      const p0 = poly[i]
      const p1 = poly[(i + 1) % n]
      const d0 = p0[0] * nx + p0[1] * ny - off
      const d1 = p1[0] * nx + p1[1] * ny - off
      if ((d0 <= 0 && d1 > 0) || (d1 <= 0 && d0 > 0)) {
        const u = d0 / (d0 - d1)
        const px = p0[0] + u * (p1[0] - p0[0])
        const py = p0[1] + u * (p1[1] - p0[1])
        ts.push(px * dx + py * dy) // param along hatch direction
      }
    }
    if (ts.length < 2) continue
    ts.sort((a, b) => a - b)
    for (let i = 0; i + 1 < ts.length; i += 2) {
      const t0 = ts[i]
      const t1 = ts[i + 1]
      if (t1 - t0 < 1e-4) continue
      out.push([
        [nx * off + dx * t0, ny * off + dy * t0],
        [nx * off + dx * t1, ny * off + dy * t1],
      ])
    }
  }
  return out
}
