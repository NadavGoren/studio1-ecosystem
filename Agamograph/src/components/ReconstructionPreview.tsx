import { useEffect, useRef } from 'react'
import { useProjectStore, type Slot } from '../store/useProjectStore'
import { useLoadedImage } from '../hooks/useLoadedImage'
import { computeDimensions } from '../lib/geometry'
import { drawReconstruction } from '../lib/render2d'
import { useLanguage } from '../i18n/LanguageProvider'
import type { Strings } from '../strings'

const DEST_W = 600

type Props = {
  slot: Slot
  captionKey: keyof Strings
  emptyKey: keyof Strings
}

export function ReconstructionPreview({ slot, captionKey, emptyKey }: Props) {
  const { t } = useLanguage()
  const image = useProjectStore((s) => s.images[slot])
  const slices = useProjectStore((s) => s.slices)
  const apexAngleDeg = useProjectStore((s) => s.apexAngleDeg)
  const canvas = useProjectStore((s) => s.canvas)

  const img = useLoadedImage(image.url)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const params = {
      slices,
      apexAngleDeg,
      width: canvas.width,
      height: canvas.height,
    }
    const dims = computeDimensions(params)
    const destH = Math.max(
      1,
      Math.round((DEST_W * canvas.height) / dims.perceivedImageWidth),
    )
    el.width = DEST_W
    el.height = destH
    const ctx = el.getContext('2d')
    if (!ctx) return
    drawReconstruction(ctx, DEST_W, destH, params, slot, {
      img,
      natW: image.natW,
      natH: image.natH,
      crop: image.crop,
    })
  }, [img, slices, apexAngleDeg, canvas.width, canvas.height, image.crop, image.natW, image.natH, slot])

  return (
    <figure className="flex min-w-0 flex-1 flex-col gap-1.5">
      <figcaption className="text-sm font-medium text-neutral-700">
        {t(captionKey)}
      </figcaption>
      <div className="relative flex h-52 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
        <canvas ref={canvasRef} className="max-h-full max-w-full" />
        {!img && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-50/60 text-xs text-neutral-400">
            {t(emptyKey)}
          </div>
        )}
      </div>
    </figure>
  )
}
