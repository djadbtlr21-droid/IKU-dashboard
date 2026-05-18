import { useState, useEffect, useCallback } from 'react'
import { fetchMoDetail } from '../api/client'
import StyleImageCarousel from './StyleImageCarousel'
import {
  getMoNumber, getMoSku, getMoFactory, getMoStatus,
  getPlanQty, getActualQty, getEndDate, isOverdue, isDelayed,
  STATUS_COLORS, parseZohoDate, parseSpecJSON,
} from '../utils/moHelpers'

function safe(val) {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'object') return val.zc_display_value || val.display_value || JSON.stringify(val)
  return String(val) || '—'
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#C9A86E' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function InfoRow({ label, value, highlight }) {
  return (
    <div className="flex items-start gap-3 py-2" style={{ borderBottom: '1px solid rgba(201,168,110,0.08)' }}>
      <span className="text-xs w-36 flex-shrink-0 mt-0.5" style={{ color: '#8896B3' }}>{label}</span>
      <span className={`text-sm font-medium flex-1 break-words ${highlight ? 'text-red-400' : ''}`}
        style={highlight ? {} : { color: '#F5F1E8' }}>
        {value || '—'}
      </span>
    </div>
  )
}

function CollapsibleSection({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full text-left py-2"
        style={{ borderBottom: '1px solid rgba(201,168,110,0.1)', color: '#C9A86E' }}
      >
        <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-xs font-bold tracking-widest uppercase">{title}</span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

// Renders Top_Spec_JSON / Bottom_Spec_JSON
// Format: array of {pom, s, m, l, xl, notes} after parsing
function SpecTable({ json }) {
  if (!json) return <p className="text-xs" style={{ color: '#8896B3' }}>데이터 없음 · 无数据</p>

  const rows = parseSpecJSON(json)
  if (!rows || !rows.length) return <p className="text-xs" style={{ color: '#8896B3' }}>데이터 없음 · 无数据</p>

  // Collect size columns (everything except pom and notes)
  const allKeys = Object.keys(rows[0] || {})
  const sizeKeys = allKeys.filter((k) => k !== 'pom' && k !== 'notes' && k !== 'ID' && k !== 'zc_display_value')

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th className="text-left py-1.5 px-2" style={{ color: '#8896B3', background: '#1A1F2E' }}>POM</th>
            {sizeKeys.map((s) => (
              <th key={s} className="py-1.5 px-2 text-center uppercase" style={{ color: '#C9A86E', background: '#1A1F2E' }}>{s}</th>
            ))}
            {allKeys.includes('notes') && (
              <th className="py-1.5 px-2 text-left" style={{ color: '#8896B3', background: '#1A1F2E' }}>비고</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(201,168,110,0.06)' }}>
              <td className="py-1.5 px-2 font-medium" style={{ color: '#F5F1E8' }}>{safe(row.pom)}</td>
              {sizeKeys.map((s) => (
                <td key={s} className="py-1.5 px-2 text-center" style={{ color: '#94A3B8' }}>
                  {row[s] ?? '—'}
                </td>
              ))}
              {allKeys.includes('notes') && (
                <td className="py-1.5 px-2" style={{ color: '#8896B3' }}>{row.notes || ''}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Plan_MO_Lines: [{Plan_Color, Plan_Sizes, Plan_Quantity, ...}]
// Each line = one color × size combination
function MatrixTable({ lines = [] }) {
  if (!lines.length) {
    return <p className="text-xs" style={{ color: '#8896B3' }}>서브폼 데이터 없음 · 无子表单数据</p>
  }

  const colors = [...new Set(lines.map((l) => safe(l.Plan_Color || l.Color || l.color)))]
  const sizes = [...new Set(lines.map((l) => safe(l.Plan_Sizes || l.Size || l.size)))]

  function cell(color, size) {
    const row = lines.find((l) =>
      safe(l.Plan_Color || l.Color || l.color) === color &&
      safe(l.Plan_Sizes || l.Size || l.size) === size
    )
    if (!row) return null
    return {
      plan: Number(row.Plan_Quantity || row.Plan_Qty || row.plan_qty || 0),
      price: row.Plan_Unit_Price || null,
    }
  }

  function cellBg(plan) {
    if (!plan) return 'transparent'
    return 'rgba(201,168,110,0.08)'
  }

  const colTotals = sizes.map((size) =>
    lines.filter((l) => safe(l.Plan_Sizes || l.Size || l.size) === size)
      .reduce((sum, l) => sum + Number(l.Plan_Quantity || 0), 0)
  )
  const grandTotal = colTotals.reduce((a, b) => a + b, 0)

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th className="py-1.5 px-2 text-left" style={{ color: '#8896B3', background: '#1A1F2E' }}>컬러 · 颜色</th>
            {sizes.map((s) => (
              <th key={s} className="py-1.5 px-2 text-center" style={{ color: '#C9A86E', background: '#1A1F2E' }}>{s}</th>
            ))}
            <th className="py-1.5 px-2 text-center" style={{ color: '#8896B3', background: '#1A1F2E' }}>합계</th>
          </tr>
        </thead>
        <tbody>
          {colors.map((color) => {
            let rowTotal = 0
            return (
              <tr key={color} style={{ borderBottom: '1px solid rgba(201,168,110,0.06)' }}>
                <td className="py-1.5 px-2 font-medium" style={{ color: '#F5F1E8' }}>{color}</td>
                {sizes.map((size) => {
                  const data = cell(color, size)
                  if (data) rowTotal += data.plan
                  return (
                    <td key={size} className="py-1.5 px-2 text-center" style={{ background: cellBg(data?.plan) }}>
                      {data?.plan > 0 ? (
                        <span style={{ color: '#C9A86E', fontWeight: 600 }}>{data.plan}</span>
                      ) : '—'}
                    </td>
                  )
                })}
                <td className="py-1.5 px-2 text-center font-bold" style={{ color: '#C9A86E' }}>
                  {rowTotal || '—'}
                </td>
              </tr>
            )
          })}
          {/* Total row */}
          <tr style={{ background: 'rgba(201,168,110,0.05)', borderTop: '2px solid rgba(201,168,110,0.2)' }}>
            <td className="py-1.5 px-2 font-bold text-xs" style={{ color: '#8896B3' }}>합계 · 合计</td>
            {colTotals.map((t, i) => (
              <td key={i} className="py-1.5 px-2 text-center font-bold" style={{ color: '#F5F1E8' }}>{t || '—'}</td>
            ))}
            <td className="py-1.5 px-2 text-center font-bold" style={{ color: '#C9A86E' }}>{grandTotal}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default function MoDetailModal({ moId, moRow, onClose }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!moId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    fetchMoDetail(moId)
      .then((data) => {
        console.log('[MoDetailModal] response:', JSON.stringify(data).slice(0, 2000))
        setDetail(data)
      })
      .catch((err) => {
        console.error('[MoDetailModal] error:', err)
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [moId])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Record resolution: mo-detail returns {data:[...]} same as list
  const record = (() => {
    if (!detail) return null
    if (Array.isArray(detail.data)) return detail.data[0] || null
    if (detail.data && typeof detail.data === 'object') return detail.data
    return detail
  })()

  // Use moRow for instant display while loading
  const src = record || moRow || {}

  const moNumber = getMoNumber(src)
  const sku = getMoSku(src)
  const factory = getMoFactory(src)
  const status = getMoStatus(src)
  const planQty = getPlanQty(src)
  const actualQty = getActualQty(src)
  const progress = planQty ? Math.min(100, Math.round((actualQty / planQty) * 100)) : 0
  const endDate = getEndDate(src)
  const overdue = isOverdue(src)
  const delayed = isDelayed(src)
  const statusColors = STATUS_COLORS(status)

  // Style_SKU is an object: {ID, Style_SKU, zc_display_value}
  const styleRecordId = record?.Style_SKU?.ID || null

  const planLines = (record?.Plan_MO_Lines || []).filter(Boolean)
  const topSpec = record?.Top_Spec_JSON || null
  const bottomSpec = record?.Bottom_Spec_JSON || null

  const daysRemaining = endDate
    ? Math.ceil((new Date() - (parseZohoDate(endDate) || new Date())) / 86400000) * -1
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.75)', animation: 'fadeIn 0.2s ease' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full rounded-2xl flex flex-col overflow-hidden"
        style={{
          maxWidth: 1100,
          maxHeight: '95vh',
          background: '#1A1F2E',
          border: '1px solid rgba(201,168,110,0.2)',
          boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
          animation: 'slideUp 0.3s ease-out',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(201,168,110,0.15)', background: '#252B3D' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-bold" style={{ color: '#C9A86E', fontFamily: 'Pretendard, sans-serif' }}>
              {moNumber}
            </h2>
            {sku && sku !== '—' && (
              <span className="text-sm" style={{ color: '#8896B3' }}>{sku}</span>
            )}
            {status && (
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ background: statusColors.bg, color: statusColors.text }}>
                <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 flex-shrink-0" style={{ background: statusColors.dot }} />
                {status}
              </span>
            )}
            {delayed && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                ⚠ 지연
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl transition-colors flex-shrink-0"
            style={{ color: '#8896B3' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT: Image panel */}
          <div className="lg:w-2/5 p-5 flex-shrink-0 overflow-y-auto scrollbar-thin"
            style={{ borderRight: '1px solid rgba(201,168,110,0.1)' }}>
            <StyleImageCarousel styleSku={sku !== '—' ? sku : null} recordId={styleRecordId} />
            {sku && sku !== '—' && (
              <div className="mt-4 text-center">
                <p className="text-sm font-semibold" style={{ color: '#C9A86E' }}>{sku}</p>
                {src.Chi_Style_Name && (
                  <p className="text-xs mt-1" style={{ color: '#8896B3' }}>{src.Chi_Style_Name}</p>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Info panel */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-5 lg:p-6">
            {loading && !record && (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="shimmer h-10 rounded-xl" />
                ))}
              </div>
            )}
            {error && (
              <div className="p-4 rounded-xl text-sm text-red-400 mb-4"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                오류 · 错误: {error}
              </div>
            )}

            {/* Always render info from moRow/record */}
            <>
              {/* Section A: 기본정보 */}
              <Section title="기본 정보 · 基本信息">
                <InfoRow label="MO 번호 · MO号" value={moNumber} />
                <InfoRow label="스타일 SKU · 款号" value={sku} />
                <InfoRow label="스타일명 (중문)" value={safe(src.Chi_Style_Name)} />
                <InfoRow label="스타일명 (영문)" value={safe(src.Eng_Style_Name)} />
                <InfoRow label="공장 · 工厂" value={factory} />
                <InfoRow label="시즌 · 季节" value={safe(src.Season)} />
                <InfoRow label="계획 연월 · 计划年月" value={src.Plan_Year && src.Plan_Month ? `${src.Plan_Year}-${String(src.Plan_Month).padStart(2, '0')}` : '—'} />
                <InfoRow label="주문확인일 · 订单日期" value={safe(src.Order_Date)} />
                <InfoRow label="오더 상태 · 订单状态" value={safe(src.Order_Status)} />
                <InfoRow label="납기 상태 · 交货状态" value={safe(src.Delivery_Status)} />
                <InfoRow label="소재 · 面料" value={safe(src.Material_Type)} />
              </Section>

              {/* Section B: 수량정보 */}
              <Section title="수량 정보 · 数量信息">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl p-4 text-center" style={{ background: '#252B3D' }}>
                    <p className="text-xs mb-1" style={{ color: '#8896B3' }}>계획 · 计划</p>
                    <p className="text-2xl font-bold" style={{ color: '#C9A86E' }}>{planQty.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl p-4 text-center" style={{ background: '#252B3D' }}>
                    <p className="text-xs mb-1" style={{ color: '#8896B3' }}>실적 · 实际</p>
                    <p className="text-2xl font-bold" style={{ color: '#10B981' }}>{actualQty.toLocaleString()}</p>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1.5" style={{ color: '#8896B3' }}>
                    <span>진행률 · 进度</span>
                    <span style={{ color: '#C9A86E' }}>{progress}%</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#2F3650' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #C9A86E, #DFC08A)' }}
                    />
                  </div>
                </div>
                <InfoRow label="예정 출하일 · 预计出货日" value={safe(src.Expected_Delivery)} />
                <InfoRow label="출하일 · 出货日" value={safe(src.Ship_Date)} highlight={overdue} />
                {daysRemaining !== null && (
                  <InfoRow
                    label="D-Day"
                    value={daysRemaining < 0
                      ? `${Math.abs(daysRemaining)}일 초과 · 已超期${Math.abs(daysRemaining)}天`
                      : daysRemaining === 0 ? 'D-Day!' : `D-${daysRemaining}`}
                    highlight={daysRemaining <= 0}
                  />
                )}
                <InfoRow label="포장 수량 합계 · 包装合计" value={safe(src.Inner_Pack_Total_Qty)} />
              </Section>

              {/* Section C: Plan Matrix */}
              <Section title="계획 매트릭스 · 计划矩阵">
                <MatrixTable lines={planLines} />
                {planLines.length === 0 && loading && (
                  <div className="shimmer h-20 rounded-lg" />
                )}
              </Section>

              {/* Section D: Size Spec — collapsible */}
              <CollapsibleSection title="사이즈 스펙 · 尺寸规格">
                <div className="mb-5">
                  <p className="text-xs font-semibold mb-2" style={{ color: '#8896B3' }}>Top Spec</p>
                  <SpecTable json={topSpec} />
                </div>
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#8896B3' }}>Bottom Spec</p>
                  <SpecTable json={bottomSpec} />
                </div>
              </CollapsibleSection>

              {/* Section E: Material */}
              <CollapsibleSection title="소재 정보 · 面料信息">
                <InfoRow label="소재 · 面料" value={safe(src.Material_Type)} />
                <InfoRow label="Business Entity" value={safe(src.Business_Entity)} />
              </CollapsibleSection>

              {/* Section F: Packing / Shipment */}
              <CollapsibleSection title="포장/출하 · 包装出货">
                <InfoRow label="Inner Pack 수 · 内包数" value={safe(src.Inner_Pack_Count)} />
                <InfoRow label="Master Bag 수 · 主袋数" value={safe(src.Master_Bag_Count)} />
                <InfoRow label="Inner Pack 총 수량" value={safe(src.Inner_Pack_Total_Qty)} />
                <InfoRow label="출하일 · 出货日期" value={safe(src.Ship_Date)} />
                <InfoRow label="수정일 · 修改时间" value={safe(src.Modified_Time)} />
              </CollapsibleSection>
            </>
          </div>
        </div>
      </div>
    </div>
  )
}
