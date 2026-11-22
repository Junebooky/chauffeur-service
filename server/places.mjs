import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { fetch as proxyFetch, EnvHttpProxyAgent } from 'undici'
import popular from './popular-places.json' with { type: 'json' }
import {
  normalizePlaceQuery,
  stationSearchContext,
  isStationPrediction,
  rankStationSuggestions,
  stationDisplayAddress,
} from './station-search.mjs'

const normalise = normalizePlaceQuery
const safePlace = ({ aliases, ...place }) => {
  const isStation = isStationPrediction(place)
  return {
    ...place,
    source: 'popular',
    accuracy: 'building',
    isStation,
    displayAddress: stationDisplayAddress(place.address, isStation),
  }
}
const toSuggestion = (place) => ({
  id: place.id,
  name: place.name,
  address: place.address,
  isStation: isStationPrediction(place),
  displayAddress: stationDisplayAddress(
    place.address, isStationPrediction(place)),
})
const sessionValid = (value) =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{16,80}$/.test(value)

export function createPlaces({
  apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY,
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
    const context = stationSearchContext(query)
    const q = normalise(query.trim())
    const normalizedStationInput = normalise(context.input)
    // Verified exact matches are instant, even offline or without paid Google calls.
    const exactCurated = q.length >= 2
      ? popular.filter((place) =>
          [place.name, ...place.aliases].some((alias) =>
            normalise(alias) === q ||
            (context.station && !context.exit && normalise(alias) === normalizedStationInput)),
        )
      : []
    if (!apiKey || q.length < 2 || exactCurated.length > 0) {
      const results = exactCurated.length > 0
        ? exactCurated
        : popular.filter(
            (place) =>
              !q ||
              [place.name, place.address, ...place.aliases].some((alias) =>
                normalise(alias).includes(q) ||
                (context.station && !context.exit &&
                  normalise(alias).includes(normalizedStationInput)),
              ),
          )
      return res.json({
        mode: 'popular',
        results: results.slice(0, 6).map(toSuggestion),
        notice: apiKey
          ? null
          : 'Popular locations only. Full address search is not connected yet.',
      })
    }
    try {
      const requestAutocomplete = (input, includedPrimaryTypes) => google('places:autocomplete', {
        method: 'POST',
        headers: {
          'X-Goog-FieldMask':
            'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.text,suggestions.placePrediction.types',
        },
        body: JSON.stringify({
          input,
          sessionToken,
          languageCode: context.languageCode,
          includedRegionCodes: ['kr'],
          ...(includedPrimaryTypes ? { includedPrimaryTypes } : {}),
          locationBias: {
            circle: {
              center: { latitude: 37.5665, longitude: 126.978 },
              radius: 50000,
            },
          },
        }),
      })
      const asSuggestions = (data) => (data.suggestions || [])
        .flatMap((s) => {
          const prediction = s.placePrediction
          if (!prediction?.placeId) return []
          const name = prediction.structuredFormat?.mainText?.text ||
            prediction.text?.text || ''
          const address = prediction.structuredFormat?.secondaryText?.text || ''
          const candidate = {
            id: prediction.placeId, name, address,
            types: prediction.types || [],
          }
          const isStation = isStationPrediction(candidate)
          return [{
            ...candidate, isStation,
            displayAddress: stationDisplayAddress(address, isStation),
          }]
        })
      const primary = asSuggestions(await requestAutocomplete(context.input))
      let combined = primary
      // One narrowly scoped fallback only when a station-specific search
      // returned exits or nearby shops but no station itself.
      if (context.station && !context.exit && q.length >= 5 &&
          !primary.some(isStationPrediction)) {
        try {
          const stationOnly = asSuggestions(await requestAutocomplete(context.input, [
            'subway_station', 'train_station', 'light_rail_station', 'transit_station',
          ]))
          combined = [...stationOnly, ...primary]
        } catch {
          // Keep the original predictions if station-only autocomplete fails.
        }
      }
      const seen = new Set()
      const results = rankStationSuggestions(combined, context)
        .filter((suggestion) => {
          if (seen.has(suggestion.id)) return false
          seen.add(suggestion.id)
          return true
        })
        .slice(0, 5)
        .map(({ types, ...suggestion }) => suggestion)
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
          (c) =>
            c.types?.includes('country') &&
            (c.shortText === 'KR' ||
              c.longText === 'South Korea' ||
              c.longText === '대한민국'),
        ) ||
        !Number.isFinite(data.location?.latitude) ||
        !Number.isFinite(data.location?.longitude)
      )
        return res
          .status(400)
          .json({ error: 'Please choose a location in South Korea.' })
      const name = data.displayName?.text || data.formattedAddress
      const isStation = isStationPrediction({ name })
      const place = {
        id: data.id,
        name,
        address: data.formattedAddress,
        displayAddress: stationDisplayAddress(data.formattedAddress, isStation),
        isStation,
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
