/**
 * Print-ready export (spec §3). Renders the flat sheet to an offscreen canvas at
 * full DPI by reusing the SAME `drawFlatSheet` as the on-screen preview — so what
 * the artist saw is exactly what prints — then emits PNG / JPG / PDF.
 *
 * The full-resolution original images are used here (not the downscaled 3D
 * textures), so strips are crisp at 300 DPI.
 */

import {
  buildFilename,
  computeDimensions,
  computePixelSheet,
  type GeometryParams,
  type Unit,
} from './geometry'
import { drawFlatSheet, type DrawSource } from './render2d'

export type ExportFormat = 'png' | 'jpg' | 'pdf'

/** Render the flat sheet to an offscreen canvas at `dpi`. */
export function renderSheetCanvas(
  params: GeometryParams,
  unit: Unit,
  dpi: number,
  A: DrawSource,
  B: DrawSource,
): HTMLCanvasElement {
  const dims = computeDimensions(params)
  const { pxWidth, pxHeight } = computePixelSheet(dims, unit, dpi, params.slices)

  const canvas = document.createElement('canvas')
  canvas.width = pxWidth
  canvas.height = pxHeight
  const ctx = canvas.getContext('2d')!
  // White base in case of any sub-pixel edge (matters for JPG, which has no alpha).
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, pxWidth, pxHeight)
  drawFlatSheet(ctx, pxWidth, pxHeight, params, A, B, { showGuides: false })
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

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export type ExportOpts = {
  params: GeometryParams
  unit: Unit
  dpi: number
  format: ExportFormat
  A: DrawSource
  B: DrawSource
}

/** Render + download in the chosen format. Filename encodes the settings. */
export async function exportAgamograph(opts: ExportOpts): Promise<void> {
  const { params, unit, dpi, format, A, B } = opts
  const canvas = renderSheetCanvas(params, unit, dpi, A, B)
  const filename = buildFilename({
    width: params.width,
    height: params.height,
    unit,
    slices: params.slices,
    apexAngleDeg: params.apexAngleDeg,
    ext: format,
  })

  if (format === 'pdf') {
    // Lazy-load jsPDF so it stays out of the main bundle until needed.
    const { jsPDF } = await import('jspdf')
    const dims = computeDimensions(params)
    const toMm = unit === 'cm' ? 10 : 25.4
    const wMm = dims.flatSheetWidth * toMm
    const hMm = params.height * toMm
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
  triggerDownload(blob, filename)
}
