import { useState, useEffect } from 'react'

// ─────────────────────────────────────────────────────────────
// ZohoImage
//
// Zoho Creator v2.1 returns image fields like:
//   mo.Style_Image = [
//     "/api/v2.1/jeramoda/eom/report/All_MO/{recordId}/Style_Image/download?filepath=…"
//   ]
//
// We extract the path from mo[field][0] and pass it through our proxy as
// `filepath`. The proxy prepends https://www.zohoapis.com and adds the
// Zoho-oauthtoken header server-side.
// ─────────────────────────────────────────────────────────────

function buildZohoImageUrl(mo, fieldName) {
  if (!mo) return null
  const v = mo[fieldName]
  if (!v) return null

  let rawPath = null
  if (Array.isArray(v)) {
    if (v.length === 0) return null
    const first = v[0]
    if (typeof first === 'string') rawPath = first
    else if (first && typeof first === 'object') rawPath = first.url || first.filepath || first.path
  } else if (typeof v === 'string') {
    rawPath = v
  } else if (typeof v === 'object') {
    rawPath = v.url || v.filepath || v.path
  }

  if (!rawPath) return null
  return `/api/zoho-image?filepath=${encodeURIComponent(rawPath)}`
}

function Placeholder({ G, label, iconSize = 36 }) {
  const T = G || { cardAlt: '#FBF9F4', fa: '#C8C0B2' }
  return (
    <div style={{
      width: '100%', height: '100%', background: T.cardAlt,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: T.fa, gap: 6,
    }}>
      <svg width={iconSize} height={iconSize} viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <rect x="4" y="6" width="28" height="22" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="13" cy="14" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 24l8-7 6 5 5-4 9 8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      {label !== '' && (
        <span style={{ fontSize: 11, letterSpacing: '.5px' }}>{label || 'No Image · 无图片'}</span>
      )}
    </div>
  )
}

export function ZohoImage({
  mo,
  field = 'Style_Image',
  G,
  alt = '',
  placeholderText,
  iconSize = 36,
  style: extraStyle,
  // legacy props (silently ignored): report, index, record, customCandidates, imgStyle
}) {
  const [hasError, setHasError] = useState(false)
  const url = buildZohoImageUrl(mo, field)

  useEffect(() => { setHasError(false) }, [mo?.ID, field])

  if (!url || hasError) return <Placeholder G={G} label={placeholderText} iconSize={iconSize} />

  return (
    <img
      src={url}
      alt={alt || field}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'top center',
        display: 'block',
        ...extraStyle,
      }}
      onError={() => setHasError(true)}
    />
  )
}

export default ZohoImage
