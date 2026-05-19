import { useState, useEffect } from 'react'
import { Package } from 'lucide-react'
import { getMoImageCandidates, getImageUrl } from '../utils/imageUrl'

// ─────────────────────────────────────────────────────────────
// ZohoImage — probes multiple candidate URLs in order.
// On every onError, advances to the next candidate. Renders a
// theme-aware placeholder once all candidates fail.
// ─────────────────────────────────────────────────────────────

export default function ZohoImage({
  record,
  field = 'Style_Image',
  report = 'All_MO',
  alt = '',
  G,
  style,
  placeholderText = '이미지 없음 · 无图片',
  iconSize = 28,
  candidates: customCandidates,
}) {
  // Build candidate list once per record/field
  const candidates = customCandidates || (() => {
    if (!record) return []
    if (report === 'All_MO') return getMoImageCandidates(record, field)
    const u = getImageUrl(record, field, report, 0)
    return u ? [u] : []
  })()

  const [idx, setIdx] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setIdx(0)
    setFailed(false)
  }, [record?.ID, field, report])

  const src = candidates[idx]
  const T = G || { cardAlt: '#FBF9F4', fa: '#C8C0B2', mu: '#7A7268' }

  if (!src || failed) {
    return (
      <div style={{
        width: '100%', height: '100%', background: T.cardAlt,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: T.fa, gap: 6, ...style,
      }}>
        <Package size={iconSize} strokeWidth={1.4} />
        <span style={{ fontSize: 10, letterSpacing: '.3px' }}>{placeholderText}</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...style }}
      onError={() => {
        if (idx < candidates.length - 1) {
          setIdx(idx + 1)
        } else {
          setFailed(true)
        }
      }}
    />
  )
}
