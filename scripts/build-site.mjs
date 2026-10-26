// Builds the GitHub Pages site: renders site/*.html templates in pt (/), en (/en/) and es (/es/),
// with translated text, hreflang/canonical/OG metadata, JSON-LD, sitemap and share images.
// Usage: node scripts/build-site.mjs [--og]   (--og also re-renders the 1200x630 share images)
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = join(ROOT, 'site')
const OUT = join(ROOT, 'docs')
const BASE = 'https://pbrmarcos.github.io/hideout/'
const REPO = 'pbrmarcos/hideout'
const DICT = createRequire(import.meta.url)(join(SITE, 'i18n.js'))

const LANGS = {
  pt: { dir: '', html: 'pt-BR', og: 'pt_BR', ogImage: 'og.png', dateLocale: 'pt-BR' },
  en: { dir: 'en/', html: 'en', og: 'en_US', ogImage: 'og-en.png', dateLocale: 'en-US' },
  es: { dir: 'es/', html: 'es', og: 'es_ES', ogImage: 'og-es.png', dateLocale: 'es-ES' }
}
const PAGES = {
  index: { template: 'index.html', path: '' },
  guia: { template: 'guia.html', path: 'guia.html' }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const attr = (s) => esc(s).replace(/"/g, '&quot;')

function t(lang, key) {
  const v = DICT[lang][key]
  if (v === undefined) throw new Error(`missing translation ${lang}:${key}`)
  return v
}

/** Relative href from a page in `fromDir` to `target` (a path under the site root). */
function rel(fromDir, target) {
  const up = fromDir ? '../'.repeat(fromDir.split('/').filter(Boolean).length) : ''
  const href = up + target
  return href === '' ? './' : href
}

async function releaseInfo() {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { 'User-Agent': 'hideout-site-build' } })
    if (!r.ok) throw new Error(String(r.status))
    const j = await r.json()
    return { tag: j.tag_name.replace(/^v/, ''), date: j.published_at }
  } catch (e) {
    console.warn('release lookup failed, version line omitted:', e.message)
    return null
  }
}

function headBlock(page, lang) {
  const L = LANGS[lang]
  const url = (l) => BASE + LANGS[l].dir + PAGES[page].path
  const titleKey = page === 'index' ? 'meta.title' : 'g.meta.title'
  const descKey = page === 'index' ? 'meta.desc' : 'g.meta.desc'
  const lines = [
    `<link rel="canonical" href="${url(lang)}">`,
    ...Object.keys(LANGS).map((l) => `<link rel="alternate" hreflang="${LANGS[l].html}" href="${url(l)}">`),
    `<link rel="alternate" hreflang="x-default" href="${url('pt')}">`,
    `<meta name="theme-color" content="#EDF1EC">`,
    `<meta name="color-scheme" content="light">`,
    `<meta name="referrer" content="strict-origin-when-cross-origin">`,
    `<link rel="icon" type="image/svg+xml" href="icon.svg">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="icon-32.png">`,
    `<link rel="apple-touch-icon" href="apple-touch-icon.png">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Hideout">`,
    `<meta property="og:url" content="${url(lang)}">`,
    `<meta property="og:title" content="${attr(t(lang, titleKey))}">`,
    `<meta property="og:description" content="${attr(t(lang, descKey))}">`,
    `<meta property="og:locale" content="${L.og}">`,
    ...Object.keys(LANGS).filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${LANGS[l].og}">`),
    `<meta property="og:image" content="${BASE}${L.ogImage}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${attr(t(lang, 'meta.ogalt'))}">`,
    `<meta name="twitter:card" content="summary_large_image">`
  ]
  if (page === 'index') {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Hideout',
      url: url(lang),
      description: t(lang, 'meta.desc'),
      applicationCategory: 'SecurityApplication',
      operatingSystem: 'Windows 10, Windows 11',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      downloadUrl: `https://github.com/${REPO}/releases/latest`,
      license: 'https://opensource.org/licenses/MIT',
      image: BASE + L.ogImage,
      screenshot: BASE + 'screenshots/09-seal-copied.png',
      inLanguage: L.html,
      codeRepository: `https://github.com/${REPO}`
    }
    lines.push(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`)
  }
  return lines.join('\n')
}

function render(html, page, lang, release) {
  const L = LANGS[lang]
  const body = html.match(/<body\b[^>]*>/)[0]
  const titleKey = body.match(/data-title-key="([^"]+)"/)?.[1]
  const descKey = body.match(/data-desc-key="([^"]+)"/)?.[1]

  let out = html
    .replace(/<html lang="[^"]*">/, `<html lang="${L.html}" data-lang="${lang}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(t(lang, titleKey))}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${attr(t(lang, descKey))}">`)
    .replace('<!--HEAD-->', PAGES[page] ? headBlock(page, lang) : page === '404' ? '<meta name="robots" content="noindex">' : '')

  // Text content and trusted inline markup
  out = out.replace(/<([a-z][a-z0-9]*)\b([^>]*?\sdata-i18n="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g, (_m, tag, attrs, key) => `<${tag}${attrs}>${esc(t(lang, key))}</${tag}>`)
  out = out.replace(/<([a-z][a-z0-9]*)\b([^>]*?\sdata-i18n-html="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g, (_m, tag, attrs, key) => `<${tag}${attrs}>${t(lang, key)}</${tag}>`)
  // Attributes: data-i18n-attr="alt:key;aria-label:key2"
  out = out.replace(/<[^>]*\sdata-i18n-attr="([^"]+)"[^>]*>/g, (tagHtml, spec) => {
    let tg = tagHtml
    for (const pair of spec.split(';')) {
      const [name, key] = pair.split(':')
      const value = attr(t(lang, key))
      const re = new RegExp(`\\s${name}="[^"]*"`)
      tg = re.test(tg) ? tg.replace(re, ` ${name}="${value}"`) : tg.replace(/\s*\/?>$/, (end) => ` ${name}="${value}"${end}`)
    }
    return tg
  })

  // Version line from the latest GitHub release
  if (release) {
    const date = new Date(release.date).toLocaleDateString(L.dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })
    out = out.replace('<!--VERSION-->', esc(t(lang, 'com.version').replace('{v}', release.tag).replace('{d}', date)))
  } else out = out.replace('<!--VERSION-->', '')

  // Language switcher and links between pages
  out = out.replace(/<a data-lang-link="(\w+)"/g, (_m, l) => {
    const href = rel(L.dir, LANGS[l].dir + (PAGES[page]?.path ?? ''))
    return `<a data-lang-link="${l}" href="${href}"${l === lang ? ' aria-current="page"' : ''}`
  })
  out = out.replace(/data-page-link="(\w+)"(\s+data-anchor="([^"]*)")?\s+href="[^"]*"/g, (_m, p, _a, anchor = '') => {
    const href = (PAGES[p].path || './') + anchor
    return `data-page-link="${p}" href="${href}"`
  })

  // Assets live once at the site root
  if (L.dir) out = out.replace(/(\s(?:src|href|data-src)=")((?:assets|screenshots|fonts)\/|icon[.-]|apple-touch-icon|og)/g, `$1../$2`)
  return out
}

function renderOg(lang) {
  const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
  if (!edge) return console.warn('Edge not found, share images skipped')
  // The temporary page sits at the site root, so asset paths stay root-relative.
  const html = render(readFileSync(join(SITE, 'og.html'), 'utf8'), 'og', lang, null).replace(/(\s(?:src|href)=")\.\.\//g, '$1')
  const tmp = join(OUT, `_og-${lang}.html`)
  writeFileSync(tmp, html)
  spawnSync(edge, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--virtual-time-budget=2000', '--window-size=1200,630', `--screenshot=${join(OUT, LANGS[lang].ogImage)}`, pathToFileURL(tmp).href])
  rmSync(tmp, { force: true })
}

const release = await releaseInfo()
for (const [page, P] of Object.entries(PAGES)) {
  const tpl = readFileSync(join(SITE, P.template), 'utf8')
  for (const lang of Object.keys(LANGS)) {
    const dest = join(OUT, LANGS[lang].dir, P.template)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, render(tpl, page, lang, release))
  }
}
writeFileSync(join(OUT, '404.html'), render(readFileSync(join(SITE, '404.html'), 'utf8'), '404', 'pt', release))
copyFileSync(join(SITE, 'i18n.js'), join(OUT, 'assets', 'i18n.js'))

const today = new Date().toISOString().slice(0, 10)
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...Object.values(PAGES).flatMap((P) => Object.keys(LANGS).map((l) => [
    '  <url>',
    `    <loc>${BASE}${LANGS[l].dir}${P.path}</loc>`,
    `    <lastmod>${today}</lastmod>`,
    ...Object.keys(LANGS).map((a) => `    <xhtml:link rel="alternate" hreflang="${LANGS[a].html}" href="${BASE}${LANGS[a].dir}${P.path}"/>`),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE}${P.path}"/>`,
    '  </url>'
  ].join('\n'))),
  '</urlset>',
  ''
].join('\n')
writeFileSync(join(OUT, 'sitemap.xml'), sitemap)

if (process.argv.includes('--og')) for (const lang of Object.keys(LANGS)) renderOg(lang)
console.log(`site built: ${Object.keys(PAGES).length * 3} pages + 404 + sitemap${release ? `, version ${release.tag}` : ''}`)
