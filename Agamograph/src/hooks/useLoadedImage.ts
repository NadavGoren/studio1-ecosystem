import { useEffect, useState } from 'react'

/**
 * Load an object-URL into an HTMLImageElement for canvas drawing. Returns null
 * until ready. Re-runs when the URL changes.
 */
export function useLoadedImage(url: string | null): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!url) {
      setImg(null)
      return
    }
    let cancelled = false
    const el = new Image()
    el.onload = () => {
      if (!cancelled) setImg(el)
    }
    el.src = url
    return () => {
      cancelled = true
    }
  }, [url])

  return img
}
