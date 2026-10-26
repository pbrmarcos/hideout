// Runtime behaviour shared by every page. Text is already translated at build time;
// this only handles what changes on screen.
(() => {
  const lang = document.documentElement.dataset.lang || 'pt'
  const T = (window.HX_I18N && window.HX_I18N[lang]) || {}
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  // --- desktop demo: snap left / float / right ------------------------------------
  const desk = document.getElementById('desk')
  if (desk) {
    const btns = document.querySelectorAll('[data-m]')
    btns.forEach((b) => b.addEventListener('click', () => {
      desk.dataset.mode = b.dataset.m
      btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
    }))
  }

  // --- screens & themes ---------------------------------------------------------------
  const shot = document.getElementById('shot')
  if (shot) {
    const caption = document.getElementById('shot-caption')
    const show = (btn) => {
      btn.closest('[data-group]').querySelectorAll('[data-src]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)))
      const text = T[btn.dataset.caption] || ''
      shot.classList.add('swap')
      setTimeout(() => {
        shot.onload = () => shot.classList.remove('swap')
        shot.src = btn.dataset.src
        shot.alt = text
        caption.textContent = text
      }, reduced ? 0 : 140)
    }
    document.querySelectorAll('[data-group] [data-src]').forEach((b) => b.addEventListener('click', () => show(b)))

    // WAI-ARIA tabs: roving tabindex, arrows / Home / End.
    const tabs = [...document.querySelectorAll('[role=tab][data-panel]')]
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab
        t.setAttribute('aria-selected', String(on))
        t.tabIndex = on ? 0 : -1
        document.getElementById(t.dataset.panel).hidden = !on
      })
      if (focus) tab.focus()
      const panel = document.getElementById(tab.dataset.panel)
      const current = panel.querySelector('[aria-pressed="true"]') || panel.querySelector('[data-src]')
      if (current) show(current)
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t, false))
      t.addEventListener('keydown', (e) => {
        const n = tabs.length
        const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key]
        if (to === undefined) return
        e.preventDefault()
        select(tabs[to], true)
      })
    })
  }

  // --- password seal demo ------------------------------------------------------------------
  const copiedWord = { pt: 'Copiada', en: 'Copied', es: 'Copiada' }[lang]
  document.querySelectorAll('[data-seal]').forEach((seal) => {
    const original = seal.innerHTML
    const status = seal.closest('.demo')?.querySelector('[data-seal-status]')
    let timer = null
    seal.addEventListener('click', () => {
      clearTimeout(timer)
      seal.classList.remove('copied')
      void seal.offsetWidth
      seal.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>${copiedWord}<span class="drain" aria-hidden="true"></span>`
      seal.classList.add('copied')
      if (status) status.textContent = T['g.seal.done'] || ''
      timer = setTimeout(() => {
        seal.classList.remove('copied')
        seal.innerHTML = original
        if (status) status.textContent = ''
      }, Number(seal.dataset.seal) || 6000)
    })
  })

  // --- comments (giscus, loaded only on request) ----------------------------------------------
  const load = document.getElementById('load-comments')
  if (load) {
    load.addEventListener('pointerenter', () => {
      if (document.querySelector('link[href="https://giscus.app"]')) return
      const l = document.createElement('link')
      l.rel = 'preconnect'
      l.href = 'https://giscus.app'
      document.head.appendChild(l)
    }, { once: true })
    load.addEventListener('click', () => {
      const box = document.getElementById('comments')
      const busy = document.createElement('p')
      busy.className = 'small'
      busy.setAttribute('role', 'status')
      busy.textContent = T['com.comments.loading'] || ''
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
        'data-lang': lang,
        'data-loading': 'lazy',
        crossorigin: 'anonymous',
        async: ''
      }).forEach(([k, v]) => s.setAttribute(k, v))
      load.replaceWith(busy)
      box.appendChild(s)
      box.focus()
      window.addEventListener('message', function done(e) {
        if (e.origin !== 'https://giscus.app') return
        busy.remove()
        window.removeEventListener('message', done)
      })
    })
  }

  // --- the lock icon travels across the security diagram ---------------------------------------
  const packet = document.querySelector('.packet')
  if (packet) {
    const size = () => packet.style.setProperty('--travel', `${packet.parentElement.clientWidth * 0.68 - 24}px`)
    size()
    addEventListener('resize', size)
  }

  // --- reveal on scroll -----------------------------------------------------------------------------
  const els = document.querySelectorAll('.reveal')
  if (!('IntersectionObserver' in window) || reduced) {
    els.forEach((el) => el.classList.add('in'))
  } else {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
    }), { threshold: 0.15 })
    els.forEach((el) => io.observe(el))
  }
})()
