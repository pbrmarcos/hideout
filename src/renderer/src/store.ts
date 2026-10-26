import { reactive, watch } from 'vue'
import { DEFAULT_CATEGORY, findCategory, newCategory, newNote, newTask, nextOccurrence, normalizeData, now } from '@shared/model'
import type { Access, AppState, Category, CustomTheme, ItemType, Lang, Note, SortMode, SoundId, Task, ThemeId, TimerState, UnlockInfo, VaultData, WindowState } from '@shared/types'
import { api, onMain } from './api'
import type { CustomId } from '@shared/themes'
import { lang, t } from './i18n'
import { playSound } from './sounds'
import { applyTheme } from './theme'

export type Phase = 'loading' | 'auth' | 'app'
export type Tab = 'todo' | 'accesses' | 'notes' | 'agenda'
const TABS: Tab[] = ['todo', 'accesses', 'notes', 'agenda']
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
  | { kind: 'leaks' }
  | { kind: 'theme'; id: CustomId }

export interface FiredTask {
  user: string
  id: string
  title: string
}

export interface ListView {
  sort: SortMode
  /** null = all, 'fav' = favorites, otherwise a category id */
  filter: string | null
}

function loadView(): ListView {
  try {
    return { sort: 'manual', filter: null, ...JSON.parse(localStorage.getItem('hx-view') ?? '{}') }
  } catch {
    return { sort: 'manual', filter: null }
  }
}

function loadTab(): Tab {
  try {
    const v = localStorage.getItem('hx-tab') as Tab | null
    return v && TABS.includes(v) ? v : 'todo'
  } catch {
    return 'todo'
  }
}

export const S = reactive({
  phase: 'loading' as Phase,
  auth: { name: 'signup' } as AuthStep,
  app: null as AppState | null,
  user: null as string | null,
  data: null as VaultData | null,
  deviceId: '',
  tab: loadTab(),
  sheet: null as Sheet | null,
  search: false,
  autoType: null as { title: string; ids: string[] } | null,
  /** Category editor: `id` null creates a new one. */
  categoryDialog: null as { id: string | null } | null,
  /** How the access list is shown on this computer. */
  view: loadView(),
  /** Last leak check, kept until the vault locks. */
  leaks: null as { at: string; found: Array<{ id: string; count: number }> } | null,
  window: { mode: 'float', alwaysOnTop: false } as WindowState,
  timer: { running: false, endsAt: null, remaining: 15 * 60_000, total: 15 * 60_000 } as TimerState,
  theme: 'salvia' as ThemeId,
  fired: [] as FiredTask[],
  saving: false,
  savedAt: null as string | null,
  lockReason: null as string | null
})

watch(
  () => S.tab,
  (tab) => {
    try {
      localStorage.setItem('hx-tab', tab)
    } catch {
      /* per-computer convenience only */
    }
  }
)

// --- startup & auth -------------------------------------------------------------

export async function boot(): Promise<void> {
  S.app = await api<AppState>('app:state')
  S.window = await api<WindowState>('win:state')
  S.timer = await api<TimerState>('timer:get')
  syncLang()
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
  onMain('tab:open', (tab: Tab) => {
    if (S.phase === 'app') (S.tab = tab), (S.sheet = null)
  })
  onMain('timer:state', (st: TimerState) => (S.timer = st))
  onMain('sound:play', (p: { sound: SoundId; volume: number }) => playSound(p.sound, p.volume))
  onMain('autotype:choose', (p: { title: string; ids: string[] }) => (S.autoType = p))
}

export async function enterVault(info: UnlockInfo): Promise<void> {
  S.user = info.user
  S.deviceId = info.deviceId
  const before = JSON.stringify(info.data.categories ?? null)
  const data = normalizeData(info.data)
  // Save right away only when an older vault just gained its categories.
  skipNextSave = before === JSON.stringify(data.categories)
  S.data = data
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
  S.leaks = null
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
  S.theme = applyTheme(id, S.app?.settings.customThemes).id
  if (persist && S.user && S.app) {
    void api<AppState>('settings:set', { themes: { ...S.app.settings.themes, [S.user]: S.theme } }).then((a) => (S.app = a))
  }
}

/** Saves a custom theme slot and shows it. */
export async function saveCustomTheme(id: CustomId, theme: CustomTheme): Promise<void> {
  S.app = await api<AppState>('settings:set', { customThemes: { ...S.app!.settings.customThemes, [id]: theme } })
  setTheme(id)
}

// --- language ---------------------------------------------------------------------------

function syncLang(): void {
  if (S.app) lang.value = S.app.settings.lang ?? S.app.systemLang
}

export async function setLang(l: Lang | null): Promise<void> {
  S.app = await api<AppState>('settings:set', { lang: l })
  syncLang()
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
      S.data = normalizeData(merged)
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
  // Use the existing spelling of the category, or create it.
  next.category = (createCategory(next.category || DEFAULT_CATEGORY) ?? findCategory(d, DEFAULT_CATEGORY))?.name ?? DEFAULT_CATEGORY
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
  if (!due) t.order = todoList().reduce((m, x) => Math.min(m, x.order ?? 0), 0) - 1
  upsertTask(t)
  return t
}

/** Open tasks without a date, in the user's order (new ones on top). */
export function todoList(): Task[] {
  return live(S.data?.tasks ?? [])
    .filter((x) => !x.done && !x.due)
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || b.createdAt.localeCompare(a.createdAt))
}

/** Drops a TO DO item before `beforeId` (or at the end), renumbering the list. */
export function placeTask(id: string, beforeId: string | null): void {
  if (id === beforeId) return
  const moving = S.data!.tasks.find((x) => x.id === id)
  if (!moving) return
  const list = todoList().filter((x) => x.id !== id)
  const at = beforeId ? list.findIndex((x) => x.id === beforeId) : -1
  list.splice(at < 0 ? list.length : at, 0, moving)
  const t = now()
  list.forEach((x, i) => {
    if (x.order !== i) Object.assign(x, { order: i, updatedAt: t })
  })
}

// --- categories --------------------------------------------------------------------------

/** Live categories in the user's order. */
export function categoryList(): Category[] {
  return live(S.data?.categories ?? []).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'))
}

/** "Geral" is stored in Portuguese; show it in the UI language. User-created names stay as typed. */
export function catName(name: string): string {
  return name === DEFAULT_CATEGORY ? t(DEFAULT_CATEGORY) : name
}

export function categories(): string[] {
  return categoryList().map((c) => c.name)
}

export function createCategory(name: string, icon?: string, color?: string): Category | null {
  const d = S.data!
  const clean = name.trim()
  if (!clean) return null
  const existing = findCategory(d, clean)
  if (existing) return existing
  const order = categoryList().reduce((m, c) => Math.max(m, c.order), -1) + 1
  const c = newCategory(clean, order, icon, color)
  d.categories.push(c)
  return c
}

/** Renames a category and moves every access (trash included) to the new name. */
export function updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'icon' | 'color'>>): string | null {
  const d = S.data!
  const c = d.categories.find((x) => x.id === id)
  if (!c) return null
  const newName = patch.name?.trim()
  if (newName && newName !== c.name) {
    const clash = findCategory(d, newName)
    if (clash && clash.id !== id) return 'Já existe uma categoria com esse nome.'
    for (const a of d.accesses) if ((a.category || DEFAULT_CATEGORY) === c.name) Object.assign(a, { category: newName, updatedAt: now() })
    c.name = newName
  }
  if (patch.icon) c.icon = patch.icon
  if (patch.color) c.color = patch.color
  c.updatedAt = now()
  return null
}

/** Deletes a category; its accesses move to "Geral" (created if needed). */
export function deleteCategory(id: string): number {
  const d = S.data!
  const c = d.categories.find((x) => x.id === id)
  if (!c) return 0
  const target = c.name === DEFAULT_CATEGORY ? null : (findCategory(d, DEFAULT_CATEGORY) ?? createCategory(DEFAULT_CATEGORY))
  let moved = 0
  for (const a of d.accesses) {
    if ((a.category || DEFAULT_CATEGORY) === c.name && !a.deletedAt) {
      if (!target) return -1
      Object.assign(a, { category: target.name, updatedAt: now() })
      moved++
    }
  }
  c.deletedAt = now()
  c.updatedAt = now()
  return moved
}

export function moveCategory(id: string, delta: -1 | 1): void {
  const list = categoryList()
  const i = list.findIndex((c) => c.id === id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j], list[i]]
  list.forEach((c, k) => {
    if (c.order !== k) Object.assign(c, { order: k, updatedAt: now() })
  })
}

export function moveAccess(accessId: string, category: string): void {
  const a = S.data!.accesses.find((x) => x.id === accessId)
  if (!a) return
  const last = live(S.data!.accesses).filter((x) => x.category === category).reduce((m, x) => Math.max(m, x.order ?? 0), -1)
  upsertAccess({ ...a, category, order: a.category === category ? a.order : last + 1 })
}

/** Drops an access before `beforeId` (or at the end of `category` when null), renumbering that category. */
export function placeAccess(accessId: string, category: string, beforeId: string | null): void {
  const d = S.data!
  const moving = d.accesses.find((x) => x.id === accessId)
  if (!moving || accessId === beforeId) return
  const list = live(d.accesses)
    .filter((x) => x.category === category && x.id !== accessId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const at = beforeId ? list.findIndex((x) => x.id === beforeId) : -1
  list.splice(at < 0 ? list.length : at, 0, moving)
  const t = now()
  list.forEach((x, i) => {
    if (x.order !== i || x.category !== category) Object.assign(x, { order: i, category, updatedAt: t })
  })
}

/** Drops a category before `beforeId` (or at the end). */
export function placeCategory(id: string, beforeId: string | null): void {
  if (id === beforeId) return
  const list = categoryList().filter((c) => c.id !== id)
  const moving = S.data!.categories.find((c) => c.id === id)
  if (!moving) return
  const at = beforeId ? list.findIndex((c) => c.id === beforeId) : -1
  list.splice(at < 0 ? list.length : at, 0, moving)
  const t = now()
  list.forEach((c, i) => {
    if (c.order !== i) Object.assign(c, { order: i, updatedAt: t })
  })
}

/** Counts a copy / open so "most used" sorting has something to go on. */
export function markUsed(accessId: string): void {
  const a = S.data?.accesses.find((x) => x.id === accessId)
  if (a) Object.assign(a, { useCount: (a.useCount ?? 0) + 1, lastUsedAt: now(), updatedAt: now() })
}

export function setView(patch: Partial<ListView>): void {
  Object.assign(S.view, patch)
  try {
    localStorage.setItem('hx-view', JSON.stringify(S.view))
  } catch {
    /* per-computer convenience only */
  }
}

export function sortAccesses(list: Access[], mode: SortMode): Access[] {
  const byName = (a: Access, b: Access): number => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  const copy = [...list]
  if (mode === 'name') return copy.sort(byName)
  if (mode === 'used') return copy.sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0) || byName(a, b))
  if (mode === 'recent') return copy.sort((a, b) => (b.lastUsedAt ?? b.updatedAt).localeCompare(a.lastUsedAt ?? a.updatedAt))
  return copy.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || byName(a, b))
}
