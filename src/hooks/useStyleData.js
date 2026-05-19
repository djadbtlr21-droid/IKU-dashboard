import { useState, useEffect } from 'react'

// ─────────────────────────────────────────────────────────────
// useStyleData(mo)
// Given an MO record with mo.Style_SKU.ID, fetches the linked
// Style record from /api/style-detail?id=... Caches results
// module-level so all card / timeline / modal usages dedup.
// ─────────────────────────────────────────────────────────────

const styleCache = new Map()      // styleId → styleRecord
const pendingPromises = new Map() // styleId → Promise<styleRecord>

function extractRecord(json) {
  if (!json) return null
  if (Array.isArray(json.data)) return json.data[0] || null
  if (json.data && typeof json.data === 'object') return json.data
  return json
}

export function useStyleData(mo) {
  const styleId = mo?.Style_SKU?.ID || mo?.Style?.ID || null
  const [style, setStyle] = useState(() => (styleId && styleCache.has(styleId)) ? styleCache.get(styleId) : null)
  const [loading, setLoading] = useState(() => !!(styleId && !styleCache.has(styleId)))
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!styleId) {
      setStyle(null)
      setLoading(false)
      setError(null)
      return
    }

    // Cache hit
    if (styleCache.has(styleId)) {
      setStyle(styleCache.get(styleId))
      setLoading(false)
      setError(null)
      return
    }

    // In-flight request — piggyback
    let cancelled = false
    if (pendingPromises.has(styleId)) {
      setLoading(true)
      pendingPromises.get(styleId)
        .then(rec => { if (!cancelled) { setStyle(rec); setLoading(false) } })
        .catch(err => { if (!cancelled) { setError(err); setLoading(false) } })
      return () => { cancelled = true }
    }

    // Fresh fetch
    setLoading(true)
    const promise = fetch(`/api/style-detail?id=${encodeURIComponent(styleId)}`)
      .then(r => r.json())
      .then(json => {
        const rec = extractRecord(json)
        styleCache.set(styleId, rec)
        pendingPromises.delete(styleId)
        return rec
      })
      .catch(err => {
        pendingPromises.delete(styleId)
        throw err
      })

    pendingPromises.set(styleId, promise)

    promise
      .then(rec => { if (!cancelled) { setStyle(rec); setLoading(false) } })
      .catch(err => { if (!cancelled) { setError(err); setLoading(false) } })

    return () => { cancelled = true }
  }, [styleId])

  return { style, loading, error }
}

export function clearStyleCache() {
  styleCache.clear()
  pendingPromises.clear()
}
