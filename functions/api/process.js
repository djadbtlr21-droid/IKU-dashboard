// ─────────────────────────────────────────────────────────────
// 공정 확인 / 工序确认 — process-tracking store (EdgeOne Pages KV)
//
// KV binding: PROCESS_KV  (bind in the EdgeOne console)
// Key layout:
//   process:{itemNo}  → { cells:{...}, remark, lastUpdated, lastUpdatedBy }
//   process:_hidden   → string[]  (item numbers hidden from the default list)
//
// GET  → { ok, items:{[itemNo]:{...}}, hidden:[], lastUpdated, lastUpdatedBy }
// POST → password-verified (server-side) mutation. Two actions:
//   { password, editorName, itemNo, cells, remark }  → save one item
//   { password, editorName, action:'hidden', hidden:[...] } → save hidden list
//
// The edit password is verified ONLY here on the server. Default 'jera8888',
// overridable via env.PROCESS_PASSWORD.
// ─────────────────────────────────────────────────────────────

import { safeEqualStr, trim } from './_auth.js'
import { json, preflight } from './_resp.js'
import { getKV } from './_kv.js'

const HIDDEN_KEY = 'process:_hidden'
const KEY_PREFIX = 'process:'
const MAX_REMARK = 4000
const MAX_CELLS_BYTES = 60000  // generous: many fields + per-section memos

// Read an env var defensively. EdgeOne exposes config on the `env` arg, but
// fall back to process.env so the function also works under a Node-like runtime.
function readEnvVar(env, name) {
  if (env && env[name] != null) return env[name]
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name] != null) {
      return process.env[name]
    }
  } catch { /* no process global — ignore */ }
  return undefined
}

// Resolve the expected edit password + where it came from (for diagnostics).
function resolveExpectedPassword(env) {
  const trimmed = trim(readEnvVar(env, 'PROCESS_PASSWORD'))
  if (typeof trimmed === 'string' && trimmed.length > 0) return { value: trimmed, source: 'env' }
  return { value: 'jera8888', source: 'default' }
}

// Returns { ok, reason, source }. `reason` distinguishes a missing password
// (client sent nothing) from an actual mismatch, so the UI can tell them apart.
function checkPassword(env, password) {
  const { value, source } = resolveExpectedPassword(env)
  if (typeof password !== 'string' || password.length === 0) {
    return { ok: false, reason: 'missing_password', source }
  }
  // Accept the raw value and a trimmed copy (guards against an accidental
  // trailing space/newline pasted into the password field).
  const ok = safeEqualStr(value, password) || safeEqualStr(value, password.trim())
  return { ok, reason: ok ? null : 'invalid_password', source }
}

function validItemNo(s) {
  return typeof s === 'string' && s.length > 0 && s.length <= 120 && s !== '_hidden'
}

// EdgeOne / Cloudflare-style KV list — normalise the key-name array.
async function listKeys(kv, prefix) {
  const out = []
  let cursor
  // Guard against an unbounded loop; a few hundred items at most in practice.
  for (let i = 0; i < 50; i++) {
    const res = await kv.list(cursor ? { prefix, cursor } : { prefix })
    const keys = res?.keys || res?.data || []
    for (const k of keys) out.push(typeof k === 'string' ? k : k.name || k.key)
    if (res?.list_complete || res?.complete || !res?.cursor) break
    cursor = res.cursor
  }
  return out.filter(Boolean)
}

async function readAll(kv) {
  const items = {}
  let hidden = []
  let lastUpdated = null
  let lastUpdatedBy = null

  let keys = []
  try { keys = await listKeys(kv, KEY_PREFIX) } catch (e) { console.error('[process] list error', e) }

  const values = await Promise.all(keys.map(async (key) => {
    try { return [key, await kv.get(key)] } catch { return [key, null] }
  }))

  for (const [key, raw] of values) {
    if (!raw) continue
    if (key === HIDDEN_KEY) {
      try { const arr = JSON.parse(raw); if (Array.isArray(arr)) hidden = arr } catch { /* ignore */ }
      continue
    }
    const itemNo = key.slice(KEY_PREFIX.length)
    try {
      const data = JSON.parse(raw)
      if (data && typeof data === 'object') {
        items[itemNo] = data
        if (data.lastUpdated && (!lastUpdated || data.lastUpdated > lastUpdated)) {
          lastUpdated = data.lastUpdated
          lastUpdatedBy = data.lastUpdatedBy || null
        }
      }
    } catch { /* skip malformed */ }
  }

  return { items, hidden, lastUpdated, lastUpdatedBy }
}

export async function onRequest(context) {
  const request = context?.request
  const env = context?.env || {}

  if (request.method === 'OPTIONS') return preflight('GET, POST, OPTIONS')

  const kv = getKV(env, 'PROCESS_KV')

  // ── GET — read everything ──
  if (request.method === 'GET') {
    if (!kv) return json({ ok: true, items: {}, hidden: [], lastUpdated: null, lastUpdatedBy: null, _warn: 'PROCESS_KV not bound' })
    try {
      const data = await readAll(kv)
      return json({ ok: true, ...data }, 200, { 'Cache-Control': 'no-store' })
    } catch (err) {
      console.error('[process] GET error', err)
      return json({ ok: false, error: 'read_failed', message: 'KV 읽기 실패 · KV 读取失败' }, 500)
    }
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method Not Allowed' }, 405, { Allow: 'GET, POST, OPTIONS' })
  }

  // ── POST — verified mutation ──
  // Parse the body first (robust: text + JSON.parse). Body/auth errors must be
  // reported distinctly from a KV/binding error so the UI never mislabels a
  // server problem as "wrong password".
  let body
  try {
    const raw = await request.text()
    body = raw ? JSON.parse(raw) : {}
  } catch {
    return json({ ok: false, error: 'invalid_json', message: '잘못된 요청 형식 · 请求格式错误' }, 400)
  }
  const { password, editorName, action } = body || {}

  // 1) password — server-side check (does NOT require KV)
  const pw = checkPassword(env, password)
  if (pw.reason === 'missing_password') {
    return json({ ok: false, error: 'missing_password', message: '비밀번호를 입력하세요 · 请输入密码' }, 400)
  }
  if (!pw.ok) {
    return json({ ok: false, error: 'invalid_password', message: '비밀번호가 틀렸습니다 · 密码错误', passwordSource: pw.source }, 401)
  }

  // action: verify — password-only gate for entering edit mode (no KV / editor needed)
  if (action === 'verify') {
    return json({ ok: true, verified: true, passwordSource: pw.source })
  }

  // 2) editor name — required for any mutation
  const editor = typeof editorName === 'string' ? editorName.trim() : ''
  if (!editor || editor.length > 60) {
    return json({ ok: false, error: 'editor_required', message: '수정자 이름을 입력하세요 · 请输入修改人姓名' }, 400)
  }

  // 3) KV is required only for the actual writes — report it clearly (not as an
  //    auth failure) so a missing/misnamed binding is diagnosable.
  if (!kv) {
    return json({ ok: false, error: 'kv_not_configured', message: 'PROCESS_KV 바인딩이 없습니다 · 未绑定 PROCESS_KV' }, 503)
  }

  try {
    // ── action: save hidden list ──
    if (action === 'hidden') {
      const hidden = Array.isArray(body.hidden) ? body.hidden.filter(validItemNo).slice(0, 5000) : []
      await kv.put(HIDDEN_KEY, JSON.stringify(hidden))
      return json({ ok: true, hidden, lastUpdatedBy: editor, lastUpdated: new Date().toISOString() })
    }

    // ── action: save one item's cells ──
    const itemNo = body.itemNo
    if (!validItemNo(itemNo)) {
      return json({ ok: false, error: 'invalid_itemNo' }, 400)
    }
    const cells = (body.cells && typeof body.cells === 'object' && !Array.isArray(body.cells)) ? body.cells : {}
    if (JSON.stringify(cells).length > MAX_CELLS_BYTES) {
      return json({ ok: false, error: 'cells_too_large' }, 400)
    }
    let remark = typeof body.remark === 'string' ? body.remark : ''
    if (remark.length > MAX_REMARK) remark = remark.slice(0, MAX_REMARK)
    const remarkAuthor = typeof body.remarkAuthor === 'string' ? body.remarkAuthor.trim().slice(0, 60) : ''

    const record = {
      cells,
      remark,
      remarkAuthor,
      lastUpdated: new Date().toISOString(),
      lastUpdatedBy: editor,
    }
    await kv.put(KEY_PREFIX + itemNo, JSON.stringify(record))
    return json({ ok: true, itemNo, record })
  } catch (err) {
    console.error('[process] mutation error', err)
    return json({ ok: false, error: 'kv_write_failed', message: 'KV 저장 실패 · KV 保存失败', detail: err.message || String(err) }, 500)
  }
}
