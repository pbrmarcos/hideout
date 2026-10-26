import type { TimerState } from '@shared/types'

const MAX = 24 * 60 * 60_000

/** A single countdown that keeps running while the window is hidden or the vault is locked. */
export class Timer {
  private s: TimerState = { running: false, endsAt: null, remaining: 15 * 60_000, total: 15 * 60_000 }
  private handle: NodeJS.Timeout | null = null

  constructor(private onChange: (s: TimerState) => void, private onDone: (total: number) => void) {}

  state(): TimerState {
    return { ...this.s, remaining: this.left() }
  }

  private left(): number {
    return this.s.running && this.s.endsAt ? Math.max(0, this.s.endsAt - Date.now()) : this.s.remaining
  }

  private arm(): void {
    if (this.handle) clearTimeout(this.handle)
    this.handle = null
    if (!this.s.running || !this.s.endsAt) return
    this.handle = setTimeout(() => this.finish(), Math.max(0, this.s.endsAt - Date.now()))
  }

  private finish(): void {
    const total = this.s.total
    this.s = { running: false, endsAt: null, remaining: total, total }
    this.handle = null
    this.onChange(this.state())
    this.onDone(total)
  }

  private emit(): TimerState {
    this.arm()
    const st = this.state()
    this.onChange(st)
    return st
  }

  start(ms?: number): TimerState {
    const length = Math.min(MAX, Math.max(1000, ms ?? this.left()))
    this.s = { running: true, endsAt: Date.now() + length, remaining: length, total: ms ?? this.s.total }
    return this.emit()
  }

  /** Adds or removes time; while running it moves the end, otherwise it changes the preset. */
  add(ms: number): TimerState {
    if (this.s.running && this.s.endsAt) {
      this.s.endsAt = Math.min(Date.now() + MAX, Math.max(Date.now() + 1000, this.s.endsAt + ms))
      this.s.total = Math.max(1000, this.s.total + ms)
    } else {
      const v = Math.min(MAX, Math.max(60_000, this.s.remaining + ms))
      this.s.remaining = v
      this.s.total = v
    }
    return this.emit()
  }

  set(ms: number): TimerState {
    const v = Math.min(MAX, Math.max(1000, ms))
    this.s = { running: false, endsAt: null, remaining: v, total: v }
    return this.emit()
  }

  pause(): TimerState {
    this.s = { ...this.s, running: false, remaining: this.left(), endsAt: null }
    return this.emit()
  }

  reset(): TimerState {
    this.s = { running: false, endsAt: null, remaining: this.s.total, total: this.s.total }
    return this.emit()
  }
}
