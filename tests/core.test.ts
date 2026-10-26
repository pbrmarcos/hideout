import { strict as assert } from 'node:assert'
import { randomBytes } from 'node:crypto'
import { test } from 'node:test'
import {
  base32Decode, base32Encode, deriveKey, newRecoveryCode, normalizeRecoveryCode, open, seal, totpAt, verifyTotp
} from '../src/main/crypto.ts'
import { parseBrowserPasswords } from '../src/main/csv.ts'
import { matchWindow } from '../src/main/autotype.ts'
import { emptyData, mergeData, newAccess, nextOccurrence } from '../src/shared/model.ts'
import { parseQuick } from '../src/renderer/src/format.ts'

test('AES-GCM round trip, wrong key and tampering are rejected', () => {
  const key = randomBytes(32)
  const s = seal(key, Buffer.from('segredo'), 'v1:data')
  assert.equal(open(key, s, 'v1:data').toString(), 'segredo')
  assert.throws(() => open(randomBytes(32), s, 'v1:data'))
  assert.throws(() => open(key, s, 'v2:data'), 'AAD binds the ciphertext to its vault and slot')
  const tampered = { ...s, ct: Buffer.from(Buffer.from(s.ct, 'base64').map((b, i) => (i === 0 ? b ^ 1 : b))).toString('base64') }
  assert.throws(() => open(key, tampered, 'v1:data'))
})

test('scrypt derivation is deterministic per salt', async () => {
  const salt = randomBytes(16)
  const params = { N: 2 ** 10, r: 8, p: 1 }
  const a = await deriveKey('cafe-azul-trilha', salt, params)
  const b = await deriveKey('cafe-azul-trilha', salt, params)
  const c = await deriveKey('cafe-azul-trilhA', salt, params)
  assert.deepEqual(a, b)
  assert.notDeepEqual(a, c)
})

test('recovery codes: 6 groups, forgiving input', () => {
  const code = newRecoveryCode()
  assert.match(code, /^([0-9A-HJKMNP-TV-Z]{4}-){5}[0-9A-HJKMNP-TV-Z]{4}$/)
  assert.equal(normalizeRecoveryCode(code.toLowerCase().replace(/-/g, ' ')), code.replace(/-/g, ''))
  assert.equal(normalizeRecoveryCode('o0-il'), '0011')
})

test('TOTP matches RFC 6238 test vector', () => {
  const secret = base32Encode(Buffer.from('12345678901234567890'))
  assert.equal(secret, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
  assert.deepEqual(base32Decode(secret), Buffer.from('12345678901234567890'))
  assert.equal(totpAt(secret, Math.floor(59 / 30)), '287082')
  assert.equal(totpAt(secret, Math.floor(1111111109 / 30)), '081804')
  assert.ok(verifyTotp(secret, '287 082', 59_000))
  assert.ok(verifyTotp(secret, '287082', 59_000 + 30_000), 'one step of clock drift is accepted')
  assert.ok(!verifyTotp(secret, '287082', 59_000 + 120_000))
})

test('merge keeps the newest copy of each item and drops old trash', () => {
  const a = emptyData(), b = emptyData()
  const x = { ...newAccess(), title: 'Gmail', updatedAt: '2026-01-01T00:00:00.000Z' }
  const x2 = { ...x, title: 'Gmail pessoal', updatedAt: '2026-02-01T00:00:00.000Z' }
  const y = { ...newAccess(), title: 'Banco', updatedAt: '2026-01-05T00:00:00.000Z' }
  const old = { ...newAccess(), title: 'Velho', deletedAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z' }
  a.accesses = [x, old]
  b.accesses = [x2, y]
  const m = mergeData(a, b)
  assert.equal(m.accesses.length, 2)
  assert.equal(m.accesses.find((i) => i.id === x.id)!.title, 'Gmail pessoal')
  assert.ok(m.accesses.some((i) => i.id === y.id))
})

test('repeating tasks move to the next future date', () => {
  const past = new Date(Date.now() - 3 * 86_400_000).toISOString()
  assert.ok(Date.parse(nextOccurrence(past, 'daily')) > Date.now())
  const monthly = nextOccurrence('2026-01-31T12:00:00.000Z', 'monthly', Date.parse('2026-01-31T12:00:00.000Z'))
  assert.ok(Date.parse(monthly) > Date.parse('2026-01-31T12:00:00.000Z'))
})

test('Chrome CSV import with quotes, commas and newlines', () => {
  const csv = '﻿name,url,username,password,note\n"Banco, Inter",https://inter.co,"marco","p""a,ss","linha 1\nlinha 2"\nGmail,https://mail.google.com,eu@gmail.com,abc,\n'
  const rows = parseBrowserPasswords(csv)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], { name: 'Banco, Inter', url: 'https://inter.co', username: 'marco', password: 'p"a,ss', note: 'linha 1\nlinha 2' })
})

test('auto-type matches the browser tab to the right access', () => {
  const gmail = { ...newAccess(), title: 'Gmail', url: 'https://mail.google.com', username: 'eu', password: 'x' }
  const inter = { ...newAccess(), title: 'Banco Inter', url: 'https://internetbanking.bancointer.com.br', username: 'eu', password: 'y' }
  const r = matchWindow('Gmail - Caixa de entrada - Google Chrome', [inter, gmail])
  assert.equal(r[0].id, gmail.id)
  assert.equal(matchWindow('Bloco de Notas', [inter, gmail]).length, 0)
})

test('quick add understands Portuguese dates', () => {
  const a = parseQuick('pagar boleto amanhã 9h')
  assert.equal(a.title, 'pagar boleto')
  const d = new Date(a.due!)
  const tomorrow = new Date(Date.now() + 86_400_000)
  assert.equal(d.getDate(), tomorrow.getDate())
  assert.equal(d.getHours(), 9)
  const b = parseQuick('ligar contador hoje 14:30')
  assert.equal(b.title, 'ligar contador')
  assert.equal(new Date(b.due!).getMinutes(), 30)
  assert.equal(parseQuick('comprar cabo HDMI').due, null)
  const c = parseQuick('aniversário 25/12 8h')
  assert.equal(new Date(c.due!).getMonth(), 11)
})
