import express from 'express'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import catalog from '../src/catalog.json' with { type: 'json' }
import { createPlaces } from './places.mjs'

export function createApp({
  databasePath = resolve('.data/reservations.sqlite'),
  now = () => Date.now(),
  placesOptions = {},
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
  `)
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '12kb' }))
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  const places = createPlaces({ now, ...placesOptions })
  app.use('/api/places', places.router)

  function schedule(input) {
    const service = catalog.services.find((s) => s.id === input.service)
    if (!service) throw new Error('Please select a service.')
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.date || '') ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time || '')
    )
      throw new Error('Please select a valid date and time.')
    const startsAt = Date.parse(`${input.date}T${input.time}:00+09:00`)
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
  const occupied = db.prepare(
    "SELECT id FROM reservations WHERE vehicle_id = ? AND status IN ('pending', 'confirmed') AND starts_at < ? AND ends_at > ? LIMIT 1",
  )
  const publicBooking = (row) => {
    const d = JSON.parse(row.details)
    return {
      reference: row.id,
      status: row.status,
      total: row.total,
      currency: catalog.currency,
      date: d.date,
      time: d.time,
      service: catalog.services.find((s) => s.id === d.service).name,
      vehicle: catalog.vehicles.find((v) => v.id === d.vehicle).name,
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
  app.get('/api/availability', (req, res) => {
    try {
      const { startsAt, endsAt } = schedule(req.query)
      res.json({
        vehicles: catalog.vehicles.map((v) => ({
          id: v.id,
          available: !occupied.get(v.id, endsAt, startsAt),
        })),
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
      const { service, startsAt, endsAt } = schedule(b)
      const vehicle = catalog.vehicles.find((v) => v.id === b.vehicle)
      if (!vehicle) throw new Error('Please select a vehicle.')
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
      if (
        !Array.isArray(b.options) ||
        new Set(b.options).size !== b.options.length ||
        b.options.some((o) => !catalog.options.some((opt) => opt.id === o))
      )
        throw new Error('Please select valid journey options.')
      if (b.flight && (typeof b.flight !== 'string' || b.flight.length > 30))
        throw new Error('Please enter a valid flight number.')
      const total =
        service.price +
        vehicle.surcharge +
        catalog.options
          .filter((o) => b.options.includes(o.id))
          .reduce((sum, o) => sum + o.price, 0)
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
      details.pickup = pickupPlace.address
      details.destination = destinationPlace.address
      details.pickupPlace = pickupPlace
      details.destinationPlace = destinationPlace
      details.flight = (b.flight || '').trim()
      details.consent = true
      const reference = `CH-${randomUUID().slice(0, 8).toUpperCase()}`
      db.exec('BEGIN IMMEDIATE')
      try {
        if (occupied.get(vehicle.id, endsAt, startsAt)) {
          db.exec('ROLLBACK')
          return res.status(409).json({
            error:
              'This vehicle is already requested for that time. Please choose another vehicle or time.',
          })
        }
        db.prepare(
          'INSERT INTO reservations (id, idempotency_key, vehicle_id, starts_at, ends_at, total, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ).run(
          reference,
          key,
          vehicle.id,
          startsAt,
          endsAt,
          total,
          JSON.stringify(details),
          new Date(now()).toISOString(),
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
