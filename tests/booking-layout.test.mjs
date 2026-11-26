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
  assert.match(booking, /\{t\(ready \? 'Ready' : 'To complete'\)\}/)
  assert.doesNotMatch(booking, /Same schedule for all days/)
  assert.match(css, /\.booking-daily-progress \{/)
  assert.match(booking, /booking-first-day-note/)
  assert.match(booking, /getService\(dates\[0\] \|\| tomorrow\(\)\)/)
  assert.doesNotMatch(booking, /className="booking-daily-intro"/)
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

test('multi-day guidance belongs to date selection and daily cards separate service from route', () => {
  const dateStart = booking.indexOf('className="multi-day-control"')
  const noteStart = booking.indexOf('className="booking-first-day-note field-note"')
  const routeColumn = booking.indexOf('className="route-fields schedule-route-col"')
  assert.ok(dateStart > 0 && dateStart < noteStart && noteStart < routeColumn)
  const noteBlock = booking.slice(noteStart, routeColumn)
  assert.match(noteBlock, /Set pickup, time, and stops for each day next/)
  assert.match(noteBlock, /Copy any day's itinerary to other days anytime/)
  assert.match(css, /\.booking-first-day-note \{\s*display: grid;/)
  assert.match(booking, /className="field-note booking-day-card-summary"/)
  assert.match(booking, /className="booking-day-card-meta"/)
  assert.match(booking, /className="booking-day-card-route"/)
  assert.match(css, /\.booking-daily-day-list \.booking-day-card-summary \{\s*display: grid;/)
  assert.match(css, /\.booking-daily-day-list \.booking-day-card-route \{/)
})

test('daily routes reuse the same pickup, destination and pickup time labels as Schedule', () => {
  assert.equal((booking.match(/label="Pickup Location"/g) || []).length, 2)
  assert.equal((booking.match(/label="Destination"/g) || []).length, 2)
  assert.equal((booking.match(/className="booking-time-heading">\{t\("Pickup Time"\)\}/g) || []).length, 2)
  assert.doesNotMatch(booking, /label="Final Drop-off"|label="Pick-up Location"/)
})

test('Schedule omits the redundant date heading and places custom inquiry after route fields', () => {
  assert.doesNotMatch(booking, /className="schedule-col-header"/)
  const scheduleStart = booking.indexOf('className="route-fields schedule-route-col"')
  const service = booking.indexOf('name="service"', scheduleStart)
  const pickup = booking.indexOf('name="pickup"', service)
  const destination = booking.indexOf('name="destination"', pickup)
  const time = booking.indexOf('name="pickup-time"', destination)
  const flight = booking.indexOf('name="flight"', time)
  const footer = booking.indexOf('className="booking-custom-footer"', flight)
  assert.ok(scheduleStart >= 0 && service > scheduleStart && pickup > service)
  assert.ok(destination > pickup && time > destination && flight > time)
  assert.ok(footer > flight)
  assert.equal((booking.match(/Need a custom itinerary\? Email us/g) || []).length, 1)
  assert.match(css, /\.booking-panel\.is-schedule-only \.booking-custom-footer \{/)
  assert.match(css, /\.booking-panel\.is-schedule-only \.schedule-date-col \{\s*padding-top: 33px;/)
})

test('Daily Schedule connects Pickup Location and Destination with a dashed arrow and inline Add Stop', () => {
  assert.match(booking, /className="booking-daily-route-flow"/)
  assert.match(booking, /className="booking-route-stem"/)
  assert.match(booking, /className="booking-route-chevron"/)
  assert.match(booking, /<Plus size=\{13\} aria-hidden="true" \/> \{t\("Add Stop"\)\}/)
  assert.doesNotMatch(booking, /booking-daily-schedule-heading/)
  assert.doesNotMatch(booking, /Optional stops · final drop-off/)
  assert.match(css, /\.booking-route-stem\s*\{[^}]*border-left:\s*1\.5px dashed/)
})

test('changing a Vehicle clears an outdated availability message', () => {
  assert.match(booking, /const changeVehicle = \(vId: string\) => \{/)
  assert.match(booking, /previous\.startsWith\('Please choose another vehicle or time'\) \? '' : previous/)
})
