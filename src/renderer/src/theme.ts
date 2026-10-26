import { themeById, type Theme } from '@shared/themes'

const kebab = (s: string): string => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)

export function applyTheme(id: string | null | undefined): Theme {
  const t = themeById(id)
  const root = document.documentElement
  for (const [k, v] of Object.entries(t)) {
    if (typeof v === 'string' && k !== 'id' && k !== 'name') root.style.setProperty(`--hx-${kebab(k)}`, v)
  }
  root.classList.toggle('dark', t.dark)
  root.classList.toggle('mono', t.mono)
  root.dataset.theme = t.id
  return t
}
