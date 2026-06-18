import { describe, it, expect } from 'vitest'
import {
  computeDimensions,
  buildStripLayout,
  buildFaces,
  computePixelSheet,
  computeSheetWithMargins,
  buildFilename,
  buildFilenameBase,
  toInches,
  A_FIRST,
  type GeometryParams,
} from './geometry'

const SQRT2 = Math.SQRT2 // 1.41421356…

const base: GeometryParams = {
  slices: 24,
  apexAngleDeg: 90,
  width: 40,
  height: 30,
}

const approx = (a: number, b: number, eps = 1e-9) =>
  expect(Math.abs(a - b)).toBeLessThan(eps)

describe('computeDimensions (spec §2.3)', () => {
  it('θ=90° → flat sheet width ≈ 1.414 × mounted width (checklist #1)', () => {
    const d = computeDimensions(base)
    approx(d.flatSheetWidth, SQRT2 * base.width, 1e-6)
  })

  it('s solves the mounted-width equation W = 2·N·s·sin(θ/2)', () => {
    const d = computeDimensions(base)
    const half = (base.apexAngleDeg * Math.PI) / 360
    approx(2 * base.slices * d.s * Math.sin(half), base.width)
  })

  it('identities hold: flatSheetWidth = 2N·s, perceivedImageWidth = N·s', () => {
    const d = computeDimensions(base)
    approx(d.flatSheetWidth, 2 * base.slices * d.s)
    approx(d.perceivedImageWidth, base.slices * d.s)
    approx(d.flatSheetWidth, base.width / Math.sin(Math.PI / 4), 1e-6)
  })

  it('projected face widths sum to W: 2N·p = W', () => {
    const d = computeDimensions(base)
    approx(2 * base.slices * d.projectedFaceWidth, base.width, 1e-9)
  })

  it('foldDepth = s·cos(θ/2) and equals faceDepth', () => {
    const d = computeDimensions(base)
    approx(d.foldDepth, d.s * Math.cos(Math.PI / 4))
    approx(d.foldDepth, d.faceDepth)
  })

  it('sheetHeight = H, phi = 90 − θ/2', () => {
    const d = computeDimensions(base)
    expect(d.sheetHeight).toBe(base.height)
    expect(d.phiDeg).toBe(45)
  })

  it('holds across θ and N (checklist #5: changing N keeps W consistent)', () => {
    for (const slices of [4, 12, 24, 60]) {
      for (const apexAngleDeg of [60, 90, 120]) {
        const p = { ...base, slices, apexAngleDeg }
        const d = computeDimensions(p)
        const half = (apexAngleDeg * Math.PI) / 360
        approx(2 * slices * d.s * Math.sin(half), p.width, 1e-9)
        approx(2 * slices * d.projectedFaceWidth, p.width, 1e-9)
      }
    }
  })
})

describe('buildStripLayout (spec §2.4)', () => {
  it('produces exactly 2N strips, positions 0..2N-1 unique (checklist #2)', () => {
    const strips = buildStripLayout(base.slices)
    expect(strips).toHaveLength(2 * base.slices)
    expect(strips.map((s) => s.position)).toEqual(
      Array.from({ length: 2 * base.slices }, (_, i) => i),
    )
  })

  it('interleaves A,B,A,B… honouring A_FIRST', () => {
    const strips = buildStripLayout(base.slices)
    for (const s of strips) {
      const expected = (s.position % 2 === 0) === A_FIRST ? 'A' : 'B'
      expect(s.source).toBe(expected)
    }
  })

  it('2N strips of width s exactly fill the flat sheet, no gap/overlap (#2)', () => {
    const d = computeDimensions(base)
    const total = 2 * base.slices * d.s
    approx(total, d.flatSheetWidth)
  })

  it('A strips reconstruct image A with no gaps; same for B (checklist #3)', () => {
    const strips = buildStripLayout(base.slices)
    for (const src of ['A', 'B'] as const) {
      const bands = strips
        .filter((s) => s.source === src)
        .sort((a, b) => a.stripIndex - b.stripIndex)
        .map((s) => [s.u0, s.u1] as const)
      expect(bands).toHaveLength(base.slices)
      // contiguous cover of [0,1]
      expect(bands[0][0]).toBeCloseTo(0, 12)
      expect(bands[bands.length - 1][1]).toBeCloseTo(1, 12)
      for (let i = 1; i < bands.length; i++) {
        expect(bands[i][0]).toBeCloseTo(bands[i - 1][1], 12)
      }
    }
  })
})

describe('buildFaces (spec §2.5)', () => {
  it('produces 2N quads (≤120 at N=60)', () => {
    expect(buildFaces(base)).toHaveLength(2 * base.slices)
    expect(buildFaces({ ...base, slices: 60 }).length).toBeLessThanOrEqual(120)
  })

  it('A-faces point left (−X), B-faces point right (+X)', () => {
    for (const f of buildFaces(base)) {
      if (f.source === 'A') expect(f.normal[0]).toBeLessThan(0)
      else expect(f.normal[0]).toBeGreaterThan(0)
    }
  })

  it('ridge/valley alternate: z = 0 at valleys, z = d at ridges', () => {
    const d = computeDimensions(base)
    const faces = buildFaces(base)
    for (const f of faces) {
      const j = f.index
      const zL = f.corners[0][2]
      const zR = f.corners[1][2]
      approx(zL, j % 2 === 1 ? d.faceDepth : 0)
      approx(zR, (j + 1) % 2 === 1 ? d.faceDepth : 0)
    }
  })

  it('total projected X span equals W (max x = 2N·p = W)', () => {
    const faces = buildFaces(base)
    const maxX = Math.max(...faces.flatMap((f) => f.corners.map((c) => c[0])))
    approx(maxX, base.width, 1e-9)
  })

  it('every face spans full height H in Y', () => {
    const faces = buildFaces(base)
    for (const f of faces) {
      const ys = f.corners.map((c) => c[1])
      expect(Math.min(...ys)).toBe(0)
      expect(Math.max(...ys)).toBe(base.height)
    }
  })

  it('UVs map each face to its source band [k/N,(k+1)/N]', () => {
    const N = base.slices
    for (const f of buildFaces(base)) {
      const us = f.uvs.map((uv) => uv[0])
      approx(Math.min(...us), f.stripIndex / N, 1e-12)
      approx(Math.max(...us), (f.stripIndex + 1) / N, 1e-12)
    }
  })

  it('strip layout and faces agree on source/stripIndex per index', () => {
    const strips = buildStripLayout(base.slices)
    const faces = buildFaces(base)
    for (let j = 0; j < faces.length; j++) {
      expect(faces[j].source).toBe(strips[j].source)
      expect(faces[j].stripIndex).toBe(strips[j].stripIndex)
    }
  })
})

describe('export pipeline (spec §3)', () => {
  it('cm → inches conversion', () => {
    approx(toInches(2.54, 'cm'), 1)
    approx(toInches(5, 'in'), 5)
  })

  it('pixel sheet at 300 DPI rounds correctly; strip px = pxWidth/2N', () => {
    const d = computeDimensions(base)
    const sheet = computePixelSheet(d, 'cm', 300, base.slices)
    expect(sheet.pxWidth).toBe(Math.round((d.flatSheetWidth / 2.54) * 300))
    expect(sheet.pxHeight).toBe(Math.round((base.height / 2.54) * 300))
    approx(sheet.stripPxWidth, sheet.pxWidth / (2 * base.slices))
  })

  it('exported px width ≈ 1.414 × mounted px width at θ=90° (checklist #1, #7)', () => {
    const d = computeDimensions(base)
    const sheet = computePixelSheet(d, 'cm', 300, base.slices)
    const mountedPx = (base.width / 2.54) * 300
    expect(sheet.pxWidth / mountedPx).toBeCloseTo(SQRT2, 2)
  })

  it('filename encodes settings (checklist #7)', () => {
    expect(
      buildFilename({
        width: 40,
        height: 30,
        unit: 'cm',
        slices: 24,
        apexAngleDeg: 90,
        ext: 'png',
      }),
    ).toBe('agamograph_40x30cm_24slices_90deg.png')

    expect(
      buildFilename({
        width: 15.5,
        height: 10,
        unit: 'in',
        slices: 40,
        apexAngleDeg: 75,
        ext: 'pdf',
      }),
    ).toBe('agamograph_15.5x10in_40slices_75deg.pdf')
  })

  it('buildFilenameBase = buildFilename without the extension', () => {
    const opts = {
      width: 40,
      height: 30,
      unit: 'cm' as const,
      slices: 24,
      apexAngleDeg: 90,
    }
    expect(buildFilenameBase(opts)).toBe('agamograph_40x30cm_24slices_90deg')
    expect(buildFilename({ ...opts, ext: 'jpg' })).toBe(`${buildFilenameBase(opts)}.jpg`)
  })
})

describe('computeSheetWithMargins (left/right white bands; spec packaging)', () => {
  it('disabled → unchanged: total width = flat sheet, height = H, margin 0', () => {
    const d = computeDimensions(base)
    const s = computeSheetWithMargins(d, { enabled: false, widthCm: 5 })
    approx(s.totalWidth, d.flatSheetWidth)
    approx(s.totalHeight, d.sheetHeight)
    expect(s.marginCm).toBe(0)
  })

  it('enabled → adds margin on BOTH left & right; height stays = H', () => {
    const d = computeDimensions(base)
    const s = computeSheetWithMargins(d, { enabled: true, widthCm: 2 })
    approx(s.totalWidth, d.flatSheetWidth + 2 * 2) // one margin each side
    approx(s.totalHeight, d.sheetHeight) // no top/bottom margin
    expect(s.marginCm).toBe(2)
  })
})
