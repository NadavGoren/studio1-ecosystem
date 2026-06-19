import type { Params, RenderResult, Segment } from '../types'
import { PEN_LABEL } from './palette'

const f = (n: number) => {
  const r = Math.round(n * 1000) / 1000
  return Object.is(r, -0) ? '0' : String(r)
}

/** Chain a layer's segments into one path string (one M…L per segment). */
function segmentsToPath(segments: Segment[]): string {
  const parts: string[] = []
  for (const [a, b] of segments) parts.push(`M${f(a[0])} ${f(a[1])} L${f(b[0])} ${f(b[1])}`)
  return parts.join(' ')
}

/**
 * Build a plotter-ready, stroke-only SVG. One `<g>` Inkscape layer per pen
 * colour so the piece plots multi-pen, one ink at a time. Seed + params live in
 * `<desc>` so any output is reproducible.
 */
export function buildSVG(render: RenderResult, p: Params): string {
  const { w, h } = render.page
  const sw = p.strokeWidth

  const layers = render.layers
    .map((layer) => {
      const id = `layer-${layer.color}`
      const d = segmentsToPath(layer.segments)
      return (
        `  <g inkscape:groupmode="layer" inkscape:label="${PEN_LABEL[layer.color]}" id="${id}"\n` +
        `     fill="none" stroke="${layer.hex}" stroke-width="${sw}" ` +
        `stroke-linecap="round" stroke-linejoin="round">\n` +
        `    <path d="${d}" />\n` +
        `  </g>`
      )
    })
    .join('\n')

  const desc =
    `Rietveld Lattice — seed:${p.seed} | ${p.paperSize} ${p.orientation} | ` +
    `az:${p.azimuth} el:${p.elevation} | beams:${p.beamCount} dom:${p.dominance} | ` +
    `occlusion:${p.occlusion} strategy:${p.colourStrategy}`

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"\n` +
    `     width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">\n` +
    `  <desc>${desc}</desc>\n` +
    `${layers}\n` +
    `</svg>\n`
  )
}

export function downloadSVG(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
