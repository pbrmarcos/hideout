import { localeOf, translate } from '@shared/i18n'
import { langState } from './langState'

const tx = (pt: string, params?: Record<string, string | number>): string => translate(langState.lang, pt, params)
const loc = (): string => localeOf(langState.lang)

export const NOTE_COLORS = [
  { id: 'sage', hex: '#8DB59B', label: 'Verde' },
  { id: 'mist', hex: '#9FB3CF', label: 'Azul' },
  { id: 'lav', hex: '#B9A9DA', label: 'Lilás' },
  { id: 'sand', hex: '#D7BE8E', label: 'Areia' },
  { id: 'rose', hex: '#DBA3A3', label: 'Rosa' },
  { id: 'gray', hex: '#C9D2CB', label: 'Cinza' },
  { id: 'sky', hex: '#8EC5E8', label: 'Céu' },
  { id: 'mint', hex: '#9ED9C3', label: 'Menta' },
  { id: 'lemon', hex: '#E6D57E', label: 'Amarelo' },
  { id: 'peach', hex: '#F1B98C', label: 'Pêssego' },
  { id: 'coral', hex: '#E8968A', label: 'Coral' },
  { id: 'orchid', hex: '#D3A4D6', label: 'Orquídea' }
]

const dayStart = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
const DAY = 86_400_000

export function time(iso: string): string {
  return new Date(iso).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' })
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
const weekday = (d: Date): string => cap(d.toLocaleDateString(loc(), { weekday: 'short' }).replace('.', ''))
const dayMonth = (d: Date): string => d.toLocaleDateString(loc(), { day: 'numeric', month: 'short' }).replace('.', '').replace(' de ', ' ')

/** "Hoje, 10:42", "Ontem", "Sex, 18:05", "22 out" (in the UI language). */
export function relDate(iso: string): string {
  const d = new Date(iso)
  const diff = (dayStart(new Date()) - dayStart(d)) / DAY
  if (diff === 0) return tx('Hoje, {time}', { time: time(iso) })
  if (diff === 1) return tx('Ontem')
  if (diff > 1 && diff < 7) return `${weekday(d)}, ${time(iso)}`
  return dayMonth(d)
}

/** Due dates: "Ontem, 18:00", "14:00" (today), "Amanhã, 09:00", "Sáb, 1 nov, 08:30". */
export function dueLabel(iso: string): string {
  const d = new Date(iso)
  const diff = (dayStart(d) - dayStart(new Date())) / DAY
  if (diff === 0) return time(iso)
  if (diff === -1) return tx('Ontem, {time}', { time: time(iso) })
  if (diff === 1) return tx('Amanhã, {time}', { time: time(iso) })
  return `${weekday(d)}, ${dayMonth(d)}, ${time(iso)}`
}

export const REPEAT_LABEL: Record<string, string> = { none: '', daily: 'Todo dia', weekly: 'Toda semana', monthly: 'Todo mês' }

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null
}

// --- quick add: understands Portuguese, English and Spanish -----------------------------

const TODAY = ['hoje', 'today', 'hoy']
const TOMORROW = ['amanhã', 'amanha', 'tomorrow', 'mañana', 'manana']
/** Index = Date.getDay() (0 = Sunday). */
const WEEKDAYS: string[][] = [
  ['domingo', 'sunday'],
  ['segunda', 'segunda-feira', 'monday', 'lunes'],
  ['terça', 'terca', 'terça-feira', 'tuesday', 'martes'],
  ['quarta', 'quarta-feira', 'wednesday', 'miércoles', 'miercoles'],
  ['quinta', 'quinta-feira', 'thursday', 'jueves'],
  ['sexta', 'sexta-feira', 'friday', 'viernes'],
  ['sábado', 'sabado', 'saturday']
]
const CONNECTORS = /\s(?:às|as|at|a las|a la|on|no|na|el)(?=\s*$)/i

function removeWord(text: string, word: string): string {
  return text.replace(new RegExp(`(^|\\s)${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'i'), ' ')
}

/**
 * Natural-language hints in the quick-add box: "amanhã 9h", "hoje 14:30", "sexta 10h", "25/12 8h",
 * "tomorrow 9am", "friday 2:30pm", "12/25 8am", "mañana 9h", "viernes 10:30".
 * Returns the title without the date words, and the parsed due date.
 */
export function parseQuick(input: string): { title: string; due: string | null } {
  let text = ` ${input} `
  const lower = text.toLowerCase()
  const now = new Date()
  let day: Date | null = null
  let explicitDay = false
  const has = (w: string): boolean => new RegExp(`(^|\\s)${w}(?=\\s|$)`, 'i').test(lower)

  const today = TODAY.find(has)
  const tomorrow = TOMORROW.find(has)
  if (today) {
    day = new Date(now); explicitDay = true; text = removeWord(text, today)
  } else if (tomorrow) {
    day = new Date(now.getTime() + DAY); explicitDay = true; text = removeWord(text, tomorrow)
  } else {
    const wd = WEEKDAYS.findIndex((names) => names.some(has))
    if (wd >= 0) {
      day = new Date(now)
      day.setDate(now.getDate() + ((wd - now.getDay() + 7) % 7 || 7))
      explicitDay = true
      text = removeWord(text, WEEKDAYS[wd].find(has)!)
    }
    // Numeric date: d/m in Portuguese and Spanish, m/d in English.
    const dm = text.match(/\s(\d{1,2})\/(\d{1,2})(?=\s)/)
    if (dm) {
      const [a, b] = [Number(dm[1]), Number(dm[2])]
      const [dd, mm] = langState.lang === 'en' ? [b, a] : [a, b]
      day = new Date(now.getFullYear(), mm - 1, dd)
      if (day.getTime() < dayStart(now)) day.setFullYear(now.getFullYear() + 1)
      explicitDay = true
      text = text.replace(dm[0], ' ')
    }
  }

  // Times: 9h, 9h30, 14:30, 9am, 2:30pm
  const tm = text.match(/\s(\d{1,2})(?::(\d{2})|h(\d{2})?|\s?(am|pm))(?:\s?(am|pm))?(?=\s)/i)
  if (tm) {
    let hours = Number(tm[1])
    const minutes = Number(tm[2] ?? tm[3] ?? 0)
    const ampm = (tm[4] ?? tm[5])?.toLowerCase()
    if (ampm === 'pm' && hours < 12) hours += 12
    if (ampm === 'am' && hours === 12) hours = 0
    day = day ?? new Date(now)
    day.setHours(hours, minutes, 0, 0)
    // "9h" with no day that already passed today means tomorrow.
    if (!explicitDay && day.getTime() < now.getTime()) day.setDate(day.getDate() + 1)
    text = text.replace(tm[0], ' ')
  } else if (day) day.setHours(9, 0, 0, 0)

  const title = text.replace(CONNECTORS, ' ').replace(/\s+/g, ' ').trim()
  return { title, due: day ? day.toISOString() : null }
}

/** Timer display: "15:00", "1:05:30". Seconds round up so it never shows 0:00 while running. */
export function clock(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000)
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60
  const p = (n: number): string => String(n).padStart(2, '0')
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`
}

/** Typed timer length: "25" (minutes), "25:30", "1:30:00", "1h30", "90s", "2h". */
export function parseDuration(input: string): number | null {
  const v = input.trim().toLowerCase().replace(/\s+/g, '').replace(',', '.')
  if (!v) return null
  let ms: number
  if (/^\d+(\.\d+)?$/.test(v)) ms = Number(v) * 60_000
  else if (/^\d+(:\d{1,2}){1,2}$/.test(v)) {
    const parts = v.split(':').map(Number)
    if (parts.slice(1).some((n) => n > 59)) return null
    const [h, m, s] = parts.length === 3 ? parts : [0, ...parts]
    ms = ((h * 60 + m) * 60 + s) * 1000
  } else {
    // "1h30" is 1 h 30 min and "5m30" is 5 min 30 s: a bare number takes the next smaller unit.
    const tokens = [...v.matchAll(/(\d+)(h|min|m|s)?/g)]
    if (tokens.map((x) => x[0]).join('') !== v) return null
    const UNIT: Record<string, number> = { h: 3_600_000, min: 60_000, m: 60_000, s: 1000 }
    let prev = 0
    ms = 0
    for (const [, n, unit] of tokens) {
      const size = unit ? UNIT[unit] : prev === 3_600_000 ? 60_000 : prev === 60_000 ? 1000 : prev ? NaN : 60_000
      ms += Number(n) * size
      prev = size
    }
    if (Number.isNaN(ms)) return null
  }
  return ms >= 1000 && ms <= 24 * 3_600_000 ? Math.round(ms) : null
}
