// Annotation store — Vercel Blob (annotations.json single-file).
// Sub-goal 1: GET only (public read). PUT/DELETE arrives in sub-goal 2.

import { list, put } from '@vercel/blob'

const BLOB_PATH = 'annotations.json'
const EMPTY = { version: 1, updatedAt: null, items: {} }

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

// Exposed for sub-goal 2 (PUT/DELETE will reuse).
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
  res.setHeader('Allow', 'GET, PUT, DELETE, OPTIONS')
  return res.status(405).json({ error: 'Method Not Allowed (PUT/DELETE coming in sub-goal 2)' })
}

export { readAnnotations, writeAnnotations, BLOB_PATH, EMPTY }
