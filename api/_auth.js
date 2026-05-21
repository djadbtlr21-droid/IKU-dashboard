// Admin session helpers — independent from the client-side AuthContext.
// Cookie: iku_admin = <expiresAtMs>.<base64url(HMAC-SHA256(expiresAtMs))>
// Rotating ADMIN_SESSION_SECRET invalidates all existing sessions.

import crypto from 'node:crypto'

const COOKIE_NAME = 'iku_admin'
const SESSION_DAYS = 7
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000

function trim(v) {
  return typeof v === 'string' ? v.trim().replace(/^["']|["']$/g, '') : v
}

function getSecret() {
  const s = trim(process.env.ADMIN_SESSION_SECRET)
  if (!s || s.length < 32) {
    const err = new Error('ADMIN_SESSION_SECRET not configured (need 32+ chars)')
    err.status = 500
    throw err
  }
  return s
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function sign(expiresAt) {
  const payload = String(expiresAt)
  const mac = crypto.createHmac('sha256', getSecret()).update(payload).digest()
  return `${payload}.${b64url(mac)}`
}

function verify(token) {
  if (!token || typeof token !== 'string') return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expiresAt = Number(payload)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false
  let expected
  try { expected = b64url(crypto.createHmac('sha256', getSecret()).update(payload).digest()) }
  catch { return false }
  if (expected.length !== sig.length) return false
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig)) }
  catch { return false }
}

function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const k = part.slice(0, eq).trim()
    const v = part.slice(eq + 1).trim()
    if (k) {
      try { out[k] = decodeURIComponent(v) } catch { out[k] = v }
    }
  }
  return out
}

export function isAdminRequest(req) {
  try {
    const cookies = parseCookies(req.headers?.cookie || '')
    return verify(cookies[COOKIE_NAME])
  } catch {
    return false
  }
}

export function buildLoginCookie() {
  const expiresAt = Date.now() + SESSION_MS
  const token = sign(expiresAt)
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}`
}

export function buildLogoutCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

// Bypass @vercel/node's lazy req.body getter — read raw stream directly.
// Returns { ok: true, data } on success, { ok: false, reason } on failure.
// IMPORTANT: callers must NOT touch req.body before this, or stream is already consumed.
export async function readJsonBody(req) {
  const chunks = []
  try {
    for await (const chunk of req) chunks.push(chunk)
  } catch {
    return { ok: false, reason: 'stream' }
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return { ok: true, data: {} }
  try {
    return { ok: true, data: JSON.parse(raw) }
  } catch {
    return { ok: false, reason: 'invalid_json' }
  }
}

export function verifyAdminPassword(password) {
  const expected = trim(process.env.ADMIN_PASSWORD)
  if (!expected) {
    const err = new Error('ADMIN_PASSWORD not configured')
    err.status = 500
    throw err
  }
  if (typeof password !== 'string') return false
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(password, 'utf8')
  if (a.length !== b.length) return false
  try { return crypto.timingSafeEqual(a, b) } catch { return false }
}
