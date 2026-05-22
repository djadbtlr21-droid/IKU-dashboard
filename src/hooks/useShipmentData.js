import { useState, useEffect, useMemo, useCallback } from 'react'
import { fetchMoList } from '../api/client'
import { getMoFactory, getMonthKey, parseZohoDate } from '../utils/moHelpers'

// Local prod-group classification (mirrors MoView.jsx prodGroup — kept in sync)
export function prodGroupShipment(mo) {
  const raw = String(mo?.Production_Status || '').trim()
  if (!raw) return 'Sampling'
  const s = raw.toLowerCase()
  if (/warehouse\s*hold|shipment\s*pending/i.test(raw)) return 'Hold'
  if (/^shipped$|shipped|出货|出货完|delivered|出库/i.test(raw)) return 'Shipped'
  if (/sampling|샘플|产前样|not\s*start|미시작|未开始|未开/i.test(raw)) return 'Sampling'
  if (/fabric\s*received|fabric|면료|원단|面料/i.test(s)) return 'Fabric'
  if (/cutting|cut|재단|裁剪|裁/i.test(s)) return 'Cutting'
  if (/sewing|sew|봉제|재봉|裁缝|缝/i.test(s)) return 'Sewing'
  if (/packing|pack|포장|包装/i.test(s)) return 'Packing'
  if (/completed|complete|finish|완료|完成/i.test(s)) return 'Completed'
  return 'Unknown'
}

// Classify a MO into one of 5 shipment-view categories
export function shipCat(mo) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const shipDate = parseZohoDate(mo.Ship_Date)
  const planShip = parseZohoDate(mo.Expected_Delivery)
  const pg = prodGroupShipment(mo)

  if (shipDate || pg === 'Shipped' || pg === 'Hold') return 'shipped'

  if (planShip) {
    if (planShip < today) return 'delayed'
    const daysUntil = Math.round((planShip - today) / 86400000)
    if (daysUntil <= 7) return 'imminent'
  }

  if (pg === 'Completed') return 'ready'
  return 'inprod'
}

// Month key based on Expected_Delivery (plan ship date); falls back to production month
export function getShipMonthKey(mo) {
  const d = parseZohoDate(mo.Expected_Delivery)
  if (d) {
    const yy = String(d.getFullYear()).slice(-2)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${yy}.${mm}`
  }
  return getMonthKey(mo)
}

export default function useShipmentData() {
  const [moList, setMoList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchMoList({ perPage: 200 })
      .then(data => {
        const rows = data?.data || data?.records || data?.result || []
        setMoList(rows)
      })
      .catch(err => {
        console.error('[ShipmentData]', err)
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadData()
    window.addEventListener('iku:refresh', loadData)
    return () => window.removeEventListener('iku:refresh', loadData)
  }, [loadData])

  const currentMonthKey = useMemo(() => {
    const now = new Date()
    return `${String(now.getFullYear()).slice(-2)}.${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const monthKeys = useMemo(() =>
    [...new Set(moList.map(getShipMonthKey).filter(Boolean))].sort().reverse()
  , [moList])

  return { moList, loading, error, monthKeys, currentMonthKey }
}
