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
  vehicle: 'staria',
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
    ratesOptions: { fetchRate: async () => 0.00075 },
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
      vehicle: 'sprinter_319',
      options: ['extraStop'],
      total: 1,
    })
    assert.equal(result.status, 201)
    assert.equal(result.data.status, 'pending')
    assert.equal(result.data.total, 410000)
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

test('pending requests stay requestable for overlapping hours', () =>
  withServer(async ({ post, base }) => {
    assert.equal((await post(valid)).status, 201)
    const overlap = await post({ ...valid, time: '13:30' })
    assert.equal(overlap.status, 201)
    const available = await fetch(
      `${base}/api/availability?date=2026-11-10&time=12:00&service=hourly`,
    ).then((r) => r.json())
    assert.deepEqual(available.vehicles, [
      { id: 'staria', available: true },
      { id: 'carnival_limousine', available: true },
      { id: 'g90', available: true },
      { id: 'sprinter_319', available: true },
      { id: 'sprinter_519', available: true },
    ])
    assert.equal((await post({ ...valid, time: '14:00' })).status, 201)
    assert.equal(
      (await post({ ...valid, vehicle: 'sprinter_519' })).status,
      201,
    )
  }))

test('simultaneous pending requests may overlap without hard holds', () =>
  withServer(async ({ post }) => {
    const results = await Promise.all([post(valid), post(valid)])
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 201])
  }))

test('confirmed bookings never block fleet vehicles from accepting new reservation requests', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'chauffeur-confirmed-single-'))
  const databasePath = join(dir, 'bookings.sqlite')
  try {
    await withServer(async ({ post, base }) => {
      const saved = await post(valid)
      assert.equal(saved.status, 201)
      const check = async (time) => {
        const res = await fetch(
          `${base}/api/availability?date=2026-11-10&time=${time}&service=hourly`,
        )
        assert.equal(res.status, 200)
        return (await res.json()).vehicles
      }
      assert.equal((await check('12:00')).find((v) => v.id === 'staria').available, true)
      const { DatabaseSync } = await import('node:sqlite')
      const db = new DatabaseSync(databasePath)
      db.prepare('UPDATE reservations SET status = ? WHERE id = ?')
        .run('confirmed', saved.data.reference)
      db.close()
      assert.equal((await check('12:00')).find((v) => v.id === 'staria').available, true)
      assert.equal((await check('12:00')).find((v) => v.id === 'g90').available, true)
      assert.equal((await check('14:00')).find((v) => v.id === 'staria').available, true)
      assert.equal((await post({ ...valid, time: '12:00' })).status, 201)
      assert.equal((await post({ ...valid, time: '14:00' })).status, 201)
      assert.equal((await post({ ...valid, vehicle: 'g90' })).status, 201)
    }, databasePath)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

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
    { options: ['childSeat'] },
    { options: ['extraStop', 'extraStop'] },
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
    for (let i = 0; i < 7; i++) assert.equal((await post(valid)).status, 201)
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
      assert.equal((await post(valid)).status, 201)
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
    { date: '2026-11-10', vehicle: 'staria' },
    { date: '2026-11-11', vehicle: 'g90' },
  ],
}

test('mixed daily services calculate independent rates and availability windows', () =>
  withServer(async ({ post, base }) => {
    const body = {
      ...valid,
      service: 'airport',
      journeys: [
        { date: '2026-11-10', time: '10:00', service: 'airport', vehicle: 'staria' },
        { date: '2026-11-11', time: '10:00', service: 'day', vehicle: 'staria' },
      ],
    }
    const response = await post(body)
    assert.equal(response.status, 201, JSON.stringify(response.data))
    assert.equal(response.data.total, 630000)
    assert.deepEqual(
      response.data.journeys.map((day) => [day.service, day.duration, day.total]),
      [
        ['Pick-up Service', 3, 200000],
        ['Schedule Service', 9, 430000],
      ],
    )
    const slots = await fetch(
      `${base}/api/availability?dates=2026-11-10,2026-11-11&times=13:30,13:30&service=airport&services=airport,day`,
    )
    assert.equal(slots.status, 200)
    const availability = await slots.json()
    assert.equal(availability.days.length, 2)
    assert.equal(
      availability.days[0].vehicles.find((v) => v.id === 'staria').available,
      true,
    )
    assert.equal(
      availability.days[1].vehicles.find((v) => v.id === 'staria').available,
      true,
    )
    const mismatchedService = await post({
      ...body,
      journeys: [{ ...body.journeys[0], service: 'day' }, body.journeys[1]],
    })
    assert.equal(mismatchedService.status, 400)
    const invalidService = await post({
      ...body,
      date: '2026-11-12',
      journeys: [
        { date: '2026-11-12', time: '10:00', service: 'airport', vehicle: 'staria' },
        { date: '2026-11-13', time: '10:00', service: 'invalid', vehicle: 'staria' },
      ],
    })
    assert.equal(invalidService.status, 400)
    const invalidAvailability = await fetch(
      `${base}/api/availability?dates=2026-11-12,2026-11-13&times=10:00,10:00&service=airport&services=airport`,
    )
    assert.equal(invalidAvailability.status, 400)
  }))

test('stores separate daily pick-ups, ordered stops and drop-offs without a shared route', () =>
  withServer(async ({ post }) => {
    const result = await post({
      ...twoDays,
      pickup: undefined,
      destination: undefined,
      pickupPlace: undefined,
      destinationPlace: undefined,
      journeys: [
        {
          date: '2026-11-10', time: '10:00', vehicle: 'staria',
          pickup: 'Incheon Airport Terminal 2',
          pickupPlace: { id: 'curated:icn-t2' },
          destination: 'Four Seasons Hotel Seoul',
          destinationPlace: { id: 'curated:four-seasons' },
          stops: [{ location: 'Josun Palace', place: { id: 'curated:josun-palace' } }],
        },
        {
          date: '2026-11-11', time: '14:00', vehicle: 'g90',
          pickup: 'Four Seasons Hotel Seoul',
          pickupPlace: { id: 'curated:four-seasons' },
          destination: 'Gimpo Airport',
          destinationPlace: { id: 'curated:gimpo' },
          stops: [{ location: 'Le Méridien Seoul Myeongdong', place: { id: 'curated:le-meridien-myeongdong' } }],
        },
      ],
    })
    assert.equal(result.status, 201, JSON.stringify(result.data))
    assert.equal(result.data.journeys[0].time, '10:00')
    assert.equal(result.data.journeys[1].time, '14:00')
    assert.match(result.data.journeys[0].pickup, /Je2terminal-daero/)
    assert.match(result.data.journeys[0].destination, /Saemunan-ro/)
    assert.match(result.data.journeys[1].pickup, /Saemunan-ro/)
    assert.match(result.data.journeys[1].destination, /Haneul-gil/)
    assert.match(result.data.journeys[0].stops[0], /Teheran-ro/)
    assert.match(result.data.journeys[1].stops[0], /Myeongdong/)
  }))

test('rejects missing or forged per-date route selections and invalid stops', () =>
  withServer(async ({ post }) => {
    const noShared = {
      ...twoDays,
      pickup: undefined,
      destination: undefined,
      pickupPlace: undefined,
      destinationPlace: undefined,
      journeys: [
        { date: '2026-11-10', vehicle: 'staria',
          pickupPlace: { id: 'curated:icn-t2' },
          destinationPlace: { id: 'curated:four-seasons' } },
        { date: '2026-11-11', vehicle: 'g90',
          pickupPlace: { id: 'curated:four-seasons' },
          destinationPlace: { id: 'curated:gimpo' } },
      ],
    }
    assert.equal((await post(noShared)).status, 201)
    const forged = {
      ...noShared,
      journeys: [
        noShared.journeys[0],
        { ...noShared.journeys[1], stops: [
          { location: 'Unknown', place: { id: 'forged-stop' } },
        ] },
      ],
    }
    assert.equal((await post(forged)).status, 400)
    const incomplete = {
      ...noShared,
      journeys: [noShared.journeys[0], {
        ...noShared.journeys[1], pickupPlace: undefined,
      }],
    }
    assert.equal((await post(incomplete)).status, 400)
    const tooMany = {
      ...noShared,
      journeys: [noShared.journeys[0], {
        ...noShared.journeys[1],
        stops: Array.from({ length: 9 }, () => ({
          location: 'Josun Palace', place: { id: 'curated:josun-palace' },
        })),
      }],
    }
    assert.equal((await post(tooMany)).status, 400)
  }))

test('prices every daily vehicle and extra without treating pending requests as holds', () =>
  withServer(async ({ post, base }) => {
    const key = randomUUID()
    const body = {
      ...twoDays,
      options: ['extraStop', 'englishDriver'],
      total: 1,
    }
    const result = await post(body, key)
    assert.equal(result.status, 201)
    assert.equal(result.data.total, 920000)
    assert.deepEqual(
      result.data.journeys.map((day) => [day.date, day.vehicle, day.total]),
      [
        ['2026-11-10', 'Staria Limousine', 410000],
        ['2026-11-11', 'Genesis G90', 510000],
      ],
    )
    assert.deepEqual((await post(body, key)).data, result.data)
    const available = await fetch(
      `${base}/api/availability?date=2026-11-10&endDate=2026-11-11&time=10:00&service=hourly`,
    ).then((r) => r.json())
    assert.equal(available.days.length, 2)
    assert.equal(
      available.days[0].vehicles.find((v) => v.id === 'staria').available,
      true,
    )
    assert.equal(
      available.days[0].vehicles.find((v) => v.id === 'g90').available,
      true,
    )
    assert.equal(
      available.days[1].vehicles.find((v) => v.id === 'staria').available,
      true,
    )
    assert.equal(
      available.days[1].vehicles.find((v) => v.id === 'g90').available,
      true,
    )
    assert.equal((await post({ ...valid, date: '2026-11-11' })).status, 201)
    assert.equal((await post({ ...valid, time: '18:00' })).status, 201)
  }))

test('multi-day reservation requests always succeed even when a confirmed booking exists on a later day', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'chauffeur-confirmed-multi-'))
  const databasePath = join(dir, 'bookings.sqlite')
  try {
    await withServer(async ({ post, base }) => {
      const saved = await post({ ...valid, date: '2026-11-11', vehicle: 'g90' })
      assert.equal(saved.status, 201)
      const { DatabaseSync } = await import('node:sqlite')
      const db = new DatabaseSync(databasePath)
      db.prepare('UPDATE reservations SET status = ? WHERE id = ?')
        .run('confirmed', saved.data.reference)
      db.close()
      const accepted = await post(twoDays)
      assert.equal(accepted.status, 201)
      const available = await fetch(
        `${base}/api/availability?date=2026-11-11&time=10:00&service=hourly`,
      ).then((response) => response.json())
      assert.equal(available.vehicles.find((v) => v.id === 'g90').available, true)
      assert.equal((await post(valid)).status, 201)
    }, databasePath)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})


test('simultaneous multi-day pending requests may share requestable slots', () =>
  withServer(async ({ post }) => {
    const results = await Promise.all([post(twoDays), post(twoDays)])
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 201])
  }))

test('rejects missing, duplicate, unordered and invalid daily selections', async () => {
  for (const journeys of [
    [],
    null,
    'invalid',
    [null],
    [{ date: valid.date, vehicle: 'invalid' }],
    [{ date: '2026-11-11', vehicle: 'staria' }],
    [{ date: valid.date, vehicle: 'g90' }],
    [twoDays.journeys[0], twoDays.journeys[0]],
    [twoDays.journeys[0], { date: '2026-11-09', vehicle: 'g90' }],
    [twoDays.journeys[0], { date: '2026-11-31', vehicle: 'g90' }],
    [twoDays.journeys[0], { date: '2028-11-11', vehicle: 'g90' }],
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

test('supports non-consecutive dates with custom times and vehicles, calculating dynamic prices', () =>
  withServer(async ({ post, base }) => {
    // Nov 10 with staria at 10:00, and Nov 12 with sprinter_319 at custom typed time 14:25
    const nonConsecutive = {
      ...valid,
      date: '2026-11-10',
      time: '10:00',
      vehicle: 'staria',
      journeys: [
        { date: '2026-11-10', time: '10:00', vehicle: 'staria' },
        { date: '2026-11-12', time: '14:25', vehicle: 'sprinter_319' },
      ],
      total: 1,
    }
    const res = await post(nonConsecutive)
    assert.equal(res.status, 201)
    // hourly service (280,000) * 2 = 560,000 + staria (0) + sprinter_319 (100,000) = 660,000
    assert.equal(res.data.total, 660000)
    assert.equal(res.data.journeys.length, 2)
    assert.equal(res.data.journeys[0].date, '2026-11-10')
    assert.equal(res.data.journeys[0].time, '10:00')
    assert.equal(res.data.journeys[0].total, 280000)
    assert.equal(res.data.journeys[1].date, '2026-11-12')
    assert.equal(res.data.journeys[1].time, '14:25')
    assert.equal(res.data.journeys[1].total, 380000)

    // Check availability endpoint handles discrete dates & custom typed minutes
    const availRes = await fetch(
      `${base}/api/availability?dates=2026-11-10,2026-11-12&times=10:00,14:25&service=hourly`,
    )
    assert.equal(availRes.status, 200)
    const availData = await availRes.json()
    assert.equal(availData.days.length, 2)
    // pending Staria request does not hold day 1
    const day1Staria = availData.days[0].vehicles.find((v) => v.id === 'staria')
    assert.equal(day1Staria.available, true)
    // pending Sprinter request does not hold day 2
    const day2Sprinter = availData.days[1].vehicles.find((v) => v.id === 'sprinter_319')
    assert.equal(day2Sprinter.available, true)
    // but staria is available on day 2
    const day2Staria = availData.days[1].vehicles.find((v) => v.id === 'staria')
    assert.equal(day2Staria.available, true)
  }))

test('uses G90-matched Sprinter 319 pricing and excludes TAX for mixed daily journeys', () =>
  withServer(async ({ post }) => {
    for (const [vehicle, total] of [
      ['sprinter_319', 380000],
      ['sprinter_519', 460000],
    ]) {
      const result = await post({ ...valid, vehicle, total: 1 })
      assert.equal(result.status, 201)
      assert.equal(result.data.total, total)
      assert.equal(result.data.taxIncluded, false)
    }
    const mixed = await post({
      ...twoDays,
      journeys: [
        twoDays.journeys[0],
        { date: '2026-11-11', vehicle: 'sprinter_319' },
      ],
    })
    assert.equal(mixed.status, 201)
    assert.equal(mixed.data.total, 660000)
    assert.equal(mixed.data.journeys[0].total, 280000)
    assert.equal(mixed.data.journeys[1].total, 380000)
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
          messengerContact: index === 3 ? valid.phone : index > 3 ? ' traveller-id ' : '',
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
      assert.equal(details[3].messengerContact, valid.phone)
      assert.equal(details[4].messengerContact, 'traveller-id')
    } finally {
      db.close()
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('rejects invalid messenger preferences and missing messenger IDs or phone numbers', async () => {
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
      assert.equal(result.data.total, 660000)
      assert.equal(
        (await post({ ...valid, date: '2026-11-11', vehicle: 'g90' })).status,
        201,
      )
    }, databasePath)
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(databasePath)
    try {
      assert.equal(
        db.prepare('SELECT COUNT(*) AS count FROM reservation_legs').get()
          .count,
        3,
      )
    } finally {
      db.close()
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('migrates pre-existing single-day requests into daily slots while preserving safe retries without treating pending as a hold', async () => {
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
      'staria',
      start,
      start + 4 * 3600000,
      260000,
      JSON.stringify(valid),
      new Date(fixedNow).toISOString(),
    )
    db.close()
    await withServer(async ({ post }) => {
      assert.equal((await post(valid)).status, 201)
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
