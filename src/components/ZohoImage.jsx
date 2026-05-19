import { useState, useEffect } from 'react'

// ─────────────────────────────────────────────────────────────
// ZohoImage — direct download via /api/zoho-image proxy.
// Uses mo.ID + field + index only. No /api/style-detail dependency.
//
// URL pattern (matches Zoho Creator v2.1):
//   /api/zoho-image?report=All_MO&recordId={mo.ID}&field={field}&index={index}
// which on the server resolves to:
//   /creator/v2.1/data/jeramoda/eom/report/{report}/{recordId}/{field}/{index}/download
// ─────────────────────────────────────────────────────────────

function Placeholder({ G, label, iconSize }) {
  const T = G || { cardAlt: '#FBF9F4', fa: '#C8C0B2', mu: '#7A7268' }
  return (
    <div style={{
      width: '100%', height: '100%', background: T.cardAlt,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: T.fa, gap: 6,
    }}>
      <svg width={iconSize || 40} height={iconSize || 40} viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect x="6" y="8" width="28" height="22" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="14" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 26l8-7 6 5 5-4 9 8" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      {label !== '' && <span style={{ fontSize: 10, letterSpacing: '.3px' }}>{label || 'No Image · 无图片'}</span>}
    </div>
  )
}

export default function ZohoImage({
  mo,
  field = 'Style_Image',
  report = 'All_MO',
  index = 0,
  alt = '',
  G,
  placeholderText,
  iconSize = 32,
  // Legacy props (silently ignored): style, record, customCandidates
}) {
  // Reset error state when the target changes
  const [errored, setErrored] = useState(false)
  const moId = mo?.ID || mo?.id || null

  useEffect(() => { setErrored(false) }, [moId, field, report, index])

  if (!moId || errored) {
    return <Placeholder G={G} label={placeholderText} iconSize={iconSize} />
  }

  const url = `/api/zoho-image?report=${encodeURIComponent(report)}&recordId=${encodeURIComponent(moId)}&field=${encodeURIComponent(field)}&index=${index}`

  return (
    <img
      src={url}
      alt={alt || field}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      onError={() => setErrored(true)}
    />
  )
}
