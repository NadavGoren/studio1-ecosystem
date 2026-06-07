/**
 * Built-in sample images (the A/B test pattern) shown on first load so the app
 * demonstrates itself before the user uploads anything. Generated on the client
 * — no network, consistent with the privacy/offline architecture.
 */

import type { LoadedImage } from './image'

function drawTestImage(label: string, c1: string, c2: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 1200
  c.height = 900
  const x = c.getContext('2d')!
  x.fillStyle = c1
  x.fillRect(0, 0, 600, 900)
  x.fillStyle = c2
  x.fillRect(600, 0, 600, 900)
  x.fillStyle = '#ffffff'
  x.font = 'bold 360px ui-sans-serif, system-ui, sans-serif'
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillText(label, 600, 450)
  return c
}

function toLoaded(canvas: HTMLCanvasElement): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Could not build sample image'))
      resolve({
        blob,
        url: URL.createObjectURL(blob),
        natW: canvas.width,
        natH: canvas.height,
      })
    }, 'image/png')
  })
}

export async function makeDefaultImages(): Promise<{
  A: LoadedImage
  B: LoadedImage
}> {
  const A = await toLoaded(drawTestImage('A', '#0ea5e9', '#0c4a6e'))
  const B = await toLoaded(drawTestImage('B', '#f43f5e', '#881337'))
  return { A, B }
}
