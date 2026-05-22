import { useEffect } from 'react'
import {
  X, Calendar, Layers, Ship, DollarSign,
  Package, CheckCircle2, FileText, Camera, File,
} from 'lucide-react'
import { parseZohoDate } from '../utils/moHelpers'
import { classifyContainer, parseContainerLines } from '../hooks/useShipmentData'

// ─── Helpers ──────────────────────────────────────────────

function safe(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'object') return v.zc_display_value || v.display_value || JSON.stringify(v).slice(0, 60)
  return String(v)
}

function fmtNum(v) {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  return isNaN(n) ? String(v) : n.toLocaleString()
}

function fmtMoney(v, currency = 'USD') {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (isNaN(n)) return String(v)
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

// ─── Sub-components ───────────────────────────────────────

function SectionTitle({ G, icon, label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 14, paddingBottom: 8,
      borderBottom: `1px solid ${G.hair}`,
    }}>
      {icon}
      <h3 className="syne" style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '2px',
        textTransform: 'uppercase', color: G.accent,
      }}>
        {label}
      </h3>
    </div>
  )
}

function Field({ G, label, value, accent }) {
  return (
    <div style={{
      background: G.card, border: `1px solid ${G.border}`,
      borderRadius: 8, padding: '10px 14px',
    }}>
      <div style={{
        fontSize: 10, color: G.mu, letterSpacing: '.5px',
        fontWeight: 600, marginBottom: 4, textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: accent || G.tx, fontWeight: 500, wordBreak: 'break-word' }}>
        {value || '—'}
      </div>
    </div>
  )
}

// ─── Date journey (4-step progress bar) ───────────────────

function DateJourney({ G, container }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const stuffing = parseZohoDate(container.Stuffing_Date)
  const etd = parseZohoDate(container.ETD)
  const atd = parseZohoDate(container.ATD)
  const eta = parseZohoDate(container.ETA)
  const ata = parseZohoDate(container.ATA)
  const ccd = parseZohoDate(container.CCD)

  // Step is "completed" if the actual date is recorded
  const steps = [
    {
      id: 'stuffing',
      label: '적입',
      sublabel: 'Stuffing',
      planDate: container.Stuffing_Date,
      actualDate: container.Stuffing_Date,
      done: !!stuffing,
    },
    {
      id: 'departure',
      label: '출항',
      sublabel: 'ETD / ATD',
      planDate: container.ETD,
      actualDate: container.ATD,
      done: !!atd,
    },
    {
      id: 'arrival',
      label: '도착',
      sublabel: 'ETA / ATA',
      planDate: container.ETA,
      actualDate: container.ATA,
      done: !!ata,
    },
    {
      id: 'customs',
      label: '통관',
      sublabel: 'CCD',
      planDate: container.CCD,
      actualDate: container.CCD,
      done: !!ccd,
    },
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
      {steps.map((step, i) => (
        <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', flex: 1 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            {/* Circle */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: step.done ? G.ok : (G.dk ? G.fa : G.hair),
              border: `2px solid ${step.done ? G.ok : G.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {step.done
                ? <CheckCircle2 size={16} style={{ color: G.dk ? G.bg : '#FFF' }} />
                : <span style={{ width: 8, height: 8, borderRadius: '50%', background: G.border }} />
              }
            </div>
            {/* Labels */}
            <div style={{ textAlign: 'center', minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: step.done ? G.tx : G.mu }}>{step.label}</div>
              <div style={{ fontSize: 9, color: G.fa }}>{step.sublabel}</div>
              {step.planDate && step.planDate !== step.actualDate && (
                <div className="num" style={{ fontSize: 9, color: G.mu, marginTop: 2 }}>
                  계획 {step.planDate}
                </div>
              )}
              {step.actualDate && (
                <div className="num" style={{ fontSize: 9, color: step.done ? G.ok : G.mu, fontWeight: step.done ? 700 : 400, marginTop: 1 }}>
                  {step.actualDate}
                </div>
              )}
              {!step.actualDate && step.planDate && (
                <div className="num" style={{ fontSize: 9, color: G.fa, marginTop: 1 }}>
                  {step.planDate}
                </div>
              )}
            </div>
          </div>
          {/* Connector line between steps */}
          {i < steps.length - 1 && (
            <div style={{
              height: 2, flex: 1,
              background: steps[i + 1].done ? G.ok : G.hair,
              marginTop: 15, minWidth: 16,
            }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────

const STATUS_DISPLAY = {
  imminent:  { kr: '출고임박',  cn: '即将出货',  hue: '#F59E0B' },
  sea:       { kr: '해상이동중', cn: '海运中',    hue: '#8B5CF6' },
  port:      { kr: '항구도착',  cn: '已到港',    hue: '#0EA5E9' },
  warehouse: { kr: '창고도착',  cn: '仓库到达',  hue: '#10B981' },
  pending:   { kr: '출고대기',  cn: '待出货',    hue: '#94A3B8' },
}

export default function ContainerDetailModal({ G, container, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const status = classifyContainer(container, today)
  const statusInfo = STATUS_DISPLAY[status] || STATUS_DISPLAY.pending
  const lines = parseContainerLines(container.Container_Lines)
  const blNumber = container.B_L_Number || container.BL_Number || ''
  const blStatus = container.B_L_Status || container.BL_Status || ''
  const currency = safe(container.Currency)

  const sectionGap = { marginBottom: 24 }
  const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }
  const grid3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }

  return (
    <div
      className="ctr-modal-wrap"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        padding: 16, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: G.overlayBg, backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        className="ctr-modal"
        style={{
          width: 'min(860px, 95vw)', maxHeight: '90vh',
          background: G.surf, color: G.tx,
          borderRadius: 16, border: `1px solid ${G.border}`,
          boxShadow: G.dk ? '0 32px 64px rgba(0,0,0,0.6)' : '0 24px 64px rgba(26,23,20,0.18)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          animation: 'slideUp 0.3s ease-out',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: `1px solid ${G.hair}`,
          background: G.cardAlt, gap: 14, flexShrink: 0,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <span className="syne num" style={{
                fontSize: 22, fontWeight: 700, color: G.primary, letterSpacing: '-.3px',
              }}>
                {safe(container.Container_ID) !== '—' ? container.Container_ID : '(미등록)'}
              </span>
              <span style={{
                padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                background: `${statusInfo.hue}22`, color: statusInfo.hue,
                border: `1px solid ${statusInfo.hue}44`,
              }}>
                {statusInfo.kr} · {statusInfo.cn}
              </span>
            </div>
            {(container.Origin_Port || container.Destination_Port) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: G.mu, fontWeight: 500 }}>
                <span>{safe(container.Origin_Port)}</span>
                <span style={{ color: G.fa }}>→</span>
                <span>{safe(container.Destination_Port)}</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="close"
            style={{
              width: 36, height: 36, borderRadius: '50%', background: 'transparent',
              border: `1px solid ${G.border}`, color: G.mu, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .15s', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${G.bad}1A`; e.currentTarget.style.color = G.bad; e.currentTarget.style.borderColor = G.bad }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = G.mu; e.currentTarget.style.borderColor = G.border }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Section 1 — Dates / 일정 */}
          <div style={sectionGap}>
            <SectionTitle G={G}
              icon={<Calendar size={14} style={{ color: G.accent }} />}
              label="Dates / 일정 / 日期"
            />
            <div style={{ marginBottom: 16 }}>
              <DateJourney G={G} container={container} />
            </div>
            <div style={grid3}>
              <Field G={G} label="Stuffing Date" value={safe(container.Stuffing_Date)} />
              <Field G={G} label="ETD (계획)" value={safe(container.ETD)} />
              <Field G={G} label="ATD (실제)" value={safe(container.ATD)} accent={container.ATD ? G.ok : undefined} />
              <Field G={G} label="ETA (계획)" value={safe(container.ETA)} />
              <Field G={G} label="ATA (실제)" value={safe(container.ATA)} accent={container.ATA ? G.ok : undefined} />
              <Field G={G} label="통관완료 / CCD" value={safe(container.CCD)} accent={container.CCD ? G.ok : undefined} />
            </div>
          </div>

          {/* Section 2 — Container Lines */}
          <div style={sectionGap}>
            <SectionTitle G={G}
              icon={<Layers size={14} style={{ color: G.accent }} />}
              label="Container Lines / 컨테이너 내용 / 装箱明细"
            />
            {lines.length === 0 ? (
              <div style={{
                padding: '20px 16px', borderRadius: 10, textAlign: 'center',
                background: G.cardAlt, border: `1px dashed ${G.border}`,
              }}>
                <div style={{ fontSize: 12, color: G.mu, marginBottom: 4 }}>
                  컨테이너 라인 데이터 없음 · 暂无装箱明细
                </div>
                <div style={{ fontSize: 10, color: G.fa }}>
                  Zoho REST API 제한으로 subform 데이터가 반환되지 않을 수 있습니다
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: G.cardAlt }}>
                      {['MO', 'Style', 'Color', 'Qty', 'Unit Price', 'Line Total', 'Cartons', 'CBM'].map(h => (
                        <th key={h} style={{
                          padding: '8px 10px', textAlign: 'left',
                          fontSize: 10, fontWeight: 700, color: G.mu,
                          letterSpacing: '.5px', borderBottom: `1px solid ${G.hair}`,
                          whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${G.hair}` }}>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: G.accent }}>{safe(line.Manufacturing_Order)}</td>
                        <td style={{ padding: '8px 10px', color: G.tx }}>{safe(line.Style)}</td>
                        <td style={{ padding: '8px 10px', color: G.tx }}>{safe(line.Color)}</td>
                        <td className="num" style={{ padding: '8px 10px', color: G.tx }}>{fmtNum(line.Quantity)}</td>
                        <td className="num" style={{ padding: '8px 10px', color: G.tx }}>{fmtMoney(line.Unit_Price, currency)}</td>
                        <td className="num" style={{ padding: '8px 10px', color: G.tx, fontWeight: 600 }}>{fmtMoney(line.Line_Total, currency)}</td>
                        <td className="num" style={{ padding: '8px 10px', color: G.tx }}>{fmtNum(line.Cartons)}</td>
                        <td className="num" style={{ padding: '8px 10px', color: G.tx }}>{fmtNum(line.CBM)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {lines.length > 0 && (
                    <tfoot>
                      <tr style={{ background: G.cardAlt, borderTop: `2px solid ${G.border}` }}>
                        <td colSpan={3} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: G.mu }}>TOTAL</td>
                        <td className="num" style={{ padding: '8px 10px', fontWeight: 700, color: G.tx }}>
                          {fmtNum(lines.reduce((s, l) => s + Number(l.Quantity || 0), 0))}
                        </td>
                        <td />
                        <td className="num" style={{ padding: '8px 10px', fontWeight: 700, color: G.tx }}>
                          {fmtMoney(lines.reduce((s, l) => s + Number(l.Line_Total || 0), 0), currency)}
                        </td>
                        <td className="num" style={{ padding: '8px 10px', fontWeight: 700, color: G.tx }}>
                          {fmtNum(lines.reduce((s, l) => s + Number(l.Cartons || 0), 0))}
                        </td>
                        <td className="num" style={{ padding: '8px 10px', fontWeight: 700, color: G.tx }}>
                          {fmtNum(Number(lines.reduce((s, l) => s + Number(l.CBM || 0), 0)).toFixed(3))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>

          {/* Section 3 — Shipping Info */}
          <div style={sectionGap}>
            <SectionTitle G={G}
              icon={<Ship size={14} style={{ color: G.accent }} />}
              label="Shipping Info / 운송 정보 / 船运信息"
            />
            <div style={grid3}>
              <Field G={G} label="Shipping Line" value={safe(container.Shipping_Line)} />
              <Field G={G} label="Vessel Name" value={safe(container.Vessel_Name)} />
              <Field G={G} label="Voyage Number" value={safe(container.Voyage_Number)} />
              <Field G={G} label="B/L Number" value={blNumber || '—'} />
              <Field G={G} label="B/L Status" value={blStatus || '—'} />
              <Field G={G} label="Container Type" value={safe(container.Container_Type)} />
            </div>
          </div>

          {/* Section 4 — Trade Info */}
          <div style={sectionGap}>
            <SectionTitle G={G}
              icon={<DollarSign size={14} style={{ color: G.accent }} />}
              label="Trade Info / 무역 정보 / 贸易条款"
            />
            <div style={grid3}>
              <Field G={G} label="Shipment Mode" value={safe(container.Shipment_Mode)} />
              <Field G={G} label="Incoterms" value={safe(container.Incoterms)} />
              <Field G={G} label="Container ID" value={safe(container.Container_ID)} />
              <Field G={G} label="Freight Cost" value={fmtMoney(container.Freight_Cost, currency)} />
              <Field G={G} label="Currency" value={safe(container.Currency)} />
            </div>
          </div>

          {/* Section 5 — Quantities */}
          <div style={sectionGap}>
            <SectionTitle G={G}
              icon={<Package size={14} style={{ color: G.accent }} />}
              label="Quantities / 총량 / 总量"
            />
            <div style={grid3}>
              <Field G={G} label="Total Cartons / 箱数" value={fmtNum(container.Total_Cartons)} />
              <Field G={G} label="Total Quantity / 数量" value={fmtNum(container.Total_Quantity)} />
              <Field G={G} label="Total CBM / 体积" value={fmtNum(container.Total_CBM)} />
              <Field G={G} label="Total Weight KG / 重量" value={fmtNum(container.Total_Weight_KG)} />
            </div>
          </div>

          {/* Section 6 — Status */}
          <div style={sectionGap}>
            <SectionTitle G={G}
              icon={<CheckCircle2 size={14} style={{ color: G.accent }} />}
              label="Status / 상태 / 状态"
            />
            <div style={grid2}>
              <Field G={G} label="Container Status" value={safe(container.Container_Status)} />
              <Field G={G} label="Delay Days / 지연일수" value={fmtNum(container.Delay_Days)}
                accent={Number(container.Delay_Days) > 0 ? G.bad : undefined} />
              <Field G={G} label="Delay Reason / 지연사유" value={safe(container.Delay_Reason)} />
            </div>
          </div>

          {/* Section 7 — Notes */}
          <div style={sectionGap}>
            <SectionTitle G={G}
              icon={<FileText size={14} style={{ color: G.accent }} />}
              label="Notes / 메모 / 备注"
            />
            <div style={{
              padding: '12px 16px', borderRadius: 10,
              background: G.cardAlt, border: `1px solid ${G.border}`,
              fontSize: 13, color: G.tx, lineHeight: 1.6,
              whiteSpace: 'pre-wrap', minHeight: 60,
            }}>
              {container.Notes || <span style={{ color: G.fa }}>메모 없음 · 暂无备注</span>}
            </div>
          </div>

          {/* Section 8 — Photos (placeholder) */}
          <div style={sectionGap}>
            <SectionTitle G={G}
              icon={<Camera size={14} style={{ color: G.accent }} />}
              label="Photos / 장착사진 / 装箱照片"
            />
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
              gap: 8,
            }}>
              {[...Array(15)].map((_, i) => (
                <div key={i} style={{
                  aspectRatio: '1/1', borderRadius: 8,
                  background: G.dk ? 'rgba(245,240,232,0.04)' : 'rgba(201,168,110,0.06)',
                  border: `1px dashed ${G.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Camera size={14} style={{ color: G.fa }} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: G.fa, textAlign: 'center' }}>
              추후 추가 예정 · 即将添加
            </div>
          </div>

          {/* Section 9 — Documents (placeholder) */}
          <div>
            <SectionTitle G={G}
              icon={<File size={14} style={{ color: G.accent }} />}
              label="Documents / 서류 / 文档"
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'B/L (Bill of Lading)', sub: '선하증권' },
                { label: 'Invoice / 인보이스', sub: '상업송장' },
                { label: '출고자료 / 出货资料', sub: '출고 관련 서류' },
              ].map(doc => (
                <div key={doc.label} style={{
                  padding: '12px 16px', borderRadius: 10,
                  background: G.cardAlt, border: `1px dashed ${G.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: G.tx }}>{doc.label}</div>
                    <div style={{ fontSize: 10, color: G.mu, marginTop: 2 }}>{doc.sub}</div>
                  </div>
                  <span style={{
                    fontSize: 9, padding: '3px 8px', borderRadius: 999,
                    background: G.hair, color: G.mu, fontWeight: 600,
                    letterSpacing: '.5px',
                  }}>
                    추후 추가 예정
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
