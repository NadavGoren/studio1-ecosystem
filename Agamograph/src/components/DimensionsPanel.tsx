import { useProjectStore } from '../store/useProjectStore'
import { computeDimensions, computeSheetWithMargins, toInches } from '../lib/geometry'
import { useLanguage } from '../i18n/LanguageProvider'

export function DimensionsPanel() {
  const { t } = useLanguage()
  const slices = useProjectStore((s) => s.slices)
  const apexAngleDeg = useProjectStore((s) => s.apexAngleDeg)
  const canvas = useProjectStore((s) => s.canvas)
  const dpi = useProjectStore((s) => s.dpi)
  const margins = useProjectStore((s) => s.margins)

  const params = {
    slices,
    apexAngleDeg,
    width: canvas.width,
    height: canvas.height,
  }
  const dims = computeDimensions(params)
  // Flat sheet + print file include the left/right margins when enabled.
  const sheetCm = computeSheetWithMargins(dims, margins)
  const totalPxW = Math.round(toInches(sheetCm.totalWidth, canvas.unit) * dpi)
  const totalPxH = Math.round(toInches(sheetCm.totalHeight, canvas.unit) * dpi)
  const u = t('unit.cm')
  const n2 = (v: number) => v.toFixed(2)
  const n1 = (v: number) => v.toFixed(1)

  const rows: { label: string; value: string; strong?: boolean }[] = [
    {
      label: t('dims.finished'),
      value: `${n1(canvas.width)} × ${n1(canvas.height)} ${u}`,
    },
    {
      label: t('dims.flatSheet'),
      value: `${n2(sheetCm.totalWidth)} × ${n2(sheetCm.totalHeight)} ${u}`,
      strong: true,
    },
    { label: t('dims.foldDepth'), value: `${n2(dims.foldDepth)} ${u}` },
    {
      label: t('dims.strips'),
      value: t('dims.stripsValue')
        .replace('{total}', String(2 * slices))
        .replace('{n}', String(slices)),
    },
    { label: t('dims.stripWidth'), value: `${n2(dims.s)} ${u}` },
    {
      label: t('dims.printFile'),
      value: `${totalPxW} × ${totalPxH} px @ ${dpi} DPI`,
    },
  ]

  return (
    <div className="flex flex-col gap-2">
      <dl className="overflow-hidden rounded-lg border border-neutral-200 text-sm">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={[
              'flex items-center justify-between gap-3 px-3 py-1.5',
              i % 2 === 0 ? 'bg-neutral-50' : 'bg-white',
            ].join(' ')}
          >
            <dt className="text-neutral-500">{r.label}</dt>
            <dd
              className={[
                'tabular-nums',
                r.strong ? 'font-semibold text-neutral-900' : 'text-neutral-700',
              ].join(' ')}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
