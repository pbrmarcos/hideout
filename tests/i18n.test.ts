import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { dictionaries } from '../src/shared/i18n.ts'
import { collectStrings } from './strings.ts'

const placeholders = (s: string): string => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')

test('every UI string has English and Spanish translations with the same placeholders', () => {
  const strings = collectStrings()
  assert.ok(strings.size > 300, `expected the UI to have many strings, found ${strings.size}`)
  for (const [lang, dict] of Object.entries(dictionaries())) {
    const missing = [...strings].filter((s) => !(s in dict))
    assert.deepEqual(missing, [], `${lang}: ${missing.length} strings without translation`)
    const broken = [...strings].filter((s) => placeholders(s) !== placeholders(dict[s]))
    assert.deepEqual(broken, [], `${lang}: placeholders differ`)
  }
})

test('dictionaries have no leftover keys that the UI no longer uses', () => {
  const strings = collectStrings()
  for (const [lang, dict] of Object.entries(dictionaries())) {
    const unused = Object.keys(dict).filter((k) => !strings.has(k))
    assert.deepEqual(unused, [], `${lang}: unused keys`)
  }
})
