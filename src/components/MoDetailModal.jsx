import { useState, useEffect, useCallback } from 'react'
import { X, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { fetchMoDetail } from '../api/client'
import StyleImageCarousel from './StyleImageCarousel'
import {
  getMoNumber, getMoSku, getMoFactory, getMoStatus,
  getPlanQty, getActualQty, getEndDate, isOverdue, isDelayed,
  parseZohoDate, parseSpecJSON,
} from '../utils/moHelpers'

function safe(val) {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'object') return val.zc_display_value || val.display_value || JSON.stringify(val)
  return String(val) || '—'
}

function Section({ G, title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h3 className="syne" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: G.accent, marginBottom: 12 }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function InfoRow({ G, label, value, highlight }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "7px 0", borderBottom: `1px solid ${G.hair}` }}>
      <span style={{ fontSize: 11, width: 140, flexShrink: 0, marginTop: 1, color: G.mu, letterSpacing: ".2px" }}>{label}</span>
      <span className="num" style={{ fontSize: 13, fontWeight: 500, flex: 1, wordBreak: "break-word", color: highlight ? G.bad : G.tx }}>
        {value || '—'}
      </span>
    </div>
  )
}

function CollapsibleSection({ G, title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: 16 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
        padding: "8px 0", borderBottom: `1px solid ${G.hair}`, color: G.accent,
        background: "transparent", border: "none", cursor: "pointer", borderRadius: 0, borderBottomColor: G.hair, borderBottomWidth: 1, borderBottomStyle: "solid",
      }}>
        <ChevronRightIcon size={14} style={{ transition: "transform .15s", transform: open ? "rotate(90deg)" : "none" }} />
        <span className="syne" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" }}>{title}</span>
      </button>
      {open && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  )
}

function SpecTable({ G, json }) {
  if (!json) return <p style={{ fontSize: 11, color: G.mu }}>데이터 없음 · 无数据</p>
  const rows = parseSpecJSON(json)
  if (!rows || !rows.length) return <p style={{ fontSize: 11, color: G.mu }}>데이터 없음 · 无数据</p>

  const allKeys = Object.keys(rows[0] || {})
  const sizeKeys = allKeys.filter(k => k !== 'pom' && k !== 'notes' && k !== 'ID' && k !== 'zc_display_value')

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="num" style={{ fontSize: 11, width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "6px 8px", color: G.mu, background: G.cardAlt, fontWeight: 600 }}>POM</th>
            {sizeKeys.map(s => (
              <th key={s} style={{ padding: "6px 8px", textAlign: "center", textTransform: "uppercase", color: G.accent, background: G.cardAlt, fontWeight: 700 }}>{s}</th>
            ))}
            {allKeys.includes('notes') && (
              <th style={{ padding: "6px 8px", textAlign: "left", color: G.mu, background: G.cardAlt, fontWeight: 600 }}>비고</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${G.hair}` }}>
              <td style={{ padding: "6px 8px", fontWeight: 600, color: G.tx }}>{safe(row.pom)}</td>
              {sizeKeys.map(s => (
                <td key={s} style={{ padding: "6px 8px", textAlign: "center", color: G.mu }}>{row[s] ?? '—'}</td>
              ))}
              {allKeys.includes('notes') && <td style={{ padding: "6px 8px", color: G.mu }}>{row.notes || ''}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MatrixTable({ G, lines = [] }) {
  if (!lines.length) return <p style={{ fontSize: 11, color: G.mu }}>서브폼 데이터 없음 · 无子表单数据</p>

  const colors = [...new Set(lines.map(l => safe(l.Plan_Color || l.Color || l.color)))]
  const sizes = [...new Set(lines.map(l => safe(l.Plan_Sizes || l.Size || l.size)))]

  function cell(color, size) {
    const row = lines.find(l =>
      safe(l.Plan_Color || l.Color || l.color) === color &&
      safe(l.Plan_Sizes || l.Size || l.size) === size
    )
    if (!row) return null
    return { plan: Number(row.Plan_Quantity || row.Plan_Qty || row.plan_qty || 0) }
  }

  const colTotals = sizes.map(size =>
    lines.filter(l => safe(l.Plan_Sizes || l.Size || l.size) === size)
      .reduce((s, l) => s + Number(l.Plan_Quantity || 0), 0)
  )
  const grandTotal = colTotals.reduce((a, b) => a + b, 0)

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="num" style={{ fontSize: 11, width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ padding: "6px 8px", textAlign: "left", color: G.mu, background: G.cardAlt, fontWeight: 600 }}>컬러 · 颜色</th>
            {sizes.map(s => <th key={s} style={{ padding: "6px 8px", textAlign: "center", color: G.accent, background: G.cardAlt, fontWeight: 700 }}>{s}</th>)}
            <th style={{ padding: "6px 8px", textAlign: "center", color: G.mu, background: G.cardAlt, fontWeight: 600 }}>합계</th>
          </tr>
        </thead>
        <tbody>
          {colors.map(color => {
            let rowTotal = 0
            return (
              <tr key={color} style={{ borderBottom: `1px solid ${G.hair}` }}>
                <td style={{ padding: "6px 8px", fontWeight: 600, color: G.tx }}>{color}</td>
                {sizes.map(size => {
                  const data = cell(color, size)
                  if (data) rowTotal += data.plan
                  return (
                    <td key={size} style={{ padding: "6px 8px", textAlign: "center", background: data?.plan ? `${G.primary}1A` : "transparent" }}>
                      {data?.plan > 0 ? <span style={{ color: G.accent, fontWeight: 600 }}>{data.plan}</span> : '—'}
                    </td>
                  )
                })}
                <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: G.accent }}>{rowTotal || '—'}</td>
              </tr>
            )
          })}
          <tr style={{ background: `${G.primary}0D`, borderTop: `2px solid ${G.primary}33` }}>
            <td style={{ padding: "6px 8px", fontWeight: 700, color: G.mu }}>합계 · 合计</td>
            {colTotals.map((t, i) => <td key={i} style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: G.tx }}>{t || '—'}</td>)}
            <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: G.accent }}>{grandTotal}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default function MoDetailModal({ G, moId, moRow, onClose }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!moId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    fetchMoDetail(moId)
      .then(setDetail)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [moId])

  const handleKeyDown = useCallback((e) => { if (e.key === 'Escape') onClose() }, [onClose])
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const record = (() => {
    if (!detail) return null
    if (Array.isArray(detail.data)) return detail.data[0] || null
    if (detail.data && typeof detail.data === 'object') return detail.data
    return detail
  })()

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
  const styleRecordId = record?.Style_SKU?.ID || null
  const planLines = (record?.Plan_MO_Lines || []).filter(Boolean)
  const topSpec = record?.Top_Spec_JSON || null
  const bottomSpec = record?.Bottom_Spec_JSON || null
  const daysRemaining = endDate
    ? Math.ceil((new Date() - (parseZohoDate(endDate) || new Date())) / 86400000) * -1
    : null

  // Fallback G if not provided
  const T = G || { bg: "#FAFAF7", surf: "#FFFFFF", card: "#FFFFFF", cardAlt: "#FBF9F4",
    border: "#EDE8DE", hair: "#E4DED2", primary: "#C9A86E", accent: "#9A7228",
    tx: "#1A1714", mu: "#7A7268", fa: "#C8C0B2", ok: "#5E8C6E", bad: "#A14E3A",
    overlayBg: "rgba(26,23,20,0.45)", cardShadow: "0 2px 8px rgba(26,23,20,0.06)", dk: false }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        background: T.overlayBg, backdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease",
      }}
    >
      <div style={{
        width: "100%", maxWidth: 1100, maxHeight: "95vh", display: "flex", flexDirection: "column",
        background: T.surf, borderRadius: 16, border: `1px solid ${T.border}`,
        boxShadow: T.dk ? "0 32px 64px rgba(0,0,0,0.6)" : "0 24px 60px rgba(26,23,20,0.15)",
        overflow: "hidden", animation: "slideUp 0.3s ease-out",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${T.hair}`, background: T.cardAlt, flexShrink: 0, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 className="syne num" style={{ fontSize: 20, fontWeight: 700, color: T.accent, letterSpacing: "-.3px" }}>{moNumber}</h2>
            {sku && sku !== '—' && <span style={{ fontSize: 13, color: T.mu }}>{sku}</span>}
            {status && (
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, fontWeight: 600, background: `${T.primary}1A`, color: T.accent }}>
                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", marginRight: 6, background: T.primary }} />
                {status}
              </span>
            )}
            {delayed && (
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, fontWeight: 700, background: `${T.bad}1A`, color: T.bad }}>⚠ 지연</span>
            )}
          </div>
          <button onClick={onClose} style={{ padding: 8, borderRadius: 10, color: T.mu, background: "transparent", border: "none", cursor: "pointer", display: "flex" }}
            onMouseEnter={e => { e.currentTarget.style.background = `${T.bad}1A`; e.currentTarget.style.color = T.bad }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.mu }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }} className="modal-body">
          {/* Image */}
          <div style={{ width: "40%", padding: 20, flexShrink: 0, overflowY: "auto", borderRight: `1px solid ${T.hair}`, background: T.cardAlt }}>
            <StyleImageCarousel styleSku={sku !== '—' ? sku : null} recordId={styleRecordId} />
            {sku && sku !== '—' && (
              <div style={{ marginTop: 14, textAlign: "center" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.accent }}>{sku}</p>
                {src.Chi_Style_Name && <p style={{ fontSize: 11, marginTop: 4, color: T.mu }}>{src.Chi_Style_Name}</p>}
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
            {error && (
              <div style={{ padding: 12, borderRadius: 10, fontSize: 12, color: T.bad, background: `${T.bad}1A`, border: `1px solid ${T.bad}40`, marginBottom: 14 }}>
                오류 · 错误: {error}
              </div>
            )}

            <Section G={T} title="기본 정보 · 基本信息">
              <InfoRow G={T} label="MO 번호 · MO号" value={moNumber} />
              <InfoRow G={T} label="스타일 SKU · 款号" value={sku} />
              <InfoRow G={T} label="스타일명 (중문)" value={safe(src.Chi_Style_Name)} />
              <InfoRow G={T} label="스타일명 (영문)" value={safe(src.Eng_Style_Name)} />
              <InfoRow G={T} label="공장 · 工厂" value={factory} />
              <InfoRow G={T} label="시즌 · 季节" value={safe(src.Season)} />
              <InfoRow G={T} label="계획 연월 · 计划年月" value={src.Plan_Year && src.Plan_Month ? `${src.Plan_Year}-${String(src.Plan_Month).padStart(2, '0')}` : '—'} />
              <InfoRow G={T} label="주문확인일 · 订单日期" value={safe(src.Order_Date)} />
              <InfoRow G={T} label="오더 상태 · 订单状态" value={safe(src.Order_Status)} />
              <InfoRow G={T} label="생산 상태 · 生产状态" value={safe(src.Production_Status)} />
              <InfoRow G={T} label="납기 상태 · 交货状态" value={safe(src.Delivery_Status)} />
              <InfoRow G={T} label="소재 · 面料" value={safe(src.Material_Type)} />
            </Section>

            <Section G={T} title="수량 정보 · 数量信息">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div style={{ padding: "14px 16px", borderRadius: 10, background: T.cardAlt, border: `1px solid ${T.hair}`, textAlign: "center" }}>
                  <p style={{ fontSize: 11, color: T.mu, marginBottom: 4 }}>계획 · 计划</p>
                  <p className="num syne" style={{ fontSize: 22, fontWeight: 700, color: T.accent }}>{planQty.toLocaleString()}</p>
                </div>
                <div style={{ padding: "14px 16px", borderRadius: 10, background: T.cardAlt, border: `1px solid ${T.hair}`, textAlign: "center" }}>
                  <p style={{ fontSize: 11, color: T.mu, marginBottom: 4 }}>실적 · 实际</p>
                  <p className="num syne" style={{ fontSize: 22, fontWeight: 700, color: T.ok }}>{actualQty.toLocaleString()}</p>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.mu, marginBottom: 6 }}>
                  <span>진행률 · 进度</span>
                  <span className="num" style={{ color: T.accent, fontWeight: 600 }}>{progress}%</span>
                </div>
                <div style={{ height: 7, borderRadius: 999, overflow: "hidden", background: T.hair }}>
                  <div style={{ height: "100%", borderRadius: 999, width: `${progress}%`, background: `linear-gradient(90deg, ${T.primary}, ${T.primary}AA)`, transition: "width .6s" }} />
                </div>
              </div>
              <InfoRow G={T} label="예정 출하일 · 预计出货日" value={safe(src.Expected_Delivery)} />
              <InfoRow G={T} label="출하일 · 出货日" value={safe(src.Ship_Date)} highlight={overdue} />
              {daysRemaining !== null && (
                <InfoRow G={T} label="D-Day"
                  value={daysRemaining < 0
                    ? `${Math.abs(daysRemaining)}일 초과 · 已超期${Math.abs(daysRemaining)}天`
                    : daysRemaining === 0 ? 'D-Day!' : `D-${daysRemaining}`}
                  highlight={daysRemaining <= 0} />
              )}
              <InfoRow G={T} label="포장 합계 · 包装合计" value={safe(src.Inner_Pack_Total_Qty)} />
              <InfoRow G={T} label="Plan Grand Total" value={src.Plan_Grand_Total ? `$${Number(src.Plan_Grand_Total).toLocaleString()}` : '—'} />
              <InfoRow G={T} label="Actual Grand Total" value={src.Acture_Grand_Total ? `$${Number(src.Acture_Grand_Total).toLocaleString()}` : '—'} />
            </Section>

            <Section G={T} title="계획 매트릭스 · 计划矩阵">
              <MatrixTable G={T} lines={planLines} />
            </Section>

            <CollapsibleSection G={T} title="사이즈 스펙 · 尺寸规格">
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: T.mu, marginBottom: 6 }}>Top Spec</p>
                <SpecTable G={T} json={topSpec} />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: T.mu, marginBottom: 6 }}>Bottom Spec</p>
                <SpecTable G={T} json={bottomSpec} />
              </div>
            </CollapsibleSection>

            <CollapsibleSection G={T} title="소재 정보 · 面料信息">
              <InfoRow G={T} label="소재 · 面料" value={safe(src.Material_Type)} />
              <InfoRow G={T} label="Lining" value={safe(src.Lining_Type)} />
              <InfoRow G={T} label="Blended" value={safe(src.blended)} />
              <InfoRow G={T} label="Business Entity" value={safe(src.Business_Entity)} />
            </CollapsibleSection>

            <CollapsibleSection G={T} title="포장/출하 · 包装出货">
              <InfoRow G={T} label="Inner Pack 수 · 内包数" value={safe(src.Inner_Pack_Count)} />
              <InfoRow G={T} label="Master Bag 수 · 主袋数" value={safe(src.Master_Bag_Count)} />
              <InfoRow G={T} label="Inner Pack 총 수량" value={safe(src.Inner_Pack_Total_Qty)} />
              <InfoRow G={T} label="출하일 · 出货日期" value={safe(src.Ship_Date)} />
              <InfoRow G={T} label="수정일 · 修改时间" value={safe(src.Modified_Time)} />
            </CollapsibleSection>

            <CollapsibleSection G={T} title="일정 · 日程">
              <InfoRow G={T} label="Order Date" value={safe(src.Order_Date)} />
              <InfoRow G={T} label="Cutting Start" value={safe(src.Cutting_Start_Date)} />
              <InfoRow G={T} label="Cutting End" value={safe(src.Cutting_End_Date)} />
              <InfoRow G={T} label="Sewing Start" value={safe(src.Sewing_Start_Date)} />
              <InfoRow G={T} label="Sewing End" value={safe(src.Sewing_End_Date)} />
              <InfoRow G={T} label="Packing Start" value={safe(src.Packing_Start_Date)} />
              <InfoRow G={T} label="Expected Delivery" value={safe(src.Expected_Delivery)} />
              <InfoRow G={T} label="Ship Date" value={safe(src.Ship_Date)} />
            </CollapsibleSection>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .modal-body { flex-direction: column !important; }
          .modal-body > div:first-child { width: 100% !important; border-right: none !important; border-bottom: 1px solid ${T.hair} !important; }
        }
      `}</style>
    </div>
  )
}
