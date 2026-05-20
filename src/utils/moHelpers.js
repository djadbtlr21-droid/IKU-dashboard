// Parse Zoho Creator date strings.
// Supported formats (case-insensitive month names):
//   "20-May-2026"        (Zoho's default)
//   "20-May-26"          (2-digit year — auto-promoted to 2000+)
//   "20-Apr-2026 10:30:00"
//   "2026-05-20"         (ISO)
//   "2026-05-20T10:30:00Z" (ISO with time)
const _ZOHO_MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

export function parseZohoDate(str) {
  if (!str || typeof str !== 'string') return null
  const s = str.trim()
  if (!s || s === '-') return null

  // "DD-Mon-YYYY[ HH:MM:SS]" — Zoho's canonical format
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (m) {
    const day = +m[1]
    const month = _ZOHO_MONTHS[m[2].toLowerCase()]
    if (month === undefined) return null
    let year = +m[3]
    if (year < 100) year += 2000
    const hh = m[4] ? +m[4] : 0
    const mm = m[5] ? +m[5] : 0
    const ss = m[6] ? +m[6] : 0
    const d = new Date(year, month, day, hh, mm, ss)
    return isNaN(d.getTime()) ? null : d
  }

  // ISO fallback ("2026-05-20" / "2026-05-20T...")
  const iso = new Date(s)
  return isNaN(iso.getTime()) ? null : iso
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

export function getMoFactory(mo) {
  if (mo.Factory && typeof mo.Factory === 'object') {
    return mo.Factory.Factory_Name_Chinese || mo.Factory.zc_display_value || '—'
  }
  return typeof mo.Factory === 'string' ? mo.Factory : '—'
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
