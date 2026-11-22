import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { test } from 'node:test'
import { createApp } from '../server/app.mjs'

const root = resolve(import.meta.dirname, '..')
const bookingSource = readFileSync(join(root, 'src/Booking.tsx'), 'utf8')
const appSource = readFileSync(join(root, 'src/App.tsx'), 'utf8')
const catalog = JSON.parse(readFileSync(join(root, 'src/catalog.json'), 'utf8'))

const original = {
  date: '2026-11-10',
  time: '10:00',
  service: 'day',
  vehicle: 'staria',
  pickup: 'Incheon Airport Terminal 2',
  destination: 'Four Seasons Hotel Seoul',
  pickupPlace: { id: 'curated:icn-t2' },
  destinationPlace: { id: 'curated:four-seasons' },
  options: [],
  name: 'VIP Guest',
  email: 'vip@example.com',
  phone: '+82 10 1234 5678',
  consent: true,
  journeys: [
    { date: '2026-11-10', time: '10:00', vehicle: 'staria' },
    {
      date: '2026-11-11',
      time: '14:00',
      vehicle: 'g90',
      pickup: 'Grand Hyatt Seoul',
      destination: 'COEX Convention Center',
      pickupPlace: { id: 'curated:grand-hyatt' },
      destinationPlace: { id: 'curated:coex' },
    },
  ],
}

async function withApi(run) {
  const instance = createApp({
    databasePath: ':memory:',
    now: () => Date.parse('2026-11-01T00:00:00Z'),
    placesOptions: { apiKey: '' },
    ratesOptions: { fetchRate: async () => 0.00075 },
  })
  const server = await new Promise((resolve) => {
    const item = instance.app.listen(0, '127.0.0.1', () => resolve(item))
  })
  const post = async (body, key = randomUUID()) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(body),
    })
    return { status: response.status, data: await response.json() }
  }
  try {
    await run(post)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    instance.close()
  }
}

test('Booking offers two fixed-rate services with a direct email link for custom quotes', () => {
  assert.match(appSource, /useState\('airport'\)/)
  assert.match(bookingSource, /item\.id === 'airport' \|\| item\.id === 'day'/)
  assert.match(bookingSource, /options=\{bookableServices\}/)
  assert.doesNotMatch(bookingSource, /value: 'custom'/)
  assert.match(bookingSource, /Need a custom itinerary\? Email us/)
  assert.match(appSource, /onRequestCustom=\{\(\) => \{ window\.location\.href = customQuoteEmail\(\) \}\}/)
  assert.equal(catalog.services.find((s) => s.id === 'airport').name, 'Pick-up Service')
  assert.equal(catalog.services.find((s) => s.id === 'day').name, 'Schedule Service')
})

test('Multiple Days keeps the Glass controls and makes route and vehicle choices per day', () => {
  assert.match(bookingSource, /aria-label="Daily Schedule"/)
  assert.match(bookingSource, /Continue to Daily Schedule/)
  assert.match(bookingSource, /Your daily itinerary/)
  assert.match(bookingSource, /Set the pick-up, schedule and time for each date/)
  assert.match(bookingSource, /booking-daily-progress-count/)
  assert.match(bookingSource, /className="booking-daily-layout"/)
  assert.match(bookingSource, /dailyScheduleOpen/)
  assert.match(bookingSource, /booking-panel \$\{step === 0 \? \(dailyScheduleOpen/)
  assert.doesNotMatch(bookingSource, /className="daily-times-grid"/)
  assert.match(bookingSource, /Vehicle Selection/)
  assert.match(bookingSource, /Same for All Days/)
  assert.match(bookingSource, /Choose Per Day/)
  const carnival = catalog.vehicles.find((v) => v.id === 'carnival_limousine')
  const staria = catalog.vehicles.find((v) => v.id === 'staria')
  assert.equal(carnival.name, 'Carnival Hi-Limousine')
  assert.equal(staria.name, 'Staria Limousine')

  assert.match(bookingSource, /Copy this day to all/)
  assert.match(bookingSource, /setRoutesByDate/)
  assert.match(bookingSource, /name=\{`service-\$\{scheduleActiveDate\}`\}/)
  assert.match(bookingSource, /setServiceForDate\(scheduleActiveDate, next\)/)
  assert.match(bookingSource, /getService\(scheduleActiveDate\) === 'airport'/)
  assert.match(bookingSource, /value=\{multiDay \? getRoute\(dates\[0\]\)\.pickup : pickup\}/)
  assert.match(bookingSource, /params\.set\('services', servicesKey\)/)
  assert.match(bookingSource, /service: journeys\[0\]\.service/)
  assert.match(bookingSource, /name=\{`pickup-\$\{scheduleActiveDate\}`\}/)
  assert.match(bookingSource, /name=\{`destination-\$\{scheduleActiveDate\}`\}/)
  assert.match(bookingSource, /getRoute\(scheduleActiveDate\)\.stops\.map/)
  assert.match(bookingSource, /label="Destination"/)
  assert.match(bookingSource, /isRouteComplete/)
  assert.match(bookingSource, /Same for All Days/)
  assert.match(bookingSource, /Choose Per Day/)
  assert.match(bookingSource, /<VehicleCarousel/)
  assert.match(bookingSource, /<AddressSearch/)
  assert.match(bookingSource, /<GlassSelect/)
  assert.match(bookingSource, /Choose at least two dates/)
  assert.doesNotMatch(bookingSource, /setDates\(\[first, nextDay\]\)/)
  assert.match(bookingSource, /KST \(UTC\+9\)/)
  assert.match(bookingSource, /journeys\.map\(\(day, index\)/)
})

test('server preserves independent daily pick-up, destination and vehicle in response', () =>
  withApi(async (post) => {
    const key = randomUUID()
    const first = await post(original, key)
    assert.equal(first.status, 201)
    assert.equal(first.data.total, 960000)
    assert.equal(first.data.journeys.length, 2)
    assert.match(first.data.journeys[0].pickup, /Je2terminal-daero/)
    assert.match(first.data.journeys[0].destination, /Saemunan-ro/)
    assert.match(first.data.journeys[1].pickup, /Sowol-ro/)
    assert.match(first.data.journeys[1].destination, /Yeongdong-daero/)
    assert.equal(first.data.journeys[0].vehicle, 'Staria Limousine')
    assert.equal(first.data.journeys[1].vehicle, 'Genesis G90')
    const replay = await post(original, key)
    assert.equal(replay.status, 200)
    assert.deepEqual(replay.data, first.data)
  }))

test('server rejects unresolved or identical locations on an edited day', () =>
  withApi(async (post) => {
    const same = structuredClone(original)
    same.journeys[1].destinationPlace = { id: 'curated:grand-hyatt' }
    assert.equal((await post(same)).status, 400)

    const missing = structuredClone(original)
    missing.journeys[1].pickupPlace = null
    assert.equal((await post(missing)).status, 400)

    const invalid = structuredClone(original)
    invalid.journeys[1].destination = ''
    assert.equal((await post(invalid)).status, 400)
  }))

test('Vehicle Selection and booking controls use concise labels while preserving daily assignment', () => {
  assert.match(bookingSource, /Use one vehicle for all days, or choose per day\./)
  assert.match(bookingSource, /Applies to all \{dates\.length\} days\./)
  assert.match(bookingSource, /Add-ons · Per Day/)
  assert.match(bookingSource, /Until \$\{displayDate\(dates\[dates\.length - 1\]\)\}/)
  assert.match(bookingSource, /Continue to Details/)
  assert.match(bookingSource, /No upfront payment · Subject to confirmation/)
  assert.match(bookingSource, /\['Schedule', 'Vehicle', 'Details', 'Confirmation'\]/)
})

test('each daily location input offers verified places already selected during this booking', () => {
  assert.match(bookingSource, /const recentTripPlaces: Place\[\] = \[\]/)
  assert.match(bookingSource, /if \(multiDay\) \{\s*const used = new Set<string>\(\)/)
  assert.match(bookingSource, /route\.pickupPlace/)
  assert.match(bookingSource, /route\.destinationPlace/)
  assert.match(bookingSource, /route\.stops\.map\(\(stop\) => stop\.place\)/)
  assert.match(bookingSource, /if \(selected && !used\.has\(selected\.id\)\)/)
  assert.equal((bookingSource.match(/recentPlaces=/g) || []).length, 5)
  assert.match(bookingSource, /recentPlaces=\{multiDay \? recentTripPlaces : \[\]\}/)
  assert.match(bookingSource, /recentPlaces=\{recentTripPlaces\}/)
})

test('the saved confirmation provides PDF, PNG and a direct email contact', () => {
  assert.match(bookingSource, /booking-confirmation-status/)
  assert.match(bookingSource, /Awaiting Confirmation/)
  assert.match(bookingSource, /booking-confirmation-stats/)
  assert.match(bookingSource, /booking-confirmation-day/)
  assert.match(bookingSource, /exportItineraryPdf\(result\)/)
  assert.match(bookingSource, /exportItineraryPng\(result\)/)
  assert.match(bookingSource, /Export PDF/)
  assert.match(bookingSource, /Export PNG/)
  assert.match(bookingSource, /composeEmail\('CHAUFFEUR/)
  assert.doesNotMatch(bookingSource, /Save to calendar/)
  assert.match(bookingSource, /Request saved · Not yet confirmed/)
})
