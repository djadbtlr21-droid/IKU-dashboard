import { useState, useEffect, useRef } from 'react'
import { useAnnotations } from '../../hooks/useAnnotation'

export default function AdminLoginModal({ G }) {
  const { loginOpen, login, onLoginSuccess, closeLogin } = useAnnotations()
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!loginOpen) return
    setPw('')
    setErr('')
    setBusy(false)
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [loginOpen])

  useEffect(() => {
    if (!loginOpen) return
    const h = e => { if (e.key === 'Escape') closeLogin() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [loginOpen, closeLogin])

  if (!loginOpen) return null

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (busy || !pw) return
    setBusy(true)
    setErr('')
    const ok = await login(pw)
    if (ok) {
      onLoginSuccess()
    } else {
      setBusy(false)
      setErr('비밀번호가 틀렸습니다 · 密码错误')
    }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) closeLogin() }}
      style={{
        position: 'fixed', inset: 0, background: G.overlayBg,
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: G.card, border: `1px solid ${G.border}`, borderRadius: 12,
          padding: 22, width: '100%', maxWidth: 360, boxShadow: G.cardShadow
        }}
      >
        <div className="syne" style={{ fontSize: 16, fontWeight: 700, color: G.tx, marginBottom: 4 }}>Admin Login</div>
        <div style={{ fontSize: 11, color: G.mu, marginBottom: 16 }}>
          메모 작성을 위해 인증이 필요합니다 · 备注需要认证
        </div>
        <input
          ref={inputRef}
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          placeholder="비밀번호 · 密码"
          autoComplete="current-password"
          style={{
            width: '100%', padding: '10px 12px', fontSize: 14,
            border: `1px solid ${G.border}`, borderRadius: 8,
            background: G.bg, color: G.tx, outline: 'none',
            fontFamily: 'inherit', boxSizing: 'border-box'
          }}
        />
        {err && <div style={{ marginTop: 8, fontSize: 11, color: G.bad }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={closeLogin}
            className="btn-ghost"
            style={{ minHeight: 36, padding: '8px 14px', fontSize: 12 }}
          >취소</button>
          <button
            type="submit"
            disabled={busy || !pw}
            className="btn-primary"
            style={{ minHeight: 36, padding: '8px 14px', fontSize: 12, opacity: (busy || !pw) ? 0.55 : 1 }}
          >{busy ? '확인중…' : '로그인'}</button>
        </div>
      </form>
    </div>
  )
}
