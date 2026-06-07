/**
 * Pure crop math — no DOM, no React. Shared by the crop UI now and by the
 * slicer / export pipeline later, so the on-screen crop and the printed output
 * always agree.
 *
 * A `CropTransform` describes how a source image is fitted into a frame whose
 * aspect ratio is `frameAspect = frameWidth / frameHeight`:
 *   - scale   : zoom relative to "cover". 1 = the image exactly covers the frame
 *               (centered). >1 zooms in (samples a smaller region).
 *   - offsetX : horizontal pan, -1..1. 0 = centered, -1 = hard left, +1 = hard right.
 *   - offsetY : vertical pan, -1..1.
 *
 * The transform is resolution-independent: it never references pixels, so the
 * same crop renders identically in a tiny preview and a 300-DPI export.
 */

export type CropTransform = {
  offsetX: number
  offsetY: number
  scale: number
}

export const DEFAULT_CROP: CropTransform = { offsetX: 0, offsetY: 0, scale: 1 }

export const MIN_ZOOM = 1
export const MAX_ZOOM = 5

/** A rectangle of the SOURCE image (in source pixels) that maps onto the frame. */
export type SourceRect = { sx: number; sy: number; sw: number; sh: number }

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/**
 * The largest centered rectangle of aspect `frameAspect` that fits inside the
 * source image — i.e. the source region shown when the image "covers" the frame
 * at scale 1, centered. This is the auto-fit default (PRD §5.1).
 */
export function coverRect(
  natW: number,
  natH: number,
  frameAspect: number,
): SourceRect {
  const imgAspect = natW / natH
  let sw: number
  let sh: number
  if (imgAspect > frameAspect) {
    // Source is wider than the frame → full height, crop the sides.
    sh = natH
    sw = natH * frameAspect
  } else {
    // Source is taller → full width, crop top/bottom.
    sw = natW
    sh = natW / frameAspect
  }
  return { sx: (natW - sw) / 2, sy: (natH - sh) / 2, sw, sh }
}

/**
 * The source rectangle currently visible in the frame, given a crop transform.
 * This is the single definition of "what the user sees / what we print".
 */
export function computeSourceRect(
  natW: number,
  natH: number,
  frameAspect: number,
  crop: CropTransform,
): SourceRect {
  const base = coverRect(natW, natH, frameAspect)
  const scale = clamp(crop.scale, MIN_ZOOM, MAX_ZOOM)
  const sw = base.sw / scale
  const sh = base.sh / scale
  const ox = clamp(crop.offsetX, -1, 1)
  const oy = clamp(crop.offsetY, -1, 1)
  // offset = 0 → centered; ±1 → flush against the corresponding edge.
  const sx = ((natW - sw) / 2) * (1 + ox)
  const sy = ((natH - sh) / 2) * (1 + oy)
  return { sx, sy, sw, sh }
}

/**
 * Translate a crop into CSS `background-size` / `background-position` values for
 * a frame element. Resolution-independent (percentages), so it's GPU-smooth and
 * never needs to measure the element. Aspect is preserved because the source
 * rect always matches the frame aspect.
 */
export function cropToBackground(
  natW: number,
  natH: number,
  frameAspect: number,
  crop: CropTransform,
): { backgroundSize: string; backgroundPosition: string } {
  const { sx, sy, sw, sh } = computeSourceRect(natW, natH, frameAspect, crop)
  const sizeX = (natW / sw) * 100
  const sizeY = (natH / sh) * 100
  const posX = natW - sw <= 0 ? 50 : (sx / (natW - sw)) * 100
  const posY = natH - sh <= 0 ? 50 : (sy / (natH - sh)) * 100
  return {
    backgroundSize: `${sizeX}% ${sizeY}%`,
    backgroundPosition: `${posX}% ${posY}%`,
  }
}
