import type { CsvRow } from '@shared/types'

/** RFC 4180 parser (quotes, escaped quotes, newlines inside fields). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some((c) => c !== '')) rows.push(row)
  return rows
}

/** Chrome / Edge / Brave export: name,url,username,password,note (order may vary). */
export function parseBrowserPasswords(text: string): CsvRow[] {
  const [header, ...rows] = parseCsv(text)
  if (!header) return []
  const col = (names: string[]): number => header.findIndex((h) => names.includes(h.trim().toLowerCase()))
  const idx = {
    name: col(['name', 'title', 'nome']),
    url: col(['url', 'login_uri', 'website', 'site']),
    username: col(['username', 'login_username', 'usuario', 'usuário', 'login']),
    password: col(['password', 'login_password', 'senha']),
    note: col(['note', 'notes', 'extra', 'observacoes', 'observações'])
  }
  if (idx.password < 0) throw new Error('Não encontrei a coluna de senha neste CSV.')
  const get = (r: string[], i: number): string => (i >= 0 ? (r[i] ?? '').trim() : '')
  return rows
    .map((r) => ({ name: get(r, idx.name), url: get(r, idx.url), username: get(r, idx.username), password: get(r, idx.password), note: get(r, idx.note) }))
    .filter((r) => r.password || r.username)
}
