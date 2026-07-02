import type { Polyline, Segment, Vec2 } from '../types'
import { segInsideConvex } from './occlusion'

const eqPt = (p: Vec2, q: Vec2): boolean => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6

/**
 * Connect ordered, parallel hatch lines into as FEW continuous zig-zag
 * (boustrophedon) strokes as the visible region allows: ideally draw line 0
 * forward, hop along the edge to line 1, draw it back, and so on — one pen-down
 * instead of N.
 *
 * The catch is occlusion. We must clip each line to what's actually visible, but
 * if we build the full zig-zag FIRST and clip the whole thing afterwards, the
 * boundary-hopping connectors get sliced into stray stubs ("leaking ends") and
 * the chain shatters wherever a connector happens to fall behind a front object —
 * so the same plot links inconsistently. Instead we clip first, then re-link.
 *
 * A front object usually splits a face into several visible BANDS, so a single
 * running chain isn't enough: we follow every band at once. For each line we keep
 * the open stroke-ends left by the previous line; a freshly clipped piece extends
 * whichever open end (a) spans the same range along the hatch direction — i.e. is
 * stacked above it in the same band — and (b) is reachable by a connector that is
 * itself fully visible. Nearest end wins, so connectors stay short. A piece that
 * matches nothing starts a new stroke. Result: each visible band becomes one long
 * pen stroke, linking is deterministic, and a connector is never drawn across a
 * hidden span.
 */
export function connectedHatch(lines: Segment[], clip: (a: Vec2, b: Vec2) => Vec2[][]): Polyline[] {
  if (lines.length === 0) return []
  // all hatch lines are parallel; project onto their shared direction to tell
  // which pieces are stacked in the same band (overlapping spans) vs separate
  const d0: Vec2 = [lines[0][1][0] - lines[0][0][0], lines[0][1][1] - lines[0][0][1]]
  const dl = Math.hypot(d0[0], d0[1]) || 1
  const ux = d0[0] / dl
  const uy = d0[1] / dl
  const proj = (pt: Vec2) => pt[0] * ux + pt[1] * uy
  const EPS = 1e-3

  interface Open {
    stroke: Polyline
    end: Vec2 // last point laid down (on the previous line)
    lo: number // span of the last piece along the hatch direction
    hi: number
  }
  const all: Polyline[] = []
  let open: Open[] = []
  for (let i = 0; i < lines.length; i++) {
    const [la, lb] = lines[i]
    // boustrophedon: alternate scan direction so a band's consecutive ends sit
    // close together and the hop between them is short
    const p = i % 2 === 0 ? la : lb
    const q = i % 2 === 0 ? lb : la
    const pieces = clip(p, q) // visible straight pieces of this line, ordered p→q
    const next: Open[] = []
    const used = new Array(open.length).fill(false)
    for (const piece of pieces) {
      const s0 = piece[0]
      const s1 = piece[piece.length - 1]
      const a = proj(s0)
      const b = proj(s1)
      const lo = Math.min(a, b)
      const hi = Math.max(a, b)
      // previous-line open ends that overlap this piece's span (same band),
      // tried nearest-first so the chosen connector is the shortest available
      const cand = open
        .map((o, k) => ({ k, gap: Math.hypot(o.end[0] - s0[0], o.end[1] - s0[1]) }))
        .filter((c) => !used[c.k] && open[c.k].hi > lo - EPS && open[c.k].lo < hi + EPS)
        .sort((x, y) => x.gap - y.gap)
      let attached: Open | null = null
      for (const c of cand) {
        const e = open[c.k].end
        if (eqPt(e, s0)) {
          open[c.k].stroke.push(s1) // ends coincide → already joined
          used[c.k] = true
          attached = open[c.k]
          break
        }
        const conn = clip(e, s0)
        if (conn.length === 1 && eqPt(conn[0][0], e) && eqPt(conn[0][conn[0].length - 1], s0)) {
          open[c.k].stroke.push(s0, s1) // visible connector → extend the same stroke
          used[c.k] = true
          attached = open[c.k]
          break
        }
      }
      if (attached) {
        attached.end = s1
        attached.lo = lo
        attached.hi = hi
        next.push(attached)
      } else {
        const stroke: Polyline = [s0, s1]
        all.push(stroke)
        next.push({ stroke, end: s1, lo, hi })
      }
    }
    open = next
  }
  return all.filter((s) => s.length >= 2)
}

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
  // a face thinner than a pen-width is already covered by its own outline edge
  if (extent < 0.12) return out
  // cap lines per face so a tiny spacing on a large projected face can't
  // explode. The cap must stay far above what a page-filling face needs at the
  // darkest tone — a low cap silently WIDENS the spacing on big faces, making
  // exactly the largest boards brighter than their tone band (the old 240 cap
  // did this to every seat/back board).
  const MAX_LINES = 800
  let sp = spacing
  if (extent / sp > MAX_LINES) sp = extent / MAX_LINES

  // Distribute WHOLE lines across the face, each centred in its own band:
  // ≥1 line lands on even the thinnest face (nothing reads as "missing") and the
  // margin at each edge is a uniform half-band, never a phase-dependent strip.
  // The count rounds to NEAREST — under light-driven shading a face's tone IS
  // its spacing, and rounding up made every narrow face systematically darker
  // (up to 2×) than its tone band prescribed. Nearest keeps the achieved
  // density within half a band of nominal, unbiased in both directions.
  const lineCount = Math.max(1, Math.round(extent / sp))
  const step = extent / lineCount

  const pad = 1 // span the test line a touch past the polygon along its direction
  for (let i = 0; i < lineCount; i++) {
    const off = nMin + step * (i + 0.5)
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
