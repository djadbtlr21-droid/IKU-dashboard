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
  if (params.perPage) qs.set('per_page', params.perPage)
  return apiFetch(`/api/mo-list?${qs}`)
}

export async function fetchMoDetail(id) {
  return apiFetch(`/api/mo-detail?id=${encodeURIComponent(id)}`)
}

export async function fetchStyleDetail(sku) {
  return apiFetch(`/api/style-detail?sku=${encodeURIComponent(sku)}`)
}

export function zohoImageUrl(report, recordId, field) {
  return `/api/zoho-image?report=${encodeURIComponent(report)}&recordId=${encodeURIComponent(recordId)}&field=${encodeURIComponent(field)}`
}
