async function apiFetch(path, opts = {}) {
  const res = await fetch(path, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw Object.assign(new Error(err.error || 'API error'), { status: res.status, data: err })
  }
  return res.json()
}

export async function fetchMoList(params = {}) {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.factory) qs.set('factory', params.factory)
  if (params.month) qs.set('month', params.month)
  if (params.perPage) qs.set('max_records', params.perPage)
  return apiFetch(`/api/mo-list?${qs}`)
}

export async function fetchMoDetail(id) {
  return apiFetch(`/api/mo-detail?id=${encodeURIComponent(id)}`)
}

export async function fetchStyleDetail(sku) {
  return apiFetch(`/api/style-detail?sku=${encodeURIComponent(sku)}`)
}

// All_Styles list (Style / Sample 管理). Zoho v2.1 cursor pagination:
// pass the `record_cursor` from the previous response to get the next page.
// (from_index is NOT a valid Zoho v2.1 param — it triggers error 1060.)
export async function fetchStyleList({ cursor = '', maxRecords = 50 } = {}) {
  const qs = new URLSearchParams()
  qs.set('max_records', String(maxRecords))
  if (cursor) qs.set('cursor', cursor)
  return apiFetch(`/api/style-list?${qs}`)
}

// ── Style 미오더 메타 (오더 예정 공장 / 비고 / 숨김) — 비밀번호 불필요 ──
export async function fetchStyleMeta() {
  return apiFetch('/api/style-meta')
}
function postStyleMeta(payload) {
  return apiFetch('/api/style-meta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
export const saveStyleFactory = (sku, value) => postStyleMeta({ action: 'factory', sku, value })
export const saveStyleNote = (sku, value) => postStyleMeta({ action: 'note', sku, value })
export const saveStylePrice = (sku, value) => postStyleMeta({ action: 'price', sku, value })
export const saveStyleSampleAlert = (sku, value) => postStyleMeta({ action: 'sample_alert', sku, value })
export const saveStyleOrderAlert = (sku, value) => postStyleMeta({ action: 'order_alert', sku, value })
export const hideStyle = (sku) => postStyleMeta({ action: 'hide', sku })
export const unhideStyle = (sku) => postStyleMeta({ action: 'unhide', sku })

export async function fetchShipments(params = {}) {
  const qs = new URLSearchParams()
  if (params.perPage) qs.set('max_records', params.perPage)
  return apiFetch(`/api/get-shipments?${qs}`)
}

export async function fetchProductionLogs(moNumber) {
  return apiFetch(`/api/get-production-logs?mo=${encodeURIComponent(moNumber)}`)
}

export function zohoImageUrl(report, recordId, field) {
  return `/api/zoho-image?report=${encodeURIComponent(report)}&recordId=${encodeURIComponent(recordId)}&field=${encodeURIComponent(field)}`
}

// ── 공정 확인 / 工序确认 (process tracking) ──
export async function fetchProcessData() {
  return apiFetch('/api/process')
}

// ── 중→한 번역 (현 상황 비고) — functions/api/translate.js ──
export async function translateText(text, targetLang = 'ko') {
  return apiFetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, targetLang }),
  })
}

// Verify the edit password (server-side). Returns a structured result so the
// UI can distinguish a wrong password (401) from a server/config error (5xx)
// or a network failure — never throws.
//   { ok: true, source }                       password accepted
//   { ok: false, kind: 'wrong_password', ... }  401 — actually incorrect
//   { ok: false, kind: 'server_error', ... }    4xx/5xx other than 401
//   { ok: false, kind: 'network', ... }         fetch failed / offline
export async function verifyProcessPassword(password) {
  let res
  try {
    res = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', password }),
    })
  } catch {
    return { ok: false, kind: 'network', message: '서버에 연결할 수 없습니다 · 无法连接服务器' }
  }
  const data = await res.json().catch(() => null)
  if (res.ok && data && data.ok) {
    return { ok: true, source: data.passwordSource }
  }
  if (res.status === 401) {
    return { ok: false, kind: 'wrong_password', message: data?.message || '비밀번호가 틀렸습니다 · 密码错误' }
  }
  return {
    ok: false,
    kind: 'server_error',
    status: res.status,
    message: data?.message || `서버 오류 (${res.status}) · 服务器错误`,
  }
}

// Save one item's process cells. Returns { ok, ...data }.
export async function saveProcessItem({ password, editorName, itemNo, cells, remark, remarkAuthor = '' }) {
  return apiFetch('/api/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, editorName, itemNo, cells, remark, remarkAuthor }),
  })
}

// Save the shared hidden-order list.
export async function saveProcessHidden({ password, editorName, hidden }) {
  return apiFetch('/api/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'hidden', password, editorName, hidden }),
  })
}

// ── 목록 삭제 (deleted_mo:{id} / deleted_style:{sku}, public, no password) ──
export async function fetchDeletions() {
  return apiFetch('/api/deletions')
}
export const deleteMo = (id) => apiFetch('/api/deletions', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'mo', id }),
})
export const deleteStyle = (sku) => apiFetch('/api/deletions', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'style', id: sku }),
})

// ── MO 원단명 오버라이드 (key: fabric:{MO_ID}, public, no password) ──
export async function fetchMoFabric() {
  return apiFetch('/api/mo-fabric')
}
export async function saveMoFabric(id, value) {
  return apiFetch('/api/mo-fabric', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, value }),
  })
}

// ── HEXIANG 工厂现场 (worker-line config — public, no password) ──
export async function fetchFactoryConfig() {
  return apiFetch('/api/factory-config')
}

export async function saveFactoryConfig(lines, password) {
  return apiFetch('/api/factory-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lines, password }),
  })
}

// ── 예상단가 표 (style_price:{SKU} — 전용 엔드포인트, 32KB 한도) ──
export async function fetchStylePriceTable(sku) {
  return apiFetch(`/api/style-price?sku=${encodeURIComponent(sku)}`)
}
export async function saveStylePriceTable(sku, data) {
  return apiFetch('/api/style-price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sku, data }),
  })
}
