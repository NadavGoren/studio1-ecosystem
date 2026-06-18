import { Header } from './components/Header'
import { StepIndicator } from './components/StepIndicator'
import { ImageUploadPanel } from './components/ImageUploadPanel'
import { ControlsPanel } from './components/ControlsPanel'
import { DimensionsPanel } from './components/DimensionsPanel'
import { ExportPanel } from './components/ExportPanel'
import { PreviewPanel } from './components/PreviewPanel'
import { CollapsibleSection } from './components/CollapsibleSection'
import { TriangleProfile } from './components/TriangleProfile'
import { useLanguage } from './i18n/LanguageProvider'
import { usePersistence } from './hooks/usePersistence'

function App() {
  const { t } = useLanguage()

  // Restore the last session (or seed the sample images), then auto-save.
  usePersistence()

  return (
    <div className="flex h-full flex-col bg-neutral-50 text-neutral-900 lg:overflow-hidden">
      <Header />

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-5 px-4 py-5 sm:px-6 lg:min-h-0">
        <StepIndicator />

        {/* On desktop each column scrolls on its own, so a control (e.g. slices)
            stays in view while you scroll the previews — and vice versa. */}
        <div className="grid flex-1 grid-cols-1 gap-5 lg:min-h-0 lg:grid-cols-[minmax(320px,360px)_1fr]">
          {/* Controls — each concern in its own labelled, collapsible card. */}
          <aside
            aria-label={t('shell.controlsTitle')}
            className="flex flex-col gap-4 lg:min-h-0 lg:overflow-y-auto lg:pb-1 lg:pe-1 lg:[&>*]:shrink-0"
          >
            <ControlsPanel />
            <CollapsibleSection
              title={t('dims.title')}
              description={t('section.dimensionsDesc')}
            >
              <DimensionsPanel />
            </CollapsibleSection>
            <CollapsibleSection
              title={t('export.title')}
              description={t('export.hint')}
              defaultOpen
            >
              <ExportPanel />
            </CollapsibleSection>
          </aside>

          {/* Visuals — the two photos, the live 3D, and the print sheet together,
              so every change is seen immediately across all of them. */}
          <div
            aria-label={t('shell.previewTitle')}
            className="flex flex-col gap-4 lg:min-h-0 lg:overflow-y-auto lg:pb-1 lg:pe-1 lg:[&>*]:shrink-0"
          >
            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
              <ImageUploadPanel />
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-3">
                <h2 className="text-base font-semibold text-neutral-900">
                  {t('section.livePreview')}
                </h2>
                <p className="text-sm text-neutral-500">
                  {t('section.livePreviewDesc')}
                </p>
              </div>
              <PreviewPanel />
            </section>

            <CollapsibleSection
              title={t('profile.title')}
              description={t('section.profileDesc')}
              defaultOpen
            >
              <TriangleProfile />
            </CollapsibleSection>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
