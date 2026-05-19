import { useState, useEffect, useCallback } from 'react'
import { fetchStyleDetail } from '../api/client'
import { SkeletonImageCarousel } from './SkeletonLoader'

const IMAGE_FIELDS = [
  'Style_Image', 'Image', 'image', 'Style_Photo', 'Photo',
  'Front_Image', 'Back_Image', 'Side_Image', 'Detail_Image',
  'Main_Image', 'Thumbnail',
]

function extractImages(styleData) {
  const record = styleData?.data?.[0] || styleData?.record || styleData || {}
  const images = []
  for (const field of IMAGE_FIELDS) {
    const val = record[field]
    if (!val) continue
    if (typeof val === 'string' && val.length > 0) {
      images.push({ field, label: field.replace(/_/g, ' ') })
    } else if (Array.isArray(val) && val.length > 0) {
      val.forEach((v, i) => images.push({ field: `${field}[${i}]`, label: `${field} ${i + 1}` }))
    }
  }
  return images.slice(0, 5)
}

const PLACEHOLDER = (
  <div className="w-full h-full flex flex-col items-center justify-center rounded-xl"
    style={{ background: '#FBF9F4' }}>
    <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="#C8C0B2">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
    <p className="text-xs" style={{ color: '#9A7228' }}>이미지 없음 · 无图片</p>
  </div>
)

export default function StyleImageCarousel({ styleSku, recordId }) {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const [imgErrors, setImgErrors] = useState({})

  useEffect(() => {
    if (!styleSku) { setLoading(false); return }
    setLoading(true)
    setImages([])
    setSelected(0)
    setImgErrors({})

    fetchStyleDetail(styleSku)
      .then((data) => {
        console.log('[StyleImageCarousel] style-detail response:', JSON.stringify(data).slice(0, 500))
        const imgs = extractImages(data)
        setImages(imgs)
      })
      .catch((err) => {
        console.error('[StyleImageCarousel] fetch error:', err)
      })
      .finally(() => setLoading(false))
  }, [styleSku])

  const imgUrl = useCallback((field) => {
    if (!recordId) return null
    return `/api/zoho-image?report=All_Styles&recordId=${encodeURIComponent(recordId)}&field=${encodeURIComponent(field)}`
  }, [recordId])

  if (loading) return <SkeletonImageCarousel />

  if (!images.length) {
    return (
      <div className="space-y-3">
        <div style={{ aspectRatio: '1/1' }}>{PLACEHOLDER}</div>
      </div>
    )
  }

  const currentField = images[selected]?.field
  const currentUrl = imgUrl(currentField)

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div
        className="relative rounded-xl overflow-hidden cursor-zoom-in"
        style={{ aspectRatio: '1/1', background: '#FBF9F4', border: '1px solid rgba(201,168,110,0.2)' }}
        onClick={() => setLightbox(true)}
      >
        {currentUrl && !imgErrors[currentField] ? (
          <img
            src={currentUrl}
            alt={images[selected]?.label}
            className="w-full h-full object-contain"
            onError={() => setImgErrors((e) => ({ ...e, [currentField]: true }))}
          />
        ) : PLACEHOLDER}
        <div className="absolute top-2 right-2 p-1.5 rounded-lg"
          style={{ background: 'rgba(26,23,20,0.55)' }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="#C9A86E">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </div>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((img, i) => {
            const url = imgUrl(img.field)
            return (
              <button
                key={img.field}
                onClick={() => setSelected(i)}
                className="rounded-lg overflow-hidden transition-all"
                style={{
                  aspectRatio: '1/1',
                  background: '#FBF9F4',
                  border: i === selected ? '2px solid #C9A86E' : '2px solid transparent',
                }}
              >
                {url && !imgErrors[img.field] ? (
                  <img
                    src={url}
                    alt={img.label}
                    className="w-full h-full object-cover"
                    onError={() => setImgErrors((e) => ({ ...e, [img.field]: true }))}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#C8C0B2">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01" />
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.92)', animation: 'fadeIn 0.15s ease' }}
          onClick={() => setLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
            onClick={() => setLightbox(false)}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {currentUrl && !imgErrors[currentField] ? (
            <img
              src={currentUrl}
              alt={images[selected]?.label}
              className="max-w-full max-h-full object-contain rounded-xl"
              style={{ maxHeight: '90vh' }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : PLACEHOLDER}
        </div>
      )}
    </div>
  )
}
