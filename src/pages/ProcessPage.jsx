import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  ClipboardCheck, Search, Eye, EyeOff, Lock, Save, X,
  AlertTriangle, RotateCcw, Pencil, CheckCircle2,
} from 'lucide-react'
import { fetchMoList } from '../api/client'
import {
  fetchProcessData, verifyProcessPassword, saveProcessItem, saveProcessHidden,
} from '../api/client'
import { getMoNumber, getMoSku, getMoFactory, getMonthKey } from '../utils/moHelpers'
import ZohoImage from '../components/ZohoImage'
import { SkeletonCard } from '../components/SkeletonLoader'

// ──────────────────────────────────────────────────────────
// Process checklist schema (한중 병기 / 中韩对照)
// cells[`${section.id}.${field.key}`] = { v, d, h }
//   v = chip/free-text value · d = date · h = yellow highlight
// ⑨ 비고 备注 is stored separately as record.remark
// ──────────────────────────────────────────────────────────
const QUICK_CHIPS = ['完成', '进行中', '已下单', '未下单', '确认中', '修改中', '已入库']

const SECTIONS = [
  {
    id: 'self_sample', no: '①', kr: '자체샘플', cn: '自体样品', fields: [
      { key: 'pattern', kr: '패턴작업중', cn: '纸样制作中', type: 'chip' },
      { key: 'fit', kr: '핏조정중', cn: '版型调整中', type: 'chip' },
      { key: 'done', kr: '완성', cn: '完成', type: 'chip' },
    ],
  },
  {
    id: 'factory_sample', no: '②', kr: '공장샘플', cn: '工厂样品', fields: [
      { key: 'factory_name', kr: '공장명', cn: '工厂名称', type: 'text' },
      { key: 'final_pattern', kr: '최종패턴전달', cn: '最终纸样已交付', type: 'chip' },
      { key: 'first_sample', kr: '1차샘플완성', cn: '第一轮样品完成', type: 'chip' },
      { key: 'fine_tune', kr: '미세조정중', cn: '细节调整中', type: 'chip' },
      { key: 'size_sample', kr: '사이즈샘플완성', cn: '尺码样完成', type: 'chip' },
      { key: 'done', kr: '완성', cn: '完成', type: 'chip' },
    ],
  },
  {
    id: 'price', no: '③', kr: '가격', cn: '单价', fields: [
      { key: 'cost_fixed', kr: '공장가격확정', cn: '成本核算完成', type: 'chip' },
    ],
  },
  {
    id: 'fabric', no: '④', kr: '원단', cn: '面料', fields: [
      { key: 'ordered', kr: '오더완료', cn: '已下单', type: 'chip' },
      { key: 'type_color', kr: '종류·색상확인', cn: '品种及颜色确认', type: 'chip' },
      { key: 'eta', kr: '예상납기', cn: '预计交期', type: 'date' },
    ],
  },
  {
    id: 'sub_material', no: '⑤', kr: '부자재', cn: '辅料', fields: [
      { key: 'ordered', kr: '오더완료', cn: '已下单', type: 'chip' },
      { key: 'sample_color', kr: '샘플컬러확인', cn: '样品颜色确认', type: 'chip' },
      { key: 'eta', kr: '예상납기', cn: '预计交期', type: 'date' },
    ],
  },
  {
    id: 'label', no: '⑥', kr: '라벨', cn: '标签', fields: [
      { key: 'ordered', kr: '오더완료', cn: '已下单', type: 'chip' },
      { key: 'eta', kr: '예상납기', cn: '预计交期', type: 'date' },
    ],
  },
  {
    id: 'wash_label', no: '⑦', kr: '텍라벨', cn: '洗水标', fields: [
      { key: 'ordered', kr: '오더완료', cn: '已下单', type: 'chip' },
      { key: 'eta', kr: '예상납기', cn: '预计交期', type: 'date' },
    ],
  },
  {
    id: 'production', no: '⑧', kr: '생산', cn: '生产', fields: [
      { key: 'in_production', kr: '생산중', cn: '生产中', type: 'chip' },
      { key: 'prod_done_eta', kr: '생산완료예정', cn: '预计生产完成', type: 'date' },
      { key: 'inspection', kr: '검품', cn: '验货', type: 'chip' },
      { key: 'shipment', kr: '선적', cn: '装船', type: 'chip' },
    ],
  },
]

// ── data helpers ──
const itemNoOf = (m) => String(m?.ID || m?.MO_Number || '')

function isHexiang(factory) {
  return /hexiang|合祥/i.test(String(factory || ''))
}

function isShipped(m) {
  const ps = String(m?.Production_Status || '')
  const ds = String(m?.Delivery_Status || '')
  if (/hold|pending|待/i.test(ps)) return false // warehouse-hold = pre-shipment, keep
  return /shipped|delivered|出库|出货完/i.test(ps) || /shipped|delivered|出库|出货完/i.test(ds)
}

function procStatusBadge(m, G) {
  const raw = String(m?.Production_Status || '').trim()
  const s = raw.toLowerCase()
  const mk = (kr, cn, color) => ({ kr, cn, color })
  if (!raw) return mk('샘플제작', '产前样', G.mu)
  if (/warehouse\s*hold|shipment\s*pending|待/i.test(raw)) return mk('출고대기', '待出货', G.warn)
  if (/shipped|delivered|出库|出货完/i.test(raw)) return mk('출고완료', '已出货', G.ok)
  if (/sampling|샘플|产前样|not\s*start|미시작|未开/i.test(raw)) return mk('샘플제작', '产前样', G.mu)
  if (/fabric|면료|원단|面料/i.test(s)) return mk('원단', '面料', G.cool)
  if (/cut|재단|裁/i.test(s)) return mk('재단', '裁剪', G.warn)
  if (/sew|봉제|재봉|缝/i.test(s)) return mk('재봉', '裁缝', G.cool)
  if (/pack|포장|包装/i.test(s)) return mk('포장', '包装', G.warn)
  if (/complete|완료|完成/i.test(s)) return mk('완료', '完成', G.ok)
  return mk(raw, '', G.mu)
}

const isOrdered = (cell) => {
  const v = cell?.v || ''
  return /已下单|完成|已入库/.test(v)
}
const hasVal = (cell) => !!(cell && (cell.v || cell.d))

const PROC_FILTERS = [
  { key: '', label: '공정 상태 / 工序状态' },
  { key: 'attention', label: '⚠ 주의 필요 / 需注意', test: (c) => Object.values(c).some(v => v?.h) },
  { key: 'fabric_unordered', label: '원단 미발주 / 面料未下单', test: (c) => !isOrdered(c['fabric.ordered']) },
  { key: 'fabric_ordered', label: '원단 발주완료 / 面料已下单', test: (c) => isOrdered(c['fabric.ordered']) },
  { key: 'submaterial_unordered', label: '부자재 미발주 / 辅料未下单', test: (c) => !isOrdered(c['sub_material.ordered']) },
  { key: 'label_unordered', label: '라벨 미발주 / 标签未下单', test: (c) => !isOrdered(c['label.ordered']) },
  { key: 'in_production', label: '생산중 / 生产中', test: (c) => hasVal(c['production.in_production']) },
]

// ──────────────────────────────────────────────────────────
// Toast
// ──────────────────────────────────────────────────────────
function Toast({ toast, G }) {
  if (!toast) return null
  const ok = toast.type === 'ok'
  return (
    <div style={{
      position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
      zIndex: 2000, padding: '12px 20px', borderRadius: 10,
      background: ok ? G.ok : G.bad, color: '#fff', fontSize: 13, fontWeight: 600,
      boxShadow: '0 6px 20px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 8,
      animation: 'fadeIn .2s ease', maxWidth: '90vw',
    }}>
      {ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
      {toast.msg}
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Password modal (gate for entering edit mode)
// ──────────────────────────────────────────────────────────
function PwModal({ G, onClose, onSuccess }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => { clearTimeout(t); document.removeEventListener('keydown', h) }
  }, [onClose])

  const submit = async (e) => {
    e?.preventDefault()
    if (busy || !pw) return
    setBusy(true); setErr('')
    const ok = await verifyProcessPassword(pw)
    if (ok) {
      onSuccess(pw)
    } else {
      setBusy(false)
      setErr('비밀번호가 틀렸습니다 · 密码错误')
    }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: G.overlayBg, zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <form onSubmit={submit} style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 22, width: '100%', maxWidth: 360, boxShadow: G.cardShadow }}>
        <div className="syne" style={{ fontSize: 16, fontWeight: 700, color: G.tx, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={15} /> 수정 인증 · 修改认证
        </div>
        <div style={{ fontSize: 11, color: G.mu, marginBottom: 16 }}>편집하려면 비밀번호가 필요합니다 · 编辑需要密码</div>
        <input
          ref={inputRef} type="password" value={pw} onChange={e => setPw(e.target.value)}
          placeholder="비밀번호 · 密码" autoComplete="current-password"
          style={{ width: '100%', padding: '10px 12px', fontSize: 14, border: `1px solid ${G.border}`, borderRadius: 8, background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        {err && <div style={{ marginTop: 8, fontSize: 11, color: G.bad }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} className="btn-ghost" style={{ minHeight: 36, padding: '8px 14px', fontSize: 12 }}>취소</button>
          <button type="submit" disabled={busy || !pw} className="btn-primary" style={{ minHeight: 36, padding: '8px 14px', fontSize: 12, opacity: (busy || !pw) ? 0.55 : 1 }}>{busy ? '확인중…' : '확인'}</button>
        </div>
      </form>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Cell editor — chips + free text + date + highlight toggle
// ──────────────────────────────────────────────────────────
function CellEditor({ G, field, cell, editable, onChange }) {
  const v = cell?.v || ''
  const d = cell?.d || ''
  const h = !!cell?.h
  const hlBg = G.dk ? 'rgba(212,165,114,0.18)' : 'rgba(252,211,77,0.28)'

  if (!editable) {
    const empty = !v && !d
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: h ? '3px 6px' : 0, background: h ? hlBg : 'transparent', borderRadius: 6 }}>
        {empty ? (
          <span style={{ fontSize: 11, color: G.fa }}>—</span>
        ) : (
          <>
            {v && <span style={{ fontSize: 11, fontWeight: 600, color: G.tx, padding: '2px 8px', background: G.cardAlt, border: `1px solid ${G.hair}`, borderRadius: 999 }}>{v}</span>}
            {d && <span className="num" style={{ fontSize: 11, color: G.accent, fontWeight: 600 }}>{d}</span>}
          </>
        )}
        {h && <AlertTriangle size={11} style={{ color: G.warn }} />}
      </div>
    )
  }

  const inputStyle = { padding: '6px 8px', borderRadius: 6, fontSize: 12, border: `1px solid ${G.border}`, background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px', background: h ? hlBg : 'transparent', borderRadius: 6 }}>
      {(field.type === 'chip' || field.type === 'date') && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {QUICK_CHIPS.map(c => {
            const on = v === c
            return (
              <button key={c} type="button"
                onClick={() => onChange({ ...cell, v: on ? '' : c })}
                style={{ padding: '3px 9px', fontSize: 10.5, borderRadius: 999, cursor: 'pointer', fontWeight: 600, border: `1px solid ${on ? G.primary : G.border}`, background: on ? (G.dk ? 'rgba(232,200,152,0.18)' : 'rgba(201,168,110,0.16)') : 'transparent', color: on ? G.accent : G.mu, lineHeight: 1.4 }}>
                {c}
              </button>
            )
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={v} onChange={e => onChange({ ...cell, v: e.target.value })}
          placeholder={field.type === 'text' ? '입력 · 输入' : '자유입력 · 自由输入'}
          style={{ ...inputStyle, flex: '1 1 120px', minWidth: 100 }}
        />
        {field.type === 'date' && (
          <input type="date" value={d} onChange={e => onChange({ ...cell, d: e.target.value })} style={{ ...inputStyle, flex: '0 0 auto' }} />
        )}
        <button type="button" title="주의 필요 · 需注意"
          onClick={() => onChange({ ...cell, h: !h })}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 6, cursor: 'pointer', border: `1px solid ${h ? G.warn : G.border}`, background: h ? hlBg : 'transparent', color: h ? G.warn : G.mu, flexShrink: 0 }}>
          <AlertTriangle size={13} />
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Process card (one order)
// ──────────────────────────────────────────────────────────
function ProcessCard({ G, mo, record, editable, isHidden, onSaveItem, onToggleHidden, canMutate }) {
  // local draft seeded from saved record; only committed on save
  const [draftCells, setDraftCells] = useState(null)
  const [draftRemark, setDraftRemark] = useState(null)
  const [saving, setSaving] = useState(false)

  const savedCells = record?.cells || {}
  const savedRemark = record?.remark || ''

  const cells = draftCells ?? savedCells
  const remark = draftRemark ?? savedRemark
  const dirty = draftCells !== null || draftRemark !== null

  // discard local drafts when leaving edit mode
  useEffect(() => {
    if (!editable) { setDraftCells(null); setDraftRemark(null) }
  }, [editable])

  const setCell = useCallback((cellKey, val) => {
    setDraftCells(prev => {
      const base = prev ?? savedCells
      const next = { ...base, [cellKey]: val }
      // prune fully-empty cells
      if (!val || (!val.v && !val.d && !val.h)) delete next[cellKey]
      return next
    })
  }, [savedCells])

  const badge = procStatusBadge(mo, G)
  const chiName = typeof mo.Chi_Style_Name === 'string' ? mo.Chi_Style_Name : (mo.Chi_Style_Name?.zc_display_value || '')
  const monthKey = getMonthKey(mo)

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    // prune empty cells before sending
    const cleaned = {}
    for (const [k, val] of Object.entries(cells)) {
      if (val && (val.v || val.d || val.h)) cleaned[k] = val
    }
    const ok = await onSaveItem(itemNoOf(mo), cleaned, remark)
    setSaving(false)
    if (ok) { setDraftCells(null); setDraftRemark(null) }
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: isHidden ? 0.7 : 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, padding: 14, borderBottom: `1px solid ${G.hair}` }}>
        <div style={{ width: 64, height: 80, borderRadius: 8, background: G.cardAlt, overflow: 'hidden', flexShrink: 0, border: `1px solid ${G.hair}` }}>
          <ZohoImage mo={mo} field="Style_Image" G={G} iconSize={20} placeholderText="" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="num" style={{ fontSize: 14, fontWeight: 700, color: G.accent }}>{getMoNumber(mo)}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: badge.color, padding: '2px 8px', borderRadius: 999 }}>
              {badge.kr}{badge.cn ? ` · ${badge.cn}` : ''}
            </span>
            {isShipped(mo) && <span style={{ fontSize: 9, color: G.ok, border: `1px solid ${G.ok}`, padding: '1px 6px', borderRadius: 999 }}>출고 已出货</span>}
          </div>
          <div title={getMoSku(mo)} style={{ fontSize: 11, color: G.tx, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getMoSku(mo)}</div>
          {chiName && <div title={chiName} style={{ fontSize: 11, color: G.mu, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chiName}</div>}
          <div style={{ fontSize: 10, color: G.fa, marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span>🏭 {getMoFactory(mo)}</span>
            {monthKey && <span>📅 {monthKey}</span>}
          </div>
        </div>
        {/* actions */}
        {editable && canMutate && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <button onClick={handleSave} disabled={saving || !dirty} className="btn-primary"
              style={{ minHeight: 32, padding: '6px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, opacity: (saving || !dirty) ? 0.5 : 1 }}>
              <Save size={13} /> {saving ? '저장중' : '저장'}
            </button>
            <button onClick={() => onToggleHidden(itemNoOf(mo), !isHidden)} className="btn-ghost"
              style={{ minHeight: 30, padding: '5px 10px', fontSize: 10.5, display: 'flex', alignItems: 'center', gap: 5 }}>
              {isHidden ? <><RotateCcw size={12} /> 복원</> : <><EyeOff size={12} /> 숨기기</>}
            </button>
          </div>
        )}
      </div>

      {/* Checklist */}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {SECTIONS.map(sec => (
          <div key={sec.id}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: G.tx, marginBottom: 6 }}>
              <span style={{ color: G.accent, marginRight: 5 }}>{sec.no}</span>{sec.kr} <span style={{ color: G.mu, fontWeight: 500 }}>{sec.cn}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: editable ? 8 : 4, paddingLeft: 4 }}>
              {sec.fields.map(f => {
                const cellKey = `${sec.id}.${f.key}`
                return (
                  <div key={cellKey} style={{ display: 'grid', gridTemplateColumns: editable ? '110px 1fr' : '110px 1fr', gap: 8, alignItems: editable ? 'start' : 'center' }}>
                    <div style={{ fontSize: 10.5, color: G.mu, paddingTop: editable ? 8 : 0, lineHeight: 1.3 }}>
                      {f.kr}<br /><span style={{ color: G.fa, fontSize: 9.5 }}>{f.cn}</span>
                    </div>
                    <CellEditor G={G} field={f} cell={cells[cellKey]} editable={editable} onChange={(val) => setCell(cellKey, val)} />
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* ⑨ 비고 */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: G.tx, marginBottom: 6 }}>
            <span style={{ color: G.accent, marginRight: 5 }}>⑨</span>비고 <span style={{ color: G.mu, fontWeight: 500 }}>备注</span>
          </div>
          {editable ? (
            <textarea value={remark} onChange={e => setDraftRemark(e.target.value)} rows={2}
              placeholder="자유 메모 · 自由备注"
              style={{ width: '100%', padding: '8px 10px', fontSize: 12, border: `1px solid ${G.border}`, borderRadius: 8, background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
          ) : (
            <div style={{ fontSize: 12, color: remark ? G.tx : G.fa, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{remark || '—'}</div>
          )}
        </div>

        {record?.lastUpdated && (
          <div style={{ fontSize: 9.5, color: G.fa, textAlign: 'right' }}>
            최근 수정 · 最近修改: {fmtTime(record.lastUpdated)}{record.lastUpdatedBy ? ` · ${record.lastUpdatedBy}` : ''}
          </div>
        )}
      </div>
    </div>
  )
}

function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function Rail({ G }) { return G.dk ? <span className="rail" /> : null }

// ──────────────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────────────
export default function ProcessPage({ G }) {
  const [moList, setMoList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [proc, setProc] = useState({ items: {}, hidden: [], lastUpdated: null, lastUpdatedBy: null })
  const [procLoading, setProcLoading] = useState(true)

  // edit state
  const [editMode, setEditMode] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [password, setPassword] = useState('')   // kept in memory during edit session
  const [editorName, setEditorName] = useState('')
  const [toast, setToast] = useState(null)

  // filters
  const [category, setCategory] = useState('all') // all | hexiang | outsource
  const [subFactory, setSubFactory] = useState('') // specific outsource factory
  const [search, setSearch] = useState('')
  const [factorySel, setFactorySel] = useState([]) // multi-select factory dropdown
  const [month, setMonth] = useState('')
  const [procFilter, setProcFilter] = useState('')
  const [showHidden, setShowHidden] = useState(false)

  const toastTimer = useRef(null)
  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  const loadMo = useCallback(() => {
    setLoading(true); setError(null)
    fetchMoList({ perPage: 200 })
      .then(data => setMoList(data?.data || data?.records || data?.result || []))
      .catch(err => { console.error('[ProcessPage] mo', err); setError(err.message) })
      .finally(() => setLoading(false))
  }, [])

  const loadProc = useCallback(() => {
    setProcLoading(true)
    fetchProcessData()
      .then(d => setProc({ items: d?.items || {}, hidden: d?.hidden || [], lastUpdated: d?.lastUpdated || null, lastUpdatedBy: d?.lastUpdatedBy || null }))
      .catch(err => console.error('[ProcessPage] proc', err))
      .finally(() => setProcLoading(false))
  }, [])

  useEffect(() => {
    loadMo(); loadProc()
    const h = () => { loadMo(); loadProc() }
    window.addEventListener('iku:refresh', h)
    return () => window.removeEventListener('iku:refresh', h)
  }, [loadMo, loadProc])

  const hiddenSet = useMemo(() => new Set(proc.hidden || []), [proc.hidden])
  const searching = search.trim().length > 0

  // base list before category/secondary filters
  const baseList = useMemo(() => {
    return moList.filter(m => {
      const id = itemNoOf(m)
      if (!id) return false
      const hidden = hiddenSet.has(id)
      if (showHidden) return hidden
      if (hidden) return false
      // default: hide shipped — unless actively searching (manual lookup)
      if (!searching && isShipped(m)) return false
      return true
    })
  }, [moList, hiddenSet, showHidden, searching])

  // outsource factory chip options (from base list, non-hexiang)
  const outsourceFactories = useMemo(() => {
    const set = new Set()
    baseList.forEach(m => { const f = getMoFactory(m); if (f && f !== '—' && !isHexiang(f)) set.add(f) })
    return [...set].sort()
  }, [baseList])

  const allFactories = useMemo(() => {
    const set = new Set()
    baseList.forEach(m => { const f = getMoFactory(m); if (f && f !== '—') set.add(f) })
    return [...set].sort()
  }, [baseList])

  const months = useMemo(() => {
    return [...new Set(baseList.map(getMonthKey).filter(Boolean))].sort().reverse()
  }, [baseList])

  // category counts (ignore the category filter itself)
  const catCounts = useMemo(() => {
    let all = 0, hx = 0, out = 0
    baseList.forEach(m => {
      all++
      if (isHexiang(getMoFactory(m))) hx++; else out++
    })
    return { all, hx, out }
  }, [baseList])

  const procFilterFn = useMemo(() => PROC_FILTERS.find(p => p.key === procFilter)?.test, [procFilter])

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase()
    return baseList.filter(m => {
      const f = getMoFactory(m)
      // category
      if (category === 'hexiang' && !isHexiang(f)) return false
      if (category === 'outsource' && isHexiang(f)) return false
      if (category === 'outsource' && subFactory && f !== subFactory) return false
      // factory multi-select
      if (factorySel.length && !factorySel.includes(f)) return false
      // month
      if (month && getMonthKey(m) !== month) return false
      // search
      if (s) {
        const blob = `${getMoNumber(m)} ${getMoSku(m)} ${f} ${m.Chi_Style_Name || ''} ${m.Eng_Style_Name || ''}`.toLowerCase()
        if (!blob.includes(s)) return false
      }
      // process-status filter (acts on saved cells)
      if (procFilterFn) {
        const cells = proc.items[itemNoOf(m)]?.cells || {}
        if (!procFilterFn(cells)) return false
      }
      return true
    })
  }, [baseList, category, subFactory, factorySel, month, search, procFilterFn, proc.items])

  // ── edit flow ──
  const onEditClick = () => {
    if (editMode) {
      // exit edit mode
      setEditMode(false); setPassword('')
    } else {
      setPwOpen(true)
    }
  }
  const onPwSuccess = (pw) => {
    setPassword(pw); setPwOpen(false); setEditMode(true)
    showToast('편집 모드 · 编辑模式', 'ok')
  }

  const requireEditor = () => {
    if (!editorName.trim()) {
      showToast('수정자 이름을 입력하세요 · 请输入修改人姓名', 'bad')
      return false
    }
    return true
  }

  const handleSaveItem = useCallback(async (itemNo, cells, remark) => {
    if (!requireEditor()) return false
    try {
      const res = await saveProcessItem({ password, editorName: editorName.trim(), itemNo, cells, remark })
      if (res?.ok) {
        setProc(p => ({ ...p, items: { ...p.items, [itemNo]: res.record }, lastUpdated: res.record.lastUpdated, lastUpdatedBy: res.record.lastUpdatedBy }))
        showToast('저장 완료 · 保存成功', 'ok')
        return true
      }
      showToast(res?.message || '저장 실패 · 保存失败', 'bad')
      return false
    } catch (err) {
      showToast(err?.data?.message || '저장 실패 · 保存失败', 'bad')
      return false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password, editorName, showToast])

  const handleToggleHidden = useCallback(async (itemNo, hide) => {
    if (!requireEditor()) return
    const next = hide ? [...new Set([...(proc.hidden || []), itemNo])] : (proc.hidden || []).filter(x => x !== itemNo)
    try {
      const res = await saveProcessHidden({ password, editorName: editorName.trim(), hidden: next })
      if (res?.ok) {
        setProc(p => ({ ...p, hidden: res.hidden }))
        showToast(hide ? '숨김 처리 · 已隐藏' : '복원 완료 · 已恢复', 'ok')
      } else {
        showToast(res?.message || '실패 · 失败', 'bad')
      }
    } catch (err) {
      showToast(err?.data?.message || '실패 · 失败', 'bad')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password, editorName, proc.hidden, showToast])

  const resetFilters = () => {
    setCategory('all'); setSubFactory(''); setSearch(''); setFactorySel([]); setMonth(''); setProcFilter('')
  }

  const activeFilterChips = []
  if (category !== 'all') activeFilterChips.push({ k: 'cat', label: category === 'hexiang' ? 'HEXIANG 合祥' : '외주 外发', clear: () => { setCategory('all'); setSubFactory('') } })
  if (subFactory) activeFilterChips.push({ k: 'sub', label: subFactory, clear: () => setSubFactory('') })
  factorySel.forEach(f => activeFilterChips.push({ k: 'f' + f, label: f, clear: () => setFactorySel(prev => prev.filter(x => x !== f)) }))
  if (month) activeFilterChips.push({ k: 'm', label: month, clear: () => setMonth('') })
  if (procFilter) activeFilterChips.push({ k: 'pf', label: PROC_FILTERS.find(p => p.key === procFilter)?.label || procFilter, clear: () => setProcFilter('') })
  if (search) activeFilterChips.push({ k: 's', label: `"${search}"`, clear: () => setSearch('') })

  const inputStyle = { padding: '8px 12px', borderRadius: 8, fontSize: 12, border: `1px solid ${G.border}`, background: G.card, color: G.tx, outline: 'none', fontFamily: 'inherit' }

  const CatTab = ({ id, kr, cn, count }) => {
    const on = category === id
    return (
      <button onClick={() => { setCategory(id); if (id !== 'outsource') setSubFactory('') }} className="chip" style={{
        border: `1px solid ${on ? G.primary : G.border}`,
        background: on ? (G.dk ? 'rgba(232,200,152,0.12)' : 'rgba(201,168,110,0.12)') : 'transparent',
        color: on ? G.accent : G.mu, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        {kr} <span style={{ color: G.mu, fontWeight: 500 }}>{cn}</span>
        <span className="num" style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: on ? G.primary : G.hair, color: on ? '#fff' : G.mu }}>{count}</span>
      </button>
    )
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Header */}
      <div className="card" style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <Rail G={G} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="syne" style={{ background: G.primary, color: '#FFF', padding: '6px 10px', borderRadius: 6, display: 'flex' }}><ClipboardCheck size={16} /></span>
          <div>
            <div className="syne" style={{ fontSize: 18, fontWeight: 700, color: G.tx, letterSpacing: '-.3px' }}>공정 확인 · 工序确认</div>
            <div style={{ fontSize: 11, color: G.mu, marginTop: 1 }}>오더별 공정 진행 관리 · 订单工序进度管理</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {proc.lastUpdated && (
            <div style={{ fontSize: 10.5, color: G.mu, textAlign: 'right' }}>
              최근 수정 · 最近修改<br /><span className="num" style={{ color: G.tx }}>{fmtTime(proc.lastUpdated)}</span>{proc.lastUpdatedBy ? ` · ${proc.lastUpdatedBy}` : ''}
            </div>
          )}
          <button onClick={onEditClick} className={editMode ? 'btn-primary' : 'btn-ghost'}
            style={{ minHeight: 38, padding: '8px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            {editMode ? <><X size={14} /> 편집 종료 · 退出</> : <><Pencil size={14} /> 수정 · 修改</>}
          </button>
        </div>
      </div>

      {/* Edit bar */}
      {editMode && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderColor: G.primary }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: G.accent, display: 'flex', alignItems: 'center', gap: 6 }}><Pencil size={13} /> 편집 모드 · 编辑模式</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: G.mu }}>수정자 · 修改人 <span style={{ color: G.bad }}>*</span></span>
            <input value={editorName} onChange={e => setEditorName(e.target.value)} placeholder="이름 · 姓名"
              style={{ ...inputStyle, padding: '6px 10px', minWidth: 140 }} />
          </div>
          <span style={{ fontSize: 10.5, color: G.fa }}>저장하려면 수정자 이름이 필요합니다 · 保存需填写修改人</span>
        </div>
      )}

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <CatTab id="all" kr="전체" cn="全部" count={catCounts.all} />
        <CatTab id="hexiang" kr="HEXIANG" cn="合祥" count={catCounts.hx} />
        <CatTab id="outsource" kr="외주공장" cn="外发工厂" count={catCounts.out} />
      </div>

      {/* Outsource sub-factory chips */}
      {category === 'outsource' && outsourceFactories.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <button onClick={() => setSubFactory('')} className="chip" style={{ border: `1px solid ${!subFactory ? G.primary : G.border}`, background: !subFactory ? (G.dk ? 'rgba(232,200,152,0.12)' : 'rgba(201,168,110,0.12)') : 'transparent', color: !subFactory ? G.accent : G.mu, fontWeight: 600, fontSize: 10.5 }}>전체 全部</button>
          {outsourceFactories.map(f => (
            <button key={f} onClick={() => setSubFactory(f)} className="chip" style={{ border: `1px solid ${subFactory === f ? G.primary : G.border}`, background: subFactory === f ? (G.dk ? 'rgba(232,200,152,0.12)' : 'rgba(201,168,110,0.12)') : 'transparent', color: subFactory === f ? G.accent : G.mu, fontWeight: 600, fontSize: 10.5 }}>{f}</button>
          ))}
        </div>
      )}

      {/* Filter panel */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', top: 11, left: 10, color: G.mu, pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="아이템·오더번호·중국명 검색 / 搜索" style={{ ...inputStyle, width: '100%', paddingLeft: 30 }} />
        </div>
        <select value={month} onChange={e => setMonth(e.target.value)} style={inputStyle}>
          <option value="">월별 · 月份</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={procFilter} onChange={e => setProcFilter(e.target.value)} style={inputStyle}>
          {PROC_FILTERS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <select value="" onChange={e => { const v = e.target.value; if (v) setFactorySel(prev => prev.includes(v) ? prev : [...prev, v]) }} style={inputStyle}>
          <option value="">공장 추가 · 添加工厂</option>
          {allFactories.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <button onClick={() => setShowHidden(s => !s)} className="chip" style={{ border: `1px solid ${showHidden ? G.primary : G.border}`, background: showHidden ? (G.dk ? 'rgba(232,200,152,0.12)' : 'rgba(201,168,110,0.12)') : 'transparent', color: showHidden ? G.accent : G.mu, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {showHidden ? <Eye size={13} /> : <EyeOff size={13} />} 숨긴 오더 {showHidden ? '숨기기' : '보기'} · {proc.hidden?.length || 0}
        </button>
      </div>

      {/* Active filter chips */}
      {activeFilterChips.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {activeFilterChips.map(c => (
            <span key={c.k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, padding: '3px 8px', borderRadius: 999, background: G.cardAlt, border: `1px solid ${G.hair}`, color: G.tx }}>
              {c.label}
              <button onClick={c.clear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.mu, display: 'flex', padding: 0 }}><X size={11} /></button>
            </span>
          ))}
          <button onClick={resetFilters} style={{ fontSize: 10.5, color: G.accent, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>전체 초기화 · 重置</button>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 16, padding: 14, borderRadius: 10, fontSize: 13, color: G.bad, background: `${G.bad}1A`, border: `1px solid ${G.bad}40` }}>
          <strong>오류 · 错误:</strong> {error}
        </div>
      )}

      {/* Result count */}
      <div style={{ fontSize: 11, color: G.mu, marginBottom: 12 }}>
        {loading ? '불러오는 중 · 加载中…' : `${visible.length}개 오더 · ${visible.length} 个订单`}{showHidden ? ' (숨김 목록 · 隐藏列表)' : ''}
      </div>

      {/* Cards */}
      {loading || procLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} G={G} />)}
        </div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: G.mu }}>
          <ClipboardCheck size={40} style={{ color: G.fa, marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>표시할 오더가 없습니다 · 没有可显示的订单</div>
          <div style={{ fontSize: 12, color: G.fa, marginTop: 4 }}>필터를 조정하거나 검색해 보세요 · 请调整筛选或搜索</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, alignItems: 'start' }}>
          {visible.map(mo => (
            <ProcessCard
              key={itemNoOf(mo)} G={G} mo={mo}
              record={proc.items[itemNoOf(mo)]}
              editable={editMode}
              canMutate={editMode}
              isHidden={hiddenSet.has(itemNoOf(mo))}
              onSaveItem={handleSaveItem}
              onToggleHidden={handleToggleHidden}
            />
          ))}
        </div>
      )}

      {pwOpen && <PwModal G={G} onClose={() => setPwOpen(false)} onSuccess={onPwSuccess} />}
      <Toast toast={toast} G={G} />
    </div>
  )
}
