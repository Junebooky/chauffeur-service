import { requestableDays } from '../server/requestable-availability.mjs'
import { DEFAULT_USD_RATE } from '../server/rates.mjs'

/**
 * Production Vercel function. Always accepts requests for a vehicle CLASS.
 * No SQL query or hard inventory hold; assignment remains operator-confirmed.
 *
 * A persistent POST /api/reservations handler is available when the server
 * has Supabase credentials. Vehicle classes remain requestable.
 */
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed.' })
  }
  try {
    const query = Object.fromEntries(new URL(req.url, 'https://local.invalid').searchParams)
    const days = requestableDays(query)
    return res.status(200).json({
      usdRate: DEFAULT_USD_RATE,
      vehicles: days[0].vehicles,
      days,
      inventoryPolicy: 'request-only',
      bookingSubmissionReady: Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)),
    })
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Please check the selected journey dates.',
    })
  }
}
