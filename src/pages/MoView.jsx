import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { fetchMoList } from '../api/client'
import MoDetailModal from '../components/MoDetailModal'
import { SkeletonCard, SkeletonTable } from '../components/SkeletonLoader'
import {
  getMoNumber, getMoSku, getMoFactory, getMoStatus,
  getPlanQty, getActualQty, getEndDate, getProgress,
  isDelayed, isOverdue, getMonthKey, getChartBucket,
} from '../utils/moHelpers'

const PAGE_SIZE = 50

const SOFT_PALETTE = ["#C4B5FD", "#FCA5A5", "#6EE7B7", "#93C5FD", "#FCD34D", "#F9A8D4", "#A5F3FC", "#D9F99D"]

// Chart status → SOFT_PALETTE
const STATUS_HUES = {
  Completed: "#6EE7B7",
  "In Progress": "#C4B5FD",
  "Not Started": "#A5F3FC",
  Overdue: "#FCA5A5",
}

function Rail({ G }) { return G.dk ? <span className="rail" /> : null }

function SortIcon({ G, dir }) {
  if (!dir) return <span style={{ color: G.fa }}>⇅</span>
  return <span style={{ color: G.primary }}>{dir === 'asc' ? '↑' : '↓'}</span>
}

function StatusBadge({ G, status }) {
  const map = {
    "Completed": G.ok, "완료": G.ok, "Shipped": G.ok,
    "In Progress": G.cool, "진행중": G.cool,
    "Not Started": G.mu, "미시작": G.mu, "미오더": G.mu,
    "Overdue": G.bad, "지연": G.bad,
  }
  let c = G.mu
  for (const [k, v] of Object.entries(map)) {
    if (status && status.includes(k)) { c = v; break }
  }
  const bg = G.dk ? `${c}22` : `${c}1A`
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, color: c, background: bg, letterSpacing: ".1px", whiteSpace: "nowrap" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c }} />
      <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{status || '—'}</span>
    </span>
  )
}

function KPI({ G, label, value, sub, dot }) {
  return (
    <div className="card" style={{ padding: "20px 24px" }}>
      <Rail G={G} />
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
        {dot && <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, boxShadow: G.dk ? "none" : `0 0 0 3px ${dot}22` }} />}
        <p style={{ fontSize: 13, color: G.mu, letterSpacing: "1px", fontWeight: 500 }}>{label}</p>
      </div>
      <p className="num" style={{ fontSize: 26, fontWeight: 700, color: G.tx, lineHeight: 1.2 }}>{value}</p>
      {sub && <p className="num" style={{ fontSize: 11, color: G.mu, marginTop: 8 }}>{sub}</p>}
    </div>
  )
}

function MonthTabs({ G, months, selected, onChange }) {
  const tabStyle = (active) => ({
    padding: "7px 14px",
    fontSize: 12,
    borderRadius: 999,
    fontWeight: 600,
    cursor: "pointer",
    border: `1px solid ${active ? G.primary : G.border}`,
    background: active ? (G.dk ? "rgba(232,200,152,0.12)" : "rgba(201,168,110,0.12)") : "transparent",
    color: active ? G.accent : G.mu,
    transition: "all .15s",
    letterSpacing: ".2px",
  })
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button onClick={() => onChange(null)} style={tabStyle(selected === null)}>전체 · 全部</button>
      {months.map((m) => (
        <button key={m} onClick={() => onChange(m)} style={tabStyle(selected === m)}>{m}</button>
      ))}
    </div>
  )
}

export default function MoView({ G }) {
  const [moList, setMoList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [selectedFactory, setSelectedFactory] = useState(null)
  const [selectedMo, setSelectedMo] = useState(null)
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchMoList({ perPage: 200 })
      .then((data) => {
        const rows = data?.data || data?.records || data?.result || []
        setMoList(rows)
      })
      .catch((err) => {
        console.error('[MoView] error:', err)
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadData()
    window.addEventListener('iku:refresh', loadData)
    return () => window.removeEventListener('iku:refresh', loadData)
  }, [loadData])

  const months = useMemo(() => {
    const keys = [...new Set(moList.map(getMonthKey).filter(Boolean))].sort().reverse()
    return keys.slice(0, 6)
  }, [moList])

  useEffect(() => {
    if (months.length && selectedMonth === null) {
      const now = new Date()
      const yy = String(now.getFullYear()).slice(-2)
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const cur = `${yy}.${mm}`
      setSelectedMonth(months.includes(cur) ? cur : months[0])
    }
  }, [months, selectedMonth])

  const filtered = useMemo(() => {
    return moList.filter((mo) => {
      if (selectedMonth && getMonthKey(mo) !== selectedMonth) return false
      if (selectedFactory && getMoFactory(mo) !== selectedFactory) return false
      return true
    })
  }, [moList, selectedMonth, selectedFactory])

  const stats = useMemo(() => {
    const total = moList.length
    const inProgress = moList.filter((m) => {
      const s = getMoStatus(m)
      return s && !/complet/i.test(s) && !isDelayed(m)
    }).length
    const completed = moList.filter((m) => /complet|shipped/i.test(getMoStatus(m))).length
    const notStarted = moList.filter((m) => !getMoStatus(m)).length
    const delayed = moList.filter((m) => isDelayed(m)).length
    return { total, inProgress, completed, notStarted, delayed }
  }, [moList])

  const chartData = useMemo(() => {
    const factoryMap = {}
    filtered.forEach((mo) => {
      const f = getMoFactory(mo)
      if (!factoryMap[f]) factoryMap[f] = { factory: f, Completed: 0, 'In Progress': 0, 'Not Started': 0, Overdue: 0 }
      factoryMap[f][getChartBucket(mo)] += 1
    })
    return Object.values(factoryMap)
  }, [filtered])

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setPage(1)
  }

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      let av, bv
      if (sortKey === 'mo') { av = getMoNumber(a); bv = getMoNumber(b) }
      else if (sortKey === 'sku') { av = getMoSku(a); bv = getMoSku(b) }
      else if (sortKey === 'factory') { av = getMoFactory(a); bv = getMoFactory(b) }
      else if (sortKey === 'plan') { av = getPlanQty(a); bv = getPlanQty(b) }
      else if (sortKey === 'actual') { av = getActualQty(a); bv = getActualQty(b) }
      else if (sortKey === 'progress') { av = getProgress(a); bv = getProgress(b) }
      else if (sortKey === 'endDate') { av = getEndDate(a) || ''; bv = getEndDate(b) || '' }
      else if (sortKey === 'status') { av = getMoStatus(a); bv = getMoStatus(b) }
      else { av = ''; bv = '' }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const CARDS = [
    { label: '총 MO · 总MO',     value: stats.total.toLocaleString(),       dot: SOFT_PALETTE[0] },
    { label: '진행중 · 进行中',   value: stats.inProgress.toLocaleString(),  dot: SOFT_PALETTE[3] },
    { label: '완료 · 完成',       value: stats.completed.toLocaleString(),   dot: SOFT_PALETTE[2] },
    { label: '미시작 · 未开始',   value: stats.notStarted.toLocaleString(),  dot: SOFT_PALETTE[6] },
    { label: '지연 · 延误',       value: stats.delayed.toLocaleString(),     dot: SOFT_PALETTE[1] },
  ]

  const COL = [
    { key: 'mo', label: 'MO#' },
    { key: 'sku', label: 'Style SKU · 款号' },
    { key: 'factory', label: '공장 · 工厂' },
    { key: 'plan', label: '계획 · 计划' },
    { key: 'actual', label: '실적 · 实际' },
    { key: 'progress', label: '진행률 · 进度' },
    { key: 'endDate', label: '출하일 · 出货日' },
    { key: 'status', label: '생산상태 · 生产状态' },
  ]

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="syne" style={{ fontSize: 28, fontWeight: 700, color: G.tx, letterSpacing: "-.5px", marginBottom: 4 }}>
          MO View
        </h1>
        <p style={{ fontSize: 12, color: G.mu, letterSpacing: ".5px" }}>생산진행 · 生产进度</p>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
        {loading
          ? [...Array(5)].map((_, i) => <SkeletonCard key={i} G={G} />)
          : CARDS.map((c) => <KPI key={c.label} G={G} {...c} />)
        }
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: 14, borderRadius: 10, fontSize: 13, color: G.bad, background: `${G.bad}1A`, border: `1px solid ${G.bad}40` }}>
          <strong>오류 · 错误:</strong> {error}
        </div>
      )}

      {!loading && months.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <MonthTabs G={G} months={months} selected={selectedMonth} onChange={(m) => { setSelectedMonth(m); setPage(1) }} />
        </div>
      )}

      {!loading && chartData.length > 0 && (
        <div className="card" style={{ padding: "20px 24px", marginBottom: 24 }}>
          <Rail G={G} />
          <h2 className="syne" style={{ fontSize: 14, fontWeight: 700, color: G.tx, marginBottom: 16, letterSpacing: "-.2px" }}>
            공장별 MO 현황 · 按工厂MO状态
          </h2>
          <ResponsiveContainer width="100%" height={Math.max(80, chartData.length * 52)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 20, bottom: 0, left: 90 }}
              onClick={(d) => {
                if (d?.activePayload?.[0]) {
                  const f = d.activePayload[0].payload.factory
                  setSelectedFactory((prev) => prev === f ? null : f)
                  setPage(1)
                }
              }}
            >
              <XAxis type="number" stroke={G.border} tick={{ fill: G.mu, fontSize: 11 }} />
              <YAxis type="category" dataKey="factory" stroke={G.border} tick={{ fill: G.mu, fontSize: 11 }} width={86} />
              <Tooltip
                contentStyle={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 8, fontSize: 12, color: G.tx, boxShadow: G.cardShadow }}
                labelStyle={{ color: G.accent, fontWeight: 600 }}
                itemStyle={{ color: G.tx }}
              />
              {Object.entries(STATUS_HUES).map(([key, color]) => (
                <Bar key={key} dataKey={key} stackId="a" fill={color} radius={key === 'Overdue' ? [0, 4, 4, 0] : [0, 0, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.factory}
                      fill={color}
                      style={{ cursor: 'pointer', opacity: selectedFactory && selectedFactory !== entry.factory ? 0.4 : 1 }}
                    />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
          {selectedFactory && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: G.mu }}>필터: {selectedFactory}</span>
              <button onClick={() => setSelectedFactory(null)} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: `${G.bad}1A`, color: G.bad, border: "none", cursor: "pointer", fontWeight: 600 }}>
                ✕ 해제
              </button>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <Rail G={G} />
        <div style={{ padding: "14px 24px", borderBottom: `1px solid ${G.hair}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 className="syne" style={{ fontSize: 14, fontWeight: 700, color: G.tx, letterSpacing: "-.2px" }}>
            MO 목록 · MO列表
            {!loading && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: G.mu }}>({sorted.length}건)</span>}
          </h2>
        </div>

        {loading ? (
          <div style={{ padding: "0 24px 24px" }}>
            <SkeletonTable rows={8} G={G} />
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: "64px 0", textAlign: "center", color: G.fa, fontSize: 13 }}>
            데이터가 없습니다 · 暂无数据
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: G.cardAlt, borderBottom: `1px solid ${G.hair}` }}>
                  {COL.map((c) => (
                    <th
                      key={c.key}
                      onClick={() => handleSort(c.key)}
                      style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", color: sortKey === c.key ? G.accent : G.mu, letterSpacing: ".3px" }}
                    >
                      {c.label} <SortIcon G={G} dir={sortKey === c.key ? sortDir : null} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((mo, i) => {
                  const moId = mo.ID || mo.id
                  const progress = getProgress(mo)
                  const overdue = isOverdue(mo)
                  const endDate = getEndDate(mo)
                  const status = getMoStatus(mo)
                  return (
                    <tr
                      key={moId || i}
                      onClick={() => setSelectedMo({ id: moId, row: mo })}
                      style={{
                        borderBottom: `1px solid ${G.hair}`,
                        background: i % 2 === 0 ? "transparent" : G.rh,
                        cursor: "pointer",
                        transition: "background .15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = G.nh }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 0 ? "transparent" : G.rh }}
                    >
                      <td className="num" style={{ padding: "12px 16px", fontWeight: 600, whiteSpace: "nowrap", color: G.accent }}>
                        {getMoNumber(mo)}
                      </td>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap", color: G.tx }}>
                        {getMoSku(mo)}
                      </td>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap", color: G.tx }}>
                        {getMoFactory(mo)}
                      </td>
                      <td className="num" style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap", color: G.mu }}>
                        {getPlanQty(mo).toLocaleString()}
                      </td>
                      <td className="num" style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap", color: G.tx, fontWeight: 600 }}>
                        {getActualQty(mo).toLocaleString()}
                      </td>
                      <td style={{ padding: "12px 16px", minWidth: 130 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 5, borderRadius: 999, overflow: "hidden", background: G.hair }}>
                            <div style={{ height: "100%", borderRadius: 999, width: `${progress}%`, background: `linear-gradient(90deg, ${G.primary}, ${G.primarySoft})`, transition: "width .3s" }} />
                          </div>
                          <span className="num" style={{ fontSize: 11, width: 32, textAlign: "right", color: G.accent, fontWeight: 600 }}>{progress}%</span>
                        </div>
                      </td>
                      <td className="num" style={{ padding: "12px 16px", whiteSpace: "nowrap", color: overdue ? G.bad : G.mu, fontWeight: overdue ? 600 : 400 }}>
                        {endDate || '—'}{overdue && <span style={{ marginLeft: 4 }}>⚠</span>}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <StatusBadge G={G} status={status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div style={{ padding: "12px 24px", borderTop: `1px solid ${G.hair}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="num" style={{ fontSize: 11, color: G.mu }}>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} / {sorted.length}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, border: `1px solid ${G.border}`, background: page === 1 ? "transparent" : G.cardAlt, color: page === 1 ? G.fa : G.tx, cursor: page === 1 ? "not-allowed" : "pointer" }}
              >
                ← 이전
              </button>
              <span className="num" style={{ padding: "5px 12px", fontSize: 11, color: G.mu, display: "flex", alignItems: "center" }}>{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, border: `1px solid ${G.border}`, background: page === totalPages ? "transparent" : G.cardAlt, color: page === totalPages ? G.fa : G.tx, cursor: page === totalPages ? "not-allowed" : "pointer" }}
              >
                다음 →
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedMo && (
        <MoDetailModal
          moId={selectedMo.id}
          moRow={selectedMo.row}
          onClose={() => setSelectedMo(null)}
        />
      )}
    </div>
  )
}
