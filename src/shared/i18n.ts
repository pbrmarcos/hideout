import type { Lang } from './types'
import en from './locales/en'
import es from './locales/es'

/**
 * Portuguese text is the key; en/es dictionaries map it to translations.
 * Placeholders look like {name} and are filled from `params`.
 */
const DICTS: Record<Exclude<Lang, 'pt'>, Record<string, string>> = { en, es }

export const LANGS: Array<{ id: Lang; label: string; locale: string }> = [
  { id: 'pt', label: 'Português', locale: 'pt-BR' },
  { id: 'en', label: 'English', locale: 'en-US' },
  { id: 'es', label: 'Español', locale: 'es-ES' }
]

export type Params = Record<string, string | number>

export function translate(lang: Lang, pt: string, params?: Params): string {
  const s = lang === 'pt' ? pt : (DICTS[lang][pt] ?? pt)
  return params ? s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m)) : s
}

export function langFromLocale(locale: string | undefined): Lang {
  const l = (locale ?? '').slice(0, 2).toLowerCase()
  return l === 'en' || l === 'es' || l === 'pt' ? (l as Lang) : 'en'
}

export function localeOf(lang: Lang): string {
  return LANGS.find((l) => l.id === lang)?.locale ?? 'pt-BR'
}

/** Language used by the main process (notifications, tray, error messages). */
let current: Lang = 'pt'
export function setMainLang(lang: Lang): void {
  current = lang
}
export function tr(pt: string, params?: Params): string {
  return translate(current, pt, params)
}

/** Every string in the dictionaries, for the completeness test. */
export function dictionaries(): Record<string, Record<string, string>> {
  return DICTS
}
