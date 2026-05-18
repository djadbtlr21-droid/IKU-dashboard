import { useState, useEffect, useCallback } from 'react'
import { fetchMoDetail } from '../api/client'
import StyleImageCarousel from './StyleImageCarousel'
import {
  getMoNumber, getMoSku, getMoFactory, getMoStatus,
  getPlanQty, getActualQty, getEndDate, getProgress, isOverdue, STATUS_COLORS,
} from '../utils/moHelpers'

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
      <span className="text-xs w-32 flex-shrink-0 mt-0.5" style={{ color: '#8896B3' }}>{label}</span>
      <span className={`text-sm font-medium flex-1 ${highlight ? 'text-red-400' : 'text-cream'}`}>{value || '—'}</span>
    </div>
  )
}

function CollapsibleSection({ title, children }) {
  const [open, setOpen] = useState(false)
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

function SpecTable({ json, title }) {
  if (!json) return <p className="text-xs" style={{ color: '#8896B3' }}>데이터 없음 · 无数据</p>
  let parsed
  try { parsed = typeof json === 'string' ? JSON.parse(json) : json } catch { return <p className="text-xs text-red-400">JSON 파싱 오류</p> }
  if (!parsed || typeof parsed !== 'object') return null

  const sizes = Object.keys(parsed)
  const poms = sizes.length > 0 ? Object.keys(parsed[sizes[0]]) : []

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th className="text-left py-1.5 px-2" style={{ color: '#8896B3', background: '#1A1F2E' }}>POM</th>
            {sizes.map((s) => (
              <th key={s} className="py-1.5 px-2 text-center" style={{ color: '#C9A86E', background: '#1A1F2E' }}>{s}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {poms.map((pom) => (
            <tr key={pom} style={{ borderBottom: '1px solid rgba(201,168,110,0.06)' }}>
              <td className="py-1.5 px-2 font-medium" style={{ color: '#F5F1E8' }}>{pom}</td>
              {sizes.map((s) => (
                <td key={s} className="py-1.5 px-2 text-center" style={{ color: '#94A3B8' }}>
                  {parsed[s]?.[pom] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MatrixTable({ lines = [], label }) {
  if (!lines.length) return <p className="text-xs" style={{ color: '#8896B3' }}>데이터 없음 · 无数据</p>

  const colors = [...new Set(lines.map((l) => l.Color || l.color || l.Colour || '—'))]
  const sizes = [...new Set(lines.map((l) => l.Size || l.size || '—'))]

  const cell = (color, size) => {
    const row = lines.find((l) => (l.Color || l.color || l.Colour || '—') === color && (l.Size || l.size || '—') === size)
    if (!row) return { plan: 0, actual: 0 }
    return { plan: Number(row.Plan_Qty || row.plan_qty || 0), actual: Number(row.Actual_Qty || row.actual_qty || 0) }
  }

  function cellColor(plan, actual) {
    if (!plan) return 'transparent'
    if (actual >= plan) return 'rgba(16,185,129,0.12)'
    if (actual > 0) return 'rgba(201,168,110,0.12)'
    return 'rgba(148,163,184,0.06)'
  }

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
            let totalPlan = 0, totalActual = 0
            return (
              <tr key={color} style={{ borderBottom: '1px solid rgba(201,168,110,0.06)' }}>
                <td className="py-1.5 px-2 font-medium" style={{ color: '#F5F1E8' }}>{color}</td>
                {sizes.map((size) => {
                  const { plan, actual } = cell(color, size)
                  totalPlan += plan; totalActual += actual
                  return (
                    <td key={size} className="py-1.5 px-2 text-center" style={{ background: cellColor(plan, actual) }}>
                      {plan > 0 ? (
                        <span>
                          <span style={{ color: '#C9A86E' }}>{plan}</span>
                          <span style={{ color: '#8896B3' }}> / </span>
                          <span style={{ color: actual >= plan ? '#10B981' : '#F5F1E8' }}>{actual}</span>
                        </span>
                      ) : '—'}
                    </td>
                  )
                })}
                <td className="py-1.5 px-2 text-center font-semibold" style={{ color: '#C9A86E' }}>
                  {totalPlan} / {totalActual}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function MoDetailModal({ moId, moRow, onClose }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const record = detail?.record || detail?.data?.[0] || detail

  useEffect(() => {
    if (!moId) return
    setLoading(true)
    setError(null)
    fetchMoDetail(moId)
      .then((data) => {
        console.log('[MoDetailModal] full detail response:', JSON.stringify(data).slice(0, 2000))
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

  const moNumber = record ? getMoNumber(record) : getMoNumber(moRow || {})
  const sku = record ? getMoSku(record) : getMoSku(moRow || {})
  const factory = record ? getMoFactory(record) : getMoFactory(moRow || {})
  const status = record ? getMoStatus(record) : getMoStatus(moRow || {})
  const planQty = record ? getPlanQty(record) : getPlanQty(moRow || {})
  const actualQty = record ? getActualQty(record) : getActualQty(moRow || {})
  const progress = Math.min(100, planQty ? Math.round((actualQty / planQty) * 100) : 0)
  const endDate = record ? getEndDate(record) : getEndDate(moRow || {})
  const overdue = record ? isOverdue(record) : isOverdue(moRow || {})
  const statusColors = STATUS_COLORS(status)

  const planLines = record?.Plan_MO_Lines || record?.plan_mo_lines || []
  const actualLines = record?.Actual_MO_Lines || record?.actual_mo_lines || []

  const styleRecordId = record?.Style?.ID || record?.Style_ID || null

  const daysRemaining = endDate
    ? Math.ceil((new Date(endDate) - new Date()) / 86400000)
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
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(201,168,110,0.15)', background: '#252B3D', flexShrink: 0 }}>
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold" style={{ color: '#C9A86E', fontFamily: 'Pretendard, sans-serif' }}>
              {moNumber}
            </h2>
            {status && (
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ background: statusColors.bg, color: statusColors.text }}>
                <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ background: statusColors.dot }} />
                {status}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl transition-colors"
            style={{ color: '#8896B3' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
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
            <StyleImageCarousel styleSku={sku} recordId={styleRecordId} />
            <div className="mt-4 text-center">
              <p className="text-sm font-semibold" style={{ color: '#C9A86E' }}>{sku}</p>
            </div>
          </div>

          {/* RIGHT: Info panel */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-5 lg:p-6">
            {loading && (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="shimmer h-10 rounded-xl" />
                ))}
              </div>
            )}
            {error && (
              <div className="p-4 rounded-xl text-sm text-red-400"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                오류 · 错误: {error}
              </div>
            )}
            {!loading && !error && (
              <>
                {/* Section A: 기본정보 */}
                <Section title="기본 정보 · 基本信息">
                  <InfoRow label="MO 번호 · MO号" value={moNumber} />
                  <InfoRow label="스타일 SKU · 款号" value={sku} />
                  <InfoRow label="스타일명 (중문)" value={record?.Chi_Style_Name || record?.Style_Name_CN || '—'} />
                  <InfoRow label="스타일명 (영문)" value={record?.Eng_Style_Name || record?.Style_Name_EN || '—'} />
                  <InfoRow label="공장 · 工厂" value={factory} />
                  <InfoRow label="시즌 · 季节" value={record?.Season || '—'} />
                  <InfoRow label="연월 · 年月" value={record?.Year_Month || record?.YM || '—'} />
                  <InfoRow label="생성일 · 创建日期" value={record?.Created_Time ? new Date(record.Created_Time).toLocaleDateString('ko-KR') : '—'} />
                  <InfoRow label="생성자 · 创建人" value={record?.Created_By?.display_value || record?.Created_By || '—'} />
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
                  <InfoRow
                    label="마감일 · 截止日"
                    value={endDate ? `${endDate}${overdue ? ' ⚠️' : ''}` : '—'}
                    highlight={overdue}
                  />
                  {daysRemaining !== null && (
                    <InfoRow
                      label="남은 일수 · 剩余天数"
                      value={daysRemaining < 0 ? `${Math.abs(daysRemaining)}일 초과 · 已超期${Math.abs(daysRemaining)}天` : `D-${daysRemaining}`}
                      highlight={daysRemaining < 0}
                    />
                  )}
                </Section>

                {/* Section C: Matrix */}
                <Section title="Plan vs Actual · 计划vs实际矩阵">
                  {planLines.length > 0 ? (
                    <MatrixTable lines={planLines.map((p, i) => {
                      const a = actualLines.find((al) =>
                        (al.Color || al.color || al.Colour) === (p.Color || p.color || p.Colour) &&
                        (al.Size || al.size) === (p.Size || p.size)
                      ) || {}
                      return { ...p, Actual_Qty: a.Actual_Qty || a.actual_qty || 0 }
                    })} />
                  ) : (
                    <p className="text-xs" style={{ color: '#8896B3' }}>서브폼 데이터 없음 · 无子表单数据</p>
                  )}
                </Section>

                {/* Section D: Spec */}
                <CollapsibleSection title="사이즈 스펙 · 尺寸规格">
                  <div className="mb-4">
                    <p className="text-xs font-semibold mb-2" style={{ color: '#8896B3' }}>Top Spec</p>
                    <SpecTable json={record?.Top_Spec_JSON || record?.Top_Spec} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: '#8896B3' }}>Bottom Spec</p>
                    <SpecTable json={record?.Bottom_Spec_JSON || record?.Bottom_Spec} />
                  </div>
                </CollapsibleSection>

                {/* Section E: Material */}
                <CollapsibleSection title="소재 정보 · 面料信息">
                  <InfoRow label="원단 무게 · 面料克重" value={record?.Fabric_Weight ? `${record.Fabric_Weight} g/m²` : '—'} />
                  <InfoRow label="안감 무게 · 里布克重" value={record?.Lining_Weight ? `${record.Lining_Weight} g/m²` : '—'} />
                  <InfoRow label="안감 비고 · 里布备注" value={record?.Lining_Notes || '—'} />
                  <InfoRow label="원단 구성 · 成分" value={record?.Fabric_Composition || record?.Composition || '—'} />
                </CollapsibleSection>

                {/* Section F: Packing/Shipment */}
                <CollapsibleSection title="포장/출하 · 包装出货">
                  <InfoRow label="Inner Pack 수 · 内包数量" value={record?.Inner_Pack_Count ?? '—'} />
                  <InfoRow label="Master Bag 수 · 主袋数量" value={record?.Master_Bag_Count ?? '—'} />
                  <InfoRow label="출하 상태 · 出货状态" value={record?.Shipment_Status || record?.Ship_Status || '—'} />
                  <InfoRow label="출하일 · 出货日期" value={record?.Ship_Date || record?.Shipment_Date || '—'} />
                </CollapsibleSection>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
