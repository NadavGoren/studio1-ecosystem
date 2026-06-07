import {
  useProjectStore,
  SLICES_MIN,
  SLICES_MAX,
  ANGLE_MIN,
  ANGLE_MAX,
} from '../store/useProjectStore'
import {
  CANVAS_PRESETS,
  CUSTOM_ID,
  matchPreset,
} from '../lib/canvasPresets'
import { useLanguage } from '../i18n/LanguageProvider'

const round2 = (n: number) => Math.round(n * 100) / 100

export function ControlsPanel() {
  const { t } = useLanguage()
  const slices = useProjectStore((s) => s.slices)
  const apexAngleDeg = useProjectStore((s) => s.apexAngleDeg)
  const canvas = useProjectStore((s) => s.canvas)
  const setSlices = useProjectStore((s) => s.setSlices)
  const setApexAngle = useProjectStore((s) => s.setApexAngle)
  const setCanvasSize = useProjectStore((s) => s.setCanvasSize)
  const swapOrientation = useProjectStore((s) => s.swapOrientation)

  // Single unit: centimetres.
  const matched = matchPreset(canvas.width, canvas.height)
  const selectedId = matched?.id ?? CUSTOM_ID
  const isLandscape = canvas.width > canvas.height

  function applyPreset(id: string) {
    if (id === CUSTOM_ID) return
    const p = CANVAS_PRESETS.find((x) => x.id === id)
    if (!p) return
    let w = p.w
    let h = p.h
    if (isLandscape) [w, h] = [h, w]
    setCanvasSize({ width: round2(w), height: round2(h) })
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-base font-semibold text-neutral-900">
        {t('controls.title')}
      </h2>

      {/* Slices */}
      <label className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between text-sm font-medium text-neutral-700">
          {t('controls.slices')}
          <span className="text-neutral-400">{slices}</span>
        </span>
        <input
          type="range"
          min={SLICES_MIN}
          max={SLICES_MAX}
          step={1}
          value={slices}
          onChange={(e) => setSlices(Number(e.target.value))}
          className="w-full accent-neutral-900"
        />
        <span className="text-xs text-neutral-400">{t('controls.slicesHelp')}</span>
      </label>

      {/* Apex angle */}
      <label className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between text-sm font-medium text-neutral-700">
          {t('controls.angle')}
          <span className="text-neutral-400">{apexAngleDeg}°</span>
        </span>
        <input
          type="range"
          min={ANGLE_MIN}
          max={ANGLE_MAX}
          step={1}
          value={apexAngleDeg}
          onChange={(e) => setApexAngle(Number(e.target.value))}
          className="w-full accent-neutral-900"
        />
        <span className="text-xs text-neutral-400">{t('controls.angleHelp')}</span>
      </label>

      {/* Finished size */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-neutral-700">
          {t('controls.size')}
        </span>

        {/* Preset dropdown */}
        <select
          value={selectedId}
          onChange={(e) => applyPreset(e.target.value)}
          className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm"
        >
          {CANVAS_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          <option value={CUSTOM_ID}>{t('controls.custom')}</option>
        </select>

        {/* Orientation toggle */}
        <div className="flex overflow-hidden rounded-md border border-neutral-200 text-sm">
          <button
            type="button"
            onClick={() => {
              if (isLandscape) swapOrientation()
            }}
            className={[
              'flex-1 px-2.5 py-1',
              !isLandscape
                ? 'bg-neutral-900 text-white'
                : 'bg-white text-neutral-600 hover:bg-neutral-50',
            ].join(' ')}
          >
            {t('controls.portrait')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!isLandscape) swapOrientation()
            }}
            className={[
              'flex-1 px-2.5 py-1',
              isLandscape
                ? 'bg-neutral-900 text-white'
                : 'bg-white text-neutral-600 hover:bg-neutral-50',
            ].join(' ')}
          >
            {t('controls.landscape')}
          </button>
        </div>

        {/* Custom width/height + unit */}
        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs text-neutral-400">{t('controls.width')}</span>
            <input
              type="number"
              min={1}
              value={canvas.width}
              onChange={(e) => setCanvasSize({ width: Number(e.target.value) })}
              className="w-full rounded-md border border-neutral-200 px-2 py-1 text-sm"
            />
          </label>
          <span className="pb-2 text-neutral-300">×</span>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs text-neutral-400">{t('controls.height')}</span>
            <input
              type="number"
              min={1}
              value={canvas.height}
              onChange={(e) => setCanvasSize({ height: Number(e.target.value) })}
              className="w-full rounded-md border border-neutral-200 px-2 py-1 text-sm"
            />
          </label>
          <span className="pb-1.5 text-sm text-neutral-500">{t('unit.cm')}</span>
        </div>
      </div>
    </div>
  )
}
