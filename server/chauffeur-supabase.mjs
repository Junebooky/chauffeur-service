// Server-only Supabase access for the shared dating project.
// Never import this module from src/, or expose the service role to the browser.
const serverUrl = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const serverKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ''
const publishableKey = () => process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
export const hasDatabase = () => Boolean(serverUrl() && serverKey())

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
export async function db(path, { method = 'GET', body, prefer } = {}) {
  if (!hasDatabase()) throw new ApiError(503, 'Reservation database is not configured.')
  const response = await fetch(serverUrl() + '/rest/v1/' + path, {
    method,
    headers: {
      apikey: serverKey(),
      Authorization: 'Bearer ' + serverKey(),
      [method === 'GET' || method === 'HEAD' ? 'Accept-Profile' : 'Content-Profile']: 'chauffeur',
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(9000),
    cache: 'no-store',
  })
  const raw = await response.text()
  let data
  try { data = raw ? JSON.parse(raw) : null } catch { data = null }
  if (!response.ok) {
    console.error('Chauffeur database rejected operation:', response.status, data?.code || 'UNKNOWN')
    throw new ApiError(response.status === 401 || response.status === 403 ? 503 : 502,
      'Could not complete the database operation.')
  }
  return data
}
export function onlyString(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}
export function validUuid(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
export async function requireStaff(req) {
  const token = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '')?.[1]
  if (!token || !publishableKey()) throw new ApiError(401, 'Please sign in.')
  const userResponse = await fetch(serverUrl() + '/auth/v1/user', {
    headers: { apikey: publishableKey(), Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(7000),
    cache: 'no-store',
  })
  if (!userResponse.ok) throw new ApiError(401, 'Please sign in again.')
  const user = await userResponse.json()
  if (!validUuid(user.id)) throw new ApiError(401, 'Invalid user session.')
  const members = await db('staff_members?select=role,active&user_id=eq.' + user.id + '&limit=1')
  const member = members?.[0]
  if (!member?.active) throw new ApiError(403, 'This account does not have Chauffeur access.')
  return { id: user.id, role: member.role }
}
export function fail(res, error) {
  const status = error instanceof ApiError ? error.status : 500
  if (status === 500) console.error('Chauffeur API unexpected error:', error?.name || 'UNKNOWN')
  return res.status(status).json({ error: error instanceof ApiError ? error.message : 'Something went wrong. Please retry.' })
}
export function noCache(res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
}
