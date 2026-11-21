import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const load = (path) => readFileSync(join(root, path), 'utf8')
const booking = load('src/Booking.tsx')
const css = load('src/styles.css')

test('Schedule reserves a clear upper-right close-button space and a taller glass card on desktop', () => {
  assert.match(booking, /className="booking-glass-close"/)
  assert.match(booking, /className="route-fields schedule-route-col"/)
  assert.match(css, /\.booking-glass-stage\.is-expanded \.booking-glass-close \{[\s\S]*?top: 14px !important;[\s\S]*?height: 34px !important;/)
  assert.match(css, /@media \(min-width: 961px\) \{[\s\S]*?\.booking-glass-stage\.is-expanded \.booking-glass-surface\.is-schedule-step \{\s*flex-basis: 610px;/)
  assert.match(css, /\.booking-glass-stage\.is-expanded \.booking-panel\.is-schedule-only \.schedule-route-col \{\s*padding-top: 44px;/)
  assert.match(css, /@media \(max-width: 960px\) \{/)
})

test('Daily Schedule begins with its choice controls, not a redundant heading/date range', () => {
  const blockStart = booking.indexOf('<section className="booking-daily-screen" aria-label="Daily Schedule">')
  const choiceStart = booking.indexOf('className="day-mode-segmented booking-daily-choice"', blockStart)
  const blockEnd = booking.indexOf('className="booking-daily-layout"', blockStart)
  assert.ok(blockStart !== -1 && choiceStart > blockStart && blockEnd > choiceStart)
  const intro = booking.slice(blockStart, choiceStart)
  assert.doesNotMatch(intro, /booking-daily-intro|Daily Schedule\s*<\/span>|dates\.length|displayDate/)
  assert.match(booking, /Same schedule for all days/)
  assert.match(booking, /Customize individual days/)
  assert.match(booking, /booking-daily-layout/)
  assert.match(booking, /booking-daily-editor/)
  assert.doesNotMatch(css, /\.booking-daily-intro/)
  assert.match(css, /\.booking-panel\.is-daily-schedule \.booking-fields \{\s*padding-block: 16px !important;/)
  assert.match(css, /@media \(max-width: 760px\) \{[\s\S]*?padding-block: 14px !important;/)
})

test('Daily Schedule route mode and API-bound per-day data remain unchanged', () => {
  assert.match(booking, /dailyScheduleMode === 'custom'/)
  assert.match(booking, /routesByDate\[day\] \?\? defaultRoute/)
  assert.match(booking, /getRoute\(scheduleActiveDate\)\.pickup/)
  assert.match(booking, /getRoute\(scheduleActiveDate\)\.destination/)
  assert.match(booking, /<GlassTimeInput/)
  assert.match(booking, /const journeys = dates\.map\(\(day\) => \(\{/)
  assert.match(booking, /\.\.\.getRoute\(day\)/)
})
