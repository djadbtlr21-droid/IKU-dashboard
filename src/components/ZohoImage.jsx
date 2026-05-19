import { useState, useEffect } from 'react'
import { Package } from 'lucide-react'
import { getImageUrl, getMoImageCandidates } from '../utils/imageUrl'

// ─────────────────────────────────────────────────────────────
// ZohoImage
//
// Two calling conventions are supported:
//
//   Preferred (explicit MO + Style fallback):
//     <ZohoImage mo={mo} style={style} field="Style_Image" G={G}/>
//
//   Legacy (single record):
//     <ZohoImage record={record} field="Style_Image" report="All_MO" G={G}/>
//
// In both modes we build a candidate list. On every <img onError>
// we advance to the next candidate, finally rendering a theme-aware
// placeholder once all candidates fail.
// ─────────────────────────────────────────────────────────────

function buildCandidates({ mo, style, record, field, report, index }) {
  const urls = []

  // Mode A — explicit mo + style
  if (mo || style) {
    if (mo) {
      const u = getImageUrl(mo, field, 'All_MO', index)
      if (u) urls.push(u)
    }
    if (style) {
      const u = getImageUrl(style, field, 'All_Styles', index)
      if (u) urls.push(u)
      // Some Zoho schemas use plain "Image" / "Photo" on Style record
      if (field === 'Style_Image') {
        const alt = getImageUrl(style, 'Image', 'All_Styles', index)
        if (alt) urls.push(alt)
      }
    }
    return urls.filter(Boolean)
  }

  // Mode B — legacy single record
  if (record) {
    if (report === 'All_MO' || !report) {
      return getMoImageCandidates(record, field)
    }
    const u = getImageUrl(record, field, report, index)
    return u ? [u] : []
  }

  return []
}

export default function ZohoImage({
  mo, style, record,
  field = 'Style_Image',
  report = 'All_MO',
  index = 0,
  alt = '',
  G,
  imgStyle,                  // optional CSS override (cannot reuse "style" name — it's the Style record)
  placeholderText = '이미지 없음 · 无图片',
  iconSize = 28,
}) {
  // Bind candidate list to record identity so we don't re-build every render
  const moId = mo?.ID || record?.ID || null
  const styleId = style?.ID || null

  const candidates = buildCandidates({ mo, style, record, field, report, index })

  const [idx, setIdx] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setIdx(0)
    setFailed(false)
  }, [moId, styleId, field, report, index])

  const src = candidates[idx]
  const T = G || { cardAlt: '#FBF9F4', fa: '#C8C0B2', mu: '#7A7268' }

  if (!src || failed) {
    return (
      <div style={{
        width: '100%', height: '100%', background: T.cardAlt,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: T.fa, gap: 6, ...imgStyle,
      }}>
        <Package size={iconSize} strokeWidth={1.4} />
        {placeholderText && <span style={{ fontSize: 10, letterSpacing: '.3px' }}>{placeholderText}</span>}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...imgStyle }}
      onError={() => {
        if (idx < candidates.length - 1) setIdx(idx + 1)
        else setFailed(true)
      }}
    />
  )
}
