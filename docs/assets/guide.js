// Looping demo scenes for the shortcuts page. A scene runs only while it is on screen and the
// tab is visible; the "Pause animations" button (WCAG 2.2.2) and reduced motion show final frames.
(() => {
  const lang = document.documentElement.dataset.lang || 'pt'
  const T = (window.HX_I18N && window.HX_I18N[lang]) || {}
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const $ = (root, sel) => root.querySelector(sel)
  const $$ = (root, sel) => [...root.querySelectorAll(sel)]

  let paused = reduced
  try { paused = paused || localStorage.getItem('hx-motion') === 'off' } catch { /* storage blocked */ }

  const wait = (ms) => new Promise((resolve, reject) => setTimeout(() => (paused ? reject(new Error('paused')) : resolve()), ms))

  async function press(root) {
    const k = $$(root, '.keys kbd')
    for (const el of k) { el.classList.add('down'); await wait(110) }
    await wait(220)
    k.forEach((el) => el.classList.remove('down'))
  }
  async function type(el, text, speed = 55) {
    el.textContent = ''
    for (const ch of text) { el.textContent += ch; await wait(speed) }
  }
  function addTask(list, it) {
    const li = document.createElement('li')
    li.innerHTML = '<span class="a-ck"></span><span class="a-t"></span><span class="a-w"></span>'
    li.querySelector('.a-t').textContent = it.title
    li.querySelector('.a-w').textContent = it.when
    list.prepend(li)
    while (list.children.length > 3) list.lastElementChild.remove()
  }

  const scenes = {
    async toggle(root) {
      const panel = $(root, '.mini-panel')
      await press(root); panel.classList.add('open')
      await wait(1800)
      await press(root); panel.classList.remove('open')
      await wait(900)
    },
    async autotype(root) {
      const user = $(root, '.f-user'), pass = $(root, '.f-pass'), btn = $(root, '.f-btn'), ok = $(root, '.f-ok')
      user.textContent = ''; pass.textContent = ''; ok.classList.remove('show'); user.classList.add('focus'); pass.classList.remove('focus')
      await wait(500)
      await press(root)
      await type(user, 'nome@gmail.com', 45)
      user.classList.remove('focus'); pass.classList.add('focus')
      await wait(180)
      await type(pass, '••••••••••', 45)
      pass.classList.remove('focus')
      btn.classList.add('down'); await wait(200); btn.classList.remove('down')
      ok.classList.add('show')
      await wait(1800)
    },
    async search(root) {
      const pal = $(root, '.mini-palette'), q = $(root, '.p-q'), first = $(root, '.p-r')
      pal.classList.remove('open'); first.classList.remove('hit'); q.textContent = ''
      await wait(500)
      await press(root); pal.classList.add('open')
      await wait(350)
      await type(q, 'goo', 120)
      first.classList.add('hit')
      await wait(1700)
      pal.classList.remove('open')
      await wait(600)
    },
    async tabs(root) {
      const keys = $$(root, '.keys kbd'), bar = $(root, '.mini-tabs')
      for (const n of [2, 3, 1]) {
        keys[0].classList.add('down'); keys[n].classList.add('down')
        bar.dataset.on = String(n)
        await wait(420)
        keys[0].classList.remove('down'); keys[n].classList.remove('down')
        await wait(900)
      }
    },
    async sheet(root) {
      const keys = $$(root, '.keys kbd'), sheet = $(root, '.mini-sheet')
      keys[0].classList.add('down'); keys[1].classList.add('down')
      await wait(300)
      keys[0].classList.remove('down'); keys[1].classList.remove('down')
      sheet.classList.add('open')
      await wait(1600)
      keys[2].classList.add('down')
      await wait(300)
      keys[2].classList.remove('down')
      sheet.classList.remove('open')
      await wait(1100)
    },
    async snap(root) {
      const desk = $(root, '.desk'), btns = $$(root, '[data-m]')
      for (const m of ['float', 'left', 'right']) {
        desk.dataset.mode = m
        btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === m)))
        await wait(1700)
      }
    },
    async seal(root) {
      const seal = $(root, '[data-seal]')
      await wait(900)
      if (!seal.classList.contains('copied')) seal.click()
      await wait(7200)
    },
    async agenda(root) {
      const input = $(root, '.a-input'), chip = $(root, '.a-chip'), list = $(root, '.a-list')
      for (const it of JSON.parse(root.dataset.items)) {
        chip.classList.remove('show')
        await type(input, it.text, 45)
        chip.textContent = it.when
        chip.classList.add('show')
        await wait(900)
        addTask(list, it)
        input.textContent = ''
        chip.classList.remove('show')
        await wait(700)
      }
    }
  }

  // Final frames, used when paused or with reduced motion.
  const still = {
    toggle: (r) => $(r, '.mini-panel').classList.add('open'),
    autotype: (r) => {
      $(r, '.f-user').textContent = 'nome@gmail.com'; $(r, '.f-pass').textContent = '••••••••••'
      $$(r, '.fld').forEach((f) => f.classList.remove('focus')); $(r, '.f-ok').classList.add('show')
    },
    search: (r) => { $(r, '.mini-palette').classList.add('open'); $(r, '.p-q').textContent = 'goo'; $(r, '.p-r').classList.add('hit') },
    tabs: (r) => { $(r, '.mini-tabs').dataset.on = '2'; $$(r, 'kbd').forEach((k) => k.classList.remove('down')) },
    sheet: (r) => { $(r, '.mini-sheet').classList.add('open'); $$(r, 'kbd').forEach((k) => k.classList.remove('down')) },
    snap: (r) => { $(r, '.desk').dataset.mode = 'right'; $$(r, '[data-m]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === 'right'))) },
    seal: () => {},
    agenda: (r) => {
      const list = $(r, '.a-list')
      list.textContent = ''
      $(r, '.a-input').textContent = ''
      $(r, '.a-chip').classList.remove('show')
      for (const it of JSON.parse(r.dataset.items).reverse()) addTask(list, it)
    }
  }

  const roots = [...document.querySelectorAll('[data-scene]')]
  const state = new Map(roots.map((r) => [r, { visible: false, running: false }]))

  async function run(root) {
    const s = state.get(root)
    if (s.running || paused || !s.visible || document.hidden) return
    s.running = true
    try {
      while (s.visible && !paused && !document.hidden) await scenes[root.dataset.scene](root)
    } catch { /* paused mid-scene */ }
    s.running = false
    if (paused) still[root.dataset.scene](root)
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      state.get(e.target).visible = e.isIntersecting
      if (e.isIntersecting) run(e.target)
    }), { threshold: 0.35 })
    roots.forEach((r) => io.observe(r))
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) roots.forEach(run) })

  // Pause / resume button
  const toggle = document.getElementById('motion-toggle')
  const label = toggle?.querySelector('span')
  function setPaused(p) {
    paused = p
    document.documentElement.classList.toggle('paused', p)
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(p))
      label.textContent = p ? T['g.motion.play'] : T['g.motion.pause']
    }
    if (p) roots.forEach((r) => { if (!state.get(r).running) still[r.dataset.scene](r) })
    else roots.forEach(run)
  }
  toggle?.addEventListener('click', () => {
    setPaused(!paused)
    try { localStorage.setItem('hx-motion', paused ? 'off' : 'on') } catch { /* ignore */ }
  })
  if (reduced && toggle) toggle.hidden = true
  setPaused(paused)
})()
