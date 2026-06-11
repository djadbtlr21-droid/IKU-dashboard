// EdgeOne Pages Functions — admin session helpers.
// Ported from /api/_auth.js. Node's `crypto` module is unavailable on the
// EdgeOne (web-standard) runtime, so HMAC-SHA256 is reimplemented with the
// Web Crypto API (crypto.subtle). Cookie format is identical in spirit:
//   iku_admin = <expiresAtMs>.<base64url(HMAC-SHA256(expiresAtMs))>
// Each platform signs with its own ADMIN_SESSION_SECRET, so sessions are not
// portable across Vercel/EdgeOne — which is fine, a deploy only runs one.

const COOKIE_NAME = 'iku_admin'
const SESSION_DAYS = 7
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000

function trim(v) {
  return typeof v === 'string' ? v.trim().replace(/^["']|["']$/g, '') : v
}

function getSecret(env) {
  const s = trim(env.ADMIN_SESSION_SECRET)
  if (!s || s.length < 32) {
    const err = new Error('ADMIN_SESSION_SECRET not configured (need 32+ chars)')
    err.status = 500
    throw err
  }
  return s
}

const encoder = new TextEncoder()

function bytesToB64url(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function hmacBytes(secret, payload) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return new Uint8Array(sig)
}

async function sign(env, expiresAt) {
  const payload = String(expiresAt)
  const mac = await hmacBytes(getSecret(env), payload)
  return `${payload}.${bytesToB64url(mac)}`
}

// Constant-time string compare (avoids early-exit timing leak).
function safeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function verify(env, token) {
  if (!token || typeof token !== 'string') return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expiresAt = Number(payload)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false
  let expected
  try { expected = bytesToB64url(await hmacBytes(getSecret(env), payload)) }
  catch { return false }
  return safeEqualStr(expected, sig)
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

export async function isAdminRequest(request, env) {
  try {
    const cookies = parseCookies(request.headers.get('cookie') || '')
    return await verify(env, cookies[COOKIE_NAME])
  } catch {
    return false
  }
}

export async function buildLoginCookie(env) {
  const expiresAt = Date.now() + SESSION_MS
  const token = await sign(env, expiresAt)
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}`
}

export function buildLogoutCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

// Read + parse a JSON request body. Returns { ok, data } / { ok:false, reason }.
export async function readJsonBody(request) {
  let raw
  try {
    raw = (await request.text()).trim()
  } catch {
    return { ok: false, reason: 'stream' }
  }
  if (!raw) return { ok: true, data: {} }
  try {
    return { ok: true, data: JSON.parse(raw) }
  } catch {
    return { ok: false, reason: 'invalid_json' }
  }
}

export function verifyAdminPassword(env, password) {
  const expected = trim(env.ADMIN_PASSWORD)
  if (!expected) {
    const err = new Error('ADMIN_PASSWORD not configured')
    err.status = 500
    throw err
  }
  if (typeof password !== 'string') return false
  return safeEqualStr(expected, password)
}

export { safeEqualStr, trim }
