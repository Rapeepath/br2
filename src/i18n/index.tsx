import { createContext, useCallback, useContext, type ReactNode } from 'react'
import { en } from './en'
import { th, type DictKey } from './th'

export type Lang = 'th' | 'en'
export type { DictKey }

/** The English mirror lives under /en; Thai is the root. */
export const EN_PREFIX = '/en'

const DICTS: Record<Lang, Record<DictKey, string>> = { th, en }

/** Which language a full URL path belongs to. */
export const langOfPath = (pathname: string): Lang =>
  pathname === EN_PREFIX || pathname.startsWith(`${EN_PREFIX}/`) ? 'en' : 'th'

/** The path inside the language root: "/en/models/x" → "/models/x", "/en" → "/". */
export const stripLang = (pathname: string): string => {
  if (langOfPath(pathname) === 'th') return pathname || '/'
  return pathname.slice(EN_PREFIX.length) || '/'
}

/** A full URL path for an in-language path: ("/compare", "en") → "/en/compare", ("/", "en") → "/en". */
export const localePath = (path: string, lang: Lang): string => {
  const p = path.startsWith('/') ? path : `/${path}`
  if (lang === 'th') return p
  return p === '/' ? EN_PREFIX : `${EN_PREFIX}${p}`
}

/** Fills `{name}` placeholders. */
export function translate(lang: Lang, key: DictKey, vars?: Record<string, string | number>): string {
  const s = DICTS[lang][key] ?? th[key]
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : s
}

const LangContext = createContext<Lang>('th')

/** Set once at the top of the app from the URL (the router's basename carries the same prefix). */
export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>
}

export const useLang = (): Lang => useContext(LangContext)

/** `const t = useT(); t('nav.models')` */
export function useT() {
  const lang = useLang()
  return useCallback((key: DictKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang])
}
