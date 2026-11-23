import catalog from '../src/catalog.json' with { type: 'json' }

/**
 * Chauffeur brokers a vehicle class rather than allocating an individual
 * license plate. Every model remains REQUESTABLE regardless of other bookings.
 * This is not a promise that a vehicle/chauffeur has been assigned.
 *
 * Used by both the persistent Express API and the Vercel requestability route.
 */
export function requestableDays(query, now = () => Date.now()) {
  const str = (value) => Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
  const split = (value) => str(value).split(',').map((part) => part.trim()).filter(Boolean)
  const rawDates = str(query.dates) ? split(query.dates) : null
  const dates = rawDates || [str(query.date)].filter(Boolean)
  const endDate = str(query.endDate)
  if (!rawDates && endDate && endDate !== dates[0]) {
    const start = Date.parse(dates[0] + 'T00:00:00+09:00')
    const end = Date.parse(endDate + 'T00:00:00+09:00')
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
      throw new Error('The last day must be on or after your first day.')
    if ((end - start) / 86400000 > 365)
      throw new Error('Journeys can be requested up to one year in advance.')
    dates.length = 0
    for (let ts = start; ts <= end; ts += 86400000)
      dates.push(new Date(ts + 9 * 3600000).toISOString().slice(0, 10))
  }
  if (!dates.length || dates.length > 366)
    throw new Error('Please select between 1 and 366 journey dates.')
  const times = str(query.times) ? split(query.times) : []
  const services = str(query.services) ? split(query.services) : []
  if (services.length && services.length !== dates.length)
    throw new Error('Please select a service for every journey date.')
  if (times.length && times.length !== dates.length)
    throw new Error('Please select a pickup time for every journey date.')
  const current = now()
  const vehicleList = catalog.vehicles.map((vehicle) => ({
    id: vehicle.id,
    available: true,
  }))
  return dates.map((date, i) => {
    const time = times[i] || str(query.time)
    const service = services[i] || str(query.service)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
      throw new Error('Please select a valid date and pickup time.')
    if (!catalog.services.some((entry) => entry.id === service))
      throw new Error('Please select a service.')
    const startsAt = Date.parse(date + 'T' + time + ':00+09:00')
    if (!Number.isFinite(startsAt) ||
      new Date(startsAt + 9 * 3600000).toISOString().slice(0, 10) !== date)
      throw new Error('Please select a valid date.')
    if (startsAt < current + 2 * 3600000)
      throw new Error('Please allow at least two hours before your journey.')
    if (startsAt > current + 366 * 86400000)
      throw new Error('Journeys can be requested up to one year in advance.')
    return { date, time, vehicles: vehicleList.map((entry) => ({ ...entry })) }
  })
}
