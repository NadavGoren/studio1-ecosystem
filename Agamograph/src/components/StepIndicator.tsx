import { useLanguage } from '../i18n/LanguageProvider'
import type { Strings } from '../strings'

/** The single, clear path: Upload → Adjust → Preview → Export. */
const STEP_KEYS: (keyof Strings)[] = [
  'step.upload',
  'step.adjust',
  'step.preview',
  'step.export',
]

export function StepIndicator() {
  const { t, dir } = useLanguage()
  const arrow = dir === 'rtl' ? '←' : '→'
  return (
    <nav
      aria-label="Workflow steps"
      className="flex items-center gap-2 text-sm text-neutral-400"
    >
      {STEP_KEYS.map((key, i) => (
        <div key={key} className="flex items-center gap-2">
          {i > 0 && (
            <span aria-hidden className="text-neutral-300">
              {arrow}
            </span>
          )}
          <span className="font-medium">{t(key)}</span>
        </div>
      ))}
    </nav>
  )
}
