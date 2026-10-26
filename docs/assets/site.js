(() => {
  const DICT = window.HX_I18N
  const LANGS = { pt: 'pt-BR', en: 'en', es: 'es' }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  // --- language ---------------------------------------------------------------
  function pickLang() {
    const q = new URLSearchParams(location.search).get('lang')
    if (q && DICT[q]) return q
    try {
      const saved = localStorage.getItem('hx-lang')
      if (saved && DICT[saved]) return saved
    } catch { /* storage blocked: fall through */ }
    const nav = (navigator.language || 'pt').slice(0, 2).toLowerCase()
    return DICT[nav] ? nav : 'en'
  }

  function apply(lang) {
    const d = DICT[lang]
    document.documentElement.lang = LANGS[lang]
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const v = d[el.dataset.i18n]
      if (v !== undefined) el.textContent = v
    })
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const v = d[el.dataset.i18nHtml]
      if (v !== undefined) el.innerHTML = v
    })
    document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      for (const pair of el.dataset.i18nAttr.split(';')) {
        const [attr, key] = pair.split(':')
        if (d[key] !== undefined) el.setAttribute(attr, d[key])
      }
    })
    const titleKey = document.body.dataset.titleKey
    if (titleKey && d[titleKey]) document.title = d[titleKey]
    const desc = document.querySelector('meta[name=description]')
    if (desc && d['meta.desc']) desc.content = d['meta.desc']
    document.querySelectorAll('.langs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)))
    document.querySelectorAll('a[data-keep-lang]').forEach((a) => {
      const url = new URL(a.getAttribute('href'), location.href)
      url.searchParams.set('lang', lang)
      a.href = url.pathname.split('/').pop() + url.search + url.hash
    })
    try { localStorage.setItem('hx-lang', lang) } catch { /* ignore */ }
    document.dispatchEvent(new CustomEvent('hx:lang', { detail: lang }))
  }

  document.querySelectorAll('.langs button').forEach((b) => b.addEventListener('click', () => apply(b.dataset.lang)))
  apply(pickLang())

  // --- desktop demo: snap left / float / right ----------------------------------
  const desk = document.getElementById('desk')
  if (desk) {
    const btns = document.querySelectorAll('[data-m]')
    btns.forEach((b) => b.addEventListener('click', () => {
      desk.dataset.mode = b.dataset.m
      btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
    }))
  }

  // --- screens & themes switcher --------------------------------------------------
  const shot = document.getElementById('shot')
  if (shot) {
    const caption = document.getElementById('shot-caption')
    const pick = (btn, group) => {
      document.querySelectorAll(`[data-group="${group}"] [data-src]`).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)))
      shot.classList.add('swap')
      setTimeout(() => {
        shot.src = btn.dataset.src
        shot.alt = btn.dataset.alt || ''
        if (caption) caption.dataset.i18n = btn.dataset.caption
        if (caption) caption.textContent = DICT[document.documentElement.lang.slice(0, 2)]?.[btn.dataset.caption] ?? ''
        shot.onload = () => shot.classList.remove('swap')
      }, reduced ? 0 : 140)
    }
    document.querySelectorAll('[data-group] [data-src]').forEach((b) => b.addEventListener('click', () => pick(b, b.closest('[data-group]').dataset.group)))
    const tabs = document.querySelectorAll('[role=tab][data-panel]')
    tabs.forEach((t) => t.addEventListener('click', () => {
      tabs.forEach((x) => {
        const on = x === t
        x.setAttribute('aria-selected', String(on))
        document.getElementById(x.dataset.panel).hidden = !on
      })
      const first = document.querySelector(`#${t.dataset.panel} [aria-pressed="true"]`) || document.querySelector(`#${t.dataset.panel} [data-src]`)
      if (first) first.click()
    }))
  }

  // --- password seal demo ----------------------------------------------------------
  document.querySelectorAll('[data-seal]').forEach((seal) => {
    const dots = seal.innerHTML
    let timer = null
    const label = { pt: 'Copiada', en: 'Copied', es: 'Copiada' }
    seal.addEventListener('click', () => {
      clearTimeout(timer)
      seal.classList.remove('copied')
      void seal.offsetWidth
      const lang = document.documentElement.lang.slice(0, 2)
      seal.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>${label[lang] || label.en}<span class="drain"></span>`
      seal.classList.add('copied')
      timer = setTimeout(() => { seal.classList.remove('copied'); seal.innerHTML = dots }, Number(seal.dataset.seal) || 6000)
    })
  })

  // --- comments (giscus, loaded on demand) -----------------------------------------
  const load = document.getElementById('load-comments')
  if (load) {
    load.addEventListener('click', () => {
      const lang = document.documentElement.lang.slice(0, 2)
      const s = document.createElement('script')
      Object.entries({
        src: 'https://giscus.app/client.js',
        'data-repo': 'pbrmarcos/hideout',
        'data-repo-id': 'R_kgDOVYRE9Q',
        'data-category': 'Announcements',
        'data-category-id': 'DIC_kwDOVYRE9c4DJrpo',
        'data-mapping': 'specific',
        'data-term': 'Comentários do site',
        'data-strict': '1',
        'data-reactions-enabled': '1',
        'data-emit-metadata': '0',
        'data-input-position': 'top',
        'data-theme': 'light',
        'data-lang': lang === 'pt' ? 'pt' : lang,
        'data-loading': 'lazy',
        crossorigin: 'anonymous',
        async: ''
      }).forEach(([k, v]) => s.setAttribute(k, v))
      document.getElementById('comments').appendChild(s)
      load.remove()
    })
  }

  // --- reveal on scroll ------------------------------------------------------------------
  const io = 'IntersectionObserver' in window && !reduced
    ? new IntersectionObserver((entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
      }), { threshold: 0.15 })
    : null
  document.querySelectorAll('.reveal').forEach((el) => (io ? io.observe(el) : el.classList.add('in')))
})()
