import { hostOf } from '@shared/model'
import type { Access } from '@shared/types'

const BROWSER_SUFFIX = /\s[-–—]\s(google chrome|microsoft\W{0,2}edge|mozilla firefox|brave|opera|vivaldi)$/i

/**
 * Words that say nothing about which site it is: login pages, browser profile names ("Pessoal", "Perfil 1")
 * and Edge's "e mais 2 páginas". Without this, "Fazer login" matched every access named login.something.
 */
const GENERIC = new Set(
  ('login logon signin sign entrar entre acessar acesso conta contas account accounts minha meu fazer iniciar sessao session ' +
    'pagina paginas page pages home inicio welcome bem vindo vinda portal online web app www http https com net org gov ' +
    'senha password auth secure seguro area cliente clientes usuario user mais more and pessoal perfil profile trabalho work ' +
    'nova novo new guia tab').split(' ')
)

function words(s: string): string[] {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !GENERIC.has(w))
}

/** Accesses whose site or name appears in the foreground window title, best first. */
export function matchWindow(title: string, accesses: Access[]): Access[] {
  return scoreWindow(title, accesses).map((x) => x.a)
}

/**
 * The access to type without asking: the only match, or one that clearly beats the rest
 * ("Banco Aurora" over "Banco Inter" on a "Banco Aurora" page). Otherwise null, and the user picks.
 */
export function sureMatch(title: string, accesses: Access[]): Access | null {
  const [best, next] = scoreWindow(title, accesses)
  if (!best) return null
  return !next || best.score - next.score >= 3 ? best.a : null
}

function scoreWindow(title: string, accesses: Access[]): Array<{ a: Access; score: number }> {
  const clean = title.replace(BROWSER_SUFFIX, '')
  const titleWords = new Set(words(clean))
  const lower = clean.toLowerCase()
  const scored = accesses
    .filter((a) => !a.deletedAt && (a.password || a.username))
    .map((a) => {
      let score = 0
      const host = hostOf(a.url)
      if (host && lower.includes(host)) score += 10
      // The name right before the domain ending: login.microsoft.com -> microsoft, internetbanking.bancointer.com.br -> bancointer.
      const brand = host.split('.').slice(-3, -1).reverse().find((p) => p.length >= 3 && !GENERIC.has(p))
      if (brand && titleWords.has(brand)) score += 6
      const tw = words(a.title)
      if (tw.length && tw.every((w) => titleWords.has(w))) score += 5
      else if (tw.some((w) => w.length >= 4 && titleWords.has(w))) score += 2
      return { a, score }
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
  return scored
}
