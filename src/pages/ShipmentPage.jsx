import { useState, useMemo } from 'react'
import {
  AlertTriangle, Ship, Anchor, Warehouse,
  Layers, Search, ArrowRight, RefreshCw,
} from 'lucide-react'
import ContainerDetailModal from '../components/ContainerDetailModal'
import { SkeletonCard } from '../components/SkeletonLoader'
import useShipmentData, { classifyContainer } from '../hooks/useShipmentData'

// ─── Constants ────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: 'imminent',  kr: '출고임박',  cn: '即将出货',  hue: '#F59E0B', Icon: AlertTriangle },
  { key: 'sea',       kr: '해상이동중', cn: '海运中',    hue: '#8B5CF6', Icon: Ship },
  { key: 'port',      kr: '항구도착',  cn: '已到港',    hue: '#0EA5E9', Icon: Anchor },
  { key: 'warehouse', kr: '창고도착',  cn: '仓库到达',  hue: '#10B981', Icon: Warehouse },
]

const STATUS_DISPLAY = {
  imminent:  { kr: '출고임박',  cn: '即将出货',  hue: '#F59E0B', bg: 'rgba(245,158,11,0.82)' },
  sea:       { kr: '해상이동중', cn: '海运中',    hue: '#8B5CF6', bg: 'rgba(139,92,246,0.82)' },
  port:      { kr: '항구도착',  cn: '已到港',    hue: '#0EA5E9', bg: 'rgba(14,165,233,0.82)' },
  warehouse: { kr: '창고도착',  cn: '仓库到达',  hue: '#10B981', bg: 'rgba(16,185,129,0.82)' },
  pending:   { kr: '출고대기',  cn: '待出货',    hue: '#94A3B8', bg: 'rgba(100,116,139,0.72)' },
}

// ─── KPI card ─────────────────────────────────────────────

function KPICard({ G, label, sublabel, count, hue, Icon, onClick, loading }) {
  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        padding: '20px 22px', cursor: onClick ? 'pointer' : 'default',
        transition: 'transform .15s',
        borderColor: G.dk ? `${hue}44` : G.border,
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = '' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${hue}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} style={{ color: hue }} />
        </div>
        <div className="num syne" style={{
          fontSize: 38, fontWeight: 700, color: hue, lineHeight: 1,
        }}>
          {loading ? '—' : count}
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: G.tx, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 10, color: G.mu }}>{sublabel}</div>
    </div>
  )
}

// ─── Container card ───────────────────────────────────────

function ContainerCard({ G, container, today, onClick }) {
  const status = classifyContainer(container, today)
  const sd = STATUS_DISPLAY[status] || STATUS_DISPLAY.pending
  const blNumber = container.B_L_Number || container.BL_Number || ''

  return (
    <div
      onClick={onClick}
      className="card"
      style={{
        cursor: 'pointer', overflow: 'hidden',
        transition: 'transform .15s, box-shadow .15s, border-color .15s',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = G.cardShadow; e.currentTarget.style.borderColor = sd.hue }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = G.border }}
    >
      {/* Status badge strip */}
      <div style={{
        padding: '7px 14px',
        background: sd.bg,
        fontSize: 11, fontWeight: 700, color: '#FFF',
        letterSpacing: '.3px', textAlign: 'center',
        textShadow: '0 1px 3px rgba(0,0,0,0.5)',
      }}>
        {sd.kr} · {sd.cn}
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px', flex: 1, minWidth: 0 }}>
        {/* Container ID */}
        <div style={{ fontSize: 8, color: G.mu, letterSpacing: '.5px', fontWeight: 600 }}>컨테이너 / 柜号</div>
        <div className="num syne" title={container.Container_ID} style={{
          fontSize: 16, fontWeight: 700, color: G.accent,
          marginBottom: 4, letterSpacing: '-.2px',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {container.Container_ID || '(미등록)'}
        </div>

        {/* Route */}
        {(container.Origin_Port || container.Destination_Port) && (
          <>
            <div style={{ fontSize: 8, color: G.mu, letterSpacing: '.5px', fontWeight: 600 }}>루트 / 航线</div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, color: G.tx, marginBottom: 8, fontWeight: 500,
              whiteSpace: 'nowrap', overflow: 'hidden',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{container.Origin_Port || '—'}</span>
              <ArrowRight size={11} style={{ color: G.fa, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{container.Destination_Port || '—'}</span>
            </div>
          </>
        )}

        {/* Key dates */}
        <div style={{ fontSize: 9, color: G.mu, lineHeight: 1.8, marginBottom: 10 }}>
          {container.Stuffing_Date && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Stuffing</span>
              <span className="num" style={{ color: G.tx }}>{container.Stuffing_Date}</span>
            </div>
          )}
          {container.ETD && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>ETD</span>
              <span className="num" style={{ color: G.tx }}>{container.ETD}</span>
            </div>
          )}
          {container.ATD && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>ATD</span>
              <span className="num" style={{ color: G.ok, fontWeight: 600 }}>{container.ATD}</span>
            </div>
          )}
          {container.ETA && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>ETA</span>
              <span className="num" style={{ color: G.tx }}>{container.ETA}</span>
            </div>
          )}
          {container.ATA && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>ATA</span>
              <span className="num" style={{ color: G.ok, fontWeight: 600 }}>{container.ATA}</span>
            </div>
          )}
        </div>

        {/* Mini stats row */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {[
            { label: 'Cartons', value: container.Total_Cartons },
            { label: 'Qty',     value: container.Total_Quantity },
            { label: 'CBM',     value: container.Total_CBM },
          ].map(({ label, value }) => (
            <div key={label} style={{
              flex: 1, textAlign: 'center', padding: '5px 4px',
              background: G.cardAlt, borderRadius: 6, border: `1px solid ${G.hair}`,
            }}>
              <div className="num" style={{ fontSize: 12, fontWeight: 700, color: G.tx, lineHeight: 1 }}>
                {value != null && value !== '' ? Number(value).toLocaleString() : '—'}
              </div>
              <div style={{ fontSize: 8, color: G.mu, marginTop: 2, letterSpacing: '.3px' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Freight cost */}
        {(container.Freight_Cost || container.Freight_Cost === 0) && (
          <div style={{
            padding: '6px 10px',
            background: G.dk ? 'rgba(147,197,253,0.1)' : '#EEF2FF',
            borderRadius: 6, display: 'flex', justifyContent: 'space-between',
            fontSize: 10,
          }}>
            <span style={{ color: G.mu, fontWeight: 600 }}>Freight</span>
            <span className="num" style={{ color: G.tx, fontWeight: 700 }}>
              {Number(container.Freight_Cost).toLocaleString(undefined, { minimumFractionDigits: 2 })} {container.Currency || 'USD'}
            </span>
          </div>
        )}

        {/* B/L number if available */}
        {blNumber && (
          <div style={{ marginTop: 6, fontSize: 9, color: G.fa, display: 'flex', justifyContent: 'space-between' }}>
            <span>B/L</span>
            <span className="num" style={{ color: G.mu }}>{blNumber}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────

export default function ShipmentPage({ G }) {
  const { containers, loading, error, categorized, stats, today, loadData } = useShipmentData()

  const [filterStage, setFilterStage] = useState('all')
  const [filterOrigin, setFilterOrigin] = useState('')
  const [filterDest, setFilterDest] = useState('')
  const [search, setSearch] = useState('')
  const [selectedContainer, setSelectedContainer] = useState(null)

  // Unique origin / dest ports
  const origins = useMemo(() =>
    [...new Set(containers.map(c => c.Origin_Port).filter(Boolean))].sort()
  , [containers])

  const dests = useMemo(() =>
    [...new Set(containers.map(c => c.Destination_Port).filter(Boolean))].sort()
  , [containers])

  // Apply filters
  const displayed = useMemo(() => {
    let list = filterStage === 'all'
      ? containers
      : (categorized[filterStage] || [])
    if (filterOrigin) list = list.filter(c => c.Origin_Port === filterOrigin)
    if (filterDest)   list = list.filter(c => c.Destination_Port === filterDest)
    if (search) {
      const q = search.toLowerCase()
      const blKey1 = 'B_L_Number', blKey2 = 'BL_Number'
      list = list.filter(c => {
        const blob = [
          c.Container_ID, c[blKey1], c[blKey2], c.Origin_Port, c.Destination_Port,
          c.Shipping_Line, c.Vessel_Name,
        ].filter(Boolean).join(' ').toLowerCase()
        return blob.includes(q)
      })
    }
    return list
  }, [containers, categorized, filterStage, filterOrigin, filterDest, search])

  const selStyle = {
    padding: '8px 12px', borderRadius: 8, fontSize: 12,
    border: `1px solid ${G.border}`, background: G.card,
    color: G.tx, outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>

      {/* ── Header ── */}
      <div className="card" style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        {G.dk && <span className="rail" />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="syne" style={{
            background: '#8B5CF6', color: '#FFF',
            padding: '5px 12px', borderRadius: 4,
            fontWeight: 700, fontSize: 13, letterSpacing: '1px',
          }}>
            SHIP
          </span>
          <div>
            <div className="syne" style={{ fontSize: 18, fontWeight: 700, color: G.tx, letterSpacing: '-.3px' }}>
              Shipment / 出货管理
            </div>
            <div style={{ fontSize: 11, color: G.mu, marginTop: 1 }}>출고 관리표 · 出货管理表</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="num" style={{ fontSize: 11, color: G.mu }}>
            {loading ? '—' : `${stats.total} containers`}
          </span>
          <button
            onClick={loadData}
            disabled={loading}
            style={{
              background: 'transparent', border: `1px solid ${G.border}`,
              borderRadius: 8, cursor: loading ? 'wait' : 'pointer',
              padding: '8px 10px', color: G.mu,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 36, minHeight: 36, transition: 'border-color .15s, color .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = G.primary; e.currentTarget.style.color = G.accent }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = G.border; e.currentTarget.style.color = G.mu }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: 14, borderRadius: 10, fontSize: 13, color: G.bad, background: `${G.bad}1A`, border: `1px solid ${G.bad}40`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span><strong>오류 · 错误:</strong> {error}</span>
          <button onClick={loadData} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, border: `1px solid ${G.bad}`, background: 'transparent', color: G.bad, cursor: 'pointer', fontFamily: 'inherit' }}>
            재시도 · 重试
          </button>
        </div>
      )}

      {/* ── KPI 3-col ── */}
      <div className="ship-kpi">
        <KPICard G={G} loading={loading}
          label="선적 임박 · 临近装运"
          sublabel="ETD 7일 이내 · 7天内出货"
          count={stats.imminent} hue="#F59E0B" Icon={AlertTriangle}
          onClick={() => setFilterStage(filterStage === 'imminent' ? 'all' : 'imminent')}
        />
        <KPICard G={G} loading={loading}
          label="운송 중 · 运输中"
          sublabel="ATD 등록, ATA 미등록"
          count={stats.sea} hue="#8B5CF6" Icon={Ship}
          onClick={() => setFilterStage(filterStage === 'sea' ? 'all' : 'sea')}
        />
        <KPICard G={G} loading={loading}
          label="통관 지연 · 清关延误"
          sublabel="ETA 경과 + ATA 없음"
          count={stats.customsDelayed} hue={G.bad} Icon={AlertTriangle}
          onClick={stats.customsDelayed ? () => {
            // filter to delayed items
            setFilterStage('all')
            setSearch('')
          } : undefined}
        />
      </div>

      {/* ── Pipeline 4 stages ── */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: 18 }}>
        {G.dk && <span className="rail" />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Layers size={14} style={{ color: G.accent }} />
          <span className="syne" style={{ fontSize: 14, fontWeight: 700, color: G.tx, letterSpacing: '-.2px' }}>
            출고 파이프라인 · 出货流水
          </span>
          <span className="num" style={{ fontSize: 11, color: G.mu, marginLeft: 4 }}>
            총 {containers.length}건
          </span>
        </div>
        <div className="pipeline-scroll" style={{ display: 'flex', alignItems: 'stretch', gap: 0, overflowX: 'auto', padding: '4px 0' }}>
          {PIPELINE_STAGES.map((stage, i) => {
            const count = categorized[stage.key]?.length || 0
            const isActive = filterStage === stage.key
            return (
              <div key={stage.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div
                  onClick={() => setFilterStage(isActive ? 'all' : stage.key)}
                  style={{
                    flex: 1, minWidth: 108, padding: '16px 10px', minHeight: 130,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                    borderRadius: 12, cursor: 'pointer',
                    background: isActive
                      ? `${stage.hue}22`
                      : (G.dk ? 'rgba(245,240,232,0.025)' : 'rgba(201,168,110,0.04)'),
                    transition: 'background .15s, transform .15s',
                    border: isActive ? `1px solid ${stage.hue}` : '1px solid transparent',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = `${stage.hue}1A`
                    if (!isActive) e.currentTarget.style.borderColor = stage.hue
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = isActive
                      ? `${stage.hue}22`
                      : (G.dk ? 'rgba(245,240,232,0.025)' : 'rgba(201,168,110,0.04)')
                    if (!isActive) e.currentTarget.style.borderColor = 'transparent'
                    e.currentTarget.style.transform = ''
                  }}
                >
                  <stage.Icon size={34} strokeWidth={1.5} style={{ color: stage.hue }} />
                  <div className="num" style={{ fontSize: 26, fontWeight: 700, color: stage.hue, lineHeight: 1 }}>{count}</div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: G.tx }}>{stage.kr}</div>
                    <div style={{ fontSize: 9, color: G.mu, letterSpacing: '.3px' }}>{stage.cn}</div>
                  </div>
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <ArrowRight size={13} style={{ color: G.fa, flexShrink: 0, margin: '0 2px' }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <Search size={13} style={{ position: 'absolute', top: 11, left: 10, color: G.mu, pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Container ID · B/L No · 항구 / 搜索"
            style={{ ...selStyle, width: '100%', paddingLeft: 30 }}
          />
        </div>
        {/* Stage chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { k: 'all',       label: '전체 · 全部',  hue: null },
            ...PIPELINE_STAGES.map(s => ({ k: s.key, label: s.kr, hue: s.hue })),
          ].map(({ k, label, hue }) => {
            const active = filterStage === k
            const c = hue || G.primary
            return (
              <button key={k} onClick={() => setFilterStage(k)} className="chip"
                style={{
                  border: `1px solid ${active ? c : G.border}`,
                  background: active ? `${c}22` : 'transparent',
                  color: active ? c : G.mu,
                  fontWeight: 600, fontSize: 10,
                }}>
                {label}
              </button>
            )
          })}
        </div>
        {/* Origin */}
        {origins.length > 0 && (
          <select value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)} style={selStyle}>
            <option value="">출발항 · 出发港</option>
            {origins.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        {/* Destination */}
        {dests.length > 0 && (
          <select value={filterDest} onChange={e => setFilterDest(e.target.value)} style={selStyle}>
            <option value="">도착항 · 目的港</option>
            {dests.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      {/* ── Container card grid ── */}
      {loading ? (
        <div className="ctr-grid">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} G={G} />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Ship size={32} strokeWidth={1.2} style={{ color: G.fa, marginBottom: 12 }} />
          <div style={{ fontSize: 14, color: G.mu, fontWeight: 600 }}>
            아직 선적 데이터가 없습니다 · 暂无装运数据
          </div>
          <div style={{ fontSize: 11, color: G.fa, marginTop: 6 }}>
            {containers.length === 0
              ? 'Zoho Add_Shipment 폼에 컨테이너를 추가해 주세요'
              : '현재 필터에 해당하는 컨테이너가 없습니다'}
          </div>
          {containers.length === 0 && (
            <button
              onClick={loadData}
              style={{
                marginTop: 16, padding: '10px 20px', borderRadius: 8, fontSize: 12,
                border: `1px solid ${G.border}`, background: 'transparent',
                color: G.tx, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              새로고침 · 刷新
            </button>
          )}
        </div>
      ) : (
        <div className="ctr-grid">
          {displayed.map((c, i) => (
            <ContainerCard
              key={c.ID || c.Container_ID || i}
              G={G}
              container={c}
              today={today}
              onClick={() => setSelectedContainer(c)}
            />
          ))}
        </div>
      )}

      {selectedContainer && (
        <ContainerDetailModal
          G={G}
          container={selectedContainer}
          onClose={() => setSelectedContainer(null)}
        />
      )}
    </div>
  )
}
