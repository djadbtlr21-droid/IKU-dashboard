import { useEffect } from 'react'
import { X } from 'lucide-react'
import ZohoImage from './ZohoImage'
import {
  getMoNumber, getMoSku, getMoFactory, getPlanQty, getActualQty, cleanProdStatus,
} from '../utils/moHelpers'
import StageAnnotation from './annotations/StageAnnotation'

function StageMoRow({ G, mo, stage, onClick }) {
  return (
    <div
      onClick={() => onClick(mo)}
      style={{
        background: G.card,
        border: `1px solid ${G.border}`,
        borderRadius: 10,
        padding: 12,
        cursor: 'pointer',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        transition: 'all .15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = stage.hue
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = G.cardShadow
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = G.border
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = ''
      }}
    >
      <div style={{ width: 48, height: 60, borderRadius: 6, background: G.cardAlt, flexShrink: 0, overflow: 'hidden', border: `1px solid ${G.hair}` }}>
        <ZohoImage mo={mo} field="Style_Image" report="All_MO" G={G} iconSize={16} placeholderText="" />
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
          <span style={{ color: stage.hue, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }} title={mo.Production_Status}>
            {cleanProdStatus(mo.Production_Status) || '—'}
          </span>
        </div>
        <StageAnnotation G={G} moId={mo.ID} stageKr={stage.kr} />
      </div>
    </div>
  )
}

export default function PipelineStageModal({ stage, mos, G, onClose, onMoClick }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = prev }
  }, [onClose])

  if (!stage) return null

  const T = G || { surf: '#FFFFFF', card: '#FFFFFF', cardAlt: '#FBF9F4', border: '#EDE8DE', hair: '#E4DED2', primary: '#C9A86E', accent: '#9A7228', tx: '#1A1714', mu: '#7A7268', fa: '#C8C0B2', overlayBg: 'rgba(26,23,20,0.45)', cardShadow: '0 2px 8px rgba(26,23,20,0.06)', dk: false }

  const Icon = stage.Icon

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
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${stage.hue}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stage.hue, flexShrink: 0 }}>
              {Icon && <Icon size={24} strokeWidth={1.5} />}
            </div>
            <div>
              <div className="syne" style={{ fontSize: 20, fontWeight: 700, color: stage.hue, letterSpacing: '-.3px', lineHeight: 1.1 }}>
                {stage.kr} <span style={{ color: T.mu, fontWeight: 500, fontSize: 14 }}>/ {stage.cn}</span>
              </div>
              <div className="num" style={{ fontSize: 12, color: T.mu, marginTop: 3 }}>
                총 {mos.length}건 / 共 {mos.length} 件
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="close"
            style={{
              width: 36, height: 36, borderRadius: '50%', background: 'transparent',
              border: `1px solid ${T.border}`, color: T.mu, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .15s', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${T.bad || '#A14E3A'}1A`; e.currentTarget.style.color = T.bad || '#A14E3A'; e.currentTarget.style.borderColor = T.bad || '#A14E3A' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.mu; e.currentTarget.style.borderColor = T.border }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {mos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: T.mu, fontSize: 13 }}>
              해당 단계의 MO가 없습니다 · 此阶段没有MO
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {mos.map(mo => (
                <StageMoRow key={mo.ID} G={T} mo={mo} stage={stage} onClick={onMoClick} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
