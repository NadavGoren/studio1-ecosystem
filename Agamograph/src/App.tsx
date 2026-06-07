import { Header } from './components/Header'
import { StepIndicator } from './components/StepIndicator'
import { ImageUploadPanel } from './components/ImageUploadPanel'
import { ControlsPanel } from './components/ControlsPanel'
import { DimensionsPanel } from './components/DimensionsPanel'
import { ExportPanel } from './components/ExportPanel'
import { PreviewPanel } from './components/PreviewPanel'
import { useLanguage } from './i18n/LanguageProvider'
import { usePersistence } from './hooks/usePersistence'

function App() {
  const { t } = useLanguage()

  // Restore the last session (or seed the sample images), then auto-save.
  usePersistence()

  return (
    <div className="flex h-full flex-col bg-neutral-50 text-neutral-900">
      <Header />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-6">
        <StepIndicator />

        <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(420px,1fr)_1fr]">
          {/* Left: upload/crop + settings */}
          <section
            aria-label={t('shell.controlsTitle')}
            className="flex flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <ImageUploadPanel />
            <hr className="border-neutral-100" />
            <ControlsPanel />
            <hr className="border-neutral-100" />
            <DimensionsPanel />
            <hr className="border-neutral-100" />
            <ExportPanel />
          </section>

          {/* Right: live previews */}
          <section
            aria-label={t('shell.previewTitle')}
            className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <PreviewPanel />
          </section>
        </div>
      </main>
    </div>
  )
}

export default App
