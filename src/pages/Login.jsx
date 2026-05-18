import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const inputRef = useRef(null)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(false)
    setLoading(true)

    await new Promise((r) => setTimeout(r, 400))

    const ok = login(pw)
    if (ok) {
      setSuccess(true)
      setTimeout(() => navigate('/mo', { replace: true }), 1000)
    } else {
      setLoading(false)
      setError(true)
      setPw('')
      inputRef.current?.focus()
    }
  }

  return (
    <div className="min-h-screen bg-darkNavy flex items-center justify-center p-4">
      <div
        className="w-full max-w-sm"
        style={{ animation: 'slideUp 0.5s ease-out both' }}
      >
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ background: 'linear-gradient(135deg, #C9A86E 0%, #A8854A 100%)' }}>
            <span className="text-darkNavy font-bold text-2xl" style={{ fontFamily: 'Inter, sans-serif' }}>IKU</span>
          </div>
          <h1 className="text-2xl font-bold text-cream" style={{ fontFamily: 'Pretendard, sans-serif' }}>
            IKU Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8896B3' }}>
            생산현황 대시보드 · 生产进度看板
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: '#252B3D',
            border: '1px solid rgba(201, 168, 110, 0.3)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          }}
        >
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-6">
              <label className="block text-xs font-semibold mb-2 tracking-widest uppercase"
                style={{ color: '#C9A86E' }}>
                비밀번호 · 密码
              </label>
              <input
                ref={inputRef}
                type="password"
                value={pw}
                onChange={(e) => { setPw(e.target.value); setError(false) }}
                placeholder="••••••••"
                autoFocus
                disabled={loading || success}
                className="w-full px-4 py-3 rounded-xl text-cream text-base outline-none transition-all duration-200"
                style={{
                  background: '#1A1F2E',
                  border: error ? '1.5px solid #EF4444' : '1.5px solid rgba(201,168,110,0.25)',
                  fontFamily: 'Inter, sans-serif',
                  letterSpacing: '0.2em',
                }}
                onFocus={(e) => {
                  e.target.style.border = '1.5px solid #C9A86E'
                  e.target.style.boxShadow = '0 0 0 3px rgba(201,168,110,0.15)'
                }}
                onBlur={(e) => {
                  if (!error) {
                    e.target.style.border = '1.5px solid rgba(201,168,110,0.25)'
                    e.target.style.boxShadow = 'none'
                  }
                }}
              />
              {error && (
                <p className="mt-2 text-xs text-red-400" style={{ animation: 'fadeIn 0.2s ease' }}>
                  비밀번호가 올바르지 않습니다 · 密码错误
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || success || !pw}
              className="w-full py-3 rounded-xl font-semibold text-sm tracking-wide transition-all duration-200 relative overflow-hidden"
              style={{
                background: loading || success
                  ? 'rgba(201,168,110,0.5)'
                  : 'linear-gradient(135deg, #C9A86E 0%, #A8854A 100%)',
                color: '#1A1F2E',
                cursor: loading || success ? 'not-allowed' : 'pointer',
              }}
            >
              {success ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  입장 중... · 登录中...
                </span>
              ) : loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  확인 중...
                </span>
              ) : (
                '입장 · 进入'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#3A4268' }}>
          JERA © 2026 · IKU Dashboard v1.0
        </p>
      </div>
    </div>
  )
}
