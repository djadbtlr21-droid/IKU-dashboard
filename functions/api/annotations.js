// Annotation store — EdgeOne Pages KV.
// Vercel deploy keeps these in a single Vercel-Blob file (annotations.json);
// EdgeOne has no Blob, so the same single-document model is stored under one
// KV key. Binding resolution: prefers ANNOTATIONS_KV, falls back to PROCESS_KV
// (so a single KV namespace can back both annotations + the 공정확인 tab).
//
// GET:           public read.
// PUT?key=<key>: auth required, body { text, color } — upsert.
// DELETE?key=<key>: auth required — remove (idempotent).

import { isAdminRequest, readJsonBody } from './_auth.js'
import { json, preflight } from './_resp.js'

const KV_KEY = 'annotations:_all'
const EMPTY = { version: 1, updatedAt: null, items: {} }
const MAX_TEXT = 200

const MO_KEY_RE = /^mo:[A-Za-z0-9_-]{1,64}:(overall|stage:(FAB|CUT|SEW|PACK|SHIP))$/
const FACTORY_KEY_RE = /^factory:[^\r\n\t]{1,80}$/
const COLORS = new Set(['yellow', 'red', 'blue', 'green', 'pink'])

function getKV(env) {
  return env.ANNOTATIONS_KV || env.PROCESS_KV || null
}
function validKey(k) {
  if (typeof k !== 'string' || k.length === 0 || k.length > 160) return false
  return MO_KEY_RE.test(k) || FACTORY_KEY_RE.test(k)
}
function validColor(c) { return typeof c === 'string' && COLORS.has(c) }
function validText(t) {
  if (typeof t !== 'string') return false
  const trimmed = t.trim()
  return trimmed.length > 0 && trimmed.length <= MAX_TEXT
}

async function readAnnotations(kv) {
  try {
    const raw = await kv.get(KV_KEY)
    if (!raw) return EMPTY
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object' || typeof data.items !== 'object') return EMPTY
    return { version: data.version || 1, updatedAt: data.updatedAt || null, items: data.items }
  } catch (err) {
    console.error('[annotations] read error', err)
    return EMPTY
  }
}

async function writeAnnotations(kv, items) {
  const payload = { version: 1, updatedAt: new Date().toISOString(), items }
  await kv.put(KV_KEY, JSON.stringify(payload))
  return payload
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return preflight('GET, PUT, DELETE, OPTIONS')

  const kv = getKV(env)

  if (request.method === 'GET') {
    if (!kv) return json(EMPTY)
    try {
      const data = await readAnnotations(kv)
      return json(data, 200, { 'Cache-Control': 's-maxage=10, stale-while-revalidate=60' })
    } catch (err) {
      console.error('[annotations] GET error', err)
      return json({ error: 'read failed' }, 500)
    }
  }

  if (request.method !== 'PUT' && request.method !== 'DELETE') {
    return json({ error: 'Method Not Allowed' }, 405, { Allow: 'GET, PUT, DELETE, OPTIONS' })
  }

  // Mutations require auth + a bound KV.
  if (!kv) return json({ error: 'KV not configured' }, 500)
  if (!(await isAdminRequest(request, env))) return json({ error: 'Unauthorized' }, 401)

  const key = new URL(request.url).searchParams.get('key')
  if (!validKey(key)) return json({ error: 'Invalid key' }, 400)

  try {
    if (request.method === 'PUT') {
      const body = await readJsonBody(request)
      if (!body.ok) return json({ error: 'Invalid JSON' }, 400)
      const { text, color } = body.data || {}
      if (!validText(text)) return json({ error: `Invalid text (1-${MAX_TEXT} chars)` }, 400)
      if (!validColor(color)) return json({ error: 'Invalid color' }, 400)
      const current = await readAnnotations(kv)
      const items = {
        ...current.items,
        [key]: { text: text.trim(), color, updatedAt: new Date().toISOString() },
      }
      return json(await writeAnnotations(kv, items))
    }

    // DELETE
    const current = await readAnnotations(kv)
    if (!Object.prototype.hasOwnProperty.call(current.items, key)) {
      return json(current)
    }
    const items = { ...current.items }
    delete items[key]
    return json(await writeAnnotations(kv, items))
  } catch (err) {
    console.error('[annotations] mutation error', err)
    return json({ error: err.message || 'mutation failed' }, 500)
  }
}
