import { lazy, Suspense } from 'react'
import { FlatPreview } from './FlatPreview'
import { useLanguage } from '../i18n/LanguageProvider'

// Lazy-load the Three.js preview so the app shell + 2D previews load fast;
// the (large) 3D engine streams in as its own chunk.
const ThreePreview = lazy(() =>
  import('./three/ThreePreview').then((m) => ({ default: m.ThreePreview })),
)

export function PreviewPanel() {
  const { t } = useLanguage()
  return (
    // 3D and flat sheet side by side (split down the middle) so both stay in
    // view and each fills its half — stacks on narrow screens.
    <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2">
      <Suspense
        fallback={
          <figure className="flex flex-col gap-1.5">
            <figcaption className="text-sm font-medium text-neutral-700">
              {t('preview.3d')}
            </figcaption>
            <div className="flex h-[320px] w-full items-center justify-center rounded-lg border border-neutral-200 bg-neutral-100 text-sm text-neutral-400">
              {t('preview.3dLoading')}
            </div>
          </figure>
        }
      >
        <ThreePreview />
      </Suspense>

      <FlatPreview />
    </div>
  )
}
