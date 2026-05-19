import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import {
  Video, ChevronRight, Search, AlertTriangle, Calendar, Package, Scissors,
  Factory, Truck, CheckCircle2, Clock, Layers,
} from 'lucide-react'
import { fetchMoList } from '../api/client'
import MoDetailModal from '../components/MoDetailModal'
import PipelineStageModal from '../components/PipelineStageModal'
import ZohoImage from '../components/ZohoImage'
import { SkeletonCard } from '../components/SkeletonLoader'
import {
  getMoNumber, getMoSku, getMoFactory,
  getPlanQty, getActualQty, getEndDate, getProgress,
  isDelayed, getMonthKey, parseZohoDate,
} from '../utils/moHelpers'

const SOFT_PALETTE = ["#C4B5FD", "#FCA5A5", "#6EE7B7", "#93C5FD", "#FCD34D", "#F9A8D4", "#A5F3FC", "#D9F99D"]

const STAGE_HUES = {
  Fab: "#FCD34D",
  Cut: "#FDBA74",
  Sew: "#93C5FD",
  Pack: "#6EE7B7",
  Ship: "#A5F3FC",
}

const STAGES = [
  { kr: "미시작", cn: "未开始", hue: "#A8A29E", Icon: Clock },
  { kr: "원단",   cn: "面料",   hue: "#93C5FD", Icon: Package },
  { kr: "재단",   cn: "裁剪",   hue: "#C9A86E", Icon: Scissors },
  { kr: "재봉",   cn: "缝制",   hue: "#F9A8D4", Icon: Layers },
  { kr: "포장",   cn: "包装",   hue: "#FDBA74", Icon: Package },
  { kr: "완료",   cn: "完成",   hue: "#FCD34D", Icon: CheckCircle2 },
  { kr: "출고",   cn: "出货",   hue: "#86EFAC", Icon: Truck },
]

function Rail({ G }) { return G.dk ? <span className="rail" /> : null }

// Map a MO record to a pipeline stage key (kr label)
function moStage(mo) {
  const ps = String(mo.Production_Status || '').toLowerCase()
  const os = String(mo.Order_Status || '').toLowerCase()
  const ds = String(mo.Delivery_Status || '').toLowerCase()
  if (/ship|出货|出货完|delivered/.test(ds) || /ship|出货|出货完|delivered/.test(ps)) return "출고"
  if (/complet|완료|done|finish|finished/.test(ps) || /complet|完成/.test(os)) return "완료"
  if (/pack|包装|packing/.test(ps)) return "포장"
  if (/sew|缝|봉제|stitch|sewing/.test(ps)) return "재봉"
  if (/cut|裁|재단/.test(ps)) return "재단"
  if (/fab|면료|원단|fabric/.test(ps)) return "원단"
  if (!ps) return "미시작"
  return "재봉" // default mid-flight
}

function statusOverlayColor(mo, G) {
  const stage = moStage(mo)
  const s = STAGES.find(x => x.kr === stage)
  const base = s?.hue || G.mu
  return {
    bg: G.dk ? `${base}33` : `${base}66`,
    color: G.dk ? "#FFF" : "#1A1714",
    stage,
  }
}

// ──────────────────────────────────────────────────────────
// Circular progress
// ──────────────────────────────────────────────────────────
function CircularProgress({ G, value, size = 80, stroke = 9 }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value || 0))
  const dash = (pct / 100) * c
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={G.hair} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={G.primary} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray .6s ease" }}
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fill={G.tx}
        fontSize={size / 4} fontWeight={700} fontFamily="'Plus Jakarta Sans',sans-serif">
        {Math.round(pct)}%
      </text>
    </svg>
  )
}

function MiniKPI({ G, label, value, dot }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 10, background: G.cardAlt, border: `1px solid ${G.hair}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot }} />
        <span style={{ fontSize: 10, color: G.mu, fontWeight: 500, letterSpacing: ".3px" }}>{label}</span>
      </div>
      <div className="num" style={{ fontSize: 20, fontWeight: 700, color: G.tx, lineHeight: 1 }}>{value}</div>
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      {label}
    </span>
  )
}

// ──────────────────────────────────────────────────────────
// Timeline gantt row
// ──────────────────────────────────────────────────────────
function TimelineRow({ G, mo, monthStart, monthEnd, todayPct, onClickMo }) {
  const barFor = (start, end) => {
    if (!start || !end) return null
    const s = Math.max(0, Math.min(1, (start - monthStart) / (monthEnd - monthStart)))
    const e = Math.max(0, Math.min(1, (end - monthStart) / (monthEnd - monthStart)))
    if (e <= s) return null
    return { left: `${s * 100}%`, width: `${(e - s) * 100}%` }
  }

  const orderD = parseZohoDate(mo.Order_Date)
  const cutS = parseZohoDate(mo.Cutting_Start_Date) || orderD
  const cutE = parseZohoDate(mo.Cutting_End_Date) || cutS
  const sewS = parseZohoDate(mo.Sewing_Start_Date) || cutE
  const sewE = parseZohoDate(mo.Sewing_End_Date) || sewS
  const packS = parseZohoDate(mo.Packing_Start_Date) || sewE
  const expD = parseZohoDate(mo.Expected_Delivery) || packS
  const shipD = parseZohoDate(mo.Ship_Date) || expD

  const bars = [
    { phase: "Fab", range: barFor(orderD, cutS) },
    { phase: "Cut", range: barFor(cutS, cutE) },
    { phase: "Sew", range: barFor(sewS, sewE) },
    { phase: "Pack", range: barFor(packS, expD) },
    { phase: "Ship", range: barFor(expD, shipD) },
  ].filter(b => b.range)

  const progress = getProgress(mo)
  const actualWidth = bars.length ? `${progress}%` : "0%"

  return (
    <div style={{ display: "flex", alignItems: "center", borderBottom: `1px solid ${G.hair}`, minHeight: 52 }}>
      <div
        onClick={() => onClickMo && onClickMo(mo)}
        title={`${getMoNumber(mo)} — 클릭하여 상세 보기 / 点击查看详情`}
        style={{
          width: 220, minWidth: 220, display: "flex", alignItems: "center", gap: 8,
          padding: "8px 10px 8px 4px", cursor: "pointer", borderRadius: 6,
          transition: "background .15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = G.nh }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent" }}
      >
        <div style={{ width: 32, height: 40, borderRadius: 4, background: G.cardAlt, overflow: "hidden", flexShrink: 0, border: `1px solid ${G.hair}` }}>
          <ZohoImage mo={mo} field="Style_Image" report="All_MO" G={G} iconSize={14} placeholderText="" />
        </div>
        <div style={{ overflow: "hidden", flex: 1 }}>
          <div className="num" style={{ fontSize: 11, fontWeight: 700, color: G.accent, lineHeight: 1.2 }}>{getMoNumber(mo)}</div>
          <div style={{ fontSize: 10, color: G.mu, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{getMoSku(mo)}</div>
          <div style={{ fontSize: 9, color: G.fa, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{getMoFactory(mo)}</div>
        </div>
        <div className="num" style={{ fontSize: 10, color: G.mu, textAlign: "right" }}>{getPlanQty(mo).toLocaleString()}</div>
      </div>

      <div style={{ flex: 1, position: "relative", height: 36 }}>
        {bars.map((b, bi) => (
          <div key={`p-${bi}`} title={`${b.phase} (Plan)`} style={{
            position: "absolute", top: 4, height: 10, ...b.range,
            background: `repeating-linear-gradient(45deg, ${STAGE_HUES[b.phase]}, ${STAGE_HUES[b.phase]} 4px, transparent 4px, transparent 8px)`,
            border: `1px dashed ${STAGE_HUES[b.phase]}`, borderRadius: 3,
          }} />
        ))}
        {bars.length > 0 && (
          <div style={{ position: "absolute", bottom: 4, left: bars[0].range.left, width: actualWidth, height: 10, background: STAGE_HUES[bars[0].phase], borderRadius: 3 }} />
        )}
        {todayPct > 0 && todayPct < 1 && (
          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${todayPct * 100}%`, width: 1, background: "#EF4444" }} />
        )}
      </div>
    </div>
  )
}

function TimelineGrid({ G, mos, monthStart, monthEnd, onClickMo }) {
  const totalDays = Math.ceil((monthEnd - monthStart) / 86400000)
  const today = new Date()
  const todayPct = Math.max(0, Math.min(1, (today - monthStart) / (monthEnd - monthStart)))

  const ticks = []
  for (let d = 0; d <= totalDays; d += 7) {
    const dt = new Date(monthStart.getTime() + d * 86400000)
    ticks.push({ pct: d / totalDays, label: `${dt.getMonth() + 1}/${dt.getDate()}` })
  }

  return (
    <div>
      <div style={{ position: "relative", height: 22, marginLeft: 220, marginBottom: 8, borderBottom: `1px solid ${G.hair}` }}>
        {ticks.map((t, i) => (
          <div key={i} style={{ position: "absolute", left: `${t.pct * 100}%`, fontSize: 9, color: G.mu, transform: "translateX(-50%)" }}>{t.label}</div>
        ))}
      </div>

      <div style={{ position: "relative" }}>
        {mos.slice(0, 20).map((mo, i) => (
          <TimelineRow key={mo.ID || i} G={G} mo={mo} monthStart={monthStart} monthEnd={monthEnd} todayPct={todayPct} onClickMo={onClickMo} />
        ))}
      </div>

      <div style={{ marginTop: 10, fontSize: 10, color: G.mu, display: "flex", justifyContent: "space-between", alignItems: "center", marginLeft: 220 }}>
        <span>P = Plan (dashed) · A = Actual (solid)</span>
        <span><span style={{ color: "#EF4444", fontWeight: 600 }}>● Today</span> {today.getFullYear()}-{String(today.getMonth() + 1).padStart(2, '0')}-{String(today.getDate()).padStart(2, '0')}</span>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// MOCard for grid
// ──────────────────────────────────────────────────────────
function MOCard({ G, mo, onClick }) {
  const overlay = statusOverlayColor(mo, G)
  const planQ = getPlanQty(mo)
  const actQ = getActualQty(mo)
  const chiName = typeof mo.Chi_Style_Name === 'string' ? mo.Chi_Style_Name : (mo.Chi_Style_Name?.zc_display_value || '')
  const engName = typeof mo.Eng_Style_Name === 'string' ? mo.Eng_Style_Name : (mo.Eng_Style_Name?.zc_display_value || '')
  const category = typeof mo.Category === 'string' ? mo.Category : (mo.Category?.zc_display_value || mo.Category?.Category || '')
  const material = typeof mo.Material_Type === 'string' ? mo.Material_Type : (mo.Material_Type?.zc_display_value || '')

  return (
    <div onClick={onClick} style={{
      background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, overflow: "hidden",
      cursor: "pointer", transition: "transform .15s, box-shadow .15s, border-color .15s",
      display: "flex", flexDirection: "column",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = G.cardShadow; e.currentTarget.style.borderColor = G.primary }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; e.currentTarget.style.borderColor = G.border }}
    >
      {/* Image — fixed height, top-anchored crop so model face/torso stays visible */}
      <div style={{ height: 276, background: G.cardAlt, position: "relative", overflow: "hidden" }}>
        <ZohoImage mo={mo} field="Style_Image" G={G} alt={getMoNumber(mo)} iconSize={28} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "5px 10px", background: overlay.bg, color: overlay.color, fontSize: 11, textAlign: "center", fontWeight: 600, letterSpacing: ".3px" }}>
          {overlay.stage}
        </div>
      </div>

      {/* Body — every row is single-line + ellipsis. title attr exposes full text on hover. */}
      <div style={{ padding: "10px 12px", fontSize: 11, flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 8, color: G.mu, letterSpacing: ".5px", fontWeight: 600 }}>MO#</div>
        <div className="num" title={getMoNumber(mo)} style={{ fontSize: 14, fontWeight: 700, color: G.accent, marginBottom: 6, letterSpacing: "-.2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {getMoNumber(mo)}
        </div>

        <div style={{ fontSize: 8, color: G.mu, letterSpacing: ".5px" }}>SKU</div>
        <div title={getMoSku(mo)} style={{ fontSize: 10, color: G.tx, marginBottom: 4, lineHeight: 1.3, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{getMoSku(mo)}</div>

        {engName && (
          <>
            <div style={{ fontSize: 8, color: G.mu, letterSpacing: ".5px" }}>EN</div>
            <div title={engName} style={{ fontSize: 10, color: G.tx, marginBottom: 4, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{engName}</div>
          </>
        )}
        {chiName && (
          <>
            <div style={{ fontSize: 8, color: G.mu, letterSpacing: ".5px" }}>CN</div>
            <div title={chiName} style={{ fontSize: 10, color: G.tx, marginBottom: 6, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{chiName}</div>
          </>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 8px", fontSize: 9, color: G.mu, marginTop: 6 }}>
          {category && <>
            <span style={{ whiteSpace: "nowrap" }}>분류</span>
            <span title={category} style={{ color: G.tx, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{category}</span>
          </>}
          <span style={{ whiteSpace: "nowrap" }}>공장</span>
          <span title={getMoFactory(mo)} style={{ color: G.tx, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{getMoFactory(mo)}</span>
          {material && <>
            <span style={{ whiteSpace: "nowrap" }}>원단</span>
            <span title={material} style={{ color: G.tx, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{material}</span>
          </>}
        </div>

        {/* PLAN/ACT */}
        <div style={{ marginTop: 8, padding: "5px 8px", background: G.dk ? "rgba(147,197,253,0.12)" : "#EEF2FF", borderRadius: 4, display: "flex", justifyContent: "space-between", whiteSpace: "nowrap", overflow: "hidden" }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: G.dk ? "#93C5FD" : "#4338CA", letterSpacing: ".5px" }}>PLAN</span>
          <span className="num" style={{ fontSize: 11, fontWeight: 700, color: G.tx }}>{planQ.toLocaleString()} pcs</span>
        </div>
        <div style={{ marginTop: 3, padding: "5px 8px", background: G.dk ? "rgba(110,231,183,0.12)" : "#F0FDF4", borderRadius: 4, display: "flex", justifyContent: "space-between", whiteSpace: "nowrap", overflow: "hidden" }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: G.dk ? "#6EE7B7" : "#16A34A", letterSpacing: ".5px" }}>ACT</span>
          <span className="num" style={{ fontSize: 11, fontWeight: 700, color: G.tx }}>{actQ.toLocaleString()} pcs</span>
        </div>

        {mo.Order_Status && (
          <div title={mo.Order_Status} style={{ marginTop: 6, padding: "3px 8px", background: G.dk ? "rgba(134,239,172,0.15)" : "#D1FAE5", borderRadius: 4, fontSize: 10, textAlign: "center", color: G.dk ? "#86EFAC" : "#065F46", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {mo.Order_Status}
          </div>
        )}

        <div style={{ marginTop: 8, fontSize: 9, color: G.mu, lineHeight: 1.5 }}>
          {mo.Expected_Delivery && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ whiteSpace: "nowrap" }}>예상</span>
              <span className="num" style={{ color: G.tx, whiteSpace: "nowrap" }}>{mo.Expected_Delivery}</span>
            </div>
          )}
          {mo.Ship_Date && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ whiteSpace: "nowrap" }}>출하</span>
              <span className="num" style={{ color: G.tx, whiteSpace: "nowrap" }}>{mo.Ship_Date}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Filter row (search + 4 selects)
// ──────────────────────────────────────────────────────────
function FilterRow({ G, search, setSearch, category, setCategory, factory, setFactory,
  prodStatus, setProdStatus, orderStatus, setOrderStatus,
  categories, factories, prodStatuses, orderStatuses }) {
  const inputStyle = {
    padding: "8px 12px", borderRadius: 8, fontSize: 12, border: `1px solid ${G.border}`,
    background: G.card, color: G.tx, outline: "none", fontFamily: "inherit",
  }
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
        <Search size={13} style={{ position: "absolute", top: 11, left: 10, color: G.mu, pointerEvents: "none" }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="MO# · SKU · 스타일 · 공장 / 搜索"
          style={{ ...inputStyle, width: "100%", paddingLeft: 30 }}
        />
      </div>
      <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
        <option value="">분류 / 分类</option>
        {categories.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={factory} onChange={e => setFactory(e.target.value)} style={inputStyle}>
        <option value="">공장 / 工厂</option>
        {factories.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
      <select value={prodStatus} onChange={e => setProdStatus(e.target.value)} style={inputStyle}>
        <option value="">생산 / 生产</option>
        {prodStatuses.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <select value={orderStatus} onChange={e => setOrderStatus(e.target.value)} style={inputStyle}>
        <option value="">오더 / 订单</option>
        {orderStatuses.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Main MoView
// ──────────────────────────────────────────────────────────
export default function MoView({ G }) {
  const [moList, setMoList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedMo, setSelectedMo] = useState(null)
  const [selectedStage, setSelectedStage] = useState(null)
  const [factoryView, setFactoryView] = useState(false)

  // shared filters across timeline + grid
  const [search, setSearch] = useState("")
  const [filtCategory, setFiltCategory] = useState("")
  const [filtFactory, setFiltFactory] = useState("")
  const [filtProd, setFiltProd] = useState("")
  const [filtOrder, setFiltOrder] = useState("")

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchMoList({ perPage: 200 })
      .then((data) => {
        const rows = data?.data || data?.records || data?.result || []
        setMoList(rows)
      })
      .catch((err) => {
        console.error('[MoView]', err)
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadData()
    window.addEventListener('iku:refresh', loadData)
    return () => window.removeEventListener('iku:refresh', loadData)
  }, [loadData])

  // Determine current month key (defaults to current; falls back to latest data month)
  const currentMonthKey = useMemo(() => {
    const now = new Date()
    return `${String(now.getFullYear()).slice(-2)}.${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const monthKeys = useMemo(() => {
    return [...new Set(moList.map(getMonthKey).filter(Boolean))].sort().reverse()
  }, [moList])

  const [selectedMonth, setSelectedMonth] = useState(null)
  useEffect(() => {
    if (selectedMonth === null && monthKeys.length) {
      setSelectedMonth(monthKeys.includes(currentMonthKey) ? currentMonthKey : monthKeys[0])
    }
  }, [monthKeys, currentMonthKey, selectedMonth])

  const monthMOs = useMemo(() => {
    if (!selectedMonth) return moList
    return moList.filter(m => getMonthKey(m) === selectedMonth)
  }, [moList, selectedMonth])

  // Filter options derived from month MOs
  const categories = useMemo(() => [...new Set(monthMOs.map(m => typeof m.Category === 'string' ? m.Category : m.Category?.zc_display_value).filter(Boolean))], [monthMOs])
  const factories = useMemo(() => [...new Set(monthMOs.map(getMoFactory).filter(f => f && f !== '—'))], [monthMOs])
  const prodStatuses = useMemo(() => [...new Set(monthMOs.map(m => m.Production_Status).filter(Boolean))], [monthMOs])
  const orderStatuses = useMemo(() => [...new Set(monthMOs.map(m => m.Order_Status).filter(Boolean))], [monthMOs])

  // Apply filters + stage filter
  const filteredMOs = useMemo(() => {
    return monthMOs.filter(m => {
      if (search) {
        const s = search.toLowerCase()
        const blob = `${getMoNumber(m)} ${getMoSku(m)} ${getMoFactory(m)} ${m.Eng_Style_Name || ''} ${m.Chi_Style_Name || ''}`.toLowerCase()
        if (!blob.includes(s)) return false
      }
      if (filtCategory) {
        const cat = typeof m.Category === 'string' ? m.Category : m.Category?.zc_display_value
        if (cat !== filtCategory) return false
      }
      if (filtFactory && getMoFactory(m) !== filtFactory) return false
      if (filtProd && m.Production_Status !== filtProd) return false
      if (filtOrder && m.Order_Status !== filtOrder) return false
      return true
    })
  }, [monthMOs, search, filtCategory, filtFactory, filtProd, filtOrder])

  // KPIs from monthMOs (or whole list when month not selected)
  const stats = useMemo(() => {
    const list = monthMOs
    const total = list.length
    const inProgress = list.filter(m => {
      const s = m.Production_Status || ''
      return s && !/complet|完成|finish/i.test(s) && !isDelayed(m)
    }).length
    const shipped = list.filter(m => /ship|出货|delivered/i.test(String(m.Delivery_Status || m.Production_Status || ''))).length
    const delayed = list.filter(isDelayed)
    const planTotal = list.reduce((s, m) => s + getPlanQty(m), 0)
    const actualTotal = list.reduce((s, m) => s + getActualQty(m), 0)
    const progressPct = planTotal ? Math.min(100, (actualTotal / planTotal) * 100) : 0
    return { total, inProgress, shipped, delayed, planTotal, actualTotal, progressPct }
  }, [monthMOs])

  // Stage counts for pipeline (use monthMOs)
  const stageCounts = useMemo(() => {
    const counts = {}
    monthMOs.forEach(m => {
      const k = moStage(m)
      counts[k] = (counts[k] || 0) + 1
    })
    return counts
  }, [monthMOs])

  // Timeline month range
  const monthRange = useMemo(() => {
    if (!selectedMonth) {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0)
      return { start, end }
    }
    const [yy, mm] = selectedMonth.split('.').map(Number)
    const year = 2000 + yy
    const start = new Date(year, mm - 1, 1)
    const end = new Date(year, mm + 1, 0) // span 2 months for context
    return { start, end }
  }, [selectedMonth])

  const monthLabel = selectedMonth ? `${selectedMonth.split('.')[0]}.${selectedMonth.split('.')[1]}` : "Current"

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* ── Header card ── */}
      <div className="card" style={{ padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <Rail G={G} />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="syne" style={{ background: G.primary, color: "#FFF", padding: "5px 12px", borderRadius: 4, fontWeight: 700, fontSize: 13, letterSpacing: "1px" }}>MO</span>
          <div>
            <div className="syne" style={{ fontSize: 18, fontWeight: 700, color: G.tx, letterSpacing: "-.3px" }}>MO View</div>
            <div style={{ fontSize: 11, color: G.mu, marginTop: 1 }}>생산현황표 · 生产现况表</div>
          </div>
        </div>
        <button className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", minHeight: 36, fontSize: 12 }}>
          <Video size={14} /> CCTV
        </button>
      </div>

      {/* Month tabs */}
      {monthKeys.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
          {monthKeys.slice(0, 6).map(k => {
            const active = k === selectedMonth
            return (
              <button key={k} onClick={() => setSelectedMonth(k)} className="chip" style={{
                border: `1px solid ${active ? G.primary : G.border}`,
                background: active ? (G.dk ? "rgba(232,200,152,0.12)" : "rgba(201,168,110,0.12)") : "transparent",
                color: active ? G.accent : G.mu, fontWeight: 600,
              }}>
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

      {/* ── KPI Row (3 col) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr", gap: 16, marginBottom: 18 }} className="kgr">
        <div className="card" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <Rail G={G} />
          <div style={{ fontSize: 11, color: G.mu, letterSpacing: "1px", fontWeight: 600, marginBottom: 8 }}>SUMMARY</div>
          <div className="syne" style={{ fontSize: 22, fontWeight: 700, color: G.tx, letterSpacing: "-.3px", lineHeight: 1.1 }}>{monthLabel}</div>
          <div style={{ fontSize: 11, color: G.mu, marginTop: 3 }}>월별 생산 · 月度生产</div>
          <div style={{ marginTop: 14, fontSize: 11, color: G.mu, lineHeight: 1.7 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>총 MO</span><span className="num" style={{ color: G.tx, fontWeight: 600 }}>{loading ? "—" : stats.total.toLocaleString()}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>출고완료</span><span className="num" style={{ color: G.ok, fontWeight: 600 }}>{loading ? "—" : stats.shipped.toLocaleString()}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>지연</span><span className="num" style={{ color: G.bad, fontWeight: 600 }}>{loading ? "—" : stats.delayed.length.toLocaleString()}</span></div>
          </div>
        </div>

        {/* center KPI */}
        <div className="card" style={{ padding: "20px 24px" }}>
          <Rail G={G} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Calendar size={14} style={{ color: G.accent }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: G.tx }}>{monthLabel} 생산 KPI · 生产 KPI</span>
          </div>
          {loading ? (
            <SkeletonCard G={G} />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <CircularProgress G={G} value={stats.progressPct} size={84} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flex: 1 }}>
                <MiniKPI G={G} label="총 오더 / 总订单" value={stats.total} dot={SOFT_PALETTE[3]} />
                <MiniKPI G={G} label="진행중 / 进行中" value={stats.inProgress} dot={SOFT_PALETTE[4]} />
                <MiniKPI G={G} label="출고완료 / 已出货" value={stats.shipped} dot={SOFT_PALETTE[2]} />
                <MiniKPI G={G} label="지연 / 延误" value={stats.delayed.length} dot={SOFT_PALETTE[1]} />
              </div>
            </div>
          )}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${G.hair}`, display: "flex", gap: 18, fontSize: 11, color: G.mu, flexWrap: "wrap" }}>
            <span><b style={{ color: SOFT_PALETTE[3] }}>PLAN</b> <span className="num" style={{ color: G.tx, fontWeight: 600 }}>{stats.planTotal.toLocaleString()}</span> pcs</span>
            <span><b style={{ color: SOFT_PALETTE[2] }}>ACT</b> <span className="num" style={{ color: G.tx, fontWeight: 600 }}>{stats.actualTotal.toLocaleString()}</span> pcs</span>
          </div>
        </div>

        {/* Delay alert */}
        <div className="card" style={{
          padding: "20px 22px",
          background: G.dk ? "rgba(161,78,58,0.12)" : "#FDF0EE",
          borderColor: G.bad,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <AlertTriangle size={14} style={{ color: G.bad }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: G.bad, letterSpacing: ".3px" }}>생산 지연 · 生产延误</span>
          </div>
          <div className="num syne" style={{ fontSize: 36, fontWeight: 700, color: G.bad, textAlign: "center", lineHeight: 1 }}>
            {loading ? "—" : stats.delayed.length}
          </div>
          <div style={{ textAlign: "center", fontSize: 10, color: G.mu, marginBottom: 10, letterSpacing: ".5px" }}>건 지연 / 件延误</div>
          <div style={{ maxHeight: 120, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
            {stats.delayed.slice(0, 5).map(mo => (
              <div key={mo.ID} onClick={() => setSelectedMo({ id: mo.ID, row: mo })} style={{
                padding: "5px 9px", background: G.surf, borderRadius: 5, fontSize: 11,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                cursor: "pointer", border: `1px solid ${G.hair}`,
              }}>
                <span className="num" style={{ fontWeight: 600, color: G.accent }}>{getMoNumber(mo)}</span>
                <span style={{ background: G.bad, color: "#FFF", padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600 }}>지연</span>
              </div>
            ))}
            {!loading && stats.delayed.length === 0 && (
              <div style={{ padding: 8, fontSize: 11, color: G.mu, textAlign: "center" }}>지연 없음 ✓</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Timeline ── */}
      <div className="card" style={{ padding: "20px 24px", marginBottom: 18 }}>
        <Rail G={G} />
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Calendar size={14} style={{ color: G.accent }} />
            <span className="syne" style={{ fontSize: 14, fontWeight: 700, color: G.tx, letterSpacing: "-.2px" }}>{monthLabel} 생산 타임라인 · 生产排期</span>
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 11, color: G.mu, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600 }}>P=Plan</span>
            <span style={{ fontWeight: 600 }}>A=Actual</span>
            <LegendDot color={STAGE_HUES.Fab} label="Fab" />
            <LegendDot color={STAGE_HUES.Cut} label="Cut" />
            <LegendDot color={STAGE_HUES.Sew} label="Sew" />
            <LegendDot color={STAGE_HUES.Pack} label="Pack" />
            <LegendDot color={STAGE_HUES.Ship} label="Ship" />
          </div>
        </div>

        <FilterRow G={G} search={search} setSearch={setSearch}
          category={filtCategory} setCategory={setFiltCategory}
          factory={filtFactory} setFactory={setFiltFactory}
          prodStatus={filtProd} setProdStatus={setFiltProd}
          orderStatus={filtOrder} setOrderStatus={setFiltOrder}
          categories={categories} factories={factories}
          prodStatuses={prodStatuses} orderStatuses={orderStatuses}
        />

        {loading ? (
          <SkeletonCard G={G} />
        ) : filteredMOs.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: G.fa, fontSize: 12 }}>일치하는 MO 없음 · 无匹配MO</div>
        ) : (
          <TimelineGrid G={G} mos={filteredMOs} monthStart={monthRange.start} monthEnd={monthRange.end} onClickMo={(m) => setSelectedMo({ id: m.ID, row: m })} />
        )}
      </div>

      {/* ── Card Grid ── */}
      <div className="card" style={{ padding: "20px 24px", marginBottom: 18 }}>
        <Rail G={G} />
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Calendar size={14} style={{ color: G.accent }} />
            <span className="syne" style={{ fontSize: 14, fontWeight: 700, color: G.tx, letterSpacing: "-.2px" }}>{monthLabel} 생산 스케줄 · 生产安排</span>
          </div>
          <span className="num" style={{ fontSize: 11, color: G.mu }}>
            {loading ? "—" : `${filteredMOs.length} / ${monthMOs.length}`}
          </span>
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} G={G} />)}
          </div>
        ) : filteredMOs.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: G.fa, fontSize: 12 }}>일치하는 MO 없음 · 无匹配MO</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {filteredMOs.map(mo => (
              <MOCard key={mo.ID} G={G} mo={mo} onClick={() => setSelectedMo({ id: mo.ID, row: mo })} />
            ))}
          </div>
        )}
      </div>

      {/* ── Pipeline ── */}
      <div className="card" style={{ padding: "20px 24px", marginBottom: 18 }}>
        <Rail G={G} />
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Layers size={14} style={{ color: G.accent }} />
            <span className="syne" style={{ fontSize: 14, fontWeight: 700, color: G.tx, letterSpacing: "-.2px" }}>생산 파이프라인 · 生产流水</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="num" style={{ fontSize: 11, color: G.mu }}>총 {monthMOs.length}건 · {Object.keys(stageCounts).length}개 단계</span>
            <button
              onClick={() => setFactoryView(v => !v)}
              className="chip"
              style={{
                border: `1px solid ${factoryView ? G.primary : G.border}`,
                background: factoryView ? (G.dk ? "rgba(232,200,152,0.12)" : "rgba(201,168,110,0.12)") : "transparent",
                color: factoryView ? G.accent : G.mu, fontWeight: 600, fontSize: 10,
              }}
            >
              <Factory size={11} style={{ display: "inline-block", marginRight: 4, verticalAlign: "-2px" }} />
              공장별 / 工厂别
            </button>
          </div>
        </div>

        {!factoryView ? (
          <div className="pl-row" style={{ display: "flex", alignItems: "stretch", gap: 0, overflowX: "auto", padding: "4px 0" }}>
            {STAGES.map((stage, i) => {
              const count = stageCounts[stage.kr] || 0
              return (
                <Fragment key={stage.kr}>
                  <div
                    className="pl-stg"
                    onClick={() => {
                      const stageMos = monthMOs.filter(m => moStage(m) === stage.kr)
                      setSelectedStage({ stage, mos: stageMos })
                    }}
                    style={{
                      minWidth: 120, flex: 1, padding: "16px 12px",
                      minHeight: 140,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
                      borderRadius: 12, cursor: "pointer",
                      background: G.dk ? "rgba(245,240,232,0.025)" : "rgba(201,168,110,0.04)",
                      transition: "background .15s, transform .15s",
                      border: "1px solid transparent",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${stage.hue}1A`; e.currentTarget.style.borderColor = stage.hue; e.currentTarget.style.transform = "translateY(-2px)" }}
                    onMouseLeave={e => { e.currentTarget.style.background = G.dk ? "rgba(245,240,232,0.025)" : "rgba(201,168,110,0.04)"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.transform = "" }}
                  >
                    <stage.Icon size={36} strokeWidth={1.5} style={{ color: stage.hue }} />
                    <span className="num syne" style={{ fontSize: 28, fontWeight: 800, color: stage.hue, lineHeight: 1, letterSpacing: "-1px" }}>{count}</span>
                    <div style={{ textAlign: "center", lineHeight: 1.3 }}>
                      <div style={{ fontSize: 15, color: G.tx, fontWeight: 600, letterSpacing: ".3px" }}>{stage.kr}</div>
                      <div style={{ fontSize: 13, color: G.mu, marginTop: 3 }}>{stage.cn}</div>
                    </div>
                    <div style={{ width: 48, height: 4, background: stage.hue, borderRadius: 2, marginTop: 2 }} />
                  </div>
                  {i < STAGES.length - 1 && (
                    <div className="pl-arr" style={{ display: "flex", alignItems: "center", padding: "0 4px", color: G.fa, flexShrink: 0 }}>
                      <ChevronRight size={14} />
                    </div>
                  )}
                </Fragment>
              )
            })}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {factories.length === 0 ? (
              <div style={{ padding: 20, fontSize: 12, color: G.fa, textAlign: "center" }}>공장 데이터 없음</div>
            ) : factories.map(fac => {
              const facMOs = monthMOs.filter(m => getMoFactory(m) === fac)
              const facCounts = {}
              facMOs.forEach(m => { const k = moStage(m); facCounts[k] = (facCounts[k] || 0) + 1 })
              return (
                <div key={fac} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 140, fontSize: 11, color: G.tx, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fac}</div>
                  <div style={{ flex: 1, display: "flex", gap: 4, overflowX: "auto" }}>
                    {STAGES.map(stage => {
                      const count = facCounts[stage.kr] || 0
                      return (
                        <div key={stage.kr} title={`${stage.kr}: ${count}`} style={{
                          flex: 1, minWidth: 40, padding: "6px 8px", borderRadius: 6,
                          background: count ? `${stage.hue}22` : G.cardAlt,
                          border: `1px solid ${count ? stage.hue : G.hair}`,
                          textAlign: "center", fontSize: 11, color: count ? G.tx : G.fa, fontWeight: count ? 600 : 400,
                        }}>
                          <span className="num">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedStage && (
        <PipelineStageModal
          G={G}
          stage={selectedStage.stage}
          mos={selectedStage.mos}
          onClose={() => setSelectedStage(null)}
          onMoClick={(mo) => {
            setSelectedStage(null)
            setSelectedMo({ id: mo.ID, row: mo })
          }}
        />
      )}

      {selectedMo && (
        <MoDetailModal
          G={G}
          mo={selectedMo.row}
          moId={selectedMo.id}
          onClose={() => setSelectedMo(null)}
        />
      )}
    </div>
  )
}
