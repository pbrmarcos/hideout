const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const DIGITS = '0123456789'
const SYMBOLS = '!@#$%&*?-_=+'
const AMBIGUOUS = /[O0Il1|]/g

export interface GenOptions {
  length: number
  upper: boolean
  digits: boolean
  symbols: boolean
  noAmbiguous: boolean
}

/** Unbiased random integer in [0, n). */
function randInt(n: number): number {
  const buf = new Uint32Array(1)
  const limit = Math.floor(0x1_0000_0000 / n) * n
  do crypto.getRandomValues(buf)
  while (buf[0] >= limit)
  return buf[0] % n
}

const pick = (set: string): string => set[randInt(set.length)]

export function generate(o: GenOptions): string {
  const clean = (s: string): string => (o.noAmbiguous ? s.replace(AMBIGUOUS, '') : s)
  const groups = [clean(LOWER), o.upper && clean(UPPER), o.digits && clean(DIGITS), o.symbols && SYMBOLS].filter(Boolean) as string[]
  const all = groups.join('')
  const chars = groups.map(pick)
  while (chars.length < o.length) chars.push(pick(all))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

/** 0–4, a rough entropy estimate good enough for a meter. */
export function strength(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: '' }
  let pool = 0
  if (/[a-z]/.test(pw)) pool += 26
  if (/[A-Z]/.test(pw)) pool += 26
  if (/\d/.test(pw)) pool += 10
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 20
  let bits = pw.length * Math.log2(Math.max(pool, 1))
  if (/(.)\1{2,}/.test(pw)) bits -= 10
  if (/^(senha|password|123456|qwerty|admin)/i.test(pw)) bits = Math.min(bits, 20)
  const score = bits < 36 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4
  return { score, label: ['', 'Fraca', 'Razoável', 'Forte', 'Muito forte'][score] }
}
