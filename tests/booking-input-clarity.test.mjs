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

test('Korean IME search runs during composition and still debounces ordinary changes', () => {
  assert.match(address, /onCompositionStart=\{\(\) => \{/)
  assert.match(address, /composing\.current = true/)
  assert.match(address, /onInput=\{\(event\) => \{/)
  assert.match(address, /onCompositionEnd=\{\(event\) => \{/)
  assert.match(address, /composing\.current = false/)
  assert.match(address, /justCompletedComposition\.current = true/)
  assert.match(address, /justCompletedComposition\.current\s*\? 0/)
  assert.match(address, /Script=Hangul/)
  assert.match(address, /\? 130 : 250/)
  assert.match(address, /controller\.abort\(\)/)
  assert.match(address, /sessionToken: session\.current/)
  assert.match(places, /languageCode:\s*'en'/)
  assert.match(places, /includedRegionCodes: \['kr'\]/)
})

test('KST time zone appears beside Pickup Time without extra calendar noise', () => {
  assert.equal((booking.match(/className="booking-timezone"/g) || []).length, 2)
  assert.match(booking, /className="booking-time-heading"/)
  assert.match(booking, /ariaLabel="Pickup Time"/)
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

test('Schedule copy is concise and its fields use icon-free labels', () => {
  assert.match(booking, /Set pickup, time, and stops for each day next\./)
  assert.match(booking, /Copy any day's itinerary to other days anytime\./)
  assert.doesNotMatch(booking, /Next, set the pick-up and schedule for each date\./)
  assert.equal((booking.match(/labelIcon=\{false\}/g) || []).length, 5)
  assert.doesNotMatch(booking, /rightIcon="nav"|rightIcon="pin"/)
  assert.doesNotMatch(booking, /<Clock3 size=\{15\} aria-hidden="true" \/> Pick-up Time/)
  assert.equal((booking.match(/className="booking-time-heading">Pickup Time/g) || []).length, 2)
  assert.equal((booking.match(/KST \(UTC\+9\)/g) || []).length, 2)
  assert.match(booking, /'Continue to Vehicle'/)
  assert.match(booking, /Continue to Daily Schedule/)
  assert.match(css, /\.booking-daily-remove-stop \{[\s\S]*?width: 60px;/)
})
