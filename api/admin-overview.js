import { ApiError, db, fail, hasDatabase, noCache } from '../server/chauffeur-supabase.mjs'

// Public board: deliberately only operational metadata.
// NEVER add customer names, emails, phone numbers, exact journey routes,
// payment amounts, reservation IDs, or full confirmation references.
const summarize = (reservations, days) => {
  const dayMap = new Map()
  for (const day of days) {
    const list = dayMap.get(day.reservation_id) || []
    list.push(day)
    dayMap.set(day.reservation_id, list)
  }
  const output = reservations.map((reservation, index) => {
    const tripDays = dayMap.get(reservation.id) || []
    return {
      // UI-only ordinal; never expose actual UUIDs or full booking references.
      number: index + 1,
      maskedReference: 'CH-••••' + String(reservation.reference || '').slice(-3),
      status: reservation.status,
      createdAt: reservation.created_at,
      dayCount: tripDays.length,
      service: tripDays[0]?.service_code || null,
      fleet: tripDays[0]?.vehicle_class || null,
    }
  })
  const count = status => output.filter(entry => entry.status === status).length
  return {
    updatedAt: new Date().toISOString(),
    scope: 'latest 100 requests',
    metrics: {
      requests: output.length,
      new: count('requested'),
      sourcing: output.filter(entry => ['reviewing','quoted','awaiting_deposit'].includes(entry.status)).length,
      confirmed: output.filter(entry => ['confirmed', 'in_progress', 'completed'].includes(entry.status)).length,
    },
    reservations: output,
  }
}
export default async function handler(req, res) {
  noCache(res)
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed.' })
  }
  if (!hasDatabase()) return res.status(503).json({ error: 'Live reservation database is not configured.' })
  try {
    const reservations = await db('reservations?select=id,reference,status,created_at&order=created_at.desc&limit=100')
    if (!Array.isArray(reservations)) throw new ApiError(502, 'Could not retrieve booking records.')
    if (!reservations.length) {
      return res.status(200).json(summarize([], []))
    }
    const ids = reservations.map(r => r.id).filter(id => /^[0-9a-f-]{36}$/i.test(id))
    const selection = 'in.(' + ids.join(',') + ')'
    const days = await db('reservation_days?select=id,reservation_id,service_code,vehicle_class&reservation_id=' + selection + '&limit=1000')
    return res.status(200).json(summarize(reservations, days))
  } catch (error) { return fail(res, error) }
}
