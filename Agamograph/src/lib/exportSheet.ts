/**
 * Print-ready export (spec §3). Renders the flat sheet to an offscreen canvas at
 * full DPI by reusing the SAME `drawFlatSheet` as the on-screen preview — so what
 * the artist saw is exactly what prints — then emits PNG / JPG / PDF.
 *
 * The full-resolution original images are used here (not the downscaled 3D
 * textures), so strips are crisp at 300 DPI.
 */

import {
  buildFilenameBase,
  computeDimensions,
  computeSheetWithMargins,
  toInches,
  type GeometryParams,
  type Unit,
} from './geometry'
import {
  drawFlatSheet,
  type DrawSource,
  type DividerOpts,
  type MarginOpts,
} from './render2d'

export type ExportFormat = 'png' | 'jpg' | 'pdf'

/** Render the flat sheet (incl. any margins/dividers) to an offscreen canvas at `dpi`. */
export function renderSheetCanvas(
  params: GeometryParams,
  unit: Unit,
  dpi: number,
  A: DrawSource,
  B: DrawSource,
  margins: MarginOpts,
  dividers: DividerOpts,
): HTMLCanvasElement {
  const dims = computeDimensions(params)
  const sheet = computeSheetWithMargins(dims, margins)
  const pxWidth = Math.round(toInches(sheet.totalWidth, unit) * dpi)
  const pxHeight = Math.round(toInches(sheet.totalHeight, unit) * dpi)
  const marginPx = Math.round(toInches(sheet.marginCm, unit) * dpi)

  const canvas = document.createElement('canvas')
  canvas.width = pxWidth
  canvas.height = pxHeight
  const ctx = canvas.getContext('2d')!
  // White base in case of any sub-pixel edge (matters for JPG, which has no alpha).
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, pxWidth, pxHeight)
  drawFlatSheet(ctx, pxWidth, pxHeight, params, A, B, {
    showGuides: false,
    contentRect: { x: marginPx, y: 0, w: pxWidth - 2 * marginPx, h: pxHeight },
    margins,
    dividers,
  })
  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement, format: 'png' | 'jpg'): Promise<Blob> {
  const type = format === 'png' ? 'image/png' : 'image/jpeg'
  const quality = format === 'png' ? undefined : 0.95
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode image'))),
      type,
      quality,
    )
  })
}

/** Download a Blob as `filename` (shared by the sheet export + the 3D snapshot). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Clean a user-typed filename: drop any extension + illegal path chars. */
function sanitizeFilename(name: string | undefined): string {
  if (!name) return ''
  return name
    .trim()
    .replace(/\.(png|jpe?g|pdf)$/i, '')
    .replace(/[/\\:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

export type ExportOpts = {
  params: GeometryParams
  unit: Unit
  dpi: number
  format: ExportFormat
  A: DrawSource
  B: DrawSource
  margins: MarginOpts
  dividers: DividerOpts
  /** Optional user-chosen base name (no extension); falls back to the auto name. */
  filenameBase?: string
}

/** Render + download in the chosen format. Filename encodes the settings. */
export async function exportAgamograph(opts: ExportOpts): Promise<void> {
  const { params, unit, dpi, format, A, B, margins, dividers, filenameBase } = opts
  const canvas = renderSheetCanvas(params, unit, dpi, A, B, margins, dividers)
  const base =
    sanitizeFilename(filenameBase) ||
    buildFilenameBase({
      width: params.width,
      height: params.height,
      unit,
      slices: params.slices,
      apexAngleDeg: params.apexAngleDeg,
    })
  const filename = `${base}.${format}`

  if (format === 'pdf') {
    // Lazy-load jsPDF so it stays out of the main bundle until needed.
    const { jsPDF } = await import('jspdf')
    const dims = computeDimensions(params)
    const sheet = computeSheetWithMargins(dims, margins)
    const toMm = unit === 'cm' ? 10 : 25.4
    const wMm = sheet.totalWidth * toMm
    const hMm = sheet.totalHeight * toMm
    const pdf = new jsPDF({
      orientation: wMm >= hMm ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [wMm, hMm],
    })
    // Use the real page size so the image fills it at exact physical scale.
    const pw = pdf.internal.pageSize.getWidth()
    const ph = pdf.internal.pageSize.getHeight()
    const imgData = canvas.toDataURL('image/jpeg', 0.95)
    pdf.addImage(imgData, 'JPEG', 0, 0, pw, ph)
    pdf.save(filename)
    return
  }

  const blob = await canvasToBlob(canvas, format)
  downloadBlob(blob, filename)
}
