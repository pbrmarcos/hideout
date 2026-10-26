import type { Access, Field, ItemType, Note, Repeat, Task, VaultData } from './types'

export const TRASH_DAYS = 30
const DAY = 86_400_000

export function uid(): string {
  return globalThis.crypto.randomUUID()
}

export function now(): string {
  return new Date().toISOString()
}

export function emptyData(): VaultData {
  return { v: 1, accesses: [], notes: [], tasks: [], devices: [] }
}

export interface Template {
  type: ItemType
  label: string
  hint: string
  icon: string
  usernameLabel: string | null
  passwordLabel: string | null
  hasUrl: boolean
  fields: Array<{ label: string; secret: boolean }>
}

export const TEMPLATES: Template[] = [
  { type: 'login', label: 'Acesso', hint: 'Site, login e senha', icon: 'i-lucide-key-round', usernameLabel: 'Usuário ou e-mail', passwordLabel: 'Senha', hasUrl: true, fields: [] },
  { type: 'card', label: 'Cartão', hint: 'Número, validade, CVV', icon: 'i-lucide-credit-card', usernameLabel: 'Nome no cartão', passwordLabel: 'Número do cartão', hasUrl: false, fields: [{ label: 'Validade', secret: false }, { label: 'CVV', secret: true }, { label: 'Senha do cartão', secret: true }] },
  { type: 'wifi', label: 'Wi-Fi', hint: 'Rede, senha e QR Code', icon: 'i-lucide-wifi', usernameLabel: 'Nome da rede (SSID)', passwordLabel: 'Senha do Wi-Fi', hasUrl: false, fields: [{ label: 'Segurança', secret: false }] },
  { type: 'document', label: 'Documento', hint: 'CNH, RG, passaporte', icon: 'i-lucide-id-card', usernameLabel: 'Número do documento', passwordLabel: null, hasUrl: false, fields: [{ label: 'Órgão emissor', secret: false }, { label: 'Emissão', secret: false }, { label: 'Validade', secret: false }] },
  { type: 'bank', label: 'Conta bancária', hint: 'Agência, conta, Pix', icon: 'i-lucide-landmark', usernameLabel: 'Banco', passwordLabel: 'Senha do app', hasUrl: true, fields: [{ label: 'Agência', secret: false }, { label: 'Conta', secret: false }, { label: 'Chave Pix', secret: false }, { label: 'Senha de 4 dígitos', secret: true }] },
  { type: 'server', label: 'Servidor', hint: 'IP, porta, SSH, FTP', icon: 'i-lucide-server', usernameLabel: 'Usuário', passwordLabel: 'Senha', hasUrl: true, fields: [{ label: 'Porta', secret: false }, { label: 'Protocolo', secret: false }] }
]

export function template(type: ItemType): Template {
  return TEMPLATES.find((t) => t.type === type) ?? TEMPLATES[0]
}

export function newAccess(type: ItemType = 'login', category = 'Geral'): Access {
  const t = now()
  const fields: Field[] = template(type).fields.map((f) => ({ id: uid(), label: f.label, value: f.label === 'Segurança' ? 'WPA' : '', secret: f.secret }))
  return {
    id: uid(), type, title: '', url: '', username: '', password: '', notes: '', category,
    tags: [], favorite: false, fields, attachments: [], history: [], createdAt: t, updatedAt: t, deletedAt: null
  }
}

export function newNote(title = '', body = ''): Note {
  const t = now()
  return { id: uid(), title, body, color: 'sage', pinned: false, attachments: [], createdAt: t, updatedAt: t, deletedAt: null }
}

export function newTask(title: string, due: string | null = null, repeat: Repeat = 'none'): Task {
  const t = now()
  return { id: uid(), title, notes: '', due, repeat, done: false, doneAt: null, snoozedUntil: null, createdAt: t, updatedAt: t, deletedAt: null }
}

export function nextOccurrence(dueIso: string, repeat: Repeat, after = Date.now()): string {
  const d = new Date(dueIso)
  if (repeat === 'none') return dueIso
  do {
    if (repeat === 'daily') d.setDate(d.getDate() + 1)
    else if (repeat === 'weekly') d.setDate(d.getDate() + 7)
    else d.setMonth(d.getMonth() + 1)
  } while (d.getTime() <= after)
  return d.toISOString()
}

type Mergeable = { id: string; updatedAt: string; deletedAt?: string | null }

function mergeList<T extends Mergeable>(a: T[], b: T[], cutoff: number): T[] {
  const byId = new Map<string, T>()
  for (const item of [...a, ...b]) {
    const cur = byId.get(item.id)
    if (!cur || item.updatedAt > cur.updatedAt) byId.set(item.id, item)
  }
  return [...byId.values()].filter((i) => !i.deletedAt || Date.parse(i.deletedAt) > cutoff)
}

/** Item-by-item merge of two copies of the same vault (newest `updatedAt` wins). */
export function mergeData(a: VaultData, b: VaultData): VaultData {
  const cutoff = Date.now() - TRASH_DAYS * DAY
  const devices = new Map(a.devices.map((d) => [d.id, d]))
  for (const d of b.devices) {
    const cur = devices.get(d.id)
    if (!cur || d.lastSeen > cur.lastSeen) devices.set(d.id, d)
  }
  return {
    v: 1,
    accesses: mergeList(a.accesses, b.accesses, cutoff),
    notes: mergeList(a.notes, b.notes, cutoff),
    tasks: mergeList(a.tasks, b.tasks, cutoff),
    devices: [...devices.values()]
  }
}

/** Removes trash older than 30 days. */
export function purgeTrash(data: VaultData): VaultData {
  return mergeData(data, emptyData())
}

export function normalizeUser(name: string): string {
  return name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

export function hostOf(url: string): string {
  try {
    return new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
