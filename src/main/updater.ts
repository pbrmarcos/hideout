import { app, net } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateState } from '@shared/types'

const DAY = 24 * 60 * 60_000
const LATEST = 'https://api.github.com/repos/pbrmarcos/hideout/releases/latest'
export const DOWNLOAD_PAGE = 'https://github.com/pbrmarcos/hideout/releases/latest'

/** The portable .exe runs from a temp copy and cannot replace itself; electron-builder sets this variable for it. */
const portable = !!process.env.PORTABLE_EXECUTABLE_DIR

/** "1.2.10" > "1.2.9"; pre-release tags are ignored. */
export function newer(a: string, b: string): boolean {
  const pa = a.replace(/^v/, '').split(/[.-]/).map(Number)
  const pb = b.replace(/^v/, '').split(/[.-]/).map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0)
  return false
}

/**
 * Looks for a new release on GitHub (only the public release list is read; nothing from the vault is sent).
 * The installed app downloads it in the background and asks to restart; the portable one only tells.
 */
export class Updater {
  private s: UpdateState = { status: app.isPackaged ? 'idle' : 'dev', version: null, percent: 0, checkedAt: null }
  private timer: NodeJS.Timeout | null = null

  constructor(
    private enabled: () => boolean,
    private onChange: (s: UpdateState) => void,
    private onReady: (version: string, manual: boolean) => void
  ) {
    autoUpdater.autoDownload = true
    // Closing from the tray installs a downloaded update too.
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.logger = null
    // Automated checks serve a fake release from a local folder instead of GitHub.
    if (process.env.HIDEOUT_UPDATE_URL) autoUpdater.setFeedURL({ provider: 'generic', url: process.env.HIDEOUT_UPDATE_URL })
    autoUpdater.on('update-available', (i) => this.set({ status: 'downloading', version: i.version, percent: 0 }))
    autoUpdater.on('update-not-available', () => this.set({ status: 'latest', version: null }))
    autoUpdater.on('download-progress', (p) => this.set({ status: 'downloading', percent: Math.round(p.percent) }))
    autoUpdater.on('update-downloaded', (i) => {
      this.set({ status: 'ready', version: i.version, percent: 100 })
      this.onReady(i.version, false)
    })
    autoUpdater.on('error', (e) => {
      console.error('[updater]', e?.message)
      // Offline or GitHub unreachable: try again on the next round, quietly.
      if (this.s.status !== 'ready') this.set({ status: 'error' })
    })
  }

  state(): UpdateState {
    return { ...this.s }
  }

  private set(patch: Partial<UpdateState>): void {
    this.s = { ...this.s, ...patch }
    this.onChange(this.state())
  }

  /** First check shortly after start, then once a day while the app stays open. */
  start(): void {
    if (!app.isPackaged) return
    setTimeout(() => void this.check(false), 15_000)
    this.timer = setInterval(() => void this.check(false), 6 * 60 * 60_000)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
  }

  /** `now` comes from the "Check now" button: it ignores the daily limit. */
  async check(now: boolean): Promise<UpdateState> {
    if (!app.isPackaged || (!now && !this.enabled())) return this.state()
    if (['checking', 'downloading', 'ready'].includes(this.s.status)) return this.state()
    if (!now && this.s.checkedAt && Date.now() - Date.parse(this.s.checkedAt) < DAY) return this.state()
    this.set({ status: 'checking', checkedAt: new Date().toISOString() })
    try {
      if (portable) await this.checkPortable()
      else await autoUpdater.checkForUpdates()
    } catch {
      this.set({ status: 'error' })
    }
    return this.state()
  }

  private async checkPortable(): Promise<void> {
    const r = await net.fetch(LATEST, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Hideout' } })
    if (!r.ok) throw new Error(`GitHub ${r.status}`)
    const tag = String(((await r.json()) as { tag_name?: string }).tag_name ?? '')
    if (tag && newer(tag, app.getVersion())) {
      const version = tag.replace(/^v/, '')
      this.set({ status: 'manual', version })
      this.onReady(version, true)
    } else this.set({ status: 'latest', version: null })
  }

  install(): void {
    if (this.s.status === 'ready') autoUpdater.quitAndInstall(true, true)
  }
}
