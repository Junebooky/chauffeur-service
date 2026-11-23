import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createApp } from '../server/app.mjs'

const root = resolve(import.meta.dirname, '..')
const booking = readFileSync(join(root, 'src/Booking.tsx'), 'utf8')
const styles = readFileSync(join(root, 'src/styles.css'), 'utf8')

test('Single Day uses an exact one-date/one-time/one-service availability query', async () => {
  const { app, close } = createApp({
    databasePath: ':memory:',
    now: () => Date.parse('2026-10-30T00:00:00Z'),
    placesOptions: { apiKey: '' },
    ratesOptions: { fetchRate: async () => 0.00075 },
  })
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening))
  })
  try {
    const params = new URLSearchParams({
      dates: '2026-11-10',
      times: '10:00',
      services: 'airport',
      date: '2026-11-10',
      time: '10:00',
      service: 'airport',
    })
    const response = await fetch(
      'http://127.0.0.1:' + server.address().port + '/api/availability?' + params,
    )
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type'), /application\/json/)
    const data = await response.json()
    assert.equal(data.days.length, 1)
    assert.equal(data.days[0].date, '2026-11-10')
    assert.equal(data.days[0].vehicles.length, 5)
    assert.ok(data.days[0].vehicles.every((vehicle) => vehicle.available === true))
  } finally {
    await new Promise((resolve) => server.close(resolve))
    close()
  }
})

test('Vehicle never blocks on vehicle shortage and only guards invalid dates/times', () => {
  assert.doesNotMatch(booking, /Please choose another vehicle or time for/)
  assert.match(booking, /step === 1 && availabilityIssue\?\.kind === 'invalid'/)
  assert.doesNotMatch(booking, /step === 1 && !allAvailable/)
  assert.doesNotMatch(booking, /Please wait for availability to be checked for every day, or retry/)
  assert.match(booking, /Availability not verified online/)
  assert.match(booking, /Recheck availability/)
  assert.match(booking, /Checking availability is required before sending a request/)
})

test('availability data is guarded by the exact dates, pickup times and services', () => {
  assert.match(booking, /const availabilityKey = \[datesKey, timesKey, servicesKey\]\.join\('\|'\)/)
  assert.match(booking, /const availabilityCurrent = verifiedAvailabilityKey === availabilityKey/)
  assert.match(booking, /availabilityCurrent && journeys.length > 0/)
  assert.match(booking, /setVerifiedAvailabilityKey\(''\)/)
  assert.match(booking, /setVerifiedAvailabilityKey\(availabilityKey\)/)
  assert.match(booking, /content-type/)
  assert.match(booking, /data\.days\.length !== dates\.length/)
  assert.match(booking, /window\.setTimeout\(\(\) => \{[\s\S]*?controller\.abort\(\)[\s\S]*?\}, 10000\)/)
})

test('offline fallback creates a user-controlled email draft, never a false saved confirmation', () => {
  assert.match(booking, /availabilityIssue\?\.kind === 'unreachable'/)
  assert.match(booking, /Email Booking Enquiry/)
  assert.match(booking, /window\.location\.href = composeEmail\('CHAUFFEUR · Booking enquiry', message\)/)
  assert.match(booking, /it will not be saved or sent until/)
  assert.match(booking, /No booking has been confirmed or saved online/)
  assert.match(styles, /\.booking-email-fallback-note\s*\{/)
})
