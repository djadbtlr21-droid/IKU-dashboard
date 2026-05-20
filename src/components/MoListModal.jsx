import { useEffect, useState, useMemo } from 'react'
import { X } from 'lucide-react'
import ZohoImage from './ZohoImage'
import {
  getMoNumber, getMoSku, getMoFactory, getPlanQty, getActualQty, cleanProdStatus,
} from '../utils/moHelpers'

function MoRow({ G, mo, onClick }) {
  return (
    <div
      onClick={() => onClick(mo)}
      style={{
        background: G.card, border: `1px solid ${G.border}`, borderRadius: 10,
        padding: 12, cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center',
        transition: 'all .15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = G.primary
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = G.cardShadow
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = G.border
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = ''
      }}
    >
      <div style={{ width: 44, height: 56, borderRadius: 6, background: G.cardAlt, flexShrink: 0, overflow: 'hidden', border: `1px solid ${G.hair}` }}>
        <ZohoImage mo={mo} field="Style_Image" G={G} iconSize={14} placeholderText="" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="num" title={getMoNumber(mo)} style={{ fontSize: 14, fontWeight: 700, color: G.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {getMoNumber(mo)}
        </div>
        <div title={getMoSku(mo)} style={{ fontSize: 10, color: G.mu, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {getMoSku(mo)}
        </div>
        <div title={getMoFactory(mo)} style={{ fontSize: 10, color: G.mu, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {getMoFactory(mo)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, gap: 8 }}>
          <span className="num" style={{ color: G.mu, whiteSpace: 'nowrap' }}>
            P {getPlanQty(mo).toLocaleString()} / A {getActualQty(mo).toLocaleString()}
          </span>
          <span style={{ color: G.accent, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }} title={mo.Production_Status}>
            {cleanProdStatus(mo.Production_Status) || '—'}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function MoListModal({ G, title, subtitle, accentColor, mos, tabs, onClose, onMoClick }) {
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.key || null)
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = prev }
  }, [onClose])

  const T = G || { surf: '#FFFFFF', card: '#FFFFFF', cardAlt: '#FBF9F4', border: '#EDE8DE', hair: '#E4DED2', primary: '#C9A86E', accent: '#9A7228', tx: '#1A1714', mu: '#7A7268', fa: '#C8C0B2', bad: '#A14E3A', overlayBg: 'rgba(26,23,20,0.45)', cardShadow: '0 2px 8px rgba(26,23,20,0.06)', dk: false, nh: 'rgba(26,23,20,0.035)' }
  const accent = accentColor || T.primary

  // Tab-aware filtered list. When tabs is undefined, falls through to `mos`.
  const visibleMos = useMemo(() => {
    if (!tabs?.length) return mos || []
    const tab = tabs.find(t => t.key === activeTab) || tabs[0]
    if (!tab?.match) return mos || []
    return (mos || []).filter(tab.match)
  }, [mos, tabs, activeTab])

  // Per-tab counts for the badge labels
  const tabCounts = useMemo(() => {
    if (!tabs?.length) return {}
    const out = {}
    tabs.forEach(t => { out[t.key] = t.match ? (mos || []).filter(t.match).length : (mos || []).length })
    return out
  }, [mos, tabs])

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 950, padding: 20,
        background: T.overlayBg, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        style={{
          width: 'min(900px, 95vw)', maxHeight: '85vh',
          background: T.surf, color: T.tx,
          borderRadius: 16, border: `1px solid ${T.border}`,
          boxShadow: T.dk ? '0 32px 64px rgba(0,0,0,0.6)' : '0 24px 64px rgba(26,23,20,0.18)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          animation: 'slideUp 0.3s ease-out',
        }}
      >
        <div style={{
          padding: '18px 24px', borderBottom: `1px solid ${T.hair}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: T.cardAlt, flexShrink: 0, gap: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ width: 8, height: 32, borderRadius: 4, background: accent }} />
            <div>
              <div className="syne" style={{ fontSize: 18, fontWeight: 700, color: accent, letterSpacing: '-.3px' }}>{title}</div>
              {subtitle && <div className="num" style={{ fontSize: 12, color: T.mu, marginTop: 2 }}>{subtitle}</div>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="close"
            style={{
              width: 36, height: 36, borderRadius: '50%', background: 'transparent',
              border: `1px solid ${T.border}`, color: T.mu, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${T.bad}1A`; e.currentTarget.style.color = T.bad; e.currentTarget.style.borderColor = T.bad }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.mu; e.currentTarget.style.borderColor = T.border }}
          >
            <X size={16} />
          </button>
        </div>

        {tabs?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, padding: '12px 20px', borderBottom: `1px solid ${T.hair}`, background: T.surf, overflowX: 'auto', flexShrink: 0 }}>
            {tabs.map(t => {
              const active = t.key === activeTab
              const count = tabCounts[t.key] ?? 0
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                    border: `1px solid ${active ? accent : T.border}`,
                    background: active ? `${accent}1A` : 'transparent',
                    color: active ? accent : T.mu,
                    cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                    transition: 'all .15s',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = accent }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = T.border }}
                >
                  {t.label} <span className="num" style={{ marginLeft: 4, fontWeight: 700, color: active ? accent : T.mu }}>({count})</span>
                </button>
              )
            })}
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {!visibleMos.length ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: T.mu, fontSize: 13 }}>
              해당 MO가 없습니다 · 没有匹配MO
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {visibleMos.map(mo => <MoRow key={mo.ID} G={T} mo={mo} onClick={onMoClick} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
