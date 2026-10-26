import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { join } from 'node:path'
import { tr } from '@shared/i18n'
import { emptyData, mergeData, normalizeUser, now, purgeTrash } from '@shared/model'
import type { AttachmentRef, LoginStep, Schedule, ScheduledTask, SignupStart, UnlockInfo, VaultData } from '@shared/types'
import {
  KDF, deriveKey, newRecoveryCode, newTotpSecret, normalizeRecoveryCode, open, otpauthUri, seal, verifyTotp, type Sealed
} from './crypto'
import { dataDir, readProtected, remove, userDir, writeProtected } from './storage'
import {
  attachmentsDir, conflictCopies, listVaultUsers, mtimeOf, readVaultFile, vaultPath, writeVaultFile, type VaultFile
} from './vaultfile'

const MAX_PIN_ATTEMPTS = 5
const MAX_ATTACHMENT = 10 * 1024 * 1024

export class VaultError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

interface Session {
  vaultId: string
  salt: string
  wrap: Sealed
  attempts: number
}

interface Trust {
  vaultId: string
  deviceId: string
}

interface Pending {
  mode: 'signup' | 'login' | 'recover'
  user: string
  key: Buffer
  file: VaultFile | null
  password?: string
  totpSecret?: string
  totpOk: boolean
  recoveryCode?: string
}

const aad = (id: string, part: string): string => `${id}:${part}`

export class VaultService {
  private key: Buffer | null = null
  private file: VaultFile | null = null
  private data: VaultData | null = null
  private user: string | null = null
  private mtime = 0
  private pending: Pending | null = null

  constructor(private getDir: () => string) {}

  // --- local, per-PC state -------------------------------------------------

  private devId = ''

  /** Loads (or creates) this PC's random id. Call once after app ready. */
  async init(): Promise<void> {
    const path = join(dataDir(), 'device.bin')
    const saved = await readProtected<{ id: string }>(path)
    this.devId = saved?.id ?? randomUUID()
    if (!saved?.id) await writeProtected(path, { id: this.devId })
  }

  deviceId(): string {
    return this.devId
  }

  private sessionPath = (user: string): string => join(userDir(user), 'session.bin')
  private trustPath = (user: string): string => join(userDir(user), 'trust.bin')
  private schedulePath = (user: string): string => join(userDir(user), 'schedule.bin')

  users(): string[] {
    return [...new Set(listVaultUsers(this.getDir()))]
  }

  sessions(): string[] {
    const root = join(dataDir(), 'users')
    if (!existsSync(root)) return []
    return readdirSync(root).filter((u) => existsSync(this.sessionPath(u)))
  }

  get unlockedUser(): string | null {
    return this.key ? this.user : null
  }

  get current(): VaultData | null {
    return this.key ? this.data : null
  }

  conflicts(): string[] {
    return this.user ? conflictCopies(this.getDir(), this.user) : []
  }

  // --- signup ----------------------------------------------------------------

  async signupBegin(rawUser: string, password: string): Promise<SignupStart> {
    const user = normalizeUser(rawUser)
    if (!user) throw new VaultError('bad_user', tr('Escolha um nome de usuário com letras ou números.'))
    if (password.length < 12) throw new VaultError('weak_password', tr('A senha mestra precisa ter pelo menos 12 caracteres.'))
    if (existsSync(vaultPath(this.getDir(), user))) throw new VaultError('user_exists', tr('Já existe uma conta com esse usuário nesta pasta.'))
    const totpSecret = newTotpSecret()
    this.pending = { mode: 'signup', user, key: randomBytes(32), file: null, password, totpSecret, totpOk: false, recoveryCode: newRecoveryCode() }
    return { otpauth: otpauthUri(totpSecret, user), secret: totpSecret }
  }

  verifyPendingTotp(code: string): void {
    const p = this.requirePending()
    if (!p.totpSecret || !verifyTotp(p.totpSecret, code)) throw new VaultError('bad_totp', tr('Código incorreto. Confira o horário do celular e tente o código novo.'))
    p.totpOk = true
  }

  /** Last step of signup / recovery / first login on this PC. Returns the recovery code when one was created. */
  async finishWithPin(pin: string): Promise<{ recoveryCode: string | null; info: UnlockInfo }> {
    const p = this.requirePending()
    if (!/^\d{6}$/.test(pin)) throw new VaultError('bad_pin', tr('O PIN precisa ter 6 dígitos.'))
    let recoveryCode: string | null = null

    if (p.mode === 'signup') {
      if (!p.totpOk) throw new VaultError('bad_totp', tr('Confirme o código do autenticador primeiro.'))
      const id = randomUUID()
      const pwSalt = randomBytes(16), rcSalt = randomBytes(16)
      const [pwKey, rcKey] = await Promise.all([deriveKey(p.password!, pwSalt), deriveKey(normalizeRecoveryCode(p.recoveryCode!), rcSalt)])
      const data = emptyData()
      const t = now()
      this.file = {
        format: 'hideout-vault', v: 1, id, user: p.user, kdf: KDF,
        pw: { salt: pwSalt.toString('base64'), wrap: seal(pwKey, p.key, aad(id, 'pw')) },
        rc: { salt: rcSalt.toString('base64'), wrap: seal(rcKey, p.key, aad(id, 'rc')) },
        totp: seal(p.key, Buffer.from(p.totpSecret!), aad(id, 'totp')),
        data: seal(p.key, Buffer.from(JSON.stringify(data)), aad(id, 'data')),
        headerAt: t, updatedAt: t
      }
      this.data = data
      recoveryCode = p.recoveryCode!
    } else if (p.mode === 'recover') {
      if (!p.totpOk || !p.password) throw new VaultError('bad_totp', tr('Confirme o novo código do autenticador primeiro.'))
      const f = p.file!
      const pwSalt = randomBytes(16)
      const pwKey = await deriveKey(p.password, pwSalt)
      f.pw = { salt: pwSalt.toString('base64'), wrap: seal(pwKey, p.key, aad(f.id, 'pw')) }
      f.totp = seal(p.key, Buffer.from(p.totpSecret!), aad(f.id, 'totp'))
      f.headerAt = now()
      this.file = f
      this.data = JSON.parse(open(p.key, f.data, aad(f.id, 'data')).toString('utf8'))
    } else {
      this.file = p.file
      this.data = JSON.parse(open(p.key, p.file!.data, aad(p.file!.id, 'data')).toString('utf8'))
    }

    this.key = p.key
    this.user = p.user
    this.pending = null
    this.touchDevice()
    await this.writeSession(pin)
    await writeProtected(this.trustPath(this.user), { vaultId: this.file!.id, deviceId: this.deviceId() } satisfies Trust)
    this.persist()
    return { recoveryCode, info: this.info() }
  }

  cancelPending(): void {
    this.pending = null
  }

  // --- login -----------------------------------------------------------------

  async login(rawUser: string, password: string, totp?: string): Promise<LoginStep> {
    const user = normalizeUser(rawUser)
    const path = vaultPath(this.getDir(), user)
    if (!existsSync(path)) throw new VaultError('bad_credentials', tr('Usuário ou senha incorretos.'))
    const f = readVaultFile(path)
    let key: Buffer
    try {
      key = open(await deriveKey(password, Buffer.from(f.pw.salt, 'base64'), f.kdf), f.pw.wrap, aad(f.id, 'pw'))
    } catch {
      throw new VaultError('bad_credentials', tr('Usuário ou senha incorretos.'))
    }
    const data = JSON.parse(open(key, f.data, aad(f.id, 'data')).toString('utf8')) as VaultData
    if (!(await this.isTrusted(user, f.id, data))) {
      if (!totp) return { needTotp: true, needPin: false }
      const secret = open(key, f.totp, aad(f.id, 'totp')).toString('utf8')
      if (!verifyTotp(secret, totp)) throw new VaultError('bad_totp', tr('Código do autenticador incorreto.'))
    }
    this.pending = { mode: 'login', user, key, file: f, totpOk: true }
    return { needTotp: false, needPin: true }
  }

  async unlockWithPin(user: string, pin: string): Promise<UnlockInfo> {
    const s = await readProtected<Session>(this.sessionPath(user))
    if (!s) throw new VaultError('no_session', tr('Entre com usuário e senha.'))
    const path = vaultPath(this.getDir(), user)
    if (!existsSync(path)) throw new VaultError('no_vault', tr('O arquivo do cofre não foi encontrado. Confira a pasta em Configurações.'))
    const f = readVaultFile(path)
    let key: Buffer
    try {
      key = open(await deriveKey(pin, Buffer.from(s.salt, 'base64')), s.wrap, aad(s.vaultId, 'pin'))
    } catch {
      s.attempts += 1
      if (s.attempts >= MAX_PIN_ATTEMPTS) {
        this.logout(user)
        throw new VaultError('pin_locked', tr('PIN errado 5 vezes. Por segurança, entre com usuário e senha.'))
      }
      await writeProtected(this.sessionPath(user), s)
      const left = MAX_PIN_ATTEMPTS - s.attempts
      throw new VaultError('bad_pin', left === 1 ? tr('PIN incorreto. Resta 1 tentativa.') : tr('PIN incorreto. Restam {left} tentativas.', { left }))
    }
    if (f.id !== s.vaultId) {
      this.logout(user)
      throw new VaultError('no_session', tr('O cofre mudou. Entre com usuário e senha.'))
    }
    const data = JSON.parse(open(key, f.data, aad(f.id, 'data')).toString('utf8')) as VaultData
    if (!data.devices.some((d) => d.id === this.deviceId())) {
      this.forgetDevice(user)
      throw new VaultError('revoked', tr('Este computador foi removido da conta. Entre com usuário, senha e 2FA.'))
    }
    if (s.attempts) await writeProtected(this.sessionPath(user), { ...s, attempts: 0 })
    this.key = key
    this.file = f
    this.data = data
    this.user = user
    this.mtime = mtimeOf(path)
    this.touchDevice()
    this.persist()
    return this.info()
  }

  private async isTrusted(user: string, vaultId: string, data: VaultData): Promise<boolean> {
    const t = await readProtected<Trust>(this.trustPath(user))
    return !!t && t.vaultId === vaultId && t.deviceId === this.deviceId() && data.devices.some((d) => d.id === t.deviceId)
  }

  lock(): void {
    this.key?.fill(0)
    this.key = null
    this.data = null
    this.file = null
    this.pending = null
  }

  /** Signs out on this PC: keeps the PC trusted, so next login needs only user + password. */
  logout(user = this.user): void {
    if (this.user === user) this.lock()
    if (!user) return
    remove(this.sessionPath(user))
    remove(this.schedulePath(user))
  }

  private forgetDevice(user: string): void {
    this.logout(user)
    remove(this.trustPath(user))
  }

  // --- recovery ----------------------------------------------------------------

  async recoverBegin(rawUser: string, code: string): Promise<void> {
    const user = normalizeUser(rawUser)
    const path = vaultPath(this.getDir(), user)
    if (!existsSync(path)) throw new VaultError('bad_recovery', tr('Usuário ou código de recuperação incorretos.'))
    const f = readVaultFile(path)
    try {
      const key = open(await deriveKey(normalizeRecoveryCode(code), Buffer.from(f.rc.salt, 'base64'), f.kdf), f.rc.wrap, aad(f.id, 'rc'))
      this.pending = { mode: 'recover', user, key, file: f, totpOk: false }
    } catch {
      throw new VaultError('bad_recovery', tr('Usuário ou código de recuperação incorretos.'))
    }
  }

  recoverSetPassword(password: string): SignupStart {
    const p = this.requirePending()
    if (password.length < 12) throw new VaultError('weak_password', tr('A senha mestra precisa ter pelo menos 12 caracteres.'))
    p.password = password
    p.totpSecret = newTotpSecret()
    return { otpauth: otpauthUri(p.totpSecret, p.user), secret: p.totpSecret }
  }

  // --- account changes while unlocked -------------------------------------------

  async checkPassword(password: string): Promise<void> {
    const f = this.requireFile()
    try {
      open(await deriveKey(password, Buffer.from(f.pw.salt, 'base64'), f.kdf), f.pw.wrap, aad(f.id, 'pw'))
    } catch {
      throw new VaultError('bad_password', tr('Senha mestra incorreta.'))
    }
  }

  async changePassword(current: string, next: string): Promise<void> {
    await this.checkPassword(current)
    if (next.length < 12) throw new VaultError('weak_password', tr('A nova senha precisa ter pelo menos 12 caracteres.'))
    const f = this.requireFile()
    const salt = randomBytes(16)
    f.pw = { salt: salt.toString('base64'), wrap: seal(await deriveKey(next, salt), this.key!, aad(f.id, 'pw')) }
    f.headerAt = now()
    this.persist()
  }

  async changePin(pin: string): Promise<void> {
    if (!/^\d{6}$/.test(pin)) throw new VaultError('bad_pin', tr('O PIN precisa ter 6 dígitos.'))
    this.requireFile()
    await this.writeSession(pin)
  }

  async newRecovery(password: string): Promise<string> {
    await this.checkPassword(password)
    const f = this.requireFile()
    const code = newRecoveryCode()
    const salt = randomBytes(16)
    f.rc = { salt: salt.toString('base64'), wrap: seal(await deriveKey(normalizeRecoveryCode(code), salt), this.key!, aad(f.id, 'rc')) }
    f.headerAt = now()
    this.persist()
    return code
  }

  private totpDraft: string | null = null

  async totpResetBegin(password: string): Promise<SignupStart> {
    await this.checkPassword(password)
    this.totpDraft = newTotpSecret()
    return { otpauth: otpauthUri(this.totpDraft, this.user!), secret: this.totpDraft }
  }

  totpResetConfirm(code: string): void {
    const f = this.requireFile()
    if (!this.totpDraft || !verifyTotp(this.totpDraft, code)) throw new VaultError('bad_totp', tr('Código incorreto.'))
    f.totp = seal(this.key!, Buffer.from(this.totpDraft), aad(f.id, 'totp'))
    f.headerAt = now()
    this.totpDraft = null
    this.persist()
  }

  // --- data ------------------------------------------------------------------

  /** Saves the renderer's copy. Returns the merged result when another PC changed the file meanwhile. */
  save(next: VaultData): VaultData | null {
    this.requireFile()
    this.data = next
    return this.persist()
  }

  private persist(): VaultData | null {
    const f = this.requireFile()
    const path = vaultPath(this.getDir(), this.user!)
    let merged: VaultData | null = null
    const diskTime = mtimeOf(path)
    if (diskTime && this.mtime && diskTime !== this.mtime) {
      try {
        const disk = readVaultFile(path)
        if (disk.id === f.id) {
          const diskData = JSON.parse(open(this.key!, disk.data, aad(f.id, 'data')).toString('utf8')) as VaultData
          this.data = mergeData(diskData, this.data!)
          merged = this.data
          if (disk.headerAt > f.headerAt) Object.assign(f, { pw: disk.pw, rc: disk.rc, totp: disk.totp, headerAt: disk.headerAt })
        }
      } catch {
        // Unreadable copy on disk (partial sync): our version wins, the backup keeps theirs.
      }
    }
    this.data = purgeTrash(this.data!)
    f.data = seal(this.key!, Buffer.from(JSON.stringify(this.data)), aad(f.id, 'data'))
    f.updatedAt = now()
    this.mtime = writeVaultFile(path, f)
    void this.writeSchedule()
    return merged
  }

  removeDevice(id: string): VaultData {
    const d = this.requireData()
    d.devices = d.devices.filter((x) => x.id !== id)
    this.persist()
    return d
  }

  private touchDevice(): void {
    const d = this.data!
    const id = this.deviceId()
    const t = now()
    const cur = d.devices.find((x) => x.id === id)
    if (cur) cur.lastSeen = t
    else d.devices.push({ id, name: hostname(), firstSeen: t, lastSeen: t })
  }

  private async writeSession(pin: string): Promise<void> {
    const salt = randomBytes(16)
    const key = await deriveKey(pin, salt)
    await writeProtected(this.sessionPath(this.user!), {
      vaultId: this.file!.id, salt: salt.toString('base64'), wrap: seal(key, this.key!, aad(this.file!.id, 'pin')), attempts: 0
    } satisfies Session)
  }

  // --- reminders schedule (readable while locked) --------------------------------

  private async writeSchedule(): Promise<void> {
    if (!this.user || !this.data || !existsSync(this.sessionPath(this.user))) return
    const open = this.data.tasks.filter((t) => !t.deletedAt && !t.done)
    const schedule: Schedule = {
      tasks: open.filter((t) => t.due).map((t) => ({ id: t.id, title: t.title, due: t.due!, snoozedUntil: t.snoozedUntil ?? null })),
      pendingTodos: open.filter((t) => !t.due).length
    }
    await writeProtected(this.schedulePath(this.user), schedule)
  }

  schedules(): Promise<Array<{ user: string } & Schedule>> {
    return Promise.all(this.sessions().map(async (user) => {
      const s = await readProtected<Schedule | ScheduledTask[]>(this.schedulePath(user))
      // 0.1 stored a bare array of tasks.
      return { user, ...(Array.isArray(s) ? { tasks: s, pendingTodos: 0 } : (s ?? { tasks: [], pendingTodos: 0 })) }
    }))
  }

  // --- attachments ---------------------------------------------------------------

  addAttachment(name: string, mime: string, content: Buffer): AttachmentRef {
    const f = this.requireFile()
    if (content.length > MAX_ATTACHMENT) throw new VaultError('too_big', tr('O anexo pode ter no máximo 10 MB.'))
    const ref: AttachmentRef = { id: randomUUID(), name, size: content.length, mime, addedAt: now() }
    const dir = attachmentsDir(this.getDir(), this.user!)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, `${ref.id}.bin`), JSON.stringify(seal(this.key!, content, aad(f.id, `att:${ref.id}`))))
    return ref
  }

  readAttachment(id: string): Buffer {
    const f = this.requireFile()
    const sealed = JSON.parse(readFileSync(join(attachmentsDir(this.getDir(), this.user!), `${id}.bin`), 'utf8')) as Sealed
    return open(this.key!, sealed, aad(f.id, `att:${id}`))
  }

  /** Deletes attachment files no longer referenced by any item (trash included). */
  pruneAttachments(): void {
    const d = this.data
    if (!d || !this.user) return
    const used = new Set([...d.accesses, ...d.notes].flatMap((i) => i.attachments.map((a) => a.id)))
    const dir = attachmentsDir(this.getDir(), this.user)
    if (!existsSync(dir)) return
    for (const file of readdirSync(dir)) {
      if (file.endsWith('.bin') && !used.has(file.slice(0, -4))) rmSync(join(dir, file), { force: true })
    }
  }

  vaultFilePath(): string | null {
    return this.user ? vaultPath(this.getDir(), this.user) : null
  }

  info(): UnlockInfo {
    return { user: this.user!, data: this.data!, deviceId: this.deviceId() }
  }

  private requirePending(): Pending {
    if (!this.pending) throw new VaultError('no_pending', tr('Recomece o processo.'))
    return this.pending
  }

  private requireFile(): VaultFile {
    if (!this.key || !this.file || !this.data) throw new VaultError('locked', tr('O cofre está trancado.'))
    return this.file
  }

  private requireData(): VaultData {
    this.requireFile()
    return this.data!
  }
}
