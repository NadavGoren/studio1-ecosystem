import { Rng } from './rng'
import { rotAxis, mulMatVec } from './mat'
import type { Axis, BeamModel, Box, ElementKind, Mat3, Params, PenColor, Vec3 } from '../types'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const OTHERS: Record<Axis, [Axis, Axis]> = {
  x: ['y', 'z'],
  y: ['x', 'z'],
  z: ['x', 'y'],
}
const AXIS_INDEX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 }
const AXIS_VEC: Record<Axis, Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }
const DEG = Math.PI / 180

/** world-space AABB of a (possibly rotated) box */
function worldAABB(center: Vec3, half: Vec3, rot?: Mat3): [Vec3, Vec3] {
  if (!rot) {
    return [
      [center[0] - half[0], center[1] - half[1], center[2] - half[2]],
      [center[0] + half[0], center[1] + half[1], center[2] + half[2]],
    ]
  }
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const r = mulMatVec(rot, [sx * half[0], sy * half[1], sz * half[2]])
        for (let k = 0; k < 3; k++) {
          const v = center[k] + r[k]
          if (v < min[k]) min[k] = v
          if (v > max[k]) max[k] = v
        }
      }
  return [min, max]
}

/**
 * Build the shared 3D beam-model — a pure function of seed + params. Three
 * composition modes, each a reading of a Rietveld work:
 *  - lattice: an open orthogonal thicket grown around the signature seat+back L
 *  - chair: the Red-and-Blue chair grammar — a leg frame, rails, reclined planes
 *  - architecture: Schröder-house / Berlin-chair intersecting cantilevered planes
 * Nothing interpenetrates: solid parts pass over and under each other in depth.
 */
export function buildModel(p: Params): BeamModel {
  const rng = new Rng(p.seed)
  const gx = p.gridX
  const gy = p.gridY
  const gz = p.gridZ
  const grid: Record<Axis, number> = { x: gx, y: gy, z: gz }

  const boxes: Box[] = []
  const aabbs: [Vec3, Vec3][] = []
  let id = 0
  const GAP = 1e-4

  const collidesAABB = (min: Vec3, max: Vec3): boolean =>
    aabbs.some(([bmin, bmax]) => {
      for (let k = 0; k < 3; k++) {
        const ov = Math.min(max[k], bmax[k]) - Math.max(min[k], bmin[k])
        if (ov <= GAP) return false
      }
      return true
    })

  /** add unconditionally (signature elements & deliberate frame) */
  const register = (kind: ElementKind, runAxis: Axis, thinAxis: Axis, center: Vec3, half: Vec3, color: PenColor, rot?: Mat3) => {
    const [min, max] = worldAABB(center, half, rot)
    boxes.push({ id: id++, kind, runAxis, thinAxis, center, half, color, rot })
    aabbs.push([min, max])
  }
  /** add only if it interpenetrates nothing; colour resolved lazily on success */
  const addIfFits = (
    kind: ElementKind,
    runAxis: Axis,
    thinAxis: Axis,
    center: Vec3,
    half: Vec3,
    colorFn: () => PenColor,
    rot?: Mat3,
  ): boolean => {
    const [min, max] = worldAABB(center, half, rot)
    if (collidesAABB(min, max)) return false
    boxes.push({ id: id++, kind, runAxis, thinAxis, center, half, color: colorFn(), rot })
    aabbs.push([min, max])
    return true
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
  const seatColour = pickColour(0.47)
  const backColour: PenColor = seatColour === 'red' ? 'blue' : 'red'

  // ── tunables derived from params ─────────────────────────────────────────
  const dom = p.dominance
  const tiltAmt = clamp(p.boardTilt, 0, 1)
  const vert = clamp(p.verticality, 0, 1)
  const asym = clamp(p.asymmetry, 0, 1)
  const thk = clamp(p.boardThickness, 0.05, 1.2)
  const cross = clamp(p.crossSection, 0.03, 0.8)
  const ch = cross / 2
  const boardScale = lerp(0.75, 1.3, dom)

  // asymmetry shifts the signature mass off-centre (De Stijl balance)
  const asymDir = rng.f() < 0.5 ? -1 : 1
  const asymShift = asymDir * asym * gx * 0.16

  // verticality → beam orientation weights [x, y(up), z(depth)]
  const wY = lerp(0.22, 0.62, vert)
  const wX = lerp(0.56, 0.22, vert)
  const wZ = Math.max(0.08, 1 - wX - wY)
  const orient: Axis[] = ['x', 'y', 'z']
  const orientW = [wX, wY, wZ]

  const seatY = gy * 0.3

  // ── shared builders ───────────────────────────────────────────────────────
  const addSeat = (scale = 1, tiltRad = 0): { x0: number; x1: number; z0: number; z1: number } => {
    const cx = clamp(gx * 0.5 + asymShift, gx * 0.2, gx * 0.8)
    const hw = (0.82 * gx * boardScale * scale) / 2
    const x0 = clamp(cx - hw, 0, gx)
    const x1 = clamp(cx + hw, 0, gx)
    const cz = gz * 0.5
    const hz = (0.66 * gz * boardScale * scale) / 2
    const z0 = clamp(cz - hz, 0, gz)
    const z1 = clamp(cz + hz, 0, gz)
    const rot = tiltRad !== 0 ? rotAxis(AXIS_VEC.x, tiltRad) : undefined
    register('board', 'y', 'y', [(x0 + x1) / 2, seatY + thk / 2, (z0 + z1) / 2], [(x1 - x0) / 2, thk / 2, (z1 - z0) / 2], seatColour, rot)
    return { x0, x1, z0, z1 }
  }

  // the back reclines by pivoting about its BOTTOM edge so it sits on the seat
  const addBack = (scale = 1, reclineBoost = 0) => {
    const cx = clamp(gx * 0.43 + asymShift, gx * 0.15, gx * 0.8)
    const hw = (0.56 * gx * boardScale * scale) / 2
    const x0 = clamp(cx - hw, 0, gx)
    const x1 = clamp(cx + hw, 0, gx)
    const yBase = seatY + thk
    const yTop = clamp(yBase + lerp(0.42, 0.66, dom) * gy * boardScale * scale, 0, gy)
    const hx = (x1 - x0) / 2
    const hy = (yTop - yBase) / 2
    const z0 = gz * 0.66
    const cz = z0 + thk / 2
    const recline = Math.min(1, tiltAmt + reclineBoost) * 30 * DEG
    if (recline > 0) {
      const c = Math.cos(recline)
      const s = Math.sin(recline)
      // keep the bottom-centre at (cx, yBase, cz) after rotating about x by -recline
      register('board', 'z', 'z', [(x0 + x1) / 2, yBase + hy * c, cz - hy * s], [hx, hy, thk / 2], backColour, rotAxis(AXIS_VEC.x, -recline))
    } else {
      register('board', 'z', 'z', [(x0 + x1) / 2, (yBase + yTop) / 2, cz], [hx, hy, thk / 2], backColour)
    }
  }

  // free colour boards, some tilted
  const growBoards = (count: number) => {
    for (let i = 0; i < count; i++) {
      for (let tries = 0; tries < 40; tries++) {
        const thinAxis = rng.weighted<Axis>(['x', 'y', 'z'], [0.3, 0.3, 0.4])
        const [a, b] = OTHERS[thinAxis]
        const laneT = rng.range(1, Math.max(1, grid[thinAxis] - 1))
        const ca = rng.range(0.3, 0.7) + asymShift / gx
        const [a0, a1] = spanFrac(clamp(ca, 0.2, 0.8), rng.range(0.28, 0.5), grid[a])
        const [b0, b1] = spanFrac(rng.range(0.3, 0.7), rng.range(0.28, 0.5), grid[b])
        const center: Vec3 = [0, 0, 0]
        const half: Vec3 = [0, 0, 0]
        center[AXIS_INDEX[thinAxis]] = laneT
        half[AXIS_INDEX[thinAxis]] = thk / 2
        center[AXIS_INDEX[a]] = (a0 + a1) / 2
        half[AXIS_INDEX[a]] = (a1 - a0) / 2
        center[AXIS_INDEX[b]] = (b0 + b1) / 2
        half[AXIS_INDEX[b]] = (b1 - b0) / 2
        const tiltR = (rng.f() * 2 - 1) * tiltAmt * 24 * DEG
        const rot = tiltR !== 0 ? rotAxis(AXIS_VEC[a], tiltR) : undefined
        const posFrac = center[0] / gx
        if (addIfFits('board', thinAxis, thinAxis, center, half, () => pickColour(posFrac), rot)) break
      }
    }
  }

  // free beams, orientation biased by verticality
  const growBeams = (count: number) => {
    for (let i = 0; i < count; i++) {
      for (let tries = 0; tries < 40; tries++) {
        const axis = rng.weighted<Axis>(orient, orientW)
        const [a, b] = OTHERS[axis]
        const gRun = grid[axis]
        const laneA = rng.int(1, Math.max(1, grid[a] - 1))
        const laneB = rng.int(1, Math.max(1, grid[b] - 1))
        const len = clamp(rng.range(p.beamLenMin, p.beamLenMax), 0.5, gRun)
        const start = rng.range(0, Math.max(0.001, gRun - len))
        const lo = start - p.overrun
        const hi = start + len + p.overrun
        const center: Vec3 = [0, 0, 0]
        const half: Vec3 = [0, 0, 0]
        center[AXIS_INDEX[axis]] = (lo + hi) / 2
        half[AXIS_INDEX[axis]] = (hi - lo) / 2
        center[AXIS_INDEX[a]] = laneA
        half[AXIS_INDEX[a]] = ch
        center[AXIS_INDEX[b]] = laneB
        half[AXIS_INDEX[b]] = ch
        if (addIfFits('beam', axis, axis, center, half, () => 'black')) break
      }
    }
  }

  // a vertical "leg" beam between two y heights at (x,z)
  const addUpright = (x: number, z: number, yLo: number, yHi: number) =>
    register('beam', 'y', 'y', [x, (yLo + yHi) / 2, z], [ch, (yHi - yLo) / 2, ch], 'black')

  function spanFrac(centerFrac: number, widthFrac: number, g: number): [number, number] {
    const c = centerFrac * g
    const hw = (widthFrac * g) / 2
    return [clamp(c - hw, 0, g), clamp(c + hw, 0, g)]
  }

  // ── compose by structure mode ─────────────────────────────────────────────
  if (p.structure === 'chair') {
    // Red-and-Blue chair: a leg frame carrying a seat and a reclined back
    const seat = addSeat(1, 0) // flat seat so the legs meet it cleanly
    addBack(1, 0.5) // chair back is always reclined
    // 4 legs from the floor up to the seat underside
    const legBottom = -p.overrun
    for (const [lx, lz] of [
      [seat.x0, seat.z0],
      [seat.x1, seat.z0],
      [seat.x0, seat.z1],
      [seat.x1, seat.z1],
    ] as [number, number][])
      addUpright(lx, lz, legBottom, seatY)
    // a low stretcher + an arm rail with overruns
    for (const ry of [seatY * 0.45, seatY + thk + gy * 0.16]) {
      for (const cz of [seat.z0, seat.z1]) {
        if (rng.chance(0.7))
          register('beam', 'x', 'x', [(seat.x0 + seat.x1) / 2, ry, cz], [(seat.x1 - seat.x0) / 2 + p.overrun, ch, ch], 'black')
      }
    }
    growBoards(Math.min(p.extraBoards, 1))
    growBeams(Math.round(p.beamCount * 0.32))
  } else if (p.structure === 'architecture') {
    // Schröder / Berlin: intersecting cantilevered planes at staggered depths
    const planeCount = 4 + p.extraBoards
    for (let i = 0; i < planeCount; i++) {
      for (let tries = 0; tries < 40; tries++) {
        const horizontal = rng.chance(0.45)
        const thinAxis: Axis = horizontal ? 'y' : rng.chance(0.5) ? 'z' : 'x'
        const [a, b] = OTHERS[thinAxis]
        const laneT = rng.range(1, Math.max(1, grid[thinAxis] - 1))
        const ca = lerp(0.5, rng.range(0.25, 0.78), 0.5 + 0.5 * asym) + asymShift / gx
        const [a0, a1] = spanFrac(clamp(ca, 0.18, 0.82), rng.range(0.42, 0.72), grid[a])
        const [b0, b1] = spanFrac(rng.range(0.28, 0.72), rng.range(0.42, 0.72), grid[b])
        const center: Vec3 = [0, 0, 0]
        const half: Vec3 = [0, 0, 0]
        center[AXIS_INDEX[thinAxis]] = laneT
        half[AXIS_INDEX[thinAxis]] = thk / 2
        center[AXIS_INDEX[a]] = (a0 + a1) / 2
        half[AXIS_INDEX[a]] = (a1 - a0) / 2
        center[AXIS_INDEX[b]] = (b0 + b1) / 2
        half[AXIS_INDEX[b]] = (b1 - b0) / 2
        const tiltR = (rng.f() * 2 - 1) * tiltAmt * 20 * DEG
        const rot = tiltR !== 0 ? rotAxis(AXIS_VEC[a], tiltR) : undefined
        const colour: PenColor = i === 0 ? seatColour : i === 1 ? backColour : pickColour(center[0] / gx)
        if (addIfFits('board', thinAxis, thinAxis, center, half, () => colour, rot)) break
      }
    }
    growBeams(Math.round(p.beamCount * 0.28)) // linear accents only
  } else {
    // lattice (default): the open orthogonal thicket around the signature L
    addSeat(1, tiltAmt * 10 * DEG)
    addBack(1, 0)
    growBoards(p.extraBoards)
    growBeams(Math.round(p.beamCount * lerp(1.25, 0.5, dom)))
  }

  // ── centre the whole model on the origin ─────────────────────────────────
  const off: Vec3 = [gx / 2, gy / 2, gz / 2]
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (let bi = 0; bi < boxes.length; bi++) {
    const box = boxes[bi]
    box.center[0] -= off[0]
    box.center[1] -= off[1]
    box.center[2] -= off[2]
    const [amin, amax] = worldAABB(box.center, box.half, box.rot)
    for (let k = 0; k < 3; k++) {
      if (amin[k] < min[k]) min[k] = amin[k]
      if (amax[k] > max[k]) max[k] = amax[k]
    }
  }

  return { boxes, bounds: { min, max } }
}
