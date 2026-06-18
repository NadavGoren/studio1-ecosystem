/**
 * Canvas 2D rendering for the flat print sheet and the left/right reconstruction
 * previews (spec §2.4 & §2.6). Pure drawing given a context + sources — the SAME
 * `drawFlatSheet` is reused by the export pipeline (Phase 6) at full DPI, so what
 * you preview is exactly what prints.
 */

import { buildStripLayout, computeDimensions, type Source, type Strip } from './geometry'
import { computeSourceRect, type CropTransform } from './crop'

type Drawable = HTMLImageElement | HTMLCanvasElement
type SrcRect = ReturnType<typeof computeSourceRect>

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

/** Sub-rectangle of the canvas the strips are drawn into (margins live outside it). */
export type Rect = { x: number; y: number; w: number; h: number }
/** Mirrors the store's MarginSettings (kept local so this lib stays store-free). */
export type MarginOpts = { enabled: boolean; widthCm: number }
/** Mirrors the store's DividerSettings. */
export type DividerOpts = {
  enabled: boolean
  widthMm: number
  color: string
  auto: boolean
}

const MISSING_FILL = '#ececec'
const GUIDE_COLOR = 'rgba(0,0,0,0.12)'
/** "Slight gray" trim line drawn at the margin/content boundary for cutting. */
const CUT_GUIDE_COLOR = 'rgba(0,0,0,0.30)'

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
 * Sample a thin source column at one EDGE of a strip and stretch it across a
 * half-divider band — the trick behind the "auto / unseen" divider: each half of
 * the fold line borrows its own neighbour's edge pixels, so the line disappears
 * into the image whether viewed from the left or the right. Per-row faithful
 * because drawImage stretches the column over the full content height.
 */
function drawAutoHalf(
  ctx: CanvasRenderingContext2D,
  strip: Strip,
  srcA: SrcRect | null,
  srcB: SrcRect | null,
  A: DrawSource,
  B: DrawSource,
  edge: 'left' | 'right',
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const isA = strip.source === 'A'
  const img = isA ? A.img : B.img
  const src = isA ? srcA : srcB
  if (!img || !src || dw <= 0) return
  const b = bandRect(src, strip.u0, strip.u1)
  const col = Math.max(1, Math.min(2, b.w)) // thin edge column
  // dest-left edge ↔ source min-x, dest-right edge ↔ source max-x (bandRect is
  // already normalised to positive width, so this holds for either FLIP_U state).
  const sx = edge === 'right' ? b.x + b.w - col : b.x
  ctx.drawImage(img, sx, b.y, col, b.h, dx, dy, dw, dh)
}

/**
 * Draw the flat printed sheet: 2N interleaved A,B,A,B… strips, each sampling its
 * band of the cropped source image. `destW × destH` are the canvas pixel dims
 * (caller sizes them to the total-sheet aspect, or to the export px sheet).
 *
 * `opts.contentRect` confines the strips to a sub-rectangle so the caller can
 * reserve white margin bands around them (defaults to the full canvas — existing
 * behaviour). `opts.dividers` prints fold lines between strips; `opts.margins`
 * adds light-gray cut guides on the right + top + bottom edges.
 */
export function drawFlatSheet(
  ctx: CanvasRenderingContext2D,
  destW: number,
  destH: number,
  params: SheetParams,
  A: DrawSource,
  B: DrawSource,
  opts: {
    showGuides?: boolean
    contentRect?: Rect
    margins?: MarginOpts
    dividers?: DividerOpts
  } = {},
): void {
  const N = params.slices
  const layout = buildStripLayout(N)
  const content = opts.contentRect ?? { x: 0, y: 0, w: destW, h: destH }
  const stripW = content.w / (2 * N)
  const dims = computeDimensions(params)
  const frameAspect = dims.perceivedImageWidth / params.height

  const srcA = A.img ? computeSourceRect(A.natW, A.natH, frameAspect, A.crop) : null
  const srcB = B.img ? computeSourceRect(B.natW, B.natH, frameAspect, B.crop) : null

  prep(ctx)
  ctx.clearRect(0, 0, destW, destH)
  // When the content is inset (margins on), paint the whole sheet white so the
  // margin bands read white rather than the transparent/container colour.
  const inset =
    content.x > 0 || content.y > 0 || content.w < destW || content.h < destH
  if (inset) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, destW, destH)
  }

  for (const strip of layout) {
    const isA = strip.source === 'A'
    const img = isA ? A.img : B.img
    const src = isA ? srcA : srcB
    const dx = content.x + strip.position * stripW

    if (!img || !src) {
      ctx.fillStyle = MISSING_FILL
      ctx.fillRect(dx, content.y, stripW + 1, content.h)
      continue
    }
    const b = bandRect(src, strip.u0, strip.u1)
    // +0.5 dest width hides sub-pixel seams between adjacent strips.
    ctx.drawImage(img, b.x, b.y, b.w, b.h, dx, content.y, stripW + 0.5, content.h)
  }

  // Dividers (printed fold lines, on top of the art) take priority over the faint
  // preview guides; when off, the existing guides behave exactly as before.
  const dividers = opts.dividers
  if (dividers?.enabled) {
    const pxPerCm = content.w / dims.flatSheetWidth
    const dividerPx = Math.max(0.75, (dividers.widthMm / 10) * pxPerCm)
    const half = dividerPx / 2
    for (let i = 1; i < 2 * N; i++) {
      const x = content.x + i * stripW
      if (dividers.auto) {
        drawAutoHalf(ctx, layout[i - 1], srcA, srcB, A, B, 'right', x - half, content.y, half, content.h)
        drawAutoHalf(ctx, layout[i], srcA, srcB, A, B, 'left', x, content.y, half, content.h)
      } else {
        ctx.fillStyle = dividers.color
        ctx.fillRect(x - half, content.y, dividerPx, content.h)
      }
    }
  } else if (opts.showGuides) {
    ctx.strokeStyle = GUIDE_COLOR
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 1; i < 2 * N; i++) {
      const x = Math.round(content.x + i * stripW) + 0.5
      ctx.moveTo(x, content.y)
      ctx.lineTo(x, content.y + content.h)
    }
    ctx.stroke()
  }

  // Cut guides for trimming: thin gray on the right edge (full content height) +
  // top & bottom (full sheet width, for a straight cut across). No left guide.
  if (opts.margins?.enabled) {
    const guidePx = Math.max(1, (content.w / dims.flatSheetWidth) * 0.03) // ~0.3mm
    ctx.fillStyle = CUT_GUIDE_COLOR
    const right = content.x + content.w
    ctx.fillRect(right - guidePx, content.y, guidePx, content.h)
    ctx.fillRect(0, content.y, destW, guidePx)
    ctx.fillRect(0, content.y + content.h - guidePx, destW, guidePx)
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
