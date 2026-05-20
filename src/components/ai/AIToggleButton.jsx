import { useState, useEffect } from 'react'
import { Sparkles } from 'lucide-react'

export default function AIToggleButton({ onClick, isOpen, G, tab }) {
  const [showTooltip, setShowTooltip] = useState(false)

  useEffect(() => {
    if (isOpen) { setShowTooltip(false); return }
    setShowTooltip(true)
    const t = setTimeout(() => setShowTooltip(false), 10000)
    return () => clearTimeout(t)
  }, [tab, isOpen])

  return (
    <div style={{ position: 'relative' }}>
      {showTooltip && (
        <div className="ai-tooltip">
          <Sparkles size={13} style={{ flexShrink: 0 }} />
          AI에게 최신 동향을 물어보세요!
        </div>
      )}
      <button
        onClick={onClick}
        title="AI 분석가 · AI 分析师"
        style={{
          background: isOpen
            ? `linear-gradient(135deg, ${G.primary} 0%, #A8854A 100%)`
            : 'transparent',
          border: `1px solid ${isOpen ? G.primary : G.border}`,
          borderRadius: 8,
          cursor: 'pointer',
          padding: '8px 10px',
          color: isOpen ? '#fff' : G.primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 36, minHeight: 36,
          transition: 'all .15s',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '.5px',
          fontFamily: 'inherit',
        }}
        onMouseEnter={e => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = G.primary
            e.currentTarget.style.background = `rgba(201,168,110,0.08)`
          }
        }}
        onMouseLeave={e => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = G.border
            e.currentTarget.style.background = 'transparent'
          }
        }}
      >
        AI
      </button>
    </div>
  )
}
