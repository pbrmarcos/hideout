import { themeById, type CustomId, type Theme } from '@shared/themes'
import type { CustomTheme } from '@shared/types'

const kebab = (s: string): string => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)

export function applyTheme(id: string | null | undefined, custom: Partial<Record<CustomId, CustomTheme>> = {}): Theme {
  return paint(themeById(id, custom))
}

/** Writes a theme's colors to <html> (also used for the live preview while editing). */
export function paint(t: Theme): Theme {
  const root = document.documentElement
  for (const [k, v] of Object.entries(t)) {
    if (typeof v === 'string' && k !== 'id' && k !== 'name') root.style.setProperty(`--hx-${kebab(k)}`, v)
  }
  root.classList.toggle('dark', t.dark)
  root.classList.toggle('mono', t.mono)
  root.dataset.theme = t.id
  return t
}
