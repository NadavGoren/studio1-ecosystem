import { useEffect, useState } from 'react'
import { useProjectStore, type ImageState, type Slot } from '../store/useProjectStore'
import { DEFAULT_CROP } from '../lib/crop'
import { makeDefaultImages } from '../lib/defaultImages'
import {
  loadCurrentProject,
  saveCurrentProject,
  PROJECT_SCHEMA_VERSION,
  type PersistedProject,
} from '../lib/projectStore'

const SAVE_DEBOUNCE_MS = 600

const emptyImage = (): ImageState => ({
  blob: null,
  url: null,
  natW: 0,
  natH: 0,
  crop: { ...DEFAULT_CROP },
})

/** Build a displayable ImageState from a stored blob (recreates URL + reads dims). */
function blobToImageState(
  blob: Blob,
  crop: { offsetX: number; offsetY: number; scale: number },
): Promise<ImageState> {
  const url = URL.createObjectURL(blob)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () =>
      resolve({ blob, url, natW: img.naturalWidth, natH: img.naturalHeight, crop })
    img.onerror = () => resolve({ blob, url, natW: 1, natH: 1, crop })
    img.src = url
  })
}

/** Serialize the live store into a persistable project. */
function projectFromState(): PersistedProject {
  const s = useProjectStore.getState()
  return {
    version: PROJECT_SCHEMA_VERSION,
    updatedAt: Date.now(),
    settings: {
      slices: s.slices,
      apexAngleDeg: s.apexAngleDeg,
      canvasWidth: s.canvas.width,
      canvasHeight: s.canvas.height,
      unit: s.canvas.unit,
      dpi: s.dpi,
      exportFormat: s.exportFormat,
    },
    imageA: s.images.A.blob ? { blob: s.images.A.blob, crop: s.images.A.crop } : null,
    imageB: s.images.B.blob ? { blob: s.images.B.blob, crop: s.images.B.crop } : null,
  }
}

async function restore(saved: PersistedProject): Promise<void> {
  const images: Record<Slot, ImageState> = {
    A: saved.imageA
      ? await blobToImageState(saved.imageA.blob, saved.imageA.crop)
      : emptyImage(),
    B: saved.imageB
      ? await blobToImageState(saved.imageB.blob, saved.imageB.crop)
      : emptyImage(),
  }
  useProjectStore.getState().hydrate({
    images,
    slices: saved.settings.slices,
    apexAngleDeg: saved.settings.apexAngleDeg,
    canvas: {
      width: saved.settings.canvasWidth,
      height: saved.settings.canvasHeight,
      unit: 'cm', // inches removed — always cm
    },
    dpi: saved.settings.dpi,
    exportFormat: saved.settings.exportFormat,
  })
}

async function loadDefaults(cancelled: () => boolean): Promise<void> {
  const { A, B } = await makeDefaultImages()
  if (cancelled()) {
    URL.revokeObjectURL(A.url)
    URL.revokeObjectURL(B.url)
    return
  }
  const s = useProjectStore.getState()
  if (!s.images.A.url) s.setImage('A', A)
  else URL.revokeObjectURL(A.url)
  if (!s.images.B.url) s.setImage('B', B)
  else URL.revokeObjectURL(B.url)
}

/**
 * Restores the last session (or seeds the samples), then auto-saves on change.
 * Returns true once the initial load has settled.
 */
export function usePersistence(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    let unsub: () => void = () => {}
    let timer: ReturnType<typeof setTimeout> | undefined

    ;(async () => {
      const saved = await loadCurrentProject()
      if (cancelled) return
      if (saved) await restore(saved)
      else await loadDefaults(() => cancelled)
      if (cancelled) return

      // Begin auto-saving only AFTER the initial load, so restoring/seeding
      // doesn't immediately trigger a write.
      unsub = useProjectStore.subscribe(() => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          void saveCurrentProject(projectFromState())
        }, SAVE_DEBOUNCE_MS)
      })
      setReady(true)
    })()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      unsub()
    }
  }, [])

  return ready
}
