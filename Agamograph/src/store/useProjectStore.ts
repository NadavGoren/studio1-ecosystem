import { create } from 'zustand'
import { DEFAULT_CROP, type CropTransform } from '../lib/crop'
import { computeDimensions } from '../lib/geometry'
import type { LoadedImage } from '../lib/image'

export type Slot = 'A' | 'B'

export type ImageState = {
  blob: Blob | null
  url: string | null
  natW: number
  natH: number
  crop: CropTransform
}

export type Unit = 'cm' | 'in'

export type ExportFormat = 'png' | 'jpg' | 'pdf'

export const DPI_MIN = 72
export const DPI_MAX = 1200

export type CanvasSettings = {
  width: number
  height: number
  unit: Unit
}

// Slider ranges (spec §2.2 / PRD §5.2)
export const SLICES_MIN = 4
export const SLICES_MAX = 60
export const ANGLE_MIN = 60
export const ANGLE_MAX = 120

// Margins & dividers — print-sheet packaging, NOT part of the fold math.
export const MARGIN_MIN_CM = 1
export const MARGIN_MAX_CM = 15
export const DIVIDER_MIN_MM = 0.4
export const DIVIDER_MAX_MM = 2

/** White margin bands on the left & right print edges (height stays = H). */
export type MarginSettings = { enabled: boolean; widthCm: number }
/** Printed fold-line dividers drawn between adjacent strips. */
export type DividerSettings = {
  enabled: boolean
  widthMm: number
  color: string
  /** Auto = two-tone line that borrows each neighbouring strip's edge colour. */
  auto: boolean
}

export const DEFAULT_MARGINS: MarginSettings = { enabled: false, widthCm: 2 }
export const DEFAULT_DIVIDERS: DividerSettings = {
  enabled: false,
  widthMm: 0.6,
  color: '#000000',
  auto: false,
}

const emptyImage = (): ImageState => ({
  blob: null,
  url: null,
  natW: 0,
  natH: 0,
  crop: { ...DEFAULT_CROP },
})

type ProjectState = {
  images: Record<Slot, ImageState>
  /** N — slices per image. */
  slices: number
  /** θ — fold apex angle, degrees. */
  apexAngleDeg: number
  /** Finished mounted size. */
  canvas: CanvasSettings
  /** Export resolution (dots per inch). */
  dpi: number
  /** Chosen export file type. */
  exportFormat: ExportFormat
  /** Optional white margins on the left & right print edges. */
  margins: MarginSettings
  /** Optional printed fold-line dividers between strips. */
  dividers: DividerSettings

  setImage: (slot: Slot, img: LoadedImage) => void
  setCrop: (slot: Slot, crop: CropTransform) => void
  patchCrop: (slot: Slot, patch: Partial<CropTransform>) => void
  resetCrop: (slot: Slot) => void
  clearImage: (slot: Slot) => void

  setSlices: (n: number) => void
  setApexAngle: (deg: number) => void
  setCanvasSize: (patch: Partial<Pick<CanvasSettings, 'width' | 'height'>>) => void

  setDpi: (dpi: number) => void
  setExportFormat: (format: ExportFormat) => void
  setMargins: (patch: Partial<MarginSettings>) => void
  setDividers: (patch: Partial<DividerSettings>) => void
  /** Swap width ↔ height (portrait ↔ landscape). */
  swapOrientation: () => void
  /** Replace the whole project (used to restore a saved session). */
  hydrate: (data: {
    images: Record<Slot, ImageState>
    slices: number
    apexAngleDeg: number
    canvas: CanvasSettings
    dpi: number
    exportFormat: ExportFormat
    margins: MarginSettings
    dividers: DividerSettings
  }) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  images: { A: emptyImage(), B: emptyImage() },
  slices: 24,
  apexAngleDeg: 90,
  canvas: { width: 40, height: 30, unit: 'cm' },
  dpi: 300,
  exportFormat: 'png',
  margins: { ...DEFAULT_MARGINS },
  dividers: { ...DEFAULT_DIVIDERS },

  setImage: (slot, img) =>
    set((s) => {
      const prev = s.images[slot]
      if (prev.url && prev.url !== img.url) URL.revokeObjectURL(prev.url)
      return {
        images: {
          ...s.images,
          [slot]: {
            blob: img.blob,
            url: img.url,
            natW: img.natW,
            natH: img.natH,
            crop: { ...DEFAULT_CROP }, // auto-fit on upload
          },
        },
      }
    }),

  setCrop: (slot, crop) =>
    set((s) => ({
      images: { ...s.images, [slot]: { ...s.images[slot], crop } },
    })),

  patchCrop: (slot, patch) =>
    set((s) => ({
      images: {
        ...s.images,
        [slot]: { ...s.images[slot], crop: { ...s.images[slot].crop, ...patch } },
      },
    })),

  resetCrop: (slot) =>
    set((s) => ({
      images: {
        ...s.images,
        [slot]: { ...s.images[slot], crop: { ...DEFAULT_CROP } },
      },
    })),

  clearImage: (slot) =>
    set((s) => {
      const prev = s.images[slot]
      if (prev.url) URL.revokeObjectURL(prev.url)
      return { images: { ...s.images, [slot]: emptyImage() } }
    }),

  setSlices: (n) =>
    set(() => ({ slices: Math.round(Math.min(SLICES_MAX, Math.max(SLICES_MIN, n))) })),

  setApexAngle: (deg) =>
    set(() => ({ apexAngleDeg: Math.min(ANGLE_MAX, Math.max(ANGLE_MIN, deg)) })),

  setCanvasSize: (patch) =>
    set((s) => ({
      canvas: {
        ...s.canvas,
        width: patch.width != null ? Math.max(1, patch.width) : s.canvas.width,
        height: patch.height != null ? Math.max(1, patch.height) : s.canvas.height,
      },
    })),

  setDpi: (dpi) =>
    set(() => ({ dpi: Math.round(Math.min(DPI_MAX, Math.max(DPI_MIN, dpi || DPI_MIN))) })),

  setExportFormat: (format) => set(() => ({ exportFormat: format })),

  setMargins: (patch) =>
    set((s) => {
      const next = { ...s.margins, ...patch }
      return {
        margins: {
          enabled: next.enabled,
          widthCm: Math.min(MARGIN_MAX_CM, Math.max(MARGIN_MIN_CM, next.widthCm)),
        },
      }
    }),

  setDividers: (patch) =>
    set((s) => {
      const next = { ...s.dividers, ...patch }
      return {
        dividers: {
          enabled: next.enabled,
          widthMm: Math.min(DIVIDER_MAX_MM, Math.max(DIVIDER_MIN_MM, next.widthMm)),
          color: next.color,
          auto: next.auto,
        },
      }
    }),

  swapOrientation: () =>
    set((s) => ({
      canvas: { ...s.canvas, width: s.canvas.height, height: s.canvas.width },
    })),

  hydrate: (data) =>
    set((s) => {
      // Revoke any object URLs we're about to replace.
      for (const slot of ['A', 'B'] as Slot[]) {
        const prev = s.images[slot]
        const next = data.images[slot]
        if (prev.url && prev.url !== next.url) URL.revokeObjectURL(prev.url)
      }
      return {
        images: data.images,
        slices: data.slices,
        apexAngleDeg: data.apexAngleDeg,
        canvas: data.canvas,
        dpi: data.dpi,
        exportFormat: data.exportFormat,
        margins: data.margins,
        dividers: data.dividers,
      }
    }),
}))

/**
 * The crop-frame aspect ratio = perceivedImageWidth : H (spec §2.3). This is how
 * each image appears when viewed from its side, so cropping to it keeps each
 * picture correctly proportioned in the folded piece. Independent of N.
 */
export function getFrameAspect(s: {
  slices: number
  apexAngleDeg: number
  canvas: CanvasSettings
}): number {
  const d = computeDimensions({
    slices: s.slices,
    apexAngleDeg: s.apexAngleDeg,
    width: s.canvas.width,
    height: s.canvas.height,
  })
  return d.perceivedImageWidth / s.canvas.height
}
