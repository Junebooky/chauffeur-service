export default function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).end() }
  res.setHeader('Cache-Control', 'private, no-store')
  return res.status(200).json({ country: req.headers['x-vercel-ip-country'] === 'KR' ? 'KR' : null })
}
