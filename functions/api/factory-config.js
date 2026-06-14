// ─────────────────────────────────────────────────────────────
// HEXIANG 工厂现场 — worker-line config store (EdgeOne Pages KV)
//
// KV binding: PROCESS_KV  (reused — no new binding, no key-layout change to the
//             existing process:* keys).
// Key:        factory:worker_config
// Value (JSON):
//   { lines: { old:{count,tasks}, yoga:{count,tasks} }, lastUpdated }
//
// GET  → { ok, lines, lastUpdated }
// POST → { lines } → validated + stored. No password (public display config).
// ─────────────────────────────────────────────────────────────

import { safeEqualStr, trim } from './_auth.js'
import { json, preflight } from './_resp.js'
import { getKV } from './_kv.js'

const CONFIG_KEY = 'factory:worker_config'
const LINE_IDS = ['old', 'yoga']
const MAX_COUNT = 100
const MAX_TASK_LEN = 14    // server cap is lenient; UI limits visible input to 7
const MAX_REMARK = 500     // per-line 비고 / 备注

const DEFAULTS = {
  old: { count: 15, tasks: {}, remark: '' },
  yoga: { count: 6, tasks: {}, remark: '' },
}

// ── edit-password (same source as process.js: PROCESS_PASSWORD env, default 'jera8888') ──
function readEnvVar(env, name) {
  if (env && env[name] != null) return env[name]
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name] != null) return process.env[name]
  } catch { /* no process global */ }
  return undefined
}
function resolveExpectedPassword(env) {
  const trimmed = trim(readEnvVar(env, 'PROCESS_PASSWORD'))
  if (typeof trimmed === 'string' && trimmed.length > 0) return { value: trimmed, source: 'env' }
  return { value: 'jera8888', source: 'default' }
}
function checkPassword(env, password) {
  const { value, source } = resolveExpectedPassword(env)
  if (typeof password !== 'string' || password.length === 0) return { ok: false, reason: 'missing_password', source }
  const ok = safeEqualStr(value, password) || safeEqualStr(value, password.trim())
  return { ok, reason: ok ? null : 'invalid_password', source }
}

// Coerce arbitrary input into a safe { count, tasks } shape.
function sanitizeLine(raw, fallback) {
  const src = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {}
  let count = Number(src.count)
  if (!Number.isFinite(count)) count = fallback.count
  count = Math.max(0, Math.min(MAX_COUNT, Math.floor(count)))

  const tasks = {}
  const t = (src.tasks && typeof src.tasks === 'object' && !Array.isArray(src.tasks)) ? src.tasks : {}
  for (const [k, v] of Object.entries(t)) {
    const idx = Number(k)
    if (!Number.isInteger(idx) || idx < 0 || idx >= count) continue   // drop out-of-range
    const str = typeof v === 'string' ? v.slice(0, MAX_TASK_LEN) : ''
    if (str) tasks[String(idx)] = str
  }
  const remark = typeof src.remark === 'string' ? src.remark.slice(0, MAX_REMARK) : ''
  return { count, tasks, remark }
}

function sanitizeLines(raw) {
  const src = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {}
  const out = {}
  for (const id of LINE_IDS) out[id] = sanitizeLine(src[id], DEFAULTS[id])
  return out
}

export async function onRequest(context) {
  const request = context?.request
  const env = context?.env || {}

  if (request.method === 'OPTIONS') return preflight('GET, POST, OPTIONS')

  const kv = getKV(env, 'PROCESS_KV')

  // ── GET — read config (defaults when absent / KV unbound) ──
  if (request.method === 'GET') {
    if (!kv) {
      return json({ ok: true, lines: DEFAULTS, lastUpdated: null, _warn: 'PROCESS_KV not bound' })
    }
    try {
      const raw = await kv.get(CONFIG_KEY)
      if (!raw) return json({ ok: true, lines: DEFAULTS, lastUpdated: null }, 200, { 'Cache-Control': 'no-store' })
      let parsed
      try { parsed = JSON.parse(raw) } catch { parsed = null }
      const lines = sanitizeLines(parsed?.lines)
      return json({ ok: true, lines, lastUpdated: parsed?.lastUpdated || null }, 200, { 'Cache-Control': 'no-store' })
    } catch (err) {
      console.error('[factory-config] GET error', err)
      return json({ ok: false, error: 'read_failed', message: 'KV 읽기 실패 · KV 读取失败' }, 500)
    }
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method Not Allowed' }, 405, { Allow: 'GET, POST, OPTIONS' })
  }

  // ── POST — store config (edit-password verified server-side) ──
  let body
  try {
    const raw = await request.text()
    body = raw ? JSON.parse(raw) : {}
  } catch {
    return json({ ok: false, error: 'invalid_json', message: '잘못된 요청 형식 · 请求格式错误' }, 400)
  }

  // password gate (same password as the 생산 전 체크 edit mode)
  const pw = checkPassword(env, body?.password)
  if (pw.reason === 'missing_password') {
    return json({ ok: false, error: 'missing_password', message: '비밀번호를 입력하세요 · 请输入密码' }, 400)
  }
  if (!pw.ok) {
    return json({ ok: false, error: 'invalid_password', message: '비밀번호가 틀렸습니다 · 密码错误', passwordSource: pw.source }, 401)
  }

  if (!kv) {
    return json({ ok: false, error: 'kv_not_configured', message: 'PROCESS_KV 바인딩이 없습니다 · 未绑定 PROCESS_KV' }, 503)
  }

  try {
    const lines = sanitizeLines(body?.lines)
    const lastUpdated = new Date().toISOString()
    await kv.put(CONFIG_KEY, JSON.stringify({ lines, lastUpdated }))
    return json({ ok: true, lines, lastUpdated })
  } catch (err) {
    console.error('[factory-config] POST error', err)
    return json({ ok: false, error: 'kv_write_failed', message: 'KV 저장 실패 · KV 保存失败', detail: err.message || String(err) }, 500)
  }
}
