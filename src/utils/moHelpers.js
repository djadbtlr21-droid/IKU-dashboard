// Parse Zoho Creator date strings: "20-May-2026" (canonical) with ISO fallback.
export function parseZohoDate(str) {
  if (!str || str === '-' || str === '') return null
  const months = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  }
  const m = String(str).match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/)
  if (m) return new Date(+m[3], months[m[2]], +m[1])
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

export function getMoNumber(mo) {
  return mo.MO_Number || mo.ID || '—'
}

export function getMoSku(mo) {
  if (mo.Style_SKU && typeof mo.Style_SKU === 'object') {
    return mo.Style_SKU.Style_SKU || mo.Style_SKU.zc_display_value || '—'
  }
  return typeof mo.Style_SKU === 'string' ? mo.Style_SKU : '—'
}

// Strip Zoho's "_NN_" sorting prefix (e.g. "_04_宁军（合祥）" → "宁军（合祥）")
function stripFactoryPrefix(name) {
  if (!name) return '—'
  const cleaned = String(name).replace(/^_\d+_/, '').trim()
  return cleaned || '—'
}

export function getMoFactory(mo) {
  let raw
  if (mo.Factory && typeof mo.Factory === 'object') {
    raw = mo.Factory.Factory_Name_Chinese || mo.Factory.zc_display_value || ''
  } else if (typeof mo.Factory === 'string') {
    raw = mo.Factory
  }
  return stripFactoryPrefix(raw)
}

export function getMoStatus(mo) {
  return mo.Production_Status || mo.Order_Status || ''
}

export function getPlanQty(mo) {
  return Number(mo.Plan_Total_Quantity || mo.Plan_Qty || 0)
}

export function getActualQty(mo) {
  // Zoho field has typo: Acture (not Actual)
  return Number(mo.Acture_Total_Quantity || mo.Actual_Qty || 0)
}

export function getEndDate(mo) {
  return mo.Ship_Date || mo.Expected_Delivery || null
}

export function isDelayed(mo) {
  return String(mo.Delivery_Status || '').toLowerCase().includes('delay')
}

export function isOverdue(mo) {
  if (isDelayed(mo)) return true
  const end = getEndDate(mo)
  if (!end) return false
  const endD = parseZohoDate(end)
  if (!endD) return false
  const status = getMoStatus(mo)
  if (/complet/i.test(status)) return false
  return endD < new Date()
}

export function getProgress(mo) {
  const plan = getPlanQty(mo)
  const actual = getActualQty(mo)
  if (!plan) return 0
  return Math.min(100, Math.round((actual / plan) * 100))
}

// Returns "26.06" style key using Plan_Year + Plan_Month
export function getMonthKey(mo) {
  const year = mo.Plan_Year
  const month = mo.Plan_Month
  if (year && month) {
    return `${String(year).slice(-2)}.${String(month).padStart(2, '0')}`
  }
  // Fallback: derive from date string
  const dateStr = mo.Order_Date || mo.Modified_Time || ''
  if (!dateStr) return null
  const d = parseZohoDate(dateStr)
  if (!d) return null
  const yy = String(d.getFullYear()).slice(-2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${yy}.${mm}`
}

export function STATUS_COLORS(status) {
  const s = (status || '').toLowerCase()
  if (/complet|완료|完成|shipped|ship/i.test(s)) return { bg: 'rgba(16,185,129,0.15)', text: '#10B981', dot: '#10B981' }
  if (/fabric|cutting|sewing|stitch|qc|packing|finish|진행|progress|进行|입고|수령/i.test(s)) return { bg: 'rgba(201,168,110,0.15)', text: '#C9A86E', dot: '#C9A86E' }
  if (/not.start|미시작|未开始|pending|대기|확인|confirm/i.test(s)) return { bg: 'rgba(148,163,184,0.15)', text: '#94A3B8', dot: '#94A3B8' }
  if (/delay|지연|延误/i.test(s)) return { bg: 'rgba(239,68,68,0.15)', text: '#EF4444', dot: '#EF4444' }
  return { bg: 'rgba(148,163,184,0.1)', text: '#94A3B8', dot: '#94A3B8' }
}

// Classify production status into chart buckets
export function getChartBucket(mo) {
  if (isDelayed(mo)) return 'Overdue'
  const s = getMoStatus(mo)
  if (/complet|完成|shipped/i.test(s)) return 'Completed'
  if (s) return 'In Progress'
  return 'Not Started'
}

// Parse Zoho's multi-JSON string: '{"pom":"...","s":"..."},...'
// → JSON.parse('[' + str + ']') → [{pom, s, m, l, xl, notes}, ...]
export function parseSpecJSON(str) {
  if (!str) return null
  if (typeof str !== 'string') return null
  const trimmed = str.trim()
  if (!trimmed) return null
  try {
    // Already a proper JSON array
    if (trimmed.startsWith('[')) return JSON.parse(trimmed)
    // Wrap bare comma-separated objects
    return JSON.parse('[' + trimmed + ']')
  } catch {
    return null
  }
}
