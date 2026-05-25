import { useState, useEffect, useRef } from 'react'
import { X, Lock } from 'lucide-react'
import { verifyPassword, unlockPrice } from '../utils/priceLock'

export default function PriceUnlockModal({ G, onUnlocked, onClose }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const confirm = () => {
    if (verifyPassword(input)) {
      unlockPrice()
      onUnlocked()
      onClose()
    } else {
      setError(true)
      setInput('')
      inputRef.current?.focus()
    }
  }

  const handleKey = e => {
    if (e.key === 'Enter') confirm()
    if (error) setError(false)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 360, background: G.bg, borderRadius: 16,
          border: `1px solid ${G.border}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 14px',
          borderBottom: `1px solid ${G.hair}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(201,168,110,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Lock size={15} style={{ color: '#C9A86E' }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: G.tx }}>가격 정보 잠금 해제</div>
              <div style={{ fontSize: 11, color: G.mu, marginTop: 1 }}>解锁价格信息</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: 'none',
              background: 'rgba(0,0,0,0.06)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: G.mu,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 20px 8px' }}>
          <input
            ref={inputRef}
            type="password"
            value={input}
            onChange={e => { setInput(e.target.value); setError(false) }}
            onKeyDown={handleKey}
            placeholder="비밀번호 / 密码"
            style={{
              width: '100%', padding: '10px 14px',
              borderRadius: 8, fontSize: 14,
              border: `1.5px solid ${error ? '#EF4444' : G.border}`,
              background: G.cardAlt || G.surf,
              color: G.tx, outline: 'none',
              fontFamily: 'inherit',
              transition: 'border-color .15s',
            }}
          />
          {error && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#EF4444', fontWeight: 500 }}>
              비밀번호가 일치하지 않습니다 / 密码不正确
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 20px 20px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              border: `1px solid ${G.border}`, background: 'transparent',
              color: G.mu, cursor: 'pointer',
            }}
          >
            취소 / 取消
          </button>
          <button
            onClick={confirm}
            style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              border: 'none', background: '#C9A86E',
              color: '#fff', cursor: 'pointer',
            }}
          >
            확인 / 确认
          </button>
        </div>
      </div>
    </div>
  )
}
