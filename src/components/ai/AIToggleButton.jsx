import { Sparkles } from 'lucide-react'

export default function AIToggleButton({ onClick, isOpen, G }) {
  return (
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
        color: isOpen ? '#fff' : G.mu,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 5,
        minWidth: 36, minHeight: 36,
        transition: 'all .15s',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '.5px',
      }}
      onMouseEnter={e => {
        if (!isOpen) {
          e.currentTarget.style.borderColor = G.primary
          e.currentTarget.style.color = G.accent
        }
      }}
      onMouseLeave={e => {
        if (!isOpen) {
          e.currentTarget.style.borderColor = G.border
          e.currentTarget.style.color = G.mu
        }
      }}
    >
      <Sparkles size={13} strokeWidth={1.8} />
    </button>
  )
}
