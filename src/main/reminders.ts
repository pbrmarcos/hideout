import { Notification } from 'electron'
import type { ScheduledTask } from '@shared/types'

const TICK = 20_000
const LATE_GRACE = 10 * 60_000

export interface Fired {
  user: string
  id: string
  title: string
}

/**
 * Fires Windows notifications from the per-user schedules, which stay readable
 * while the vault is locked (they hold only titles and times).
 */
export class Reminders {
  private fired = new Set<string>()
  private first = true
  private timer: NodeJS.Timeout | null = null
  pending: Fired[] = []

  constructor(
    private source: () => Promise<Array<{ user: string; tasks: ScheduledTask[] }>>,
    private onClick: (f: Fired) => void,
    private onFire: (f: Fired) => void,
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
    const t = Date.now()
    let late = 0
    for (const { user, tasks } of await this.source()) {
      for (const task of tasks) {
        const when = Date.parse(task.snoozedUntil && task.snoozedUntil > task.due ? task.snoozedUntil : task.due)
        const key = `${user}|${task.id}|${when}`
        if (when > t || this.fired.has(key)) continue
        this.fired.add(key)
        if (this.first && t - when > LATE_GRACE) {
          late++
          continue
        }
        this.notify({ user, id: task.id, title: task.title }, 'Lembrete do Hideout')
      }
    }
    if (late > 0) {
      new Notification({ title: 'Hideout', body: late === 1 ? 'Você tem 1 tarefa atrasada.' : `Você tem ${late} tarefas atrasadas.`, icon: this.icon }).show()
    }
    this.first = false
  }

  private notify(f: Fired, title: string): void {
    const n = new Notification({ title, body: f.title, icon: this.icon, timeoutType: 'never' })
    n.on('click', () => this.onClick(f))
    n.show()
    this.pending.push(f)
    this.onFire(f)
  }

  take(user: string): Fired[] {
    const mine = this.pending.filter((p) => p.user === user)
    this.pending = this.pending.filter((p) => p.user !== user)
    return mine
  }
}
