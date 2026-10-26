export const NOTE_COLORS = [
  { id: 'sage', hex: '#8DB59B', label: 'Verde' },
  { id: 'mist', hex: '#9FB3CF', label: 'Azul' },
  { id: 'lav', hex: '#B9A9DA', label: 'Lilás' },
  { id: 'sand', hex: '#D7BE8E', label: 'Areia' },
  { id: 'rose', hex: '#DBA3A3', label: 'Rosa' },
  { id: 'gray', hex: '#C9D2CB', label: 'Cinza' }
]

const dayStart = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
const DAY = 86_400_000

export function time(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/** "Hoje, 10:42", "Ontem", "Sex, 18:05", "22 out". */
export function relDate(iso: string): string {
  const d = new Date(iso)
  const diff = (dayStart(new Date()) - dayStart(d)) / DAY
  if (diff === 0) return `Hoje, ${time(iso)}`
  if (diff === 1) return 'Ontem'
  if (diff > 1 && diff < 7) {
    const wd = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
    return `${wd[0].toUpperCase()}${wd.slice(1)}, ${time(iso)}`
  }
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '').replace(' de ', ' ')
}

/** Due dates: "Ontem, 18:00", "14:00" (today), "Amanhã, 09:00", "Sáb, 1 nov, 08:30". */
export function dueLabel(iso: string): string {
  const d = new Date(iso)
  const diff = (dayStart(d) - dayStart(new Date())) / DAY
  if (diff === 0) return time(iso)
  if (diff === -1) return `Ontem, ${time(iso)}`
  if (diff === 1) return `Amanhã, ${time(iso)}`
  const wd = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  const day = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '').replace(' de ', ' ')
  return `${wd[0].toUpperCase()}${wd.slice(1)}, ${day}, ${time(iso)}`
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

/**
 * Natural-language hints in the quick-add box: "amanhã 9h", "hoje 14:30", "sexta 10h", "25/12 8h".
 * Returns the title without the date words, and the parsed due date.
 */
export function parseQuick(input: string): { title: string; due: string | null } {
  let text = ` ${input} `
  const now = new Date()
  let day: Date | null = null
  const lower = text.toLowerCase()
  const weekdays = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
  if (/\shoje\s/.test(lower)) { day = new Date(now); text = text.replace(/\shoje(?=\s)/i, '') }
  else if (/\samanh[ãa]\s/.test(lower)) { day = new Date(now.getTime() + DAY); text = text.replace(/\samanh[ãa](?=\s)/i, '') }
  else {
    const wd = weekdays.findIndex((w) => new RegExp(`\\s${w}(-feira)?\\s`).test(lower))
    if (wd >= 0) {
      day = new Date(now)
      const add = (wd - now.getDay() + 7) % 7 || 7
      day.setDate(now.getDate() + add)
      text = text.replace(new RegExp(`\\s${weekdays[wd]}(-feira)?(?=\\s)`, 'i'), '')
    }
    const dm = text.match(/\s(\d{1,2})\/(\d{1,2})(?=\s)/)
    if (dm) {
      day = new Date(now.getFullYear(), Number(dm[2]) - 1, Number(dm[1]))
      if (day.getTime() < dayStart(now)) day.setFullYear(now.getFullYear() + 1)
      text = text.replace(dm[0], '')
    }
  }
  const tm = text.match(/\s(?:às\s)?(\d{1,2})(?:[:h](\d{2})|h)(?=\s)/i)
  if (tm) {
    day = day ?? new Date(now)
    day.setHours(Number(tm[1]), Number(tm[2] ?? 0), 0, 0)
    if (day.getTime() < now.getTime() && !/hoje/i.test(input)) {
      if (!/\d{1,2}\/\d{1,2}/.test(input) && !weekdays.some((w) => input.toLowerCase().includes(w)) && !/amanh/i.test(input)) day.setDate(day.getDate() + 1)
    }
    text = text.replace(tm[0], '')
  } else if (day) day.setHours(9, 0, 0, 0)
  return { title: text.replace(/\s+/g, ' ').trim(), due: day ? day.toISOString() : null }
}
