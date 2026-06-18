import { useState } from 'react'
import {
  useProjectStore,
  DPI_MIN,
  DPI_MAX,
  type ExportFormat,
} from '../store/useProjectStore'
import { useLoadedImage } from '../hooks/useLoadedImage'
import { exportAgamograph } from '../lib/exportSheet'
import { buildFilenameBase } from '../lib/geometry'
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
  const margins = useProjectStore((s) => s.margins)
  const dividers = useProjectStore((s) => s.dividers)
  const setDpi = useProjectStore((s) => s.setDpi)
  const setExportFormat = useProjectStore((s) => s.setExportFormat)

  const imgA = useLoadedImage(A.url)
  const imgB = useLoadedImage(B.url)
  const ready = !!imgA && !!imgB

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filename, setFilename] = useState('')

  // The auto-generated name (shown as the placeholder; used when left blank).
  const defaultBase = buildFilenameBase({
    width: canvas.width,
    height: canvas.height,
    unit: canvas.unit,
    slices,
    apexAngleDeg,
  })

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
        margins,
        dividers,
        filenameBase: filename.trim() || undefined,
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

      {/* File name (defaults to the auto-generated name shown as placeholder) */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-400">{t('export.filename')}</span>
        <div dir="ltr" className="flex items-center gap-1">
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder={defaultBase}
            className="w-full rounded-md border border-neutral-200 px-2 py-1 text-sm"
          />
          <span className="shrink-0 text-sm text-neutral-400">.{exportFormat}</span>
        </div>
      </label>

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
