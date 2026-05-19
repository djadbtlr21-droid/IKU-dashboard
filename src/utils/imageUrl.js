// ─────────────────────────────────────────────────────────────
// Zoho image-URL helpers
//
// Zoho Creator v2.1 image fields return as one of:
//   1) String: a path like "/api/v2.1/.../download?filepath=…"
//      or an absolute URL "https://…"
//   2) Array of strings (multi-image)
//   3) Array of objects with {url, filepath, name, ...}
//   4) Empty array / null / undefined
//
// We always go through /api/zoho-image so the server adds the
// Zoho-oauthtoken header. If Zoho gave us a concrete path we pass
// it via ?filepath= (preferred). Otherwise we use the
// report/recordId/field/[index]/download endpoint.
// ─────────────────────────────────────────────────────────────

export function getImageUrl(record, fieldName, report = 'All_MO', index = 0) {
  if (!record) return null
  const id = record.ID || record.id
  if (!id) return null

  const v = record[fieldName]

  // Empty
  if (v === null || v === undefined || v === '') {
    // Fall through to canonical download URL — proxy may still succeed if Zoho has the file
    return `/api/zoho-image?report=${encodeURIComponent(report)}&recordId=${encodeURIComponent(id)}&field=${encodeURIComponent(fieldName)}&index=${index}`
  }

  // Array
  if (Array.isArray(v)) {
    if (v.length === 0) {
      return `/api/zoho-image?report=${encodeURIComponent(report)}&recordId=${encodeURIComponent(id)}&field=${encodeURIComponent(fieldName)}&index=${index}`
    }
    const item = v[index] ?? v[0]
    if (!item) return null
    if (typeof item === 'string') {
      return `/api/zoho-image?filepath=${encodeURIComponent(item)}`
    }
    if (typeof item === 'object') {
      const path = item.url || item.filepath || item.path || item.download_url || item.value
      if (path) return `/api/zoho-image?filepath=${encodeURIComponent(path)}`
      return `/api/zoho-image?report=${encodeURIComponent(report)}&recordId=${encodeURIComponent(id)}&field=${encodeURIComponent(fieldName)}&index=${index}`
    }
  }

  // String
  if (typeof v === 'string') {
    return `/api/zoho-image?filepath=${encodeURIComponent(v)}`
  }

  // Object
  if (typeof v === 'object' && v) {
    const path = v.url || v.filepath || v.path
    if (path) return `/api/zoho-image?filepath=${encodeURIComponent(path)}`
  }

  return `/api/zoho-image?report=${encodeURIComponent(report)}&recordId=${encodeURIComponent(id)}&field=${encodeURIComponent(fieldName)}&index=${index}`
}

// Build a Style-record image URL when Style record ID is known.
// Used as a fallback when the MO record doesn't carry images.
export function getStyleImageUrl(styleId, field = 'Style_Image', index = 0) {
  if (!styleId) return null
  return `/api/zoho-image?report=All_Styles&recordId=${encodeURIComponent(styleId)}&field=${encodeURIComponent(field)}&index=${index}`
}

// Best-effort: return all candidate image URLs for a MO record.
// Tries MO record first, then linked Style record.
// Components can try them in order with onError.
export function getMoImageCandidates(mo, field = 'Style_Image') {
  if (!mo) return []
  const urls = []
  // 1. MO record direct field (whatever shape)
  const direct = getImageUrl(mo, field, 'All_MO', 0)
  if (direct) urls.push(direct)
  // 2. Linked Style record
  const styleId = mo.Style_SKU?.ID || mo.Style?.ID
  if (styleId) {
    const styleUrl = getStyleImageUrl(styleId, field, 0)
    if (styleUrl) urls.push(styleUrl)
    // Some schemas use 'Image' or 'Photo'
    urls.push(getStyleImageUrl(styleId, 'Image', 0))
  }
  return urls.filter(Boolean)
}
