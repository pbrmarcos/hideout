import { BrowserWindow, screen, type Rectangle } from 'electron'
import { join } from 'node:path'
import type { WindowMode, WindowState } from '@shared/types'
import { dataDir, readJson, writeAtomic } from './storage'

interface Saved {
  mode: WindowMode
  alwaysOnTop: boolean
  float: Rectangle | null
  /** width as a fraction of the work area, shared by every mode */
  ratio: number
  displayId: number | null
}

const DEFAULT_RATIO = 0.3
const MIN_W = 380
const MIN_H = 560
const statePath = (): string => join(dataDir(), 'window.json')

export class MainWindow {
  win: BrowserWindow
  private s: Saved
  private applying = false

  constructor(preload: string, icon: string, background: string) {
    this.s = readJson<Saved>(statePath(), { mode: 'float', alwaysOnTop: false, float: null, ratio: DEFAULT_RATIO, displayId: null })
    const display = screen.getAllDisplays().find((d) => d.id === this.s.displayId) ?? screen.getPrimaryDisplay()
    this.win = new BrowserWindow({
      ...this.boundsFor(this.s.mode, display.workArea),
      minWidth: MIN_W,
      minHeight: MIN_H,
      frame: false,
      show: false,
      backgroundColor: background,
      icon,
      title: 'Hideout',
      alwaysOnTop: this.s.alwaysOnTop,
      // Not throttled while hidden: reminder and timer sounds play from this window.
      webPreferences: { preload, sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false, backgroundThrottling: false }
    })
    this.win.on('moved', () => this.onUserMove())
    this.win.on('resized', () => this.onUserResize())
  }

  state(): WindowState {
    return { mode: this.s.mode, alwaysOnTop: this.s.alwaysOnTop }
  }

  private workArea(): Rectangle {
    return screen.getDisplayMatching(this.win.getBounds()).workArea
  }

  private boundsFor(mode: WindowMode, wa: Rectangle): Rectangle {
    const width = Math.max(MIN_W, Math.round(wa.width * this.s.ratio))
    if (mode === 'left') return { x: wa.x, y: wa.y, width, height: wa.height }
    if (mode === 'right') return { x: wa.x + wa.width - width, y: wa.y, width, height: wa.height }
    const f = this.s.float
    if (f && this.visibleOnSomeDisplay(f)) return f
    const height = Math.max(MIN_H, Math.round(wa.height * 0.85))
    return { x: wa.x + Math.round((wa.width - width) / 2), y: wa.y + Math.round((wa.height - height) / 2), width, height }
  }

  private visibleOnSomeDisplay(r: Rectangle): boolean {
    return screen.getAllDisplays().some(({ workArea: w }) => r.x + 80 > w.x && r.x < w.x + w.width - 80 && r.y >= w.y - 10 && r.y < w.y + w.height - 60)
  }

  setMode(mode: WindowMode): WindowState {
    const wa = this.workArea()
    if (this.s.mode === 'float' && mode !== 'float') this.s.float = this.win.getBounds()
    this.s.mode = mode
    this.apply(this.boundsFor(mode, wa))
    this.save()
    return this.state()
  }

  toggleTop(): WindowState {
    this.s.alwaysOnTop = !this.s.alwaysOnTop
    this.win.setAlwaysOnTop(this.s.alwaysOnTop)
    this.save()
    return this.state()
  }

  private apply(b: Rectangle): void {
    this.applying = true
    this.win.setBounds(b)
    setTimeout(() => (this.applying = false), 250)
  }

  private onUserMove(): void {
    if (this.applying) return
    const b = this.win.getBounds()
    if (this.s.mode !== 'float') {
      // Dragging a snapped window releases it, keeping the size it had.
      this.s.mode = 'float'
      this.win.webContents.send('window:state', this.state())
    }
    this.s.float = b
    this.save()
  }

  private onUserResize(): void {
    if (this.applying) return
    const wa = this.workArea()
    const b = this.win.getBounds()
    this.s.ratio = Math.min(0.9, Math.max(MIN_W / wa.width, b.width / wa.width))
    if (this.s.mode === 'float') this.s.float = b
    else this.apply(this.boundsFor(this.s.mode, wa))
    this.save()
  }

  private save(): void {
    this.s.displayId = screen.getDisplayMatching(this.win.getBounds()).id
    writeAtomic(statePath(), JSON.stringify(this.s))
  }

  toggleVisible(): void {
    if (this.win.isVisible() && this.win.isFocused()) this.win.hide()
    else this.show()
  }

  show(): void {
    if (this.win.isMinimized()) this.win.restore()
    this.win.show()
    this.win.focus()
  }
}
