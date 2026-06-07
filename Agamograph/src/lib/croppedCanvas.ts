/**
 * Render the cropped region of a source image to an offscreen canvas, to be used
 * as a 3D texture. Reuses the SAME `computeSourceRect` as the 2D previews so the
 * 3D faces show exactly the cropped picture. Downscaled to `maxEdge` for preview
 * performance (spec §6 — the original full-res blob is untouched for export).
 *
 * Output aspect = frameAspect (= perceivedImageWidth : H), so texture UV [0,1]²
 * maps directly to the perceived image.
 */

import { computeSourceRect, type CropTransform } from './crop'

export function makeCroppedCanvas(
  img: CanvasImageSource,
  natW: number,
  natH: number,
  frameAspect: number,
  crop: CropTransform,
  maxEdge = 2048,
): HTMLCanvasElement {
  const { sx, sy, sw, sh } = computeSourceRect(natW, natH, frameAspect, crop)

  let cw = sw
  let ch = sh
  const longest = Math.max(cw, ch)
  if (longest > maxEdge) {
    const k = maxEdge / longest
    cw *= k
    ch *= k
  }
  cw = Math.max(1, Math.round(cw))
  ch = Math.max(1, Math.round(ch))

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch)
  return canvas
}
