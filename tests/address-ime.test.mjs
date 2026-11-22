import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const read = (name) => readFileSync(join(root, name), 'utf8')

test('Korean IME input searches before compositionend, without requiring a second focus', () => {
  const address = read('src/AddressSearch.tsx')
  assert.match(address, /if \(!open \|\| place\) return/)
  assert.doesNotMatch(address, /if \(!open \|\| place \|\| composing\) return/)
  assert.match(address, /onInput=\{\(event\) => \{/)
  assert.match(address, /composing\.current \|\| \(event\.nativeEvent as InputEvent\)\.isComposing/)
  assert.match(address, /updateQuery\(event\.currentTarget\.value\)/)
  assert.match(address, /onCompositionEnd=\{\(event\) => \{/)
  assert.match(address, /justCompletedComposition\.current = true/)
  assert.match(address, /\/\\p\{Script=Hangul\}\/u\.test\(value\) \? 130 : 250/)
  assert.match(address, /controller\.abort\(\)/)
  assert.match(address, /if \(!controller\.signal\.aborted\)/)
  assert.match(address, /onFocus=\{\(\) => \{/)
})

test('Exact Korean station name can return instantly while unfamiliar places still use Google', () => {
  const source = read('server/places.mjs')
  const curated = JSON.parse(read('server/popular-places.json'))
  assert.match(source, /exactCurated\.length > 0/)
  assert.match(source, /google\('places:autocomplete'/)
  assert.match(source, /languageCode:\s*'en'/)
  assert.ok(curated.some((place) => place.id === 'curated:hyehwa-station'))
  assert.ok(!curated.some((place) => place.id === 'curated:seoul-station'))
  assert.ok(curated.slice(0, 6).some((place) => place.id === 'curated:josun-palace'))
  assert.ok(curated.slice(0, 6).some((place) => place.id === 'curated:le-meridien-myeongdong'))
})
