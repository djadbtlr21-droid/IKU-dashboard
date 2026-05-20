import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import { Activity, Layers as LayersIcon, Factory as FactoryIcon, Package as PackageIcon } from 'lucide-react'
import { fetchMoList } from '../api/client'
import {
  getMoFactory, getPlanQty, getActualQty, getMonthKey, isDelayed,
} from '../utils/moHelpers'
import { formatFactoryWithPinyin } from '../utils/formatFactory'
import MoListModal from '../components/MoListModal'
import MoDetailModal from '../components/MoDetailModal'
import { useData } from '../contexts/DataContext'

// ─────────────────────────────────────────────────────────────
// Stage helpers — keep aligned with MoView's STAGES list.
// ─────────────────────────────────────────────────────────────
const STAGES = [
  { kr: '샘플제작', cn: '产前样', en: 'Sampling', hue: '#D4C5E2' }, // 파스텔 라벤더
  { kr: '원단',     cn: '面料',   en: 'Fabric',   hue: '#B8E0D2' }, // 파스텔 민트
  { kr: '재단',     cn: '裁剪',   en: 'Cutting',  hue: '#FAD4B4' }, // 파스텔 피치
  { kr: '재봉',     cn: '裁缝',   en: 'Sewing',   hue: '#B8D4E8' }, // 파스텔 스카이블루
  { kr: '포장',     cn: '包装',   en: 'Packing',  hue: '#F9E4B7' }, // 파스텔 옐로우
  { kr: '완료',     cn: '完成',   en: 'Done',     hue: '#C8E6C9' }, // 파스텔 그린
  { kr: '출고',     cn: '出货',   en: 'Shipped',  hue: '#FFD6D6' }, // 파스텔 핑크
]

function moStage(mo) {
  const raw = String(mo.Production_Status || '').trim()
  const ps = raw.toLowerCase()
  const os = String(mo.Order_Status || '').toLowerCase()
  const ds = String(mo.Delivery_Status || '').toLowerCase()
  if (!raw) return '샘플제작'
  if (/not\s*start|미시작|未开始|未开|not started|sampling|샘플|产前样/i.test(raw)) return '샘플제작'
  if (/ship|出货|出货完|delivered|出库/.test(ds) || /ship|出货|出货完|delivered|出库/.test(ps)) return '출고'
  if (/complet|완료|done|finish|finished|完成/.test(ps) || /complet|完成/.test(os)) return '완료'
  if (/pack|包装|packing|포장/.test(ps)) return '포장'
  if (/sew|缝|봉제|stitch|sewing|재봉/.test(ps)) return '재봉'
  if (/cut|裁|재단|cutting/.test(ps)) return '재단'
  if (/fab|면료|원단|fabric|trim|面料/.test(ps)) return '원단'
  return '샘플제작'
}

// Pastel chart palette (replaces the gold trio used in the first pass)
const PASTEL_PLAN   = '#B8D4E8' // 파스텔 블루
const PASTEL_ACTUAL = '#F2C4A0' // 파스텔 코랄/피치
const GRID_LINE     = '#E8E0D5' // warm cream grid
const TOOLTIP_BORDER = '#E8E0D5'

// ─────────────────────────────────────────────────────────────
// Reusable presentational helpers
// ─────────────────────────────────────────────────────────────
function Rail({ G }) { return G.dk ? <span className="rail" /> : null }

function KPI({ G, label, value, sub, accent, onClick }) {
  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        padding: '20px 24px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform .15s, border-color .15s, box-shadow .15s',
      }}
      onMouseEnter={onClick ? e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = accent || G.primary; e.currentTarget.style.boxShadow = G.cardShadow } : undefined}
      onMouseLeave={onClick ? e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = G.border; e.currentTarget.style.boxShadow = '' } : undefined}
    >
      <Rail G={G} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent || G.primary }} />
        <span style={{ fontSize: 11, color: G.mu, letterSpacing: '1px', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div className="num syne" style={{ fontSize: 28, fontWeight: 700, color: G.tx, letterSpacing: '-.5px', lineHeight: 1.1 }}>{value}</div>
      {sub && <div className="num" style={{ fontSize: 11, color: G.mu, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ G, icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 8, borderBottom: `1px solid ${G.hair}` }}>
      {icon}
      <span className="syne" style={{ fontSize: 14, fontWeight: 700, color: G.tx, letterSpacing: '-.2px' }}>{label}</span>
    </div>
  )
}

function ChartTooltip({ G }) {
  return ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{
        background: G.card, border: `1px solid ${TOOLTIP_BORDER}`, borderRadius: 8,
        padding: '10px 14px', fontSize: 12, color: G.tx,
        boxShadow: G.dk ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(232,224,213,0.5)',
      }}>
        {label != null && (
          <div style={{ fontSize: 10, color: G.mu, letterSpacing: '.5px', marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
        )}
        {payload.map((p, i) => (
          <div key={i} className="num" style={{ fontSize: 12, color: G.tx, fontWeight: 600, lineHeight: 1.5 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: p.color || p.fill, marginRight: 8, verticalAlign: 'middle' }} />
            <span style={{ color: G.mu, marginRight: 6 }}>{p.name}</span>
            {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          </div>
        ))}
      </div>
    )
  }
}

// ─────────────────────────────────────────────────────────────
// Main Overview Page
// ─────────────────────────────────────────────────────────────
export default function OverviewPage({ G }) {
  const [moList, setMoList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(null) // null = 전체
  const [drilldown, setDrilldown] = useState(null) // { title, subtitle, accent, mos }
  const [selectedMo, setSelectedMo] = useState(null)

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchMoList({ perPage: 200 })
      .then(data => setMoList(data?.data || data?.records || data?.result || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadData()
    window.addEventListener('iku:refresh', loadData)
    return () => window.removeEventListener('iku:refresh', loadData)
  }, [loadData])

  // Month tab options derived from data
  const monthKeys = useMemo(() => {
    return [...new Set(moList.map(getMonthKey).filter(Boolean))].sort()
  }, [moList])

  // Apply month filter (null = 전체)
  const filteredMOs = useMemo(() => {
    if (!selectedMonth) return moList
    return moList.filter(m => getMonthKey(m) === selectedMonth)
  }, [moList, selectedMonth])

  // KPIs
  const totalMo = filteredMOs.length
  const totalPlan = filteredMOs.reduce((s, m) => s + getPlanQty(m), 0)
  const totalActual = filteredMOs.reduce((s, m) => s + getActualQty(m), 0)
  const completionRate = totalPlan ? (totalActual / totalPlan) * 100 : 0
  const delayedCount = filteredMOs.filter(isDelayed).length

  // Factory aggregation
  const factoryData = useMemo(() => {
    const map = {}
    filteredMOs.forEach(m => {
      const f = getMoFactory(m) || '—'
      if (!map[f]) map[f] = { factory: f, plan: 0, actual: 0, moCount: 0 }
      map[f].plan += getPlanQty(m)
      map[f].actual += getActualQty(m)
      map[f].moCount += 1
    })
    return Object.values(map).sort((a, b) => b.plan - a.plan).slice(0, 12)
  }, [filteredMOs])

  // Status (stage) distribution
  const statusData = useMemo(() => {
    const counts = {}
    filteredMOs.forEach(m => {
      const k = moStage(m)
      counts[k] = (counts[k] || 0) + 1
    })
    return STAGES
      .map(s => ({ name: s.kr, cn: s.cn, en: s.en, hue: s.hue, value: counts[s.kr] || 0 }))
      .filter(d => d.value > 0)
  }, [filteredMOs])

  // Monthly plan vs actual
  const monthlyData = useMemo(() => {
    const map = {}
    moList.forEach(m => {
      const k = getMonthKey(m)
      if (!k) return
      if (!map[k]) map[k] = { month: k, plan: 0, actual: 0, moCount: 0 }
      map[k].plan += getPlanQty(m)
      map[k].actual += getActualQty(m)
      map[k].moCount += 1
    })
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month))
  }, [moList])

  // Status summary table
  const statusSummary = useMemo(() => {
    return STAGES.map(s => {
      const mos = filteredMOs.filter(m => moStage(m) === s.kr)
      const plan = mos.reduce((sum, m) => sum + getPlanQty(m), 0)
      const actual = mos.reduce((sum, m) => sum + getActualQty(m), 0)
      const rate = plan ? Math.round((actual / plan) * 100) : 0
      return { ...s, count: mos.length, plan, actual, rate }
    }).filter(r => r.count > 0)
  }, [filteredMOs])

  const renderTooltip = useMemo(() => ChartTooltip({ G }), [G])

  // ── DataContext sync ──────────────────────────────────────
  const { setData } = useData()
  useEffect(() => {
    const IN_PROGRESS = ['샘플제작', '원단', '재단', '재봉', '포장']
    const inProgress = statusData.filter(s => IN_PROGRESS.includes(s.name)).reduce((sum, s) => sum + s.value, 0)
    const completed = statusData.filter(s => ['완료', '출고'].includes(s.name)).reduce((sum, s) => sum + s.value, 0)
    setData({
      currentPage: 'overview',
      moList: filteredMOs.slice(0, 50),
      filteredMonth: selectedMonth,
      kpi: { totalMo: filteredMOs.length, inProgress, completed, delayed: delayedCount },
      factoryStats: factoryData.map(f => ({ factory: f.factory, planQty: f.plan, actualQty: f.actual })),
      pipelineStats: statusData.map(s => ({ stage: s.name, count: s.value })),
    })
  }, [filteredMOs, selectedMonth, statusData, factoryData, delayedCount, setData])

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Header */}
      <div className="card" style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <Rail G={G} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="syne" style={{ background: G.primary, color: '#FFF', padding: '5px 12px', borderRadius: 4, fontWeight: 700, fontSize: 13, letterSpacing: '1px' }}>OV</span>
          <div>
            <div className="syne" style={{ fontSize: 18, fontWeight: 700, color: G.tx, letterSpacing: '-.3px' }}>Overview</div>
            <div style={{ fontSize: 11, color: G.mu, marginTop: 1 }}>대시보드 · 仪表盘</div>
          </div>
        </div>
        <span className="num" style={{ fontSize: 11, color: G.mu }}>
          {loading ? '—' : `${filteredMOs.length} MO · ${monthKeys.length} months`}
        </span>
      </div>

      {/* Month filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedMonth(null)}
          className="chip"
          style={{
            border: `1px solid ${selectedMonth === null ? G.primary : G.border}`,
            background: selectedMonth === null ? (G.dk ? 'rgba(232,200,152,0.12)' : 'rgba(201,168,110,0.12)') : 'transparent',
            color: selectedMonth === null ? G.accent : G.mu, fontWeight: 600,
          }}
        >
          전체 · 全部
        </button>
        {monthKeys.map(k => {
          const active = k === selectedMonth
          return (
            <button
              key={k}
              onClick={() => setSelectedMonth(k)}
              className="chip"
              style={{
                border: `1px solid ${active ? G.primary : G.border}`,
                background: active ? (G.dk ? 'rgba(232,200,152,0.12)' : 'rgba(201,168,110,0.12)') : 'transparent',
                color: active ? G.accent : G.mu, fontWeight: 600,
              }}
            >
              {k}
            </button>
          )
        })}
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: 14, borderRadius: 10, fontSize: 13, color: G.bad, background: `${G.bad}1A`, border: `1px solid ${G.bad}40` }}>
          <strong>오류 · 错误:</strong> {error}
        </div>
      )}

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 18 }}>
        <KPI
          G={G} label="총 MO · 总订单" value={loading ? '—' : totalMo.toLocaleString()}
          sub={delayedCount ? `지연 ${delayedCount}건` : '지연 없음'} accent={G.primary}
          onClick={() => setDrilldown({ title: '총 MO · 总订单', subtitle: `${filteredMOs.length} MO`, accent: G.primary, mos: filteredMOs })}
        />
        <KPI
          G={G} label="총 계획 수량 · 总计划数量" value={loading ? '—' : `${totalPlan.toLocaleString()} pcs`}
          sub={`평균 ${totalMo ? Math.round(totalPlan / totalMo).toLocaleString() : 0} pcs/MO`} accent={PASTEL_PLAN}
          onClick={() => {
            const mos = [...filteredMOs].sort((a, b) => getPlanQty(b) - getPlanQty(a))
            setDrilldown({ title: '총 계획 수량 · 总计划数量', subtitle: `${mos.length} MO · Plan 내림차순`, accent: PASTEL_PLAN, mos })
          }}
        />
        <KPI
          G={G} label="총 실제 수량 · 总实际数量" value={loading ? '—' : `${totalActual.toLocaleString()} pcs`}
          sub={`출고율 ${completionRate.toFixed(1)}%`} accent={PASTEL_ACTUAL}
          onClick={() => {
            const mos = filteredMOs.filter(m => getActualQty(m) > 0).sort((a, b) => getActualQty(b) - getActualQty(a))
            setDrilldown({ title: '총 실제 수량 · 总实际数量', subtitle: `${mos.length} MO · Actual > 0`, accent: PASTEL_ACTUAL, mos })
          }}
        />
      </div>

      {/* Section 1: Factory horizontal bar chart */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: 18 }}>
        <Rail G={G} />
        <SectionTitle G={G} icon={<FactoryIcon size={14} style={{ color: G.accent }} />} label="공장별 오더/출고 현황 · 各工厂接单/出货现状" />
        {loading ? (
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.mu, fontSize: 12 }}>로딩 중 · 加载中…</div>
        ) : factoryData.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: G.fa, fontSize: 12 }}>데이터 없음 · 无数据</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(280, factoryData.length * 38)}>
            <BarChart
              data={factoryData} layout="vertical" margin={{ top: 4, right: 30, bottom: 4, left: 10 }}
              onClick={(e) => {
                const fac = e?.activePayload?.[0]?.payload?.factory
                if (!fac) return
                const mos = filteredMOs.filter(m => getMoFactory(m) === fac)
                setDrilldown({ title: fac, subtitle: `${mos.length} MO · 工厂别 드릴다운`, accent: PASTEL_ACTUAL, mos })
              }}
              style={{ cursor: 'pointer' }}
            >
              <CartesianGrid stroke={GRID_LINE} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke={G.border} tick={{ fill: G.mu, fontSize: 11 }} ticks={[0,4800,9600,14400,19200,24000,28800,33600]} domain={[0,33600]} />
              <YAxis type="category" dataKey="factory" stroke={G.border} tick={{ fill: G.tx, fontSize: 10, fontWeight: 600 }} width={190} tickFormatter={formatFactoryWithPinyin} />
              <Tooltip content={renderTooltip} cursor={{ fill: G.nh }} />
              <Legend wrapperStyle={{ fontSize: 11, color: G.mu }} />
              <Bar dataKey="plan" name="Plan · 计划" fill={PASTEL_PLAN} radius={[0, 4, 4, 0]} barSize={14} />
              <Bar dataKey="actual" name="Actual · 实际" fill={PASTEL_ACTUAL} radius={[0, 4, 4, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Section 2 + 3 side by side on wide screens */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18, marginBottom: 18 }}>
        {/* Section 2: Status doughnut */}
        <div className="card" style={{ padding: '20px 24px' }}>
          <Rail G={G} />
          <SectionTitle G={G} icon={<LayersIcon size={14} style={{ color: G.accent }} />} label="생산 상태 분포 · 生产状态分布" />
          {loading ? (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.mu, fontSize: 12 }}>로딩 중…</div>
          ) : statusData.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: G.fa, fontSize: 12 }}>데이터 없음 · 无数据</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', minWidth: 200, height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {statusData.map((d, i) => (
                        <Cell
                          key={i}
                          fill={d.hue}
                          stroke={G.surf}
                          strokeWidth={2}
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            const mos = filteredMOs.filter(m => moStage(m) === d.name)
                            setDrilldown({ title: `${d.name} · ${d.cn}`, subtitle: `${mos.length} MO · 상태 드릴다운`, accent: d.hue, mos })
                          }}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={renderTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: '1 1 140px', minWidth: 140, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {statusData.map(d => (
                  <div
                    key={d.name}
                    onClick={() => {
                      const mos = filteredMOs.filter(m => moStage(m) === d.name)
                      setDrilldown({ title: `${d.name} · ${d.cn}`, subtitle: `${mos.length} MO · 상태 드릴다운`, accent: d.hue, mos })
                    }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, cursor: 'pointer', padding: '4px 6px', borderRadius: 4 }}
                    onMouseEnter={e => { e.currentTarget.style.background = G.nh }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: d.hue }} />
                      <span style={{ color: G.tx, fontWeight: 600 }}>{d.name}</span>
                      <span style={{ color: G.mu, fontSize: 10 }}>· {d.cn}</span>
                    </div>
                    <span className="num" style={{ color: G.accent, fontWeight: 700 }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Monthly plan vs actual */}
        <div className="card" style={{ padding: '20px 24px' }}>
          <Rail G={G} />
          <SectionTitle G={G} icon={<Activity size={14} style={{ color: G.accent }} />} label="월별 실출고 수량 · 月度实际出货" />
          {loading ? (
            <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.mu, fontSize: 12 }}>로딩 중…</div>
          ) : monthlyData.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: G.fa, fontSize: 12 }}>데이터 없음 · 无数据</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData} margin={{ top: 8, right: 14, bottom: 4, left: 4 }}>
                <CartesianGrid stroke={GRID_LINE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" stroke={G.border} tick={{ fill: G.mu, fontSize: 11, textAnchor: 'middle' }} interval={0} padding={{ left: 20, right: 20 }} />
                <YAxis stroke={G.border} tick={{ fill: G.mu, fontSize: 11 }} ticks={[0,9600,19200,28800,38400]} domain={[0,38400]} />
                <Tooltip content={renderTooltip} cursor={{ fill: G.nh }} />
                <Legend wrapperStyle={{ fontSize: 11, color: G.mu }} />
                <Bar dataKey="plan" name="Plan · 计划" fill={PASTEL_PLAN} radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="actual" name="Actual · 实际" fill={PASTEL_ACTUAL} radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Section 4: Status summary table */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <Rail G={G} />
        <SectionTitle G={G} icon={<PackageIcon size={14} style={{ color: G.accent }} />} label="상태별 MO 요약 · 状态汇总表" />
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: G.mu, fontSize: 12 }}>로딩 중…</div>
        ) : statusSummary.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: G.fa, fontSize: 12 }}>데이터 없음 · 无数据</div>
        ) : (
          <div style={{ overflowX: 'auto', border: `1px solid ${G.hair}`, borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: G.cardAlt }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: G.mu, fontWeight: 600, fontSize: 11, letterSpacing: '.3px', textTransform: 'uppercase', borderBottom: `1px solid ${G.hair}` }}>상태 · 状态</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', color: G.mu, fontWeight: 600, fontSize: 11, letterSpacing: '.3px', textTransform: 'uppercase', borderBottom: `1px solid ${G.hair}` }}>MO 수 · 数量</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', color: G.mu, fontWeight: 600, fontSize: 11, letterSpacing: '.3px', textTransform: 'uppercase', borderBottom: `1px solid ${G.hair}` }}>Plan Qty</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', color: G.mu, fontWeight: 600, fontSize: 11, letterSpacing: '.3px', textTransform: 'uppercase', borderBottom: `1px solid ${G.hair}` }}>Actual Qty</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', color: G.mu, fontWeight: 600, fontSize: 11, letterSpacing: '.3px', textTransform: 'uppercase', borderBottom: `1px solid ${G.hair}` }}>완료율 · 完成率</th>
                </tr>
              </thead>
              <tbody>
                {statusSummary.map((r, i) => (
                  <tr
                    key={r.kr}
                    onClick={() => {
                      const mos = filteredMOs.filter(m => moStage(m) === r.kr)
                      setDrilldown({ title: `${r.kr} · ${r.cn}`, subtitle: `${mos.length} MO · 상태 드릴다운`, accent: r.hue, mos })
                    }}
                    style={{ borderBottom: i < statusSummary.length - 1 ? `1px solid ${G.hair}` : 'none', background: i % 2 === 0 ? 'transparent' : G.rh, cursor: 'pointer', transition: 'background .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = G.nh }}
                    onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : G.rh }}
                  >
                    <td style={{ padding: '10px 14px', color: G.tx }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: r.hue, marginRight: 8, verticalAlign: 'middle' }} />
                      <span style={{ fontWeight: 600 }}>{r.kr}</span>
                      <span style={{ color: G.mu, marginLeft: 6, fontSize: 11 }}>· {r.cn}</span>
                    </td>
                    <td className="num" style={{ padding: '10px 14px', textAlign: 'right', color: G.accent, fontWeight: 700 }}>{r.count}</td>
                    <td className="num" style={{ padding: '10px 14px', textAlign: 'right', color: G.tx }}>{r.plan.toLocaleString()}</td>
                    <td className="num" style={{ padding: '10px 14px', textAlign: 'right', color: G.tx, fontWeight: 600 }}>{r.actual.toLocaleString()}</td>
                    <td className="num" style={{ padding: '10px 14px', textAlign: 'right', color: r.rate >= 100 ? G.ok : (r.rate >= 50 ? G.warn : G.mu), fontWeight: 700 }}>{r.rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drilldown: chart click → MO list → MO detail */}
      {drilldown && (
        <MoListModal
          G={G}
          title={drilldown.title}
          subtitle={drilldown.subtitle}
          accentColor={drilldown.accent}
          mos={drilldown.mos}
          onClose={() => setDrilldown(null)}
          onMoClick={(mo) => setSelectedMo({ id: mo.ID, row: mo })}
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
