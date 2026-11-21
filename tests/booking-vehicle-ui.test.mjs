import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const read = (name) => readFileSync(join(root, name), 'utf8')
const booking = read('src/Booking.tsx')
const carousel = read('src/VehicleCarousel.tsx')
const css = read('src/styles.css')

test('Vehicle step uses compact dates and keeps date and time together', () => {
  assert.match(booking, /<strong title=\{displayDate\(d\)\}>\{compactDate\(d\)\}<\/strong>/)
  assert.match(booking, /Day \{String\(index \+ 1\)\.padStart\(2, '0'\)\} · \{compactDate\(day\.date\)\} · \{day\.time\}/)
  assert.match(booking, /className="summary-daily-vehicles booking-vehicle-day-summary"/)
  assert.match(booking, /className="booking-vehicle-day-date" title=\{displayDate\(day\.date\)\}/)
  assert.match(booking, /className="booking-vehicle-day-price"/)
  assert.match(booking, /shortVehicleName\(day\.vehicle\)/)
  assert.match(booking, /title=\{v\.name\}/)
  assert.match(css, /\.booking-vehicle-day-summary \.booking-vehicle-day-date \{[\s\S]*?white-space: nowrap;/)
  assert.match(css, /\.booking-vehicle-day-summary \.booking-vehicle-day-price \{[\s\S]*?white-space: nowrap;/)
  assert.match(css, /\.booking-vehicle-day-summary > div \{[\s\S]*?flex-wrap: wrap;/)
})

test('the left Day cards are the only per-day controls and still drive the selected vehicle', () => {
  assert.match(booking, /role="group" aria-label="Choose a day to assign a vehicle"/)
  assert.match(booking, /onClick=\{\(\) => setActiveDate\(d\)\}/)
  assert.match(booking, /aria-pressed=\{isActive\}/)
  assert.match(booking, /<VehicleCarousel[\s\S]*?value=\{activeVehicle\}[\s\S]*?onChange=\{changeVehicle\}/)
  assert.doesNotMatch(booking, /className="showroom-day-bar"/)
  assert.doesNotMatch(booking, /className="showroom-day-pills"/)
  assert.doesNotMatch(booking, /activeDayIndex|scrollPills|pillsContainerRef|activePillRef/)
  assert.match(booking, /ariaLabel=\{multiDay && vehicleMode === 'daily'/)
  assert.match(carousel, /ariaLabel\?: string/)
  assert.match(carousel, /aria-label=\{ariaLabel\}/)
})

test('Vehicle Carousel displays only one pagination line in Booking', () => {
  assert.match(carousel, /className="fleet-pagination"/)
  assert.match(carousel, /aria-label=\{`Select \$\{v\.name\} \(0\$\{i \+ 1\}\)\`\}/)
  assert.match(css, /\.booking-glass-stage\.is-expanded \.fleet-pagination>button::after \{\s*content: none !important;/)
  assert.match(css, /\.booking-glass-stage\.is-expanded \.fleet-pagination>button \{[\s\S]*?height: 2px !important;/)
  assert.match(css, /\.booking-glass-stage\.is-expanded \.fleet-pagination>button\.active \{/)
  assert.match(css, /\.fleet-pagination button:after \{/)
})
