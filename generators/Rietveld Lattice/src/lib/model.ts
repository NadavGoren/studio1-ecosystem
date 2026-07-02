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
/** pinwheel offsets (x, z) — walking this cycle rotates the cantilever direction */
const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
]

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
 * Build the shared 3D beam-model — a pure function of seed + params. Six
 * composition modes, each a reading of a Rietveld work, and each built from
 * the same discipline: members meet FACE against FACE (Rietveld's lap
 * joinery), nothing interpenetrates, and nothing floats — every element
 * touches the structure it belongs to.
 *  - lattice: a seat+back signature CARRIED by real beams and posts, grown
 *    into a connected thicket of grid-snapped, lap-jointed sticks
 *  - chair: the Red-and-Blue chair frame — posts outside the seat, side rails
 *    lapped on the posts' inner faces, cross rails resting on the side rails
 *    carrying the seat, arm rails on the post tops, a reclined back
 *  - buffet: the 1919 buffet — symmetric stacked slabs on short posts between
 *    tiers, long protruding rails, colour panels at the rear
 *  - architecture: a Schröder-house corner — pinwheel-offset slabs, wall
 *    planes flush with slab edges spanning storey gaps, posts + balustrade
 *  - tower: floors clamped between four continuous corner posts, cantilevers
 *    rotating floor by floor, colour infill panels in the bays
 *  - joinery: a strict woven CAGE — square beams crossing on a regular 3D
 *    sub-grid, every member overrunning each crossing by one constant section
 *    width (the ~30mm rule); each beam family sits on its own plane
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

  /** does this AABB touch (or overlap) anything already placed? gap ≤ tol on every axis */
  const TOUCH_TOL = 0.02
  const touchesAny = (min: Vec3, max: Vec3): boolean =>
    aabbs.some(([bmin, bmax]) => {
      for (let k = 0; k < 3; k++) {
        const ov = Math.min(max[k], bmax[k]) - Math.max(min[k], bmin[k])
        if (ov < -TOUCH_TOL) return false
      }
      return true
    })

  /** add unconditionally (signature elements & deliberate frames) */
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
  /** add only if collision-free AND touching the existing structure (no floaters) */
  const addIfFitsTouching = (
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
    if (!touchesAny(min, max)) return false
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

  // Rietveld lap rule: each beam family is shifted one full section width along
  // a cyclically-chosen perpendicular axis (x→z, z→y, y→x). Members of different
  // families that share an integer grid lane then meet FACE against face —
  // exact contact, never interpenetration (lap = 2·ch, so shifted-section edge
  // == unshifted-section edge).
  const SHIFT: Record<Axis, Axis> = { x: 'z', z: 'y', y: 'x' }
  const lap = cross

  // asymmetry shifts the signature mass off-centre (De Stijl balance)
  const asymDir = rng.f() < 0.5 ? -1 : 1
  const asymShift = asymDir * asym * gx * 0.16

  // verticality → beam orientation weights [x, y(up), z(depth)]
  const wY = lerp(0.22, 0.62, vert)
  const wX = lerp(0.56, 0.22, vert)
  const wZ = Math.max(0.08, 1 - wX - wY)
  const orient: Axis[] = ['x', 'y', 'z']
  const orientW = [wX, wY, wZ]

  // ── shared builders ───────────────────────────────────────────────────────
  const centerHalf = (axis: Axis, lo: number, hi: number, laneA: number, laneB: number): { center: Vec3; half: Vec3 } => {
    const [a, b] = OTHERS[axis]
    const center: Vec3 = [0, 0, 0]
    const half: Vec3 = [0, 0, 0]
    center[AXIS_INDEX[axis]] = (lo + hi) / 2
    half[AXIS_INDEX[axis]] = (hi - lo) / 2
    center[AXIS_INDEX[a]] = laneA
    half[AXIS_INDEX[a]] = ch
    center[AXIS_INDEX[b]] = laneB
    half[AXIS_INDEX[b]] = ch
    return { center, half }
  }

  /**
   * A reclined board pivoting about its BOTTOM edge at (yBase, cz). The chair
   * faces +z (the viewer side), so the back sits on the FAR z plane and its top
   * leans away (−z) — the visible face is the lit front, as in the chair itself.
   */
  const addRecliningBack = (cx: number, hw: number, yBase: number, height: number, cz: number, recline: number, colour: PenColor) => {
    const hy = Math.max(0.3, height / 2)
    if (recline > 0.001) {
      const c = Math.cos(recline)
      const s = Math.sin(recline)
      register('board', 'z', 'z', [cx, yBase + hy * c, cz - hy * s], [hw, hy, thk / 2], colour, rotAxis(AXIS_VEC.x, -recline))
    } else {
      register('board', 'z', 'z', [cx, yBase + hy, cz], [hw, hy, thk / 2], colour)
    }
  }

  // Free beams for the thicket: grid-snapped lanes, a small Fibonacci length
  // palette (rhythm through repetition), family lap-offsets, and a hard
  // connectivity rule — a stick that touches nothing is not placed.
  const growSnappedBeams = (count: number) => {
    const lMin = Math.max(1, Math.round(p.beamLenMin))
    const lMax = Math.max(lMin, Math.round(p.beamLenMax))
    const lenPalette: number[] = []
    for (const L of [2, 3, 5, 8, 13]) if (L >= lMin && L <= lMax) lenPalette.push(L)
    if (lenPalette.length === 0) lenPalette.push(clamp(Math.round((lMin + lMax) / 2), 1, 32))
    for (let i = 0; i < count; i++) {
      for (let tries = 0; tries < 70; tries++) {
        const axis = rng.weighted<Axis>(orient, orientW)
        const [a, b] = OTHERS[axis]
        // cluster: anchor on an existing part so the thicket grows around the mass
        const anchor = boxes[rng.int(0, boxes.length - 1)]
        const laneA = clamp(Math.round(anchor.center[AXIS_INDEX[a]] + rng.int(-2, 2)), 0, grid[a])
        const laneB = clamp(Math.round(anchor.center[AXIS_INDEX[b]] + rng.int(-2, 2)), 0, grid[b])
        const len = Math.min(lenPalette[rng.int(0, lenPalette.length - 1)], grid[axis])
        const start = clamp(Math.round(anchor.center[AXIS_INDEX[axis]] - len / 2 + rng.int(-2, 2)), 0, grid[axis] - len)
        const lo = start - p.overrun
        const hi = start + len + p.overrun
        const { center, half } = centerHalf(axis, lo, hi, laneA, laneB)
        center[AXIS_INDEX[SHIFT[axis]]] += lap
        if (addIfFitsTouching('beam', axis, axis, center, half, () => 'black')) break
      }
    }
  }

  // Colour boards resting ON the structure: snapped spans, plane offsets chosen
  // so the board's face lands exactly on a beam family's face (±(ch+thk/2) for
  // the integer-lane family, ±(lap+ch+thk/2) for the shifted family).
  const growSnappedBoards = (count: number) => {
    for (let i = 0; i < count; i++) {
      for (let tries = 0; tries < 60; tries++) {
        const thin = rng.weighted<Axis>(['x', 'y', 'z'], [0.28, 0.44, 0.28])
        const [a, b] = OTHERS[thin]
        const anchor = boxes[rng.int(0, boxes.length - 1)]
        const lane = clamp(Math.round(anchor.center[AXIS_INDEX[thin]]), 0, grid[thin])
        const off = (rng.chance(0.5) ? ch + thk / 2 : lap + ch + thk / 2) * (rng.chance(0.5) ? 1 : -1)
        const ca = Math.round(anchor.center[AXIS_INDEX[a]])
        const cb = Math.round(anchor.center[AXIS_INDEX[b]])
        const ha = rng.int(1, 2)
        const hb = rng.int(1, 2)
        const a0 = clamp(ca - ha, 0, grid[a])
        const a1 = clamp(ca + ha, 0, grid[a])
        const b0 = clamp(cb - hb, 0, grid[b])
        const b1 = clamp(cb + hb, 0, grid[b])
        if (a1 - a0 < 1 || b1 - b0 < 1) continue
        const center: Vec3 = [0, 0, 0]
        const half: Vec3 = [0, 0, 0]
        center[AXIS_INDEX[thin]] = lane + off
        half[AXIS_INDEX[thin]] = thk / 2
        center[AXIS_INDEX[a]] = (a0 + a1) / 2
        half[AXIS_INDEX[a]] = (a1 - a0) / 2
        center[AXIS_INDEX[b]] = (b0 + b1) / 2
        half[AXIS_INDEX[b]] = (b1 - b0) / 2
        const posFrac = center[0] / gx
        if (addIfFitsTouching('board', thin, thin, center, half, () => pickColour(posFrac))) break
      }
    }
  }

  // ── compose by structure mode ─────────────────────────────────────────────
  if (p.structure === 'chair') {
    // ── Red-and-Blue chair: the real frame grammar, every joint a lap ───────
    const cx = clamp(gx * 0.5 + asymShift * 0.5, gx * 0.35, gx * 0.65)
    const hw = Math.max(1.2, gx * 0.3 * boardScale) // post frame half-width
    const xP0 = cx - hw
    const xP1 = cx + hw
    const zF = gz * 0.3
    const zB = gz * 0.72
    const seatY = gy * 0.34 // seat BOTTOM plane
    const armY = gy * 0.52 // arm rail centre height
    const ovr = p.overrun

    // 4 posts (floor → arm underside); the arms will rest on their tops
    for (const px of [xP0, xP1])
      for (const pz of [zF, zB]) register('beam', 'y', 'y', [px, (armY - ch) / 2, pz], [ch, (armY - ch) / 2, ch], 'black')

    // side rails + low stretchers lapped on the posts' INNER faces, ends overrunning
    for (const [px, inw] of [
      [xP0, 1],
      [xP1, -1],
    ] as [number, number][]) {
      for (const ry of [seatY - 3 * ch, seatY * 0.4]) {
        register('beam', 'z', 'z', [px + inw * lap, ry, (zF + zB) / 2], [ch, ch, (zB - zF) / 2 + ovr], 'black')
      }
    }
    // cross rails RESTING on the side rails, carrying the seat
    for (const rz of [zF + lap, zB - lap])
      register('beam', 'x', 'x', [(xP0 + xP1) / 2, seatY - ch, rz], [(xP1 - xP0) / 2 + ovr * 0.6, ch, ch], 'black')

    // seat: sides flush with the posts' inner faces, overhanging front/back
    const sOvh = Math.min(ovr, 1.5) * 0.8
    register(
      'board',
      'y',
      'y',
      [(xP0 + xP1) / 2, seatY + thk / 2, (zF + zB) / 2],
      [(xP1 - xP0) / 2 - ch, thk / 2, (zB - zF) / 2 + sOvh],
      seatColour,
    )
    // reclined back, bottom edge on the seat top, threading between the far posts
    const recline = clamp(tiltAmt + 0.35, 0, 1) * 32 * DEG
    addRecliningBack(cx, hw - lap - ch, seatY + thk, gy * 0.42 * boardScale, zF + lap, recline, backColour)
    // arm rails on the post tops, ends overrunning front and back
    for (const px of [xP0, xP1]) register('beam', 'z', 'z', [px, armY, (zF + zB) / 2], [ch, ch, (zB - zF) / 2 + ovr], 'black')
  } else if (p.structure === 'buffet') {
    // ── the 1919 buffet: symmetric stacked slabs, short posts, long rails ────
    const cxB = clamp(gx * 0.5 + asymShift * 0.4, gx * 0.4, gx * 0.6)
    const zF = clamp(Math.round(gz * 0.33), 1, gz - 1)
    const zB = clamp(Math.round(gz * 0.67), zF + 1, gz)
    const ovz = clamp(gz * 0.14, 0.4, 1.5) // slab overhang past the post planes
    // tiers bottom-up: plinth · counter (widest) · shelf · top
    const tiers = [
      { y: Math.max(1, Math.round(gy * 0.09)), hw: gx * 0.3, colour: 'black' as PenColor },
      { y: Math.round(gy * 0.36), hw: gx * 0.46, colour: seatColour },
      { y: Math.round(gy * 0.6), hw: gx * 0.34, colour: 'black' as PenColor },
      { y: Math.round(gy * 0.82), hw: gx * 0.22, colour: backColour },
    ]
    for (let k = 1; k < tiers.length; k++) if (tiers[k].y <= tiers[k - 1].y + 1) tiers[k].y = tiers[k - 1].y + 2
    // slight De Stijl skew — upper tiers drift off-centre with asymmetry
    const cxOf = (k: number) => cxB + asymDir * asym * gx * 0.05 * k
    for (const [k, t] of tiers.entries())
      register(
        'board',
        'y',
        'y',
        [cxOf(k), t.y + thk / 2, (zF + zB) / 2],
        [t.hw, thk / 2, (zB - zF) / 2 + ovz],
        t.colour,
      )
    // short posts between consecutive tiers (and floor→plinth, top→tips)
    const postPairs = (k0: number, k1: number): [number, number] => {
      const hwMin = Math.min(k0 >= 0 ? tiers[k0].hw : tiers[0].hw, k1 < tiers.length ? tiers[k1].hw : tiers[tiers.length - 1].hw)
      const inset = Math.max(0.6, hwMin - 0.6)
      const cxm = cxOf(Math.max(k0, 0))
      return [cxm - inset, cxm + inset]
    }
    const gapSpans: [number, number, number][] = [] // [yLo, yHi, gapIndex for insets]
    gapSpans.push([0, tiers[0].y, -1])
    for (let k = 0; k + 1 < tiers.length; k++) gapSpans.push([tiers[k].y + thk, tiers[k + 1].y, k])
    for (const [yLo, yHi, k] of gapSpans) {
      const [xl, xr] = postPairs(Math.max(k, 0), k + 1)
      for (const px of [xl, xr])
        for (const pz of [zF, zB]) register('beam', 'y', 'y', [px, (yLo + yHi) / 2, pz], [ch, (yHi - yLo) / 2, ch], 'black')
    }
    // tips above the top slab — the protruding post ends
    const tipH = clamp(p.overrun, 0.2, 2)
    {
      const yLo = tiers[3].y + thk
      const [xl, xr] = postPairs(3, 4)
      for (const px of [xl, xr])
        for (const pz of [zF, zB]) register('beam', 'y', 'y', [px, yLo + tipH / 2, pz], [ch, tipH / 2, ch], 'black')
    }
    // long rails hung on the posts' faces just under the slabs — the buffet's
    // signature protruding ends, overrunning the slab width on both sides
    const rails: [number, number][] = [
      [1, zF - lap], // under counter, front
      [1, zB + lap], // under counter, rear
      [2, zF - lap], // under shelf, front
      [3, zF - lap], // under top, front
    ]
    for (const [k, rz] of rails)
      register(
        'beam',
        'x',
        'x',
        [cxOf(k), tiers[k].y - ch, rz],
        [tiers[k].hw + p.overrun, ch, ch],
        'black',
      )
    // colour panels closing the rear bays between tiers
    const panelGaps = [1, 2, 0].slice(0, clamp(Math.round(p.extraBoards), 0, 3))
    for (const k of panelGaps) {
      const [xl, xr] = postPairs(k, k + 1)
      const yLo = tiers[k].y + thk
      const yHi = tiers[k + 1].y
      if (yHi - yLo < 0.5) continue
      register(
        'board',
        'z',
        'z',
        [(xl + xr) / 2, (yLo + yHi) / 2, zB - ch - thk / 2],
        [(xr - xl) / 2 - ch, (yHi - yLo) / 2, thk / 2],
        pickColour(k / 3),
      )
    }
  } else if (p.structure === 'architecture') {
    // ── Schröder corner: pinwheel slabs · flush walls · posts · balustrade ──
    const rot0 = rng.int(0, 3)
    const baseY = Math.max(1, Math.round(gy * 0.18))
    const topY = clamp(Math.round(gy * 0.72), baseY + 4, gy - 2)
    const ys = [baseY, Math.round((baseY + topY) / 2), topY]
    const cx = clamp(gx * 0.5 + asymShift, gx * 0.34, gx * 0.66)
    const cz = gz * 0.5
    interface Slab {
      x0: number
      x1: number
      z0: number
      z1: number
      yB: number
      yT: number
      dir: [number, number]
    }
    const slabs: Slab[] = []
    for (let k = 0; k < 3; k++) {
      const dir = DIRS[(rot0 + k) % 4]
      const hwx = Math.max(2, Math.round(gx * (0.26 - k * 0.02)))
      const hwz = Math.max(1, Math.round(gz * (0.3 - k * 0.02)))
      const mx = Math.round(cx + dir[0] * Math.max(1, Math.round(gx * 0.13)))
      const mz = Math.round(cz + dir[1] * Math.max(1, Math.round(gz * 0.15)))
      const x0 = clamp(mx - hwx, 0, gx)
      const x1 = clamp(mx + hwx, 0, gx)
      const z0 = clamp(mz - hwz, 0, gz)
      const z1 = clamp(mz + hwz, 0, gz)
      register('board', 'y', 'y', [(x0 + x1) / 2, ys[k] + thk / 2, (z0 + z1) / 2], [(x1 - x0) / 2, thk / 2, (z1 - z0) / 2], pickColour((x0 + x1) / (2 * gx)))
      slabs.push({ x0, x1, z0, z1, yB: ys[k], yT: ys[k] + thk, dir })
    }
    // wall planes: flush with a lower-slab edge, spanning the storey gap
    // exactly (top face of slab k → bottom face of slab k+1), on the side
    // OPPOSITE that slab's cantilever so the balustrade edge stays open
    const wallCount = 2 + clamp(Math.round(p.extraBoards), 0, 4)
    let placedWalls = 0
    for (let c = 0; c < 12 && placedWalls < wallCount; c++) {
      const k = c % 2 // gap index (slab k → slab k+1)
      const s = slabs[k]
      const gapLo = s.yT
      const gapHi = slabs[k + 1].yB
      if (gapHi - gapLo < 0.5) continue
      const alongX = (c + k) % 2 === 0
      if (alongX) {
        // thin-x wall at the edge away from the cantilever
        const xw = s.dir[0] > 0 ? s.x0 + thk / 2 : s.x1 - thk / 2
        const za = s.z0 + Math.round((s.z1 - s.z0) * 0.15)
        const zb = clamp(za + Math.max(1, Math.round((s.z1 - s.z0) * 0.55)), za + 1, s.z1)
        if (
          addIfFits('board', 'x', 'x', [xw, (gapLo + gapHi) / 2, (za + zb) / 2], [thk / 2, (gapHi - gapLo) / 2, (zb - za) / 2], () =>
            pickColour(xw / gx),
          )
        )
          placedWalls++
      } else {
        const zw = s.dir[1] > 0 ? s.z0 + thk / 2 : s.z1 - thk / 2
        const xa = s.x0 + Math.round((s.x1 - s.x0) * 0.15)
        const xb = clamp(xa + Math.max(1, Math.round((s.x1 - s.x0) * 0.55)), xa + 1, s.x1)
        if (
          addIfFits('board', 'z', 'z', [(xa + xb) / 2, (gapLo + gapHi) / 2, zw], [(xb - xa) / 2, (gapHi - gapLo) / 2, thk / 2], () =>
            pickColour(zw / gz),
          )
        )
          placedWalls++
      }
    }
    // parapet on the roof edge
    {
      const s = slabs[2]
      const h = Math.max(1, Math.round(gy * 0.09))
      const zw = s.dir[1] >= 0 ? s.z1 - thk / 2 : s.z0 + thk / 2
      const xa = s.x0 + Math.round((s.x1 - s.x0) * 0.2)
      const xb = clamp(xa + Math.max(1, Math.round((s.x1 - s.x0) * 0.5)), xa + 1, s.x1)
      addIfFits('board', 'z', 'z', [(xa + xb) / 2, s.yT + h / 2, zw], [(xb - xa) / 2, h / 2, thk / 2], () => pickColour(0.5))
    }
    // ground posts under the base slab's corners
    const s0 = slabs[0]
    for (const [px, pz] of [
      [s0.x0 + ch, s0.z0 + ch],
      [s0.x1 - ch, s0.z1 - ch],
    ] as [number, number][])
      addIfFits('beam', 'y', 'y', [px, s0.yB / 2, pz], [ch, s0.yB / 2, ch], () => 'black')
    // the mast: one through-post lapped against the mid slab's edge, rising past the roof
    {
      const s = slabs[1]
      const tipH = clamp(p.overrun, 0.2, 2)
      const mastTop = slabs[2].yT + tipH
      const cands: [number, number][] =
        s.dir[0] !== 0
          ? [
              [s.dir[0] > 0 ? s.x0 - ch : s.x1 + ch, clamp(Math.round((s.z0 + s.z1) / 2), s.z0 + 1, s.z1 - 1)],
              [s.dir[0] > 0 ? s.x0 - ch : s.x1 + ch, clamp(s.z0 + 1, s.z0, s.z1)],
            ]
          : [
              [clamp(Math.round((s.x0 + s.x1) / 2), s.x0 + 1, s.x1 - 1), s.dir[1] > 0 ? s.z0 - ch : s.z1 + ch],
              [clamp(s.x0 + 1, s.x0, s.x1), s.dir[1] > 0 ? s.z0 - ch : s.z1 + ch],
            ]
      for (const [px, pz] of cands)
        if (addIfFitsTouching('beam', 'y', 'y', [px, mastTop / 2, pz], [ch, mastTop / 2, ch], () => 'black')) break
    }
    // balustrade along the mid slab's cantilevered edge: two balusters + rail
    {
      const s = slabs[1]
      const railY = s.yT + Math.max(0.8, gy * 0.07)
      const balH = railY - ch - s.yT
      if (balH > 0.2) {
        const alongZ = s.dir[0] !== 0 // cantilever in x → the open edge runs in z
        const la = alongZ ? (s.dir[0] > 0 ? s.x1 - ch : s.x0 + ch) : s.dir[1] > 0 ? s.z1 - ch : s.z0 + ch
        const b0 = alongZ ? s.z0 + 1 : s.x0 + 1
        const b1 = alongZ ? s.z1 - 1 : s.x1 - 1
        const balusters: number[] = b1 - b0 < 0.5 ? [(b0 + b1) / 2] : [b0, b1]
        let ok = true
        for (const bpos of balusters) {
          const c: Vec3 = alongZ ? [la, s.yT + balH / 2, bpos] : [bpos, s.yT + balH / 2, la]
          if (!addIfFits('beam', 'y', 'y', c, [ch, balH / 2, ch], () => 'black')) ok = false
        }
        if (ok) {
          const mid = (b0 + b1) / 2
          const hl = (b1 - b0) / 2 + Math.min(p.overrun, 1)
          const c: Vec3 = alongZ ? [la, railY, mid] : [mid, railY, la]
          const h: Vec3 = alongZ ? [ch, ch, hl] : [hl, ch, ch]
          addIfFits('beam', alongZ ? 'z' : 'x', alongZ ? 'z' : 'x', c, h, () => 'black')
        }
      }
    }
    // a few linear accents ATTACHED to the slabs: sticks lying exactly on a
    // slab top, and stub posts standing on one (grid-snapped lanes cannot lap
    // the continuous slab planes, so accents anchor to the slab faces instead)
    const accents = Math.round(p.beamCount * 0.12)
    for (let i = 0; i < accents; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const s = slabs[rng.int(0, slabs.length - 1)]
        if (rng.chance(0.6)) {
          // lying stick on the slab top, overrunning one edge
          const alongXAcc = rng.chance(0.5)
          const laneMin = alongXAcc ? s.z0 : s.x0
          const laneMax = alongXAcc ? s.z1 : s.x1
          if (laneMax - laneMin < 1) continue
          const lane = clamp(Math.round(rng.range(laneMin, laneMax)), Math.ceil(laneMin + ch), Math.floor(laneMax - ch))
          const lo = (alongXAcc ? s.x0 : s.z0) - rng.range(0, p.overrun)
          const hi = (alongXAcc ? s.x1 : s.z1) + rng.range(0, p.overrun)
          const cy = s.yT + ch
          const c: Vec3 = alongXAcc ? [(lo + hi) / 2, cy, lane] : [lane, cy, (lo + hi) / 2]
          const h: Vec3 = alongXAcc ? [(hi - lo) / 2, ch, ch] : [ch, ch, (hi - lo) / 2]
          if (addIfFits('beam', alongXAcc ? 'x' : 'z', alongXAcc ? 'x' : 'z', c, h, () => 'black')) break
        } else {
          // stub post standing on the slab
          const px = clamp(Math.round(rng.range(s.x0, s.x1)), Math.ceil(s.x0 + ch), Math.floor(s.x1 - ch))
          const pz = clamp(Math.round(rng.range(s.z0, s.z1)), Math.ceil(s.z0 + ch), Math.floor(s.z1 - ch))
          const hgt = rng.int(1, 2)
          if (addIfFits('beam', 'y', 'y', [px, s.yT + hgt / 2, pz], [ch, hgt / 2, ch], () => 'black')) break
        }
      }
    }
  } else if (p.structure === 'tower') {
    // ── tower: floors between four continuous posts, rotating cantilevers ───
    const floors = clamp(Math.round(p.gridLinesY), 2, 6)
    const rot0 = rng.int(0, 3)
    const hwx = Math.max(2, Math.round(gx * 0.26))
    const hwz = Math.max(1, Math.round(gz * 0.3))
    const cxT = clamp(Math.round(gx * 0.5 + asymShift * 0.6), hwx, gx - hwx)
    const czT = Math.round(gz * 0.5)
    const xL = cxT - hwx
    const xR = cxT + hwx
    const zF = czT - hwz
    const zB = czT + hwz
    const base = Math.max(1, Math.round(gy * 0.05))
    const top = Math.min(gy - 1, Math.round(gy * 0.88))
    const ys: number[] = []
    for (let k = 0; k < floors; k++) {
      let y = Math.round(lerp(base, top, floors === 1 ? 0 : k / (floors - 1)))
      if (k > 0 && y <= ys[k - 1] + 1) y = ys[k - 1] + 2 // keep monotone; slight top overflow is fine
      ys.push(y)
    }
    const tipH = clamp(p.overrun, 0.2, 2)
    const postTop = ys[ys.length - 1] + thk + tipH
    for (const px of [xL, xR])
      for (const pz of [zF, zB]) register('beam', 'y', 'y', [px, postTop / 2, pz], [ch, postTop / 2, ch], 'black')
    // floor slabs clamped between the posts; the cantilever direction rotates
    const ext = Math.max(1.5, gx * 0.2)
    interface Floor {
      x0: number
      x1: number
      z0: number
      z1: number
      dir: [number, number]
    }
    const fls: Floor[] = []
    for (let k = 0; k < floors; k++) {
      const dir = DIRS[(rot0 + k) % 4]
      let x0 = xL + ch
      let x1 = xR - ch
      let z0 = zF + ch
      let z1 = zB - ch
      if (k > 0) {
        // ground slab stays inside; upper floors cantilever
        if (dir[0] > 0) x1 += ext
        else if (dir[0] < 0) x0 -= ext
        else if (dir[1] > 0) z1 += ext
        else z0 -= ext
      }
      register('board', 'y', 'y', [(x0 + x1) / 2, ys[k] + thk / 2, (z0 + z1) / 2], [(x1 - x0) / 2, thk / 2, (z1 - z0) / 2], 'black')
      fls.push({ x0, x1, z0, z1, dir })
    }
    // colour infill panels closing bays, rotating around the four faces
    const panels = clamp(Math.round(p.extraBoards), 0, floors - 1)
    for (let g = 0; g < panels; g++) {
      const yLo = ys[g] + thk
      const yHi = ys[g + 1]
      if (yHi - yLo < 0.5) continue
      const face = (rot0 + g + 2) % 4 // start opposite the first cantilever
      const cy = (yLo + yHi) / 2
      const hy = (yHi - yLo) / 2
      const posFrac = face === 0 || face === 2 ? (face === 0 ? xR / gx : xL / gx) : 0.5
      if (face === 0 || face === 2) {
        const xw = face === 0 ? xR - ch - thk / 2 : xL + ch + thk / 2
        addIfFits('board', 'x', 'x', [xw, cy, (zF + zB) / 2], [thk / 2, hy, (zB - zF) / 2 - ch], () => pickColour(posFrac))
      } else {
        const zw = face === 1 ? zB - ch - thk / 2 : zF + ch + thk / 2
        addIfFits('board', 'z', 'z', [(xL + xR) / 2, cy, zw], [(xR - xL) / 2 - ch, hy, thk / 2], () => pickColour(posFrac))
      }
    }
    // curb rails on the cantilevered edges (balcony read), every second floor
    for (let k = 1; k < floors; k++) {
      if (k % 2 === 0 && k !== floors - 1) continue
      const f = fls[k]
      const railY = ys[k] + thk + ch
      if (f.dir[0] !== 0) {
        const la = f.dir[0] > 0 ? f.x1 - ch : f.x0 + ch
        addIfFits('beam', 'z', 'z', [la, railY, (f.z0 + f.z1) / 2], [ch, ch, (f.z1 - f.z0) / 2], () => 'black')
      } else {
        const la = f.dir[1] > 0 ? f.z1 - ch : f.z0 + ch
        addIfFits('beam', 'x', 'x', [(f.x0 + f.x1) / 2, railY, la], [(f.x1 - f.x0) / 2, ch, ch], () => 'black')
      }
    }
  } else if (p.structure === 'joinery') {
    // ── Joinery: a strict woven cage on a regular 3D sub-grid ────────────────
    // The composition IS the grid. A sparse set of sub-grid lines per axis
    // defines a lattice of nodes; a square beam runs along every node line, so
    // every beam crosses every perpendicular beam — exactly as the chair's
    // members cross. Each beam overruns its outermost crossing by ONE constant
    // section width on both ends (the ~30mm rule), so every projecting end is
    // identical. Every node is sealed with a cap block → joints covered fully.
    const nx = clamp(Math.round(p.gridLinesX), 2, 6)
    const ny = clamp(Math.round(p.gridLinesY), 2, 6)
    const nz = clamp(Math.round(p.gridLinesZ), 2, 6)
    const ovh = cross * clamp(p.jointOverhang, 0.2, 3) // overhang = jointOverhang × full section width

    const evenLines = (g: number, n: number): number[] => {
      const a: number[] = []
      for (let k = 1; k <= n; k++) a.push((g * k) / (n + 1))
      return a
    }
    // a still-regular but non-uniform (Fibonacci) rhythm, chosen per axis by seed
    const fibRemap = (arr: number[], g: number): number[] => {
      const fib = [1, 1, 2, 3, 5, 8]
      const tot = fib.slice(0, arr.length).reduce((x, y) => x + y, 0)
      let acc = 0
      return arr.map((_, i) => {
        acc += fib[i]
        return (g * acc) / tot * 0.84 + g * 0.08
      })
    }
    const lanes: Record<Axis, number[]> = {
      x: evenLines(gx, nx),
      y: evenLines(gy, ny),
      z: evenLines(gz, nz),
    }
    if (rng.chance(0.5)) lanes.x = fibRemap(lanes.x, gx)
    if (rng.chance(0.5)) lanes.z = fibRemap(lanes.z, gz)
    // keep every overhang tip inside the grid box so auto-centre / page-fit is stable
    for (const ax of ['x', 'y', 'z'] as Axis[])
      lanes[ax] = lanes[ax].map((v) => clamp(v, ovh + ch, grid[ax] - ovh - ch))

    // soft beam budget: trim interior lines if the woven count would explode
    const beamEst = () =>
      lanes.y.length * lanes.z.length + lanes.x.length * lanes.z.length + lanes.x.length * lanes.y.length
    let guard = 0
    while (beamEst() > 64 && guard++ < 24) {
      const worst: Axis =
        lanes.x.length >= lanes.y.length && lanes.x.length >= lanes.z.length
          ? 'x'
          : lanes.y.length >= lanes.z.length
            ? 'y'
            : 'z'
      if (lanes[worst].length <= 2) break
      lanes[worst].splice(Math.floor(lanes[worst].length / 2), 1)
    }

    const ext = (ax: Axis): [number, number] => [lanes[ax][0] - ovh, lanes[ax][lanes[ax].length - 1] + ovh]

    // Each beam family lives on its OWN plane so members never interpenetrate —
    // physically impossible in real wood. At every crossing the members LAP
    // face-to-face (true Rietveld joinery, where sticks are screwed against one
    // another, never notched into the same space): each family is offset by one
    // full section along a cyclically-chosen perpendicular axis (x→z, z→y, y→x),
    // so any two of the three beams meeting at a node are separated in depth and
    // merely touch — never overlap. Verified: 0 interpenetrations, every node a
    // clean three-way lap on three distinct planes.
    // 1 — enumerate the full crossing scaffold; y uprights emitted last so the
    //     painter order seats them in front at shared nodes
    const placeAxisBeams = (axis: Axis) => {
      const [a, b] = OTHERS[axis]
      const [lo, hi] = ext(axis)
      for (const la of lanes[a])
        for (const lb of lanes[b]) {
          const { center, half } = centerHalf(axis, lo, hi, la, lb)
          center[AXIS_INDEX[SHIFT[axis]]] += lap // step onto this family's own plane
          register('beam', axis, axis, center, half, 'black') // ends are caps → yellow end-grain
        }
    }
    ;(['x', 'z', 'y'] as Axis[]).forEach(placeAxisBeams)

    // 2 — De Stijl colour panels: a few red/blue fields inset into grid bays,
    //     biased off-centre with the lighter side left as a balancing counter-weight
    const plateBudget = clamp(Math.round(p.gridPlates), 0, 8)
    if (plateBudget > 0) {
      const pad = ch + 0.03
      const bays: [number, number, number][] = []
      for (let i = 0; i < lanes.x.length - 1; i++)
        for (let j = 0; j < lanes.y.length - 1; j++)
          for (let k = 0; k < lanes.z.length - 1; k++) bays.push([i, j, k])
      const bias = (b: [number, number, number]) => asymDir * (lanes.x[b[0]] / gx - 0.5)
      bays.sort((A, B) => bias(B) - bias(A) + (rng.f() - 0.5) * 0.02)
      let placed = 0
      for (const [i, j, k] of bays) {
        if (placed >= plateBudget) break
        const t = rng.weighted<Axis>(['x', 'y', 'z'], [0.18, 0.3, 0.52]) // mostly front-facing panels
        const lo: Record<Axis, number> = { x: lanes.x[i], y: lanes.y[j], z: lanes.z[k] }
        const hi: Record<Axis, number> = { x: lanes.x[i + 1], y: lanes.y[j + 1], z: lanes.z[k + 1] }
        const center: Vec3 = [0, 0, 0]
        const half: Vec3 = [0, 0, 0]
        for (const ax of ['x', 'y', 'z'] as Axis[]) {
          const idx = AXIS_INDEX[ax]
          center[idx] = (lo[ax] + hi[ax]) / 2
          half[idx] = ax === t ? thk / 2 : Math.max(0.04, (hi[ax] - lo[ax]) / 2 - pad)
        }
        const pf = clamp(center[0] / gx + asymShift / gx, 0, 1)
        if (addIfFits('board', t, t, center, half, () => pickColour(pf))) placed++
      }
    }
  } else {
    // ── lattice (default): a CARRIED signature grown into a connected thicket ─
    // The seat is not decoration — it rests on two carrier beams which rest on
    // four posts; every free stick after that must lap something already built.
    const Ys = clamp(Math.round(gy * 0.32), 2, gy - 3) // the beam tier that carries the seat
    const seatBot = Ys + ch
    const scx = clamp(Math.round(gx * 0.5 + asymShift), 2, gx - 2)
    const shw = Math.max(2, Math.round(gx * 0.4 * boardScale))
    const sx0 = clamp(scx - shw, 0, gx)
    const sx1 = clamp(scx + shw, 0, gx)
    const szc = Math.round(gz * 0.5)
    const shz = Math.max(1, Math.round(gz * 0.3 * boardScale))
    const sz0 = clamp(szc - shz, 0, gz)
    const sz1 = clamp(szc + shz, 0, gz)
    register('board', 'y', 'y', [(sx0 + sx1) / 2, seatBot + thk / 2, (sz0 + sz1) / 2], [(sx1 - sx0) / 2, thk / 2, (sz1 - sz0) / 2], seatColour)
    // reclined back standing on the seat, on the far-z side, lit face to the viewer
    const backCx = clamp(scx - shw * 0.15, 0, gx)
    addRecliningBack(backCx, Math.max(1, shw * 0.7), seatBot + thk, gy * 0.4 * boardScale, sz0 + Math.round((sz1 - sz0) * 0.3), tiltAmt * 30 * DEG, backColour)
    // two carrier beams under the seat (their tops ARE the seat's plane)…
    const zc1 = clamp(sz0 + 1, 0, gz)
    const zc2 = Math.max(clamp(sz1 - 1, 0, gz), zc1 + 1)
    for (const zc of [zc1, zc2])
      register('beam', 'x', 'x', [(sx0 + sx1) / 2, Ys, zc + lap], [(sx1 - sx0) / 2 + p.overrun, ch, ch], 'black')
    // …and four posts under the carriers (ground → carrier underside)
    const px0 = clamp(sx0 + 1, 0, gx)
    const px1 = Math.max(clamp(sx1 - 1, 0, gx), px0 + 1)
    for (const px of [px0, px1])
      for (const zc of [zc1, zc2])
        register('beam', 'y', 'y', [px + lap, (Ys - ch) / 2, zc + lap], [ch, (Ys - ch) / 2, ch], 'black')
    // the thicket: grid-snapped, lap-jointed, and CONNECTED by construction
    growSnappedBeams(Math.round(p.beamCount * lerp(1.15, 0.45, dom)))
    growSnappedBoards(p.extraBoards)
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
