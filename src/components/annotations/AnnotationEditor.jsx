import { useState, useEffect, useRef } from 'react'
import { useAnnotation, useAnnotations } from '../../hooks/useAnnotation'
import { ANNOTATION_COLORS, getAnnotationColor } from './colors'

const MAX = 200

function isMobile() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 860px)').matches
}

export default function AnnotationEditor({ G, annotationKey, onClose }) {
  const memo = useAnnotation(annotationKey)
  const { save, remove } = useAnnotations()
  const [text, setText] = useState(memo?.text || '')
  const [color, setColor] = useState(memo?.color || 'yellow')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [mobile] = useState(() => isMobile())
  const textareaRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const remaining = MAX - text.length

  const handleSave = async () => {
    if (busy) return
    const trimmed = text.trim()
    if (!trimmed) { setErr('내용을 입력하세요'); return }
    if (trimmed.length > MAX) { setErr(`최대 ${MAX}자`); return }
    setBusy(true)
    setErr('')
    const ok = await save(annotationKey, trimmed, color)
    setBusy(false)
    if (ok) onClose()
    else setErr('저장 실패 · 重试')
  }

  const handleDelete = async () => {
    if (busy || !memo) return
    setBusy(true)
    const ok = await remove(annotationKey)
    setBusy(false)
    if (ok) onClose()
  }

  const content = (
    <div onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span className="syne" style={{ fontSize: 13, fontWeight: 700, color: G.tx }}>메모 · 备注</span>
        <span className="num" style={{ fontSize: 11, color: remaining < 0 ? G.bad : G.fa }}>{remaining}</span>
      </div>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={e => setText(e.target.value.slice(0, MAX + 50))}
        maxLength={MAX + 50}
        rows={mobile ? 5 : 4}
        placeholder="메모 내용 (최대 200자)"
        style={{
          width: '100%', padding: 10, fontSize: 13, fontFamily: 'inherit',
          border: `1px solid ${G.border}`, borderRadius: 8,
          background: G.bg, color: G.tx, outline: 'none',
          resize: 'none', boxSizing: 'border-box'
        }}
      />
      <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center' }}>
        {ANNOTATION_COLORS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            title={c}
            aria-label={c}
            style={{
              width: 22, height: 22, borderRadius: '50%',
              background: getAnnotationColor(c, G.dk),
              border: color === c ? `2px solid ${G.tx}` : `1px solid ${G.border}`,
              cursor: 'pointer', padding: 0
            }}
          />
        ))}
      </div>
      {err && <div style={{ marginTop: 8, fontSize: 11, color: G.bad }}>{err}</div>}
      <div style={{ display: 'flex', gap: 6, marginTop: 14, alignItems: 'center' }}>
        {memo ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            style={{
              background: 'transparent', border: `1px solid ${G.border}`,
              borderRadius: 6, padding: '7px 10px', fontSize: 11,
              color: G.bad, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit'
            }}
          >삭제</button>
        ) : <div />}
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost"
            style={{ padding: '7px 12px', fontSize: 12, minHeight: 32 }}
          >취소</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || !text.trim()}
            className="btn-primary"
            style={{ padding: '7px 14px', fontSize: 12, minHeight: 32, opacity: (busy || !text.trim()) ? 0.55 : 1 }}
          >{busy ? '저장중…' : '저장'}</button>
        </div>
      </div>
    </div>
  )

  if (mobile) {
    return (
      <div
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
        style={{
          position: 'fixed', inset: 0, background: G.overlayBg,
          zIndex: 999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
        }}
      >
        <div style={{
          width: '100%', maxWidth: 480,
          background: G.card, borderTopLeftRadius: 14, borderTopRightRadius: 14,
          padding: 18, paddingBottom: 'max(18px, env(safe-area-inset-bottom))',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.18)'
        }}>
          {content}
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: G.overlayBg,
        zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
      }}
    >
      <div style={{
        width: '100%', maxWidth: 380,
        background: G.card, border: `1px solid ${G.border}`, borderRadius: 12,
        padding: 18, boxShadow: G.cardShadow
      }}>
        {content}
      </div>
    </div>
  )
}
