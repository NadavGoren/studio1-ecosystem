import { useState } from 'react'
import {
  useProjectStore,
  DPI_MIN,
  DPI_MAX,
  type ExportFormat,
} from '../store/useProjectStore'
import { useLoadedImage } from '../hooks/useLoadedImage'
import { exportAgamograph } from '../lib/exportSheet'
import { useLanguage } from '../i18n/LanguageProvider'

const FORMATS: ExportFormat[] = ['png', 'jpg', 'pdf']

export function ExportPanel() {
  const { t } = useLanguage()
  const A = useProjectStore((s) => s.images.A)
  const B = useProjectStore((s) => s.images.B)
  const slices = useProjectStore((s) => s.slices)
  const apexAngleDeg = useProjectStore((s) => s.apexAngleDeg)
  const canvas = useProjectStore((s) => s.canvas)
  const dpi = useProjectStore((s) => s.dpi)
  const exportFormat = useProjectStore((s) => s.exportFormat)
  const setDpi = useProjectStore((s) => s.setDpi)
  const setExportFormat = useProjectStore((s) => s.setExportFormat)

  const imgA = useLoadedImage(A.url)
  const imgB = useLoadedImage(B.url)
  const ready = !!imgA && !!imgB

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onExport() {
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    try {
      await exportAgamograph({
        params: { slices, apexAngleDeg, width: canvas.width, height: canvas.height },
        unit: canvas.unit,
        dpi,
        format: exportFormat,
        A: { img: imgA, natW: A.natW, natH: A.natH, crop: A.crop },
        B: { img: imgB, natW: B.natW, natH: B.natH, crop: B.crop },
      })
    } catch (err) {
      setError(t('export.error'))
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-neutral-900">
        {t('export.title')}
      </h2>

      <div className="flex items-end gap-3">
        {/* Format */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400">{t('export.format')}</span>
          <div className="flex overflow-hidden rounded-md border border-neutral-200">
            {FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setExportFormat(f)}
                className={[
                  'px-3 py-1 text-sm uppercase',
                  exportFormat === f
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white text-neutral-600 hover:bg-neutral-50',
                ].join(' ')}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* DPI */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400">{t('export.dpi')}</span>
          <input
            type="number"
            min={DPI_MIN}
            max={DPI_MAX}
            step={1}
            value={dpi}
            onChange={(e) => setDpi(Number(e.target.value))}
            className="w-24 rounded-md border border-neutral-200 px-2 py-1 text-sm"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onExport}
        disabled={!ready || busy}
        className={[
          'w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition',
          !ready || busy
            ? 'cursor-not-allowed bg-neutral-300'
            : 'bg-neutral-900 hover:bg-neutral-700',
        ].join(' ')}
      >
        {busy ? t('export.busy') : t('export.button')}
      </button>

      {!ready ? (
        <p className="text-xs text-neutral-400">{t('export.needBoth')}</p>
      ) : (
        <p className="text-xs text-neutral-400">{t('export.hint')}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
