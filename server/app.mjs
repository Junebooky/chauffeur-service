import express from 'express'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import catalog from '../src/catalog.json' with { type: 'json' }
import { createPlaces } from './places.mjs'
import { placesHandler } from './places-handler.mjs'
import { createRatesService } from './rates.mjs'
import { createOperatorNotifier } from './notifications.mjs'
import { requestableDays } from './requestable-availability.mjs'
import { hasDatabase } from './chauffeur-supabase.mjs'
import liveBooking from '../api/reservations.js'
import liveAvailability from '../api/availability.js'
import liveAdmin from '../api/admin.js'
import gmailCallback from '../api/gmail/callback.js'
import liveOverview from '../api/admin-overview.js'

export function createApp({
  databasePath = resolve('.data/reservations.sqlite'),
  now = () => Date.now(),
  placesOptions = {},
  ratesOptions = {},
  notificationsOptions = {},
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
    CREATE TABLE IF NOT EXISTS reservation_notifications (
      reservation_id TEXT PRIMARY KEY REFERENCES reservations(id),
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL DEFAULT 0,
      sent_at TEXT
    );
    CREATE INDEX IF NOT EXISTS notification_retry ON reservation_notifications(status, next_attempt_at);
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
  // When Supabase is configured, local Vite + Express must use the SAME
  // persistent booking and operations APIs as Vercel production.
  // Existing SQLite mode remains available for offline tests and legacy dev.
  if (hasDatabase() && process.env.CHAUFFEUR_USE_SQLITE !== 'true') {
    app.all('/api/availability', (req, res) => liveAvailability(req, res))
    app.all('/api/reservations', (req, res) => { void liveBooking(req, res) })
    app.all('/api/admin', (req, res) => { void liveAdmin(req, res) })
  }
  // This public summary never contains personal customer details.
  app.all('/api/gmail/callback', (req,res)=>{void gmailCallback(req,res)})
  app.all('/api/admin-overview', (req, res) => { void liveOverview(req, res) })

  const places = createPlaces({ now, ...placesOptions })
  if (hasDatabase() && process.env.CHAUFFEUR_USE_SQLITE !== 'true') {
    // Match the stateless Vercel place APIs, including signed Google selections.
    app.all('/api/places/search', (req, res) => { void placesHandler(req, res, 'search') })
    app.all('/api/places/resolve', (req, res) => { void placesHandler(req, res, 'resolve') })
  } else {
    app.use('/api/places', places.router)
  }
  const rates = createRatesService({ now, ...ratesOptions })

  const notifier = createOperatorNotifier(notificationsOptions)
  if (process.env.NODE_ENV === 'production' && !notifier.enabled) {
    // Do not log addresses, passwords or guest details. Make missing SMTP
    // setup observable; requests still save and remain in the SQLite outbox.
    console.warn('Operator reservation email is disabled: SMTP credentials are not configured on this API server.')
  }
  let sendingNotifications = false
  let stopped = false

  // Notifications are queued in the same database transaction as the booking.
  // Never block or roll back a valid reservation because email delivery fails.
  const flushOperatorNotifications = async () => {
    if (!notifier.enabled || sendingNotifications || stopped) return
    sendingNotifications = true
    try {
      const queued = db.prepare(`
        SELECT n.reservation_id, n.attempts, r.total, r.details
        FROM reservation_notifications n
        JOIN reservations r ON r.id = n.reservation_id
        WHERE n.status = 'pending' AND n.next_attempt_at <= ?
        ORDER BY r.created_at ASC LIMIT 10
      `).all(now())
      for (const item of queued) {
        if (stopped) break
        try {
          const details = JSON.parse(item.details)
          await notifier.deliver({
            reference: item.reservation_id,
            status: 'pending',
            total: details.quoteRequired ? null : item.total,
            details,
          })
          if (stopped) break
          db.prepare(`UPDATE reservation_notifications
            SET status = 'sent', sent_at = ?, attempts = attempts + 1
            WHERE reservation_id = ? AND status = 'pending'`)
            .run(new Date(now()).toISOString(), item.reservation_id)
        } catch (error) {
          if (stopped) break
          const attempts = item.attempts + 1
          const delay = Math.min(3600000, 30000 * 2 ** Math.min(7, attempts - 1))
          db.prepare(`UPDATE reservation_notifications
            SET attempts = ?, next_attempt_at = ?
            WHERE reservation_id = ? AND status = 'pending'`)
            .run(attempts, now() + delay, item.reservation_id)
          // SMTP failure category is safe to log. Never log recipient, guest
          // details, provider response text, or the secret app password.
          const smtpCode = typeof error?.code === 'string' &&
            /^E[A-Z_]+$/.test(error.code) ? error.code : 'UNKNOWN'
          console.error(`Operator email delivery failed (${smtpCode}); will retry.`)
        }
      }
    } catch {
      if (!stopped) console.error('Reservation email queue could not be processed.')
    } finally {
      sendingNotifications = false
    }
  }
  const emailRetry = notifier.enabled
    ? setInterval(() => { void flushOperatorNotifications() }, 60000)
    : null
  emailRetry?.unref()
  if (notifier.enabled) setImmediate(() => { void flushOperatorNotifications() })


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
    if (input.dates) {
      const dateList = Array.isArray(input.dates)
        ? input.dates
        : String(input.dates)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
      if (dateList.length === 0)
        throw new Error('Please select at least one journey date.')
      const timesList = input.times
        ? Array.isArray(input.times)
          ? input.times
          : String(input.times)
              .split(',')
              .map((s) => s.trim())
        : []
      const servicesList = input.services
        ? Array.isArray(input.services)
          ? input.services
          : String(input.services).split(',').map((item) => item.trim())
        : []
      if (servicesList.length && servicesList.length !== dateList.length)
        throw new Error('Please select a service for every journey date.')
      return dateList.map((d, index) => {
        const t = timesList[index] || input.time
        const dailyService = servicesList.length ? servicesList[index] : input.service
        const slot = schedule({ ...input, date: d, time: t, service: dailyService })
        return { date: d, time: t, ...slot }
      })
    }
    const first = schedule(input)
    if (!input.endDate || input.endDate === input.date)
      return [{ date: input.date, time: input.time, ...first }]
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
        time: input.time,
        service: first.service,
        startsAt,
        endsAt: startsAt + first.service.duration * 3600000,
      })
    return days
  }
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
      service: catalog.services.find((s) => s.id === d.service)?.name || d.service,
      vehicle: catalog.vehicles.find((v) => v.id === d.vehicle)?.name || d.vehicle,
      journeys: (
        d.journeys || [{ date: d.date, time: d.time, vehicle: d.vehicle, total: row.total }]
      ).map((day) => ({
        date: day.date,
        time: day.time || d.time,
        service: catalog.services.find((s) => s.id === (day.service || d.service))?.name ||
          day.service || d.service,
        duration: catalog.services.find((s) => s.id === (day.service || d.service))?.duration,
        vehicle: catalog.vehicles.find((v) => v.id === day.vehicle)?.name || day.vehicle,
        pickup: day.pickup || d.pickup,
        destination: day.destination || d.destination,
        stops: Array.isArray(day.stops) ? day.stops.map((stop) => stop.location) : [],
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
      // Requestability is independent of fixed vehicle license plates or
      // overlapping reservations. Assignment is confirmed by an operator.
      const days = requestableDays(req.query, now)
      res.json({
        usdRate: (await rates.getRate()).rate,
        vehicles: days[0].vehicles,
        days,
        inventoryPolicy: 'request-only',
        bookingSubmissionReady: true,
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
      schedule(b)
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
        const dayTime = day.time || b.time
        const slot = schedule({
          ...b, date: day.date, time: dayTime,
          service: day.service === undefined ? b.service : day.service,
        })
        const selected = catalog.vehicles.find((v) => v.id === day.vehicle)
        if (!selected)
          throw new Error('Please select a valid vehicle for every day.')
        if (
          index === 0 &&
          (day.date !== b.date ||
            day.vehicle !== b.vehicle ||
            (day.time && b.time && day.time !== b.time) ||
            (day.service !== undefined && day.service !== b.service))
        )
          throw new Error(
            'Your first day must match the start of your journey.',
          )
        return { date: day.date, time: dayTime, vehicle: selected, ...slot }
      })
      if (
        days.some(
          (day, i) =>
            i > 0 &&
            (day.date <= days[i - 1].date || day.startsAt < days[i - 1].endsAt),
        )
      )
        throw new Error(
          'Please include each journey date once, in chronological order.',
        )
      const vehicle = days[0].vehicle
      // Each date can override the shared route; verify all locations using
      // the original selected-place tokens before persisting the reservation.
      const dailyRoutes = submittedDays.map((inputDay) => {
        for (const [field, max] of [['pickup', 250], ['destination', 250]]) {
          if (inputDay[field] !== undefined &&
            (typeof inputDay[field] !== 'string' ||
              !inputDay[field].trim() || inputDay[field].length > max))
            throw new Error(`Please enter a valid daily ${field}.`)
        }
        const dayPickup = places.selected(
          Object.hasOwn(inputDay, 'pickupPlace') ? inputDay.pickupPlace : b.pickupPlace,
        )
        const dayDestination = places.selected(
          Object.hasOwn(inputDay, 'destinationPlace') ? inputDay.destinationPlace : b.destinationPlace,
        )
        const dayFlight = inputDay.flight === undefined ? b.flight : inputDay.flight
        if (dayFlight && (typeof dayFlight !== 'string' || dayFlight.length > 30))
          throw new Error('Please enter a valid daily flight number.')
        const requestedStops = inputDay.stops === undefined ? [] : inputDay.stops
        if (!Array.isArray(requestedStops) || requestedStops.length > 8)
          throw new Error('Each day can have up to eight scheduled stops.')
        const stops = requestedStops.map((stop) => {
          if (!stop || typeof stop !== 'object' || Array.isArray(stop) ||
            typeof stop.location !== 'string' || !stop.location.trim() ||
            stop.location.length > 250)
            throw new Error('Please select a valid location for every stop.')
          const selected = places.selected(stop.place)
          return { location: selected.address, place: selected }
        })
        return {
          pickup: dayPickup.address,
          destination: dayDestination.address,
          pickupPlace: dayPickup,
          destinationPlace: dayDestination,
          flight: (dayFlight || '').trim(),
          stops,
        }
      })
      const pickupPlace = dailyRoutes[0].pickupPlace
      const destinationPlace = dailyRoutes[0].destinationPlace
      for (const [field, label, max] of [
        ['name', 'name', 100],
        ['email', 'email address', 180],
        ['phone', 'phone number', 40],
      ]) {
        if (
          typeof b[field] !== 'string' ||
          !b[field].trim() ||
          b[field].length > max
        )
          throw new Error(`Please enter a valid ${label}.`)
      }
      // Preserve legacy top-level input validation, while allowing modern
      // multi-day requests to supply only verified per-date route locations.
      for (const [field, label] of [
        ['pickup', 'pickup address'],
        ['destination', 'destination'],
      ]) {
        if (b[field] !== undefined &&
          (typeof b[field] !== 'string' || !b[field].trim() ||
            b[field].length > 250))
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
        throw new Error('Please enter your messenger ID or a reachable phone number.')
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
        (sum, day) => sum + day.service.price + day.vehicle.surcharge + extras,
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
        ].map((k) => [k, b[k].trim()]),
      )
      details.options = b.options
      details.journeys = days.map((day, index) => ({
        date: day.date,
        time: day.time,
        vehicle: day.vehicle.id,
        service: day.service.id,
        ...dailyRoutes[index],
        total: day.vehicle.quoteRequired
          ? null
          : day.service.price + day.vehicle.surcharge + extras,
      }))
      details.quoteRequired = days.some((day) => day.vehicle.quoteRequired)
      details.taxIncluded = catalog.taxIncluded
      details.contactMethod = contactMethod
      details.messengerContact = messengerContact
      details.pickup = pickupPlace.address
      details.destination = destinationPlace.address
      details.pickupPlace = pickupPlace
      details.destinationPlace = destinationPlace
      details.flight = dailyRoutes[0].flight
      details.consent = true
      const reference = `CH-${randomUUID().slice(0, 8).toUpperCase()}`
      db.exec('BEGIN IMMEDIATE')
      try {
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
        db.prepare(
          'INSERT INTO reservation_notifications (reservation_id, next_attempt_at) VALUES (?, ?)',
        ).run(reference, now())
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
      if (notifier.enabled) setImmediate(() => { void flushOperatorNotifications() })
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
    flushNotifications: flushOperatorNotifications,
    close: () => {
      stopped = true
      if (emailRetry) clearInterval(emailRetry)
      db.close()
      void places.close()
    },
  }
}
