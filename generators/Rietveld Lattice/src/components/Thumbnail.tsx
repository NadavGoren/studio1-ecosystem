import { useMemo } from 'react'
import { buildModel } from '../lib/model'
import { renderModel } from '../lib/render'
import type { Params, Polyline } from '../types'

function pathFor(paths: Polyline[]): string {
  let d = ''
  for (const pl of paths) {
    if (pl.length < 2) continue
    d += `M${pl[0][0].toFixed(1)} ${pl[0][1].toFixed(1)}`
    for (let i = 1; i < pl.length; i++) d += `L${pl[i][0].toFixed(1)} ${pl[i][1].toFixed(1)}`
  }
  return d
}

/** A fast, edges-only seeded thumbnail (no hatch / occlusion) for sheets. */
export default function Thumbnail({
  params,
  active = false,
  onClick,
}: {
  params: Params
  active?: boolean
  onClick?: () => void
}) {
  const { d, w, h } = useMemo(() => {
    const r = renderModel(buildModel(params), params, { edgesOnly: true })
    const black = r.layers.find((l) => l.color === 'black')
    return { d: black ? pathFor(black.paths) : '', w: r.page.w, h: r.page.h }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)])

  return (
    <button
      onClick={onClick}
      title={`seed ${params.seed}`}
      className={`group relative block overflow-hidden rounded border transition ${
        active ? 'border-destijl-yellow ring-1 ring-destijl-yellow' : 'border-edge hover:border-neutral-500'
      }`}
      style={{ aspectRatio: `${w} / ${h}`, background: '#fdfdfb' }}
    >
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        <path d={d} fill="none" stroke="#1a1a1a" strokeWidth={0.6} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="absolute bottom-0 left-0 right-0 bg-black/55 px-1 py-0.5 text-center font-mono text-[9px] text-white opacity-0 transition group-hover:opacity-100">
        {params.seed}
      </span>
    </button>
  )
}
