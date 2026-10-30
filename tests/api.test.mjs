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
  name: 'Test Traveller',
  email: 'test@example.com',
  phone: '+82 10 1234 5678',
  consent: true,
  options: [],
}

async function withServer(run, databasePath = ':memory:') {
  const instance = createApp({ databasePath, now: () => fixedNow })
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
