import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { TEMPLATES } from '../src/shared/model.ts'
import { NOTE_COLORS, REPEAT_LABEL } from '../src/renderer/src/format.ts'
import { SOUND_LABEL } from '../src/renderer/src/sounds.ts'

const ROOT = join(import.meta.dirname, '..', 'src')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? (f === 'locales' ? [] : files(p)) : /\.(ts|vue)$/.test(f) ? [p] : []
  })
}

/** Every Portuguese string the UI can show. */
export function collectStrings(): Set<string> {
  const found = new Set<string>()
  const call = /\b(?:t|tr|tx)\(\s*(['"])((?:(?!\1)[^\\]|\\.)*)\1/g
  for (const f of files(ROOT)) {
    const src = readFileSync(f, 'utf8')
    for (const m of src.matchAll(call)) found.add(m[2].replace(/\\(['"\\])/g, '$1'))
    // Theme editor labels: ['Label', 'Description'] pairs translated at render time.
    if (f.endsWith('ThemeEditor.vue')) for (const m of src.matchAll(/\[\s*'([^']+)',\s*'([^']+)'\s*\]/g)) { found.add(m[1]); found.add(m[2]) }
  }
  for (const tpl of TEMPLATES) {
    for (const s of [tpl.label, tpl.hint, tpl.usernameLabel, tpl.passwordLabel, ...tpl.fields.map((f) => f.label)]) if (s) found.add(s)
  }
  for (const c of NOTE_COLORS) found.add(c.label)
  for (const v of Object.values(REPEAT_LABEL)) if (v) found.add(v)
  for (const v of Object.values(SOUND_LABEL)) found.add(v)
  for (const s of ['Fraca', 'Razoável', 'Forte', 'Muito forte', 'Geral', 'Importados', 'Usuário', 'Senha']) found.add(s)
  return found
}
