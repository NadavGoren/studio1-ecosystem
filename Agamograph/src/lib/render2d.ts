/**
 * Canvas 2D rendering for the flat print sheet and the left/right reconstruction
 * previews (spec §2.4 & §2.6). Pure drawing given a context + sources — the SAME
 * `drawFlatSheet` is reused by the export pipeline (Phase 6) at full DPI, so what
 * you preview is exactly what prints.
 */

import { buildStripLayout, computeDimensions, type Source } from './geometry'
import { computeSourceRect, type CropTransform } from './crop'

type Drawable = HTMLImageElement | HTMLCanvasElement

export type DrawSource = {
  img: Drawable | null
  natW: number
  natH: number
  crop: CropTransform
}

export type SheetParams = {
  slices: number
  apexAngleDeg: number
  width: number
  height: number
}

const MISSING_FILL = '#ececec'
const GUIDE_COLOR = 'rgba(0,0,0,0.12)'

function prep(ctx: CanvasRenderingContext2D) {
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
}

/**
 * Source band [sx..] for one strip, mapped from the cropped frame. Handles the
 * FLIP_U case (u0 may be > u1) by normalising to a positive-width sample rect.
 */
function bandRect(
  src: { sx: number; sy: number; sw: number; sh: number },
  u0: number,
  u1: number,
) {
  const uLo = Math.min(u0, u1)
  const w = Math.abs(u1 - u0) * src.sw
  return { x: src.sx + uLo * src.sw, y: src.sy, w, h: src.sh }
}

/**
 * Draw the flat printed sheet: 2N interleaved A,B,A,B… strips, each sampling its
 * band of the cropped source image. `destW × destH` are the canvas pixel dims
 * (caller sizes them to the flatSheetWidth:H aspect, or to the export px sheet).
 */
export function drawFlatSheet(
  ctx: CanvasRenderingContext2D,
  destW: number,
  destH: number,
  params: SheetParams,
  A: DrawSource,
  B: DrawSource,
  opts: { showGuides?: boolean } = {},
): void {
  const N = params.slices
  const layout = buildStripLayout(N)
  const stripW = destW / (2 * N)
  const frameAspect =
    computeDimensions(params).perceivedImageWidth / params.height

  const srcA = A.img ? computeSourceRect(A.natW, A.natH, frameAspect, A.crop) : null
  const srcB = B.img ? computeSourceRect(B.natW, B.natH, frameAspect, B.crop) : null

  prep(ctx)
  ctx.clearRect(0, 0, destW, destH)

  for (const strip of layout) {
    const isA = strip.source === 'A'
    const img = isA ? A.img : B.img
    const src = isA ? srcA : srcB
    const dx = strip.position * stripW

    if (!img || !src) {
      ctx.fillStyle = MISSING_FILL
      ctx.fillRect(dx, 0, stripW + 1, destH)
      continue
    }
    const b = bandRect(src, strip.u0, strip.u1)
    // +0.5 dest width hides sub-pixel seams between adjacent strips.
    ctx.drawImage(img, b.x, b.y, b.w, b.h, dx, 0, stripW + 0.5, destH)
  }

  if (opts.showGuides) {
    ctx.strokeStyle = GUIDE_COLOR
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 1; i < 2 * N; i++) {
      const x = Math.round(i * stripW) + 0.5
      ctx.moveTo(x, 0)
      ctx.lineTo(x, destH)
    }
    ctx.stroke()
  }
}

/**
 * Reconstruct how one image reads from its side: composite only that image's N
 * strips, in order, tiled with no gaps (spec §2.6). Confirms the slicing is
 * lossless. `destW × destH` should be the perceivedImageWidth:H aspect.
 * Returns false if the source image isn't loaded.
 */
export function drawReconstruction(
  ctx: CanvasRenderingContext2D,
  destW: number,
  destH: number,
  params: SheetParams,
  source: Source,
  src: DrawSource,
): boolean {
  const N = params.slices
  prep(ctx)
  ctx.clearRect(0, 0, destW, destH)
  if (!src.img) return false

  const frameAspect =
    computeDimensions(params).perceivedImageWidth / params.height
  const rect = computeSourceRect(src.natW, src.natH, frameAspect, src.crop)
  const stripW = destW / N

  const strips = buildStripLayout(N)
    .filter((s) => s.source === source)
    .sort((a, b) => a.stripIndex - b.stripIndex)

  strips.forEach((strip, i) => {
    const b = bandRect(rect, strip.u0, strip.u1)
    ctx.drawImage(src.img as Drawable, b.x, b.y, b.w, b.h, i * stripW, 0, stripW + 0.5, destH)
  })
  return true
}
