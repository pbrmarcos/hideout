export type ItemType = 'login' | 'card' | 'wifi' | 'document' | 'bank' | 'server'
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly'
export type ThemeId =
  | 'salvia' | 'lavanda' | 'areia' | 'nevoa' | 'noite'
  | 'oceano' | 'rubi' | 'matrix'
export type WindowMode = 'float' | 'left' | 'right'

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
}

export interface AppState {
  settings: Settings
  users: string[]
  sessions: string[]
  version: string
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
