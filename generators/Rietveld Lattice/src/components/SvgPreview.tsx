import { useEffect, useRef, useState } from 'react'
import { Maximize2 } from 'lucide-react'
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

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const FIT = { s: 1, x: 0, y: 0 }

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
  const containerRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const [t, setT] = useState(FIT)
  const [grabbing, setGrabbing] = useState(false)

  const reset = () => setT(FIT)

  // wheel zoom toward the cursor (native non-passive listener so we can preventDefault)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
      setT((prev) => {
        const s = clamp(prev.s * factor, 1, 24)
        if (s <= 1.0001) return FIT // zoomed all the way out → snap back to fit
        const k = s / prev.s
        return { s, x: cx - k * (cx - prev.x), y: cy - k * (cy - prev.y) }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    if (t.s <= 1) return
    drag.current = { x: e.clientX, y: e.clientY }
    setGrabbing(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    drag.current = { x: e.clientX, y: e.clientY }
    setT((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
  }
  const onPointerUp = () => {
    drag.current = null
    setGrabbing(false)
  }

  const zoomed = t.s > 1.0001

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onDoubleClick={reset}
      style={{ cursor: zoomed ? (grabbing ? 'grabbing' : 'grab') : 'default' }}
    >
      <div
        className="flex h-full w-full items-center justify-center p-6"
        style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})`, transformOrigin: '0 0' }}
      >
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

      {/* zoom controls — scroll to zoom, drag to pan, this fits back to window */}
      {zoomed && (
        <button
          onClick={reset}
          onPointerDown={(e) => e.stopPropagation()}
          title="Fit to window (or double-click)"
          className="absolute right-3 top-3 flex items-center gap-1.5 rounded border border-edge bg-panel/90 px-2.5 py-1.5 font-mono text-[11px] text-neutral-200 backdrop-blur hover:border-destijl-yellow hover:text-destijl-yellow"
        >
          <Maximize2 size={12} /> {Math.round(t.s * 100)}% · Fit
        </button>
      )}
    </div>
  )
}
