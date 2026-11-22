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
      assert.equal(sent.languageCode, 'ko')
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


test('Google Autocomplete uses English for Latin queries and Korean for Hangul queries', () => {
  const submitted = []
  const fetcher = async (_url, options) => {
    submitted.push(JSON.parse(options.body))
    return { ok: true, json: async () => ({ suggestions: [] }) }
  }
  return service(
    { apiKey: 'test-only-key', fetcher },
    async ({ post }) => {
      assert.equal((await post('/search', { query: 'Incheon Airport' })).status, 200)
      assert.equal((await post('/search', { query: '인천공항' })).status, 200)
      assert.equal((await post('/search', { query: 'Incheon 인천' })).status, 200)
    },
  ).then(() => {
    assert.deepEqual(submitted.map((item) => item.languageCode), ['en', 'ko', 'ko'])
    assert.deepEqual(submitted.map((item) => item.includedRegionCodes), [['kr'], ['kr'], ['kr']])
    assert.deepEqual(submitted.map((item) => item.input), [
      'Incheon Airport', '인천공항', 'Incheon 인천',
    ])
  })
})


test('Popular Locations favors two verified hotels and no longer lists Seoul Station', () =>
  service({}, async ({ post, selected }) => {
    const opened = await post('/search', { query: '' })
    assert.equal(opened.status, 200)
    assert.equal(opened.body.mode, 'popular')
    assert.equal(opened.body.results.length, 6)
    assert.ok(!opened.body.results.some((p) => /Seoul Station/.test(p.name)))
    const josun = opened.body.results.find((p) => p.id === 'curated:josun-palace')
    const meridien = opened.body.results.find((p) => p.id === 'curated:le-meridien-myeongdong')
    assert.equal(josun?.address, '231 Teheran-ro, Gangnam-gu, Seoul, South Korea')
    assert.equal(meridien?.address, '38 Myeongdong 8na-gil, Jung-gu, Seoul, South Korea')
    assert.equal(selected({ id: josun.id }).latitude, 37.50338)
    assert.equal(selected({ id: meridien.id }).longitude, 126.98273)
    assert.equal((await post('/search', { query: '조선팰리스' })).body.results[0].id, josun.id)
    assert.equal((await post('/search', { query: '르메르디앙' })).body.results[0].id, meridien.id)
  }))

test('혜화역 and exact curated Korean places are instant without waiting for Google', () => {
  let googleCalls = 0
  return service(
    {
      apiKey: 'test-only-key',
      fetcher: async () => {
        googleCalls++
        throw new Error('Exact curated places must not call Google')
      },
    },
    async ({ post, selected }) => {
      for (const query of ['혜화역', '혜화', 'Hyehwa Station']) {
        const found = await post('/search', { query })
        assert.equal(found.status, 200)
        assert.equal(found.body.mode, 'popular')
        assert.equal(found.body.results[0].id, 'curated:hyehwa-station')
        assert.equal(found.body.results[0].address, 'B120 Daehak-ro, Jongno-gu, Seoul, South Korea')
        assert.equal(selected({ id: found.body.results[0].id }).latitude, 37.58234)
      }
      assert.equal(googleCalls, 0)
    },
  )
})

test('station aliases in five languages resolve to the same verified Gangnam Station', () =>
  service({}, async ({ post, selected }) => {
    for (const query of [
      'Gangnam Station', '강남역', 'Estación de Gangnam',
      'Estacion de Gangnam', '江南駅', '江南站',
    ]) {
      const response = await post('/search', { query })
      assert.equal(response.status, 200, query)
      assert.equal(response.body.results[0].id, 'curated:gangnam-station', query)
      assert.equal(response.body.results[0].name, 'Gangnam Station')
      assert.equal(response.body.results[0].isStation, true)
      assert.equal(response.body.results[0].displayAddress,
        '396, Gangnam-daero, Gangnam-gu, Seoul')
    }
    const resolved = await post('/resolve', { id: 'curated:gangnam-station' })
    assert.equal(resolved.status, 200)
    assert.equal(resolved.body.address,
      'B396 Gangnam-daero, Gangnam-gu, Seoul, South Korea')
    assert.equal(resolved.body.displayAddress,
      '396, Gangnam-daero, Gangnam-gu, Seoul')
    assert.equal(selected({ id: resolved.body.id }).latitude, 37.497823)
  }))

test('Spanish station queries use Spanish language preference and canonical English station input', () => {
  const inputs = []
  return service({
    apiKey: 'test-only-key',
    fetcher: async (url, options) => {
      if (!url.endsWith('places:autocomplete')) throw new Error('Unexpected API')
      inputs.push(JSON.parse(options.body))
      return { ok: true, json: async () => ({
        suggestions: [{
          placePrediction: {
            placeId: 'seolleung-station',
            types: ['subway_station'],
            structuredFormat: {
              mainText: { text: 'Seolleung Station' },
              secondaryText: { text: 'Seoul, South Korea' },
            },
          },
        }],
      }) }
    },
  }, async ({ post }) => {
    const response = await post('/search', { query: 'Estación de Seolleung' })
    assert.equal(response.status, 200)
    assert.equal(response.body.mode, 'google')
    assert.equal(response.body.results[0].id, 'seolleung-station')
    assert.equal(response.body.results[0].isStation, true)
    assert.equal(inputs.length, 1)
    assert.equal(inputs[0].input, 'Seolleung Station')
    assert.equal(inputs[0].languageCode, 'es')
    assert.deepEqual(inputs[0].includedRegionCodes, ['kr'])
  })
})

test('ranks an official station ahead of exits, but respects an explicit exit search', () => {
  const suggestions = [
    { placePrediction: {
      placeId: 'exit-one', types: ['point_of_interest'],
      structuredFormat: { mainText: { text: 'Seolleung Station Exit 1' },
        secondaryText: { text: 'Seoul' } },
    } },
    { placePrediction: {
      placeId: 'shop', types: ['shopping_mall'],
      structuredFormat: { mainText: { text: 'Seolleung Station Shopping Mall' },
        secondaryText: { text: 'Seoul' } },
    } },
    { placePrediction: {
      placeId: 'station', types: ['subway_station'],
      structuredFormat: { mainText: { text: 'Seolleung Station' },
        secondaryText: { text: 'Seoul' } },
    } },
    { placePrediction: {
      placeId: 'exit-two', types: ['point_of_interest'],
      structuredFormat: { mainText: { text: 'Seolleung Station Exit 2' },
        secondaryText: { text: 'Seoul' } },
    } },
  ]
  return service({
    apiKey: 'test-only-key',
    fetcher: async () => ({
      ok: true, json: async () => ({ suggestions }),
    }),
  }, async ({ post }) => {
    const station = await post('/search', { query: 'Seolleung Station' })
    assert.equal(station.body.results[0].id, 'station')
    assert.equal(station.body.results[1].id, 'exit-one')
    const exit = await post('/search', { query: 'Seolleung Station Exit 2' })
    assert.equal(exit.body.results[0].id, 'exit-two')
    assert.equal(exit.body.results[1].id, 'exit-one')
  })
})

test('station-only Google fallback restores a missing official station without losing its exits', () => {
  const queries = []
  return service({
    apiKey: 'test-only-key',
    fetcher: async (_url, options) => {
      const payload = JSON.parse(options.body)
      queries.push(payload)
      const official = Boolean(payload.includedPrimaryTypes)
      return { ok: true, json: async () => ({
        suggestions: [official ? {
          placePrediction: {
            placeId: 'station', types: ['subway_station'],
            structuredFormat: { mainText: { text: 'Seolleung Station' },
              secondaryText: { text: 'Seoul' } },
          },
        } : {
          placePrediction: {
            placeId: 'exit-one', types: ['point_of_interest'],
            structuredFormat: { mainText: { text: 'Seolleung Station Exit 1' },
              secondaryText: { text: 'Seoul' } },
          },
        }],
      }) }
    },
  }, async ({ post }) => {
    const response = await post('/search', { query: 'Seolleung Station' })
    assert.equal(response.status, 200)
    assert.deepEqual(response.body.results.map((p) => p.id),
      ['station', 'exit-one'])
    assert.equal(queries.length, 2)
    assert.deepEqual(queries[1].includedPrimaryTypes,
      ['subway_station', 'train_station', 'light_rail_station', 'transit_station'])
    assert.equal(queries[0].sessionToken, queries[1].sessionToken)
  })
})
