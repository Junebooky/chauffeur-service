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
  assert.match(message.html, /cid:chauffeur-email-header/)
  assert.match(message.html, /width="640" height="130"/)
  assert.equal(message.attachments.length, 1)
  assert.equal(message.attachments[0].cid, 'chauffeur-email-header')
  assert.equal(Buffer.isBuffer(message.attachments[0].content), true)
  assert.match(message.text, /J Production/)
  assert.match(message.text, /Preferred contact: email/)
  assert.match(message.text, /tax excluded/i)
})

test('Gmail SMTP uses secure Nodemailer transport and sends branded HTML plus text', async () => {
  const transports = []
  const deliveries = []
  const sender = createOperatorNotifier({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    user: 'topcs2026@gmail.com',
    appPassword: 'abcd efgh ijkl mnop',
    createTransport: (config) => {
      transports.push(config)
      return {
        sendMail: async (mail) => {
          deliveries.push(mail)
          return { accepted: [DEFAULT_OPERATOR_EMAIL], rejected: [] }
        },
      }
    },
  })
  assert.equal(sender.enabled, true)
  assert.equal(sender.to, DEFAULT_OPERATOR_EMAIL)
  assert.equal(transports.length, 1)
  assert.equal(transports[0].host, 'smtp.gmail.com')
  assert.equal(transports[0].port, 465)
  assert.equal(transports[0].secure, true)
  assert.equal(transports[0].auth.user, DEFAULT_OPERATOR_EMAIL)
  assert.equal(transports[0].auth.pass, 'abcdefghijklmnop')
  assert.equal(await sender.deliver({
    reference: 'CH-1A2B3C4D', total: 200000, details,
  }), true)
  assert.equal(deliveries.length, 1)
  assert.deepEqual(deliveries[0].from, {
    name: 'Chauffeur Service', address: 'topcs2026@gmail.com',
  })
  assert.equal(deliveries[0].to, DEFAULT_OPERATOR_EMAIL)
  assert.equal(deliveries[0].replyTo, details.email)
  assert.equal(deliveries[0].messageId, '<chauffeur.CH-1A2B3C4D@gmail.com>')
  assert.match(deliveries[0].html, /DAILY ITINERARY/)
  assert.match(deliveries[0].text, /CH-1A2B3C4D/)
})

test('missing SMTP credentials cannot attempt a network send', async () => {
  let created = 0
  const sender = createOperatorNotifier({
    user: 'topcs2026@gmail.com',
    appPassword: '',
    createTransport: () => { created++; throw new Error('must not connect') },
  })
  assert.equal(sender.enabled, false)
  assert.equal(created, 0)
  assert.equal(await sender.deliver({
    reference: 'CH-1A2B3C4D', total: 200000, details,
  }), false)
})

test('Gmail SMTP recipient rejection is retried instead of marking a notification sent', async () => {
  let count = 0
  const sender = createOperatorNotifier({
    user: 'topcs2026@gmail.com',
    appPassword: 'abcdefghijklmnop',
    createTransport: () => ({
      sendMail: async () => {
        count++
        return { accepted: [], rejected: [DEFAULT_OPERATOR_EMAIL] }
      },
    }),
  })
  await assert.rejects(
    sender.deliver({ reference: 'CH-1A2B3C4D', total: 200000, details }),
    /did not accept the operator recipient/,
  )
  assert.equal(count, 1)
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
      notificationsOptions: { user: '', appPassword: '' },
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
