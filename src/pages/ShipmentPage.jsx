import { useState, useEffect, useMemo } from 'react'
import {
  Truck, Package, CheckCircle2, AlertTriangle,
  Layers, Search, Calendar, ArrowRight,
} from 'lucide-react'
import MoDetailModal from '../components/MoDetailModal'
import ZohoImage from '../components/ZohoImage'
import { SkeletonCard } from '../components/SkeletonLoader'
import {
  getMoNumber, getMoSku, getMoFactory,
  getPlanQty, getActualQty, parseZohoDate,
} from '../utils/moHelpers'
import useShipmentData, { shipCat, getShipMonthKey } from '../hooks/useShipmentData'

// ─── Constants ────────────────────────────────────────────

const SHIP_CATS = {
  shipped:  { kr: '출고완료', cn: '已出货',  color: '#10B981', bg: 'rgba(16,185,129,0.82)' },
  imminent: { kr: '출고임박', cn: '即将出货', color: '#C9A86E', bg: 'rgba(201,168,110,0.88)' },
  delayed:  { kr: '출고지연', cn: '出货延误', color: '#EF4444', bg: 'rgba(239,68,68,0.82)' },
  ready:    { kr: '출고대기', cn: '待出货',   color: '#8B5CF6', bg: 'rgba(139,92,246,0.82)' },
  inprod:   { kr: '생산중',   cn: '生产中',   color: '#94A3B8', bg: 'rgba(100,116,139,0.72)' },
}

const SHIP_STAGES = [
  { key: 'inprod',   kr: '생산중',   cn: '生产中',  hue: '#94A3B8', Icon: Package },
  { key: 'ready',    kr: '출고대기', cn: '待出货',  hue: '#8B5CF6', Icon: CheckCircle2 },
  { key: 'imminent', kr: '출고임박', cn: '即将出货', hue: '#C9A86E', Icon: AlertTriangle },
  { key: 'delayed',  kr: '출고지연', cn: '出货延误', hue: '#EF4444', Icon: AlertTriangle },
  { key: 'shipped',  kr: '출고완료', cn: '已出货',  hue: '#10B981', Icon: Truck },
]

// ─── CircularProgress ─────────────────────────────────────

function CircularProgress({ G, value, size = 80, stroke = 9 }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value || 0))
  const dash = (pct / 100) * c
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={G.hair} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={G.primary} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={`${dash} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray .6s ease" }} />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fill={G.tx}
        fontSize={size / 4} fontWeight={700} fontFamily="'Plus Jakarta Sans',sans-serif">
        {Math.round(pct)}%
      </text>
    </svg>
  )
}

// ─── MiniKPI ──────────────────────────────────────────────

function MiniKPI({ G, label, value, dot, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 12px", borderRadius: 10, background: G.cardAlt,
        border: `1px solid ${G.hair}`, cursor: onClick ? "pointer" : "default",
        transition: "border-color .15s, transform .15s",
      }}
      onMouseEnter={onClick ? e => { e.currentTarget.style.borderColor = G.primary; e.currentTarget.style.transform = "translateY(-1px)" } : undefined}
      onMouseLeave={onClick ? e => { e.currentTarget.style.borderColor = G.hair; e.currentTarget.style.transform = "" } : undefined}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot }} />
        <span style={{ fontSize: 10, color: G.mu, fontWeight: 500, letterSpacing: ".3px" }}>{label}</span>
      </div>
      <div className="num" style={{ fontSize: 20, fontWeight: 700, color: G.tx, lineHeight: 1 }}>{value}</div>
    </div>
  )
}

// ─── ShipCard ─────────────────────────────────────────────

function ShipCard({ G, mo, onClick }) {
  const cat = shipCat(mo)
  const catInfo = SHIP_CATS[cat]
  const planQ = getPlanQty(mo)
  const actQ = getActualQty(mo)
  const chiName = typeof mo.Chi_Style_Name === 'string'
    ? mo.Chi_Style_Name : (mo.Chi_Style_Name?.zc_display_value || '')
  const buyer = typeof mo.Buyer === 'string'
    ? mo.Buyer : (mo.Buyer?.zc_display_value || mo.Buyer?.Buyer_Name || '')

  return (
    <div
      onClick={onClick}
      style={{
        background: G.card, border: `1px solid ${G.border}`, borderRadius: 12,
        overflow: "hidden", cursor: "pointer",
        transition: "transform .15s, box-shadow .15s, border-color .15s",
        display: "flex", flexDirection: "column",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = G.cardShadow; e.currentTarget.style.borderColor = catInfo.color }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; e.currentTarget.style.borderColor = G.border }}
    >
      {/* Image */}
      <div style={{ height: 260, background: G.cardAlt, position: "relative", overflow: "hidden" }}>
        <ZohoImage mo={mo} field="Style_Image" G={G} alt={getMoNumber(mo)} iconSize={28} />
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "6px 10px", background: catInfo.bg,
          fontSize: 11, textAlign: "center", fontWeight: 700,
          color: "#FFF", letterSpacing: ".3px",
          textShadow: "0 1px 3px rgba(0,0,0,0.6)",
        }}>
          {catInfo.kr} · {catInfo.cn}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "10px 12px", fontSize: 11, flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 8, color: G.mu, letterSpacing: ".5px", fontWeight: 600 }}>MO#</div>
        <div className="num" title={getMoNumber(mo)} style={{
          fontSize: 14, fontWeight: 700, color: G.accent, marginBottom: 6,
          letterSpacing: "-.2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {getMoNumber(mo)}
        </div>

        <div style={{ fontSize: 8, color: G.mu, letterSpacing: ".5px" }}>SKU</div>
        <div title={getMoSku(mo)} style={{
          fontSize: 10, color: G.tx, marginBottom: 4, lineHeight: 1.3,
          fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {getMoSku(mo)}
        </div>

        {chiName && (
          <>
            <div style={{ fontSize: 8, color: G.mu, letterSpacing: ".5px" }}>CN</div>
            <div title={chiName} style={{
              fontSize: 10, color: G.tx, marginBottom: 4, lineHeight: 1.3,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {chiName}
            </div>
          </>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 8px", fontSize: 9, color: G.mu, marginTop: 4 }}>
          <span>공장</span>
          <span title={getMoFactory(mo)} style={{
            color: G.tx, textAlign: "right",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {getMoFactory(mo)}
          </span>
          {buyer && (
            <>
              <span>바이어</span>
              <span title={buyer} style={{
                color: G.tx, textAlign: "right",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {buyer}
              </span>
            </>
          )}
        </div>

        {/* Qty rows */}
        <div style={{
          marginTop: 8, padding: "5px 8px",
          background: G.dk ? "rgba(147,197,253,0.12)" : "#EEF2FF",
          borderRadius: 4, display: "flex", justifyContent: "space-between", whiteSpace: "nowrap",
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: G.dk ? "#93C5FD" : "#4338CA", letterSpacing: ".5px" }}>PLAN</span>
          <span className="num" style={{ fontSize: 11, fontWeight: 700, color: G.tx }}>{planQ.toLocaleString()} pcs</span>
        </div>
        <div style={{
          marginTop: 3, padding: "5px 8px",
          background: G.dk ? "rgba(110,231,183,0.12)" : "#F0FDF4",
          borderRadius: 4, display: "flex", justifyContent: "space-between", whiteSpace: "nowrap",
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: G.dk ? "#6EE7B7" : "#16A34A", letterSpacing: ".5px" }}>ACT</span>
          <span className="num" style={{ fontSize: 11, fontWeight: 700, color: G.tx }}>{actQ.toLocaleString()} pcs</span>
        </div>

        {/* Dates */}
        <div style={{ marginTop: 8, fontSize: 9, color: G.mu, lineHeight: 1.7 }}>
          {mo.Expected_Delivery && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ whiteSpace: "nowrap" }}>계획출고</span>
              <span className="num" style={{
                color: cat === 'delayed' ? G.bad : G.tx,
                fontWeight: cat === 'delayed' ? 700 : 400,
                whiteSpace: "nowrap",
              }}>
                {mo.Expected_Delivery}
              </span>
            </div>
          )}
          {mo.Ship_Date && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ whiteSpace: "nowrap" }}>실제출고</span>
              <span className="num" style={{ color: G.ok, fontWeight: 600, whiteSpace: "nowrap" }}>
                {mo.Ship_Date}
              </span>
            </div>
          )}
          {!mo.Ship_Date && !mo.Expected_Delivery && (
            <div style={{ color: G.fa, fontSize: 9 }}>출고일 미정 · 未定</div>
          )}
        </div>

        {/* Status badge */}
        <div style={{
          marginTop: 6, padding: "4px 8px", borderRadius: 4,
          background: SHIP_CATS[cat].bg.replace(/[\d.]+\)$/, "0.15)"),
          fontSize: 10, textAlign: "center",
          color: catInfo.color, fontWeight: 700,
          border: `1px solid ${catInfo.color}40`,
        }}>
          {catInfo.kr}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────

export default function ShipmentPage({ G }) {
  const { moList, loading, error, monthKeys, currentMonthKey } = useShipmentData()

  const [selectedMonth, setSelectedMonth] = useState(null)
  const [filterCat, setFilterCat] = useState('all')
  const [filterFactory, setFilterFactory] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('date_asc')
  const [selectedMo, setSelectedMo] = useState(null)

  // Default to current month (or latest available)
  useEffect(() => {
    if (selectedMonth === null && monthKeys.length) {
      setSelectedMonth(monthKeys.includes(currentMonthKey) ? currentMonthKey : monthKeys[0])
    }
  }, [monthKeys, currentMonthKey, selectedMonth])

  const monthMOs = useMemo(() => {
    if (!selectedMonth) return moList
    return moList.filter(m => getShipMonthKey(m) === selectedMonth)
  }, [moList, selectedMonth])

  const factories = useMemo(() =>
    [...new Set(monthMOs.map(getMoFactory).filter(f => f && f !== '—'))]
  , [monthMOs])

  const categorized = useMemo(() => {
    const groups = { shipped: [], imminent: [], delayed: [], ready: [], inprod: [] }
    monthMOs.forEach(mo => {
      const c = shipCat(mo)
      if (groups[c]) groups[c].push(mo)
    })
    return groups
  }, [monthMOs])

  const stats = useMemo(() => {
    const total = monthMOs.length
    const shipped = categorized.shipped.length
    const delayed = categorized.delayed.length
    const imminent = categorized.imminent.length
    const ready = categorized.ready.length
    const planTotal = monthMOs.reduce((s, m) => s + getPlanQty(m), 0)
    const actTotal = monthMOs.reduce((s, m) => s + getActualQty(m), 0)
    const shipPct = total ? Math.min(100, (shipped / total) * 100) : 0
    return { total, shipped, delayed, imminent, ready, planTotal, actTotal, shipPct }
  }, [monthMOs, categorized])

  const stageCounts = useMemo(() => {
    const c = {}
    SHIP_STAGES.forEach(s => { c[s.key] = categorized[s.key]?.length || 0 })
    return c
  }, [categorized])

  const displayedMOs = useMemo(() => {
    let list = filterCat === 'all' ? monthMOs : (categorized[filterCat] || [])
    if (filterFactory) list = list.filter(m => getMoFactory(m) === filterFactory)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(m => {
        const blob = `${getMoNumber(m)} ${getMoSku(m)} ${getMoFactory(m)} ${m.Eng_Style_Name || ''} ${m.Chi_Style_Name || ''}`.toLowerCase()
        return blob.includes(q)
      })
    }
    return [...list].sort((a, b) => {
      const da = parseZohoDate(a.Expected_Delivery)
      const db = parseZohoDate(b.Expected_Delivery)
      if (!da && !db) return 0
      if (!da) return 1
      if (!db) return -1
      return sortBy === 'date_asc' ? da - db : db - da
    })
  }, [monthMOs, categorized, filterCat, filterFactory, search, sortBy])

  const monthLabel = selectedMonth || 'All'
  const selStyle = {
    padding: "8px 12px", borderRadius: 8, fontSize: 12,
    border: `1px solid ${G.border}`, background: G.card,
    color: G.tx, outline: "none", fontFamily: "inherit",
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>

      {/* ── Header ── */}
      <div className="card" style={{ padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        {G.dk && <span className="rail" />}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="syne" style={{
            background: '#8B5CF6', color: "#FFF",
            padding: "5px 12px", borderRadius: 4,
            fontWeight: 700, fontSize: 13, letterSpacing: "1px",
          }}>
            SHIP
          </span>
          <div>
            <div className="syne" style={{ fontSize: 18, fontWeight: 700, color: G.tx, letterSpacing: "-.3px" }}>Shipment</div>
            <div style={{ fontSize: 11, color: G.mu, marginTop: 1 }}>출고현황표 · 出货状况表</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: G.mu }}>
          <Truck size={14} style={{ color: '#8B5CF6' }} />
          <span className="num">{loading ? "—" : `${stats.total} MO`}</span>
        </div>
      </div>

      {/* ── Month tabs ── */}
      {monthKeys.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
          {monthKeys.slice(0, 6).map(k => {
            const active = k === selectedMonth
            return (
              <button
                key={k}
                onClick={() => setSelectedMonth(k)}
                className="chip"
                style={{
                  border: `1px solid ${active ? G.primary : G.border}`,
                  background: active ? (G.dk ? "rgba(232,200,152,0.12)" : "rgba(201,168,110,0.12)") : "transparent",
                  color: active ? G.accent : G.mu, fontWeight: 600,
                }}
              >
                {k}
              </button>
            )
          })}
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 16, padding: 14, borderRadius: 10, fontSize: 13, color: G.bad, background: `${G.bad}1A`, border: `1px solid ${G.bad}40` }}>
          <strong>오류 · 错误:</strong> {error}
        </div>
      )}

      {/* ── KPI Row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr", gap: 16, marginBottom: 18 }} className="kgr">

        {/* Summary */}
        <div className="card" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {G.dk && <span className="rail" />}
          <div style={{ fontSize: 11, color: G.mu, letterSpacing: "1px", fontWeight: 600, marginBottom: 8 }}>SUMMARY</div>
          <div className="syne" style={{ fontSize: 22, fontWeight: 700, color: G.tx, letterSpacing: "-.3px", lineHeight: 1.1 }}>{monthLabel}</div>
          <div style={{ fontSize: 11, color: G.mu, marginTop: 3 }}>월별 출고 · 月度出货</div>
          <div style={{ marginTop: 14, fontSize: 11, color: G.mu, lineHeight: 1.7 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>총 MO</span>
              <span className="num" style={{ color: G.tx, fontWeight: 600 }}>{loading ? "—" : stats.total.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>출고완료</span>
              <span className="num" style={{ color: G.ok, fontWeight: 600 }}>{loading ? "—" : stats.shipped.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>출고임박</span>
              <span className="num" style={{ color: '#C9A86E', fontWeight: 600 }}>{loading ? "—" : stats.imminent.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>지연</span>
              <span className="num" style={{ color: G.bad, fontWeight: 600 }}>{loading ? "—" : stats.delayed.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Center KPI */}
        <div className="card" style={{ padding: "20px 24px" }}>
          {G.dk && <span className="rail" />}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Calendar size={14} style={{ color: G.accent }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: G.tx }}>{monthLabel} 출고 KPI · 出货 KPI</span>
          </div>
          {loading ? (
            <SkeletonCard G={G} />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <CircularProgress G={G} value={stats.shipPct} size={84} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flex: 1 }}>
                <MiniKPI G={G} label="총 MO / 总订单" value={stats.total} dot="#93C5FD"
                  onClick={() => setFilterCat('all')} />
                <MiniKPI G={G} label="출고완료 / 已出货" value={stats.shipped} dot="#10B981"
                  onClick={() => setFilterCat('shipped')} />
                <MiniKPI G={G} label="출고임박 / 即将出货" value={stats.imminent} dot="#C9A86E"
                  onClick={() => setFilterCat('imminent')} />
                <MiniKPI G={G} label="출고지연 / 出货延误" value={stats.delayed} dot="#EF4444"
                  onClick={() => setFilterCat('delayed')} />
              </div>
            </div>
          )}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${G.hair}`, display: "flex", gap: 18, fontSize: 11, color: G.mu, flexWrap: "wrap" }}>
            <span><b style={{ color: "#93C5FD" }}>PLAN</b> <span className="num" style={{ color: G.tx, fontWeight: 600 }}>{stats.planTotal.toLocaleString()}</span> pcs</span>
            <span><b style={{ color: "#10B981" }}>ACT</b> <span className="num" style={{ color: G.tx, fontWeight: 600 }}>{stats.actTotal.toLocaleString()}</span> pcs</span>
          </div>
        </div>

        {/* Delay alert */}
        <div
          className="card"
          onClick={() => stats.delayed && setFilterCat('delayed')}
          style={{
            padding: "20px 22px",
            background: G.dk ? "rgba(161,78,58,0.12)" : "#FDF0EE",
            borderColor: G.bad,
            cursor: stats.delayed ? "pointer" : "default",
            transition: "transform .15s",
          }}
          onMouseEnter={e => { if (stats.delayed) e.currentTarget.style.transform = "translateY(-1px)" }}
          onMouseLeave={e => { e.currentTarget.style.transform = "" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <AlertTriangle size={14} style={{ color: G.bad }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: G.bad, letterSpacing: ".3px" }}>출고 지연 · 出货延误</span>
          </div>
          <div className="num syne" style={{ fontSize: 36, fontWeight: 700, color: G.bad, textAlign: "center", lineHeight: 1 }}>
            {loading ? "—" : stats.delayed}
          </div>
          <div style={{ textAlign: "center", fontSize: 10, color: G.mu, marginBottom: 10, letterSpacing: ".5px" }}>건 지연 / 件延误</div>
          <div style={{ maxHeight: 100, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
            {categorized.delayed.slice(0, 4).map(mo => (
              <div
                key={mo.ID || getMoNumber(mo)}
                onClick={e => { e.stopPropagation(); setSelectedMo({ id: mo.ID, row: mo }) }}
                style={{
                  padding: "5px 9px", background: G.surf, borderRadius: 5, fontSize: 11,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  cursor: "pointer", border: `1px solid ${G.hair}`,
                }}
              >
                <span className="num" style={{ fontWeight: 600, color: G.accent }}>{getMoNumber(mo)}</span>
                <span style={{ background: G.bad, color: "#FFF", padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600 }}>지연</span>
              </div>
            ))}
            {!loading && stats.delayed === 0 && (
              <div style={{ padding: 8, fontSize: 11, color: G.mu, textAlign: "center" }}>지연 없음 ✓</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Shipment Pipeline ── */}
      <div className="card" style={{ padding: "20px 24px", marginBottom: 18 }}>
        {G.dk && <span className="rail" />}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Layers size={14} style={{ color: G.accent }} />
          <span className="syne" style={{ fontSize: 14, fontWeight: 700, color: G.tx, letterSpacing: "-.2px" }}>
            출고 파이프라인 · 出货流水
          </span>
          <span className="num" style={{ fontSize: 11, color: G.mu, marginLeft: 4 }}>총 {monthMOs.length}건</span>
        </div>
        <div className="pipeline-scroll" style={{ display: "flex", alignItems: "stretch", gap: 0, overflowX: "auto", padding: "4px 0" }}>
          {SHIP_STAGES.map((stage, i) => {
            const count = stageCounts[stage.key] || 0
            const isActive = filterCat === stage.key
            return (
              <div key={stage.key} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <div
                  onClick={() => setFilterCat(isActive ? 'all' : stage.key)}
                  style={{
                    flex: 1, minWidth: 108, padding: "16px 10px", minHeight: 130,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
                    borderRadius: 12, cursor: "pointer",
                    background: isActive
                      ? `${stage.hue}22`
                      : (G.dk ? "rgba(245,240,232,0.025)" : "rgba(201,168,110,0.04)"),
                    transition: "background .15s, transform .15s",
                    border: isActive ? `1px solid ${stage.hue}` : "1px solid transparent",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = `${stage.hue}1A`
                    if (!isActive) e.currentTarget.style.borderColor = stage.hue
                    e.currentTarget.style.transform = "translateY(-2px)"
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = isActive
                      ? `${stage.hue}22`
                      : (G.dk ? "rgba(245,240,232,0.025)" : "rgba(201,168,110,0.04)")
                    if (!isActive) e.currentTarget.style.borderColor = "transparent"
                    e.currentTarget.style.transform = ""
                  }}
                >
                  <stage.Icon size={34} strokeWidth={1.5} style={{ color: stage.hue }} />
                  <div className="num" style={{ fontSize: 26, fontWeight: 700, color: stage.hue, lineHeight: 1 }}>{count}</div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: G.tx }}>{stage.kr}</div>
                    <div style={{ fontSize: 9, color: G.mu, letterSpacing: ".3px" }}>{stage.cn}</div>
                  </div>
                </div>
                {i < SHIP_STAGES.length - 1 && (
                  <ArrowRight size={13} style={{ color: G.fa, flexShrink: 0, margin: "0 2px" }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160 }}>
          <Search size={13} style={{ position: "absolute", top: 11, left: 10, color: G.mu, pointerEvents: "none" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="MO# · SKU · 공장 / 搜索"
            style={{ ...selStyle, width: "100%", paddingLeft: 30 }}
          />
        </div>

        {/* Status filter chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { k: 'all',      label: '전체 · 全部',  color: null,      count: null },
            { k: 'shipped',  label: '출고완료',      color: '#10B981', count: stats.shipped },
            { k: 'imminent', label: '출고임박',      color: '#C9A86E', count: stats.imminent },
            { k: 'delayed',  label: '출고지연',      color: '#EF4444', count: stats.delayed },
            { k: 'ready',    label: '출고대기',      color: '#8B5CF6', count: stats.ready },
          ].map(({ k, label, color, count }) => {
            const active = filterCat === k
            const c = color || G.primary
            return (
              <button
                key={k}
                onClick={() => setFilterCat(k)}
                className="chip"
                style={{
                  border: `1px solid ${active ? c : G.border}`,
                  background: active ? `${c}22` : "transparent",
                  color: active ? c : G.mu,
                  fontWeight: 600, fontSize: 10,
                }}
              >
                {label}
                {count != null && (
                  <span className="num" style={{ marginLeft: 5, opacity: .75 }}>{count}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Factory filter */}
        {factories.length > 0 && (
          <select value={filterFactory} onChange={e => setFilterFactory(e.target.value)} style={selStyle}>
            <option value="">공장 · 工厂 전체</option>
            {factories.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        )}

        {/* Sort */}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={selStyle}>
          <option value="date_asc">출고일 빠른순</option>
          <option value="date_desc">출고일 늦은순</option>
        </select>
      </div>

      {/* ── Card grid ── */}
      {loading ? (
        <div className="schedule-scroll" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ minWidth: 220, flexShrink: 0 }}>
              <SkeletonCard G={G} />
            </div>
          ))}
        </div>
      ) : displayedMOs.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <Truck size={32} strokeWidth={1.2} style={{ color: G.fa, marginBottom: 12 }} />
          <div style={{ fontSize: 14, color: G.mu, fontWeight: 600 }}>출고 데이터 없음 · 暂无出货数据</div>
          <div style={{ fontSize: 11, color: G.fa, marginTop: 6 }}>선택한 기간에 해당 MO가 없습니다</div>
        </div>
      ) : (
        <div className="schedule-scroll" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
          {displayedMOs.map(mo => (
            <div key={mo.ID || getMoNumber(mo)} style={{ minWidth: 220, flexShrink: 0 }}>
              <ShipCard G={G} mo={mo} onClick={() => setSelectedMo({ id: mo.ID, row: mo })} />
            </div>
          ))}
        </div>
      )}

      {selectedMo && (
        <MoDetailModal G={G} mo={selectedMo.row} moId={selectedMo.id} onClose={() => setSelectedMo(null)} />
      )}
    </div>
  )
}
