import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { randomUUID } from 'node:crypto'
import { createPlaces } from '../server/places.mjs'

async function service(options, run) {
  const places = createPlaces({ apiKey: '', ...options })
  const app = express()
  app.use(express.json())
  app.use(places.router)
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  const sessionToken = randomUUID()
  const post = async (path, body) => {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}${path}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken, ...body }),
      },
    )
    return { status: response.status, body: await response.json() }
  }
  try {
    await run({ post, selected: places.selected, sessionToken })
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await places.close()
  }
}
test('popular locations match English, Korean, Chinese and Japanese names', () =>
  service({}, async ({ post }) => {
    for (const query of [
      'Four Seasons',
      '포시즌',
      '首尔四季',
      'フォーシーズンズ',
    ]) {
      const response = await post('/search', { query })
      assert.equal(response.status, 200)
      assert.equal(response.body.mode, 'popular')
      assert.equal(response.body.results[0].id, 'curated:four-seasons')
      assert.match(response.body.notice, /Full address search is not connected/)
    }
  }))
test('terminal-specific popular locations resolve to distinct canonical points', () =>
  service({}, async ({ post, selected }) => {
    const first = await post('/resolve', { id: 'curated:icn-t1' })
    const second = await post('/resolve', { id: 'curated:icn-t2' })
    assert.notEqual(first.body.latitude, second.body.latitude)
    assert.equal(
      selected({ id: second.body.id, latitude: 0 }).latitude,
      37.4686,
    )
  }))
test('rejects invalid input, unknown locations and fake place selections', () =>
  service({}, async ({ post, selected }) => {
    assert.equal(
      (await post('/search', { query: 'a'.repeat(181) })).status,
      400,
    )
    assert.equal(
      (await post('/search', { query: 'Seoul', sessionToken: 'bad' })).status,
      400,
    )
    assert.equal(
      (await post('/resolve', { id: 'https://example.com' })).status,
      400,
    )
    assert.throws(() => selected({ id: 'fake', selectionToken: 'fake' }))
  }))
test('live Google requests preserve Unicode, restrict Korea and bind resolved selections to server metadata', () => {
  const calls = []
  let timestamp = 100000
  const fetcher = async (url, options) => {
    calls.push({ url, options })
    if (url.endsWith('places:autocomplete'))
      return {
        ok: true,
        json: async () => ({
          suggestions: [
            {
              placePrediction: {
                placeId: 'google-hotel',
                structuredFormat: {
                  mainText: { text: 'Hotel Example' },
                  secondaryText: { text: 'Seoul, South Korea' },
                },
              },
            },
          ],
        }),
      }
    return {
      ok: true,
      json: async () => ({
        id: 'google-hotel',
        displayName: { text: 'Hotel Example' },
        formattedAddress: '1 Example Road, Seoul',
        location: { latitude: 37.55, longitude: 126.99 },
        addressComponents: [{ types: ['country'], shortText: 'KR' }],
      }),
    }
  }
  return service(
    { apiKey: 'test-only-key', fetcher, now: () => timestamp },
    async ({ post, selected, sessionToken }) => {
      const predictions = await post('/search', { query: '서울 호텔' })
      assert.equal(predictions.body.mode, 'google')
      const sent = JSON.parse(calls[0].options.body)
      assert.equal(sent.input, '서울 호텔')
      assert.deepEqual(sent.includedRegionCodes, ['kr'])
      assert.equal(sent.sessionToken, sessionToken)
      assert.equal(sent.languageCode, 'en')
      const response = await post('/resolve', {
        id: predictions.body.results[0].id,
      })
      assert.equal(response.body.source, 'google')
      assert.equal(selected(response.body).latitude, 37.55)
      assert.throws(() => selected({ ...response.body, id: 'other-place' }))
      timestamp += 3600001
      assert.throws(() => selected(response.body), /expired/)
      assert.equal(
        calls[1].options.headers['X-Goog-FieldMask'],
        'id,displayName,formattedAddress,location,addressComponents',
      )
    },
  )
})
test('provider errors do not leak upstream key or account diagnostics', () =>
  service(
    {
      apiKey: 'test-only-key',
      fetcher: async () => ({
        ok: false,
        status: 403,
        body: { cancel: async () => {} },
        json: async () => ({ error: { message: 'private-project-secret' } }),
      }),
    },
    async ({ post }) => {
      const response = await post('/search', { query: 'Seoul Hotel' })
      assert.equal(response.status, 503)
      assert.ok(
        !JSON.stringify(response.body).includes('private-project-secret'),
      )
    },
  ))
test('rejects a resolved location outside the service country', () =>
  service(
    {
      apiKey: 'test-only-key',
      fetcher: async () => ({
        ok: true,
        json: async () => ({
          id: 'hotel',
          formattedAddress: '1 Example Street, USA',
          location: { latitude: 40, longitude: -74 },
          addressComponents: [{ types: ['country'], shortText: 'US' }],
        }),
      }),
    },
    async ({ post }) => {
      assert.equal((await post('/resolve', { id: 'hotel' })).status, 400)
    },
  ))
