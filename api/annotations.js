// Annotation store — Vercel Blob (annotations.json single-file).
// GET: public read (CDN cached 10s).
// PUT?key=<key>: auth required, body { text, color } — upsert.
// DELETE?key=<key>: auth required — remove (idempotent).

import { list, put } from '@vercel/blob'
import { isAdminRequest, readJsonBody } from './_auth.js'

const BLOB_PATH = 'annotations.json'
const EMPTY = { version: 1, updatedAt: null, items: {} }
const MAX_TEXT = 200

// Key whitelist
//   mo:<id>:overall
//   mo:<id>:stage:(FAB|CUT|SEW|PACK|SHIP)
//   factory:<name>
const MO_KEY_RE = /^mo:[A-Za-z0-9_-]{1,64}:(overall|stage:(FAB|CUT|SEW|PACK|SHIP))$/
const FACTORY_KEY_RE = /^factory:[^\r\n\t]{1,80}$/
const COLORS = new Set(['yellow', 'red', 'blue', 'green', 'pink'])

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

async function readAnnotations() {
  try {
    const { blobs } = await list({ prefix: BLOB_PATH, limit: 5 })
    const blob = blobs.find(b => b.pathname === BLOB_PATH)
    if (!blob) return EMPTY
    const res = await fetch(blob.url, { cache: 'no-store' })
    if (!res.ok) {
      console.warn('[annotations] blob fetch non-ok', res.status)
      return EMPTY
    }
    const data = await res.json()
    if (!data || typeof data !== 'object' || typeof data.items !== 'object') return EMPTY
    return { version: data.version || 1, updatedAt: data.updatedAt || null, items: data.items }
  } catch (err) {
    console.error('[annotations] read error', err)
    return EMPTY
  }
}

async function writeAnnotations(items) {
  const payload = { version: 1, updatedAt: new Date().toISOString(), items }
  await put(BLOB_PATH, JSON.stringify(payload), {
    access: 'public',
    contentType: 'application/json',
    allowOverwrite: true,
    addRandomSuffix: false,
  })
  return payload
}

async function handlePut(req, res, key) {
  if (!isAdminRequest(req)) return res.status(401).json({ error: 'Unauthorized' })
  if (!validKey(key)) return res.status(400).json({ error: 'Invalid key' })
  const body = await readJsonBody(req)
  if (!body.ok) return res.status(400).json({ error: 'Invalid JSON' })
  const { text, color } = body.data || {}
  if (!validText(text)) return res.status(400).json({ error: `Invalid text (1-${MAX_TEXT} chars)` })
  if (!validColor(color)) return res.status(400).json({ error: 'Invalid color' })
  const current = await readAnnotations()
  const items = {
    ...current.items,
    [key]: { text: text.trim(), color, updatedAt: new Date().toISOString() }
  }
  const payload = await writeAnnotations(items)
  return res.status(200).json(payload)
}

async function handleDelete(req, res, key) {
  if (!isAdminRequest(req)) return res.status(401).json({ error: 'Unauthorized' })
  if (!validKey(key)) return res.status(400).json({ error: 'Invalid key' })
  const current = await readAnnotations()
  if (!Object.prototype.hasOwnProperty.call(current.items, key)) {
    return res.status(200).json(current)
  }
  const items = { ...current.items }
  delete items[key]
  const payload = await writeAnnotations(items)
  return res.status(200).json(payload)
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, PUT, DELETE, OPTIONS')
    return res.status(204).end()
  }
  if (req.method === 'GET') {
    try {
      const data = await readAnnotations()
      res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=60')
      return res.status(200).json(data)
    } catch (err) {
      console.error('[annotations] GET error', err)
      return res.status(500).json({ error: 'read failed' })
    }
  }
  const key = req.query?.key
  try {
    if (req.method === 'PUT') return await handlePut(req, res, key)
    if (req.method === 'DELETE') return await handleDelete(req, res, key)
  } catch (err) {
    console.error('[annotations] mutation error', err)
    return res.status(500).json({ error: err.message || 'mutation failed' })
  }
  res.setHeader('Allow', 'GET, PUT, DELETE, OPTIONS')
  return res.status(405).json({ error: 'Method Not Allowed' })
}

export { readAnnotations, writeAnnotations, BLOB_PATH, EMPTY, MAX_TEXT, validKey, validColor, validText }
