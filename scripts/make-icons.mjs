// Draws the Hideout mark (rounded square + keyhole) into PNG and ICO files, no dependencies.
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [0x47, 0x70, 0x5a]
const FG = [0xf8, 0xfa, 0xf7]

function inRoundRect(x, y) {
  const r = 6, x0 = 2, y0 = 2, x1 = 22, y1 = 22
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.min(Math.max(x, x0 + r), x1 - r)
  const cy = Math.min(Math.max(y, y0 + r), y1 - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

function inKeyhole(x, y) {
  if ((x - 12) ** 2 + (y - 10) ** 2 <= 2.6 ** 2) return true
  if (y < 11.5 || y > 16.5) return false
  const t = (y - 11.5) / 5
  const half = 1.1 + t * 0.7
  return Math.abs(x - 12) <= half
}

/** `matte` makes the image opaque (apple-touch-icon); `inset` adds padding around the mark, in 24-unit space. */
function render(size, { matte = null, inset = 0 } = {}) {
  const px = new Uint8Array(size * size * 4)
  const ss = 4
  const span = 24 + inset * 2
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let bg = 0, fg = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = ((i + (sx + 0.5) / ss) / size) * span - inset
          const y = ((j + (sy + 0.5) / ss) / size) * span - inset
          if (inRoundRect(x, y)) inKeyhole(x, y) ? fg++ : bg++
        }
      }
      const n = ss * ss, o = (j * size + i) * 4
      const empty = n - bg - fg
      if (matte) {
        for (let c = 0; c < 3; c++) px[o + c] = Math.round((BG[c] * bg + FG[c] * fg + matte[c] * empty) / n)
        px[o + 3] = 255
        continue
      }
      if (bg + fg === 0) continue
      for (let c = 0; c < 3; c++) px[o + c] = Math.round((BG[c] * bg + FG[c] * fg) / (bg + fg))
      px[o + 3] = Math.round(((bg + fg) / n) * 255)
    }
  }
  return px
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, opts) {
  const px = render(size, opts)
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    Buffer.from(px.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

function ico(sizes) {
  const images = sizes.map(png)
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)
  let offset = 6 + 16 * sizes.length
  const dir = sizes.map((s, i) => {
    const e = Buffer.alloc(16)
    e[0] = s >= 256 ? 0 : s
    e[1] = s >= 256 ? 0 : s
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(images[i].length, 8)
    e.writeUInt32LE(offset, 12)
    offset += images[i].length
    return e
  })
  return Buffer.concat([header, ...dir, ...images])
}

mkdirSync('resources', { recursive: true })
mkdirSync('build', { recursive: true })
writeFileSync('resources/icon.png', png(256))
writeFileSync('resources/tray.png', png(32))
writeFileSync('build/icon.ico', ico([16, 24, 32, 48, 64, 128, 256]))
mkdirSync('docs', { recursive: true })
writeFileSync('docs/icon.png', png(512))
writeFileSync('docs/icon-32.png', png(32))
writeFileSync('docs/apple-touch-icon.png', png(180, { matte: [0xed, 0xf1, 0xec], inset: 2 }))
writeFileSync('docs/icon.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="6" fill="#47705A"/><circle cx="12" cy="10" r="2.6" fill="#F8FAF7"/><path d="M10.9 11.5h2.2l.7 5h-3.6z" fill="#F8FAF7"/></svg>\n')
console.log('icons written: resources/icon.png, resources/tray.png, build/icon.ico, docs/icon*.png, docs/apple-touch-icon.png, docs/icon.svg')
