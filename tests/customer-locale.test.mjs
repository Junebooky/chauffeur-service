import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveLocale, pathLocale } from '../src/i18n/locale.mjs'
test('explicit locale wins over preferences, browser and country', () => {
  assert.equal(resolveLocale({path:'/en/', preference:'ko', languages:['ko-KR'], country:'KR'}), 'en')
  assert.equal(pathLocale('/ko'), 'ko')
  assert.equal(pathLocale('/admin'), null)
})
test('manual preference then supported browser language then country', () => {
  assert.equal(resolveLocale({preference:'en', languages:['ko-KR'], country:'KR'}), 'en')
  assert.equal(resolveLocale({languages:['en-US'],country:'KR'}), 'en')
  assert.equal(resolveLocale({languages:['ko-KR'],country:'US'}), 'ko')
  assert.equal(resolveLocale({languages:['ja-JP'],country:'KR'}), 'ko')
  assert.equal(resolveLocale({languages:['ja-JP'],country:'JP'}), 'en')
})
