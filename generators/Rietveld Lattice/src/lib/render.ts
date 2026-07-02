import type { Axis, BeamModel, LineLayer, Params, PenColor, Polyline, RenderResult, Vec2, Vec3 } from '../types'
import { boxEdges, boxFaces } from './geometry'
import { makeProjector } from './projection'
import { connectedHatch, hatchPolygon } from './hatch'
import { bboxOverlap, clipPolyline, convexOverlap, polyBBox, segInsideConvex, type BBox } from './occlusion'
import { PEN_HEX, PEN_ORDER } from './palette'

const PAPER: Record<string, [number, number]> = {
  A2: [420, 594],
  A3: [297, 420],
  A4: [210, 297],
  A5: [148, 210],
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

// every visible face is an opaque occluder; a subset of them also carry a fill.
// depth(px,py) = dA·px + dB·py + dC is exact under parallel projection, so we can
// compare depths at the actual point of overlap (true hidden-line removal).
interface SolidFace {
  poly: Vec2[]
  bbox: BBox
  depth: number // average depth (sorting / falloff); larger = nearer
  depthMin: number
  depthMax: number
  dA: number
  dB: number
  dC: number
  boxId: number
}
interface FillFace extends SolidFace {
  color: PenColor
  hatchAxis: Axis
  /** quantized light tone: 0 = facing the light … levels-1 = full shadow */
  band: number
}

/** Affine depth plane through 3 projected corners [px, py, depth]; null if degenerate. */
function affineDepth(
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
): { dA: number; dB: number; dC: number } | null {
  const det = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1])
  if (Math.abs(det) < 1e-9) return null
  const d1 = p1[2] - p0[2]
  const d2 = p2[2] - p0[2]
  const dA = (d1 * (p2[1] - p0[1]) - d2 * (p1[1] - p0[1])) / det
  const dB = ((p1[0] - p0[0]) * d2 - (p2[0] - p0[0]) * d1) / det
  const dC = p0[2] - dA * p0[0] - dB * p0[1]
  return { dA, dB, dC }
}

export function renderModel(model: BeamModel, p: Params, opts: { edgesOnly?: boolean } = {}): RenderResult {
  const { w, h } = pageSize(p)
  const margin = Math.max(0, p.margin)
  const dw = Math.max(1, w - 2 * margin)
  const dh = Math.max(1, h - 2 * margin)

  const proj = makeProjector(p.azimuth, p.elevation)

  // ── shading: one world light, applied by face orientation ─────────────────
  // Every face is classified by where its WORLD normal points (its x/y/z
  // region) and shaded with quantized Lambert: tone = 1 − max(0, n·L), snapped
  // to a small number of discrete bands. All coplanar faces therefore share one
  // exact tone — tops read light, the lit flank mid, the far flank dark —
  // and tilted boards land on the in-between band they geometrically deserve.
  const la = (p.lightAzimuth * Math.PI) / 180
  const le = (p.lightElevation * Math.PI) / 180
  const light: Vec3 = [Math.cos(le) * Math.sin(la), Math.sin(le), Math.cos(le) * Math.cos(la)]
  const levels = Math.max(2, Math.min(8, Math.round(p.shadeLevels)))
  const contrast = Math.max(0, Math.min(1, p.shadeContrast))
  // spacing ratio between adjacent tone bands; contrast 0 → 1 (uniform tone)
  const bandRatio = 1 + 1.1 * contrast
  const shadeBand = (n: Vec3): number => {
    const lam = Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2])
    return Math.round((1 - lam) * (levels - 1))
  }

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
        const poly: Vec2[] = []
        const withDepth: [number, number, number][] = []
        let depth = 0
        let depthMin = Infinity
        let depthMax = -Infinity
        for (const c of f.corners) {
          const q = proj.project(c)
          const pg = toPage(q)
          poly.push(pg)
          withDepth.push([pg[0], pg[1], q.depth])
          depth += q.depth
          if (q.depth < depthMin) depthMin = q.depth
          if (q.depth > depthMax) depthMax = q.depth
        }
        depth /= 4
        const plane = affineDepth(withDepth[0], withDepth[1], withDepth[2]) ?? { dA: 0, dB: 0, dC: depth }
        const bbox = polyBBox(poly)
        const solid: SolidFace = { poly, bbox, depth, depthMin, depthMax, dA: plane.dA, dB: plane.dB, dC: plane.dC, boxId: box.id }
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
        if (color) fillFaces.push({ ...solid, color, hatchAxis: f.axis, band: shadeBand(f.normal) })
      }
    }
  }
  const dRange = Math.max(1e-6, dMax - dMin)

  // Candidate occluder faces from OTHER boxes that could be nearer somewhere over
  // the target (depth-range overlap, not a single average) and genuinely cover it
  // in 2D. The exact front/back decision is made per-point later by clipPolyline;
  // here we only build a bounded candidate set. nearLimit = the target's farthest
  // depth — a face can occlude only if it reaches at least that near somewhere.
  const depthEps = dRange * 1.5e-3 + 1e-6
  const gatherOccluders = (
    nearLimit: number,
    bbox: BBox,
    boxId: number,
    covers: (sf: SolidFace) => boolean,
    includeSameBox = false,
    maxK = 40,
  ): SolidFace[] => {
    const cand: SolidFace[] = []
    for (const sf of solids) {
      // a box may hide its OWN back edges (its front faces are genuinely nearer,
      // and local-depth keeps coplanar front edges since g≈0); needed for edges
      if (!includeSameBox && sf.boxId === boxId) continue
      if (sf.depthMax <= nearLimit + depthEps) continue // never nearer than the target
      if (!bboxOverlap(sf.bbox, bbox)) continue
      if (!covers(sf)) continue // drop bbox-only overlaps that don't actually cover
      cand.push(sf)
    }
    if (cand.length > maxK) {
      cand.sort((a, b) => b.depthMax - a.depthMax)
      cand.length = maxK
    }
    return cand
  }
  const MIN_LEN = 0.25 // mm — drop strokes too small to plot cleanly
  const polyLen = (pl: Polyline) => {
    let L = 0
    for (let i = 1; i < pl.length; i++) L += Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1])
    return L
  }
  const push = (dest: Polyline[], pl: Polyline) => {
    if (pl.length >= 2 && polyLen(pl) >= MIN_LEN) dest.push(pl)
  }

  // ── edges with hidden-line removal (front objects hide back objects) ──────
  // Dedupe coincident projected edges keeping the NEAREST one, so an edge that
  // is unoccluded at the front is never erased using a farther twin's depth.
  const layerMap: Record<PenColor, Polyline[]> = { black: [], red: [], blue: [], yellow: [] }
  const edgeMap = new Map<string, { a: Vec2; b: Vec2; da: number; db: number; depth: number; boxId: number }>()
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
      if (!existing || depth > existing.depth)
        edgeMap.set(key, { a, b, da: pa.depth, db: pb.depth, depth, boxId: box.id })
    }
  }
  for (const ed of edgeMap.values()) {
    if (!isFinite(hiddenLayers)) {
      push(layerMap.black, [ed.a, ed.b])
      continue
    }
    const occ = gatherOccluders(
      Math.min(ed.da, ed.db),
      polyBBox([ed.a, ed.b]),
      ed.boxId,
      (sf) => segInsideConvex(ed.a, ed.b, sf.poly) !== null,
      true, // let a box hide its own back edges
    )
    if (occ.length === 0) push(layerMap.black, [ed.a, ed.b])
    else for (const pl of clipPolyline([ed.a, ed.b], [ed.da, ed.db], occ, hiddenLayers, depthEps)) push(layerMap.black, pl)
  }

  if (needFills) {
    const angleByAxis: Record<Axis, number> = {
      x: (p.angleX * Math.PI) / 180,
      y: (p.angleY * Math.PI) / 180,
      z: (p.angleZ * Math.PI) / 180,
    }
    for (const ff of fillFaces) {
      // tone band → spacing. The darkest band gets the user's hatchSpacing;
      // each band toward the light widens it by ×bandRatio (a constant tone
      // RATIO per step, so the ladder reads perceptually even on paper).
      let band = ff.band
      if (ff.color === 'black') {
        // a fully-lit structural face may drop its hatch → open paper
        if (p.litWhite && band === 0) continue
      } else {
        band = Math.max(band, 1) // colour must always read — never fully open
      }
      const nd = (dMax - ff.depth) / dRange // 0 near, 1 far
      const spacing = p.hatchSpacing * Math.pow(bandRatio, levels - 1 - band) * (1 + p.depthFalloff * nd)
      const angle = angleByAxis[ff.hatchAxis]

      // boards are few faces but heavily crossed → use a larger occluder cap so
      // dense scenes never leak hatch through a dropped occluder
      const occ = isFinite(fillLayers)
        ? gatherOccluders(ff.depthMin, ff.bbox, ff.boxId, (sf) => convexOverlap(sf.poly, ff.poly), false, 96)
        : []
      // visible straight pieces of any segment on this face, ordered a→b. The
      // hatch lies on the face's own depth plane, so a point's depth is exact.
      const clip = (a: Vec2, b: Vec2): Vec2[][] => {
        if (occ.length === 0) return [[a, b]]
        const da = ff.dA * a[0] + ff.dB * a[1] + ff.dC
        const db = ff.dA * b[0] + ff.dB * b[1] + ff.dC
        return clipPolyline([a, b], [da, db], occ, fillLayers, depthEps)
      }

      // clip each hatch line, THEN re-link the visible pieces into as few pen
      // strokes as the unoccluded region allows (no stray connector stubs)
      const dest = layerMap[ff.color]
      for (const pl of connectedHatch(hatchPolygon(ff.poly, angle, spacing), clip)) push(dest, pl)
      // cross-hatch is a SHADOW device: only the darkest band gets the second,
      // perpendicular pass — the shadow side goes truly deep, lit faces stay open
      if (p.crossHatch && ff.band >= levels - 1)
        for (const pl of connectedHatch(hatchPolygon(ff.poly, angle + Math.PI / 2, spacing), clip)) push(dest, pl)
    }
  }

  const layers: LineLayer[] = PEN_ORDER.filter((c) => layerMap[c].length > 0).map((c) => ({
    color: c,
    hex: PEN_HEX[c],
    paths: layerMap[c],
  }))

  let penPaths = 0
  let segments = 0
  for (const c of PEN_ORDER) {
    penPaths += layerMap[c].length
    for (const pl of layerMap[c]) segments += pl.length - 1
  }
  return {
    layers,
    page: { w, h },
    seed: p.seed,
    stats: { boxes: model.boxes.length, penPaths, segments },
  }
}
