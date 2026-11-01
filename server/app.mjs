import express from 'express'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import catalog from '../src/catalog.json' with { type: 'json' }
import { createPlaces } from './places.mjs'
import { createRatesService } from './rates.mjs'

export function createApp({
  databasePath = resolve('.data/reservations.sqlite'),
  now = () => Date.now(),
  placesOptions = {},
  ratesOptions = {},
} = {}) {
  if (databasePath !== ':memory:')
    mkdirSync(dirname(databasePath), { recursive: true })
  const db = new DatabaseSync(databasePath)
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY, idempotency_key TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', vehicle_id TEXT NOT NULL,
      starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL,
      total INTEGER NOT NULL, details TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS reservation_slots ON reservations(vehicle_id, starts_at, ends_at);
    CREATE TABLE IF NOT EXISTS reservation_legs (
      reservation_id TEXT NOT NULL REFERENCES reservations(id),
      position INTEGER NOT NULL, vehicle_id TEXT NOT NULL,
      starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL,
      PRIMARY KEY (reservation_id, position)
    );
    CREATE INDEX IF NOT EXISTS leg_slots ON reservation_legs(vehicle_id, starts_at, ends_at);
    INSERT OR IGNORE INTO reservation_legs
      (reservation_id, position, vehicle_id, starts_at, ends_at)
      SELECT id, 0, vehicle_id, starts_at, ends_at FROM reservations;
  `)
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '64kb' }))
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  const places = createPlaces({ now, ...placesOptions })
  app.use('/api/places', places.router)
  const rates = createRatesService({ now, ...ratesOptions })

  function schedule(input) {
    const service = catalog.services.find((s) => s.id === input.service)
    if (!service) throw new Error('Please select a service.')
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.date || '') ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time || '')
    )
      throw new Error('Please select a valid date and time.')
    const startsAt = Date.parse(`${input.date}T${input.time}:00+09:00`)
    if (!Number.isFinite(startsAt))
      throw new Error('Please select a valid date.')
    const parsedDate = new Date(startsAt + 9 * 3600000)
      .toISOString()
      .slice(0, 10)
    if (parsedDate !== input.date)
      throw new Error('Please select a valid date.')
    if (startsAt < now() + 2 * 3600000)
      throw new Error('Please allow at least two hours before your journey.')
    if (startsAt > now() + 366 * 86400000)
      throw new Error('Journeys can be requested up to one year in advance.')
    return { service, startsAt, endsAt: startsAt + service.duration * 3600000 }
  }
  function requestedDays(input) {
    const first = schedule(input)
    if (!input.endDate || input.endDate === input.date)
      return [{ date: input.date, ...first }]
    const last = schedule({ ...input, date: input.endDate })
    if (last.startsAt < first.startsAt)
      throw new Error('The last day must be on or after your first day.')
    const days = []
    for (
      let startsAt = first.startsAt;
      startsAt <= last.startsAt;
      startsAt += 86400000
    )
      days.push({
        date: new Date(startsAt + 9 * 3600000).toISOString().slice(0, 10),
        service: first.service,
        startsAt,
        endsAt: startsAt + first.service.duration * 3600000,
      })
    return days
  }
  const occupied = db.prepare(
    "SELECT r.id FROM reservation_legs l JOIN reservations r ON r.id = l.reservation_id WHERE l.vehicle_id = ? AND r.status IN ('pending', 'confirmed') AND l.starts_at < ? AND l.ends_at > ? LIMIT 1",
  )
  const publicBooking = (row) => {
    const d = JSON.parse(row.details)
    return {
      reference: row.id,
      status: row.status,
      total: d.quoteRequired ? null : row.total,
      quoteRequired: d.quoteRequired || false,
      taxIncluded: catalog.taxIncluded,
      currency: catalog.currency,
      date: d.date,
      time: d.time,
      service: catalog.services.find((s) => s.id === d.service).name,
      vehicle: catalog.vehicles.find((v) => v.id === d.vehicle).name,
      journeys: (
        d.journeys || [{ date: d.date, vehicle: d.vehicle, total: row.total }]
      ).map((day) => ({
        date: day.date,
        time: d.time,
        service: catalog.services.find((s) => s.id === d.service).name,
        vehicle: catalog.vehicles.find((v) => v.id === day.vehicle).name,
        total: day.total,
      })),
    }
  }
  app.get('/api/health', (_req, res) => {
    try {
      db.prepare('SELECT 1').get()
      res.json({ status: 'ok', storage: 'sqlite', timeZone: catalog.timeZone })
    } catch {
      res.status(503).json({ error: 'Reservation storage is unavailable.' })
    }
  })
  app.get('/api/rates', async (_req, res) => {
    try {
      const data = await rates.getRate()
      res.json(data)
    } catch {
      res.json({ base: 'KRW', target: 'USD', rate: 0.000749 })
    }
  })
  app.get('/api/availability', async (req, res) => {
    try {
      const days = requestedDays(req.query).map(
        ({ date, startsAt, endsAt }) => ({
          date,
          vehicles: catalog.vehicles.map((v) => ({
            id: v.id,
            available: !occupied.get(v.id, endsAt, startsAt),
          })),
        }),
      )
      res.json({
        usdRate: (await rates.getRate()).rate,
        vehicles: days[0].vehicles,
        days,
      })
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })
  const limits = new Map()
  app.post('/api/reservations', (req, res, next) => {
    try {
      const key = req.get('Idempotency-Key')
      if (!key || !/^[a-zA-Z0-9-]{16,80}$/.test(key))
        return res.status(400).json({
          error: 'A valid request identifier is required. Please retry.',
        })
      const previous = db
        .prepare('SELECT * FROM reservations WHERE idempotency_key = ?')
        .get(key)
      if (previous) return res.json(publicBooking(previous))
      const ip = req.ip || 'local'
      const recent = (limits.get(ip) || []).filter((t) => now() - t < 600000)
      if (recent.length >= 8)
        return res.status(429).json({
          error: 'Too many requests. Please try again in a few minutes.',
        })
      limits.set(ip, [...recent, now()])
      if (limits.size > 10000)
        for (const [address, hits] of limits)
          if (hits.every((t) => now() - t > 600000)) limits.delete(address)
      const b = req.body
      if (!b || typeof b !== 'object' || Array.isArray(b))
        throw new Error('Please enter your journey details.')
      const { service } = schedule(b)
      const submittedDays =
        b.journeys === undefined
          ? [{ date: b.date, vehicle: b.vehicle }]
          : b.journeys
      if (
        !Array.isArray(submittedDays) ||
        submittedDays.length < 1 ||
        submittedDays.length > 366
      )
        throw new Error('Please select a vehicle for every journey date.')
      const days = submittedDays.map((day, index) => {
        if (!day || typeof day !== 'object' || Array.isArray(day))
          throw new Error('Please enter valid daily journey details.')
        const slot = schedule({ ...b, date: day.date })
        const selected = catalog.vehicles.find((v) => v.id === day.vehicle)
        if (!selected)
          throw new Error('Please select a valid vehicle for every day.')
        if (index === 0 && (day.date !== b.date || day.vehicle !== b.vehicle))
          throw new Error(
            'Your first day must match the start of your journey.',
          )
        return { date: day.date, vehicle: selected, ...slot }
      })
      if (
        days.some(
          (day, i) => i > 0 && day.startsAt !== days[i - 1].startsAt + 86400000,
        )
      )
        throw new Error(
          'Please include each consecutive journey date once, in date order.',
        )
      const vehicle = days[0].vehicle
      const pickupPlace = places.selected(b.pickupPlace)
      const destinationPlace = places.selected(b.destinationPlace)
      if (pickupPlace.id === destinationPlace.id)
        throw new Error(
          'Please choose a destination different from your pickup location.',
        )
      for (const [field, label, max] of [
        ['name', 'name', 100],
        ['email', 'email address', 180],
        ['phone', 'phone number', 40],
        ['pickup', 'pickup address', 250],
        ['destination', 'destination', 250],
      ]) {
        if (
          typeof b[field] !== 'string' ||
          !b[field].trim() ||
          b[field].length > max
        )
          throw new Error(`Please enter a valid ${label}.`)
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim()))
        throw new Error('Please enter a valid email address.')
      if (
        !/^\+?[\d\s().-]{7,40}$/.test(b.phone.trim()) ||
        b.phone.replace(/\D/g, '').length < 7
      )
        throw new Error(
          'Please enter a valid phone number, including country code.',
        )
      if (b.consent !== true)
        throw new Error('Please accept the reservation and privacy notice.')
      const contactMethod =
        b.contactMethod === undefined ? 'email' : b.contactMethod
      if (!catalog.contactMethods.some((method) => method.id === contactMethod))
        throw new Error('Please choose a valid preferred contact method.')
      if (
        b.messengerContact !== undefined &&
        (typeof b.messengerContact !== 'string' ||
          b.messengerContact.length > 80)
      )
        throw new Error(
          'Please enter valid messenger contact details (up to 80 characters).',
        )
      const messengerContact = ['email', 'phone'].includes(contactMethod)
        ? ''
        : (
            b.messengerContact || (contactMethod === 'whatsapp' ? b.phone : '')
          ).trim()
      if (
        ['line', 'kakao', 'wechat'].includes(contactMethod) &&
        !messengerContact
      )
        throw new Error('Please enter your messenger ID.')
      if (
        contactMethod === 'whatsapp' &&
        (!/^\+?[\d\s().-]{7,40}$/.test(messengerContact) ||
          messengerContact.replace(/\D/g, '').length < 7)
      )
        throw new Error(
          'Please enter a valid WhatsApp number, including country code.',
        )
      if (
        !Array.isArray(b.options) ||
        new Set(b.options).size !== b.options.length ||
        b.options.some((o) => !catalog.options.some((opt) => opt.id === o))
      )
        throw new Error('Please select valid journey options.')
      if (b.flight && (typeof b.flight !== 'string' || b.flight.length > 30))
        throw new Error('Please enter a valid flight number.')
      const extras = catalog.options
        .filter((o) => b.options.includes(o.id))
        .reduce((sum, o) => sum + o.price, 0)
      const total = days.reduce(
        (sum, day) => sum + service.price + day.vehicle.surcharge + extras,
        0,
      )
      const details = Object.fromEntries(
        [
          'date',
          'time',
          'service',
          'vehicle',
          'name',
          'email',
          'phone',
          'pickup',
          'destination',
        ].map((k) => [k, b[k].trim()]),
      )
      details.options = b.options
      details.journeys = days.map((day) => ({
        date: day.date,
        vehicle: day.vehicle.id,
        total: day.vehicle.quoteRequired
          ? null
          : service.price + day.vehicle.surcharge + extras,
      }))
      details.quoteRequired = days.some((day) => day.vehicle.quoteRequired)
      details.taxIncluded = catalog.taxIncluded
      details.contactMethod = contactMethod
      details.messengerContact = messengerContact
      details.pickup = pickupPlace.address
      details.destination = destinationPlace.address
      details.pickupPlace = pickupPlace
      details.destinationPlace = destinationPlace
      details.flight = (b.flight || '').trim()
      details.consent = true
      const reference = `CH-${randomUUID().slice(0, 8).toUpperCase()}`
      db.exec('BEGIN IMMEDIATE')
      try {
        const conflict = days.find((day) =>
          occupied.get(day.vehicle.id, day.endsAt, day.startsAt),
        )
        if (conflict) {
          db.exec('ROLLBACK')
          return res.status(409).json({
            error: `${conflict.vehicle.name} is already requested on ${conflict.date} at that time. Please choose another vehicle or time.`,
          })
        }
        db.prepare(
          'INSERT INTO reservations (id, idempotency_key, vehicle_id, starts_at, ends_at, total, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ).run(
          reference,
          key,
          vehicle.id,
          days[0].startsAt,
          days.at(-1).endsAt,
          total,
          JSON.stringify(details),
          new Date(now()).toISOString(),
        )
        const insertLeg = db.prepare(
          'INSERT INTO reservation_legs (reservation_id, position, vehicle_id, starts_at, ends_at) VALUES (?, ?, ?, ?, ?)',
        )
        days.forEach((day, index) =>
          insertLeg.run(
            reference,
            index,
            day.vehicle.id,
            day.startsAt,
            day.endsAt,
          ),
        )
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
      res
        .status(201)
        .json(
          publicBooking(
            db
              .prepare('SELECT * FROM reservations WHERE id = ?')
              .get(reference),
          ),
        )
    } catch (error) {
      if (error.code?.startsWith('ERR_SQLITE')) return next(error)
      res
        .status(400)
        .json({ error: error.message || 'Please check your journey details.' })
    }
  })
  app.use('/api', (_req, res) =>
    res.status(404).json({ error: 'This service could not be found.' }),
  )
  app.use((error, _req, res, _next) => {
    if (error instanceof SyntaxError || error.type === 'entity.too.large')
      return res
        .status(400)
        .json({ error: 'Please submit valid journey details.' })
    console.error('Reservation service error:', error.code || error.name)
    res
      .status(500)
      .json({ error: 'We could not save your request. Please try again.' })
  })
  return {
    app,
    close: () => {
      db.close()
      void places.close()
    },
  }
}
