import { useLanguage } from '../i18n/LanguageProvider'
import { clearCurrentProject } from '../lib/projectStore'

export function Header() {
  const { t } = useLanguage()

  async function startOver() {
    if (!window.confirm(t('app.startOverConfirm'))) return
    await clearCurrentProject()
    location.reload()
  }

  return (
    <header className="border-b border-neutral-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-baseline gap-3 px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight text-neutral-900">
          {t('app.title')}
        </h1>
        <p className="hidden text-sm text-neutral-500 sm:block">
          {t('app.tagline')}
        </p>
        <button
          type="button"
          onClick={startOver}
          className="ms-auto self-center rounded-md border border-neutral-200 px-3 py-1 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
        >
          {t('app.startOver')}
        </button>
      </div>
    </header>
  )
}
