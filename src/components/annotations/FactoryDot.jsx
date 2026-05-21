import { useState } from 'react'
import { useAnnotation, useAnnotations } from '../../hooks/useAnnotation'
import { getAnnotationColor } from './colors'
import AnnotationEditor from './AnnotationEditor'

export default function FactoryDot({ G, factory }) {
  const clean = (typeof factory === 'string' ? factory : '').trim()
  const skip = !clean || clean === '—' || clean === '-'
  const annotationKey = skip ? null : `factory:${clean}`
  const memo = useAnnotation(annotationKey)
  const { isAdmin } = useAnnotations()
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)

  if (skip) return null
  if (!memo && !isAdmin) return null

  const dot = memo ? getAnnotationColor(memo.color, G.dk) : G.fa

  const handleClick = (e) => {
    e.stopPropagation()
    if (isAdmin) setOpen(true)
  }

  return (
    <span
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 14, height: 14, marginLeft: 4, verticalAlign: 'middle',
        cursor: isAdmin ? 'pointer' : memo ? 'help' : 'default',
        position: 'relative',
      }}
    >
      <span style={{
        width: memo ? 6 : 7, height: memo ? 6 : 7, borderRadius: '50%',
        background: memo ? dot : 'transparent',
        border: memo ? 'none' : `1px dashed ${G.border}`,
      }} />
      {hover && memo && (
        <span style={{
          position: 'absolute', bottom: '100%', left: '50%',
          transform: 'translateX(-50%) translateY(-4px)',
          background: G.tx, color: G.bg,
          fontSize: 10, padding: '5px 8px', borderRadius: 4,
          whiteSpace: 'normal', maxWidth: 240, width: 'max-content',
          lineHeight: 1.4, zIndex: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          pointerEvents: 'none',
        }}>{memo.text}</span>
      )}
      {open && (
        <AnnotationEditor G={G} annotationKey={annotationKey} onClose={() => setOpen(false)} />
      )}
    </span>
  )
}
