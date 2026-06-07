import { useRef, useState } from 'react'
import {
  useProjectStore,
  getFrameAspect,
  type Slot,
} from '../store/useProjectStore'
import {
  loadImageFile,
  ACCEPTED_ACCEPT_ATTR,
  UnsupportedImageError,
} from '../lib/image'
import {
  clamp,
  computeSourceRect,
  cropToBackground,
  MIN_ZOOM,
  MAX_ZOOM,
} from '../lib/crop'
import { useLanguage } from '../i18n/LanguageProvider'

type Props = {
  slot: Slot
  badge: string
  name: string
}

export function ImageCropFrame({ slot, badge, name }: Props) {
  const { t } = useLanguage()
  const image = useProjectStore((s) => s.images[slot])
  const slices = useProjectStore((s) => s.slices)
  const apexAngleDeg = useProjectStore((s) => s.apexAngleDeg)
  const canvas = useProjectStore((s) => s.canvas)
  const setImage = useProjectStore((s) => s.setImage)
  const patchCrop = useProjectStore((s) => s.patchCrop)
  const resetCrop = useProjectStore((s) => s.resetCrop)

  const aspect = getFrameAspect({ slices, apexAngleDeg, canvas })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; rect: DOMRect } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setDragOver] = useState(false)

  const hasImage = !!image.url

  async function handleFile(file: File | undefined | null) {
    if (!file) return
    setError(null)
    try {
      const loaded = await loadImageFile(file)
      setImage(slot, loaded)
    } catch (err) {
      if (err instanceof UnsupportedImageError) setError(t('upload.errorType'))
      else setError(t('upload.errorGeneric'))
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!hasImage) return
    const rect = frameRef.current!.getBoundingClientRect()
    drag.current = { x: e.clientX, y: e.clientY, rect }
    frameRef.current!.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    const st = useProjectStore.getState()
    const im = st.images[slot]
    const a = getFrameAspect(st)
    const { sw, sh } = computeSourceRect(im.natW, im.natH, a, im.crop)
    const slackX = im.natW - sw
    const slackY = im.natH - sh
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    const nx = clamp(
      im.crop.offsetX + (slackX > 0 ? (-2 * dx * sw) / (d.rect.width * slackX) : 0),
      -1,
      1,
    )
    const ny = clamp(
      im.crop.offsetY + (slackY > 0 ? (-2 * dy * sh) / (d.rect.height * slackY) : 0),
      -1,
      1,
    )
    st.patchCrop(slot, { offsetX: nx, offsetY: ny })
    drag.current = { ...d, x: e.clientX, y: e.clientY }
  }

  function endDrag(e: React.PointerEvent) {
    if (drag.current) {
      try {
        frameRef.current?.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      drag.current = null
    }
  }

  function onWheel(e: React.WheelEvent) {
    if (!hasImage) return
    const st = useProjectStore.getState()
    const current = st.images[slot].crop.scale
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    st.patchCrop(slot, { scale: clamp(current * factor, MIN_ZOOM, MAX_ZOOM) })
  }

  const bg = hasImage
    ? cropToBackground(image.natW, image.natH, aspect, image.crop)
    : null

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
            {badge}
          </span>
          <span className="text-sm font-medium text-neutral-700">{name}</span>
        </div>
        {hasImage && (
          <button
            type="button"
            onClick={() => resetCrop(slot)}
            className="text-xs font-medium text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
          >
            {t('upload.reset')}
          </button>
        )}
      </div>

      {/* Fixed-height box keeps the layout from jumping when the frame aspect
          changes with size/angle — only the WIDTH varies. */}
      <div className="flex h-48 items-center justify-center">
        <div
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={onWheel}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            handleFile(e.dataTransfer.files?.[0])
          }}
          style={
            bg
              ? {
                  aspectRatio: String(aspect),
                  backgroundImage: `url(${image.url})`,
                  backgroundSize: bg.backgroundSize,
                  backgroundPosition: bg.backgroundPosition,
                  backgroundRepeat: 'no-repeat',
                  touchAction: 'none',
                }
              : { aspectRatio: String(aspect), touchAction: 'none' }
          }
          className={[
            'relative h-full max-w-full overflow-hidden rounded-lg border bg-neutral-100',
            hasImage
              ? 'cursor-grab border-neutral-200 active:cursor-grabbing'
              : isDragOver
                ? 'border-2 border-dashed border-neutral-900 bg-neutral-50'
                : 'cursor-pointer border-2 border-dashed border-neutral-300 hover:border-neutral-400',
          ].join(' ')}
          onClick={() => {
            if (!hasImage) fileInputRef.current?.click()
          }}
        >
          {!hasImage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-3 text-center">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-sm font-bold text-white">
                {badge}
              </span>
              <p className="mt-1 text-sm font-medium text-neutral-700">
                {t('upload.dropzone')}
              </p>
              <p className="text-xs text-neutral-400">{t('upload.dropzoneSub')}</p>
            </div>
          )}

          {hasImage && (
            <span className="pointer-events-none absolute start-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900/80 text-xs font-bold text-white shadow">
              {badge}
            </span>
          )}
        </div>
      </div>

      {hasImage ? (
        <div className="flex items-center gap-3">
          <label className="flex flex-1 items-center gap-2 text-xs text-neutral-500">
            <span className="w-10 shrink-0">{t('upload.zoom')}</span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={image.crop.scale}
              onChange={(e) => patchCrop(slot, { scale: Number(e.target.value) })}
              className="w-full accent-neutral-900"
            />
          </label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
          >
            {t('upload.change')}
          </button>
        </div>
      ) : (
        <p className="text-xs text-neutral-400">{t('upload.dragHint')}</p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
