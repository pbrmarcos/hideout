export type ItemType = 'login' | 'card' | 'wifi' | 'document' | 'bank' | 'server'
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly'
export type ThemeId =
  | 'salvia' | 'lavanda' | 'areia' | 'nevoa' | 'noite'
  | 'oceano' | 'rubi' | 'onix' | 'matrix'
  | 'custom1' | 'custom2' | 'custom3'
export type WindowMode = 'float' | 'left' | 'right'
export type Lang = 'pt' | 'en' | 'es'
export type SortMode = 'manual' | 'name' | 'used' | 'recent'

/** Colors a user can set in a custom theme. Missing ones are derived (see completeTheme). */
export interface CustomTheme {
  name: string
  dark: boolean
  mono: boolean
  bg: string
  surface: string
  ink: string
  muted: string
  line: string
  primary: string
  onPrimary: string
  soft: string
  softInk: string
  warn: string
  danger: string
}

export interface Field {
  id: string
  label: string
  value: string
  secret: boolean
}

export interface AttachmentRef {
  id: string
  name: string
  size: number
  mime: string
  addedAt: string
}

export interface PasswordHistory {
  password: string
  changedAt: string
}

/** Soft delete: `deletedAt` set means the item is in the trash (kept 30 days). */
interface Base {
  id: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface Access extends Base {
  type: ItemType
  title: string
  url: string
  username: string
  password: string
  notes: string
  category: string
  tags: string[]
  favorite: boolean
  fields: Field[]
  attachments: AttachmentRef[]
  history: PasswordHistory[]
  /** Position inside its category when sorting by "my order" (added in 0.2). */
  order?: number
  useCount?: number
  lastUsedAt?: string | null
}

export interface Note extends Base {
  title: string
  body: string
  color: string
  pinned: boolean
  attachments: AttachmentRef[]
}

export interface Task extends Base {
  title: string
  notes: string
  due: string | null
  repeat: Repeat
  done: boolean
  doneAt?: string | null
  snoozedUntil?: string | null
  /** Position in the TO DO list (added in 0.2). */
  order?: number
}

/** Accesses refer to their category by name; renaming a category renames it on every access. */
export interface Category extends Base {
  name: string
  icon: string
  color: string
  order: number
}

export interface Device {
  id: string
  name: string
  firstSeen: string
  lastSeen: string
}

export interface VaultData {
  v: 1
  accesses: Access[]
  notes: Note[]
  tasks: Task[]
  devices: Device[]
  /** Added in 0.2; vaults from 0.1 get it on first open (see normalizeData). */
  categories: Category[]
}

export interface Settings {
  vaultDir: string
  lastUser: string | null
  autoLockMinutes: number
  clipboardSeconds: number
  lockOnWindowsLock: boolean
  startWithWindows: boolean
  autoType: boolean
  themes: Record<string, ThemeId>
  /** null follows the Windows language. */
  lang: Lang | null
  customThemes: Partial<Record<'custom1' | 'custom2' | 'custom3', CustomTheme>>
  alerts: AlertSettings
  /** Looks for a new version on GitHub when the app opens and once a day. */
  checkUpdates: boolean
}

/**
 * dev: not a packaged build. manual: portable build, which cannot replace itself, so the user downloads it.
 */
export type UpdateStatus = 'idle' | 'dev' | 'checking' | 'latest' | 'downloading' | 'ready' | 'manual' | 'error'
export interface UpdateState {
  status: UpdateStatus
  /** The new version, when there is one. */
  version: string | null
  percent: number
  checkedAt: string | null
}

export type SoundId = 'chime' | 'bell' | 'soft' | 'pop' | 'marimba' | 'digital' | 'windows' | 'none'

export interface AlertSettings {
  /** Windows notification for Agenda reminders */
  agendaNotify: boolean
  /** Minutes before the due time (0 = on time) */
  agendaLead: number
  agendaSound: SoundId
  /** Daily summary of pending TO DO items at "HH:MM", or null */
  todoDaily: string | null
  todoSound: SoundId
  timerSound: SoundId
  /** 0 to 1 */
  volume: number
}

export interface TimerState {
  running: boolean
  /** epoch ms when it ends (running) */
  endsAt: number | null
  /** ms left (paused or idle) */
  remaining: number
  /** length it was started with */
  total: number
}

export interface LeakResult {
  id: string
  count: number
}

export interface AppState {
  settings: Settings
  users: string[]
  sessions: string[]
  version: string
  /** Windows display language, used when settings.lang is null. */
  systemLang: Lang
}

export interface WindowState {
  mode: WindowMode
  alwaysOnTop: boolean
}

export type Result<T = undefined> =
  | ({ ok: true } & (T extends undefined ? {} : { value: T }))
  | { ok: false; error: string; code?: string }

export interface UnlockInfo {
  user: string
  data: VaultData
  deviceId: string
}

export interface SignupStart {
  otpauth: string
  secret: string
}

export interface LoginStep {
  needTotp: boolean
  needPin: boolean
}

export interface CsvRow {
  name: string
  url: string
  username: string
  password: string
  note: string
}

export interface ScheduledTask {
  id: string
  title: string
  due: string
  snoozedUntil?: string | null
}

/** What the main process can read while the vault is locked (titles and times only). */
export interface Schedule {
  tasks: ScheduledTask[]
  /** open TO DO items without a date, for the daily summary */
  pendingTodos: number
}
