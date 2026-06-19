import type { Axis, BeamModel, LineLayer, Params, PenColor, RenderResult, Segment, Vec2, Vec3 } from '../types'
import { boxEdges, boxFaces } from './geometry'
import { makeProjector } from './projection'
import { hatchPolygon } from './hatch'
import { bboxOverlap, clipByCoverage, polyBBox, type BBox } from './occlusion'
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

/** Map the occlusion slider (0 = x-ray, 100 = solid) to a coverage layer count. */
function occlusionLayers(occlusion: number): number {
  const o = occlusion / 100
  if (o <= 0.02) return Infinity // x-ray: nothing clips
  const maxLayers = 6
  return Math.max(1, Math.round(maxLayers - (maxLayers - 1) * o)) // o=1 → 1 (solid)
}

interface FillFace {
  poly: Vec2[]
  bbox: BBox
  depth: number
  color: PenColor
  hatchAxis: Axis
  boxId: number
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

  // ── edges: full wireframe, never occluded → permanent density ─────────────
  const edgeSegs: Segment[] = []
  const seen = new Set<string>()
  for (const box of model.boxes) {
    for (const e of boxEdges(box)) {
      const a = toPage(proj.project(e[0]))
      const b = toPage(proj.project(e[1]))
      // dedupe coincident segments to spare the pen
      const ka = `${a[0].toFixed(2)},${a[1].toFixed(2)}`
      const kb = `${b[0].toFixed(2)},${b[1].toFixed(2)}`
      const key = ka < kb ? ka + '|' + kb : kb + '|' + ka
      if (seen.has(key)) continue
      seen.add(key)
      edgeSegs.push([a, b])
    }
  }
  const edgeCount = edgeSegs.length // before any black fills are appended below

  const layerMap: Record<PenColor, Segment[]> = { black: edgeSegs, red: [], blue: [], yellow: [] }

  if (!opts.edgesOnly) {
    // ── collect visible, fillable faces ─────────────────────────────────────
    const fillFaces: FillFace[] = []
    for (const box of model.boxes) {
      for (const f of boxFaces(box)) {
        const rn = proj.rotate(f.normal)
        if (rn[2] <= 1e-6) continue // back-facing → cull

        let color: PenColor | null = null
        if (f.isCap) {
          if (p.yellowCaps) color = 'yellow'
        } else if (f.isBoardFace) {
          color = box.color
        } else if (box.kind === 'beam' && p.hatchBeams) {
          color = 'black'
        }
        if (!color) continue // long board sides & unhatched beam faces stay edges-only

        const poly = f.corners.map((c: Vec3) => toPage(proj.project(c)))
        let depth = 0
        for (const c of f.corners) depth += proj.project(c).depth
        depth /= 4
        fillFaces.push({ poly, bbox: polyBBox(poly), depth, color, hatchAxis: f.axis, boxId: box.id })
      }
    }

    // depth range for atmospheric falloff (far → wider hatch → lighter)
    let dMin = Infinity
    let dMax = -Infinity
    for (const ff of fillFaces) {
      if (ff.depth < dMin) dMin = ff.depth
      if (ff.depth > dMax) dMax = ff.depth
    }
    const dRange = Math.max(1e-6, dMax - dMin)

    const angleByAxis: Record<Axis, number> = {
      x: (p.angleX * Math.PI) / 180,
      y: (p.angleY * Math.PI) / 180,
      z: (p.angleZ * Math.PI) / 180,
    }
    const maxLayers = occlusionLayers(p.occlusion)

    for (const ff of fillFaces) {
      const nd = (dMax - ff.depth) / dRange // 0 near, 1 far
      const spacing = p.hatchSpacing * (1 + p.depthFalloff * nd)
      const angle = angleByAxis[ff.hatchAxis]

      let segs = hatchPolygon(ff.poly, angle, spacing)
      if (p.crossHatch) segs = segs.concat(hatchPolygon(ff.poly, angle + Math.PI / 2, spacing))

      // occluders = nearer fill-faces (solid colour) that overlap in 2D
      let occluders: Vec2[][] = []
      if (isFinite(maxLayers)) {
        const cand: { poly: Vec2[]; depth: number }[] = []
        for (const other of fillFaces) {
          if (other === ff || other.boxId === ff.boxId) continue
          if (other.depth <= ff.depth + 1e-6) continue
          if (!bboxOverlap(other.bbox, ff.bbox)) continue
          cand.push({ poly: other.poly, depth: other.depth })
        }
        // keep only the nearest K occluders: a coverage count that only needs to
        // reach maxLayers (<=6) is never changed by the far ones, and this caps
        // the clip cost so extreme params can't freeze the main thread
        const K = 32
        if (cand.length > K) {
          cand.sort((a, b) => b.depth - a.depth)
          cand.length = K
        }
        occluders = cand.map((c) => c.poly)
      }

      const dest = layerMap[ff.color]
      if (occluders.length === 0) {
        for (const sgmt of segs) dest.push(sgmt)
      } else {
        for (const sgmt of segs) {
          const kept = clipByCoverage(sgmt, occluders, maxLayers)
          for (const k of kept) dest.push(k)
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
