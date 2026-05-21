import { useState } from 'react'
import { useAnnotation, useAnnotations } from '../../hooks/useAnnotation'
import { getAnnotationColor } from './colors'
import AnnotationEditor from './AnnotationEditor'

// Per Phase 1 spec: 5 pipeline stages get annotations.
// 샘플제작/완료 are excluded (component returns null for those).
const STAGE_KR_TO_KEY = {
  '원단': 'FAB',
  '재단': 'CUT',
  '재봉': 'SEW',
  '포장': 'PACK',
  '출고': 'SHIP',
}

export default function StageAnnotation({ G, moId, stageKr }) {
  const stageKey = STAGE_KR_TO_KEY[stageKr]
  const annotationKey = stageKey && moId ? `mo:${moId}:stage:${stageKey}` : null
  const memo = useAnnotation(annotationKey)
  const { isAdmin } = useAnnotations()
  const [open, setOpen] = useState(false)

  if (!annotationKey) return null
  if (!memo && !isAdmin) return null

  const handleClick = (e) => {
    e.stopPropagation()
    setOpen(true)
  }

  if (!memo) {
    // Admin, no memo yet — small "add" link
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          style={{
            background: 'transparent', border: `1px dashed ${G.border}`,
            borderRadius: 4, padding: '2px 6px', fontSize: 10,
            color: G.fa, cursor: 'pointer', fontFamily: 'inherit',
            marginTop: 4, alignSelf: 'flex-start'
          }}
        >+ 메모</button>
        {open && (
          <AnnotationEditor G={G} annotationKey={annotationKey} onClose={() => setOpen(false)} />
        )}
      </>
    )
  }

  const dot = getAnnotationColor(memo.color, G.dk)
  return (
    <>
      <div
        onClick={handleClick}
        title={memo.text}
        style={{
          marginTop: 4, padding: '4px 8px',
          background: G.dk ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
          borderLeft: `3px solid ${dot}`,
          borderRadius: 3,
          fontSize: 10, color: G.tx, lineHeight: 1.4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          cursor: isAdmin ? 'pointer' : 'default',
        }}
      >{memo.text}</div>
      {open && isAdmin && (
        <AnnotationEditor G={G} annotationKey={annotationKey} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
