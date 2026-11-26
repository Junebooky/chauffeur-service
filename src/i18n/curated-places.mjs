// Shared presentation lookup. The server still verifies every curated ID against its own catalog.
import popular from '../../server/popular-places.json' with { type: 'json' }
import { isStationPrediction, stationDisplayAddress } from '../../server/station-search.mjs'

export function curatedLabels(id, locale = 'en') {
  const place = popular.find(p => p.id === id)
  if (!place) return null
  const isStation = isStationPrediction(place)
  const name = locale === 'ko' ? place.nameKo || place.name : place.name
  const address = locale === 'ko' ? place.addressKo || place.address : place.address
  return { name, address, isStation, displayAddress: locale === 'ko' ? address : stationDisplayAddress(address, isStation) }
}

export function curatedSearchTerms(place, includeAddress = true) {
  return [place.name, place.nameKo, ...(includeAddress ? [place.address, place.addressKo] : []), ...place.aliases].filter(Boolean)
}

export function curatedPlaceForLocale(id, locale = 'en') {
  const place = popular.find(p => p.id === id)
  if (!place) return null
  return { id: place.id, latitude: place.latitude, longitude: place.longitude,
    ...curatedLabels(id, locale), source: 'popular', accuracy: 'building' }
}
