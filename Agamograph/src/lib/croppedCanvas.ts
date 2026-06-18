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

/**
 * Bake the printed fold-line dividers into a 3D source texture so the folded
 * preview matches the print. Lines sit at the internal strip-band boundaries
 * (u = k/N), which are exactly the fold creases between faces. Width is mapped
 * from mm via the perceived image width (one band = one strip = `s` cm wide).
 *
 * Auto ("unseen") dividers borrow each neighbour's edge colour — in 3D the
 * neighbour pixels are already there, so the line is invisible; we skip drawing.
 * Must be called BEFORE the CanvasTexture is created from this canvas.
 */
export function drawCanvasDividers(
  canvas: HTMLCanvasElement,
  slices: number,
  perceivedImageWidth: number,
  dividers: { enabled: boolean; widthMm: number; color: string; auto: boolean },
): void {
  if (!dividers.enabled || dividers.auto || perceivedImageWidth <= 0) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const cw = canvas.width
  const ch = canvas.height
  const pxPerCm = cw / perceivedImageWidth
  const lineW = Math.max(1, (dividers.widthMm / 10) * pxPerCm)
  ctx.fillStyle = dividers.color
  for (let k = 1; k < slices; k++) {
    const x = (k / slices) * cw
    ctx.fillRect(x - lineW / 2, 0, lineW, ch)
  }
}
