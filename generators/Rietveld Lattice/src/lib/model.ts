import { Rng } from './rng'
import type { Axis, BeamModel, Box, ElementKind, Params, PenColor, Vec3 } from '../types'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const OTHERS: Record<Axis, [Axis, Axis]> = {
  x: ['y', 'z'],
  y: ['x', 'z'],
  z: ['x', 'y'],
}
const AXIS_INDEX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 }

/**
 * Build the shared 3D beam-model. Pure function of `seed` + params — same input
 * always yields the identical set of boxes. This is the single source of truth
 * that both the Three.js viewport and the SVG projector consume.
 *
 * The core mechanic: beams sit on discrete lanes (their depth). In 3D they never
 * touch — they pass over and under each other and overrun past every crossing.
 * Flattened by the projector, those depth-separated beams collapse into a dense
 * thicket. Density is a byproduct of projection, not added noise.
 */
export function buildModel(p: Params): BeamModel {
  const rng = new Rng(p.seed)
  const gx = p.gridX
  const gy = p.gridY
  const gz = p.gridZ
  const grid: Record<Axis, number> = { x: gx, y: gy, z: gz }

  const boxes: Box[] = []
  let id = 0

  const add = (
    kind: ElementKind,
    runAxis: Axis,
    thinAxis: Axis,
    min: Vec3,
    max: Vec3,
    color: PenColor,
  ) => {
    boxes.push({
      id: id++,
      kind,
      runAxis,
      thinAxis,
      center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
      half: [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2],
      color,
    })
  }

  // ── colour ordering strategy (rule, not random) ──────────────────────────
  let colourIdx = 0
  const pickColour = (posFrac: number): PenColor => {
    const i = colourIdx++
    switch (p.colourStrategy) {
      case 'alternating':
        return i % 2 === 0 ? 'red' : 'blue'
      case 'weighted':
        return rng.chance(p.redShare) ? 'red' : 'blue'
      case 'positional':
        return posFrac < 0.5 ? 'red' : 'blue'
    }
  }

  // helper: a centred span as [lo, hi] within [0, grid]
  const span = (centerFrac: number, widthFrac: number, g: number, scale: number): [number, number] => {
    const c = centerFrac * g
    const hw = (widthFrac * g * scale) / 2
    return [clamp(c - hw, 0, g), clamp(c + hw, 0, g)]
  }

  const dom = p.dominance
  const boardScale = lerp(0.75, 1.3, dom)
  const thk = clamp(p.boardThickness, 0.05, 1.2)

  // ── signature L: one horizontal seat + one upright back, a loose L ────────
  const seatColour = pickColour(0.47)
  const backColour: PenColor = seatColour === 'red' ? 'blue' : 'red'

  // seat — horizontal board, thin on y, low in the frame
  {
    const [x0, x1] = span(0.5, 0.82, gx, boardScale)
    const [z0, z1] = span(0.5, 0.66, gz, boardScale)
    const y0 = gy * 0.3
    add('board', 'y', 'y', [x0, y0, z0], [x1, y0 + thk, z1], seatColour)
  }
  // back — upright board, thin on z, rising above the seat, offset to form an L
  {
    const [x0, x1] = span(0.36, 0.56, gx, boardScale)
    const yBase = gy * 0.26
    const yTop = yBase + lerp(0.42, 0.66, dom) * gy * boardScale
    const z0 = gz * 0.66
    add('board', 'z', 'z', [x0, yBase, z0], [x1, clamp(yTop, 0, gy), z0 + thk], backColour)
  }

  // ── free lattice of beams (the dense thicket) ────────────────────────────
  const cross = clamp(p.crossSection, 0.03, 0.8)
  const ch = cross / 2
  const freeCount = Math.round(p.beamCount * lerp(1.25, 0.5, dom))

  for (let i = 0; i < freeCount; i++) {
    const axis = rng.weighted<Axis>(['x', 'y', 'z'], [0.4, 0.4, 0.2])
    const [a, b] = OTHERS[axis]
    const gRun = grid[axis]

    // lane assignment on the two non-run axes = this beam's depth
    const laneA = rng.int(1, Math.max(1, grid[a] - 1))
    const laneB = rng.int(1, Math.max(1, grid[b] - 1))

    // span along the run axis, then overrun past both ends
    const len = clamp(rng.range(p.beamLenMin, p.beamLenMax), 0.5, gRun)
    const start = rng.range(0, Math.max(0.001, gRun - len))
    const lo = start - p.overrun
    const hi = start + len + p.overrun

    const min: Vec3 = [0, 0, 0]
    const max: Vec3 = [0, 0, 0]
    min[AXIS_INDEX[axis]] = lo
    max[AXIS_INDEX[axis]] = hi
    min[AXIS_INDEX[a]] = laneA - ch
    max[AXIS_INDEX[a]] = laneA + ch
    min[AXIS_INDEX[b]] = laneB - ch
    max[AXIS_INDEX[b]] = laneB + ch

    add('beam', axis, axis, min, max, 'black')
  }

  // ── a few extra colour boards floating in the lattice ────────────────────
  for (let i = 0; i < p.extraBoards; i++) {
    const thinAxis = rng.weighted<Axis>(['x', 'y', 'z'], [0.3, 0.3, 0.4])
    const [a, b] = OTHERS[thinAxis]
    const laneT = rng.range(1, Math.max(1, grid[thinAxis] - 1))
    const [a0, a1] = span(rng.range(0.3, 0.7), rng.range(0.28, 0.5), grid[a], 1)
    const [b0, b1] = span(rng.range(0.3, 0.7), rng.range(0.28, 0.5), grid[b], 1)

    const min: Vec3 = [0, 0, 0]
    const max: Vec3 = [0, 0, 0]
    min[AXIS_INDEX[thinAxis]] = laneT - thk / 2
    max[AXIS_INDEX[thinAxis]] = laneT + thk / 2
    min[AXIS_INDEX[a]] = a0
    max[AXIS_INDEX[a]] = a1
    min[AXIS_INDEX[b]] = b0
    max[AXIS_INDEX[b]] = b1

    const posFrac = (min[0] + max[0]) / 2 / gx
    add('board', thinAxis, thinAxis, min, max, pickColour(posFrac))
  }

  // ── centre the whole model on the origin (nice for orbit + projection) ───
  const off: Vec3 = [gx / 2, gy / 2, gz / 2]
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const box of boxes) {
    for (let k = 0; k < 3; k++) {
      box.center[k] -= off[k]
      const lo = box.center[k] - box.half[k]
      const hi = box.center[k] + box.half[k]
      if (lo < min[k]) min[k] = lo
      if (hi > max[k]) max[k] = hi
    }
  }

  return { boxes, bounds: { min, max } }
}
