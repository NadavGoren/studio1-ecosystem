/** Loading uploaded image files — validation + reading natural dimensions. */

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const ACCEPTED_ACCEPT_ATTR = ACCEPTED_TYPES.join(',')

export type LoadedImage = {
  blob: Blob
  url: string
  natW: number
  natH: number
}

export class UnsupportedImageError extends Error {}

/**
 * Validate + decode an uploaded file. Keeps the ORIGINAL file as the blob (full
 * resolution is needed for export — see technical-spec §6); the returned object
 * URL is for on-screen display. Caller owns revoking the URL.
 */
export async function loadImageFile(file: File): Promise<LoadedImage> {
  if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) {
    throw new UnsupportedImageError(file.type || 'unknown')
  }
  const url = URL.createObjectURL(file)
  try {
    const { natW, natH } = await readDimensions(url)
    return { blob: file, url, natW, natH }
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
}

function readDimensions(url: string): Promise<{ natW: number; natH: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ natW: img.naturalWidth, natH: img.naturalHeight })
    img.onerror = () => reject(new Error('Could not decode image'))
    img.src = url
  })
}
