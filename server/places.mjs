import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { fetch as proxyFetch, EnvHttpProxyAgent } from 'undici'
import popular from './popular-places.json' with { type: 'json' }

const normalise = (value) =>
  value
    .normalize('NFKC')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
const safePlace = ({ aliases, ...place }) => ({
  ...place,
  source: 'popular',
  accuracy: 'building',
})
const sessionValid = (value) =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{16,80}$/.test(value)

export function createPlaces({
  apiKey = process.env.GOOGLE_MAPS_API_KEY,
  fetcher,
  now = () => Date.now(),
} = {}) {
  const agent = !fetcher && apiKey ? new EnvHttpProxyAgent() : null
  const request =
    fetcher ||
    ((url, options) => proxyFetch(url, { ...options, dispatcher: agent }))
  const selections = new Map()
  const requests = new Map()
  const router = Router()
  router.use((req, res, next) => {
    const ip = req.ip || 'local'
    const recent = (requests.get(ip) || []).filter((t) => now() - t < 60000)
    if (recent.length >= 90)
      return res
        .status(429)
        .json({ error: 'Please wait a moment before searching again.' })
    requests.set(ip, [...recent, now()])
    if (requests.size > 10000)
      for (const [key, hits] of requests)
        if (hits.every((t) => now() - t >= 60000)) requests.delete(key)
    next()
  })
  async function google(path, options = {}) {
    const response = await request(`https://places.googleapis.com/v1/${path}`, {
      ...options,
      signal: AbortSignal.timeout(7000),
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        ...options.headers,
      },
    })
    // Never return upstream bodies: these can contain project/key diagnostics.
    if (!response.ok) {
      await response.body?.cancel?.()
      throw new Error(
        'Live address search is temporarily unavailable. Please retry or choose a popular location.',
      )
    }
    return response.json()
  }
  router.post('/search', async (req, res) => {
    const { query, sessionToken } = req.body || {}
    if (
      typeof query !== 'string' ||
      query.length > 180 ||
      !sessionValid(sessionToken)
    )
      return res
        .status(400)
        .json({ error: 'Please enter a valid place or address.' })
    const q = normalise(query.trim())
    if (!apiKey || q.length < 2) {
      const results = popular
        .filter(
          (p) =>
            !q ||
            [p.name, p.address, ...p.aliases].some((s) =>
              normalise(s).includes(q),
            ),
        )
        .slice(0, 6)
      return res.json({
        mode: 'popular',
        results: results.map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address,
        })),
        notice: apiKey
          ? null
          : 'Popular locations only. Full address search is not connected yet.',
      })
    }
    try {
      const data = await google('places:autocomplete', {
        method: 'POST',
        body: JSON.stringify({
          input: query.trim(),
          sessionToken,
          languageCode: 'en',
          includedRegionCodes: ['kr'],
          locationBias: {
            circle: {
              center: { latitude: 37.5665, longitude: 126.978 },
              radius: 50000,
            },
          },
        }),
      })
      const results = (data.suggestions || [])
        .flatMap((s) =>
          s.placePrediction
            ? [
                {
                  id: s.placePrediction.placeId,
                  name:
                    s.placePrediction.structuredFormat?.mainText?.text ||
                    s.placePrediction.text?.text ||
                    '',
                  address:
                    s.placePrediction.structuredFormat?.secondaryText?.text ||
                    '',
                },
              ]
            : [],
        )
        .slice(0, 5)
      res.json({ mode: 'google', results })
    } catch (error) {
      res
        .status(503)
        .json({
          error: error.message?.startsWith('Live address')
            ? error.message
            : 'Live address search timed out. Please try again.',
        })
    }
  })
  router.post('/resolve', async (req, res) => {
    const { id, sessionToken } = req.body || {}
    if (
      typeof id !== 'string' ||
      id.length > 255 ||
      !sessionValid(sessionToken)
    )
      return res
        .status(400)
        .json({ error: 'Please select a suggested location.' })
    const local = popular.find((p) => p.id === id)
    if (local) return res.json(safePlace(local))
    if (!apiKey || !/^[a-zA-Z0-9_-]+$/.test(id))
      return res
        .status(400)
        .json({ error: 'Please select a suggested location.' })
    try {
      const data = await google(
        `places/${encodeURIComponent(id)}?${new URLSearchParams({ languageCode: 'en', sessionToken })}`,
        {
          headers: {
            'X-Goog-FieldMask':
              'id,displayName,formattedAddress,location,addressComponents',
          },
        },
      )
      if (
        data.id !== id ||
        typeof data.formattedAddress !== 'string' ||
        data.formattedAddress.length > 500 ||
        Math.abs(data.location?.latitude) > 90 ||
        Math.abs(data.location?.longitude) > 180 ||
        !data.addressComponents?.some(
          (c) => c.types?.includes('country') && c.shortText === 'KR',
        ) ||
        !Number.isFinite(data.location?.latitude) ||
        !Number.isFinite(data.location?.longitude)
      )
        return res
          .status(400)
          .json({ error: 'Please choose a location in South Korea.' })
      const place = {
        id: data.id,
        name: data.displayName?.text || data.formattedAddress,
        address: data.formattedAddress,
        latitude: data.location.latitude,
        longitude: data.location.longitude,
        source: 'google',
        accuracy: 'building',
      }
      const selectionToken = randomUUID()
      for (const [key, entry] of selections)
        if (entry.expires < now()) selections.delete(key)
      if (selections.size >= 2000)
        selections.delete(selections.keys().next().value)
      selections.set(selectionToken, { place, expires: now() + 3600000 })
      res.json({ ...place, selectionToken })
    } catch {
      res
        .status(503)
        .json({
          error: 'We could not confirm this address. Please select it again.',
        })
    }
  })
  function selected(input) {
    if (!input || typeof input.id !== 'string')
      throw new Error(
        'Please choose your pickup and destination from the address suggestions.',
      )
    const local = popular.find((p) => p.id === input.id)
    if (local) return safePlace(local)
    const entry = selections.get(input.selectionToken)
    if (!entry || entry.expires < now() || entry.place.id !== input.id)
      throw new Error(
        'Your selected address has expired. Please choose it again from the suggestions.',
      )
    return { ...entry.place }
  }
  return { router, selected, close: () => agent?.close() }
}
