import type { Access, Category, Field, ItemType, Note, Repeat, Task, VaultData } from './types'

export const TRASH_DAYS = 30
const DAY = 86_400_000

export function uid(): string {
  return globalThis.crypto.randomUUID()
}

export function now(): string {
  return new Date().toISOString()
}

export const DEFAULT_CATEGORY = 'Geral'

export const CATEGORY_ICONS = [
  'i-lucide-folder', 'i-lucide-briefcase', 'i-lucide-house', 'i-lucide-landmark', 'i-lucide-shopping-bag', 'i-lucide-gamepad-2',
  'i-lucide-graduation-cap', 'i-lucide-heart-pulse', 'i-lucide-plane', 'i-lucide-server', 'i-lucide-code', 'i-lucide-mail',
  'i-lucide-users', 'i-lucide-tv', 'i-lucide-car', 'i-lucide-wifi', 'i-lucide-building-2', 'i-lucide-star'
]

export const CATEGORY_COLORS = ['sage', 'mist', 'lav', 'sand', 'rose', 'gray']

export function emptyData(): VaultData {
  return { v: 1, accesses: [], notes: [], tasks: [], devices: [], categories: [] }
}

export function newCategory(name: string, order: number, icon = CATEGORY_ICONS[0], color = 'sage'): Category {
  const t = now()
  return { id: uid(), name: name.trim(), icon, color, order, createdAt: t, updatedAt: t, deletedAt: null }
}

const sameName = (a: string, b: string): boolean => a.trim().localeCompare(b.trim(), 'pt-BR', { sensitivity: 'base' }) === 0

/**
 * Brings older vaults up to date: every category name used by an access gets a Category,
 * and there is always at least "Geral". Returns the same object (mutated) for convenience.
 */
export function normalizeData(d: VaultData): VaultData {
  d.categories ??= []
  // Two PCs may have created the same name independently: keep the oldest.
  const byName = new Map<string, Category>()
  for (const c of [...d.categories].filter((x) => !x.deletedAt).sort((x, y) => x.createdAt.localeCompare(y.createdAt))) {
    const key = c.name.trim().toLocaleLowerCase('pt-BR')
    if (byName.has(key)) {
      c.deletedAt = now()
      c.updatedAt = now()
    } else byName.set(key, c)
  }
  const live = d.categories.filter((c) => !c.deletedAt)
  const names = new Set<string>()
  for (const a of d.accesses) if (!a.deletedAt) names.add(a.category?.trim() || DEFAULT_CATEGORY)
  if (!live.length) names.add(DEFAULT_CATEGORY)
  let order = live.reduce((m, c) => Math.max(m, c.order), -1)
  for (const name of [...names].sort((a, b) => (a === DEFAULT_CATEGORY ? -1 : b === DEFAULT_CATEGORY ? 1 : a.localeCompare(b, 'pt-BR')))) {
    if (!d.categories.some((c) => !c.deletedAt && sameName(c.name, name))) d.categories.push(newCategory(name, ++order, name === DEFAULT_CATEGORY ? 'i-lucide-folder' : CATEGORY_ICONS[0]))
  }
  return d
}

export function findCategory(d: VaultData, name: string): Category | undefined {
  return d.categories.find((c) => !c.deletedAt && sameName(c.name, name))
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
    devices: [...devices.values()],
    categories: mergeList(a.categories ?? [], b.categories ?? [], cutoff)
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
