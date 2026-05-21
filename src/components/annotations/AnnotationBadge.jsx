import { useState } from 'react'
import { useAnnotation, useAnnotations } from '../../hooks/useAnnotation'
import { getAnnotationColor } from './colors'
import AnnotationEditor from './AnnotationEditor'

export default function AnnotationBadge({ G, annotationKey, top = 8, right = 8 }) {
  const memo = useAnnotation(annotationKey)
  const { isAdmin } = useAnnotations()
  const [open, setOpen] = useState(false)

  if (!memo && !isAdmin) return null

  const dotColor = memo ? getAnnotationColor(memo.color, G.dk) : null

  const handleClick = (e) => {
    e.stopPropagation()
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title={memo?.text || '메모 추가'}
        aria-label={memo ? 'edit annotation' : 'add annotation'}
        style={{
          position: 'absolute',
          top, right,
          width: 22, height: 22,
          borderRadius: '50%',
          background: memo ? dotColor : 'rgba(255,255,255,0.92)',
          border: memo ? `1px solid ${dotColor}` : `1px dashed ${G.border}`,
          color: memo ? '#fff' : G.mu,
          fontSize: 13, fontWeight: 600,
          lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0,
          zIndex: 5,
          boxShadow: memo ? '0 1px 3px rgba(0,0,0,0.25)' : '0 1px 2px rgba(0,0,0,0.12)',
          fontFamily: 'inherit',
          transition: 'transform .12s'
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.12)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = '' }}
      >{memo ? '' : '+'}</button>
      {open && (
        <AnnotationEditor
          G={G}
          annotationKey={annotationKey}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
