import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const read = (file) => readFileSync(join(root, file), 'utf8')
const address = read('src/AddressSearch.tsx')
const booking = read('src/Booking.tsx')
const css = read('src/styles.css')
const places = read('server/places.mjs')

test('Korean IME search starts on committed text, while changes remain debounced', () => {
  assert.match(address, /onCompositionStart=\{\(\) => setComposing\(true\)\}/)
  assert.match(address, /onCompositionEnd=\{\(event\) => \{/)
  assert.match(address, /justCompletedComposition\.current = true/)
  assert.match(address, /setComposing\(false\)/)
  assert.match(address, /justCompletedComposition\.current\s*\? 0/)
  assert.match(address, /Script=Hangul/)
  assert.match(address, /\? 160 : 250/)
  assert.match(address, /controller\.abort\(\)/)
  assert.match(address, /sessionToken: session\.current/)
  assert.match(places, /languageCode: \/\\p\{Script=Hangul\}\/u\.test\(query\) \? 'ko' : 'en'/)
  assert.match(places, /includedRegionCodes: \['kr'\]/)
})

test('time zone appears beside Pick-up Time, never below or as extra calendar noise', () => {
  assert.equal((booking.match(/className="booking-timezone"/g) || []).length, 2)
  assert.match(booking, /className="booking-time-heading"/)
  assert.match(booking, /ariaLabel="Pick-up Time"/)
  assert.doesNotMatch(booking, /Default Pick-up Time/)
  assert.doesNotMatch(booking, /className="calendar-note"/)
  assert.doesNotMatch(booking, /<small className="field-note">Korea time/)
  assert.match(css, /\.field > span\.booking-time-label/)
  assert.match(css, /justify-content: space-between/)
})

test('booking input labels are noticeably softer than input values', () => {
  assert.match(css, /\.booking-glass-stage\.is-expanded \.address-field>label \{[\s\S]*?rgba\(182, 193, 209, 0\.84\)/)
  assert.match(css, /\.booking-glass-stage\.is-expanded \.field input,[\s\S]*?color: #f4f5f7 !important/)
  assert.match(css, /\.booking-glass-stage\.is-expanded \.booking-time-heading/)
  assert.match(css, /\.booking-glass-stage\.is-expanded \.field > span\.booking-time-label > small\.booking-timezone/)
})
