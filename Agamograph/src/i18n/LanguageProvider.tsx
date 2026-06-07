import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import {
  activeLanguage,
  type Language,
  type LayoutDir,
  type Strings,
} from '../strings'

type LanguageContextValue = {
  lang: Language
  dir: LayoutDir
  /** Translate a key. Falls back to the key itself if missing (visible in dev). */
  t: (key: keyof Strings) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = activeLanguage

  // Keep the document's lang/dir in sync so the whole layout flips with one flag.
  useEffect(() => {
    document.documentElement.lang = lang.code
    document.documentElement.dir = lang.dir
  }, [lang])

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      dir: lang.dir,
      t: (key) => lang.strings[key] ?? (key as string),
    }),
    [lang],
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useLanguage must be used within a <LanguageProvider>')
  }
  return ctx
}

/** Convenience hook when you only need the translate function. */
export function useT(): LanguageContextValue['t'] {
  return useLanguage().t
}
