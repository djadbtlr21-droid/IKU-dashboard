import { verifyAdminPassword, buildLoginCookie, readJsonBody } from './_auth.js'

const attempts = new Map()
const LIMIT = 5
const WINDOW_MS = 60 * 1000

function tooMany(ip) {
  if (!ip) return false
  const now = Date.now()
  const rec = attempts.get(ip)
  if (!rec || rec.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  rec.count += 1
  return rec.count > LIMIT
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }
  const ip = (req.headers?.['x-forwarded-for'] || '').toString().split(',')[0].trim()
    || req.socket?.remoteAddress
    || ''
  if (tooMany(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' })
  }

  // Do NOT touch req.body — read raw stream instead to avoid @vercel/node's
  // lazy parser throwing before we can catch it.
  const body = await readJsonBody(req)
  if (!body.ok) {
    return res.status(400).json({ error: 'Invalid JSON' })
  }
  const password = body.data?.password

  try {
    if (!verifyAdminPassword(password)) {
      return res.status(401).json({ ok: false })
    }
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message })
  }
  res.setHeader('Set-Cookie', buildLoginCookie())
  return res.status(200).json({ ok: true })
}
