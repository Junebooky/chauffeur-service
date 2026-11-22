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

test('Daily Schedule shows progress, one selected date, and a focused daily editor', () => {
  const blockStart = booking.indexOf('<section className="booking-daily-screen" aria-label="Daily Schedule">')
  const progress = booking.indexOf('className="booking-daily-progress"', blockStart)
  const dayList = booking.indexOf('className="booking-daily-day-list"', blockStart)
  const editor = booking.indexOf('className="booking-daily-editor"', blockStart)
  assert.ok(blockStart >= 0 && progress > blockStart && dayList > progress && editor > dayList)
  assert.match(booking, /Your daily itinerary/)
  assert.match(booking, /of \{dates\.length\} ready/)
  assert.match(booking, /\{ready \? 'Ready' : 'To complete'\}/)
  assert.doesNotMatch(booking, /Same schedule for all days/)
  assert.match(css, /\.booking-daily-progress \{/)
  assert.match(css, /\.booking-daily-intro \{/)
  assert.match(css, /\.booking-panel\.is-daily-schedule \.booking-fields \{\s*padding-block: 16px !important;/)
})

test('every selected date has an independent validated route, optional stops and copy confirmation', () => {
  assert.match(booking, /routesByDate\[day\] \?\? emptyDayRoute\(\)/)
  assert.match(booking, /const isRouteComplete/)
  assert.match(booking, /getRoute\(scheduleActiveDate\)\.pickup/)
  assert.match(booking, /getRoute\(scheduleActiveDate\)\.destination/)
  assert.match(booking, /getRoute\(scheduleActiveDate\)\.stops\.map/)
  assert.match(booking, /Copy this day to all/)
  assert.match(booking, /Existing plans will be replaced/)
  assert.match(booking, /<GlassTimeInput/)
  assert.match(booking, /const journeys = dates\.map\(\(day\) => \(\{/)
  assert.match(booking, /\.\.\.getRoute\(day\)/)
})
