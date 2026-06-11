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

const HIDDEN_KEY = 'process:_hidden'
const KEY_PREFIX = 'process:'
const MAX_REMARK = 4000
const MAX_CELLS_BYTES = 20000

function getKV(env) {
  return env.PROCESS_KV || null
}

function checkPassword(env, password) {
  const expected = trim(env.PROCESS_PASSWORD) || 'jera8888'
  if (typeof password !== 'string') return false
  return safeEqualStr(expected, password)
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

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return preflight('GET, POST, OPTIONS')

  const kv = getKV(env)

  // ── GET — read everything ──
  if (request.method === 'GET') {
    if (!kv) return json({ ok: true, items: {}, hidden: [], lastUpdated: null, lastUpdatedBy: null, _warn: 'PROCESS_KV not bound' })
    try {
      const data = await readAll(kv)
      return json({ ok: true, ...data }, 200, { 'Cache-Control': 'no-store' })
    } catch (err) {
      console.error('[process] GET error', err)
      return json({ ok: false, error: 'read failed' }, 500)
    }
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method Not Allowed' }, 405, { Allow: 'GET, POST, OPTIONS' })
  }

  // ── POST — verified mutation ──
  if (!kv) return json({ ok: false, error: 'PROCESS_KV not configured' }, 500)

  let body
  try { body = await request.json() } catch { return json({ ok: false, error: 'Invalid JSON' }, 400) }
  const { password, editorName, action } = body || {}

  // 1) password — server-side check
  if (!checkPassword(env, password)) {
    return json({ ok: false, error: 'invalid_password', message: '비밀번호가 틀렸습니다 · 密码错误' }, 401)
  }

  // action: verify — password-only gate for entering edit mode (no editor name yet)
  if (action === 'verify') {
    return json({ ok: true, verified: true })
  }

  // 2) editor name — required
  const editor = typeof editorName === 'string' ? editorName.trim() : ''
  if (!editor || editor.length > 60) {
    return json({ ok: false, error: 'editor_required', message: '수정자 이름을 입력하세요 · 请输入修改人姓名' }, 400)
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

    const record = {
      cells,
      remark,
      lastUpdated: new Date().toISOString(),
      lastUpdatedBy: editor,
    }
    await kv.put(KEY_PREFIX + itemNo, JSON.stringify(record))
    return json({ ok: true, itemNo, record })
  } catch (err) {
    console.error('[process] mutation error', err)
    return json({ ok: false, error: err.message || 'mutation failed' }, 500)
  }
}
