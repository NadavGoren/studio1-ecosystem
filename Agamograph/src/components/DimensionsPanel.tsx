import { useProjectStore } from '../store/useProjectStore'
import { computeDimensions, computePixelSheet } from '../lib/geometry'
import { useLanguage } from '../i18n/LanguageProvider'

export function DimensionsPanel() {
  const { t } = useLanguage()
  const slices = useProjectStore((s) => s.slices)
  const apexAngleDeg = useProjectStore((s) => s.apexAngleDeg)
  const canvas = useProjectStore((s) => s.canvas)
  const dpi = useProjectStore((s) => s.dpi)

  const params = {
    slices,
    apexAngleDeg,
    width: canvas.width,
    height: canvas.height,
  }
  const dims = computeDimensions(params)
  const sheet = computePixelSheet(dims, canvas.unit, dpi, slices)
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
      value: `${n2(dims.flatSheetWidth)} × ${n2(canvas.height)} ${u}`,
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
      value: `${sheet.pxWidth} × ${sheet.pxHeight} px @ ${dpi} DPI`,
    },
  ]

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-base font-semibold text-neutral-900">
        {t('dims.title')}
      </h2>
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
      <p className="text-xs text-neutral-400">{t('dims.flatSheetHelp')}</p>
    </div>
  )
}
