export function getMoStatus(mo) {
  return mo.Status || mo.status || mo.MO_Status || ''
}

export function getMoFactory(mo) {
  return (
    mo.Factory?.display_value ||
    mo.Factory_Name ||
    mo.Factory ||
    mo.factory ||
    '—'
  )
}

export function getMoNumber(mo) {
  return mo.MO_Number || mo.MO_No || mo.ID || mo.id || '—'
}

export function getMoSku(mo) {
  return mo.Style_SKU || mo.SKU || mo.Style || mo.style_sku || '—'
}

export function getPlanQty(mo) {
  return Number(mo.Plan_Qty || mo.Plan_Total || mo.plan_qty || 0)
}

export function getActualQty(mo) {
  return Number(mo.Actual_Qty || mo.Actual_Total || mo.actual_qty || 0)
}

export function getEndDate(mo) {
  return mo.End_Date || mo.end_date || mo.Delivery_Date || mo.Due_Date || null
}

export function isOverdue(mo) {
  const end = getEndDate(mo)
  const status = getMoStatus(mo)
  if (!end || /complet/i.test(status)) return false
  return new Date(end) < new Date()
}

export function getProgress(mo) {
  const plan = getPlanQty(mo)
  const actual = getActualQty(mo)
  if (!plan) return 0
  return Math.min(100, Math.round((actual / plan) * 100))
}

export function getMonthKey(mo) {
  const date = mo.Created_Time || mo.Start_Date || mo.Year_Month || ''
  if (!date) return null
  const d = new Date(date)
  if (isNaN(d)) return null
  const yy = String(d.getFullYear()).slice(-2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${yy}.${mm}`
}

export function STATUS_COLORS(status) {
  const s = (status || '').toLowerCase()
  if (/complet/i.test(s)) return { bg: 'rgba(16,185,129,0.15)', text: '#10B981', dot: '#10B981' }
  if (/progress|진행/i.test(s)) return { bg: 'rgba(201,168,110,0.15)', text: '#C9A86E', dot: '#C9A86E' }
  if (/not.start|미시작|未开始/i.test(s)) return { bg: 'rgba(148,163,184,0.15)', text: '#94A3B8', dot: '#94A3B8' }
  if (/delay|지연|延误/i.test(s)) return { bg: 'rgba(239,68,68,0.15)', text: '#EF4444', dot: '#EF4444' }
  return { bg: 'rgba(148,163,184,0.1)', text: '#94A3B8', dot: '#94A3B8' }
}
