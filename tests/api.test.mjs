import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../server/app.mjs'

const fixedNow = Date.parse('2026-10-30T00:00:00Z')
const valid = {
  date: '2026-11-10',
  time: '10:00',
  service: 'hourly',
  vehicle: 'executive',
  pickup: 'Incheon Airport Terminal 2',
  destination: 'Four Seasons Hotel Seoul',
  pickupPlace: { id: 'curated:icn-t2' },
  destinationPlace: { id: 'curated:four-seasons' },
  name: 'Test Traveller',
  email: 'test@example.com',
  phone: '+82 10 1234 5678',
  consent: true,
  options: [],
}

async function withServer(run, databasePath = ':memory:') {
  const instance = createApp({
    databasePath,
    now: () => fixedNow,
    placesOptions: { apiKey: '' },
  })
  const server = await new Promise((resolve) => {
    const s = instance.app.listen(0, '127.0.0.1', () => resolve(s))
  })
  const base = `http://127.0.0.1:${server.address().port}`
  const post = async (body, key = randomUUID()) => {
    const response = await fetch(`${base}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(body),
    })
    return { status: response.status, data: await response.json() }
  }
  try {
    await run({ base, post })
  } finally {
    await new Promise((resolve) => server.close(resolve))
    instance.close()
  }
}

test('health verifies the live reservation database', () =>
  withServer(async ({ base }) => {
    const response = await fetch(`${base}/api/health`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      status: 'ok',
      storage: 'sqlite',
      timeZone: 'Asia/Seoul',
    })
  }))

test('saves a pending request and independently calculates the price', () =>
  withServer(async ({ post }) => {
    const result = await post({
      ...valid,
      vehicle: 'first',
      options: ['childSeat', 'welcome'],
      total: 1,
    })
    assert.equal(result.status, 201)
    assert.equal(result.data.status, 'pending')
    assert.equal(result.data.total, 350000)
    assert.match(result.data.reference, /^CH-[0-9A-F]{8}$/)
    assert.equal(result.data.currency, 'KRW')
    assert.equal(result.data.taxIncluded, false)
    assert.equal(result.data.email, undefined)
  }))

test('retries are idempotent and do not create duplicate requests', () =>
  withServer(async ({ post }) => {
    const key = randomUUID()
    const first = await post(valid, key)
    const second = await post(valid, key)
    assert.equal(first.status, 201)
    assert.equal(second.status, 200)
    assert.deepEqual(first.data, second.data)
  }))

test('rejects overlapping journeys and reports per-vehicle availability', () =>
  withServer(async ({ post, base }) => {
    assert.equal((await post(valid)).status, 201)
    const overlap = await post({ ...valid, time: '13:30' })
    assert.equal(overlap.status, 409)
    const available = await fetch(
      `${base}/api/availability?date=2026-11-10&time=12:00&service=hourly`,
    ).then((r) => r.json())
    assert.deepEqual(available.vehicles, [
      { id: 'executive', available: false },
      { id: 'first', available: true },
      { id: 'sprinter319', available: true },
      { id: 'sprinter519', available: true },
    ])
    assert.equal((await post({ ...valid, time: '14:00' })).status, 201)
    assert.equal((await post({ ...valid, vehicle: 'first' })).status, 201)
  }))

test('simultaneous requests cannot take the same slot', () =>
  withServer(async ({ post }) => {
    const results = await Promise.all([post(valid), post(valid)])
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409])
  }))

test('rejects invalid dates, insufficient notice, forged options and missing contact consent', async () => {
  for (const patch of [
    { date: '2026-02-30' },
    { date: '2026-11-31' },
    { date: '2026-10-29' },
    { date: '2026-10-30', time: '10:30' },
    { date: '2028-11-10' },
    { time: '25:00' },
    { email: 'invalid-email' },
    { phone: 'abcdefg' },
    { consent: false },
    { options: ['freeUpgrade'] },
    { options: ['childSeat', 'childSeat'] },
    { vehicle: 'invalid' },
    { service: 'invalid' },
    { name: '' },
    { pickup: 'x'.repeat(251) },
  ])
    await withServer(async ({ post }) =>
      assert.equal(
        (await post({ ...valid, ...patch })).status,
        400,
        JSON.stringify(patch),
      ),
    )
})

test('rate-limits repeated new request attempts without blocking safe retries', () =>
  withServer(async ({ post }) => {
    const key = randomUUID()
    assert.equal((await post(valid, key)).status, 201)
    for (let i = 0; i < 7; i++) assert.equal((await post(valid)).status, 409)
    assert.equal((await post(valid)).status, 429)
    assert.equal((await post(valid, key)).status, 200)
  }))

test('pending requests survive a server restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'chauffeur-test-'))
  const databasePath = join(dir, 'bookings.sqlite')
  let reference
  const key = randomUUID()
  try {
    await withServer(async ({ post }) => {
      const result = await post(valid, key)
      reference = result.data.reference
    }, databasePath)
    await withServer(async ({ post }) => {
      const replay = await post(valid, key)
      assert.equal(replay.status, 200)
      assert.equal(replay.data.reference, reference)
      assert.equal((await post(valid)).status, 409)
    }, databasePath)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('does not expose stored personal details through a listing endpoint', () =>
  withServer(async ({ base, post }) => {
    await post(valid)
    const response = await fetch(`${base}/api/reservations`)
    assert.equal(response.status, 404)
    const text = await response.text()
    assert.ok(!text.includes(valid.email))
  }))

test('requires resolved route locations and rejects a pickup equal to the destination', () =>
  withServer(async ({ post }) => {
    for (const patch of [
      { pickupPlace: null },
      {
        destinationPlace: {
          id: 'invented-place',
          latitude: 37,
          longitude: 127,
        },
      },
      { destinationPlace: { id: 'curated:icn-t2' } },
    ])
      assert.equal((await post({ ...valid, ...patch })).status, 400)
  }))

test('stores canonical addresses and coordinates, ignoring client coordinate tampering', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'chauffeur-route-'))
  const databasePath = join(dir, 'bookings.sqlite')
  try {
    await withServer(async ({ post }) => {
      assert.equal(
        (
          await post({
            ...valid,
            pickup: 'fake address',
            pickupPlace: { id: 'curated:icn-t2', latitude: 0, longitude: 0 },
          })
        ).status,
        201,
      )
    }, databasePath)
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(databasePath)
    const details = JSON.parse(
      db.prepare('SELECT details FROM reservations').get().details,
    )
    assert.equal(details.pickupPlace.id, 'curated:icn-t2')
    assert.equal(details.pickupPlace.latitude, 37.4686)
    assert.equal(details.pickupPlace.longitude, 126.4332)
    assert.match(details.pickup, /446 Je2terminal-daero/)
    assert.equal(details.destinationPlace.id, 'curated:four-seasons')
    db.close()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

const twoDays = {
  ...valid,
  journeys: [
    { date: '2026-11-10', vehicle: 'executive' },
    { date: '2026-11-11', vehicle: 'first' },
  ],
}

test('prices every daily vehicle and extra, retries safely, and reserves only the actual daily slots', () =>
  withServer(async ({ post, base }) => {
    const key = randomUUID()
    const body = { ...twoDays, options: ['childSeat', 'welcome'], total: 1 }
    const result = await post(body, key)
    assert.equal(result.status, 201)
    assert.equal(result.data.total, 640000)
    assert.deepEqual(
      result.data.journeys.map((day) => [day.date, day.vehicle, day.total]),
      [
        ['2026-11-10', 'Executive Sedan', 290000],
        ['2026-11-11', 'First Class Sedan', 350000],
      ],
    )
    assert.deepEqual((await post(body, key)).data, result.data)
    const available = await fetch(
      `${base}/api/availability?date=2026-11-10&endDate=2026-11-11&time=10:00&service=hourly`,
    ).then((r) => r.json())
    assert.equal(available.days.length, 2)
    assert.equal(
      available.days[0].vehicles.find((v) => v.id === 'executive').available,
      false,
    )
    assert.equal(
      available.days[0].vehicles.find((v) => v.id === 'first').available,
      true,
    )
    assert.equal(
      available.days[1].vehicles.find((v) => v.id === 'executive').available,
      true,
    )
    assert.equal(
      available.days[1].vehicles.find((v) => v.id === 'first').available,
      false,
    )
    assert.equal((await post({ ...valid, date: '2026-11-11' })).status, 201)
    assert.equal((await post({ ...valid, time: '18:00' })).status, 201)
  }))

test('a later-day conflict rejects the entire request without reserving earlier days', () =>
  withServer(async ({ post, base }) => {
    assert.equal(
      (await post({ ...valid, date: '2026-11-11', vehicle: 'first' })).status,
      201,
    )
    const rejected = await post(twoDays)
    assert.equal(rejected.status, 409)
    assert.match(rejected.data.error, /2026-11-11/)
    const availability = await fetch(
      `${base}/api/availability?date=2026-11-10&time=10:00&service=hourly`,
    ).then((r) => r.json())
    assert.equal(
      availability.vehicles.find((v) => v.id === 'executive').available,
      true,
    )
    assert.equal((await post(valid)).status, 201)
  }))

test('simultaneous multi-day requests cannot reserve any shared daily slot twice', () =>
  withServer(async ({ post }) => {
    const results = await Promise.all([post(twoDays), post(twoDays)])
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409])
  }))

test('rejects missing, duplicate, unordered, skipped and invalid daily selections', async () => {
  for (const journeys of [
    [],
    null,
    'invalid',
    [null],
    [{ date: valid.date, vehicle: 'invalid' }],
    [{ date: '2026-11-11', vehicle: 'executive' }],
    [{ date: valid.date, vehicle: 'first' }],
    [twoDays.journeys[0], twoDays.journeys[0]],
    [twoDays.journeys[0], { date: '2026-11-12', vehicle: 'first' }],
    [twoDays.journeys[0], { date: '2026-11-09', vehicle: 'first' }],
    [twoDays.journeys[0], { date: '2026-11-31', vehicle: 'first' }],
    [twoDays.journeys[0], { date: '2028-11-11', vehicle: 'first' }],
  ])
    await withServer(async ({ post }) => {
      assert.equal(
        (await post({ ...valid, journeys })).status,
        400,
        JSON.stringify(journeys),
      )
    })
  await withServer(async ({ base }) => {
    for (const endDate of ['2026-11-09', '2026-11-31', '2028-11-11']) {
      const response = await fetch(
        `${base}/api/availability?date=2026-11-10&endDate=${endDate}&time=10:00&service=hourly`,
      )
      assert.equal(response.status, 400)
    }
  })
})

test('Sprinters require a quote and never present an invented total, including mixed daily journeys', () =>
  withServer(async ({ post }) => {
    for (const vehicle of ['sprinter319', 'sprinter519']) {
      const result = await post({ ...valid, vehicle, total: 120000 })
      assert.equal(result.status, 201)
      assert.equal(result.data.total, null)
      assert.equal(result.data.quoteRequired, true)
      assert.equal(result.data.taxIncluded, false)
      assert.equal(result.data.journeys[0].total, null)
    }
    const mixed = await post({
      ...twoDays,
      journeys: [
        twoDays.journeys[0],
        { date: '2026-11-11', vehicle: 'sprinter319' },
      ],
    })
    assert.equal(mixed.status, 201)
    assert.equal(mixed.data.total, null)
    assert.equal(mixed.data.journeys[0].total, 260000)
    assert.equal(mixed.data.journeys[1].total, null)
  }))

test('stores contact preferences privately, using the supplied phone for WhatsApp when no override is entered', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'chauffeur-contact-'))
  const databasePath = join(dir, 'requests.sqlite')
  try {
    const methods = ['email', 'phone', 'whatsapp', 'line', 'kakao', 'wechat']
    await withServer(async ({ post }) => {
      for (const [index, contactMethod] of methods.entries()) {
        const result = await post({
          ...valid,
          date: `2026-11-${10 + index}`,
          contactMethod,
          messengerContact: index > 2 ? ' traveller-id ' : '',
        })
        assert.equal(result.status, 201)
        assert.equal(result.data.contactMethod, undefined)
        assert.equal(result.data.messengerContact, undefined)
      }
    }, databasePath)
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(databasePath)
    try {
      const details = db
        .prepare('SELECT details FROM reservations ORDER BY starts_at')
        .all()
        .map((row) => JSON.parse(row.details))
      assert.deepEqual(
        details.map((d) => d.contactMethod),
        methods,
      )
      assert.equal(details[2].messengerContact, valid.phone)
      assert.equal(details[3].messengerContact, 'traveller-id')
    } finally {
      db.close()
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('rejects invalid messenger preferences and missing messenger IDs', async () => {
  for (const patch of [
    { contactMethod: 'invented' },
    { contactMethod: null },
    { contactMethod: 'line', messengerContact: '' },
    { contactMethod: 'kakao', messengerContact: '   ' },
    { contactMethod: 'wechat' },
    { contactMethod: 'line', messengerContact: 'x'.repeat(81) },
    { contactMethod: 'line', messengerContact: 1234 },
    { contactMethod: 'whatsapp', messengerContact: 'not-a-number' },
  ])
    await withServer(async ({ post }) => {
      assert.equal((await post({ ...valid, ...patch })).status, 400)
    })
})

test('daily slots and prices survive a restart without duplicating the first day during migration', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'chauffeur-days-'))
  const databasePath = join(dir, 'requests.sqlite')
  const key = randomUUID()
  try {
    await withServer(async ({ post }) => {
      assert.equal((await post(twoDays, key)).status, 201)
    }, databasePath)
    await withServer(async ({ post }) => {
      const result = await post(twoDays, key)
      assert.equal(result.status, 200)
      assert.equal(result.data.journeys.length, 2)
      assert.equal(result.data.total, 580000)
      assert.equal(
        (await post({ ...valid, date: '2026-11-11', vehicle: 'first' })).status,
        409,
      )
    }, databasePath)
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(databasePath)
    try {
      assert.equal(
        db.prepare('SELECT COUNT(*) AS count FROM reservation_legs').get()
          .count,
        2,
      )
    } finally {
      db.close()
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('migrates pre-existing single-day requests into daily slots while preserving their conflicts and safe retries', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'chauffeur-legacy-'))
  const databasePath = join(dir, 'requests.sqlite')
  const key = randomUUID()
  try {
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(databasePath)
    db.exec(`CREATE TABLE reservations (
      id TEXT PRIMARY KEY, idempotency_key TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', vehicle_id TEXT NOT NULL,
      starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL,
      total INTEGER NOT NULL, details TEXT NOT NULL, created_at TEXT NOT NULL
    )`)
    const start = Date.parse('2026-11-10T10:00:00+09:00')
    db.prepare(
      'INSERT INTO reservations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      'CH-LEGACY01',
      key,
      'pending',
      'executive',
      start,
      start + 4 * 3600000,
      260000,
      JSON.stringify(valid),
      new Date(fixedNow).toISOString(),
    )
    db.close()
    await withServer(async ({ post }) => {
      assert.equal((await post(valid)).status, 409)
      const replay = await post(valid, key)
      assert.equal(replay.status, 200)
      assert.equal(replay.data.reference, 'CH-LEGACY01')
      assert.equal(replay.data.journeys.length, 1)
      assert.equal(replay.data.total, 260000)
    }, databasePath)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
