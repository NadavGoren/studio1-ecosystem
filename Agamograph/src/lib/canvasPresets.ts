/**
 * Finished-size presets. Stored in CENTIMETRES, portrait (w ≤ h). The UI applies
 * them respecting the current unit and orientation, and matches the current size
 * back to a preset (so the dropdown reflects a custom edit as "Custom").
 */

export type CanvasPreset = {
  id: string
  label: string
  /** width in cm (portrait: w ≤ h) */
  w: number
  /** height in cm */
  h: number
}

export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: 'a4', label: 'A4 — 21 × 29.7 cm', w: 21, h: 29.7 },
  { id: 'a3', label: 'A3 — 29.7 × 42 cm', w: 29.7, h: 42 },
  { id: 'a2', label: 'A2 — 42 × 59.4 cm', w: 42, h: 59.4 },
  { id: '20x30', label: '20 × 30 cm', w: 20, h: 30 },
  { id: '30x40', label: '30 × 40 cm', w: 30, h: 40 },
  { id: '40x50', label: '40 × 50 cm', w: 40, h: 50 },
  { id: '50x70', label: '50 × 70 cm', w: 50, h: 70 },
  { id: 'sq30', label: 'Square — 30 × 30 cm', w: 30, h: 30 },
]

export const CUSTOM_ID = 'custom'

const EPS = 0.05

/** Find the preset whose dimensions match (in either orientation), else null. */
export function matchPreset(widthCm: number, heightCm: number): CanvasPreset | null {
  const lo = Math.min(widthCm, heightCm)
  const hi = Math.max(widthCm, heightCm)
  return (
    CANVAS_PRESETS.find(
      (p) =>
        Math.abs(Math.min(p.w, p.h) - lo) < EPS &&
        Math.abs(Math.max(p.w, p.h) - hi) < EPS,
    ) ?? null
  )
}
