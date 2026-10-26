import { hostOf } from '@shared/model'
import type { Access } from '@shared/types'

const BROWSER_SUFFIX = /\s[-–—]\s(google chrome|microsoft\W{0,2}edge|mozilla firefox|brave|opera|vivaldi)$/i

function words(s: string): string[] {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length >= 3)
}

/** Accesses whose site or name appears in the foreground window title, best first. */
export function matchWindow(title: string, accesses: Access[]): Access[] {
  const clean = title.replace(BROWSER_SUFFIX, '')
  const titleWords = new Set(words(clean))
  const lower = clean.toLowerCase()
  const scored = accesses
    .filter((a) => !a.deletedAt && (a.password || a.username))
    .map((a) => {
      let score = 0
      const host = hostOf(a.url)
      if (host && lower.includes(host)) score += 10
      const brand = host.split('.').slice(-3, -1).find((p) => p.length >= 3 && !['com', 'org', 'net', 'gov'].includes(p))
      if (brand && titleWords.has(brand)) score += 6
      const tw = words(a.title)
      if (tw.length && tw.every((w) => titleWords.has(w))) score += 5
      else if (tw.some((w) => w.length >= 4 && titleWords.has(w))) score += 2
      return { a, score }
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
  return scored.map((x) => x.a)
}
