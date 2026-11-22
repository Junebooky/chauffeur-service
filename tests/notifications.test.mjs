import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildOperatorEmail, createOperatorNotifier, DEFAULT_OPERATOR_EMAIL } from '../server/notifications.mjs'
import { createApp } from '../server/app.mjs'

const details = {
  name: 'A <Guest> & Team',
  email: 'guest@example.com',
  phone: '+82 10 1111 2222',
  contactMethod: 'email',
  messengerContact: '',
  options: ['englishDriver'],
  journeys: [{
    date: '2026-11-25',
    time: '10:00',
    vehicle: 'staria',
    service: 'Pick-up Service',
    pickup: 'Incheon Airport',
    destination: 'Josun Palace',
    pickupPlace: { name: 'Incheon Airport Terminal 1' },
    destinationPlace: { name: 'Josun Palace' },
    stops: [],
    total: 200000,
  }],
}
const reservation = {
  date: '2026-11-25', time: '10:00',
  service: 'airport', vehicle: 'staria',
  pickup: 'Incheon Airport', destination: 'Josun Palace',
  pickupPlace: { id: 'curated:icn-t1' },
  destinationPlace: { id: 'curated:josun-palace' },
  name: details.name, email: details.email, phone: details.phone,
  contactMethod: 'email', options: [], consent: true,
}
async function startServer(instance) {
  const server = await new Promise((resolve) => {
    const listening = instance.app.listen(0, '127.0.0.1', () => resolve(listening))
  })
  const endpoint = 'http://127.0.0.1:' + server.address().port + '/api/reservations'
  return {
    post: async (body, key) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify(body),
      })
      return { status: response.status, body: await response.json() }
    },
    close: async () => {
      await new Promise((resolve) => server.close(resolve))
      instance.close()
    },
  }
}
const until = async (predicate) => {
  for (let i = 0; i < 70; i++) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.fail('Email delivery was not attempted.')
}

test('admin email template contains verified details and escapes untrusted HTML', () => {
  const message = buildOperatorEmail({
    reference: 'CH-1A2B3C4D',
    status: 'pending', total: 200000,
    details,
  })
  assert.match(message.subject, /New Booking Request/)
  assert.match(message.subject, /CH-1A2B3C4D/)
  assert.match(message.html, /&lt;Guest&gt; &amp; Team/)
  assert.doesNotMatch(message.html, /<Guest>/)
  assert.match(message.html, /Incheon Airport Terminal 1/)
  assert.match(message.html, /Josun Palace/)
  assert.match(message.html, /mailto:guest@example.com/)
  assert.match(message.html, /Pending confirmation|pending request/i)
  assert.match(message.text, /Preferred contact: email/)
  assert.match(message.text, /tax excluded/i)
})

test('Resend adapter uses the configured admin recipient and sends HTML and plain text', async () => {
  const calls = []
  const sender = createOperatorNotifier({
    apiKey: 'test-provider-key',
    from: 'CHAUFFEUR <reservations@example.com>',
    fetcher: async (url, options) => {
      calls.push({ url, options })
      return { ok: true }
    },
  })
  assert.equal(sender.enabled, true)
  assert.equal(sender.to, DEFAULT_OPERATOR_EMAIL)
  assert.equal(await sender.deliver({ reference: 'CH-1A2B3C4D', total: 200000, details }), true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.resend.com/emails')
  assert.equal(calls[0].options.headers['Idempotency-Key'], 'chauffeur-booking-CH-1A2B3C4D')
  const payload = JSON.parse(calls[0].options.body)
  assert.deepEqual(payload.to, [DEFAULT_OPERATOR_EMAIL])
  assert.equal(payload.reply_to, details.email)
  assert.match(payload.html, /DAILY ITINERARY/)
  assert.match(payload.text, /CH-1A2B3C4D/)
})

test('saved requests survive disabled email, then send once when operator mail is configured', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'chauffeur-notifications-'))
  const databasePath = join(folder, 'reservations.sqlite')
  const key = randomUUID()
  const now = () => Date.parse('2026-11-22T00:00:00Z')
  try {
    const firstApp = createApp({
      databasePath, now,
      placesOptions: { apiKey: '' },
      ratesOptions: { fetchRate: async () => 0.00075 },
      notificationsOptions: { apiKey: '', from: '' },
    })
    const first = await startServer(firstApp)
    const saved = await first.post(reservation, key)
    assert.equal(saved.status, 201)
    assert.equal(saved.body.status, 'pending')
    await first.close()
    const deliveries = []
    const secondApp = createApp({
      databasePath, now,
      placesOptions: { apiKey: '' },
      ratesOptions: { fetchRate: async () => 0.00075 },
      notificationsOptions: {
        send: async (payload) => { deliveries.push(payload) },
      },
    })
    const second = await startServer(secondApp)
    await until(() => deliveries.length === 1)
    const duplicate = await second.post(reservation, key)
    assert.equal(duplicate.status, 200)
    assert.equal(duplicate.body.reference, saved.body.reference)
    await secondApp.flushNotifications()
    assert.equal(deliveries.length, 1)
    assert.equal(deliveries[0].to, DEFAULT_OPERATOR_EMAIL)
    assert.equal(deliveries[0].reference, saved.body.reference)
    await second.close()
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
})

test('provider delivery failures never cancel the saved reservation and can be retried', async () => {
  let time = Date.parse('2026-11-22T00:00:00Z')
  let attempts = 0
  const instance = createApp({
    databasePath: ':memory:', now: () => time,
    placesOptions: { apiKey: '' },
    ratesOptions: { fetchRate: async () => 0.00075 },
    notificationsOptions: {
      send: async () => {
        attempts++
        if (attempts === 1) throw new Error('Temporary mail failure')
      },
    },
  })
  const server = await startServer(instance)
  try {
    const booking = await server.post(reservation, randomUUID())
    assert.equal(booking.status, 201)
    await until(() => attempts === 1)
    await new Promise((resolve) => setTimeout(resolve, 20))
    time += 31000
    await instance.flushNotifications()
    assert.equal(attempts, 2)
    await instance.flushNotifications()
    assert.equal(attempts, 2)
  } finally {
    await server.close()
  }
})
