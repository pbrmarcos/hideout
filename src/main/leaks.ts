import { createHash } from 'node:crypto'
import type { Access, LeakResult } from '@shared/types'

/**
 * Have I Been Pwned "range" API (k-anonymity): only the first 5 hex chars of each password's
 * SHA-1 leave the computer; the comparison happens here. Padding hides how many results came back.
 */
const API = 'https://api.pwnedpasswords.com/range/'

async function range(prefix: string): Promise<Map<string, number>> {
  const r = await fetch(API + prefix, { headers: { 'Add-Padding': 'true', 'User-Agent': 'Hideout-password-manager' } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const map = new Map<string, number>()
  for (const line of (await r.text()).split('\n')) {
    const [suffix, count] = line.trim().split(':')
    const n = Number(count)
    if (suffix && n > 0) map.set(suffix.toUpperCase(), n)
  }
  return map
}

export async function checkLeaks(accesses: Access[], onProgress?: (done: number, total: number) => void): Promise<LeakResult[]> {
  const byPrefix = new Map<string, Array<{ id: string; suffix: string }>>()
  for (const a of accesses) {
    if (a.deletedAt || !a.password) continue
    const h = createHash('sha1').update(a.password, 'utf8').digest('hex').toUpperCase()
    const list = byPrefix.get(h.slice(0, 5)) ?? []
    list.push({ id: a.id, suffix: h.slice(5) })
    byPrefix.set(h.slice(0, 5), list)
  }
  const prefixes = [...byPrefix.keys()]
  const found: LeakResult[] = []
  let done = 0
  const worker = async (): Promise<void> => {
    for (let p = prefixes.shift(); p; p = prefixes.shift()) {
      const hits = await range(p)
      for (const { id, suffix } of byPrefix.get(p)!) {
        const n = hits.get(suffix)
        if (n) found.push({ id, count: n })
      }
      onProgress?.(++done, byPrefix.size)
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, prefixes.length) }, worker))
  return found.sort((a, b) => b.count - a.count)
}
