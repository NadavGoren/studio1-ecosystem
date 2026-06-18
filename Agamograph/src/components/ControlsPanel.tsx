import {
  useProjectStore,
  SLICES_MIN,
  SLICES_MAX,
  ANGLE_MIN,
  ANGLE_MAX,
  MARGIN_MIN_CM,
  MARGIN_MAX_CM,
  DIVIDER_MIN_MM,
  DIVIDER_MAX_MM,
} from '../store/useProjectStore'
import { CANVAS_PRESETS, CUSTOM_ID, matchPreset } from '../lib/canvasPresets'
import { useLanguage } from '../i18n/LanguageProvider'
import { CollapsibleSection } from './CollapsibleSection'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Small on/off switch (RTL-safe — knob slides toward the logical end). */
function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-neutral-900' : 'bg-neutral-300',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-4 w-4 rounded-full bg-white shadow transition-all',
          checked ? 'ms-4' : 'ms-0.5',
        ].join(' ')}
      />
    </button>
  )
}

/** "Enable" row at the top of an optional-feature section. */
function EnableRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

export function ControlsPanel() {
  const { t } = useLanguage()
  const slices = useProjectStore((s) => s.slices)
  const apexAngleDeg = useProjectStore((s) => s.apexAngleDeg)
  const canvas = useProjectStore((s) => s.canvas)
  const margins = useProjectStore((s) => s.margins)
  const dividers = useProjectStore((s) => s.dividers)
  const setSlices = useProjectStore((s) => s.setSlices)
  const setApexAngle = useProjectStore((s) => s.setApexAngle)
  const setCanvasSize = useProjectStore((s) => s.setCanvasSize)
  const swapOrientation = useProjectStore((s) => s.swapOrientation)
  const setMargins = useProjectStore((s) => s.setMargins)
  const setDividers = useProjectStore((s) => s.setDividers)

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
    <>
      {/* Slices & fold angle */}
      <CollapsibleSection
        title={t('section.slicesAngle')}
        description={t('section.slicesAngleDesc')}
        defaultOpen
      >
        <div className="flex flex-col gap-5">
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
        </div>
      </CollapsibleSection>

      {/* Print size */}
      <CollapsibleSection
        title={t('section.size')}
        description={t('section.sizeDesc')}
        defaultOpen
      >
        <div className="flex flex-col gap-2">
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
      </CollapsibleSection>

      {/* Margins */}
      <CollapsibleSection
        title={t('controls.margins')}
        description={t('controls.marginsHelp')}
        active={margins.enabled}
      >
        <div className="flex flex-col gap-3">
          <EnableRow
            checked={margins.enabled}
            onChange={(v) => setMargins({ enabled: v })}
            label={t('common.enable')}
          />
          {margins.enabled && (
            <label className="flex flex-col gap-1.5">
              <span className="flex items-baseline justify-between text-sm text-neutral-600">
                {t('controls.marginsWidth')}
                <span className="text-neutral-400">
                  {margins.widthCm} {t('unit.cm')}
                </span>
              </span>
              <input
                type="range"
                min={MARGIN_MIN_CM}
                max={MARGIN_MAX_CM}
                step={0.5}
                value={margins.widthCm}
                onChange={(e) => setMargins({ widthCm: Number(e.target.value) })}
                className="w-full accent-neutral-900"
              />
            </label>
          )}
        </div>
      </CollapsibleSection>

      {/* Dividers */}
      <CollapsibleSection
        title={t('controls.dividers')}
        description={
          dividers.auto ? t('controls.dividersAutoHelp') : t('controls.dividersHelp')
        }
        active={dividers.enabled}
      >
        <div className="flex flex-col gap-3">
          <EnableRow
            checked={dividers.enabled}
            onChange={(v) => setDividers({ enabled: v })}
            label={t('common.enable')}
          />
          {dividers.enabled && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="flex items-baseline justify-between text-sm text-neutral-600">
                  {t('controls.dividersWidth')}
                  <span className="text-neutral-400">
                    {dividers.widthMm} {t('unit.mm')}
                  </span>
                </span>
                <input
                  type="range"
                  min={DIVIDER_MIN_MM}
                  max={DIVIDER_MAX_MM}
                  step={0.1}
                  value={dividers.widthMm}
                  onChange={(e) => setDividers({ widthMm: Number(e.target.value) })}
                  className="w-full accent-neutral-900"
                />
              </label>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">
                  {t('controls.dividersAuto')}
                </span>
                <Switch
                  checked={dividers.auto}
                  onChange={(v) => setDividers({ auto: v })}
                  label={t('controls.dividersAuto')}
                />
              </div>

              {!dividers.auto && (
                <label className="flex items-center justify-between gap-2">
                  <span className="text-sm text-neutral-600">
                    {t('controls.dividersColor')}
                  </span>
                  <input
                    type="color"
                    value={dividers.color}
                    onChange={(e) => setDividers({ color: e.target.value })}
                    className="h-8 w-12 cursor-pointer rounded border border-neutral-200 bg-white p-0.5"
                  />
                </label>
              )}
            </>
          )}
        </div>
      </CollapsibleSection>
    </>
  )
}
