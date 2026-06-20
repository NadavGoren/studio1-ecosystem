import type { Polyline, RenderResult } from '../types'
import { PEN_HEX } from '../lib/palette'

function pathFor(paths: Polyline[]): string {
  let d = ''
  for (const pl of paths) {
    if (pl.length < 2) continue
    d += `M${pl[0][0].toFixed(2)} ${pl[0][1].toFixed(2)}`
    for (let i = 1; i < pl.length; i++) d += `L${pl[i][0].toFixed(2)} ${pl[i][1].toFixed(2)}`
  }
  return d
}

export default function SvgPreview({
  render,
  strokeWidth,
  margin,
}: {
  render: RenderResult
  strokeWidth: number
  margin: number
}) {
  const { w, h } = render.page
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        style={{ filter: 'drop-shadow(0 10px 36px rgba(0,0,0,.55))' }}
      >
        <rect x={0} y={0} width={w} height={h} fill="#fdfdfb" />
        {margin > 0 && (
          <rect
            x={margin}
            y={margin}
            width={Math.max(0, w - 2 * margin)}
            height={Math.max(0, h - 2 * margin)}
            fill="none"
            stroke="#d9d6cf"
            strokeWidth={0.3}
            strokeDasharray="2 2"
          />
        )}
        {render.layers.map((layer) => (
          <path
            key={layer.color}
            d={pathFor(layer.paths)}
            fill="none"
            stroke={PEN_HEX[layer.color]}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </div>
  )
}
