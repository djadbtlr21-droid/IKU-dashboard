import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Shirt, Package, Truck, Scissors, ChevronRight, ChevronDown, ZoomIn, FileText, CheckCircle2, Layers, Lock, LockOpen } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { fetchMoDetail, fetchProductionLogs } from '../api/client'
import { parseSpecJSON, parseZohoDate, isOverdue, isDelayed, getMoFactory } from '../utils/moHelpers'
import { getColorHex, getTextColorOnBg } from '../utils/colorMap'
import { formatCategory, formatTopType, formatSleeve, formatFit, formatDetails, formatBottomType, formatBottomLength } from '../utils/formatGarmentCode'
import ZohoImage from './ZohoImage'
import PriceUnlockModal from './PriceUnlockModal'
import { isPriceUnlocked, lockPrice, maskAmount, maskUnit } from '../utils/priceLock'

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
function safe(val) {
  if (val === null || val === undefined || val === '') return '—'
  if (typeof val === 'object') return val.zc_display_value || val.display_value || val.Style_SKU || val.Factory_Name_Chinese || JSON.stringify(val).slice(0, 60)
  return String(val)
}

function fmtNum(v) {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (isNaN(n)) return String(v)
  return n.toLocaleString()
}

function fmtMoney(v, prefix = '¥') {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (isNaN(n)) return String(v)
  return `${prefix}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Color helpers come from src/utils/colorMap.js — single source of truth
const colorFor = getColorHex
const readableText = getTextColorOnBg

// ──────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────
function SectionTitle({ G, icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${G.hair}` }}>
      {icon}
      <h3 className="syne" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: G.accent }}>{label}</h3>
    </div>
  )
}

function Field({ G, label, value, badge, badgeColor }) {
  return (
    <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 10, color: G.mu, letterSpacing: '.5px', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
      {badge ? (
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
          background: `${badgeColor || G.primary}1A`, color: badgeColor || G.accent,
        }}>
          {value || '—'}
        </span>
      ) : (
        <div style={{ fontSize: 13, color: G.tx, fontWeight: 500, wordBreak: 'break-word' }}>{value || '—'}</div>
      )}
    </div>
  )
}

function StyleImageCell({ G, mo, onZoom, hasImage }) {
  // Build the same proxy URL the inner <img> renders, so the lightbox shows the real image
  const v = mo?.Style_Image
  const first = Array.isArray(v) ? v[0] : v
  const path = typeof first === 'string' ? first : (first?.url || first?.filepath || first?.path || '')
  const lightboxUrl = path ? `/api/zoho-image?filepath=${encodeURIComponent(path)}` : null

  return (
    <div style={{ background: G.cardAlt, border: `1px solid ${G.border}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${G.hair}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', color: G.accent, textTransform: 'uppercase' }}>Style Image</div>
        <div style={{ fontSize: 10, color: G.mu, marginTop: 1 }}>스타일 · 款式</div>
      </div>
      <div style={{ height: 420, position: 'relative', overflow: 'hidden', cursor: hasImage ? 'zoom-in' : 'default' }}
        onClick={() => { if (hasImage && onZoom && lightboxUrl) onZoom(lightboxUrl) }}>
        <ZohoImage mo={mo} field="Style_Image" G={G} alt="Style" iconSize={48}
          style={{ objectFit: 'contain', objectPosition: 'center' }} />
        {hasImage && (
          <div style={{ position: 'absolute', top: 8, right: 8, padding: 5, borderRadius: 6, background: 'rgba(26,23,20,0.55)', color: '#FFF', display: 'flex' }}>
            <ZoomIn size={12} />
          </div>
        )}
      </div>
    </div>
  )
}

function QRCell({ G, mo, sku, factory, qrSku }) {
  const text = qrSku || `MO:${mo}|SKU:${sku || ''}|FACTORY:${factory || ''}`
  // Sync QR canvas tone with theme: in dark mode use light-on-dark for contrast
  const fg = G?.dk ? '#F5F0E8' : '#1A1714'
  const bg = G?.dk ? '#1A1916' : '#FFFFFF'
  return (
    <div style={{ background: G?.cardAlt, border: `1px solid ${G?.border}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${G?.hair}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', color: G?.accent, textTransform: 'uppercase' }}>QR Code</div>
        <div style={{ fontSize: 10, color: G?.mu, marginTop: 1 }}>스캔 · 扫码</div>
      </div>
      <div style={{ height: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 18, background: G?.surf }}>
        <div style={{ padding: 8, background: bg, borderRadius: 6, border: `1px solid ${G?.hair}` }}>
          <QRCodeCanvas value={text} size={200} level="M" fgColor={fg} bgColor={bg} />
        </div>
        <div className="num" style={{ fontSize: 9, color: G?.mu, textAlign: 'center', lineHeight: 1.5, wordBreak: 'break-all', maxWidth: 200 }}>
          {text}
        </div>
      </div>
    </div>
  )
}

function ColorDisc({ G, name, code, ptone, size = 100 }) {
  const hex = colorFor(name)
  const textColor = readableText(hex)
  const firstWord = String(name || '').split(/\s+/)[0]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 120 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', background: hex,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: G.dk ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 16px rgba(26,23,20,0.12)',
        border: `2px solid ${G.dk ? G.hair : '#FFFFFF'}`,
      }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: textColor,
          letterSpacing: '.5px', textTransform: 'uppercase',
          padding: '0 8px', textAlign: 'center', wordBreak: 'keep-all',
          fontFamily: "'Outfit', 'Inter', sans-serif",
        }}>
          {firstWord}
        </span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: G.tx, letterSpacing: '.2px' }}>{name || '—'}</div>
      {code && <div className="num" style={{ fontSize: 11, color: G.accent, fontWeight: 600 }}>#{code}</div>}
      {ptone && <div className="num" style={{ fontSize: 10, color: G.mu }}>{ptone}</div>}
    </div>
  )
}

function Collapsible({ G, title, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: 18 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 0',
        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        borderBottom: `1px solid ${G.hair}`, color: G.accent,
      }}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {icon}
        <span className="syne" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' }}>{title}</span>
      </button>
      {open && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  )
}

function SpecTable({ G, json, title }) {
  const rows = parseSpecJSON(json)
  if (!rows || !rows.length) return null

  const allKeys = Object.keys(rows[0] || {})
  const sizeKeys = allKeys.filter(k => k !== 'pom' && k !== 'notes' && k !== 'ID' && k !== 'zc_display_value')

  return (
    <div style={{ marginBottom: 14 }}>
      {title && <p style={{ fontSize: 11, fontWeight: 600, color: G.mu, marginBottom: 6 }}>{title}</p>}
      <div style={{ overflowX: 'auto', border: `1px solid ${G.hair}`, borderRadius: 8 }}>
        <table className="num" style={{ fontSize: 11, width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: G.cardAlt }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: G.mu, fontWeight: 600, borderBottom: `1px solid ${G.hair}` }}>POM</th>
              {sizeKeys.map(s => (
                <th key={s} style={{ padding: '8px 12px', textAlign: 'center', textTransform: 'uppercase', color: G.accent, fontWeight: 700, borderBottom: `1px solid ${G.hair}` }}>{s}</th>
              ))}
              {allKeys.includes('notes') && (
                <th style={{ padding: '8px 12px', textAlign: 'left', color: G.mu, fontWeight: 600, borderBottom: `1px solid ${G.hair}` }}>비고 · 备注</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${G.hair}` : 'none', background: G.card }}>
                <td style={{ padding: '8px 12px', fontWeight: 600, color: G.tx }}>{safe(row.pom)}</td>
                {sizeKeys.map(s => (
                  <td key={s} style={{ padding: '8px 12px', textAlign: 'center', color: G.tx }}>{row[s] ?? '—'}</td>
                ))}
                {allKeys.includes('notes') && <td style={{ padding: '8px 12px', color: G.mu }}>{row.notes || ''}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Plan/Actual matrix table
// ──────────────────────────────────────────────────────────
function MatrixTable({ G, lines, fields, currency = '¥', unlocked = false }) {
  // fields: { color, size, qty, price }
  const records = (lines || []).filter(Boolean)
  if (!records.length) {
    return (
      <div style={{ padding: 28, textAlign: 'center', fontSize: 12, color: G.mu, background: G.cardAlt, borderRadius: 10, border: `1px dashed ${G.border}` }}>
        데이터 없음 · 无数据
      </div>
    )
  }

  const colors = [...new Set(records.map(l => safe(l[fields.color])))]
  const sizes = [...new Set(records.map(l => safe(l[fields.size])))]

  const cellOf = (color, size) => {
    const m = records.find(l => safe(l[fields.color]) === color && safe(l[fields.size]) === size)
    if (!m) return null
    return {
      qty: Number(m[fields.qty] || 0),
      price: Number(m[fields.price] || 0),
    }
  }

  const colorRowTotals = colors.map(c =>
    records.filter(l => safe(l[fields.color]) === c).reduce((s, l) => s + Number(l[fields.qty] || 0), 0)
  )
  const colorRowAmounts = colors.map(c =>
    records.filter(l => safe(l[fields.color]) === c).reduce((s, l) => s + Number(l[fields.qty] || 0) * Number(l[fields.price] || 0), 0)
  )
  const colorUnitPrice = colors.map(c => {
    const r = records.find(l => safe(l[fields.color]) === c)
    return Number(r?.[fields.price] || 0)
  })
  const sizeColTotals = sizes.map(s =>
    records.filter(l => safe(l[fields.size]) === s).reduce((sum, l) => sum + Number(l[fields.qty] || 0), 0)
  )
  const grandQty = colorRowTotals.reduce((a, b) => a + b, 0)
  const grandAmt = colorRowAmounts.reduce((a, b) => a + b, 0)

  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${G.hair}`, borderRadius: 8 }}>
      <table className="num" style={{ fontSize: 12, width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
        <thead>
          <tr style={{ background: G.cardAlt }}>
            <th style={{ padding: '10px 12px', textAlign: 'left', color: G.mu, fontWeight: 600, letterSpacing: '.3px', borderBottom: `1px solid ${G.hair}` }}>Color · 색상</th>
            {sizes.map(s => (
              <th key={s} style={{ padding: '10px 12px', textAlign: 'center', color: G.accent, fontWeight: 700, borderBottom: `1px solid ${G.hair}` }}>{s}</th>
            ))}
            <th style={{ padding: '10px 12px', textAlign: 'right', color: G.mu, fontWeight: 600, borderBottom: `1px solid ${G.hair}` }}>Qty · 수량</th>
            <th style={{ padding: '10px 12px', textAlign: 'right', color: G.mu, fontWeight: 600, borderBottom: `1px solid ${G.hair}` }}>Unit</th>
            <th style={{ padding: '10px 12px', textAlign: 'right', color: G.mu, fontWeight: 600, borderBottom: `1px solid ${G.hair}` }}>Amount · 金额</th>
          </tr>
        </thead>
        <tbody>
          {colors.map((color, ci) => (
            <tr key={color} style={{ background: G.card, borderBottom: ci < colors.length - 1 ? `1px solid ${G.hair}` : 'none' }}>
              <td style={{ padding: '8px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: colorFor(color), border: `1px solid ${G.hair}` }} />
                  <span style={{ fontWeight: 600, color: G.tx, textTransform: 'uppercase' }}>{color}</span>
                </div>
              </td>
              {sizes.map(s => {
                const c = cellOf(color, s)
                return (
                  <td key={s} style={{ padding: '8px 12px', textAlign: 'center', background: c?.qty ? `${G.primary}0F` : 'transparent', color: c?.qty ? G.accent : G.fa, fontWeight: c?.qty ? 600 : 400 }}>
                    {c?.qty ? fmtNum(c.qty) : '—'}
                  </td>
                )
              })}
              <td style={{ padding: '8px 12px', textAlign: 'right', color: G.tx, fontWeight: 700 }}>{fmtNum(colorRowTotals[ci])}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', color: G.mu, fontFamily: unlocked ? undefined : 'monospace' }}>
                {unlocked ? (colorUnitPrice[ci] ? fmtMoney(colorUnitPrice[ci], currency) : '—') : maskUnit(colorUnitPrice[ci], currency)}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', color: G.tx, fontWeight: 600, fontFamily: unlocked ? undefined : 'monospace' }}>
                {unlocked ? (colorRowAmounts[ci] ? fmtMoney(colorRowAmounts[ci], currency) : '—') : maskAmount(colorRowAmounts[ci], currency)}
              </td>
            </tr>
          ))}
          <tr style={{ background: G.cardAlt, borderTop: `2px solid ${G.primary}33` }}>
            <td style={{ padding: '10px 12px', color: G.mu, fontWeight: 700, letterSpacing: '.5px' }}>TOTAL · 합계</td>
            {sizeColTotals.map((t, i) => (
              <td key={i} style={{ padding: '10px 12px', textAlign: 'center', color: G.tx, fontWeight: 700 }}>{fmtNum(t)}</td>
            ))}
            <td style={{ padding: '10px 12px', textAlign: 'right', color: G.accent, fontWeight: 700 }}>{fmtNum(grandQty)}</td>
            <td style={{ padding: '10px 12px' }} />
            <td style={{ padding: '10px 12px', textAlign: 'right', color: G.accent, fontWeight: 700, fontFamily: unlocked ? undefined : 'monospace' }}>
              {unlocked ? (grandAmt ? fmtMoney(grandAmt, currency) : '—') : `${currency}••••••••`}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Lightbox
// ──────────────────────────────────────────────────────────
function Lightbox({ src, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <button onClick={onClose} aria-label="close"
        style={{ position: 'absolute', top: 16, right: 16, padding: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', color: '#FFF', border: 'none', cursor: 'pointer', display: 'flex' }}>
        <X size={18} />
      </button>
      <img src={src} alt="" onClick={e => e.stopPropagation()}
        style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Production Log + Packaging helpers (Sections K + L)
// ──────────────────────────────────────────────────────────

// Field-name probe: try a list of candidate keys, return first non-empty value
function pick(obj, candidates) {
  if (!obj) return undefined
  for (const k of candidates) {
    const v = obj[k]
    if (v !== null && v !== undefined && v !== '') return v
  }
  return undefined
}

function pickArray(obj, candidates) {
  if (!obj) return []
  for (const k of candidates) {
    const v = obj[k]
    if (Array.isArray(v) && v.length) return v
  }
  return []
}

function ProgressBar({ G, label, current, total, color }) {
  const pct = total > 0 ? Math.min((current / total) * 100, 100) : 0
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: G.mu, marginBottom: 6 }}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        <span className="num" style={{ color: G.tx, fontWeight: 600 }}>{current} / {total}</span>
      </div>
      <div style={{ height: 8, background: G.cardAlt, borderRadius: 4, overflow: 'hidden', border: `1px solid ${G.hair}` }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color || G.primary, transition: 'width .4s ease' }} />
      </div>
      <div className="num" style={{ fontSize: 10, color: G.mu, marginTop: 3, textAlign: 'right' }}>{pct.toFixed(0)}%</div>
    </div>
  )
}

const PACK_STATUS_DEFS = [
  { key: 'Created', emoji: '✅', kr: '생성됨', cn: '已创建' },
  { key: 'Bagged', emoji: '📦', kr: '마대 포장', cn: '已装袋' },
  { key: 'Shipped', emoji: '📦', kr: '출고됨', cn: '已发货' },
  { key: 'Received', emoji: '📥', kr: '입고됨', cn: '已入仓' },
  { key: 'Out For Delivery', emoji: '🚚', kr: '배송 중', cn: '配送中' },
  { key: 'Delivered', emoji: '✓', kr: '도착 완료', cn: '已交付' },
]

function StatusList({ G, statuses, packs, statusFields, weightField, precomputedCounts }) {
  const getStatus = p => pick(p, statusFields || ['Bag_Status', 'Status', 'State', 'Pack_Status']) || 'Unknown'
  const getWeight = p => weightField ? Number(pick(p, [weightField]) || 0) : 1
  const counts = precomputedCounts || packs.reduce((m, p) => {
    const k = getStatus(p)
    m[k] = (m[k] || 0) + getWeight(p)
    return m
  }, {})
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {statuses.map(s => {
        const count = counts[s.key] || 0
        const sample = packs.find(p => getStatus(p) === s.key)
        const date = sample && pick(sample, ['Created_Time', 'Added_Time', 'Modified_Time', 'Date'])
        const worker = sample && pick(sample, ['Worker', 'Operator', 'Added_User'])
        const has = count > 0
        return (
          <div key={s.key} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '7px 12px', borderRadius: 6,
            background: has ? G.cardAlt : 'transparent',
            border: `1px solid ${has ? G.hair : 'transparent'}`,
            fontSize: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ fontSize: 14 }}>{s.emoji}</span>
              <span style={{ color: G.tx, fontWeight: 500 }}>{s.key}</span>
              <span style={{ color: G.mu, fontSize: 11 }}>/ {s.kr} / {s.cn}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <span className="num" style={{ fontWeight: 700, color: has ? G.primary : G.fa, minWidth: 30, textAlign: 'right' }}>{count}</span>
              {date && <span className="num" style={{ color: G.mu, fontSize: 10, minWidth: 80 }}>{String(date).split(' ')[0]}</span>}
              {worker && <span style={{ color: G.mu, fontSize: 10 }}>{worker}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PackTable({ G, packs, kind = 'inner' }) {
  if (!packs.length) {
    return <div style={{ textAlign: 'center', padding: 20, color: G.mu, fontSize: 12 }}>데이터 없음 · 无数据</div>
  }
  const th = { padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: G.mu, borderBottom: `1px solid ${G.border}`, letterSpacing: '.3px', textTransform: 'uppercase' }
  const td = { padding: '7px 10px', color: G.tx, fontSize: 11 }
  const isMaster = kind === 'master'
  return (
    <div style={{ maxHeight: 360, overflow: 'auto', border: `1px solid ${G.hair}`, borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ position: 'sticky', top: 0, background: G.cardAlt, zIndex: 1 }}>
          <tr>
            <th style={th}>{isMaster ? 'Bag # · 编号' : 'Pack # · 编号'}</th>
            <th style={th}>Status · 状态</th>
            <th style={{ ...th, textAlign: 'right' }}>Qty · 数量</th>
            {isMaster && <th style={{ ...th, textAlign: 'right' }}>Inner · 中包</th>}
            <th style={th}>Worker · 担当</th>
            <th style={th}>Created · 创建</th>
          </tr>
        </thead>
        <tbody>
          {packs.map((p, i) => {
            // Bag/Pack sequence — prefer business-key fields over Zoho internal ID
            const num = pick(p, isMaster
              ? ['Bag_Sequence', 'Bag_Number', 'Sequence', 'Pack_Sequence']
              : ['Pack_Sequence', 'Pack_Number', 'Sequence', 'Bag_Sequence', 'Bag_Number']
            ) || pick(p, ['ID']) || (i + 1)
            const status = pick(p, isMaster
              ? ['Bag_Status', 'Status', 'State']
              : ['Pack_Status', 'Status', 'State']
            ) || '—'
            const qty = pick(p, isMaster
              ? ['Total_Qty', 'Total_Quantity', 'Quantity', 'Qty']
              : ['Total_Expected', 'Quantity', 'Qty', 'Pack_Quantity']
            )
            const innerCount = isMaster ? pick(p, ['Inner_Pack_Count', 'InnerPackCount']) : null
            const worker = pick(p, ['Worker', 'Operator', 'Added_User']) || '—'
            const created = pick(p, ['Created_Time', 'Added_Time', 'Modified_Time']) || '—'
            return (
              <tr key={p.ID || i} style={{ borderBottom: `1px solid ${G.hair}`, background: i % 2 === 0 ? 'transparent' : G.rh }}>
                <td className="num" style={{ ...td, fontWeight: 600, color: G.accent }}>#{String(num).slice(-6)}</td>
                <td style={td}>{status}</td>
                <td className="num" style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{qty != null && qty !== '' ? Number(qty).toLocaleString() : '—'}</td>
                {isMaster && <td className="num" style={{ ...td, textAlign: 'right', color: G.mu }}>{innerCount != null && innerCount !== '' ? innerCount : '—'}</td>}
                <td style={td}>{worker}</td>
                <td className="num" style={td}>{created}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ProductionLogTable({ G, logs }) {
  if (!logs?.length) return null
  const th = { padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: G.mu, borderBottom: `1px solid ${G.border}`, letterSpacing: '.3px', textTransform: 'uppercase', background: G.cardAlt }
  const td = { padding: '8px 10px', color: G.tx, fontSize: 12 }
  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${G.hair}`, borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>공정 · 工序</th>
            <th style={{ ...th, textAlign: 'right' }}>완성 · 完成</th>
            <th style={{ ...th, textAlign: 'right' }}>미완성 · 未完成</th>
            <th style={th}>담당 · 负责人</th>
            <th style={th}>기록 · 记录时间</th>
            <th style={th}>비고 · 备注</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, i) => {
            const process = pick(log, ['Process', 'Stage', 'Operation', 'Type', 'Step']) || '—'
            const done = pick(log, ['Completed_Qty', 'Done_Qty', 'Quantity_Done', 'Qty_Completed', 'Quantity'])
            const pending = pick(log, ['Incomplete_Qty', 'Pending_Qty', 'Remaining_Qty', 'Qty_Pending'])
            const worker = pick(log, ['Worker', 'Operator', 'Recorder', 'Added_User']) || '—'
            const time = pick(log, ['Log_Time', 'Recorded_Time', 'Log_Date', 'Added_Time', 'Modified_Time']) || '—'
            const notes = pick(log, ['Notes', 'Remark', 'Comments', 'Note']) || '—'
            return (
              <tr key={log.ID || i} style={{ borderBottom: `1px solid ${G.hair}`, background: i % 2 === 0 ? 'transparent' : G.rh }}>
                <td style={{ ...td, fontWeight: 600 }}>{process}</td>
                <td className="num" style={{ ...td, textAlign: 'right', color: G.primary, fontWeight: 700 }}>{done != null ? Number(done).toLocaleString() : '—'}</td>
                <td className="num" style={{ ...td, textAlign: 'right', color: G.mu }}>{pending != null ? Number(pending).toLocaleString() : '—'}</td>
                <td style={td}>{worker}</td>
                <td className="num" style={td}>{time}</td>
                <td style={{ ...td, color: G.mu }}>{notes}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// PackagingSection — Zoho's NEW packaging model:
//   • Inner Pack is a single "standard" record per MO carrying Total_Expected
//     (how many inner packs we plan to print). There's no per-pack record.
//   • Master Bag records each carry Inner_Pack_Count (how many inner packs
//     are inside that bag). So:
//       innerCreated = standardInner.Total_Expected
//       innerBagged  = Σ masterBag.Inner_Pack_Count
//   • Master Bag list still shows individual bag records.
function PackagingSection({ G, src }) {
  const moNumber = src?.MO_Number
  const planQty = Number(src?.Plan_Total_Quantity || 0)

  const subformInner = pickArray(src, ['Inner_Packs', 'Inner_Pack_List', 'InnerPacks'])
  const subformMaster = pickArray(src, ['Master_Bags', 'MasterBags', 'Bulto_List'])

  const [innerPacks, setInnerPacks] = useState(subformInner)
  const [masterBags, setMasterBags] = useState(subformMaster)
  const [loading, setLoading] = useState(false)
  const [showInnerList, setShowInnerList] = useState(false)
  const [showMasterList, setShowMasterList] = useState(false)

  useEffect(() => {
    if (!moNumber) return
    // If subforms already populated, skip the fetch.
    if (subformInner.length || subformMaster.length) {
      setInnerPacks(subformInner)
      setMasterBags(subformMaster)
      return
    }
    setLoading(true)
    const moEnc = encodeURIComponent(moNumber)
    // Fire independently so one failure never silences the other
    fetch(`/api/packs-list?mo=${moEnc}&type=inner`)
      .then(r => r.json())
      .then(data => setInnerPacks(data?.data || []))
      .catch(err => console.error('[PackagingSection] inner fetch failed:', err))
    fetch(`/api/packs-list?mo=${moEnc}&type=master`)
      .then(r => r.json())
      .then(data => setMasterBags(data?.data || []))
      .catch(err => console.error('[PackagingSection] master fetch failed:', err))
      .finally(() => setLoading(false))
  }, [moNumber, subformInner.length, subformMaster.length])

  // ── Pick the "standard" inner pack record (Is_Remainder=false, or the first one) ──
  const standardInner = useMemo(() => {
    if (!innerPacks.length) return null
    const standard = innerPacks.find(p => {
      const ir = pick(p, ['Is_Remainder', 'is_remainder', 'IsRemainder'])
      if (ir === false || ir === 'false' || ir === 0) return true
      if (ir === undefined || ir === null) return true
      return false
    })
    return standard || innerPacks[0]
  }, [innerPacks])

  const standardTotalExpected = Number(
    pick(standardInner, ['Total_Expected', 'Total_Expected_Quantity', 'Expected_Total', 'Plan_Total', 'Total_Pack_Quantity']) || 0
  )

  // ── Inner Pack Bagged = Σ Inner_Pack_Count across Master Bags ──
  const innerBagged = useMemo(() => masterBags.reduce(
    (s, b) => s + Number(pick(b, ['Inner_Pack_Count', 'InnerPackCount']) || 0), 0
  ), [masterBags])

  // ── Totals (denominator) ──
  // Prefer Total_Expected from the standard record; fall back to plan/12 if absent.
  const innerTotal = standardTotalExpected || (planQty ? Math.ceil(planQty / 12) : 0)
  const masterTotal = planQty ? Math.ceil(planQty / 120) : 0

  // ── Created / Bagged for the progress bar ──
  // "Created" = printed (Total_Expected) under the new model.
  // "Bagged" = currently allocated to bags (Σ Inner_Pack_Count).
  const innerCreated = standardTotalExpected || innerPacks.length  // legacy fallback
  const innerBaggedDisplay = innerBagged
  const masterCreated = masterBags.length

  // ── Inner Pack status distribution (weighted by Inner_Pack_Count on the master bag) ──
  const innerStatusCounts = useMemo(() => {
    const counts = { Created: standardTotalExpected || 0, Bagged: innerBagged }
    masterBags.forEach(b => {
      const st = pick(b, ['Bag_Status', 'Status', 'State'])
      const ipc = Number(pick(b, ['Inner_Pack_Count', 'InnerPackCount']) || 0)
      if (!st || st === 'Created' || st === 'Bagged') return // Created/Bagged already covered above
      counts[st] = (counts[st] || 0) + ipc
    })
    return counts
  }, [masterBags, standardTotalExpected, innerBagged])

  return (
    <div style={{ background: G.cardAlt, border: `1px solid ${G.border}`, borderRadius: 12, padding: 16 }}>
      <ProgressBar G={G} label={`Inner Pack 진행률 · 中间包装进度 (Bagged / Total Expected)`} current={innerBaggedDisplay} total={innerTotal} color={G.primary} />
      <ProgressBar G={G} label="Master Bag 진행률 · 麻袋进度" current={masterCreated} total={masterTotal} color={G.primary} />

      <div style={{ marginTop: 18 }}>
        <div className="syne" style={{ fontSize: 11, fontWeight: 700, color: G.mu, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>
          Inner Pack 상태별 · 包状态分布
        </div>
        <StatusList G={G} statuses={PACK_STATUS_DEFS} packs={masterBags} precomputedCounts={innerStatusCounts} statusFields={['Bag_Status', 'Status', 'State']} />
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="syne" style={{ fontSize: 11, fontWeight: 700, color: G.mu, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>
          Master Bag 상태별 · 麻袋状态分布
        </div>
        <StatusList G={G} statuses={PACK_STATUS_DEFS.filter(s => s.key !== 'Bagged')} packs={masterBags} statusFields={['Bag_Status', 'Status', 'State']} />
      </div>

      <div style={{ marginTop: 18, borderTop: `1px solid ${G.hair}`, paddingTop: 12 }}>
        <button onClick={() => setShowInnerList(v => !v)} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'transparent', border: 'none', color: G.tx, cursor: 'pointer',
          padding: '6px 0', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
        }}>
          <span>표준 중간포장 · 标准中包袋 ({standardTotalExpected || 0}개 인쇄)</span>
          <span style={{ color: G.mu, fontSize: 11 }}>{showInnerList ? '▲' : '▼'}</span>
        </button>
        {showInnerList && (
          <div style={{ marginTop: 8 }}>
            {standardInner ? (
              <div style={{ border: `1px solid ${G.hair}`, borderRadius: 8, padding: '12px 14px', background: G.surf, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: G.mu, letterSpacing: '.5px' }}>표준 중간포장 · 标准中包袋</div>
                  <div style={{ fontSize: 13, color: G.tx, fontWeight: 600, marginTop: 2 }}>
                    {standardTotalExpected ? `${standardTotalExpected.toLocaleString()}개 인쇄 · 已印刷 ${standardTotalExpected.toLocaleString()}` : '인쇄 수량 미정 · 未确定'}
                  </div>
                </div>
                <div className="num syne" style={{ fontSize: 22, fontWeight: 700, color: G.accent }}>
                  {innerBagged.toLocaleString()} / {(standardTotalExpected || innerTotal).toLocaleString()}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 20, color: G.mu, fontSize: 12 }}>표준 중간포장 데이터 없음 · 无标准中包袋数据</div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, borderTop: `1px solid ${G.hair}`, paddingTop: 12 }}>
        <button onClick={() => setShowMasterList(v => !v)} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'transparent', border: 'none', color: G.tx, cursor: 'pointer',
          padding: '6px 0', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
        }}>
          <span>개별 Master Bag 리스트 · 麻袋明细 ({masterCreated})</span>
          <span style={{ color: G.mu, fontSize: 11 }}>{showMasterList ? '▲' : '▼'}</span>
        </button>
        {showMasterList && <div style={{ marginTop: 8 }}><PackTable G={G} packs={masterBags} kind="master" /></div>}
      </div>

      {loading && (
        <div style={{ marginTop: 12, fontSize: 11, color: G.mu, textAlign: 'center' }}>
          포장 데이터 로딩 중… · 加载包装数据中…
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Main modal
// ──────────────────────────────────────────────────────────
export default function MoDetailModal({ G, mo, moId, moRow, onClose }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [logOpen, setLogOpen] = useState(false)
  const [prodLogs, setProdLogs] = useState(null)
  const [prodLogsLoading, setProdLogsLoading] = useState(false)
  const [packOpen, setPackOpen] = useState(false)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('plan')
  const [zoomSrc, setZoomSrc] = useState(null)
  const [unlocked, setUnlocked] = useState(() => isPriceUnlocked())
  const [showUnlockModal, setShowUnlockModal] = useState(false)

  const handleLockClick = () => {
    if (unlocked) {
      lockPrice()
      setUnlocked(false)
    } else {
      setShowUnlockModal(true)
    }
  }

  // Resolve seed record from props
  const seed = mo || moRow || {}
  const id = moId || seed.ID || seed.id

  useEffect(() => {
    if (!id) { setLoading(false); return }
    setLoading(true)
    setError(null)
    fetchMoDetail(id)
      .then(data => {
        setDetail(data)
        // Field-discovery diagnostic — surfaces subform names + first-row keys
        try {
          const rec = Array.isArray(data?.data) ? data.data[0] : (data?.data || data)
          if (rec && typeof rec === 'object') {
            const arrays = Object.entries(rec).filter(([, v]) => Array.isArray(v))
            console.log('[MO_DETAIL] All keys:', Object.keys(rec))
            console.log('[MO_DETAIL] Array fields (subforms):')
            arrays.forEach(([k, v]) => {
              const firstKeys = v[0] && typeof v[0] === 'object' ? Object.keys(v[0]) : '(primitives)'
              console.log(`  ${k}: length=${v.length}, sample keys:`, firstKeys)
            })
          }
        } catch (e) { /* ignore */ }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  const handleKeyDown = useCallback(e => { if (e.key === 'Escape') onClose() }, [onClose])
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = prev
    }
  }, [handleKeyDown])

  // Merge detail over seed
  const fullRecord = useMemo(() => {
    if (!detail) return null
    if (Array.isArray(detail.data)) return detail.data[0] || null
    if (detail.data && typeof detail.data === 'object') return detail.data
    return detail
  }, [detail])

  const src = fullRecord || seed || {}

  // No style-detail fetch — ZohoImage talks to /api/zoho-image directly via mo.ID
  const styleRecord = null

  // Fallback G — never let dark hardcoding leak
  const T = G || {
    bg: '#FAFAF7', surf: '#FFFFFF', card: '#FFFFFF', cardAlt: '#FBF9F4',
    border: '#EDE8DE', hair: '#E4DED2',
    primary: '#C9A86E', primarySoft: '#E8D5B0', accent: '#9A7228',
    tx: '#1A1714', mu: '#7A7268', fa: '#C8C0B2',
    ok: '#5E8C6E', bad: '#A14E3A', warn: '#B47A3F', cool: '#6B7F94',
    overlayBg: 'rgba(26,23,20,0.45)',
    cardShadow: '0 2px 8px rgba(26,23,20,0.06)',
    dk: false,
  }

  const moNumber = safe(src.MO_Number || src.ID)

  // Lazy-fetch production logs when section is first opened
  useEffect(() => {
    if (!logOpen || !moNumber || moNumber === '—' || prodLogs !== null) return
    setProdLogsLoading(true)
    fetchProductionLogs(moNumber)
      .then(data => setProdLogs(data?.data || []))
      .catch(() => setProdLogs([]))
      .finally(() => setProdLogsLoading(false))
  }, [logOpen, moNumber, prodLogs])

  const sku = src.Style_SKU?.Style_SKU || (typeof src.Style_SKU === 'string' ? src.Style_SKU : '—')
  const factoryName = getMoFactory(src)
  const modifiedTime = src.Modified_Time || src.Modified_Date || ''
  const orderStatus = src.Order_Status
  const deliveryStatus = src.Delivery_Status
  const productionStatus = src.Production_Status
  const overdue = isOverdue(src)
  const delayed = isDelayed(src)
  const planQty = Number(src.Plan_Total_Quantity || 0)
  const actualQty = Number(src.Acture_Total_Quantity || 0)
  const shipRate = planQty ? (actualQty / planQty) * 100 : 0

  // Image field availability — only need Style_Image now
  const hasStyleImg = (() => {
    const v = src?.Style_Image
    if (!v) return false
    if (Array.isArray(v)) return v.length > 0
    return true
  })()

  // Plan/Actual lines
  const planLines = (fullRecord?.Plan_MO_Lines || []).filter(Boolean)
  const actualLines = (fullRecord?.Acture_Order_Lines || []).filter(Boolean)

  // Colors for COLOR IMAGE section — distinct colors from Plan_MO_Lines
  const colorEntries = useMemo(() => {
    const map = new Map()
    planLines.forEach(l => {
      const name = safe(l.Plan_Color || l.Color || l.color)
      if (!map.has(name)) {
        map.set(name, {
          name,
          code: l.Plan_Color_Code || l.Color_Code || '',
          ptone: l.Pantone || l.PTone || '',
        })
      }
    })
    return Array.from(map.values()).filter(c => c.name && c.name !== '—')
  }, [planLines])

  // Inner Pack & Bulto
  const INNER_PACK_PCS = 12
  const MASTER_BAG_PCS = 120
  const expPackCount = INNER_PACK_PCS ? Math.ceil(planQty / INNER_PACK_PCS) : 0
  const expBultoCount = MASTER_BAG_PCS ? Math.ceil(planQty / MASTER_BAG_PCS) : 0

  const innerPackDetails = useMemo(() => {
    const arr = []
    planLines.forEach(l => {
      arr.push({
        color: safe(l.Plan_Color || l.Color),
        size: safe(l.Plan_Sizes || l.Size),
        qty: 1,
      })
    })
    return arr
  }, [planLines])

  // Production tracking steps
  const trackSteps = [
    { key: 'Order_Date', label: '주문 · 订单', icon: FileText },
    { key: 'Cutting_Start_Date', label: '재단 시작 · 裁剪开始', icon: Scissors },
    { key: 'Cutting_End_Date', label: '재단 완료 · 裁剪完成', icon: Scissors },
    { key: 'Sewing_Start_Date', label: '재봉 시작 · 裁缝开始', icon: Layers },
    { key: 'Sewing_End_Date', label: '재봉 완료 · 裁缝完成', icon: Layers },
    { key: 'Packing_Start_Date', label: '포장 · 包装', icon: Package },
    { key: 'Expected_Delivery', label: '예상 납기 · 预计交货', icon: Truck },
    { key: 'Ship_Date', label: '출하 · 出货', icon: CheckCircle2 },
  ]

  const today = new Date()

  return (
    <>
      <div
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000, padding: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: T.overlayBg, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.2s ease',
        }}
      >
        <div style={{
          width: 'min(1200px, 95vw)', maxHeight: '90vh',
          background: T.surf, color: T.tx,
          borderRadius: 16, border: `1px solid ${T.border}`,
          boxShadow: T.dk ? '0 32px 64px rgba(0,0,0,0.6)' : '0 24px 64px rgba(26,23,20,0.18)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          animation: 'slideUp 0.3s ease-out',
        }}>

          {/* ──────────────────────────────────────────────
              A. Header (sticky)
          ────────────────────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 24px', borderBottom: `1px solid ${T.hair}`,
            background: T.cardAlt, gap: 16, flexShrink: 0, flexWrap: 'wrap',
          }}>
            <div style={{ minWidth: 0, flex: '1 1 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2 className="syne num" style={{ fontSize: 26, fontWeight: 700, color: T.primary, letterSpacing: '-.4px', lineHeight: 1 }}>{moNumber}</h2>
                {delayed && <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 999, fontWeight: 700, background: `${T.bad}1A`, color: T.bad }}>⚠ 지연</span>}
              </div>
              <div style={{ fontSize: 12, color: T.mu, marginTop: 4, fontWeight: 500 }}>— {sku}</div>
              {modifiedTime && (
                <div className="num" style={{ fontSize: 11, color: T.mu, marginTop: 2 }}>
                  최종수정일 · 最后修改日: <span style={{ color: T.tx, fontWeight: 500 }}>{modifiedTime}</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              <button onClick={onClose} aria-label="close" style={{
                width: 36, height: 36, borderRadius: '50%', background: 'transparent',
                border: `1px solid ${T.border}`, color: T.mu, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = `${T.bad}1A`; e.currentTarget.style.color = T.bad; e.currentTarget.style.borderColor = T.bad }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.mu; e.currentTarget.style.borderColor = T.border }}>
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body scroll */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {error && (
              <div style={{ padding: 12, borderRadius: 8, fontSize: 12, color: T.warn, background: `${T.warn}14`, border: `1px solid ${T.warn}33`, marginBottom: 16 }}>
                일부 데이터를 불러오지 못했습니다 · 部分数据加载失败
              </div>
            )}

            {/* ──────────────────────────────────────────────
                B. Image grid — 2 cells (Style + QR)
            ────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 22 }}>
              <StyleImageCell G={T} mo={src} hasImage={hasStyleImg} onZoom={setZoomSrc} />
              <QRCell G={T} mo={moNumber} sku={sku} factory={factoryName} qrSku={src?.QR_SKU} />
            </div>

            {/* ──────────────────────────────────────────────
                C. Color Image (color discs) — always shown
            ────────────────────────────────────────────── */}
            <div style={{ marginBottom: 22 }}>
              <SectionTitle G={T} icon={<Shirt size={14} style={{ color: T.accent }} />} label="Color Image · 색상 · 色卡" />
              {colorEntries.length > 0 ? (
                <div style={{ background: T.cardAlt, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24, display: 'flex', gap: 28, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                  {colorEntries.map((c, i) => (
                    <ColorDisc key={c.name + i} G={T} name={c.name} code={c.code} ptone={c.ptone} />
                  ))}
                </div>
              ) : (
                <div style={{ background: T.cardAlt, border: `1px dashed ${T.border}`, borderRadius: 10, padding: '28px 20px', textAlign: 'center', color: T.mu, fontSize: 12 }}>
                  색상 정보 없음 · 暂无颜色数据
                </div>
              )}
            </div>

            {/* ──────────────────────────────────────────────
                D. Basic Info (3-col grid)
            ────────────────────────────────────────────── */}
            <div style={{ marginBottom: 22 }}>
              <SectionTitle G={T} icon={<FileText size={14} style={{ color: T.accent }} />} label="기본 정보 · 订单信息 · Basic Info" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                <Field G={T} label="MO 번호 / 订单号" value={moNumber} />
                <Field G={T} label="스타일 SKU / 款号" value={sku} />
                <Field G={T} label="영문 스타일명 / Eng Name" value={safe(src.Eng_Style_Name)} />
                <Field G={T} label="중문 스타일명 / 中文款名" value={safe(src.Chi_Style_Name)} />
                <Field G={T} label="시즌 / 季节" value={safe(src.Season)} />
                <Field G={T} label="카테고리 / 大类" value={formatCategory(src.Category)} />
                <Field G={T} label="공장 / 工厂" value={factoryName} />
                <Field G={T} label="주문일 / 订单日" value={safe(src.Order_Date)} />
                <Field G={T} label="주문 상태 / 订单状态" value={orderStatus} badge badgeColor={T.ok} />
                <Field G={T} label="예상 납기 / 预计交货" value={safe(src.Expected_Delivery)} />
                <Field G={T} label="납기 상태 / 交期状态" value={deliveryStatus} badge badgeColor={overdue ? T.bad : T.cool} />
                <Field G={T} label="성별 / 性别" value={safe(src.Gender)} />
              </div>
            </div>

            {/* ──────────────────────────────────────────────
                E. Product Definition
            ────────────────────────────────────────────── */}
            <div style={{ marginBottom: 22 }}>
              <SectionTitle G={T} icon={<Shirt size={14} style={{ color: T.accent }} />} label="제품 정의 · 产品定义 · Product Definition" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                <Field G={T} label="상의 유형 / 上衣类型" value={formatTopType(src.Top_Type)} />
                <Field G={T} label="소매 유형 / 衣袖类型" value={formatSleeve(src.Sleeve)} />
                <Field G={T} label="핏 / 版型" value={formatFit(src.Fit)} />
                <Field G={T} label="디테일 / 类型详情" value={formatDetails(src.Details)} />
                <Field G={T} label="하의 유형 / 下装类型" value={formatBottomType(src.Bottom_Type)} />
                <Field G={T} label="하의 기장 / 下装长短" value={formatBottomLength(src.Bottom_Length)} />
              </div>
            </div>

            {/* ──────────────────────────────────────────────
                F. Material Info
            ────────────────────────────────────────────── */}
            <div style={{ marginBottom: 22 }}>
              <SectionTitle G={T} icon={<Layers size={14} style={{ color: T.accent }} />} label="원단 정보 · 面料信息 · Material" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                <Field G={T} label="원단 종류 / 面料种类" value={safe(src.Material_Type)} />
                <Field G={T} label="혼방 % / 混纺 %" value={safe(src.blended)} />
                <Field G={T} label="원단 중량 / 面料克重" value={safe(src.Fabric_Weight)} />
                <Field G={T} label="안감 / 里料类型" value={safe(src.Lining_Type)} />
                <Field G={T} label="안감 중량 / 里料克重" value={safe(src.Lining_Weight)} />
                <Field G={T} label="안감 비고 / 里料备注" value={safe(src.Lining_Notes)} />
              </div>
            </div>

            {/* ──────────────────────────────────────────────
                G. Size Spec (collapsible)
            ────────────────────────────────────────────── */}
            <Collapsible G={T} title="사이즈 스펙 · 尺寸规格 · Size Specs" icon={<Scissors size={14} />}>
              {!src.Top_Spec_JSON && !src.Bottom_Spec_JSON ? (
                <div style={{ padding: 16, fontSize: 12, color: T.mu, textAlign: 'center', background: T.cardAlt, borderRadius: 8 }}>
                  스펙 데이터 없음 · 无规格数据
                </div>
              ) : (
                <>
                  <SpecTable G={T} json={src.Top_Spec_JSON} title="Top Spec · 상의 스펙" />
                  <SpecTable G={T} json={src.Bottom_Spec_JSON} title="Bottom Spec · 하의 스펙" />
                </>
              )}
            </Collapsible>

            {/* ──────────────────────────────────────────────
                H. Plan / Actual Matrix (tabs)
            ────────────────────────────────────────────── */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${T.hair}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={14} style={{ color: T.accent }} />
                  <h3 className="syne" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: T.accent }}>수량 매트릭스 · 数量矩阵 · Plan/Actual</h3>
                </div>
                <button
                  onClick={handleLockClick}
                  title="가격 정보 잠금/해제"
                  style={{
                    width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: unlocked ? '#C9A86E' : 'rgba(0,0,0,0.05)',
                    boxShadow: unlocked ? '0 2px 8px rgba(201,168,110,0.4)' : 'none',
                    transition: 'all .2s',
                    flexShrink: 0,
                  }}
                >
                  {unlocked
                    ? <LockOpen size={18} style={{ color: '#fff' }} />
                    : <Lock size={18} style={{ color: '#94A3B8' }} />
                  }
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[
                  { id: 'plan', label: '📋 PLAN · 주문 · 订单' },
                  { id: 'actual', label: '✅ ACTUAL · 실출고 · 实际出货' },
                ].map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)} className="chip" style={{
                    border: `1px solid ${tab === t.id ? T.primary : T.border}`,
                    background: tab === t.id ? (T.dk ? 'rgba(232,200,152,0.14)' : 'rgba(201,168,110,0.14)') : 'transparent',
                    color: tab === t.id ? T.accent : T.mu,
                    fontWeight: 600, fontSize: 11, padding: '7px 14px',
                  }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {tab === 'plan' ? (
                <MatrixTable G={T} lines={planLines} fields={{ color: 'Plan_Color', size: 'Plan_Sizes', qty: 'Plan_Quantity', price: 'Plan_Unit_Price' }} unlocked={unlocked} />
              ) : (
                <MatrixTable G={T} lines={actualLines} fields={{ color: 'Acture_Color', size: 'Acture_Sizes', qty: 'Acture_Quantity', price: 'Acture_Unit_Price' }} unlocked={unlocked} />
              )}

              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 14 }}>
                <div style={{ background: T.dk ? 'rgba(147,197,253,0.12)' : '#EEF2FF', borderRadius: 10, padding: '14px 18px', border: `1px solid ${T.dk ? 'rgba(147,197,253,0.25)' : '#C7D2FE'}` }}>
                  <div style={{ fontSize: 10, color: T.dk ? '#93C5FD' : '#4338CA', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4 }}>📋 PLAN 오더 수량</div>
                  <div className="num syne" style={{ fontSize: 24, fontWeight: 700, color: T.tx, lineHeight: 1 }}>{fmtNum(planQty)} <span style={{ fontSize: 12, color: T.mu, fontWeight: 500 }}>pcs</span></div>
                  <div style={{ fontSize: 10, color: T.mu, marginTop: 3 }}>Plan_Total_Quantity</div>
                </div>
                <div style={{ background: T.dk ? 'rgba(110,231,183,0.12)' : '#F0FDF4', borderRadius: 10, padding: '14px 18px', border: `1px solid ${T.dk ? 'rgba(110,231,183,0.25)' : '#BBF7D0'}` }}>
                  <div style={{ fontSize: 10, color: T.dk ? '#6EE7B7' : '#16A34A', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4 }}>✅ ACTUAL 실출고</div>
                  <div className="num syne" style={{ fontSize: 24, fontWeight: 700, color: T.tx, lineHeight: 1 }}>{fmtNum(actualQty)} <span style={{ fontSize: 12, color: T.mu, fontWeight: 500 }}>pcs</span></div>
                  <div style={{ fontSize: 10, color: T.mu, marginTop: 3 }}>{actualLines.length ? `${actualLines.length} 라인` : '데이터 없음 · 无数据'}</div>
                </div>
                <div style={{ background: T.dk ? 'rgba(252,211,77,0.12)' : '#FEFCE8', borderRadius: 10, padding: '14px 18px', border: `1px solid ${T.dk ? 'rgba(252,211,77,0.25)' : '#FDE68A'}` }}>
                  <div style={{ fontSize: 10, color: T.dk ? '#FCD34D' : '#A16207', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4 }}>📊 출고율 · 出货率</div>
                  <div className="num syne" style={{ fontSize: 24, fontWeight: 700, color: T.tx, lineHeight: 1 }}>{shipRate.toFixed(1)}<span style={{ fontSize: 14 }}>%</span></div>
                  <div className="num" style={{ fontSize: 10, color: T.mu, marginTop: 3 }}>{fmtNum(actualQty - planQty)} pcs</div>
                </div>
              </div>
            </div>

            {/* ──────────────────────────────────────────────
                I. Inner Pack & Bulto
            ────────────────────────────────────────────── */}
            <div style={{ marginBottom: 22 }}>
              <SectionTitle G={T} icon={<Package size={14} style={{ color: T.accent }} />} label="중간 포장 & Bulto · 中间包装 & 麻袋 · Inner Pack & Master Bag" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
                {/* Inner Pack card */}
                <div style={{ background: T.dk ? '#2A1F3A' : '#F5F3FF', borderRadius: 12, padding: 20, border: `1px solid ${T.dk ? '#3F2F55' : '#DDD6FE'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 16 }}>🟪</span>
                    <span className="syne" style={{ fontSize: 13, fontWeight: 700, color: T.dk ? '#C4B5FD' : '#5B21B6', letterSpacing: '.3px' }}>중간 포장 · Inner Pack</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.mu, marginBottom: 14 }}>1 포장 = {INNER_PACK_PCS}장 (각 조합 1장씩)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div className="num syne" style={{ fontSize: 30, fontWeight: 700, color: T.dk ? '#C4B5FD' : '#5B21B6', lineHeight: 1 }}>{INNER_PACK_PCS}</div>
                      <div style={{ fontSize: 10, color: T.mu, marginTop: 4, lineHeight: 1.4 }}>1포장 구성<br />组合数</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div className="num syne" style={{ fontSize: 30, fontWeight: 700, color: T.dk ? '#C4B5FD' : '#5B21B6', lineHeight: 1 }}>{fmtNum(expPackCount)}</div>
                      <div style={{ fontSize: 10, color: T.mu, marginTop: 4, lineHeight: 1.4 }}>예상 포장수<br />预计包装数</div>
                    </div>
                  </div>
                  {colorEntries.length && (
                    <div style={{ background: T.dk ? 'rgba(252,211,77,0.08)' : '#FEFCE8', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: T.dk ? '#FCD34D' : '#854D0E', marginBottom: 12 }}>
                      ✅ 표준 구성({colorEntries.length}색×{INNER_PACK_PCS / Math.max(colorEntries.length, 1) || '?'}사이즈={INNER_PACK_PCS}장)
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: T.mu, fontWeight: 600, marginBottom: 6, letterSpacing: '.3px' }}>구성 상세 · 组合明细</div>
                  <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {innerPackDetails.slice(0, 24).map((d, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 4, background: T.dk ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.6)', fontSize: 11 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: colorFor(d.color) }} />
                        <span style={{ flex: 1, color: T.tx, textTransform: 'uppercase', fontWeight: 500 }}>{d.color}</span>
                        <span className="num" style={{ width: 32, textAlign: 'center', color: T.tx }}>{d.size}</span>
                        <span className="num" style={{ color: T.mu, fontWeight: 600 }}>×{d.qty}</span>
                      </div>
                    ))}
                    {!innerPackDetails.length && (
                      <div style={{ padding: 12, fontSize: 11, color: T.mu, textAlign: 'center' }}>구성 데이터 없음</div>
                    )}
                  </div>
                </div>

                {/* Master Bag card */}
                <div style={{ background: T.dk ? '#3A1F22' : '#FFF1F2', borderRadius: 12, padding: 20, border: `1px solid ${T.dk ? '#552F33' : '#FECDD3'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 16 }}>🔴</span>
                    <span className="syne" style={{ fontSize: 13, fontWeight: 700, color: T.dk ? '#FCA5A5' : '#9F1239', letterSpacing: '.3px' }}>Bulto · 麻袋 · Master Bag</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.mu, marginBottom: 14 }}>1 Bulto = 10 포장 = {MASTER_BAG_PCS}장</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div className="num syne" style={{ fontSize: 30, fontWeight: 700, color: T.dk ? '#FCA5A5' : '#9F1239', lineHeight: 1 }}>{fmtNum(expBultoCount)}</div>
                      <div style={{ fontSize: 10, color: T.mu, marginTop: 4, lineHeight: 1.4 }}>예상 Bulto<br />预计麻袋</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div className="num syne" style={{ fontSize: 30, fontWeight: 700, color: T.dk ? '#FCA5A5' : '#9F1239', lineHeight: 1 }}>{fmtNum(planQty)}</div>
                      <div style={{ fontSize: 10, color: T.mu, marginTop: 4, lineHeight: 1.4 }}>Plan 총수량<br />计划总数</div>
                    </div>
                  </div>
                  <div style={{ background: T.dk ? 'rgba(196,181,253,0.12)' : '#F5F3FF', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: T.dk ? '#C4B5FD' : '#5B21B6', marginBottom: 12 }}>
                    📦 {expBultoCount} Bulto × {MASTER_BAG_PCS}장 = {fmtNum(expBultoCount * MASTER_BAG_PCS)}장
                  </div>
                  <div style={{ fontSize: 10, color: T.mu, fontWeight: 600, marginBottom: 6, letterSpacing: '.3px' }}>계산 내역 · 计算明细</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 4, background: T.dk ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.6)' }}>
                      <span style={{ color: T.mu }}>Plan 총수량</span>
                      <span className="num" style={{ color: T.tx, fontWeight: 600 }}>{fmtNum(planQty)} 장</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 4, background: T.dk ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.6)' }}>
                      <span style={{ color: T.mu }}>÷ 1 포장 ({INNER_PACK_PCS}장)</span>
                      <span className="num" style={{ color: T.tx, fontWeight: 600 }}>{fmtNum(expPackCount)} 포장</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 4, background: T.dk ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.6)' }}>
                      <span style={{ color: T.mu }}>÷ 1 Bulto (10포장)</span>
                      <span className="num" style={{ color: T.tx, fontWeight: 600 }}>{fmtNum(expBultoCount)} Bulto</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ──────────────────────────────────────────────
                J. Production Tracking
            ────────────────────────────────────────────── */}
            <div style={{ marginBottom: 22 }}>
              <SectionTitle G={T} icon={<Truck size={14} style={{ color: T.accent }} />} label="생산 추적 · 生产跟踪 · Production Tracking" />
              <div style={{ background: T.cardAlt, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {trackSteps.map((step, i) => {
                  const v = src[step.key]
                  const date = v ? parseZohoDate(v) : null
                  const past = date && date < today
                  const isToday = date && date.toDateString() === today.toDateString()
                  const stateColor = past ? T.ok : (isToday ? T.warn : T.mu)
                  const stateLabel = past ? '완료 · 完成' : (isToday ? 'D-Day' : (v ? '예정 · 预计' : '미정 · 未定'))
                  return (
                    <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: T.surf, borderRadius: 8, border: `1px solid ${T.hair}` }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${stateColor}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stateColor, flexShrink: 0 }}>
                        <step.icon size={13} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: T.tx, fontWeight: 600 }}>{step.label}</div>
                        <div className="num" style={{ fontSize: 11, color: T.mu, marginTop: 1 }}>{safe(v)}</div>
                      </div>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: `${stateColor}1A`, color: stateColor, fontWeight: 600, letterSpacing: '.3px', flexShrink: 0 }}>
                        {stateLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ──────────────────────────────────────────────
                K. Production Log (생산 로그) — collapsible, default closed
            ────────────────────────────────────────────── */}
            <div style={{ marginBottom: 22 }}>
              <div
                onClick={() => setLogOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: logOpen ? 12 : 0, paddingBottom: 8, borderBottom: `1px solid ${T.hair}`, cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={14} style={{ color: T.accent }} />
                  <h3 className="syne" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: T.accent }}>생산 로그 · 生产记录 · Production Log</h3>
                </div>
                <span style={{ fontSize: 12, color: T.mu, fontWeight: 600 }}>{logOpen ? '▲' : '▼'}</span>
              </div>
              {logOpen && (() => {
                if (prodLogsLoading) return (
                  <div style={{ background: T.cardAlt, border: `1px dashed ${T.border}`, borderRadius: 10, padding: '28px 20px', textAlign: 'center', color: T.mu, fontSize: 12 }}>
                    로딩 중 · 加载中…
                  </div>
                )
                // API data takes precedence; fall back to any subform data in the MO record
                const logs = prodLogs !== null
                  ? prodLogs
                  : pickArray(src, ['Production_Logs', 'Process_Logs', 'Operations', 'Logs', 'Cutting_Logs', 'Fabric_Logs', 'Production_Records'])
                if (!logs.length) return (
                  <div style={{ background: T.cardAlt, border: `1px dashed ${T.border}`, borderRadius: 10, padding: '28px 20px', textAlign: 'center', color: T.mu, fontSize: 12 }}>
                    아직 등록된 생산 로그가 없습니다 · 暂无生产记录
                  </div>
                )
                return <ProductionLogTable G={T} logs={logs} />
              })()}
            </div>

            {/* ──────────────────────────────────────────────
                L. Packaging Status (포장 현황) — collapsible, default closed
            ────────────────────────────────────────────── */}
            <div style={{ marginBottom: 22 }}>
              <div
                onClick={() => setPackOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: packOpen ? 12 : 0, paddingBottom: 8, borderBottom: `1px solid ${T.hair}`, cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Package size={14} style={{ color: T.accent }} />
                  <h3 className="syne" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: T.accent }}>포장 현황 · 包装现况 · Packaging Status</h3>
                </div>
                <span style={{ fontSize: 12, color: T.mu, fontWeight: 600 }}>{packOpen ? '▲' : '▼'}</span>
              </div>
              {packOpen && <PackagingSection G={T} src={src} />}
            </div>

            {loading && (
              <div style={{ padding: 12, fontSize: 11, color: T.mu, textAlign: 'center' }}>
                상세 데이터 로딩 중… · 加载详细数据中…
              </div>
            )}
          </div>
        </div>
      </div>

      {zoomSrc && <Lightbox src={zoomSrc} onClose={() => setZoomSrc(null)} />}
      {showUnlockModal && (
        <PriceUnlockModal
          G={T}
          onUnlocked={() => setUnlocked(true)}
          onClose={() => setShowUnlockModal(false)}
        />
      )}
    </>
  )
}
