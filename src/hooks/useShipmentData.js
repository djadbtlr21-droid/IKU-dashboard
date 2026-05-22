import { useState, useEffect, useMemo, useCallback } from 'react'
import { fetchShipments } from '../api/client'
import { parseZohoDate } from '../utils/moHelpers'

// ─── Classify a single container into one of 5 states ─────
// 'warehouse' → CCD recorded
// 'port'      → ATA recorded, no CCD
// 'sea'       → ATD recorded, no ATA
// 'imminent'  → ETD ≤7 days from today, no ATD
// 'pending'   → everything else (not shown in pipeline)
export function classifyContainer(c, today) {
  const etd = c.ETD  ? parseZohoDate(c.ETD)  : null
  const atd = c.ATD  ? parseZohoDate(c.ATD)  : null
  const ata = c.ATA  ? parseZohoDate(c.ATA)  : null
  const ccd = c.CCD  ? parseZohoDate(c.CCD)  : null

  if (ccd) return 'warehouse'
  if (ata) return 'port'
  if (atd && !ata) return 'sea'
  if (atd) return 'sea'  // dead-code fallback per spec (atd+ata already caught above)

  if (etd) {
    const diff = (etd - today) / (1000 * 60 * 60 * 24)
    if (diff >= 0 && diff <= 7) return 'imminent'
  }

  return 'pending'
}

// Parse Container_Lines subform — REST API often returns "" or wrapped object
export function parseContainerLines(raw) {
  if (!raw || raw === '') return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'object' && Array.isArray(raw.data)) return raw.data
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return [] }
  }
  return []
}

export default function useShipmentData() {
  const [containers, setContainers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchShipments({ perPage: 200 })
      .then(data => {
        const rows = data?.data || data?.records || data?.result || []
        setContainers(rows)
      })
      .catch(err => {
        console.error('[useShipmentData]', err)
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadData()
    window.addEventListener('iku:refresh', loadData)
    return () => window.removeEventListener('iku:refresh', loadData)
  }, [loadData])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const categorized = useMemo(() => {
    const groups = { imminent: [], sea: [], port: [], warehouse: [], pending: [] }
    containers.forEach(c => {
      const key = classifyContainer(c, today)
      if (groups[key]) groups[key].push(c)
      else groups.pending.push(c)
    })
    return groups
  }, [containers, today])

  const stats = useMemo(() => {
    const imminent = categorized.imminent.length
    const sea = categorized.sea.length
    // 통관 지연: ETA passed + ATA not recorded
    const customsDelayed = containers.filter(c => {
      const eta = c.ETA ? parseZohoDate(c.ETA) : null
      const ata = c.ATA ? parseZohoDate(c.ATA) : null
      return eta && eta < today && !ata
    }).length
    return { imminent, sea, customsDelayed, total: containers.length }
  }, [containers, categorized, today])

  return { containers, loading, error, categorized, stats, today, loadData }
}
