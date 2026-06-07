/**
 * Agamograph geometry — the heart of the app.
 *
 * Pure functions, no DOM / no Three.js. Implements every formula from
 * `agamograph-technical-spec.md` §2–§3 EXACTLY. The on-screen previews, the 3D
 * mesh, and the print export all derive from this one module so they cannot drift.
 *
 * Conventions: all angles are passed in DEGREES (as the UI sliders provide) and
 * converted to radians internally. All lengths are in the caller's real-world
 * unit (cm or in) unless a function name says pixels.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Unit = 'cm' | 'in'

export type GeometryParams = {
  /** N — slices per image (spec range 4–60). */
  slices: number
  /** θ — fold apex/ridge angle in degrees (spec ~60–120, default 90). */
  apexAngleDeg: number
  /** W — finished mounted width, in `unit`. */
  width: number
  /** H — finished height (= strip height), in `unit`. */
  height: number
}

export type Dimensions = {
  /** s — slant width of one printed strip (true width on the flat sheet). */
  s: number
  /** Width you actually PRINT: 2·N·s = W / sin(θ/2). */
  flatSheetWidth: number
  /** How far the folded piece sticks off the wall: s·cos(θ/2). */
  foldDepth: number
  /** Strips are full height. */
  sheetHeight: number
  /** Width each image appears to have from its side: N·s = W / (2·sin(θ/2)). */
  perceivedImageWidth: number
  /** p — projected width of one face along X: s·sin(θ/2). (2N·p = W) */
  projectedFaceWidth: number
  /** d — depth of one face along Z: s·cos(θ/2). (= foldDepth) */
  faceDepth: number
  /** φ — half-deviation of each face from the wall plane: 90 − θ/2 (degrees). */
  phiDeg: number
}

export type Source = 'A' | 'B'

/** One printed strip on the flat sheet (also used by the 2D previews). */
export type Strip = {
  /** Left-to-right position on the flat sheet, 0..2N-1. */
  position: number
  source: Source
  /** k — index of this strip within its own image, 0..N-1. */
  stripIndex: number
  /** Horizontal sample band of the cropped source image, fractions in [0,1]. */
  u0: number
  u1: number
}

export type Vec3 = [number, number, number]
export type Vec2 = [number, number]

/** One quad of the 3D zigzag. Corners/uvs are ordered bl, br, tr, tl. */
export type Face = {
  /** j — face index along the ridge, 0..2N-1. */
  index: number
  source: Source
  /** k — strip index within its image, 0..N-1. */
  stripIndex: number
  /** Quad corners: bottom-left, bottom-right, top-right, top-left. */
  corners: [Vec3, Vec3, Vec3, Vec3]
  /** UVs matching `corners`. */
  uvs: [Vec2, Vec2, Vec2, Vec2]
  /** Outward (viewer-facing) surface normal. A-faces point -X, B-faces +X. */
  normal: Vec3
}

export type PixelSheet = {
  pxWidth: number
  pxHeight: number
  /** Width of one printed strip in px = pxWidth / (2N). May be fractional. */
  stripPxWidth: number
}

// ---------------------------------------------------------------------------
// Parity / flip constants (single source — see spec §2.4 & §2.5)
// ---------------------------------------------------------------------------

/**
 * Which image occupies the FIRST strip/face (position 0). The A/B starting
 * parity may need to swap depending on physical fold direction — flip this ONE
 * constant if the test fold comes out mirrored. Drives both the flat strip
 * layout (§2.4) and the 3D faces (§2.5) so they always agree.
 */
export const A_FIRST = true

/**
 * Reverse the horizontal sample direction within each image, in case the
 * reconstructed image reads mirrored. Off by default (straight per spec).
 */
export const FLIP_U = false

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toRad = (deg: number): number => (deg * Math.PI) / 180

/** cm → inches; inches pass through. (spec §3: inches = cm / 2.54) */
export function toInches(value: number, unit: Unit): number {
  return unit === 'cm' ? value / 2.54 : value
}

/** Is the strip/face at this even/odd index image A? (honours A_FIRST) */
function isSourceA(index: number): boolean {
  return (index % 2 === 0) === A_FIRST
}

/** Sample band [u0,u1] for strip k of N, honouring FLIP_U. */
function sampleBand(k: number, n: number): { u0: number; u1: number } {
  if (FLIP_U) return { u0: (n - k) / n, u1: (n - k - 1) / n }
  return { u0: k / n, u1: (k + 1) / n }
}

// ---------------------------------------------------------------------------
// Core dimensions (spec §2.3)
// ---------------------------------------------------------------------------

export function computeDimensions(p: GeometryParams): Dimensions {
  const { slices: N, apexAngleDeg: theta, width: W, height: H } = p
  const half = toRad(theta) / 2
  const sinH = Math.sin(half)
  const cosH = Math.cos(half)

  const s = W / (2 * N * sinH)

  return {
    s,
    flatSheetWidth: 2 * N * s, // === W / sinH
    foldDepth: s * cosH,
    sheetHeight: H,
    perceivedImageWidth: N * s, // === W / (2 * sinH)
    projectedFaceWidth: s * sinH, // p ; 2N·p === W
    faceDepth: s * cosH, // d
    phiDeg: 90 - theta / 2,
  }
}

// ---------------------------------------------------------------------------
// Flat strip layout (spec §2.4) — used by flat print preview + export
// ---------------------------------------------------------------------------

/**
 * The 2N strips of the flat sheet, left-to-right, interleaved A,B,A,B…
 * Each carries the source-image sample band it should draw.
 */
export function buildStripLayout(slices: number): Strip[] {
  const N = slices
  const strips: Strip[] = []
  for (let position = 0; position < 2 * N; position++) {
    const source: Source = isSourceA(position) ? 'A' : 'B'
    const stripIndex = Math.floor(position / 2)
    const { u0, u1 } = sampleBand(stripIndex, N)
    strips.push({ position, source, stripIndex, u0, u1 })
  }
  return strips
}

// ---------------------------------------------------------------------------
// 3D zigzag faces (spec §2.5)
// ---------------------------------------------------------------------------

/**
 * The 2N quads of the zigzag, in world units. Top-down it's a triangle wave in
 * X–Z, extruded along Y to height H. Valleys sit on the wall (z=0), ridges out
 * at z=d. Each face is given the texture sample (via UVs) for its image, with
 * NO bitmap cutting (spec §2.5 "Texturing").
 */
export function buildFaces(p: GeometryParams): Face[] {
  const { slices: N, height: H } = p
  const dims = computeDimensions(p)
  const pWidth = dims.projectedFaceWidth
  const d = dims.faceDepth

  const xAt = (j: number) => j * pWidth
  const zAt = (j: number) => (j % 2 === 1 ? d : 0)

  const faces: Face[] = []
  for (let j = 0; j < 2 * N; j++) {
    const source: Source = isSourceA(j) ? 'A' : 'B'
    const stripIndex = Math.floor(j / 2)
    const { u0, u1 } = sampleBand(stripIndex, N)

    const xL = xAt(j)
    const zL = zAt(j)
    const xR = xAt(j + 1)
    const zR = zAt(j + 1)

    // corners: bottom-left, bottom-right, top-right, top-left
    const corners: [Vec3, Vec3, Vec3, Vec3] = [
      [xL, 0, zL],
      [xR, 0, zR],
      [xR, H, zR],
      [xL, H, zL],
    ]

    // u increases left→right; v=0 bottom, v=1 top
    const uvs: [Vec2, Vec2, Vec2, Vec2] = [
      [u0, 0],
      [u1, 0],
      [u1, 1],
      [u0, 1],
    ]

    // outward normal in XZ (perpendicular to base edge, +Z toward viewer)
    const nx = -(zR - zL)
    const nz = xR - xL
    const len = Math.hypot(nx, nz) || 1
    const normal: Vec3 = [nx / len, 0, nz / len]

    faces.push({ index: j, source, stripIndex, corners, uvs, normal })
  }
  return faces
}

// ---------------------------------------------------------------------------
// Export pixel sheet (spec §3)
// ---------------------------------------------------------------------------

export function computePixelSheet(
  dims: Dimensions,
  unit: Unit,
  dpi: number,
  slices: number,
): PixelSheet {
  const pxWidth = Math.round(toInches(dims.flatSheetWidth, unit) * dpi)
  const pxHeight = Math.round(toInches(dims.sheetHeight, unit) * dpi)
  return { pxWidth, pxHeight, stripPxWidth: pxWidth / (2 * slices) }
}

// ---------------------------------------------------------------------------
// Self-documenting export filename (spec §3)
// ---------------------------------------------------------------------------

const fmt = (n: number): string =>
  Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)))

export function buildFilename(opts: {
  width: number
  height: number
  unit: Unit
  slices: number
  apexAngleDeg: number
  ext: 'png' | 'jpg' | 'pdf'
}): string {
  const { width, height, unit, slices, apexAngleDeg, ext } = opts
  return `agamograph_${fmt(width)}x${fmt(height)}${unit}_${slices}slices_${fmt(
    apexAngleDeg,
  )}deg.${ext}`
}
