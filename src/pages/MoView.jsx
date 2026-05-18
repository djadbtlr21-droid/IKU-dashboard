import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { fetchMoList } from '../api/client'
import MoDetailModal from '../components/MoDetailModal'
import { SkeletonCard, SkeletonTable } from '../components/SkeletonLoader'
import {
  getMoNumber, getMoSku, getMoFactory, getMoStatus,
  getPlanQty, getActualQty, getEndDate, getProgress, isOverdue,
  STATUS_COLORS, getMonthKey,
} from '../utils/moHelpers'

const PAGE_SIZE = 50

function SortIcon({ dir }) {
  if (!dir) return <span style={{ color: '#3A4268' }}>⇅</span>
  return <span style={{ color: '#C9A86E' }}>{dir === 'asc' ? '↑' : '↓'}</span>
}

function StatusBadge({ status }) {
  const c = STATUS_COLORS(status)
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: c.bg, color: c.text }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: c.dot }} />
      {status || '—'}
    </span>
  )
}

function SummaryCard({ number, label, icon, color = '#C9A86E', loading }) {
  if (loading) return <SkeletonCard />
  return (
    <div className="rounded-xl p-5 flex flex-col gap-2" style={{ background: '#252B3D' }}>
      <div className="flex items-center justify-between">
        <span style={{ color: color, fontSize: 28, fontWeight: 700, fontFamily: 'Inter' }}>
          {number}
        </span>
        <span>{icon}</span>
      </div>
      <p className="text-xs font-medium" style={{ color: '#8896B3' }}>{label}</p>
    </div>
  )
}

function MonthTabs({ months, selected, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => onChange(null)}
        className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
        style={{
          background: selected === null ? 'rgba(201,168,110,0.15)' : 'transparent',
          color: selected === null ? '#C9A86E' : '#8896B3',
          border: selected === null ? '1px solid rgba(201,168,110,0.3)' : '1px solid transparent',
        }}
      >
        전체 · 全部
      </button>
      {months.map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: selected === m ? 'rgba(201,168,110,0.15)' : 'transparent',
            color: selected === m ? '#C9A86E' : '#8896B3',
            border: selected === m ? '1px solid rgba(201,168,110,0.3)' : '1px solid transparent',
          }}
        >
          {m}
        </button>
      ))}
    </div>
  )
}

const CHART_COLORS = {
  Completed: '#10B981',
  'In Progress': '#C9A86E',
  'Not Started': '#4B5563',
  Overdue: '#EF4444',
}

export default function MoView() {
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
        console.log('[MoView] raw response:', JSON.stringify(data).slice(0, 1000))
        const rows = data?.data || data?.records || data?.result || []
        console.log('[MoView] parsed rows count:', rows.length)
        if (rows.length > 0) {
          console.log('[MoView] first record keys:', Object.keys(rows[0]))
          console.log('[MoView] first record sample:', JSON.stringify(rows[0]).slice(0, 500))
        }
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

  // Months from data (last 4)
  const months = useMemo(() => {
    const keys = [...new Set(moList.map(getMonthKey).filter(Boolean))].sort().reverse()
    return keys.slice(0, 4)
  }, [moList])

  // Default to current month if exists
  useEffect(() => {
    if (months.length && selectedMonth === null) {
      const now = new Date()
      const yy = String(now.getFullYear()).slice(-2)
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const cur = `${yy}.${mm}`
      if (months.includes(cur)) setSelectedMonth(cur)
    }
  }, [months])

  // Filtered by month + factory
  const filtered = useMemo(() => {
    return moList.filter((mo) => {
      if (selectedMonth && getMonthKey(mo) !== selectedMonth) return false
      if (selectedFactory && getMoFactory(mo) !== selectedFactory) return false
      return true
    })
  }, [moList, selectedMonth, selectedFactory])

  // Summary stats (from full list, not filtered)
  const stats = useMemo(() => {
    const total = moList.length
    const inProgress = moList.filter((m) => /progress|진행/i.test(getMoStatus(m))).length
    const completed = moList.filter((m) => /complet/i.test(getMoStatus(m))).length
    const notStarted = moList.filter((m) => /not.start|미시작/i.test(getMoStatus(m))).length
    const delayed = moList.filter((m) => isOverdue(m)).length
    return { total, inProgress, completed, notStarted, delayed }
  }, [moList])

  // Chart data: by factory
  const chartData = useMemo(() => {
    const factoryMap = {}
    filtered.forEach((mo) => {
      const f = getMoFactory(mo)
      if (!factoryMap[f]) factoryMap[f] = { factory: f, Completed: 0, 'In Progress': 0, 'Not Started': 0, Overdue: 0 }
      if (isOverdue(mo)) { factoryMap[f].Overdue += 1; return }
      const s = getMoStatus(mo)
      if (/complet/i.test(s)) factoryMap[f].Completed += 1
      else if (/progress/i.test(s)) factoryMap[f]['In Progress'] += 1
      else factoryMap[f]['Not Started'] += 1
    })
    return Object.values(factoryMap)
  }, [filtered])

  // Sorting
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
    { label: '총 MO · 总MO', number: stats.total, color: '#C9A86E', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#C9A86E"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
    { label: '진행중 · 进行中', number: stats.inProgress, color: '#C9A86E', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#C9A86E"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { label: '완료 · 完成', number: stats.completed, color: '#10B981', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#10B981"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { label: '미시작 · 未开始', number: stats.notStarted, color: '#94A3B8', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#94A3B8"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { label: '지연 · 延误', number: stats.delayed, color: '#EF4444', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#EF4444"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> },
  ]

  const COL = [
    { key: 'mo', label: 'MO#' },
    { key: 'sku', label: 'Style SKU · 款号' },
    { key: 'factory', label: '공장 · 工厂' },
    { key: 'plan', label: '계획수량 · 计划' },
    { key: 'actual', label: '실적수량 · 实际' },
    { key: 'progress', label: '진행률 · 进度' },
    { key: 'endDate', label: '마감일 · 截止日' },
    { key: 'status', label: '상태 · 状态' },
  ]

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {CARDS.map((c) => (
          <SummaryCard key={c.label} loading={loading} {...c} />
        ))}
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl text-sm text-red-400"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <strong>오류 · 错误:</strong> {error}
        </div>
      )}

      {/* Month tabs */}
      {!loading && (
        <div className="mb-4">
          <MonthTabs months={months} selected={selectedMonth} onChange={(m) => { setSelectedMonth(m); setPage(1) }} />
        </div>
      )}

      {/* Chart */}
      {!loading && chartData.length > 0 && (
        <div className="rounded-xl p-5 mb-6" style={{ background: '#252B3D' }}>
          <h2 className="text-sm font-bold mb-4" style={{ color: '#C9A86E', fontFamily: 'Pretendard' }}>
            공장별 MO 현황 · 按工厂MO状态
          </h2>
          <ResponsiveContainer width="100%" height={Math.max(80, chartData.length * 52)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 20, bottom: 0, left: 80 }}
              onClick={(d) => {
                if (d?.activePayload?.[0]) {
                  const f = d.activePayload[0].payload.factory
                  setSelectedFactory((prev) => prev === f ? null : f)
                  setPage(1)
                }
              }}
            >
              <XAxis type="number" stroke="#3A4268" tick={{ fill: '#8896B3', fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="factory"
                stroke="#3A4268"
                tick={{ fill: '#8896B3', fontSize: 11 }}
                width={76}
              />
              <Tooltip
                contentStyle={{ background: '#252B3D', border: '1px solid rgba(201,168,110,0.3)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#C9A86E', fontWeight: 600 }}
                itemStyle={{ color: '#F5F1E8' }}
              />
              {Object.entries(CHART_COLORS).map(([key, color]) => (
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
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs" style={{ color: '#8896B3' }}>필터: {selectedFactory}</span>
              <button onClick={() => setSelectedFactory(null)} className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                ✕ 해제
              </button>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#252B3D' }}>
        <div className="px-5 py-3 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(201,168,110,0.1)' }}>
          <h2 className="text-sm font-bold" style={{ color: '#C9A86E', fontFamily: 'Pretendard' }}>
            MO 목록 · MO列表
            {!loading && <span className="ml-2 text-xs font-normal" style={{ color: '#8896B3' }}>({sorted.length}건)</span>}
          </h2>
        </div>

        {loading ? (
          <SkeletonTable rows={8} />
        ) : sorted.length === 0 ? (
          <div className="py-16 text-center" style={{ color: '#3A4268' }}>
            <p className="text-sm">데이터가 없습니다 · 暂无数据</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#1A1F2E', borderBottom: '1px solid rgba(201,168,110,0.1)' }}>
                  {COL.map((c) => (
                    <th
                      key={c.key}
                      onClick={() => handleSort(c.key)}
                      className="px-4 py-3 text-left text-xs font-semibold cursor-pointer select-none whitespace-nowrap"
                      style={{ color: sortKey === c.key ? '#C9A86E' : '#8896B3' }}
                    >
                      {c.label} <SortIcon dir={sortKey === c.key ? sortDir : null} />
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
                  return (
                    <tr
                      key={moId || i}
                      onClick={() => setSelectedMo({ id: moId, row: mo })}
                      className="cursor-pointer transition-colors"
                      style={{
                        borderBottom: '1px solid rgba(201,168,110,0.06)',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(201,168,110,0.06)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'}
                    >
                      <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: '#C9A86E' }}>
                        {getMoNumber(mo)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#F5F1E8' }}>
                        {getMoSku(mo)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#F5F1E8' }}>
                        {getMoFactory(mo)}
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: '#8896B3' }}>
                        {getPlanQty(mo).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: '#F5F1E8' }}>
                        {getActualQty(mo).toLocaleString()}
                      </td>
                      <td className="px-4 py-3" style={{ minWidth: 120 }}>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#2F3650' }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #C9A86E, #DFC08A)' }}
                            />
                          </div>
                          <span className="text-xs w-8 text-right" style={{ color: '#C9A86E' }}>{progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"
                        style={{ color: overdue ? '#EF4444' : '#8896B3' }}>
                        {endDate || '—'}
                        {overdue && <span className="ml-1 text-xs">⚠</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={getMoStatus(mo)} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ borderTop: '1px solid rgba(201,168,110,0.1)' }}>
            <span className="text-xs" style={{ color: '#8896B3' }}>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} / {sorted.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded-lg text-xs"
                style={{
                  background: 'rgba(201,168,110,0.1)',
                  color: page === 1 ? '#3A4268' : '#C9A86E',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                }}
              >
                ← 이전
              </button>
              <span className="px-3 py-1 text-xs" style={{ color: '#8896B3' }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded-lg text-xs"
                style={{
                  background: 'rgba(201,168,110,0.1)',
                  color: page === totalPages ? '#3A4268' : '#C9A86E',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                다음 →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MO Detail Modal */}
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
