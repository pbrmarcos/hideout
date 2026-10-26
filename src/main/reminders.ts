import { Notification } from 'electron'
import { tr } from '@shared/i18n'
import type { AlertSettings, Schedule, SoundId } from '@shared/types'

const TICK = 20_000
const LATE_GRACE = 10 * 60_000

export interface Fired {
  user: string
  id: string
  title: string
}

/**
 * Fires Windows notifications from the per-user schedules, which stay readable
 * while the vault is locked (they hold only titles and times), plus the daily TO DO summary.
 */
export class Reminders {
  private fired = new Set<string>()
  private first = true
  private timer: NodeJS.Timeout | null = null
  private lastDigest = ''
  pending: Fired[] = []

  constructor(
    private source: () => Promise<Array<{ user: string } & Schedule>>,
    private alerts: () => AlertSettings,
    private onClick: (f: Fired | 'todo' | null) => void,
    private onFire: (f: Fired) => void,
    private play: (sound: SoundId) => void,
    private icon: string
  ) {}

  start(): void {
    void this.tick()
    this.timer = setInterval(() => void this.tick(), TICK)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
  }

  async tick(): Promise<void> {
    const a = this.alerts()
    const t = Date.now()
    const lead = a.agendaLead * 60_000
    let late = 0
    const schedules = await this.source()
    for (const { user, tasks } of schedules) {
      for (const task of tasks) {
        const due = Date.parse(task.snoozedUntil && task.snoozedUntil > task.due ? task.snoozedUntil : task.due)
        const when = due - lead
        const key = `${user}|${task.id}|${due}`
        if (when > t || this.fired.has(key)) continue
        this.fired.add(key)
        if (this.first && t - due > LATE_GRACE) {
          late++
          continue
        }
        const f = { user, id: task.id, title: task.title }
        this.pending.push(f)
        this.onFire(f)
        if (!a.agendaNotify) continue
        const minutes = Math.round((due - t) / 60_000)
        const body = minutes > 0 ? tr('{title}, em {n} min', { title: task.title, n: minutes }) : task.title
        this.notify(tr('Lembrete do Hideout'), body, a.agendaSound, () => this.onClick(f))
      }
    }
    if (late > 0 && a.agendaNotify) {
      this.notify('Hideout', late === 1 ? tr('Você tem 1 tarefa atrasada.') : tr('Você tem {n} tarefas atrasadas.', { n: late }), a.agendaSound, () => this.onClick(null))
    }
    this.first = false
    this.digest(a, schedules)
  }

  /** Once a day at the chosen time: "You have N items in TO DO". */
  private digest(a: AlertSettings, schedules: Array<{ user: string } & Schedule>): void {
    if (!a.todoDaily) return
    const now = new Date()
    const today = now.toDateString()
    const [h, m] = a.todoDaily.split(':').map(Number)
    if (this.lastDigest === today || now.getHours() * 60 + now.getMinutes() < h * 60 + m) return
    this.lastDigest = today
    const n = schedules.reduce((sum, s) => sum + s.pendingTodos, 0)
    if (!n) return
    this.notify(tr('TO DO'), n === 1 ? tr('Você tem 1 item pendente no TO DO.') : tr('Você tem {n} itens pendentes no TO DO.', { n }), a.todoSound, () => this.onClick('todo'))
  }

  /** Our own sound plays from the window; "windows" uses the system notification sound. */
  notify(title: string, body: string, sound: SoundId, onClick?: () => void): void {
    const n = new Notification({ title, body, icon: this.icon, silent: sound !== 'windows', timeoutType: 'never' })
    if (onClick) n.on('click', onClick)
    n.show()
    if (sound !== 'windows' && sound !== 'none') this.play(sound)
  }

  take(user: string): Fired[] {
    const mine = this.pending.filter((p) => p.user === user)
    this.pending = this.pending.filter((p) => p.user !== user)
    return mine
  }
}
