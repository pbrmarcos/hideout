import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Settings } from '@shared/types'

export const dataDir = (): string => app.getPath('userData')
export const userDir = (user: string): string => join(dataDir(), 'users', user)

export function defaultVaultDir(): string {
  if (process.env.HIDEOUT_VAULT_DIR) return process.env.HIDEOUT_VAULT_DIR
  const oneDrive = process.env.OneDrive || process.env.OneDriveConsumer || join(homedir(), 'OneDrive')
  return join(existsSync(oneDrive) ? oneDrive : homedir(), 'Hideout-Dados')
}

export function writeAtomic(path: string, content: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, content)
  renameSync(tmp, path)
}

export function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return fallback
  }
}

/** Files only this Windows user on this PC can read (DPAPI via safeStorage). */
export async function writeProtected(path: string, value: unknown): Promise<void> {
  writeAtomic(path, await safeStorage.encryptStringAsync(JSON.stringify(value)))
}

export async function readProtected<T>(path: string): Promise<T | null> {
  try {
    const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(readFileSync(path))
    if (shouldReEncrypt) writeAtomic(path, await safeStorage.encryptStringAsync(result))
    return JSON.parse(result) as T
  } catch {
    return null
  }
}

export function remove(path: string): void {
  rmSync(path, { force: true, recursive: true })
}

const settingsPath = (): string => join(dataDir(), 'settings.json')

export function loadSettings(): Settings {
  const defaults: Settings = {
    vaultDir: defaultVaultDir(),
    lastUser: null,
    autoLockMinutes: 5,
    clipboardSeconds: 30,
    lockOnWindowsLock: true,
    startWithWindows: false,
    autoType: true,
    themes: {},
    lang: null,
    customThemes: {},
    alerts: { agendaNotify: true, agendaLead: 0, agendaSound: 'chime', todoDaily: null, todoSound: 'soft', timerSound: 'bell', volume: 0.7 }
  }
  const saved = readJson<Partial<Settings>>(settingsPath(), {})
  return { ...defaults, ...saved, alerts: { ...defaults.alerts, ...saved.alerts } }
}

export function saveSettings(s: Settings): void {
  writeAtomic(settingsPath(), JSON.stringify(s, null, 2))
}
