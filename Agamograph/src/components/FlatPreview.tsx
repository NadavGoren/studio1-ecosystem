import { useEffect, useRef } from 'react'
import { useProjectStore } from '../store/useProjectStore'
import { useLoadedImage } from '../hooks/useLoadedImage'
import { computeDimensions, computeSheetWithMargins } from '../lib/geometry'
import { drawFlatSheet } from '../lib/render2d'
import { useLanguage } from '../i18n/LanguageProvider'

const DEST_W = 1100

export function FlatPreview() {
  const { t } = useLanguage()
  const A = useProjectStore((s) => s.images.A)
  const B = useProjectStore((s) => s.images.B)
  const slices = useProjectStore((s) => s.slices)
  const apexAngleDeg = useProjectStore((s) => s.apexAngleDeg)
  const canvas = useProjectStore((s) => s.canvas)
  const margins = useProjectStore((s) => s.margins)
  const dividers = useProjectStore((s) => s.dividers)

  const imgA = useLoadedImage(A.url)
  const imgB = useLoadedImage(B.url)
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
    const sheet = computeSheetWithMargins(dims, margins)
    const destH = Math.max(1, Math.round((DEST_W * sheet.totalHeight) / sheet.totalWidth))
    const marginPx = (sheet.marginCm / sheet.totalWidth) * DEST_W
    el.width = DEST_W
    el.height = destH
    const ctx = el.getContext('2d')
    if (!ctx) return
    drawFlatSheet(
      ctx,
      DEST_W,
      destH,
      params,
      { img: imgA, natW: A.natW, natH: A.natH, crop: A.crop },
      { img: imgB, natW: B.natW, natH: B.natH, crop: B.crop },
      {
        showGuides: true,
        contentRect: { x: marginPx, y: 0, w: DEST_W - 2 * marginPx, h: destH },
        margins,
        dividers,
      },
    )
  }, [imgA, imgB, slices, apexAngleDeg, canvas.width, canvas.height, A.crop, B.crop, A.natW, A.natH, B.natW, B.natH, margins, dividers])

  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="text-sm font-medium text-neutral-700">
        {t('preview.flat')}
      </figcaption>
      <div className="flex h-[320px] items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
        <canvas ref={canvasRef} className="max-h-full max-w-full" />
      </div>
      <p className="text-xs text-neutral-400">{t('preview.flatHelp')}</p>
    </figure>
  )
}
