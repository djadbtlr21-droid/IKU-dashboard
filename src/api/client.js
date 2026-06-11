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
export async function saveProcessItem({ password, editorName, itemNo, cells, remark }) {
  return apiFetch('/api/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, editorName, itemNo, cells, remark }),
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
