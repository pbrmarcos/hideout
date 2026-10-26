import type { CustomTheme, ThemeId } from './types'

export interface Theme {
  id: ThemeId
  name: string
  dark: boolean
  mono: boolean
  bg: string
  surface: string
  ink: string
  muted: string
  line: string
  tab: string
  primary: string
  onPrimary: string
  soft: string
  softInk: string
  dot: string
  warn: string
  warnSoft: string
  danger: string
  dangerSoft: string
  glow: string
}

const lightStatus = { warn: '#8A4B12', warnSoft: '#F5E7D6', danger: '#A33A3A', dangerSoft: '#F6E4E4', glow: 'none' }

export const THEMES: Theme[] = [
  { id: 'salvia', name: 'Sálvia', dark: false, mono: false, bg: '#EDF1EC', surface: '#F8FAF7', ink: '#1E2722', muted: '#56645B', line: '#DCE3DD', tab: '#E1E7E1', primary: '#47705A', onPrimary: '#FFFFFF', soft: '#DDE9E0', softInk: '#2F5843', dot: '#47705A', ...lightStatus },
  { id: 'lavanda', name: 'Lavanda', dark: false, mono: false, bg: '#EFEDF6', surface: '#FAF9FD', ink: '#24212F', muted: '#5E5872', line: '#E0DCEB', tab: '#E3E0EE', primary: '#6A5BA3', onPrimary: '#FFFFFF', soft: '#E6E1F4', softInk: '#4A3F80', dot: '#6A5BA3', ...lightStatus },
  { id: 'areia', name: 'Areia', dark: false, mono: false, bg: '#F1ECE4', surface: '#FBF8F3', ink: '#2A251D', muted: '#675D4E', line: '#E4DCCF', tab: '#E7E0D4', primary: '#7A6236', onPrimary: '#FFFFFF', soft: '#EDE3CF', softInk: '#5C4A26', dot: '#7A6236', ...lightStatus },
  { id: 'nevoa', name: 'Névoa', dark: false, mono: false, bg: '#EAEFF4', surface: '#F7F9FC', ink: '#1C2633', muted: '#546375', line: '#D9E1EA', tab: '#DEE5EC', primary: '#476A8E', onPrimary: '#FFFFFF', soft: '#DCE6F1', softInk: '#2E4D6E', dot: '#476A8E', ...lightStatus },
  { id: 'noite', name: 'Noite', dark: true, mono: false, bg: '#171C21', surface: '#1F252C', ink: '#E4E9EE', muted: '#9AA7B4', line: '#2E363F', tab: '#232A31', primary: '#8DBBA0', onPrimary: '#10241A', soft: '#2A3A33', softInk: '#B5D6C2', dot: '#8DBBA0', warn: '#E3B07A', warnSoft: '#3A2E22', danger: '#F09A9A', dangerSoft: '#3A2626', glow: 'none' },
  { id: 'oceano', name: 'Oceano', dark: false, mono: false, bg: '#F5F7FA', surface: '#FBFCFE', ink: '#0B1B33', muted: '#5C6B80', line: '#D8DFE8', tab: '#E3E9F0', primary: '#0077C8', onPrimary: '#FFFFFF', soft: '#DDEEFA', softInk: '#0D213A', dot: '#0094EC', ...lightStatus, glow: '0 0 0 2px #00D7EC' },
  { id: 'rubi', name: 'Rubi', dark: false, mono: false, bg: '#F6EEEE', surface: '#FCF8F8', ink: '#2A1A1B', muted: '#6E5557', line: '#EBDCDD', tab: '#EEE1E2', primary: '#B4232F', onPrimary: '#FFFFFF', soft: '#F6DEDF', softInk: '#8E1C26', dot: '#B4232F', ...lightStatus, danger: '#7E1420' },
  { id: 'matrix', name: 'Matrix', dark: true, mono: true, bg: '#050A06', surface: '#0B140D', ink: '#C8FFD4', muted: '#6FBF84', line: '#163A1E', tab: '#0F1E12', primary: '#00FF41', onPrimary: '#001A07', soft: '#0F2A16', softInk: '#39FF6A', dot: '#00FF41', warn: '#FFD166', warnSoft: '#2A2A0F', danger: '#FF6B6B', dangerSoft: '#2A1212', glow: '0 0 12px rgba(0,255,65,.55)' }
]

export const CUSTOM_IDS = ['custom1', 'custom2', 'custom3'] as const
export type CustomId = (typeof CUSTOM_IDS)[number]

export function themeById(id: string | undefined | null, custom: Partial<Record<CustomId, CustomTheme>> = {}): Theme {
  if (id && (CUSTOM_IDS as readonly string[]).includes(id)) {
    const c = custom[id as CustomId]
    if (c) return completeTheme(id as CustomId, c)
  }
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

// --- colors ----------------------------------------------------------------------

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

export function normalizeHex(v: string): string | null {
  const m = v.trim().match(HEX)
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  return `#${h.toUpperCase()}`
}

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two hex colors (1 to 21). */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** Mixes `a` into `b`; amount 0 = b, 1 = a. */
export function mix(a: string, b: string, amount: number): string {
  const [ra, ga, ba] = rgb(a), [rb, gb, bb] = rgb(b)
  const c = (x: number, y: number): string => Math.round(x * amount + y * (1 - amount)).toString(16).padStart(2, '0')
  return `#${c(ra, rb)}${c(ga, gb)}${c(ba, bb)}`.toUpperCase()
}

/** Fills the colors a custom theme does not set (tabs, dots, soft status backgrounds). */
export function completeTheme(id: CustomId, c: CustomTheme): Theme {
  return {
    id,
    name: c.name || 'Personalizado',
    dark: c.dark,
    mono: c.mono,
    bg: c.bg,
    surface: c.surface,
    ink: c.ink,
    muted: c.muted,
    line: c.line,
    tab: mix(c.ink, c.bg, 0.06),
    primary: c.primary,
    onPrimary: c.onPrimary,
    soft: c.soft,
    softInk: c.softInk,
    dot: c.primary,
    warn: c.warn,
    warnSoft: mix(c.warn, c.surface, 0.16),
    danger: c.danger,
    dangerSoft: mix(c.danger, c.surface, 0.14),
    glow: 'none'
  }
}

export function customFrom(t: Theme, name: string): CustomTheme {
  const { dark, mono, bg, surface, ink, muted, line, primary, onPrimary, soft, softInk, warn, danger } = t
  return { name, dark, mono, bg, surface, ink, muted, line, primary, onPrimary, soft, softInk, warn, danger }
}

/** Editable colors, in the order shown to the user. Code keys stay in English so any AI can fill them. */
export const COLOR_KEYS = ['bg', 'surface', 'ink', 'muted', 'line', 'primary', 'onPrimary', 'soft', 'softInk', 'warn', 'danger'] as const
export type ColorKey = (typeof COLOR_KEYS)[number]

/** Plain-text theme code: one `key: value` per line, easy to paste into or out of an AI chat. */
export function themeToCode(c: CustomTheme): string {
  return [
    '# Hideout theme',
    `name: ${c.name}`,
    `dark: ${c.dark ? 'yes' : 'no'}`,
    `mono: ${c.mono ? 'yes' : 'no'}`,
    ...COLOR_KEYS.map((k) => `${k}: ${c[k]}`)
  ].join('\n')
}

const ALIASES: Record<string, keyof CustomTheme> = {
  name: 'name', nome: 'name', nombre: 'name',
  dark: 'dark', escuro: 'dark', oscuro: 'dark',
  mono: 'mono',
  bg: 'bg', background: 'bg', fundo: 'bg', fondo: 'bg',
  surface: 'surface', superficie: 'surface', 'superfície': 'surface',
  ink: 'ink', text: 'ink', texto: 'ink',
  muted: 'muted', secondary: 'muted', secundario: 'muted', 'secundário': 'muted',
  line: 'line', lines: 'line', border: 'line', linha: 'line', 'línea': 'line', linea: 'line',
  primary: 'primary', accent: 'primary', destaque: 'primary', 'acento': 'primary',
  onprimary: 'onPrimary', 'on-primary': 'onPrimary', 'on_primary': 'onPrimary',
  soft: 'soft', softink: 'softInk', 'soft-ink': 'softInk', 'soft_ink': 'softInk',
  warn: 'warn', warning: 'warn', aviso: 'warn',
  danger: 'danger', error: 'danger', perigo: 'danger', peligro: 'danger'
}

/**
 * Reads a theme from text: `key: value` lines (any order, comments allowed) or JSON.
 * Unknown keys are ignored; missing colors keep the values from `base`.
 */
export function parseThemeCode(text: string, base: CustomTheme): { theme: CustomTheme; read: number; errors: string[] } {
  const out: CustomTheme = { ...base }
  const errors: string[] = []
  let read = 0
  let pairs: Array<[string, string]> = []
  const json = text.match(/\{[\s\S]*\}/)
  if (json) {
    try {
      pairs = Object.entries(JSON.parse(json[0])).map(([k, v]) => [k, String(v)])
    } catch {
      /* not JSON: fall back to lines */
    }
  }
  if (!pairs.length) {
    pairs = text.split(/\r?\n/).map((l) => l.replace(/^[\s>*`-]+|[`,;]+$/g, '')).filter((l) => /^[^#].*[:=]/.test(l)).map((l) => {
      const i = l.search(/[:=]/)
      return [l.slice(0, i), l.slice(i + 1)] as [string, string]
    })
  }
  for (const [rawKey, rawValue] of pairs) {
    const key = ALIASES[rawKey.trim().replace(/["']/g, '').toLowerCase()]
    const value = rawValue.trim().replace(/^["']|["']$/g, '')
    if (!key) continue
    if (key === 'name') out.name = value.slice(0, 30) || out.name
    else if (key === 'dark' || key === 'mono') out[key] = /^(yes|sim|si|sí|true|1)$/i.test(value)
    else {
      const hex = normalizeHex(value)
      if (hex) out[key] = hex
      else errors.push(`${rawKey.trim()}: ${value}`)
    }
    read++
  }
  return { theme: out, read, errors }
}
