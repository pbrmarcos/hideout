/** A tiny markdown subset rendered as data (never as HTML): headings, bullets, checklists, **bold**, *italic*. */
export interface Span {
  text: string
  bold: boolean
  italic: boolean
}

export type Block =
  | { kind: 'h'; spans: Span[] }
  | { kind: 'check'; done: boolean; spans: Span[]; line: number }
  | { kind: 'bullet'; spans: Span[] }
  | { kind: 'p'; spans: Span[] }
  | { kind: 'gap' }

export function inline(text: string): Span[] {
  const out: Span[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index), bold: false, italic: false })
    const bold = m[0].startsWith('**')
    out.push({ text: m[0].slice(bold ? 2 : 1, bold ? -2 : -1), bold, italic: !bold })
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false, italic: false })
  return out
}

export function parse(body: string): Block[] {
  return body.split('\n').map((line, i): Block => {
    const check = line.match(/^\s*[-*] \[( |x|X)\] (.*)$/)
    if (check) return { kind: 'check', done: check[1] !== ' ', spans: inline(check[2]), line: i }
    if (/^#{1,3} /.test(line)) return { kind: 'h', spans: inline(line.replace(/^#{1,3} /, '')) }
    if (/^\s*[-*] /.test(line)) return { kind: 'bullet', spans: inline(line.replace(/^\s*[-*] /, '')) }
    if (!line.trim()) return { kind: 'gap' }
    return { kind: 'p', spans: inline(line) }
  })
}

export function toggleLine(body: string, line: number): string {
  const lines = body.split('\n')
  lines[line] = lines[line].replace(/\[( |x|X)\]/, (m) => (m === '[ ]' ? '[x]' : '[ ]'))
  return lines.join('\n')
}

export function progress(body: string): { done: number; total: number } {
  const all = body.match(/^\s*[-*] \[( |x|X)\] /gm) ?? []
  return { done: all.filter((x) => /\[(x|X)\]/.test(x)).length, total: all.length }
}

export function preview(body: string): string {
  return body
    .split('\n')
    .map((l) => l.replace(/^\s*[-*] \[( |x|X)\] /, '').replace(/^#{1,3} /, '').replace(/^\s*[-*] /, '').replace(/\*+/g, ''))
    .filter((l) => l.trim())
    .join('. ')
    .replace(/([.!?:])\. /g, '$1 ')
}
