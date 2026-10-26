import { createCipheriv, createDecipheriv, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

export interface Sealed {
  iv: string
  tag: string
  ct: string
}

export interface KdfParams {
  N: number
  r: number
  p: number
}

/** ~0.3–0.6 s on a typical laptop; 128 MiB of memory per derivation. */
export const KDF: KdfParams = { N: 2 ** 17, r: 8, p: 1 }

export function deriveKey(secret: string, salt: Buffer, params: KdfParams = KDF): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(secret.normalize('NFKC'), salt, 32, { ...params, maxmem: 256 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key)
    )
  })
}

export function seal(key: Buffer, plain: Buffer, aad: string): Sealed {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key, iv)
  c.setAAD(Buffer.from(aad))
  const ct = Buffer.concat([c.update(plain), c.final()])
  return { iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), ct: ct.toString('base64') }
}

/** Throws if the key is wrong or the data was tampered with. */
export function open(key: Buffer, s: Sealed, aad: string): Buffer {
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(s.iv, 'base64'))
  d.setAAD(Buffer.from(aad))
  d.setAuthTag(Buffer.from(s.tag, 'base64'))
  return Buffer.concat([d.update(Buffer.from(s.ct, 'base64')), d.final()])
}

// Crockford base32 without I, L, O, U: easy to read aloud and to type.
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function newRecoveryCode(): string {
  const bytes = randomBytes(24)
  let out = ''
  for (let i = 0; i < 24; i++) out += CROCKFORD[bytes[i] & 31]
  return out.match(/.{4}/g)!.join('-')
}

export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '')
}

// --- TOTP (RFC 6238, SHA-1, 6 digits, 30 s) -------------------------------

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0, value = 0
  const out: number[] = []
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch)
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

export function newTotpSecret(): string {
  return base32Encode(randomBytes(20))
}

export function totpAt(secret: string, counter: number): string {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const h = createHmac('sha1', base32Decode(secret)).update(msg).digest()
  const off = h[h.length - 1] & 15
  const n = (h.readUInt32BE(off) & 0x7fffffff) % 1_000_000
  return n.toString().padStart(6, '0')
}

/** Accepts the current code and one step before/after (clock drift). */
export function verifyTotp(secret: string, code: string, at = Date.now()): boolean {
  const clean = code.replace(/\D/g, '')
  if (clean.length !== 6) return false
  const step = Math.floor(at / 30_000)
  return [-1, 0, 1].some((d) => timingSafeEqual(Buffer.from(totpAt(secret, step + d)), Buffer.from(clean)))
}

export function otpauthUri(secret: string, user: string): string {
  const label = encodeURIComponent(`Hideout:${user}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=Hideout&algorithm=SHA1&digits=6&period=30`
}
