import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import catalog from '../src/catalog.json' with { type: 'json' }
import vercelAvailability from '../api/availability.js'
import { requestableDays } from '../server/requestable-availability.mjs'
import { createApp } from '../server/app.mjs'

const root = resolve(import.meta.dirname, '..')
const bookingSource = readFileSync(join(root, 'src/Booking.tsx'), 'utf8')
const isoInDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

function callVercel(method, query = '') {
  const response = {
    statusCode: 200, headers: {}, body: null,
    setHeader(key, value) { this.headers[key] = value },
    status(code) { this.statusCode = code; return this },
    json(payload) { this.body = payload; return this },
  }
  vercelAvailability({ method, url: '/api/availability' + query }, response)
  return response
}

test('Vercel GET /api/availability allows every model without claiming assigned inventory', () => {
  const first = isoInDays(10), second = isoInDays(11)
  const params = new URLSearchParams({
    date: first, time: '23:00', service: 'airport',
    dates: first + ',' + second, times: '23:00,23:00',
    services: 'airport,day',
  })
  const res = callVercel('GET', '?' + params)
  assert.equal(res.statusCode, 200)
  assert.match(res.headers['Content-Type'], /application\/json/)
  assert.equal(res.headers['Cache-Control'], 'no-store')
  assert.equal(res.body.inventoryPolicy, 'request-only')
  assert.equal(res.body.bookingSubmissionReady, false)
  assert.equal(res.body.days.length, 2)
  for (const day of res.body.days) {
    assert.equal(day.vehicles.length, catalog.vehicles.length)
    assert.ok(day.vehicles.every((vehicle) => vehicle.available === true))
  }
})

test('requestability validates future date, clock time and service, not fixed fleet stock', () => {
  const date = isoInDays(10)
  assert.equal(requestableDays({ date, time: '23:00', service: 'airport' }).length, 1)
  assert.equal(callVercel('GET', '?date=2020-01-01&time=10%3A00&service=airport').statusCode, 400)
  assert.equal(callVercel('GET', '?date=' + date + '&time=25%3A00&service=airport').statusCode, 400)
  assert.equal(callVercel('GET', '?date=' + date + '&time=23%3A00&service=invalid').statusCode, 400)
  assert.equal(callVercel('POST').statusCode, 405)
})

test('Express requestability uses the same model policy and advertises true persistence readiness', async () => {
  const { app, close } = createApp({
    databasePath: ':memory:',
    now: () => Date.parse('2026-10-30T00:00:00Z'),
    placesOptions: { apiKey: '' },
    ratesOptions: { fetchRate: async () => 0.00075 },
  })
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener))
  })
  try {
    const res = await fetch(
      'http://127.0.0.1:' + server.address().port +
      '/api/availability?date=2026-11-10&time=10:00&service=airport',
    )
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.inventoryPolicy, 'request-only')
    assert.equal(data.bookingSubmissionReady, true)
    assert.ok(data.vehicles.every((vehicle) => vehicle.available === true))
  } finally {
    await new Promise((resolve) => server.close(resolve))
    close()
  }
})

test('static Vercel requestability never impersonates successful reservation persistence', () => {
  assert.match(bookingSource, /setBookingSubmissionReady\(data\.bookingSubmissionReady === true\)/)
  assert.match(bookingSource, /if \(!bookingSubmissionReady \|\| !allAvailable\) \{\s*emailEnquiry\(\)/)
  assert.match(bookingSource, /Email Booking Enquiry/)
  assert.match(bookingSource, /Online booking storage/)
  assert.match(bookingSource, /All dates open for requests/)
  assert.doesNotMatch(bookingSource, /All dates available/)
})
