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
  { kr: "샘플제작", cn: "产前样", hue: "#A8A29E", Icon: Clock, en: "Sampling" },
  { kr: "원단",   cn: "面料",   hue: "#93C5FD", Icon: Package },
  { kr: "재단",   cn: "裁剪",   hue: "#C9A86E", Icon: Scissors },
  { kr: "재봉",   cn: "缝制",   hue: "#F9A8D4", Icon: Layers },
  { kr: "포장",   cn: "包装",   hue: "#FDBA74", Icon: Package },
  { kr: "완료",   cn: "完成",   hue: "#FCD34D", Icon: CheckCircle2 },
  { kr: "출고",   cn: "出货",   hue: "#86EFAC", Icon: Truck },
]

function Rail({ G }) { return G.dk ? <span className="rail" /> : null }

// Map a MO record to a pipeline stage key (kr label).
// Priority: explicit late-stage signals first, then earlier stages, then explicit
// "not started" markers, finally fall back to 샘플제작 (NOT 재봉) so unknown
// statuses don't get misclassified as mid-flight.
function moStage(mo) {
  const raw = String(mo.Production_Status || '').trim()
  const ps = raw.toLowerCase()
  const os = String(mo.Order_Status || '').toLowerCase()
  const ds = String(mo.Delivery_Status || '').toLowerCase()

  // Explicit empty / not-started — match before partial-keyword regex so e.g.
  // "Not Started" doesn't accidentally hit the 'sew' / 'pack' / etc. branches.
  if (!raw) return "샘플제작"
  if (/not\s*start|미시작|未开始|未开|not started|sampling|샘플|产前样/i.test(raw)) return "샘플제작"

  if (/ship|出货|出货完|delivered|出库/.test(ds) || /ship|出货|出货完|delivered|出库/.test(ps)) return "출고"
  if (/complet|완료|done|finish|finished|完成/.test(ps) || /complet|完成/.test(os)) return "완료"
  if (/pack|包装|packing|포장/.test(ps)) return "포장"
  if (/sew|缝|봉제|stitch|sewing|재봉/.test(ps)) return "재봉"
  if (/cut|裁|재단|cutting/.test(ps)) return "재단"
  if (/fab|면료|원단|fabric|trim|面料/.test(ps)) return "원단"

  // Unknown / unmapped status — treat as not yet started rather than
  // assuming mid-flight (was previously returning 재봉, which mis-labeled
  // any MO with a status string we hadn't seen before).
  return "샘플제작"
}

// Display-only helper: shows English "Sampling" wherever the raw Zoho value
// would have read "Not Started" (and the corresponding KR/CN tokens).
function displayStatus(raw) {
  if (!raw) return 'Sampling'
  const s = String(raw)
  if (/not\s*start|미시작|未开始|未开/i.test(s)) return 'Sampling'
  return raw
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
// Timeline gantt — daily axis, per-process bars (FAB/CUT/SEW/PACK/SHIP),
// Plan (dashed) + Actual (solid) stacked rows per MO.
// ──────────────────────────────────────────────────────────

const DAY_WIDTH = 24
const META_COL_WIDTH = 220

// Per-process visual + field map. Field names probe Plan_X / Acture_X /
// Actual_X / bare so the same code works regardless of which Zoho schema
// is live. Single-date phases (FAB/SHIP) use the same field for start+end.
const PHASE_DEFS = [
  {
    key: 'FAB', label: 'FAB',
    planStart: ['Plan_Fabric_In_Date', 'Fabric_In_Date'],
    planEnd:   ['Plan_Fabric_In_Date', 'Fabric_In_Date'],
    actualStart: ['Actual_Fabric_In_Date', 'Acture_Fabric_In_Date', 'Fabric_In_Actual_Date'],
    actualEnd:   ['Actual_Fabric_In_Date', 'Acture_Fabric_In_Date', 'Fabric_In_Actual_Date'],
    bg: '#D1FAE5', tx: '#15803D', hue: '#16A34A',
  },
  {
    key: 'CUT', label: 'CUT',
    planStart: ['Plan_Cutting_Start_Date', 'Cutting_Start_Date'],
    planEnd:   ['Plan_Cutting_End_Date', 'Cutting_End_Date'],
    actualStart: ['Actual_Cutting_Start_Date', 'Acture_Cutting_Start_Date'],
    actualEnd:   ['Actual_Cutting_End_Date', 'Acture_Cutting_End_Date'],
    bg: '#FEF3C7', tx: '#92400E', hue: '#F59E0B',
  },
  {
    key: 'SEW', label: 'SEW',
    planStart: ['Plan_Sewing_Start_Date', 'Sewing_Start_Date'],
    planEnd:   ['Plan_Sewing_End_Date', 'Sewing_End_Date'],
    actualStart: ['Actual_Sewing_Start_Date', 'Acture_Sewing_Start_Date'],
    actualEnd:   ['Actual_Sewing_End_Date', 'Acture_Sewing_End_Date'],
    bg: '#DBEAFE', tx: '#1E40AF', hue: '#2563EB',
  },
  {
    key: 'PACK', label: 'PACK',
    planStart: ['Plan_Packing_Start_Date', 'Packing_Start_Date'],
    planEnd:   ['Plan_Packing_End_Date', 'Packing_End_Date', 'Expected_Delivery'],
    actualStart: ['Actual_Packing_Start_Date', 'Acture_Packing_Start_Date'],
    actualEnd:   ['Actual_Packing_End_Date', 'Acture_Packing_End_Date'],
    bg: '#EDE9FE', tx: '#5B21B6', hue: '#7C3AED',
  },
  {
    key: 'SHIP', label: 'SHIP',
    planStart: ['Plan_Ship_Date', 'Ship_Date', 'Expected_Delivery'],
    planEnd:   ['Plan_Ship_Date', 'Ship_Date', 'Expected_Delivery'],
    actualStart: ['Actual_Ship_Date', 'Acture_Ship_Date'],
    actualEnd:   ['Actual_Ship_Date', 'Acture_Ship_Date'],
    bg: '#FCE7F3', tx: '#9F1239', hue: '#DB2777',
  },
]

function firstDate(mo, keys) {
  for (const k of keys) {
    const d = parseZohoDate(mo?.[k])
    if (d) return d
  }
  return null
}

// Resolve a phase's bar geometry for one MO within the timeline range
function phaseBars(mo, phaseDef, monthStart, monthEnd, today) {
  const planStart = firstDate(mo, phaseDef.planStart)
  const planEnd = firstDate(mo, phaseDef.planEnd) || planStart
  if (!planStart) return null

  // Actual: explicit field first, else today-clip of plan (only past portion)
  const actualStart = firstDate(mo, phaseDef.actualStart) || (today >= planStart ? planStart : null)
  const actualEnd = firstDate(mo, phaseDef.actualEnd) || (today >= planStart ? new Date(Math.min(today.getTime(), (planEnd || planStart).getTime())) : null)

  const clip = (start, end) => {
    if (!start || !end) return null
    const s = Math.max(start.getTime(), monthStart.getTime())
    const e = Math.min(end.getTime(), monthEnd.getTime() + 86400000) // include end day
    if (e <= s) return null
    const left = (s - monthStart.getTime()) / 86400000 * DAY_WIDTH
    const days = Math.max(1, (e - s) / 86400000)
    const width = Math.max(DAY_WIDTH * 0.6, days * DAY_WIDTH - 2)
    return { left, width }
  }

  return {
    plan: clip(planStart, new Date((planEnd || planStart).getTime() + 86400000 - 1)), // include end day
    actual: clip(actualStart, actualEnd && new Date(actualEnd.getTime() + 86400000 - 1)),
  }
}

function TimelineRow({ G, mo, monthStart, monthEnd, totalWidth, today, onClickMo }) {
  const rowH = 50

  return (
    <div style={{ display: "flex", alignItems: "stretch", borderBottom: `1px solid ${G.hair}`, minHeight: rowH }}>
      {/* Left meta — sticky to viewport left within the scroll container */}
      <div
        onClick={() => onClickMo && onClickMo(mo)}
        title={`${getMoNumber(mo)} — 클릭하여 상세 보기 / 点击查看详情`}
        style={{
          position: "sticky", left: 0, zIndex: 2,
          width: META_COL_WIDTH, minWidth: META_COL_WIDTH, display: "flex", alignItems: "center", gap: 8,
          padding: "8px 10px 8px 6px", cursor: "pointer",
          background: G.card,
          borderRight: `1px solid ${G.hair}`,
          transition: "background .15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = G.nh }}
        onMouseLeave={e => { e.currentTarget.style.background = G.card }}
      >
        <div style={{ width: 30, height: 38, borderRadius: 4, background: G.cardAlt, overflow: "hidden", flexShrink: 0, border: `1px solid ${G.hair}` }}>
          <ZohoImage mo={mo} field="Style_Image" report="All_MO" G={G} iconSize={14} placeholderText="" />
        </div>
        <div style={{ overflow: "hidden", flex: 1 }}>
          <div className="num" style={{ fontSize: 11, fontWeight: 700, color: G.accent, lineHeight: 1.2 }}>{getMoNumber(mo)}</div>
          <div style={{ fontSize: 10, color: G.mu, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{getMoSku(mo)}</div>
          <div style={{ fontSize: 9, color: G.fa, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{getMoFactory(mo)}</div>
        </div>
        <div className="num" style={{ fontSize: 10, color: G.mu, textAlign: "right" }}>{getPlanQty(mo).toLocaleString()}</div>
      </div>

      {/* Gantt — Plan row (top half) + Actual row (bottom half) */}
      <div style={{ position: "relative", width: totalWidth, minWidth: totalWidth, height: rowH }}>
        {PHASE_DEFS.map(p => {
          const b = phaseBars(mo, p, monthStart, monthEnd, today)
          if (!b) return null
          return (
            <span key={p.key}>
              {b.plan && (
                <div
                  title={`${p.label} Plan`}
                  style={{
                    position: "absolute", top: 6, height: 16,
                    left: b.plan.left, width: b.plan.width,
                    background: `repeating-linear-gradient(45deg, ${p.hue}33, ${p.hue}33 4px, transparent 4px, transparent 8px)`,
                    border: `1px dashed ${p.hue}`,
                    borderRadius: 3,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 700, color: p.tx,
                    overflow: "hidden", whiteSpace: "nowrap",
                  }}
                >
                  {b.plan.width >= 30 ? p.label : ''}
                </div>
              )}
              {b.actual && (
                <div
                  title={`${p.label} Actual`}
                  style={{
                    position: "absolute", top: rowH - 22, height: 16,
                    left: b.actual.left, width: b.actual.width,
                    background: p.bg,
                    border: `1px solid ${p.hue}`,
                    borderRadius: 3,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 700, color: p.tx,
                    overflow: "hidden", whiteSpace: "nowrap",
                  }}
                >
                  {b.actual.width >= 30 ? p.label : ''}
                </div>
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function TimelineGrid({ G, mos, monthStart, monthEnd, onClickMo }) {
  const today = new Date()
  // Inclusive day count (start + 1 day per step until > end)
  const totalDays = Math.round((monthEnd - monthStart) / 86400000) + 1
  const totalWidth = totalDays * DAY_WIDTH

  // Build per-day cells
  const days = []
  for (let i = 0; i < totalDays; i++) {
    const dt = new Date(monthStart.getTime() + i * 86400000)
    days.push(dt)
  }

  // Month band: contiguous spans per month
  const monthSpans = []
  let span = null
  days.forEach((dt, i) => {
    const key = `${dt.getFullYear()}-${dt.getMonth()}`
    if (!span || span.key !== key) {
      if (span) monthSpans.push(span)
      span = { key, year: dt.getFullYear(), month: dt.getMonth(), startIdx: i, count: 1 }
    } else {
      span.count++
    }
  })
  if (span) monthSpans.push(span)

  const todayInRange = today >= monthStart && today <= monthEnd
  const todayLeft = todayInRange ? (today - monthStart) / 86400000 * DAY_WIDTH : 0
  const todayLabel = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const isWeekend = (dt) => {
    const dow = dt.getDay()
    return dow === 0 || dow === 6
  }
  const isToday = (dt) => dt.toDateString() === today.toDateString()

  return (
    <div style={{ overflowX: "auto", position: "relative" }}>
      <div style={{ minWidth: META_COL_WIDTH + totalWidth }}>
        {/* Header row 1 — month band */}
        <div style={{ display: "flex", borderBottom: `1px solid ${G.hair}` }}>
          <div style={{ position: "sticky", left: 0, zIndex: 3, width: META_COL_WIDTH, minWidth: META_COL_WIDTH, background: G.cardAlt, borderRight: `1px solid ${G.hair}`, padding: "8px 10px", fontSize: 10, fontWeight: 700, color: G.mu, letterSpacing: ".5px", textTransform: "uppercase" }}>
            MO · Style
          </div>
          <div style={{ display: "flex", width: totalWidth }}>
            {monthSpans.map((m, i) => (
              <div key={i} style={{
                width: m.count * DAY_WIDTH,
                background: i % 2 === 0 ? G.cardAlt : G.surf,
                borderRight: i < monthSpans.length - 1 ? `1px solid ${G.border}` : "none",
                padding: "6px 10px", fontSize: 11, fontWeight: 700, color: G.tx,
                textAlign: "center", letterSpacing: ".3px",
              }}>
                {String(m.year).slice(-2)}.{String(m.month + 1).padStart(2, '0')}
                <span style={{ marginLeft: 6, fontSize: 10, color: G.mu, fontWeight: 500 }}>
                  · {m.month === 4 ? '5月' : m.month === 5 ? '6月' : `${m.month + 1}月`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Header row 2 — daily numbers */}
        <div style={{ display: "flex", borderBottom: `2px solid ${G.hair}` }}>
          <div style={{ position: "sticky", left: 0, zIndex: 3, width: META_COL_WIDTH, minWidth: META_COL_WIDTH, background: G.surf, borderRight: `1px solid ${G.hair}` }} />
          <div style={{ display: "flex", width: totalWidth }}>
            {days.map((dt, i) => {
              const we = isWeekend(dt)
              const td = isToday(dt)
              return (
                <div key={i} style={{
                  width: DAY_WIDTH, minWidth: DAY_WIDTH, height: 28,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: td ? 700 : 500,
                  color: td ? "#EF4444" : (we ? G.fa : G.tx),
                  background: td ? "rgba(239,68,68,0.08)" : (we ? G.cardAlt : "transparent"),
                  borderRight: `1px solid ${G.hair}`,
                }}>
                  {dt.getDate()}
                </div>
              )
            })}
          </div>
        </div>

        {/* MO rows */}
        <div style={{ position: "relative" }}>
          {/* Day-column background grid (weekend tinting) — drawn behind bars */}
          <div style={{ position: "absolute", inset: 0, left: META_COL_WIDTH, display: "flex", pointerEvents: "none", zIndex: 0 }}>
            {days.map((dt, i) => (
              <div key={i} style={{
                width: DAY_WIDTH, minWidth: DAY_WIDTH,
                borderRight: `1px solid ${G.hair}`,
                background: isWeekend(dt) ? (G.dk ? "rgba(255,255,255,0.02)" : "rgba(26,23,20,0.015)") : "transparent",
              }} />
            ))}
          </div>

          {mos.slice(0, 30).map((mo, i) => (
            <TimelineRow key={mo.ID || i} G={G} mo={mo} monthStart={monthStart} monthEnd={monthEnd} totalWidth={totalWidth} today={today} onClickMo={onClickMo} />
          ))}

          {/* Today red vertical line — spans all MO rows */}
          {todayInRange && (
            <div style={{
              position: "absolute", top: 0, bottom: 0, left: META_COL_WIDTH + todayLeft,
              width: 2, background: "#EF4444", pointerEvents: "none", zIndex: 1,
              boxShadow: "0 0 0 1px rgba(239,68,68,0.2)",
            }} />
          )}
        </div>

        {/* Footer — legend + today badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, padding: "0 4px", fontSize: 10, color: G.mu, gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span><span style={{ display: "inline-block", width: 18, height: 8, borderRadius: 2, border: `1px dashed ${G.tx}`, background: `repeating-linear-gradient(45deg, ${G.mu}33, ${G.mu}33 3px, transparent 3px, transparent 6px)`, verticalAlign: "middle" }} /> Plan (dashed)</span>
            <span><span style={{ display: "inline-block", width: 18, height: 8, borderRadius: 2, background: G.primary, verticalAlign: "middle" }} /> Actual (solid)</span>
            {PHASE_DEFS.map(p => (
              <span key={p.key} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: p.hue }} />
                {p.label}
              </span>
            ))}
          </div>
          {todayInRange && (
            <span><span style={{ color: "#EF4444", fontWeight: 700 }}>● Today</span> <span className="num" style={{ color: G.tx }}>{todayLabel}</span></span>
          )}
        </div>
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
          <div title={displayStatus(mo.Order_Status)} style={{ marginTop: 6, padding: "3px 8px", background: G.dk ? "rgba(134,239,172,0.15)" : "#D1FAE5", borderRadius: 4, fontSize: 10, textAlign: "center", color: G.dk ? "#86EFAC" : "#065F46", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {displayStatus(mo.Order_Status)}
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

  // Timeline range — fixed at May 1 → Jun 30 regardless of selectedMonth filter.
  // Year is taken from selectedMonth when available, else the current year.
  const timelineRange = useMemo(() => {
    let year = new Date().getFullYear()
    if (selectedMonth) {
      const yy = Number(selectedMonth.split('.')[0])
      if (!Number.isNaN(yy)) year = 2000 + yy
    }
    return {
      start: new Date(year, 4, 1),     // May 1 (month index 4)
      end: new Date(year, 6, 0),       // Jun 30 (day 0 of month 6 = last day of month 5)
      year,
      label: `${String(year).slice(-2)}.05 - ${String(year).slice(-2)}.06`,
    }
  }, [selectedMonth])

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

      {/* ── Pipeline ── (moved up — sits right after KPI row) */}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {factories.length === 0 ? (
              <div style={{ padding: 20, fontSize: 12, color: G.fa, textAlign: "center" }}>공장 데이터 없음</div>
            ) : (
              <>
                {/* Stage header row — sticky labels aligned with the per-factory count cells below.
                    Font sizes bumped ~1.5x per spec: 10→15, 9→13, factory label 11→16, counts 11→16. */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 8, borderBottom: `1px solid ${G.hair}` }}>
                  <div style={{ width: 140, fontSize: 15, color: G.mu, fontWeight: 600, letterSpacing: ".3px", textTransform: "uppercase" }}>공장 · 工厂</div>
                  <div style={{ flex: 1, display: "flex", gap: 4 }}>
                    {STAGES.map(stage => (
                      <div key={stage.kr} style={{
                        flex: 1, minWidth: 60, padding: "6px 8px",
                        textAlign: "center", fontSize: 15, color: G.mu, fontWeight: 600, lineHeight: 1.25,
                      }}>
                        <div style={{ color: stage.hue, fontWeight: 700 }}>{stage.kr}</div>
                        <div style={{ fontSize: 13, color: G.fa, marginTop: 2 }}>{stage.cn}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {factories.map(fac => {
                  const facMOs = monthMOs.filter(m => getMoFactory(m) === fac)
                  const facCounts = {}
                  facMOs.forEach(m => { const k = moStage(m); facCounts[k] = (facCounts[k] || 0) + 1 })
                  return (
                    <div key={fac} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 140, fontSize: 16, color: G.tx, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fac}</div>
                      <div style={{ flex: 1, display: "flex", gap: 4 }}>
                        {STAGES.map(stage => {
                          const count = facCounts[stage.kr] || 0
                          return (
                            <div key={stage.kr} title={`${fac} · ${stage.kr}: ${count}`} style={{
                              flex: 1, minWidth: 60, padding: "9px 10px", borderRadius: 6,
                              background: count ? `${stage.hue}22` : G.cardAlt,
                              border: `1px solid ${count ? stage.hue : G.hair}`,
                              textAlign: "center", fontSize: 16, color: count ? G.tx : G.fa, fontWeight: count ? 700 : 400,
                            }}>
                              <span className="num">{count}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Card Grid ── (moved here — between Pipeline and Timeline) */}
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

      {/* ── Timeline ── (moved to end — fixed 5-6월 range regardless of month filter) */}
      <div className="card" style={{ padding: "20px 24px", marginBottom: 18 }}>
        <Rail G={G} />
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Calendar size={14} style={{ color: G.accent }} />
            <span className="syne" style={{ fontSize: 14, fontWeight: 700, color: G.tx, letterSpacing: "-.2px" }}>{timelineRange.label} 생산 타임라인 · 生产排期</span>
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
          <TimelineGrid G={G} mos={filteredMOs} monthStart={timelineRange.start} monthEnd={timelineRange.end} onClickMo={(m) => setSelectedMo({ id: m.ID, row: m })} />
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
