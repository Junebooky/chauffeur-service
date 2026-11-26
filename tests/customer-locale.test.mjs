import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveLocale, pathLocale } from '../src/i18n/locale.mjs'

test('root always defaults to English regardless of browser, region or stored preference', () => {
  assert.equal(resolveLocale(), 'en')
  for (const languages of [['ko-KR'], ['en-US'], ['ja-JP'], []]) {
    for (const country of ['KR','US',undefined]) {
      for (const preference of ['ko','en',null]) {
        assert.equal(resolveLocale({path:'/',languages,country,preference}), 'en')
      }
    }
  }
})
test('explicit Korean and English routes override every other signal', () => {
  for (const path of ['/ko','/ko/']) {
    assert.equal(resolveLocale({path, preference:'en', languages:['en-US'], country:'US'}), 'ko')
  }
  for (const path of ['/en','/en/']) {
    assert.equal(resolveLocale({path, preference:'ko', languages:['ko-KR'], country:'KR'}), 'en')
  }
  assert.equal(pathLocale('/admin'), null)
})
