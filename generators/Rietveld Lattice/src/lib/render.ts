import type { Axis, BeamModel, LineLayer, Params, PenColor, RenderResult, Segment, Vec2, Vec3 } from '../types'
import { boxEdges, boxFaces } from './geometry'
import { makeProjector } from './projection'
import { hatchPolygon } from './hatch'
import { bboxOverlap, clipByCoverage, convexOverlap, polyBBox, segInsideConvex, type BBox } from './occlusion'
import { PEN_HEX, PEN_ORDER } from './palette'

const PAPER: Record<string, [number, number]> = {
  A2: [420, 594],
  A3: [297, 420],
  A4: [210, 297],
}

export function pageSize(p: Params): { w: number; h: number } {
  const [pw, ph] = PAPER[p.paperSize] ?? PAPER.A3
  return p.orientation === 'landscape' ? { w: ph, h: pw } : { w: pw, h: ph }
}

/** Map a 0 (x-ray) … 100 (solid) slider to a "see-through N layers" count. */
function occlusionLayers(value: number): number {
  const o = value / 100
  if (o <= 0.02) return Infinity // x-ray: nothing clips
  const maxLayers = 6
  return Math.max(1, Math.round(maxLayers - (maxLayers - 1) * o)) // o=1 → 1 (solid)
}

// every visible face is an opaque occluder; a subset of them also carry a fill
interface SolidFace {
  poly: Vec2[]
  bbox: BBox
  depth: number // larger = nearer the viewer
  boxId: number
}
interface FillFace extends SolidFace {
  color: PenColor
  hatchAxis: Axis
}

export function renderModel(model: BeamModel, p: Params, opts: { edgesOnly?: boolean } = {}): RenderResult {
  const { w, h } = pageSize(p)
  const margin = Math.max(0, p.margin)
  const dw = Math.max(1, w - 2 * margin)
  const dh = Math.max(1, h - 2 * margin)

  const proj = makeProjector(p.azimuth, p.elevation)

  // ── fit the projected lattice into the drawable area (uniform scale) ──────
  let pminx = Infinity
  let pminy = Infinity
  let pmaxx = -Infinity
  let pmaxy = -Infinity
  for (const box of model.boxes) {
    for (const e of boxEdges(box)) {
      for (const c of e) {
        const q = proj.project(c)
        if (q.x < pminx) pminx = q.x
        if (q.x > pmaxx) pmaxx = q.x
        if (q.y < pminy) pminy = q.y
        if (q.y > pmaxy) pmaxy = q.y
      }
    }
  }
  const projW = Math.max(1e-3, pmaxx - pminx)
  const projH = Math.max(1e-3, pmaxy - pminy)
  const s = Math.min(dw / projW, dh / projH)
  const tx = margin + (dw - projW * s) / 2 - pminx * s
  const ty = margin + (dh - projH * s) / 2 - pminy * s
  const toPage = (q: { x: number; y: number }): Vec2 => [q.x * s + tx, q.y * s + ty]

  const needFills = !opts.edgesOnly
  // thumbnails (edgesOnly) skip hidden-line removal for speed → fast full wireframe
  const hiddenLayers = opts.edgesOnly ? Infinity : occlusionLayers(p.hiddenLine)
  const fillLayers = occlusionLayers(p.occlusion)
  const needSolids = needFills || isFinite(hiddenLayers)

  // ── gather every visible face: solid occluders + the fillable subset ──────
  const solids: SolidFace[] = []
  const fillFaces: FillFace[] = []
  let dMin = Infinity
  let dMax = -Infinity
  if (needSolids) {
    for (const box of model.boxes) {
      for (const f of boxFaces(box)) {
        const rn = proj.rotate(f.normal)
        if (rn[2] <= 1e-6) continue // back-facing → cull
        const poly = f.corners.map((c: Vec3) => toPage(proj.project(c)))
        let depth = 0
        for (const c of f.corners) depth += proj.project(c).depth
        depth /= 4
        const bbox = polyBBox(poly)
        const solid: SolidFace = { poly, bbox, depth, boxId: box.id }
        solids.push(solid)
        if (depth < dMin) dMin = depth
        if (depth > dMax) dMax = depth

        if (!needFills) continue
        let color: PenColor | null = null
        if (f.isCap) {
          if (p.yellowCaps) color = 'yellow'
        } else if (box.kind === 'board') {
          color = box.color // ALL board faces (incl. thin sides) → visible thickness
        } else if (box.kind === 'beam' && p.hatchBeams) {
          color = 'black'
        }
        if (color) fillFaces.push({ ...solid, color, hatchAxis: f.axis })
      }
    }
  }
  const dRange = Math.max(1e-6, dMax - dMin)

  // Nearer solids from OTHER boxes that genuinely cover the target — bounded by
  // a nearest-K cap. `covers` is a geometry test (not just bbox) so the cap can
  // never evict the face that actually does the hiding. depthEps treats
  // near-coplanar faces as co-planar so they don't z-fight and erase each
  // other's lines. Note: this is a painter's-style per-face average-depth sort,
  // so two interpenetrating faces are hidden wholesale (a known limitation that
  // a z-buffer / BSP split would resolve; visually negligible here).
  const K = 32
  const depthEps = dRange * 1e-3 + 1e-6
  const gatherOccluders = (
    depth: number,
    bbox: BBox,
    boxId: number,
    covers: (sf: SolidFace) => boolean,
  ): Vec2[][] => {
    const cand: SolidFace[] = []
    for (const sf of solids) {
      if (sf.boxId === boxId) continue // a box never hides its own lines (avoids self-erasure)
      if (sf.depth <= depth + depthEps) continue // must be clearly nearer
      if (!bboxOverlap(sf.bbox, bbox)) continue
      if (!covers(sf)) continue // drop bbox-only overlaps that don't actually cover
      cand.push(sf)
    }
    if (cand.length > K) {
      cand.sort((a, b) => b.depth - a.depth)
      cand.length = K
    }
    return cand.map((c) => c.poly)
  }

  // ── edges with hidden-line removal (front objects hide back objects) ──────
  // Dedupe coincident projected edges keeping the NEAREST one, so an edge that
  // is unoccluded at the front is never erased using a farther twin's depth.
  const edgeSegs: Segment[] = []
  const edgeMap = new Map<string, { a: Vec2; b: Vec2; depth: number; boxId: number }>()
  for (const box of model.boxes) {
    for (const e of boxEdges(box)) {
      const pa = proj.project(e[0])
      const pb = proj.project(e[1])
      const a = toPage(pa)
      const b = toPage(pb)
      const ka = `${a[0].toFixed(2)},${a[1].toFixed(2)}`
      const kb = `${b[0].toFixed(2)},${b[1].toFixed(2)}`
      const key = ka < kb ? ka + '|' + kb : kb + '|' + ka
      const depth = (pa.depth + pb.depth) / 2
      const existing = edgeMap.get(key)
      if (!existing || depth > existing.depth) edgeMap.set(key, { a, b, depth, boxId: box.id })
    }
  }
  for (const ed of edgeMap.values()) {
    if (!isFinite(hiddenLayers)) {
      edgeSegs.push([ed.a, ed.b])
      continue
    }
    const occ = gatherOccluders(
      ed.depth,
      polyBBox([ed.a, ed.b]),
      ed.boxId,
      (sf) => segInsideConvex(ed.a, ed.b, sf.poly) !== null,
    )
    if (occ.length === 0) edgeSegs.push([ed.a, ed.b])
    else for (const k of clipByCoverage([ed.a, ed.b], occ, hiddenLayers)) edgeSegs.push(k)
  }
  const edgeCount = edgeSegs.length // before any black fills are appended

  const layerMap: Record<PenColor, Segment[]> = { black: edgeSegs, red: [], blue: [], yellow: [] }

  if (needFills) {
    const angleByAxis: Record<Axis, number> = {
      x: (p.angleX * Math.PI) / 180,
      y: (p.angleY * Math.PI) / 180,
      z: (p.angleZ * Math.PI) / 180,
    }
    for (const ff of fillFaces) {
      const nd = (dMax - ff.depth) / dRange // 0 near, 1 far
      const spacing = p.hatchSpacing * (1 + p.depthFalloff * nd)
      const angle = angleByAxis[ff.hatchAxis]

      let segs = hatchPolygon(ff.poly, angle, spacing)
      if (p.crossHatch) segs = segs.concat(hatchPolygon(ff.poly, angle + Math.PI / 2, spacing))
      if (segs.length === 0) continue

      const occ = isFinite(fillLayers)
        ? gatherOccluders(ff.depth, ff.bbox, ff.boxId, (sf) => convexOverlap(sf.poly, ff.poly))
        : []
      const dest = layerMap[ff.color]
      if (occ.length === 0) {
        for (const sgmt of segs) dest.push(sgmt)
      } else {
        for (const sgmt of segs) {
          for (const k of clipByCoverage(sgmt, occ, fillLayers)) dest.push(k)
        }
      }
    }
  }

  const layers: LineLayer[] = PEN_ORDER.filter((c) => layerMap[c].length > 0).map((c) => ({
    color: c,
    hex: PEN_HEX[c],
    segments: layerMap[c],
  }))

  const fillSegments =
    layerMap.red.length + layerMap.blue.length + layerMap.yellow.length + (layerMap.black.length - edgeCount)
  return {
    layers,
    page: { w, h },
    seed: p.seed,
    stats: {
      boxes: model.boxes.length,
      edgeSegments: edgeCount,
      fillSegments,
      totalLines: edgeCount + fillSegments,
    },
  }
}
