import { reactive, watch } from 'vue'
import { newNote, newTask, nextOccurrence, now } from '@shared/model'
import type { Access, AppState, ItemType, Note, Task, ThemeId, UnlockInfo, VaultData, WindowState } from '@shared/types'
import { api, onMain } from './api'
import { applyTheme } from './theme'

export type Phase = 'loading' | 'auth' | 'app'
export type Tab = 'accesses' | 'notes' | 'agenda'
export type AuthStep =
  | { name: 'lock'; user: string }
  | { name: 'login'; needTotp?: boolean; user?: string }
  | { name: 'signup' }
  | { name: 'totp'; otpauth: string; secret: string; mode: 'signup' | 'recover' }
  | { name: 'pin'; mode: 'signup' | 'login' | 'recover' }
  | { name: 'recovery-code'; code: string; info: UnlockInfo }
  | { name: 'recover'; user?: string }
  | { name: 'recover-password' }

export type Sheet =
  | { kind: 'access'; id: string | null; type?: ItemType; category?: string }
  | { kind: 'note'; id: string }
  | { kind: 'task'; id: string }
  | { kind: 'templates' }
  | { kind: 'settings' }
  | { kind: 'trash' }

export interface FiredTask {
  user: string
  id: string
  title: string
}

export const S = reactive({
  phase: 'loading' as Phase,
  auth: { name: 'signup' } as AuthStep,
  app: null as AppState | null,
  user: null as string | null,
  data: null as VaultData | null,
  deviceId: '',
  tab: 'accesses' as Tab,
  sheet: null as Sheet | null,
  search: false,
  autoType: null as { title: string; ids: string[] } | null,
  window: { mode: 'float', alwaysOnTop: false } as WindowState,
  theme: 'salvia' as ThemeId,
  fired: [] as FiredTask[],
  saving: false,
  savedAt: null as string | null,
  lockReason: null as string | null
})

// --- startup & auth -------------------------------------------------------------

export async function boot(): Promise<void> {
  S.app = await api<AppState>('app:state')
  S.window = await api<WindowState>('win:state')
  const last = S.app.settings.lastUser
  setTheme(last ? S.app.settings.themes[last] : null, false)
  if (last && S.app.sessions.includes(last)) S.auth = { name: 'lock', user: last }
  else if (S.app.users.length) S.auth = { name: 'login', user: last ?? S.app.users[0] }
  else S.auth = { name: 'signup' }
  S.phase = 'auth'

  onMain('vault:locked', (reason: string) => onLocked(reason))
  onMain('window:state', (w: WindowState) => (S.window = w))
  onMain('task:fired', (f: FiredTask) => S.fired.push(f))
  onMain('task:open', (f: FiredTask) => {
    if (S.user === f.user) {
      S.tab = 'agenda'
      if (!S.fired.some((x) => x.id === f.id)) S.fired.push(f)
    }
  })
  onMain('autotype:choose', (p: { title: string; ids: string[] }) => (S.autoType = p))
}

export async function enterVault(info: UnlockInfo): Promise<void> {
  S.user = info.user
  S.deviceId = info.deviceId
  skipNextSave = true
  S.data = info.data
  S.app = await api<AppState>('app:state')
  setTheme(S.app.settings.themes[info.user] ?? S.theme, false)
  S.fired = await api<FiredTask[]>('vault:fired')
  S.phase = 'app'
  S.lockReason = null
}

function onLocked(reason: string): void {
  if (S.phase !== 'app' || !S.user) return
  const user = S.user
  S.data = null
  S.sheet = null
  S.search = false
  S.autoType = null
  S.fired = []
  S.lockReason = reason
  S.auth = { name: 'lock', user }
  S.phase = 'auth'
}

export async function lockNow(): Promise<void> {
  await flushSave()
  await api('vault:lock')
}

export async function logout(): Promise<void> {
  await flushSave()
  S.app = await api<AppState>('vault:logout')
  const user = S.user
  S.data = null
  S.user = null
  S.sheet = null
  S.auth = { name: 'login', user: user ?? undefined }
  S.phase = 'auth'
}

// --- theme --------------------------------------------------------------------------

export function setTheme(id: string | null | undefined, persist = true): void {
  S.theme = applyTheme(id).id
  if (persist && S.user && S.app) {
    void api<AppState>('settings:set', { themes: { ...S.app.settings.themes, [S.user]: S.theme } }).then((a) => (S.app = a))
  }
}

// --- saving -----------------------------------------------------------------------

let skipNextSave = false
let timer: ReturnType<typeof setTimeout> | null = null
let inflight: Promise<void> | null = null

async function doSave(): Promise<void> {
  if (!S.data) return
  S.saving = true
  try {
    const merged = await api<VaultData | null>('vault:save', S.data)
    if (merged) {
      skipNextSave = true
      S.data = merged
    }
    S.savedAt = now()
  } finally {
    S.saving = false
  }
}

export async function flushSave(): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = null
    inflight = doSave()
  }
  await inflight
}

watch(
  () => S.data,
  () => {
    if (skipNextSave) {
      skipNextSave = false
      return
    }
    if (!S.data) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      inflight = doSave()
    }, 500)
  },
  { deep: true }
)

// --- data helpers -------------------------------------------------------------------

export const live = <T extends { deletedAt?: string | null }>(list: T[]): T[] => list.filter((i) => !i.deletedAt)

export function upsertAccess(a: Access): void {
  const d = S.data!
  const i = d.accesses.findIndex((x) => x.id === a.id)
  const prev = i >= 0 ? d.accesses[i] : null
  const next: Access = { ...a, updatedAt: now() }
  if (prev && prev.password && prev.password !== a.password) {
    next.history = [{ password: prev.password, changedAt: now() }, ...prev.history].slice(0, 10)
  }
  if (i >= 0) d.accesses.splice(i, 1, next)
  else d.accesses.unshift(next)
}

export function upsertNote(n: Note): void {
  const d = S.data!
  const i = d.notes.findIndex((x) => x.id === n.id)
  const next = { ...n, updatedAt: now() }
  if (i >= 0) d.notes.splice(i, 1, next)
  else d.notes.unshift(next)
}

export function openNewNote(): void {
  const n = newNote()
  upsertNote(n)
  S.tab = 'notes'
  S.sheet = { kind: 'note', id: n.id }
}

export function upsertTask(t: Task): void {
  const d = S.data!
  const i = d.tasks.findIndex((x) => x.id === t.id)
  const next = { ...t, updatedAt: now() }
  if (i >= 0) d.tasks.splice(i, 1, next)
  else d.tasks.unshift(next)
}

type Kind = 'accesses' | 'notes' | 'tasks'

export function trash(kind: Kind, id: string): void {
  const item = (S.data![kind] as Array<{ id: string; deletedAt?: string | null; updatedAt: string }>).find((x) => x.id === id)
  if (item) {
    item.deletedAt = now()
    item.updatedAt = now()
  }
}

export function restore(kind: Kind, id: string): void {
  const item = (S.data![kind] as Array<{ id: string; deletedAt?: string | null; updatedAt: string }>).find((x) => x.id === id)
  if (item) {
    item.deletedAt = null
    item.updatedAt = now()
  }
}

export function purge(kind: Kind, id: string): void {
  const list = S.data![kind] as Array<{ id: string }>
  const i = list.findIndex((x) => x.id === id)
  if (i >= 0) list.splice(i, 1)
}

/** Checking a repeating task moves it to its next date instead of closing it. */
export function toggleTask(t: Task): void {
  if (!t.done && t.due && t.repeat !== 'none') {
    upsertTask({ ...t, due: nextOccurrence(t.due, t.repeat), snoozedUntil: null })
  } else {
    upsertTask({ ...t, done: !t.done, doneAt: t.done ? null : now() })
  }
  S.fired = S.fired.filter((f) => f.id !== t.id)
}

export function snooze(id: string, minutes = 10): void {
  const t = S.data!.tasks.find((x) => x.id === id)
  if (t) upsertTask({ ...t, snoozedUntil: new Date(Date.now() + minutes * 60_000).toISOString() })
  S.fired = S.fired.filter((f) => f.id !== id)
}

export function quickTask(title: string, due: string | null): Task {
  const t = newTask(title, due)
  upsertTask(t)
  return t
}

export function categories(): string[] {
  const set = new Set(live(S.data?.accesses ?? []).map((a) => a.category || 'Geral'))
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
