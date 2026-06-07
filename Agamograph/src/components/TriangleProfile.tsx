import { useProjectStore } from '../store/useProjectStore'
import { computeDimensions } from '../lib/geometry'
import { useLanguage } from '../i18n/LanguageProvider'

const VBW = 360
const VBH = 200
const MARGIN = { l: 30, r: 60, t: 38, b: 44 }

const A_COLOR = '#c2410c'
const B_COLOR = '#1d4ed8'

/** A label with an opaque white pill behind it, so triangle lines never hide it. */
function Tag({
  x,
  y,
  text,
  anchor = 'middle',
}: {
  x: number
  y: number
  text: string
  anchor?: 'start' | 'middle' | 'end'
}) {
  const w = text.length * 5.6 + 10
  const h = 15
  const rx = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x
  return (
    <g>
      <rect x={rx} y={y - h / 2} width={w} height={h} rx={3} fill="#ffffff" stroke="#e5e7eb" />
      <text
        x={x}
        y={y + 0.5}
        fontSize={9.5}
        fill="#404040"
        textAnchor={anchor}
        dominantBaseline="middle"
      >
        {text}
      </text>
    </g>
  )
}

export function TriangleProfile() {
  const { t } = useLanguage()
  const slices = useProjectStore((s) => s.slices)
  const apexAngleDeg = useProjectStore((s) => s.apexAngleDeg)
  const canvas = useProjectStore((s) => s.canvas)

  const dims = computeDimensions({
    slices,
    apexAngleDeg,
    width: canvas.width,
    height: canvas.height,
  })
  const fmt = (n: number) => n.toFixed(2)

  // 4 faces (2 teeth). Uniform scale so the apex angle is true to life.
  const faces = 4
  const availW = VBW - MARGIN.l - MARGIN.r
  const availH = VBH - MARGIN.t - MARGIN.b
  const scale = Math.min(availW / (faces * dims.projectedFaceWidth), availH / dims.faceDepth)
  const pw = dims.projectedFaceWidth * scale
  const dpx = dims.faceDepth * scale
  const drawW = faces * pw
  const originX = MARGIN.l + (availW - drawW) / 2
  const baseY = VBH - MARGIN.b

  const pt = (j: number) => ({ x: originX + j * pw, y: baseY - (j % 2 === 1 ? dpx : 0) })
  const points = Array.from({ length: faces + 1 }, (_, j) => pt(j))
  const P0 = points[0]
  const P1 = points[1] // first apex (ridge)
  const P3 = points[3] // second ridge — used for the depth dimension on the right

  // θ arc at the apex
  const r = 16
  const a0 = Math.atan2(P0.y - P1.y, P0.x - P1.x)
  const a1 = Math.atan2(points[2].y - P1.y, points[2].x - P1.x)
  const arc = `M ${P1.x + r * Math.cos(a0)} ${P1.y + r * Math.sin(a0)} A ${r} ${r} 0 0 0 ${
    P1.x + r * Math.cos(a1)
  } ${P1.y + r * Math.sin(a1)}`

  const mid0 = { x: (P0.x + P1.x) / 2, y: (P0.y + P1.y) / 2 }
  const rightX = originX + drawW + 16

  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="text-sm font-medium text-neutral-700">
        {t('profile.title')}
      </figcaption>
      <svg
        viewBox={`0 0 ${VBW} ${VBH}`}
        className="w-full rounded-lg border border-neutral-200 bg-white"
        role="img"
      >
        {/* wall line */}
        <line
          x1={originX - 6}
          y1={baseY}
          x2={originX + drawW + 6}
          y2={baseY}
          stroke="#d4d4d4"
          strokeWidth={1}
          strokeDasharray="4 3"
        />

        {/* faces, coloured A / B */}
        {points.slice(0, -1).map((pa, j) => {
          const pb = points[j + 1]
          return (
            <line
              key={j}
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke={j % 2 === 0 ? A_COLOR : B_COLOR}
              strokeWidth={3}
              strokeLinecap="round"
            />
          )
        })}

        {/* base p under the first face */}
        <line x1={P0.x} y1={baseY + 11} x2={P1.x} y2={baseY + 11} stroke="#a3a3a3" />
        <line x1={P0.x} y1={baseY + 8} x2={P0.x} y2={baseY + 14} stroke="#a3a3a3" />
        <line x1={P1.x} y1={baseY + 8} x2={P1.x} y2={baseY + 14} stroke="#a3a3a3" />
        <Tag x={(P0.x + P1.x) / 2} y={baseY + 11} text={`p = ${fmt(dims.projectedFaceWidth)}`} />

        {/* depth d as a vertical dimension on the right, aligned to a ridge */}
        <line x1={P3.x} y1={P3.y} x2={rightX} y2={P3.y} stroke="#d4d4d4" strokeDasharray="3 2" />
        <line x1={rightX} y1={baseY} x2={rightX} y2={P3.y} stroke="#a3a3a3" />
        <line x1={rightX - 3} y1={baseY} x2={rightX + 3} y2={baseY} stroke="#a3a3a3" />
        <line x1={rightX - 3} y1={P3.y} x2={rightX + 3} y2={P3.y} stroke="#a3a3a3" />
        <Tag x={rightX + 5} y={(baseY + P3.y) / 2} text={`d = ${fmt(dims.faceDepth)}`} anchor="start" />

        {/* slant width s along the first face */}
        <Tag x={mid0.x - 12} y={mid0.y - 4} text={`s = ${fmt(dims.s)}`} />

        {/* apex angle θ — arc + white-pill label sitting above the apex */}
        <path d={arc} fill="none" stroke="#525252" strokeWidth={1.25} />
        <Tag x={P1.x} y={P1.y - 16} text={`θ = ${apexAngleDeg}°`} />

        {/* wall label */}
        <Tag x={originX + drawW / 2} y={baseY + 28} text={t('profile.wall')} />
      </svg>

      <div className="flex items-center gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: A_COLOR }} />
          {t('profile.aFaces')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: B_COLOR }} />
          {t('profile.bFaces')}
        </span>
        <span className="ms-auto">
          {t('profile.unitsNote')} · {t('profile.repeats').replace('{n}', String(slices))}
        </span>
      </div>
    </figure>
  )
}
