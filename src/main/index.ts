import {
  app, clipboard, dialog, globalShortcut, ipcMain, Menu, Notification, powerMonitor, shell, Tray, nativeImage
} from 'electron'
import { execFile } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { langFromLocale, setMainLang, tr } from '@shared/i18n'
import { themeById } from '@shared/themes'
import type { AppState, Settings, SoundId, VaultData, WindowMode } from '@shared/types'
import { matchWindow, sureMatch } from './autotype'
import { checkLeaks } from './leaks'
import { Timer } from './timer'
import { DOWNLOAD_PAGE, Updater } from './updater'
import { parseBrowserPasswords } from './csv'
import { Reminders, type Fired } from './reminders'
import { loadSettings, remove, saveSettings } from './storage'
import { VaultError, VaultService } from './vault'
import { winHelper } from './winhelper'
import { MainWindow } from './window'

// Development runs get their own id so they never pose as the installed app.
const APP_ID = app.isPackaged ? 'app.hideout.desktop' : 'app.hideout.desktop.dev'
const startHidden = process.argv.includes('--hidden')

// Separate profile for development and automated checks (never touches the real vault).
if (process.env.HIDEOUT_PROFILE) app.setPath('userData', process.env.HIDEOUT_PROFILE)

if (!app.requestSingleInstanceLock()) app.quit()
app.setAppUserModelId(APP_ID)

let settings: Settings
let main: MainWindow
let tray: Tray | null = null
let quitting = false
let hiddenSince: number | null = null
const vault = new VaultService(() => settings.vaultDir)
const tempDir = join(tmpdir(), 'hideout-open')

const resource = (name: string): string => join(app.getAppPath(), 'resources', name)
/**
 * Gives Windows notifications the Hideout name and icon. The installer's Start menu shortcut already
 * does this; the portable build and development runs have no shortcut, so Windows would say "Electron".
 */
function registerNotificationIdentity(): void {
  if (process.platform !== 'win32') return
  const key = `HKCU\\Software\\Classes\\AppUserModelId\\${APP_ID}`
  // Windows cannot read inside app.asar; resources are unpacked next to it.
  const icon = resource('icon.png').replace('app.asar\\', 'app.asar.unpacked\\')
  const values: Array<[string, string]> = [
    ['DisplayName', app.isPackaged ? 'Hideout' : 'Hideout (dev)'],
    ['IconUri', icon]
  ]
  for (const [name, data] of values) execFile('reg.exe', ['add', key, '/v', name, '/t', 'REG_EXPAND_SZ', '/d', data, '/f'], { windowsHide: true }, () => {})
}

const send = (channel: string, payload?: unknown): void => main?.win.webContents.send(channel, payload)

/** Every IPC call answers { ok, value } or { ok: false, error, code } so the UI can show friendly messages. */
function handle<A extends unknown[]>(channel: string, fn: (...args: A) => unknown): void {
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      return { ok: true, value: await fn(...(args as A)) }
    } catch (err) {
      if (err instanceof VaultError) return { ok: false, error: err.message, code: err.code }
      console.error(channel, err)
      return { ok: false, error: tr('Algo deu errado. Tente de novo.'), code: 'internal' }
    }
  })
}

function state(): AppState {
  return { settings, users: vault.users(), sessions: vault.sessions(), version: app.getVersion(), systemLang: langFromLocale(app.getLocale()) }
}

function lock(reason: 'idle' | 'manual' | 'windows' = 'manual'): void {
  if (!vault.unlockedUser) return
  vault.pruneAttachments()
  vault.lock()
  remove(tempDir)
  send('vault:locked', reason)
}

// --- clipboard ------------------------------------------------------------------

async function copy(text: string, secret: boolean): Promise<void> {
  try {
    await winHelper.setClipboard(text, secret)
  } catch {
    await clipboard.writeText(text)
  }
  if (!secret) return
  setTimeout(async () => {
    try {
      await winHelper.clearClipboardIf(text)
    } catch {
      if ((await clipboard.readText()) === text) await clipboard.clear()
    }
  }, settings.clipboardSeconds * 1000)
}

// --- auto-type --------------------------------------------------------------------

let autoTypeTarget: number | null = null

async function autoType(): Promise<void> {
  const fg = await winHelper.foreground().catch(() => null)
  if (!fg || fg.pid === process.pid || main.win.isFocused()) return
  const data = vault.current
  if (!data) {
    new Notification({ title: tr('Hideout trancado'), body: tr('Abra o Hideout com o PIN e tente o atalho de novo.'), icon: resource('icon.png') }).show()
    main.show()
    return
  }
  const sure = sureMatch(fg.title, data.accesses)
  if (sure) return typeInto(fg.hwnd, sure.id)
  const matches = matchWindow(fg.title, data.accesses)
  autoTypeTarget = fg.hwnd
  main.show()
  send('autotype:choose', { title: fg.title, ids: matches.map((m) => m.id) })
}

function autoTypeHint(body: string): void {
  new Notification({ title: tr('Digitar login'), body, icon: resource('icon.png') }).show()
}

const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Polls the focused field, e.g. while a two-step login loads its password page. */
async function waitForPassword(ms: number): Promise<boolean> {
  for (let t = 0; t < ms; t += 250) {
    if ((await winHelper.focusKind()) === 'password') return true
    await pause(250)
  }
  return false
}

/**
 * Types into the field that has focus instead of blindly sending user, Tab, password, Enter:
 * - password field: only the password, then Enter;
 * - user field: the user, then the password if Tab lands on a password field; otherwise
 *   (two-step logins such as Google) Enter on the user field, wait for the password page, then the password;
 * - anything else (address bar, page body): types nothing and says where to click.
 */
async function typeInto(hwnd: number, accessId: string): Promise<void> {
  const a = vault.current?.accesses.find((x) => x.id === accessId)
  if (!a) return
  const ready = await winHelper.prepare(hwnd)
  if (process.env.HIDEOUT_DEBUG) console.log('[autotype]', a.title, JSON.stringify(ready))
  if (!ready.released) return autoTypeHint(tr('Solte as teclas do atalho logo depois de apertar e tente de novo.'))
  if (!ready.focused) return autoTypeHint(tr('Não consegui voltar para a janela. Clique no campo de login e aperte Ctrl+Alt+A.'))
  const password = (): Promise<void> => winHelper.keys([{ text: a.password }, { key: 'ENTER' }])

  if (ready.kind === 'password') {
    if (a.password) await password()
    return
  }
  if (ready.kind === 'address') return autoTypeHint(tr('O cursor está na barra de endereço. Clique no campo de usuário do site e aperte Ctrl+Alt+A.'))
  if (ready.kind === 'other') return autoTypeHint(tr('Clique no campo de usuário ou de senha e aperte Ctrl+Alt+A de novo.'))

  // 'text', or 'unknown' when the app does not expose its fields to Windows accessibility.
  if (!a.username) {
    if (a.password) await password()
    return
  }
  await winHelper.keys([{ text: a.username }])
  if (!a.password) return
  if (ready.kind === 'unknown') {
    await winHelper.keys([{ key: 'TAB' }])
    await password()
    return
  }
  await winHelper.keys([{ key: 'TAB' }])
  await pause(120)
  if ((await winHelper.focusKind()) === 'password') return password()
  // No password field after the user: go back and submit the user step.
  await winHelper.keys([{ key: 'SHIFT_TAB' }, { key: 'ENTER' }])
  if (await waitForPassword(6000)) return password()
  autoTypeHint(tr('Usuário digitado. Quando o campo de senha aparecer, clique nele e aperte Ctrl+Alt+A.'))
}

// --- app lifecycle ------------------------------------------------------------------

function applyLoginItem(): void {
  app.setLoginItemSettings({ openAtLogin: settings.startWithWindows, args: ['--hidden'] })
}

// Automated checks use another key so they do not collide with an installed Hideout.
const AUTOTYPE_KEY = process.env.HIDEOUT_AUTOTYPE_KEY || 'Control+Alt+A'
const shortcutWarned = new Set<string>()

function registerShortcuts(): void {
  globalShortcut.unregisterAll()
  const taken: string[] = []
  if (!globalShortcut.register('Control+Alt+V', () => main.toggleVisible())) taken.push('Ctrl+Alt+V')
  if (settings.autoType && !globalShortcut.register(AUTOTYPE_KEY, () => void autoType().catch(() => autoTypeHint(tr('Não deu para digitar agora. Tente de novo.'))))) {
    taken.push(AUTOTYPE_KEY.replace('Control', 'Ctrl'))
  }
  // Another program (or a second copy of Hideout) already owns the key: say so once instead of failing silently.
  const fresh = taken.filter((k) => !shortcutWarned.has(k))
  if (fresh.length) {
    fresh.forEach((k) => shortcutWarned.add(k))
    new Notification({ title: 'Hideout', body: tr('O atalho {keys} já está sendo usado por outro programa (ou outra cópia do Hideout aberta).', { keys: fresh.join(', ') }), icon: resource('icon.png') }).show()
  }
}

/** Language for notifications, the tray and error messages: the user's choice or Windows'. */
function applyLang(): void {
  setMainLang(settings.lang ?? langFromLocale(app.getLocale()))
  if (tray) trayMenu()
}

function trayMenu(): void {
  tray!.setContextMenu(Menu.buildFromTemplate([
    { label: tr('Mostrar / esconder  (Ctrl+Alt+V)'), click: () => main.toggleVisible() },
    { label: tr('Trancar agora'), click: () => lock('manual') },
    { type: 'separator' },
    { label: tr('Sair do Hideout'), click: () => { quitting = true; app.quit() } }
  ]))
}

function createTray(): void {
  tray = new Tray(nativeImage.createFromPath(resource('tray.png')))
  tray.setToolTip('Hideout')
  trayMenu()
  tray.on('click', () => main.toggleVisible())
}

function createWindow(): void {
  const theme = themeById(settings.lastUser ? settings.themes[settings.lastUser] : null, settings.customThemes)
  main = new MainWindow(join(__dirname, '../preload/index.js'), resource('icon.png'), theme.bg)
  const wc = main.win.webContents
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  wc.on('will-navigate', (e, url) => {
    if (!process.env.ELECTRON_RENDERER_URL || !url.startsWith(process.env.ELECTRON_RENDERER_URL)) e.preventDefault()
  })
  main.win.on('ready-to-show', () => { if (!startHidden) main.show() })
  main.win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      main.win.hide()
    }
  })
  main.win.on('hide', () => (hiddenSince = Date.now()))
  main.win.on('show', () => (hiddenSince = null))
  if (process.env.ELECTRON_RENDERER_URL) void main.win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void main.win.loadFile(join(__dirname, '../renderer/index.html'))
}

function registerIpc(): void {
  handle('app:state', () => state())
  handle('settings:set', (patch: Partial<Settings>) => {
    const turnedOnUpdates = patch.checkUpdates === true && !settings.checkUpdates
    settings = { ...settings, ...patch }
    saveSettings(settings)
    applyLoginItem()
    registerShortcuts()
    applyLang()
    if (turnedOnUpdates) void updater.check(true)
    return state()
  })
  handle('update:get', () => updater.state())
  handle('update:check', () => updater.check(true))
  handle('update:install', () => {
    quitting = true
    updater.install()
  })
  handle('update:page', () => shell.openExternal(DOWNLOAD_PAGE))
  handle('timer:get', () => timer.state())
  handle('timer:start', (ms?: number) => timer.start(ms))
  handle('timer:add', (ms: number) => timer.add(ms))
  handle('timer:set', (ms: number) => timer.set(ms))
  handle('timer:pause', () => timer.pause())
  handle('timer:reset', () => timer.reset())
  handle('sound:test', (sound: SoundId) =>
    sound === 'windows' ? reminders.notify('Hideout', tr('Som de teste'), sound) : playSound(sound)
  )
  handle('leaks:check', async () => {
    const data = vault.current
    if (!data) throw new VaultError('locked', tr('O cofre está trancado.'))
    try {
      return await checkLeaks(data.accesses, (done, total) => send('leaks:progress', { done, total }))
    } catch {
      throw new VaultError('offline', tr('Não consegui falar com o serviço de vazamentos. Confira a internet e tente de novo.'))
    }
  })
  handle('settings:pickDir', async () => {
    const r = await dialog.showOpenDialog(main.win, { title: tr('Pasta dos cofres'), defaultPath: settings.vaultDir, properties: ['openDirectory', 'createDirectory'] })
    if (r.canceled || !r.filePaths[0]) return state()
    settings = { ...settings, vaultDir: r.filePaths[0] }
    saveSettings(settings)
    return state()
  })

  handle('signup:begin', (user: string, password: string) => vault.signupBegin(user, password))
  handle('pending:totp', (code: string) => vault.verifyPendingTotp(code))
  handle('pending:finish', async (pin: string) => {
    const r = await vault.finishWithPin(pin)
    settings = { ...settings, lastUser: r.info.user }
    saveSettings(settings)
    return r
  })
  handle('pending:cancel', () => vault.cancelPending())
  handle('login', (user: string, password: string, totp?: string) => vault.login(user, password, totp))
  handle('unlock:pin', async (user: string, pin: string) => {
    const info = await vault.unlockWithPin(user, pin)
    settings = { ...settings, lastUser: user }
    saveSettings(settings)
    return info
  })
  handle('recover:begin', (user: string, code: string) => vault.recoverBegin(user, code))
  handle('recover:password', (password: string) => vault.recoverSetPassword(password))

  handle('vault:lock', () => lock('manual'))
  handle('vault:logout', (user?: string) => {
    lock('manual')
    vault.logout(user ?? settings.lastUser)
    return state()
  })
  handle('vault:save', (data: VaultData) => vault.save(data))
  handle('vault:conflicts', () => vault.conflicts())
  handle('vault:fired', () => (vault.unlockedUser ? reminders.take(vault.unlockedUser) : []))

  handle('account:password', (current: string, next: string) => vault.changePassword(current, next))
  handle('account:pin', (pin: string) => vault.changePin(pin))
  handle('account:recovery', (password: string) => vault.newRecovery(password))
  handle('account:totpBegin', (password: string) => vault.totpResetBegin(password))
  handle('account:totpConfirm', (code: string) => vault.totpResetConfirm(code))
  handle('account:removeDevice', (id: string) => vault.removeDevice(id))

  handle('clip:copy', (text: string, secret: boolean) => copy(text, secret))
  handle('shell:open', (url: string) => {
    const full = /^[a-z]+:\/\//i.test(url) ? url : `https://${url}`
    if (!/^https?:\/\//i.test(full)) throw new VaultError('bad_url', tr('Só abro links http ou https.'))
    return shell.openExternal(full)
  })

  handle('win:state', () => main.state())
  handle('win:mode', (mode: WindowMode) => main.setMode(mode))
  handle('win:top', () => main.toggleTop())
  handle('win:minimize', () => main.win.minimize())
  handle('win:hide', () => main.win.hide())

  handle('att:pick', async () => {
    const r = await dialog.showOpenDialog(main.win, { title: tr('Anexar arquivos'), properties: ['openFile', 'multiSelections'] })
    return r.canceled ? [] : r.filePaths.map(addAttachmentFromPath)
  })
  handle('att:addPaths', (paths: string[]) => paths.map(addAttachmentFromPath))
  handle('att:open', async (id: string, name: string) => {
    mkdirSync(tempDir, { recursive: true })
    const path = join(tempDir, `${id.slice(0, 8)}-${basename(name)}`)
    writeFileSync(path, vault.readAttachment(id))
    const err = await shell.openPath(path)
    if (err) throw new VaultError('open_failed', tr('Não consegui abrir o anexo.'))
  })
  handle('att:save', async (id: string, name: string) => {
    const r = await dialog.showSaveDialog(main.win, { title: tr('Salvar anexo'), defaultPath: basename(name) })
    if (!r.canceled && r.filePath) writeFileSync(r.filePath, vault.readAttachment(id))
  })

  handle('csv:import', async () => {
    const r = await dialog.showOpenDialog(main.win, { title: tr('Importar senhas (CSV do Chrome, Edge ou Brave)'), filters: [{ name: 'CSV', extensions: ['csv'] }], properties: ['openFile'] })
    if (r.canceled || !r.filePaths[0]) return []
    try {
      return parseBrowserPasswords(readFileSync(r.filePaths[0], 'utf8'))
    } catch (e) {
      throw new VaultError('bad_csv', tr((e as Error).message))
    }
  })
  handle('backup:export', async () => {
    const src = vault.vaultFilePath()
    if (!src) throw new VaultError('locked', tr('O cofre está trancado.'))
    const stamp = new Date().toISOString().slice(0, 10)
    const r = await dialog.showSaveDialog(main.win, { title: tr('Salvar backup criptografado'), defaultPath: `${basename(src, '.vault')}-backup-${stamp}.vault`, filters: [{ name: tr('Cofre Hideout'), extensions: ['vault'] }] })
    if (!r.canceled && r.filePath) copyFileSync(src, r.filePath)
    return !r.canceled
  })

  handle('autotype:run', async (accessId: string | null) => {
    const target = autoTypeTarget
    autoTypeTarget = null
    if (!accessId || !target) return
    main.win.hide()
    await new Promise((r) => setTimeout(r, 200))
    await typeInto(target, accessId)
  })
}

function addAttachmentFromPath(path: string) {
  const mimes: Record<string, string> = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.txt': 'text/plain' }
  return vault.addAttachment(basename(path), mimes[extname(path).toLowerCase()] ?? 'application/octet-stream', readFileSync(path))
}

const reminders = new Reminders(
  () => vault.schedules(),
  () => settings.alerts,
  (f) => {
    main.show()
    if (f === 'todo') send('tab:open', 'todo')
    else if (f) send('task:open', f)
  },
  (f: Fired) => {
    if (vault.unlockedUser === f.user) send('task:fired', f)
  },
  (sound) => playSound(sound),
  join(app.getAppPath(), 'resources', 'icon.png')
)

/** Sounds are synthesized in the window (Web Audio), which keeps running while hidden. */
function playSound(sound: SoundId): void {
  send('sound:play', { sound, volume: settings.alerts.volume })
}

const timer = new Timer(
  (s) => send('timer:state', s),
  (total) => {
    const minutes = Math.round(total / 60_000)
    reminders.notify(tr('Tempo esgotado'), minutes ? tr('O temporizador de {n} min terminou.', { n: minutes }) : tr('O temporizador terminou.'), settings.alerts.timerSound, () => main.show())
  }
)

let announced: string | null = null
const updater = new Updater(
  () => settings.checkUpdates,
  (s) => send('update:state', s),
  (version, manual) => {
    if (announced === version) return
    announced = version
    if (manual) {
      reminders.notify(tr('Nova versão do Hideout'), tr('A versão {v} está disponível. Clique para baixar.', { v: version }), 'none', () => void shell.openExternal(DOWNLOAD_PAGE))
    } else {
      reminders.notify(tr('Nova versão do Hideout'), tr('A versão {v} foi baixada. Reinicie o Hideout para instalar.', { v: version }), 'none', () => main.show())
    }
  }
)

function watchIdle(): void {
  setInterval(() => {
    if (!vault.unlockedUser) return
    const limit = settings.autoLockMinutes * 60
    const hiddenFor = hiddenSince ? (Date.now() - hiddenSince) / 1000 : 0
    if (powerMonitor.getSystemIdleTime() >= limit || hiddenFor >= limit) lock('idle')
  }, 15_000)
  powerMonitor.on('lock-screen', () => settings.lockOnWindowsLock && lock('windows'))
  powerMonitor.on('suspend', () => lock('windows'))
}

app.on('second-instance', () => main?.show())
app.on('before-quit', () => {
  quitting = true
  lock('manual')
})
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  winHelper.dispose()
})
app.on('window-all-closed', () => {})

app.whenReady().then(async () => {
  registerNotificationIdentity()
  Menu.setApplicationMenu(null)
  settings = loadSettings()
  applyLang()
  await vault.init()
  registerIpc()
  createWindow()
  createTray()
  registerShortcuts()
  applyLoginItem()
  watchIdle()
  reminders.start()
  updater.start()
  winHelper.warmUp()
})
