import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { KdfParams, Sealed } from './crypto'

/** On-disk format. Everything except the header metadata is AES-256-GCM encrypted. */
export interface VaultFile {
  format: 'hideout-vault'
  v: 1
  id: string
  user: string
  kdf: KdfParams
  /** vault key wrapped with scrypt(master password) */
  pw: { salt: string; wrap: Sealed }
  /** vault key wrapped with scrypt(recovery code) */
  rc: { salt: string; wrap: Sealed }
  /** TOTP secret, encrypted with the vault key */
  totp: Sealed
  data: Sealed
  headerAt: string
  updatedAt: string
}

const BACKUPS = 5

export const vaultPath = (dir: string, user: string): string => join(dir, `${user}.vault`)
export const attachmentsDir = (dir: string, user: string): string => join(dir, `${user}.anexos`)

export function readVaultFile(path: string): VaultFile {
  const f = JSON.parse(readFileSync(path, 'utf8')) as VaultFile
  if (f.format !== 'hideout-vault' || f.v !== 1) throw new Error('Arquivo de cofre inválido')
  return f
}

export function mtimeOf(path: string): number {
  try {
    return statSync(path).mtimeMs
  } catch {
    return 0
  }
}

/** Atomic write with rotating backups (.bak1 is the most recent). */
export function writeVaultFile(path: string, file: VaultFile): number {
  mkdirSync(join(path, '..'), { recursive: true })
  if (existsSync(path)) {
    for (let i = BACKUPS - 1; i >= 1; i--) {
      const from = `${path}.bak${i}`
      if (existsSync(from)) renameSync(from, `${path}.bak${i + 1}`)
    }
    copyFileSync(path, `${path}.bak1`)
  }
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(file))
  renameSync(tmp, path)
  return mtimeOf(path)
}

export function listVaultUsers(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.vault'))
      .map((f) => {
        try {
          return readVaultFile(join(dir, f)).user
        } catch {
          return null
        }
      })
      .filter((u): u is string => !!u && existsSync(vaultPath(dir, u)))
      .sort()
  } catch {
    return []
  }
}

/** OneDrive names conflicting copies like "marco-DESKTOP-1234.vault". */
export function conflictCopies(dir: string, user: string): string[] {
  try {
    return readdirSync(dir).filter((f) => f.startsWith(`${user}-`) && f.endsWith('.vault') && f !== basename(vaultPath(dir, user)))
  } catch {
    return []
  }
}
