import { lazy, Suspense } from 'react'
import { FlatPreview } from './FlatPreview'
import { ReconstructionPreview } from './ReconstructionPreview'
import { TriangleProfile } from './TriangleProfile'
import { useLanguage } from '../i18n/LanguageProvider'

// Lazy-load the Three.js preview so the app shell + 2D previews load fast;
// the (large) 3D engine streams in as its own chunk.
const ThreePreview = lazy(() =>
  import('./three/ThreePreview').then((m) => ({ default: m.ThreePreview })),
)

export function PreviewPanel() {
  const { t } = useLanguage()
  return (
    <div className="flex flex-col gap-6">
      <Suspense
        fallback={
          <figure className="flex flex-col gap-1.5">
            <figcaption className="text-sm font-medium text-neutral-700">
              {t('preview.3d')}
            </figcaption>
            <div className="flex h-[460px] w-full items-center justify-center rounded-lg border border-neutral-200 bg-neutral-100 text-sm text-neutral-400">
              {t('preview.3dLoading')}
            </div>
          </figure>
        }
      >
        <ThreePreview />
      </Suspense>

      <FlatPreview />

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          {t('preview.reconstructionTitle')}
        </h3>
        <div className="flex flex-col gap-4 sm:flex-row">
          <ReconstructionPreview
            slot="A"
            captionKey="preview.left"
            emptyKey="preview.needImageA"
          />
          <ReconstructionPreview
            slot="B"
            captionKey="preview.right"
            emptyKey="preview.needImageB"
          />
        </div>
      </div>

      <TriangleProfile />
    </div>
  )
}
