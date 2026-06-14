// ─────────────────────────────────────────────────────────────
// All_Styles 필드 방어적 매핑 헬퍼 (미오더 섹션 / 생산 전 체크)
// StylesPage 의 매핑과 동일 규칙. 실제 응답 키는 style-list.js 의
// ZOHO_DEBUG 로그로 확인 후 후보 배열을 보정하면 된다.
// ─────────────────────────────────────────────────────────────

export function fieldStr(v) {
  if (v === null || v === undefined) return ''
  if (Array.isArray(v)) return v.map(fieldStr).filter(Boolean).join(', ')
  if (typeof v === 'object') return String(v.zc_display_value || v.display_value || v.value || '').trim()
  return String(v).trim()
}

export function pick(rec, keys) {
  for (const k of keys) {
    const s = fieldStr(rec?.[k])
    if (s) return s
  }
  return ''
}

export const F = {
  sku: ['Style_SKU', 'SKU', 'Style_Code', 'Style_No', 'style_sku'],
  eng: ['Eng_Style_Name', 'English_Style_Name', 'Style_Name', 'Style_Name_EN', 'Name'],
  chi: ['Chinese_Style_Name', 'Chi_Style_Name', 'CN_Style_Name', 'Chinese_Name', 'Style_Name_CN'],
  brand: ['Business_Entity', 'Brand', 'Brand_Name', 'brand'],
  season: ['Season', 'season'],
  gender: ['Gender', 'Sex', 'gender'],
  category: ['Category', 'Style_Category', 'Type', 'category'],
  fabric: ['Fabric_Name', 'Material_Type', 'Fabric', 'Main_Fabric', 'Material', 'fabric'],
  cost: ['Target_Cost', 'Estimated_Cost', 'Cost', 'Target_Price', 'target_cost'],
  styleStatus: ['Style_Status', 'Status', 'Style_Stage', 'style_status'],
  sampleStatus: ['Sample_Status', 'Sampling_Status', 'Sample_Stage', 'sample_status'],
  orderStatus: ['Order_Status', 'Ordered', 'order_status'],
  month: ['Order_Month', 'Plan_Month', 'Expected_Order_Month', 'Expected_Month', 'Delivery_Month', 'Plan_Order_Month', 'plan_month'],
  created: ['Created_Time', 'Added_Time', 'Create_Time', 'created_time'],
  modified: ['Modified_Time', 'Updated_Time', 'Modified_time', 'modified_time'],
}

export const IMAGE_FIELDS = ['Style_Image', 'Style_Photo', 'Image', 'Photo', 'Main_Image', 'Front_Image', 'Thumbnail']

export const recId = (r) => String(r?.ID || r?.id || '')
// 메타 KV 키로 쓰는 SKU (없으면 레코드 ID fallback)
export const styleKey = (r) => pick(r, F.sku) || recId(r)

export function imageField(rec) {
  for (const f of IMAGE_FIELDS) {
    const v = rec?.[f]
    if (v && (typeof v === 'string' ? v : (Array.isArray(v) ? v.length : true))) return f
  }
  return null
}

export function styleImageUrl(rec) {
  const f = imageField(rec)
  if (!f) return null
  const v = rec[f]
  const first = Array.isArray(v) ? v[0] : v
  const path = typeof first === 'string' ? first : (first?.url || first?.filepath || first?.path)
  return path ? `/api/zoho-image?filepath=${encodeURIComponent(path)}` : null
}

// 미오더 여부: Order_Status 가 미오더(Not Ordered / 未下单)인가
export function isOrdered(rec) {
  const raw = pick(rec, F.orderStatus).toLowerCase()
  if (!raw) return false
  if (/未下单|not.?order|no\b|false|否/.test(raw)) return false
  return /已下单|ordered|yes|true|是|下单/.test(raw)
}

// 상태 배지 색상: 진행=warn(노랑) · 완료=ok(초록) · 홀드=bad(빨강) · 미시작/기타=회색
export function styleStatusBadge(G, raw) {
  const s = String(raw || '').toLowerCase()
  if (!s) return null
  if (/hold|보류|홀드|暂停|挂起/.test(s)) return { color: G.bad, label: raw }
  if (/complete|done|완료|完成|结束/.test(s)) return { color: G.ok, label: raw }
  if (/progress|진행|进行|制作|开发|开发中/.test(s)) return { color: G.warn, label: raw }
  if (/not.?start|미시작|未开始|待/.test(s)) return { color: G.mu, label: raw }
  return { color: G.mu, label: raw }
}

export function seasonOf(rec) { return pick(rec, F.season) }

// 예정월: 날짜형이면 YYYY-MM, 아니면 원문 그대로
export function monthOf(rec) {
  const raw = pick(rec, F.month)
  if (!raw) return ''
  const d = new Date(raw)
  if (!isNaN(d.getTime()) && /\d{4}/.test(raw)) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  return raw
}

export function fmtTime(s) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
