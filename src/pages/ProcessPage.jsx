import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  ClipboardCheck, Search, Lock, Save, X,
  AlertTriangle, Pencil, CheckCircle2, Calendar,
  ChevronLeft, ChevronRight, MessageSquare, ZoomIn, ChevronUp, ChevronDown, Trash2,
} from 'lucide-react'
import { fetchMoList } from '../api/client'
import {
  fetchProcessData, verifyProcessPassword, saveProcessItem,
  fetchStyleList, fetchStyleMeta, saveStyleFactory, saveStyleNote, hideStyle,
  fetchMoFabric, saveMoFabric,
  fetchDeletions, deleteMo, deleteStyle,
} from '../api/client'
import { getMoNumber, getMoSku, getMoFactory, getMonthKey } from '../utils/moHelpers'
import { pick, F as SF, isOrdered as styleIsOrdered, styleKey, seasonOf, monthOf } from '../utils/styleFields'
import ZohoImage from '../components/ZohoImage'
import { SkeletonCard } from '../components/SkeletonLoader'
import HexiangFactoryWidget from '../components/HexiangFactoryWidget'
import UnorderedStyleCard from '../components/UnorderedStyleCard'

// ──────────────────────────────────────────────────────────
// Process checklist schema (한중 병기 / 中韩对照)
// cells[`${section.id}.${field.key}`] = { v, d, h }
//   v = status/free-text value · d = date (yyyy-mm-dd) · h = yellow highlight
// cells[`${section.id}._memo`]      = { v }   ← per-section 비고 (item ⑤)
// record.remark                     = card-wide 비고 ⑨
//
// KV key layout (process:{itemNo}) is unchanged — section memos live inside the
// same `cells` object so old saved records stay compatible.
// ──────────────────────────────────────────────────────────

// New status system — every chip shows "한국어 中文" (item ③).
// `value` is the canonical stored token (Chinese) so old data + filters keep
// working; `stock` marks the 입고완료 chip (raw-material sections only).
const STATUS_OPTIONS = [
  { v: '未下单', ko: '미오더', cn: '未下单' },
  { v: '已下单', ko: '오더완료', cn: '已下单' },
  { v: '制作中', ko: '제작 중', cn: '制作中' },
  { v: '修改中', ko: '수정 중', cn: '修改中' },
  { v: '已入库', ko: '입고완료', cn: '已入库', stock: true },
  { v: '完成', ko: '완성', cn: '完成' },
]

// Section-specific status sets (items ⑤ 생산 / ⑥ 가격).
const PRODUCTION_STATUSES = [
  { v: '裁剪中', ko: '재단 중', cn: '裁剪中' },
  { v: '裁缝中', ko: '재봉 중', cn: '裁缝中' },
  { v: '包装中', ko: '포장 중', cn: '包装中' },
  { v: '生产完成', ko: '생산완료', cn: '生产完成' },
]
const PRICE_STATUSES = [
  { v: '报价中', ko: '산출중', cn: '报价中' },
  { v: '报价完成', ko: '산출완료', cn: '报价完成' },
]

const ALL_STATUS = [...STATUS_OPTIONS, ...PRODUCTION_STATUSES, ...PRICE_STATUSES]

// Values treated as "완료" → ✅ + no blink (item ⑧/⑨).
const DONE_VALUES = new Set(['完成', '已入库', '生产完成', '报价完成'])

// Raw-material sections that may use the 입고완료 已入库 chip (item ③).
const RAW_SECTIONS = new Set(['fabric', 'sub_material', 'label', 'wash_label'])

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
      { key: 'cost_fixed', kr: '공장가격확정', cn: '成本核算', type: 'chip', statuses: PRICE_STATUSES },
    ],
  },
  {
    id: 'fabric', no: '④', kr: '원단', cn: '面料', fields: [
      { key: 'ordered', kr: '오더완료', cn: '已下单', type: 'chip' },
      { key: 'type_color', kr: '퀄리티·색상확인', cn: '品质及颜色确认', type: 'chip' },
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
      { key: 'in_production', kr: '생산상태', cn: '生产状态', type: 'chip', statuses: PRODUCTION_STATUSES },
      { key: 'prod_done_eta', kr: '생산완료예정', cn: '预计生产完成', type: 'date' },
      { key: 'ship_eta', kr: '선적예정일', cn: '预计装船日', type: 'date' },
      // 검품 验货 / 선적 装船 rows removed (item ⑤). Old saved values are kept in
      // KV (not deleted) — they are simply no longer rendered.
    ],
  },
]

// ── status helpers ──
function statusLabel(v) {
  const o = ALL_STATUS.find(x => x.v === v)
  return o ? `${o.ko} ${o.cn}` : v
}
// 'done' (✅) · 'mid' (red blink) · 'none'
function chipStatus(cell) {
  const v = cell?.v || ''
  if (DONE_VALUES.has(v)) return 'done'
  if (v) return 'mid'
  return 'none'
}

// Section aggregate status (chip fields only — dates/text excluded).
//   'ok'   : at least one chip selected and ALL selected are done
//   'warn' : at least one selected chip is a mid (incomplete) status
//   'none' : no chip selected
function sectionStatus(sec, cells) {
  const chips = sec.fields.filter(f => f.type === 'chip')
  const selected = chips.filter(f => cells[`${sec.id}.${f.key}`]?.v)
  if (!selected.length) return 'none'
  const anyMid = selected.some(f => !DONE_VALUES.has(cells[`${sec.id}.${f.key}`]?.v))
  return anyMid ? 'warn' : 'ok'
}

// ── date helpers (yyyy-mm-dd, compatible with prior input[type=date] values) ──
function parseYMD(s) {
  if (!s || typeof s !== 'string') return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}
function formatYMD(date) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

// ── data helpers ──
const itemNoOf = (m) => String(m?.ID || m?.MO_Number || '')
function isHexiang(factory) { return /hexiang|合祥/i.test(String(factory || '')) }

// Extract a plain string from a Zoho field (string | {zc_display_value} | etc.)
function fieldStr(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') return String(v.zc_display_value || v.display_value || '').trim()
  return String(v).trim()
}

// 원단 정보 (원단이름 / 중량 / 성분) — reuses the same All_MO fields the MO
// detail view reads: Material_Type, Fabric_Weight, blended(혼방/성분).
function getFabricInfo(mo) {
  const name = fieldStr(mo?.Material_Type)
  let weight = fieldStr(mo?.Fabric_Weight)
  if (weight && /^\d+(\.\d+)?$/.test(weight)) weight = `${weight}g`
  const composition = fieldStr(mo?.blended)
  const parts = [name, weight, composition].filter(Boolean)
  return { name, weight, composition, summary: parts.join(' · '), has: parts.length > 0 }
}

// Build the same proxy URL ZohoImage renders, for the lightbox (item ②).
function styleImageUrl(mo) {
  const v = mo?.Style_Image
  if (!v) return null
  const first = Array.isArray(v) ? v[0] : v
  const path = typeof first === 'string' ? first : (first?.url || first?.filepath || first?.path)
  return path ? `/api/zoho-image?filepath=${encodeURIComponent(path)}` : null
}
function isShipped(m) {
  const ps = String(m?.Production_Status || '')
  const ds = String(m?.Delivery_Status || '')
  if (/hold|pending|待/i.test(ps)) return false
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

const isOrdered = (cell) => /已下单|完成|已入库/.test(cell?.v || '')
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
// Print page builder (item ④) — generates a standalone, print-optimised HTML
// document for the selected MOs, including only the sections expanded on screen.
// All UI text is bilingual (KO 中). Blink animations are dropped; mid statuses
// render as static red text.
// ──────────────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function buildPrintHTML({ mos, items, isExpanded, origin, now }) {
  const stamp = (() => {
    const p = (n) => String(n).padStart(2, '0')
    return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}`
  })()

  // Static palette so procStatusBadge works without the live theme object.
  const PG = { mu: '#7A7264', warn: '#8A5A2E', ok: '#4A7058', cool: '#4E627A' }

  const cardHTML = (mo) => {
    const itemNo = String(mo?.ID || mo?.MO_Number || '')
    const rec = items[itemNo] || {}
    const cells = rec.cells || {}
    const fab = getFabricInfo(mo)
    const fabricName = cells['fabric.fabricName']?.v || ''
    const chiName = typeof mo.Chi_Style_Name === 'string' ? mo.Chi_Style_Name : (mo.Chi_Style_Name?.zc_display_value || '')
    const v = mo?.Style_Image
    const first = Array.isArray(v) ? v[0] : v
    const path = typeof first === 'string' ? first : (first?.url || first?.filepath || first?.path)
    const imgSrc = path ? `${origin}/api/zoho-image?filepath=${encodeURIComponent(path)}` : ''
    const badge = procStatusBadge(mo, PG)

    // header — mirrors the on-screen card header (image left + info right)
    const header = `
      <div class="card-head">
        ${imgSrc ? `<img class="thumb" src="${escapeHtml(imgSrc)}" alt="" />` : '<div class="thumb"></div>'}
        <div class="head-info">
          <div class="mo-line">
            <span class="mono mo-no">${escapeHtml(getMoNumber(mo))}</span>
            <span class="badge" style="background:${badge.color}">${escapeHtml(badge.kr)}${badge.cn ? ` · ${escapeHtml(badge.cn)}` : ''}</span>
            ${isShipped(mo) ? '<span class="ship">출고 已出货</span>' : ''}
          </div>
          <div class="sku">${escapeHtml(getMoSku(mo))}</div>
          ${chiName ? `<div class="chi">${escapeHtml(chiName)}</div>` : ''}
          <div class="meta">🏭 ${escapeHtml(getMoFactory(mo))}${getMonthKey(mo) ? ` · 📅 ${escapeHtml(getMonthKey(mo))}` : ''}</div>
          ${fab.has ? `<div class="meta">🧵 ${escapeHtml(fab.summary)}</div>` : ''}
        </div>
      </div>`

    // all sections — expanded → full content, collapsed → title row only (item ②)
    const secsHTML = SECTIONS.map(sec => {
      const expanded = isExpanded(itemNo, sec.id)
      const status = sectionStatus(sec, cells)
      const ind = status === 'ok' ? '<span class="ind ok">✓</span>'
        : status === 'warn' ? '<span class="ind warn">⚠</span>' : ''
      // fabricName shown in the title (read-mode behaviour on screen)
      const fabTitle = sec.id === 'fabric' && fabricName ? `<span class="fabname">🧵 ${escapeHtml(fabricName)}</span>` : ''
      const title = `<div class="sec-title"><span class="ttl"><span class="no">${escapeHtml(sec.no)}</span> ${escapeHtml(sec.kr)} <span class="cn">${escapeHtml(sec.cn)}</span></span>${fabTitle}${ind ? `<span class="ind-wrap">${ind}</span>` : ''}</div>`

      if (!expanded) return `<div class="sec collapsed">${title}</div>`

      const rows = sec.fields.map(f => {
        const cell = cells[`${sec.id}.${f.key}`]
        const cv = cell?.v || ''
        const cd = cell?.d || ''
        let valHTML = ''
        if (f.type === 'date') {
          valHTML = cd ? `<span class="mono">${escapeHtml(cd)}</span>` : '<span class="empty">— 미입력 未填写</span>'
        } else if (f.type === 'text') {
          valHTML = cv ? escapeHtml(cv) : '<span class="empty">— 미입력 未填写</span>'
        } else {
          const done = DONE_VALUES.has(cv)
          if (!cv) valHTML = '<span class="empty">— 미선택 未选择</span>'
          else valHTML = `<span class="${done ? 'done' : 'mid'}">${done ? '✅ ' : ''}${escapeHtml(statusLabel(cv))}</span>${cd ? ` <span class="mono">${escapeHtml(cd)}</span>` : ''}`
        }
        const labelCls = f.type === 'chip' && DONE_VALUES.has(cv) ? 'done' : (f.type === 'chip' && cv ? 'mid' : '')
        return `<tr><td class="lbl ${labelCls}">${escapeHtml(f.kr)}<br><span class="cn">${escapeHtml(f.cn)}</span></td><td class="val">${valHTML}</td></tr>`
      }).join('')
      const memo = cells[`${sec.id}._memo`]?.v || ''
      const memoRow = memo ? `<tr><td class="lbl">비고<br><span class="cn">备注</span></td><td class="val memo">${escapeHtml(memo)}</td></tr>` : ''
      return `<div class="sec">${title}<table class="grid">${rows}${memoRow}</table></div>`
    }).join('')

    // ⑨ card-wide remark — always shown (not collapsible on screen)
    const remark = rec.remark || ''
    const remarkHTML = `<div class="sec"><div class="sec-title"><span class="ttl"><span class="no">⑨</span> 전체 비고 <span class="cn">整体备注</span></span></div><div class="remark">${remark ? escapeHtml(remark) : '—'}</div></div>`

    return `<section class="card">${header}${secsHTML}${remarkHTML}</section>`
  }

  const body = mos.map(cardHTML).join('')

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<title>产前确认 · 생산 전 체크</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { font-family: 'Noto Sans KR','Noto Sans SC',-apple-system,system-ui,sans-serif; color: #1A1714; background: #8f8f8f; padding: 28px 0 40px; }

  .toolbar { position: fixed; top: 12px; right: 16px; z-index: 20; }
  .print-btn { background: #1A1714; color: #fff; border: none; border-radius: 6px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,0.35); }

  /* offscreen measuring area — same width as a sheet column row */
  #measure { position: absolute; left: -10000px; top: 0; width: 186mm; visibility: hidden; }

  /* A4 sheets stacked vertically (paper preview) */
  .sheet { width: 210mm; height: 297mm; background: #fff; margin: 0 auto 20px; box-shadow: 0 6px 22px rgba(0,0,0,0.35); overflow: visible; }
  .sheet-inner { padding: 12mm; height: 100%; display: flex; flex-direction: column; }
  .sheet-head { border-bottom: 2px solid #C9A86E; padding-bottom: 8px; margin-bottom: 10px; flex-shrink: 0; }
  .sheet-head h1 { font-size: 18px; margin: 0; color: #9A7228; }
  .sheet-head .stamp { font-size: 11px; color: #5A5248; margin-top: 2px; }
  .sheet-body { flex: 1; display: flex; gap: 6mm; align-items: flex-start; min-height: 0; }
  .col { width: 90mm; display: flex; flex-direction: column; gap: 6mm; }
  .sheet-foot { flex-shrink: 0; text-align: center; font-size: 10px; color: #7A7264; padding-top: 6px; letter-spacing: 1px; }

  .card { width: 90mm; border: 1px solid #E4DED2; border-radius: 10px; padding: 12px; }
  .card-head { display: flex; gap: 10px; border-bottom: 1px solid #EDE8DE; padding-bottom: 9px; margin-bottom: 9px; }
  .thumb { width: 72px; height: 96px; object-fit: cover; object-position: top center; border-radius: 6px; border: 1px solid #E4DED2; background: #FBF9F4; flex-shrink: 0; }
  .head-info { flex: 1; min-width: 0; }
  .mo-line { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; }
  .mo-no { font-size: 14px; font-weight: 700; color: #9A7228; }
  .badge { font-size: 9px; font-weight: 700; color: #fff; padding: 1px 7px; border-radius: 999px; }
  .ship { font-size: 8.5px; color: #4A7058; border: 1px solid #4A7058; padding: 0 5px; border-radius: 999px; }
  .sku { font-size: 11px; margin-top: 3px; }
  .chi { font-size: 11px; color: #5A5248; }
  .meta { font-size: 10px; color: #7A7264; margin-top: 2px; }

  .sec { padding-bottom: 8px; margin-top: 9px; border-bottom: 1px solid #EDE8DE; }
  .sec:first-of-type { margin-top: 0; }
  .sec.collapsed { padding-bottom: 6px; }
  .sec-title { font-size: 12px; font-weight: 700; color: #1A1714; margin-bottom: 5px; display: flex; align-items: center; gap: 6px; }
  .sec.collapsed .sec-title { margin-bottom: 0; }
  .sec-title .no { color: #9A7228; margin-right: 3px; }
  .sec-title .cn { color: #7A7264; font-weight: 500; }
  .sec-title .fabname { color: #7A7264; font-weight: 500; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sec-title .ind-wrap { margin-left: auto; }
  .ind { font-size: 12px; font-weight: 700; }
  .ind.ok { color: #2F855A; }
  .ind.warn { color: #C53030; }

  table.grid { width: 100%; border-collapse: collapse; }
  table.grid td { padding: 4px 5px; font-size: 11px; vertical-align: middle; border-bottom: 1px solid #F4F1EA; }
  td.lbl { width: 42%; color: #5A5248; line-height: 1.25; }
  td.lbl .cn { color: #9A9080; font-size: 10px; }
  td.lbl.done { color: #2F855A; }
  td.lbl.done .cn { color: #2F855A; }
  td.lbl.mid { color: #C53030; }
  td.lbl.mid .cn { color: #C53030; }
  td.val { color: #1A1714; text-align: center; }
  td.val.memo { text-align: left; white-space: pre-wrap; }
  .val .done { color: #2F855A; font-weight: 600; }
  .val .mid { color: #C53030; font-weight: 600; }
  .val .empty { color: #B7AE9E; }
  .mono { font-variant-numeric: tabular-nums; }
  .remark { font-size: 11px; white-space: pre-wrap; line-height: 1.5; padding: 3px 5px; }

  /* item ③ — print: each sheet = exactly one A4 page, no gray/shadow/gaps.
     The 2-column flex layout is kept; only fixed heights + chrome are dropped. */
  @media print {
    body { background: #fff; padding: 0; }
    .toolbar, .no-print { display: none !important; }
    @page { size: A4 portrait; margin: 0; }
    .sheet { width: auto; height: auto; margin: 0; box-shadow: none; page-break-after: always; break-after: page; }
    .sheet:last-child { page-break-after: auto; break-after: auto; }
    .sheet-inner { height: auto; }
  }
</style></head>
<body>
  <div class="toolbar"><button class="print-btn" onclick="window.print()">인쇄 打印</button></div>
  <div id="measure">${body}</div>
  <div id="sheets"></div>
  <script>
  var STAMP = ${JSON.stringify(stamp)};
  (function () {
    var measure = document.getElementById('measure');
    var sheetsEl = document.getElementById('sheets');
    if (!measure || !sheetsEl) return;

    function layout() {
      var PXMM = 96 / 25.4;
      var GAPV = 6 * PXMM;                 // vertical gap between cards (matches .col gap)
      var INNER_H = (297 - 24) * PXMM;     // sheet content height (297 - 12mm*2 padding)
      var FOOTER = 30, HEADER = 54;
      var availFirst = INNER_H - FOOTER - HEADER;
      var availOther = INNER_H - FOOTER;

      // reset (in case of re-run after fonts load)
      sheetsEl.innerHTML = '';
      var cards = Array.prototype.slice.call(measure.querySelectorAll('.card'));

      function makeSheet(isFirst) {
        var sheet = document.createElement('div'); sheet.className = 'sheet';
        var inner = document.createElement('div'); inner.className = 'sheet-inner';
        if (isFirst) {
          var h = document.createElement('div'); h.className = 'sheet-head';
          h.innerHTML = '<h1>产前确认 · 생산 전 체크</h1><div class="stamp">출력일시 打印时间: ' + STAMP + '</div>';
          inner.appendChild(h);
        }
        var bodyEl = document.createElement('div'); bodyEl.className = 'sheet-body';
        var c0 = document.createElement('div'); c0.className = 'col';
        var c1 = document.createElement('div'); c1.className = 'col';
        bodyEl.appendChild(c0); bodyEl.appendChild(c1);
        inner.appendChild(bodyEl);
        var foot = document.createElement('div'); foot.className = 'sheet-foot';
        inner.appendChild(foot);
        sheet.appendChild(inner);
        return { el: sheet, isFirst: isFirst, cols: [c0, c1], h: [0, 0], foot: foot };
      }
      function avail(s) { return s.isFirst ? availFirst : availOther; }
      function place(s, card, ch) {
        var order = s.h[0] <= s.h[1] ? [0, 1] : [1, 0];
        for (var i = 0; i < 2; i++) {
          var c = order[i];
          var g = s.h[c] > 0 ? GAPV : 0;
          if (s.h[c] + g + ch <= avail(s)) { s.cols[c].appendChild(card); s.h[c] += g + ch; return true; }
        }
        return false;
      }

      var sheets = [makeSheet(true)];
      for (var k = 0; k < cards.length; k++) {
        var card = cards[k];
        var ch = card.getBoundingClientRect().height;
        var cur = sheets[sheets.length - 1];
        if (!place(cur, card, ch)) {
          if (cur.h[0] === 0 && cur.h[1] === 0) {
            // current sheet is empty but the card is taller than a whole sheet —
            // place it alone here and allow it to overflow / break (extreme case)
            card.classList.add('tall'); cur.cols[0].appendChild(card); cur.h[0] = ch;
          } else {
            cur = makeSheet(false); sheets.push(cur);
            if (!place(cur, card, ch)) { card.classList.add('tall'); cur.cols[0].appendChild(card); cur.h[0] = ch; }
          }
        }
      }
      for (var s = 0; s < sheets.length; s++) {
        sheetsEl.appendChild(sheets[s].el);
        sheets[s].foot.textContent = (s + 1) + ' / ' + sheets.length;
      }
      // hide the now-empty measuring node
      measure.style.display = 'none';
    }

    function run() { try { layout(); } catch (e) { /* leave measure visible on failure */ } }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { setTimeout(run, 30); });
    } else if (document.readyState === 'complete') {
      setTimeout(run, 30);
    } else {
      window.addEventListener('load', function () { setTimeout(run, 30); });
    }
  })();
  </script>
</body></html>`
}

// CSS injected once for this page (shake / blink / 5-col grid).
const PAGE_CSS = `
@keyframes ikuShake {0%,100%{transform:translateX(0)}15%{transform:translateX(-6px)}30%{transform:translateX(6px)}45%{transform:translateX(-5px)}60%{transform:translateX(5px)}75%{transform:translateX(-3px)}90%{transform:translateX(3px)}}
@keyframes ikuBlink {0%,100%{opacity:1}50%{opacity:.35}}
.iku-blink{animation:ikuBlink 1.6s ease-in-out infinite}
.proc-grid{display:grid;gap:16px;align-items:start;grid-template-columns:repeat(5,minmax(0,1fr))}
@media(max-width:1500px){.proc-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:1150px){.proc-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:860px){.proc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.proc-grid{grid-template-columns:repeat(1,minmax(0,1fr))}}
`

// ──────────────────────────────────────────────────────────
// Lightweight bilingual date picker (item ④)
// ──────────────────────────────────────────────────────────
// Monday-first weekday headers, Chinese only (item ③).
const WEEKDAYS_CN = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const WEEKDAYS_KO = ['월', '화', '수', '목', '금', '토', '일']  // Monday-first
function DatePicker({ G, value, onChange }) {
  const [open, setOpen] = useState(false)
  const sel = parseYMD(value)
  const [view, setView] = useState(() => {
    const b = sel || new Date()
    return { y: b.getFullYear(), m: b.getMonth() }
  })

  const today = new Date()
  // JS getDay(): 0=Sun..6=Sat → convert to Monday-first leading-blank offset.
  const firstDow = new Date(view.y, view.m, 1).getDay()
  const lead = (firstDow + 6) % 7
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const pick = (d) => { onChange(formatYMD(new Date(view.y, view.m, d))); setOpen(false) }
  const goToday = () => { const t = new Date(); setView({ y: t.getFullYear(), m: t.getMonth() }); onChange(formatYMD(t)); setOpen(false) }
  const clear = () => { onChange(''); setOpen(false) }
  const prev = () => setView(v => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))
  const next = () => setView(v => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))

  const isSel = (d) => sel && sel.getFullYear() === view.y && sel.getMonth() === view.m && sel.getDate() === d
  const isToday = (d) => today.getFullYear() === view.y && today.getMonth() === view.m && today.getDate() === d

  return (
    <div style={{ position: 'relative', flex: '1 1 auto', minWidth: 0 }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 6, fontSize: 12, border: `1px solid ${G.border}`, background: G.bg, color: value ? G.tx : G.fa, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <Calendar size={12} style={{ flexShrink: 0, color: G.mu }} />
        <span className="num" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || '날짜 선택 · 选择日期'}</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1200 }} />
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 1201, background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', padding: 10, width: 232, maxWidth: '80vw' }}>
            {/* header — bilingual (KO 中) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <button type="button" onClick={prev} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.mu, display: 'flex', padding: 4 }}><ChevronLeft size={16} /></button>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: G.tx }}>{view.y}년 {view.m + 1}월 · {view.y}年{view.m + 1}月</span>
              <button type="button" onClick={next} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.mu, display: 'flex', padding: 4 }}><ChevronRight size={16} /></button>
            </div>
            {/* weekday row — Monday first, bilingual two-line (土 cool, 日 red) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 2 }}>
              {WEEKDAYS_CN.map((w, i) => (
                <div key={w} style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, lineHeight: 1.2, color: i === 6 ? G.bad : (i === 5 ? G.cool : G.mu), padding: '2px 0' }}>{WEEKDAYS_KO[i]}<br />{w}</div>
              ))}
            </div>
            {/* days */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
              {cells.map((d, i) => d === null ? <div key={`e${i}`} /> : (
                <button key={d} type="button" onClick={() => pick(d)}
                  style={{
                    height: 26, borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
                    border: isToday(d) && !isSel(d) ? `1px solid ${G.primary}` : '1px solid transparent',
                    background: isSel(d) ? G.primary : 'transparent',
                    color: isSel(d) ? '#fff' : G.tx, fontWeight: isSel(d) ? 700 : 500,
                  }}>{d}</button>
              ))}
            </div>
            {/* footer */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button type="button" onClick={goToday} style={{ flex: 1, padding: '5px 0', fontSize: 10.5, borderRadius: 6, border: `1px solid ${G.border}`, background: 'transparent', color: G.accent, cursor: 'pointer', fontWeight: 600 }}>오늘 今天</button>
              <button type="button" onClick={clear} style={{ flex: 1, padding: '5px 0', fontSize: 10.5, borderRadius: 6, border: `1px solid ${G.border}`, background: 'transparent', color: G.bad, cursor: 'pointer', fontWeight: 600 }}>삭제 删除</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

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
// Image lightbox (item ②) — overlay, max 90% size, spinner while loading,
// close via X / backdrop / ESC. Pinch-zoom enabled on the image (touch).
// ──────────────────────────────────────────────────────────
function Lightbox({ src, onClose }) {
  const [loaded, setLoaded] = useState(false)
  const [err, setErr] = useState(false)

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <button onClick={onClose} aria-label="close"
        style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
        <X size={20} />
      </button>
      {!loaded && !err && (
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', animation: 'spin 1s linear infinite' }} />
      )}
      {err ? (
        <div style={{ color: '#fff', fontSize: 14, textAlign: 'center' }}>이미지를 불러올 수 없습니다 · 无法加载图片</div>
      ) : (
        <img
          src={src}
          alt="order"
          onLoad={() => setLoaded(true)}
          onError={() => setErr(true)}
          onClick={e => e.stopPropagation()}
          style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', display: loaded ? 'block' : 'none', borderRadius: 8, touchAction: 'pinch-zoom', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}
        />
      )}
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
    const result = await verifyProcessPassword(pw)
    if (result.ok) {
      onSuccess(pw)
    } else {
      setBusy(false)
      setErr(result.message || '비밀번호가 틀렸습니다 · 密码错误')
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
          <button type="button" onClick={onClose} className="btn-ghost" style={{ minHeight: 36, padding: '8px 14px', fontSize: 12 }}>취소 取消</button>
          <button type="submit" disabled={busy || !pw} className="btn-primary" style={{ minHeight: 36, padding: '8px 14px', fontSize: 12, opacity: (busy || !pw) ? 0.55 : 1 }}>{busy ? '확인중 确认中…' : '확인 确认'}</button>
        </div>
      </form>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Cell editor — status chips / datepicker / text + highlight toggle
// ──────────────────────────────────────────────────────────
function CellEditor({ G, field, cell, editable, allowStock, onChange }) {
  const v = cell?.v || ''
  const d = cell?.d || ''
  const h = !!cell?.h
  const hlBg = G.dk ? 'rgba(212,165,114,0.18)' : 'rgba(252,211,77,0.28)'
  const done = DONE_VALUES.has(v)

  if (!editable) {
    const empty = !v && !d
    // item ④ — mid status (chip, not done) blinks red, synced with the label
    const midRead = field.type === 'chip' && !!v && !done
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', padding: h ? '3px 6px' : 0, background: h ? hlBg : 'transparent', borderRadius: 6, textAlign: 'center' }}>
        {empty ? (
          <span style={{ fontSize: 11.55, color: G.fa }}>—</span>
        ) : (
          <>
            {v && <span className={midRead ? 'iku-blink' : undefined} style={{ fontSize: 11.55, fontWeight: 600, color: done ? G.ok : (midRead ? G.bad : G.tx), padding: '2px 8px', background: G.cardAlt, border: `1px solid ${G.hair}`, borderRadius: 999 }}>{done ? '✅ ' : ''}{statusLabel(v)}</span>}
            {d && <span className="num" style={{ fontSize: 11.55, color: G.accent, fontWeight: 600 }}>{d}</span>}
          </>
        )}
        {h && <AlertTriangle size={11} style={{ color: G.warn }} />}
      </div>
    )
  }

  const inputStyle = { padding: '6px 8px', borderRadius: 6, fontSize: 12, border: `1px solid ${G.border}`, background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit' }
  const opts = field.statuses || STATUS_OPTIONS
  const isStandard = opts.some(o => o.v === v)
  const HL = (
    <button type="button" title="주의 필요 · 需注意"
      onClick={() => onChange({ ...cell, h: !h })}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, cursor: 'pointer', border: `1px solid ${h ? G.warn : G.border}`, background: h ? hlBg : 'transparent', color: h ? G.warn : G.mu, flexShrink: 0 }}>
      <AlertTriangle size={12} />
    </button>
  )

  // text field (e.g. 공장명)
  if (field.type === 'text') {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: 6, background: h ? hlBg : 'transparent', borderRadius: 6 }}>
        <input value={v} onChange={e => onChange({ ...cell, v: e.target.value })} placeholder="입력 · 输入" style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
        {HL}
      </div>
    )
  }

  // date field
  if (field.type === 'date') {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: 6, background: h ? hlBg : 'transparent', borderRadius: 6 }}>
        <DatePicker G={G} value={d} onChange={(nd) => onChange({ ...cell, d: nd })} />
        {HL}
      </div>
    )
  }

  // chip (status) field
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 6, background: h ? hlBg : 'transparent', borderRadius: 6 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        {opts.filter(o => allowStock || !o.stock).map(o => {
          const on = v === o.v
          const isDone = DONE_VALUES.has(o.v)
          return (
            <button key={o.v} type="button"
              onClick={() => onChange({ ...cell, v: on ? '' : o.v })}
              style={{ padding: '3px 8px', fontSize: 10.5, borderRadius: 999, cursor: 'pointer', fontWeight: 600, border: `1px solid ${on ? G.primary : G.border}`, background: on ? (G.dk ? 'rgba(232,200,152,0.18)' : 'rgba(201,168,110,0.16)') : 'transparent', color: on ? G.accent : G.mu, lineHeight: 1.35 }}>
              {on && isDone ? '✅ ' : ''}{o.ko} {o.cn}
            </button>
          )
        })}
        {HL}
      </div>
      {/* legacy / non-standard saved value — editable for backward compatibility */}
      {v && !isStandard && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: G.mu }}>
          <span>현재값 当前:</span>
          <span style={{ fontWeight: 600, color: G.tx, padding: '1px 6px', background: G.cardAlt, border: `1px solid ${G.hair}`, borderRadius: 999 }}>{v}</span>
          <button type="button" onClick={() => onChange({ ...cell, v: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.mu, display: 'flex', padding: 0 }}><X size={11} /></button>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Section memo badge (item ④) — 💬 icon + dot; tap shows a popover bubble
// with the section's saved 비고; outside click closes. Read-mode only.
// ──────────────────────────────────────────────────────────
function MemoBadge({ G, memo }) {
  const [open, setOpen] = useState(false)
  if (!memo) return null
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      {/* item ⑤ — gold/orange slow blink (distinct from the red status blink) */}
      <button type="button" onClick={() => setOpen(o => !o)} title="비고 备注" className="iku-blink"
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: G.warn, padding: '0 2px' }}>
        <MessageSquare size={15} />
        <span style={{ position: 'absolute', top: -1, right: 0, width: 5, height: 5, borderRadius: '50%', background: G.warn }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1200 }} />
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1201, background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', padding: '10px 12px', width: 220, maxWidth: '70vw' }}>
            <div style={{ fontSize: 10, color: G.mu, fontWeight: 700, marginBottom: 4 }}>비고 · 备注</div>
            <div style={{ fontSize: 12, color: G.tx, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{memo}</div>
          </div>
        </>
      )}
    </span>
  )
}

// Section status dot (item ②): green ✅ when complete, red blinking ⚠ when a
// mid status is present, nothing when no status is selected.
function SectionIndicator({ G, status }) {
  if (status === 'ok') return <CheckCircle2 size={14} style={{ color: G.ok, flexShrink: 0 }} />
  if (status === 'warn') return <AlertTriangle size={14} className="iku-blink" style={{ color: G.bad, flexShrink: 0 }} />
  return null
}

// Collapse / expand toggle for a section (item ①) — bilingual label.
function SectionToggle({ G, collapsed, onToggle }) {
  return (
    <button type="button" onClick={onToggle} title={collapsed ? '펴기 展开' : '접기 收起'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'none', border: `1px solid ${G.border}`, borderRadius: 6, cursor: 'pointer', color: G.mu, padding: '2px 7px', fontSize: 10, fontWeight: 600, fontFamily: 'inherit' }}>
      {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      {collapsed ? '펴기 展开' : '접기 收起'}
    </button>
  )
}

// ──────────────────────────────────────────────────────────
// Process card (one order)
// ──────────────────────────────────────────────────────────
function ProcessCard({ G, mo, record, editable, onSaveItem, canMutate, onZoom,
  collapsedFor, onToggleSection, printMode, checked, onToggleChecked, fabricKv = '', onSaveFabric, onDelete }) {
  const [draftCells, setDraftCells] = useState(null)
  const [draftRemark, setDraftRemark] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)   // ③ 삭제 확인
  const [draftFabric, setDraftFabric] = useState(null)   // ⑥ 원단명 오버라이드 draft
  const [saving, setSaving] = useState(false)

  const savedCells = record?.cells || {}
  const savedRemark = record?.remark || ''

  // Collapse state is owned by the parent (item ②, all collapsed by default) so
  // the print feature (item ④) can read which sections are expanded.
  const toggleSection = onToggleSection

  const cells = draftCells ?? savedCells
  const remark = draftRemark ?? savedRemark
  const dirty = draftCells !== null || draftRemark !== null || draftFabric !== null

  useEffect(() => {
    if (!editable) { setDraftCells(null); setDraftRemark(null); setDraftFabric(null) }
  }, [editable])

  const setCell = useCallback((cellKey, val) => {
    setDraftCells(prev => {
      const base = prev ?? savedCells
      const next = { ...base, [cellKey]: val }
      if (!val || (!val.v && !val.d && !val.h)) delete next[cellKey]
      return next
    })
  }, [savedCells])

  const badge = procStatusBadge(mo, G)
  const chiName = typeof mo.Chi_Style_Name === 'string' ? mo.Chi_Style_Name : (mo.Chi_Style_Name?.zc_display_value || '')
  const monthKey = getMonthKey(mo)
  const fabric = getFabricInfo(mo)
  const imgUrl = styleImageUrl(mo)
  const legacyFabricName = cells['fabric.fabricName']?.v || ''  // 구버전 process-cell 원단명(폴백)
  // Zoho 원단값: Material_Type(이미 "원단명 / 성분" 형식) 우선, 없으면 Fabric_Name
  const zohoFabric = fabric.name || fieldStr(mo?.Fabric_Name) || ''
  // ⑥ 표시 우선순위: KV 오버라이드 > (구버전 입력) > Zoho 자동값
  const savedFabric = fabricKv || legacyFabricName || zohoFabric
  const fabricInput = draftFabric ?? savedFabric         // 편집 input 값
  const displayFabric = savedFabric                       // 읽기 표시 값
  const totalQty = fieldStr(mo?.Plan_Total_Quantity)       // 총 수량 (Zoho)

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    const cleaned = {}
    for (const [k, val] of Object.entries(cells)) {
      if (val && (val.v || val.d || val.h)) cleaned[k] = val
    }
    const ok = await onSaveItem(itemNoOf(mo), cleaned, remark)
    // ⑥ 원단명 오버라이드도 함께 저장 (KV key: fabric:{MO_ID})
    if (draftFabric !== null && onSaveFabric) {
      try { await onSaveFabric(itemNoOf(mo), draftFabric.trim()) } catch { /* ignore */ }
    }
    setSaving(false)
    if (ok) { setDraftCells(null); setDraftRemark(null); setDraftFabric(null) }
  }

  // overflow visible so the date-picker popover isn't clipped by the card
  return (
    <div className="card" style={{ padding: 0, overflow: 'visible', display: 'flex', flexDirection: 'column', outline: printMode && checked ? `2px solid ${G.primary}` : 'none' }}>
      {/* item ④ — print-selection checkbox (top-right) */}
      {printMode && (
        <label title="프린트 선택 · 打印选择"
          style={{ position: 'absolute', top: 8, right: 8, zIndex: 5, display: 'flex', alignItems: 'center', gap: 4, background: G.card, border: `1px solid ${G.border}`, borderRadius: 6, padding: '3px 7px', cursor: 'pointer', boxShadow: G.cardShadow }}>
          <input type="checkbox" checked={!!checked} onChange={onToggleChecked} style={{ width: 15, height: 15, cursor: 'pointer', accentColor: G.primary }} />
          <span style={{ fontSize: 9.5, color: G.mu, fontWeight: 600 }}>선택 选择</span>
        </label>
      )}
      {/* ③ 삭제 버튼 (우상단) — 프린트 모드가 아닐 때 */}
      {!printMode && (
        <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }} title="삭제 · 删除"
          style={{ position: 'absolute', top: 8, right: 8, zIndex: 5, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', border: `1px solid ${G.border}`, background: G.card, color: G.bad, boxShadow: G.cardShadow }}>
          <Trash2 size={13} />
        </button>
      )}
      {/* ③ 삭제 확인 모달 */}
      {confirmDelete && (
        <div onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(false) }}
          style={{ position: 'absolute', inset: 0, background: G.overlayBg, borderRadius: 12, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: 16, boxShadow: G.cardShadow, textAlign: 'center', maxWidth: 240 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: G.tx, marginBottom: 4 }}>이 항목을 목록에서 삭제하시겠습니까?</div>
            <div style={{ fontSize: 11, color: G.mu, marginBottom: 10 }}>确认从列表中删除此项目？</div>
            <div style={{ fontSize: 10, color: G.fa, marginBottom: 12 }}>Zoho ERP 데이터는 변경되지 않습니다<br />Zoho ERP数据不会被修改</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button type="button" onClick={() => setConfirmDelete(false)} className="btn-ghost" style={{ minHeight: 32, padding: '6px 12px', fontSize: 11 }}>취소 取消</button>
              <button type="button" onClick={() => { setConfirmDelete(false); onDelete?.(itemNoOf(mo)) }} className="btn-primary" style={{ minHeight: 32, padding: '6px 12px', fontSize: 11, background: G.bad, borderColor: G.bad }}>확인 确认</button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, padding: 14, borderBottom: `1px solid ${G.hair}`, borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
        <div
          onClick={() => { if (imgUrl && onZoom) onZoom(imgUrl) }}
          title={imgUrl ? '클릭하여 확대 · 点击放大' : ''}
          style={{ width: 110, height: 150, alignSelf: 'flex-start', borderRadius: 8, background: G.cardAlt, overflow: 'hidden', flexShrink: 0, border: `1px solid ${G.hair}`, position: 'relative', cursor: imgUrl ? 'zoom-in' : 'default' }}
        >
          <ZohoImage mo={mo} field="Style_Image" G={G} iconSize={22} placeholderText="" />
          {imgUrl && (
            <span style={{ position: 'absolute', bottom: 2, right: 2, width: 16, height: 16, borderRadius: 4, background: 'rgba(0,0,0,0.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ZoomIn size={10} />
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span className="num" style={{ fontSize: 13, fontWeight: 700, color: G.accent }}>{getMoNumber(mo)}</span>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: '#fff', background: badge.color, padding: '2px 7px', borderRadius: 999 }}>
              {badge.kr}{badge.cn ? ` · ${badge.cn}` : ''}
            </span>
            {isShipped(mo) && <span style={{ fontSize: 9, color: G.ok, border: `1px solid ${G.ok}`, padding: '1px 6px', borderRadius: 999 }}>출고 已出货</span>}
          </div>
          <div title={getMoSku(mo)} style={{ fontSize: 11, color: G.tx, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getMoSku(mo)}</div>
          {chiName && <div title={chiName} style={{ fontSize: 11, color: G.mu, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chiName}</div>}
          {/* ⑤ 수량(件) + 우측 노란 네모 원단명 */}
          <div style={{ fontSize: 10, color: G.fa, marginTop: 3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>🏭 {getMoFactory(mo)}</span>
            {monthKey && <span>📅 {monthKey}</span>}
            {totalQty && <span className="num" style={{ fontWeight: 600, color: G.mu }}>📦 {totalQty}件</span>}
            <span title={displayFabric || '-'} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, maxWidth: '100%', fontSize: 9.5, fontWeight: 600, color: G.dk ? '#E8C898' : '#8A6D2E', background: G.dk ? 'rgba(232,200,152,0.14)' : 'rgba(252,211,77,0.28)', border: `1px solid ${G.dk ? 'rgba(232,200,152,0.4)' : 'rgba(201,168,110,0.5)'}`, borderRadius: 6, padding: '1px 7px' }}>
              🧵 <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayFabric || '-'}</span>
            </span>
          </div>
          {/* 성분/중량 상세 (있을 때만) — 이미지 고정 높이가 이 줄까지 포함 */}
          {fabric.has && (fabric.weight || fabric.composition) && (
            <div style={{ fontSize: 10, color: G.fa, marginTop: 3 }}>
              {[fabric.weight, fabric.composition].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        {editable && canMutate && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <button onClick={handleSave} disabled={saving || !dirty} className="btn-primary"
              style={{ minHeight: 32, padding: '6px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, opacity: (saving || !dirty) ? 0.5 : 1 }}>
              <Save size={13} /> {saving ? '저장중 保存中' : '저장 保存'}
            </button>
          </div>
        )}
      </div>

      {/* Checklist — item ⑥: roomier spacing + 1px divider between sections */}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {SECTIONS.map(sec => {
          const allowStock = RAW_SECTIONS.has(sec.id)
          const memoKey = `${sec.id}._memo`
          const memo = cells[memoKey]?.v || ''
          const status = sectionStatus(sec, cells)   // item ② aggregate status
          const isCollapsed = collapsedFor(sec.id)   // item ① collapse state (parent-owned)
          return (
            <div key={sec.id} style={{ paddingBottom: 20, borderBottom: `1px solid ${G.hair}` }}>
              {/* section title (number scales with it); flexWrap so right-side
                  items drop below instead of overlapping on narrow cards */}
              <div style={{ fontSize: 11.5, fontWeight: 700, color: G.tx, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', lineHeight: 1.2 }}>
                <span><span style={{ color: G.accent, marginRight: 5 }}>{sec.no}</span>{sec.kr} <span style={{ color: G.mu, fontWeight: 500 }}>{sec.cn}</span></span>
                {!editable && <MemoBadge G={G} memo={memo} />}
                {/* ⑥ 원단명/성분 (read): Zoho 자동값 + KV 오버라이드 우선 — 제목 우측 */}
                {sec.id === 'fabric' && !editable && displayFabric && (
                  <span title={displayFabric} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 500, color: G.mu, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                    🧵 {displayFabric}
                  </span>
                )}
                {/* ⑥ 원단명/성분 (edit): 제목 바로 우측 input, 저장 시 KV(fabric:{`{MO_ID}`}) */}
                {sec.id === 'fabric' && editable && (
                  <input value={fabricInput} onChange={e => setDraftFabric(e.target.value)}
                    placeholder="원단명 / 성분 · 面料/成分"
                    style={{ flex: 1, minWidth: 0, marginLeft: 4, padding: '4px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 500, border: `1px solid ${G.border}`, background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit' }} />
                )}
                {/* item ②/① — when collapsed, indicator + expand toggle live in the title row */}
                {isCollapsed && (
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <SectionIndicator G={G} status={status} />
                    <SectionToggle G={G} collapsed onToggle={() => toggleSection(sec.id)} />
                  </span>
                )}
              </div>
              {/* collapsible body (item ① — smooth grid-rows animation) */}
              <div style={{ display: 'grid', gridTemplateRows: isCollapsed ? '0fr' : '1fr', transition: 'grid-template-rows .25s ease' }}>
              <div style={{ overflow: 'hidden', minHeight: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: editable ? 8 : 4, paddingLeft: 4 }}>
                {/* ⑥ 원단명/성분 편집은 섹션 제목 우측 input 으로 이동(상단) */}
                {sec.fields.map(f => {
                  const cellKey = `${sec.id}.${f.key}`
                  const cell = cells[cellKey]
                  const st = f.type === 'chip' ? chipStatus(cell) : 'none'
                  const labelColor = st === 'done' ? G.ok : (st === 'mid' ? G.bad : G.mu)
                  return (
                    <div key={cellKey} style={{ display: 'grid', gridTemplateColumns: '104px 1fr', gap: 8, alignItems: editable ? 'start' : 'center' }}>
                      <div style={{ fontSize: 12.7, paddingTop: editable ? 7 : 0, lineHeight: 1.3 }}>
                        {/* label kr/cn (done = green, no ✅; mid = red blink) */}
                        <span className={st === 'mid' ? 'iku-blink' : undefined} style={{ color: labelColor, fontWeight: st === 'none' ? 400 : 600 }}>
                          {f.kr}<br />
                          <span style={{ color: st === 'none' ? G.fa : labelColor, fontSize: 11.55 }}>{f.cn}</span>
                        </span>
                      </div>
                      <CellEditor G={G} field={f} cell={cell} editable={editable} allowStock={allowStock} onChange={(val) => setCell(cellKey, val)} />
                    </div>
                  )
                })}
                {/* item ⑤ per-section 비고 — editable input only; read mode shows
                    the 💬 popover next to the section title (item ④) */}
                {editable && (
                  <div style={{ display: 'grid', gridTemplateColumns: '104px 1fr', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontSize: 12.1, color: G.mu }}>비고 <span style={{ color: G.fa, fontSize: 11 }}>备注</span></div>
                    <input value={memo} onChange={e => setCell(memoKey, { v: e.target.value })} placeholder="특이사항 입력 · 输入备注"
                      style={{ padding: '6px 8px', borderRadius: 6, fontSize: 11.5, border: `1px solid ${G.border}`, background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }} />
                  </div>
                )}
                {/* item ②/① — expanded: indicator + collapse toggle at section bottom-right */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <SectionIndicator G={G} status={status} />
                  <SectionToggle G={G} collapsed={false} onToggle={() => toggleSection(sec.id)} />
                </div>
              </div>
              </div>
              </div>
            </div>
          )
        })}

        {/* ⑨ card-wide 비고 */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: G.tx, marginBottom: 8, lineHeight: 1.2 }}>
            <span style={{ color: G.accent, marginRight: 5 }}>⑨</span>전체 비고 <span style={{ color: G.mu, fontWeight: 500 }}>整体备注</span>
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
  const [password, setPassword] = useState('')
  const [editorName, setEditorName] = useState('')
  const [editorError, setEditorError] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [toast, setToast] = useState(null)
  const [zoomSrc, setZoomSrc] = useState(null)  // image lightbox
  const editorRef = useRef(null)
  const fabricDiagRef = useRef(false)

  // Section collapse — owned here so the print feature can read expanded sections.
  // Shape: { [itemNo]: { [secId]: bool } }. Default (absent) = collapsed (item ②).
  const [collapsedByItem, setCollapsedByItem] = useState({})
  const sectionCollapsed = useCallback((itemNo, secId) => {
    const m = collapsedByItem[itemNo]
    return m && secId in m ? m[secId] : true
  }, [collapsedByItem])
  const toggleCardSection = useCallback((itemNo, secId) => {
    setCollapsedByItem(prev => {
      const cur = prev[itemNo] || {}
      const curVal = secId in cur ? cur[secId] : true
      return { ...prev, [itemNo]: { ...cur, [secId]: !curVal } }
    })
  }, [])

  // Print selection mode (item ④)
  const [printMode, setPrintMode] = useState(false)
  const [selectedToPrint, setSelectedToPrint] = useState(() => new Set())

  // filters
  const [category, setCategory] = useState('all')
  const [subFactory, setSubFactory] = useState('')
  const [search, setSearch] = useState('')
  const [factorySel, setFactorySel] = useState([])
  const [month, setMonth] = useState('')
  const [procFilter, setProcFilter] = useState('')

  // ③ 삭제 목록 (deleted_mo / deleted_style) — 숨기기 기능 대체
  const [deletions, setDeletions] = useState({ mo: [], style: [] })

  // 데이터 소스 모드: 'ordered'(오더완료/MO) | 'unordered'(미오더/Style)
  const [mode, setMode] = useState('ordered')
  const [styleTab, setStyleTab] = useState(null)   // { type:'month'|'season', value }

  // 미오더(Style) 데이터 + 메타(공장/비고/숨김)
  const [styleList, setStyleList] = useState([])
  const [styleLoading, setStyleLoading] = useState(true)
  const [styleErr, setStyleErr] = useState(null)
  const [styleMeta, setStyleMeta] = useState({ factory: {}, note: {}, hidden: [] })

  // ⑥ MO 원단명 오버라이드 (key fabric:{MO_ID}) — KV값 우선
  const [moFabric, setMoFabric] = useState({})

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

  // ⑥ MO 원단명 오버라이드 로드 (key fabric:{MO_ID})
  const loadMoFabric = useCallback(() => {
    fetchMoFabric()
      .then(d => setMoFabric(d?.fabric || {}))
      .catch(err => console.error('[ProcessPage] mo-fabric', err))
  }, [])

  // ③ 삭제 목록 로드 (deleted_mo / deleted_style)
  const loadDeletions = useCallback(() => {
    fetchDeletions()
      .then(d => setDeletions({ mo: d?.mo || [], style: d?.style || [] }))
      .catch(err => console.error('[ProcessPage] deletions', err))
  }, [])

  // 미오더 섹션: Style 목록 + 메타를 함께 로드.
  // 넉넉히 200개 로드. 스타일이 수백 개 이상으로 늘면 서버사이드 criteria 필터 권장.
  const loadStyles = useCallback(() => {
    setStyleLoading(true); setStyleErr(null)
    Promise.all([
      fetchStyleList({ maxRecords: 200 }),
      fetchStyleMeta().catch(() => ({ factory: {}, note: {}, hidden: [] })),
    ]).then(([list, meta]) => {
      setStyleList(list?.data || list?.records || list?.result || [])
      setStyleMeta({ factory: meta?.factory || {}, note: meta?.note || {}, hidden: meta?.hidden || [] })
    }).catch(err => { console.error('[ProcessPage] styles', err); setStyleErr(err.message || String(err)) })
      .finally(() => setStyleLoading(false))
  }, [])

  useEffect(() => {
    loadMo(); loadProc(); loadStyles(); loadMoFabric(); loadDeletions()
    const h = () => { loadMo(); loadProc(); loadStyles(); loadMoFabric(); loadDeletions() }
    window.addEventListener('iku:refresh', h)
    return () => window.removeEventListener('iku:refresh', h)
  }, [loadMo, loadProc, loadStyles, loadMoFabric, loadDeletions])

  // One-shot diagnostic: report which fabric fields (if any) are absent from the
  // MO data so a missing field is visible in the console (item ①).
  useEffect(() => {
    if (fabricDiagRef.current || !moList.length) return
    fabricDiagRef.current = true
    const FIELDS = ['Material_Type', 'Fabric_Weight', 'blended']
    const missing = FIELDS.filter(f => !moList.some(m => fieldStr(m?.[f])))
    if (missing.length) {
      console.warn('[ProcessPage] 원단 정보 필드 없음/빈값 · fabric fields missing or empty in MO data:', missing,
        '— 표시는 가능한 필드만 노출하고 나머지 작업은 계속합니다.')
    } else {
      console.log('[ProcessPage] 원단 정보 필드 확인 · fabric fields present:', FIELDS)
    }
  }, [moList])

  const deletedMo = useMemo(() => new Set(deletions.mo || []), [deletions.mo])
  const deletedStyle = useMemo(() => new Set(deletions.style || []), [deletions.style])
  const searching = search.trim().length > 0

  // 오더완료 MO 의 SKU 집합 (대소문자 무시·trim) — 미오더 제외용
  const moSkuSet = useMemo(() => {
    const s = new Set()
    moList.forEach(m => { const sku = getMoSku(m); if (sku && sku !== '—') s.add(sku.trim().toLowerCase()) })
    return s
  }, [moList])

  const baseList = useMemo(() => {
    return moList.filter(m => {
      const id = itemNoOf(m)
      if (!id) return false
      if (deletedMo.has(id)) return false               // ③ 삭제된 오더완료 제외
      if (!searching && isShipped(m)) return false
      return true
    })
  }, [moList, deletedMo, searching])

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

  const catCounts = useMemo(() => {
    let all = 0, hx = 0, out = 0
    baseList.forEach(m => { all++; if (isHexiang(getMoFactory(m))) hx++; else out++ })
    return { all, hx, out }
  }, [baseList])

  const procFilterFn = useMemo(() => PROC_FILTERS.find(p => p.key === procFilter)?.test, [procFilter])

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase()
    return baseList.filter(m => {
      const f = getMoFactory(m)
      if (category === 'hexiang' && !isHexiang(f)) return false
      if (category === 'outsource' && isHexiang(f)) return false
      if (category === 'outsource' && subFactory && f !== subFactory) return false
      if (factorySel.length && !factorySel.includes(f)) return false
      if (month && getMonthKey(m) !== month) return false
      if (s) {
        const blob = `${getMoNumber(m)} ${getMoSku(m)} ${f} ${m.Chi_Style_Name || ''} ${m.Eng_Style_Name || ''}`.toLowerCase()
        if (!blob.includes(s)) return false
      }
      if (procFilterFn) {
        const cells = proc.items[itemNoOf(m)]?.cells || {}
        if (!procFilterFn(cells)) return false
      }
      return true
    })
  }, [baseList, category, subFactory, factorySel, month, search, procFilterFn, proc.items])

  // ── 미오더(Style) 파생값 ──
  const styleHiddenSet = useMemo(() => new Set(styleMeta.hidden || []), [styleMeta.hidden])
  // ① 오더완료 MO 의 SKU 와 일치하는 Style 은 미오더에서 제외 (대소문자/공백 무시)
  // ③ 삭제된 Style(deleted_style) 도 제외 · 기존 오더전환(style_hidden)도 유지
  const unorderedStyles = useMemo(
    () => styleList.filter(s => {
      if (styleIsOrdered(s)) return false
      const sku = styleKey(s)
      if (styleHiddenSet.has(sku)) return false
      if (deletedStyle.has(sku)) return false
      const skuNorm = pick(s, SF.sku).trim().toLowerCase()
      if (skuNorm && moSkuSet.has(skuNorm)) return false   // 오더완료에 있는 SKU 제외
      return true
    }),
    [styleList, styleHiddenSet, deletedStyle, moSkuSet]
  )
  // 월별/시즌 탭 (Style 데이터에서 동적 추출 + 건수)
  const unorderedTabs = useMemo(() => {
    const months = {}, seasons = {}
    unorderedStyles.forEach(s => {
      const m = monthOf(s); if (m) months[m] = (months[m] || 0) + 1
      const se = seasonOf(s); if (se) seasons[se] = (seasons[se] || 0) + 1
    })
    // 월 탭은 한자 月 표기 ("6" → "6月"), 시즌 탭은 원문(FW26 등)
    const mk = (obj, type) => Object.keys(obj).sort().map(value => ({
      type, value, count: obj[value],
      label: type === 'month' && /^\d+$/.test(value) ? `${value}月` : value,
    }))
    return [...mk(months, 'month'), ...mk(seasons, 'season')]
  }, [unorderedStyles])
  // 미오더 카드 목록 (선택 탭 + 검색 적용)
  const visibleStyles = useMemo(() => {
    const q = search.trim().toLowerCase()
    return unorderedStyles.filter(st => {
      if (styleTab) {
        if (styleTab.type === 'month' && monthOf(st) !== styleTab.value) return false
        if (styleTab.type === 'season' && seasonOf(st) !== styleTab.value) return false
      }
      if (q) {
        const blob = `${pick(st, SF.sku)} ${pick(st, SF.eng)} ${pick(st, SF.chi)}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [unorderedStyles, styleTab, search])

  // ── edit flow ──
  const onEditClick = () => {
    if (editMode) { setEditMode(false); setPassword(''); setEditorError(false) }
    else setPwOpen(true)
  }
  const onPwSuccess = (pw) => {
    setPassword(pw); setPwOpen(false); setEditMode(true)
    showToast('편집 모드 · 编辑模式', 'ok')
  }

  // item ② — inline warning + shake + scroll + focus when editor name missing
  const requireEditor = useCallback(() => {
    if (!editorName.trim()) {
      setEditorError(true)
      setShaking(false)
      requestAnimationFrame(() => setShaking(true))
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => editorRef.current?.focus(), 250)
      return false
    }
    return true
  }, [editorName])

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
  }, [password, editorName, requireEditor, showToast])

  // ③ 삭제 (오더완료 MO) — 비밀번호 불필요, 복원 없음. Zoho 변경 없음.
  const handleDeleteMo = useCallback((id) => {
    setDeletions(prev => ({ ...prev, mo: [...new Set([...(prev.mo || []), id])] }))
    deleteMo(id)
      .then(r => showToast(r?.ok ? '삭제됨 · 已删除' : '삭제 실패 · 删除失败', r?.ok ? 'ok' : 'bad'))
      .catch(() => showToast('삭제 실패 · 删除失败', 'bad'))
  }, [showToast])

  // ③ 삭제 (미오더 Style)
  const handleDeleteStyle = useCallback((sku) => {
    setDeletions(prev => ({ ...prev, style: [...new Set([...(prev.style || []), sku])] }))
    deleteStyle(sku)
      .then(r => showToast(r?.ok ? '삭제됨 · 已删除' : '삭제 실패 · 删除失败', r?.ok ? 'ok' : 'bad'))
      .catch(() => showToast('삭제 실패 · 删除失败', 'bad'))
  }, [showToast])

  const resetFilters = () => {
    setCategory('all'); setSubFactory(''); setSearch(''); setFactorySel([]); setMonth(''); setProcFilter('')
  }

  // ── 미오더 메타 저장 (비밀번호 불필요) ──
  const onSaveStyleFactory = useCallback((sku, value) => {
    setStyleMeta(prev => ({ ...prev, factory: { ...prev.factory, [sku]: value } }))
    saveStyleFactory(sku, value)
      .then(r => showToast(r?.ok ? '저장됨 · 已保存' : '저장 실패 · 保存失败', r?.ok ? 'ok' : 'bad'))
      .catch(() => showToast('저장 실패 · 保存失败', 'bad'))
  }, [showToast])
  const onSaveStyleNote = useCallback((sku, value) => {
    setStyleMeta(prev => ({ ...prev, note: { ...prev.note, [sku]: value } }))
    saveStyleNote(sku, value)
      .then(r => showToast(r?.ok ? '저장됨 · 已保存' : '저장 실패 · 保存失败', r?.ok ? 'ok' : 'bad'))
      .catch(() => showToast('저장 실패 · 保存失败', 'bad'))
  }, [showToast])
  const onConvertStyle = useCallback((sku) => {
    setStyleMeta(prev => ({ ...prev, hidden: [...new Set([...(prev.hidden || []), sku])] }))
    hideStyle(sku)
      .then(r => showToast(r?.ok ? '오더 전환됨 · 已转为下单' : '실패 · 失败', r?.ok ? 'ok' : 'bad'))
      .catch(() => showToast('실패 · 失败', 'bad'))
  }, [showToast])

  // ⑥ 원단명 오버라이드 저장 (key fabric:{MO_ID}) — 카드 저장 시 호출
  const onSaveFabric = useCallback((id, value) => {
    setMoFabric(prev => {
      const next = { ...prev }
      if (value) next[id] = value; else delete next[id]
      return next
    })
    return saveMoFabric(id, value).catch(() => { /* 토스트는 카드 저장에서 처리 */ })
  }, [])

  // ── print (item ④) ──
  const enterPrintMode = useCallback(() => {
    setSelectedToPrint(new Set(visible.map(itemNoOf)))  // default: all selected
    setPrintMode(true)
  }, [visible])
  const togglePrintChecked = useCallback((id) => {
    setSelectedToPrint(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }, [])
  const doPrint = useCallback(() => {
    const sel = visible.filter(m => selectedToPrint.has(itemNoOf(m)))
    if (!sel.length) { showToast('선택된 오더가 없습니다 · 未选择订单', 'bad'); return }
    let win
    try { win = window.open('', '_blank') } catch { win = null }
    if (!win) { showToast('팝업이 차단되었습니다 · 弹窗被拦截', 'bad'); return }
    const html = buildPrintHTML({
      mos: sel,
      items: proc.items,
      isExpanded: (itemNo, secId) => !sectionCollapsed(itemNo, secId),
      origin: window.location.origin,
      now: new Date(),
    })
    win.document.open(); win.document.write(html); win.document.close()
    setPrintMode(false)
  }, [visible, selectedToPrint, proc.items, sectionCollapsed, showToast])

  const activeFilterChips = []
  if (category !== 'all') activeFilterChips.push({ k: 'cat', label: category === 'hexiang' ? 'HEXIANG 合祥' : '외주 外发', clear: () => { setCategory('all'); setSubFactory('') } })
  if (subFactory) activeFilterChips.push({ k: 'sub', label: subFactory, clear: () => setSubFactory('') })
  factorySel.forEach(f => activeFilterChips.push({ k: 'f' + f, label: f, clear: () => setFactorySel(prev => prev.filter(x => x !== f)) }))
  if (month) activeFilterChips.push({ k: 'm', label: month, clear: () => setMonth('') })
  if (procFilter) activeFilterChips.push({ k: 'pf', label: PROC_FILTERS.find(p => p.key === procFilter)?.label || procFilter, clear: () => setProcFilter('') })
  if (search) activeFilterChips.push({ k: 's', label: `"${search}"`, clear: () => setSearch('') })

  const inputStyle = { padding: '8px 12px', borderRadius: 8, fontSize: 12, border: `1px solid ${G.border}`, background: G.card, color: G.tx, outline: 'none', fontFamily: 'inherit' }

  const CatTab = ({ id, kr, cn, count }) => {
    const on = mode === 'ordered' && category === id
    return (
      <button onClick={() => { setMode('ordered'); setCategory(id); if (id !== 'outsource') setSubFactory('') }} className="chip" style={{
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
      <style>{PAGE_CSS}</style>

      {/* Header */}
      <div className="card" style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <Rail G={G} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="syne" style={{ background: G.primary, color: '#FFF', padding: '6px 10px', borderRadius: 6, display: 'flex' }}><ClipboardCheck size={16} /></span>
          <div>
            <div className="syne" style={{ fontSize: 18, fontWeight: 700, color: G.tx, letterSpacing: '-.3px' }}>产前确认 · 생산 전 체크</div>
            <div style={{ fontSize: 11, color: G.mu, marginTop: 1 }}>오더별 생산 전 공정 체크 · 订单产前工序确认</div>
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
          {/* item ② — print button beside 수정; hidden while editing / 미오더 모드 */}
          {!editMode && mode === 'ordered' && (
            <button onClick={enterPrintMode} disabled={loading || procLoading || visible.length === 0} className="btn-ghost"
              style={{ minHeight: 38, padding: '8px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, opacity: (loading || procLoading || visible.length === 0) ? 0.5 : 1 }}>
              🖨 프린트 打印
            </button>
          )}
        </div>
      </div>

      {/* Edit bar */}
      {editMode && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', borderColor: G.primary }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: G.accent, display: 'flex', alignItems: 'center', gap: 6, paddingTop: 6 }}><Pencil size={13} /> 편집 모드 · 编辑模式</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: G.mu }}>수정자 · 修改人 <span style={{ color: G.bad }}>*</span></span>
              <input
                ref={editorRef}
                value={editorName}
                onChange={e => { setEditorName(e.target.value); if (editorError) setEditorError(false) }}
                onAnimationEnd={() => setShaking(false)}
                placeholder="이름 · 姓名"
                style={{ ...inputStyle, padding: '6px 10px', minWidth: 150, border: `1px solid ${editorError ? G.bad : G.border}`, animation: shaking ? 'ikuShake .4s ease' : undefined }}
              />
            </div>
            {editorError && (
              <span style={{ fontSize: 10.5, color: G.bad, fontWeight: 600 }}>수정자 이름을 입력하세요 · 请输入修改人姓名</span>
            )}
          </div>
          <span style={{ fontSize: 10.5, color: G.fa, paddingTop: 6 }}>저장하려면 수정자 이름이 필요합니다 · 保存需填写修改人</span>
        </div>
      )}

      {/* ── 탭 그룹: 오더완료 下单完成 / 미오더 未下单 ── */}
      <div style={{ marginBottom: 14 }}>
        {/* 오더완료 그룹 (기존 MO) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 12px', background: G.cardAlt, border: `1px solid ${G.hair}`, borderRadius: '10px 10px 0 0' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: G.accent, marginRight: 4 }}>오더완료 · 下单完成</span>
          <CatTab id="all" kr="전체" cn="全部" count={catCounts.all} />
          <CatTab id="hexiang" kr="HEXIANG" cn="合祥" count={catCounts.hx} />
          <CatTab id="outsource" kr="외주공장" cn="外发工厂" count={catCounts.out} />
          <span style={{ marginLeft: 'auto', fontSize: 11, color: G.mu }}>총 <b style={{ color: G.tx }}>{catCounts.all}</b>개 오더 · 共{catCounts.all}个订单</span>
        </div>
        {/* 미오더 그룹 (Style) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 12px', background: G.dk ? 'rgba(210,137,113,0.07)' : 'rgba(138,62,46,0.05)', border: `1px solid ${G.hair}`, borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: G.bad, marginRight: 4 }}>미오더 · 未下单</span>
          {/* 전체 全部 — 기본 선택(styleTab 없음) */}
          {(() => {
            const on = mode === 'unordered' && !styleTab
            return (
              <button onClick={() => { setMode('unordered'); setStyleTab(null) }} className="chip"
                style={{ border: `1px solid ${on ? G.primary : G.border}`, background: on ? (G.dk ? 'rgba(232,200,152,0.12)' : 'rgba(201,168,110,0.12)') : 'transparent', color: on ? G.accent : G.mu, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                전체 <span style={{ color: G.mu, fontWeight: 500 }}>全部</span>
                <span className="num" style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: on ? G.primary : G.hair, color: on ? '#fff' : G.mu }}>{unorderedStyles.length}</span>
              </button>
            )
          })()}
          {styleLoading ? (
            <span style={{ fontSize: 11, color: G.fa }}>불러오는 중 · 加载中…</span>
          ) : unorderedTabs.length === 0 ? (
            <span style={{ fontSize: 11, color: G.fa }}>미오더 항목 없음 · 暂无未下单</span>
          ) : unorderedTabs.map(t => {
            const on = mode === 'unordered' && styleTab && styleTab.type === t.type && styleTab.value === t.value
            return (
              <button key={`${t.type}:${t.value}`} onClick={() => { setMode('unordered'); setStyleTab({ type: t.type, value: t.value }) }} className="chip"
                style={{ border: `1px solid ${on ? G.primary : G.border}`, background: on ? (G.dk ? 'rgba(232,200,152,0.12)' : 'rgba(201,168,110,0.12)') : 'transparent', color: on ? G.accent : G.mu, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {t.label}{t.type === 'season' && <span style={{ fontSize: 9, color: G.fa }}>시즌</span>}
                <span className="num" style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: on ? G.primary : G.hair, color: on ? '#fff' : G.mu }}>{t.count}</span>
              </button>
            )
          })}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: G.mu }}>총 <b style={{ color: G.tx }}>{unorderedStyles.length}</b>개 스타일 · 共{unorderedStyles.length}个款式</span>
        </div>
      </div>

      {mode === 'ordered' ? (
      <>
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

      {/* HEXIANG 工人情况 위젯 — 전체/HEXIANG 탭에서 표시, 외주공장 탭에서만 숨김 (DOM 유지) */}
      <HexiangFactoryWidget G={G} visible={category !== 'outsource'} />

      {/* Result count */}
      <div style={{ fontSize: 11, color: G.mu, marginBottom: 12 }}>
        {loading ? '불러오는 중 · 加载中…' : `${visible.length}개 오더 · ${visible.length} 个订单`}
      </div>

      {/* Cards */}
      {loading || procLoading ? (
        <div className="proc-grid">
          {[...Array(5)].map((_, i) => <SkeletonCard key={i} G={G} />)}
        </div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: G.mu }}>
          <ClipboardCheck size={40} style={{ color: G.fa, marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>표시할 오더가 없습니다 · 没有可显示的订单</div>
          <div style={{ fontSize: 12, color: G.fa, marginTop: 4 }}>필터를 조정하거나 검색해 보세요 · 请调整筛选或搜索</div>
        </div>
      ) : (
        <div className="proc-grid">
          {visible.map(mo => (
            <ProcessCard
              key={itemNoOf(mo)} G={G} mo={mo}
              record={proc.items[itemNoOf(mo)]}
              editable={editMode}
              canMutate={editMode}
              onSaveItem={handleSaveItem}
              onZoom={setZoomSrc}
              collapsedFor={(secId) => sectionCollapsed(itemNoOf(mo), secId)}
              onToggleSection={(secId) => toggleCardSection(itemNoOf(mo), secId)}
              printMode={printMode}
              checked={selectedToPrint.has(itemNoOf(mo))}
              onToggleChecked={() => togglePrintChecked(itemNoOf(mo))}
              fabricKv={moFabric[itemNoOf(mo)] || ''}
              onSaveFabric={onSaveFabric}
              onDelete={handleDeleteMo}
            />
          ))}
        </div>
      )}
      </>
      ) : (
      <>
        {/* ── 미오더 섹션 (Style) ── */}
        {/* 검색 (SKU·영문명·중문명) — 월별/시즌은 위 탭이 필터 역할 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
            <Search size={13} style={{ position: 'absolute', top: 11, left: 10, color: G.mu, pointerEvents: 'none' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="SKU·영문명·중문명 검색 / 搜索" style={{ ...inputStyle, width: '100%', paddingLeft: 30 }} />
          </div>
          {styleTab && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, padding: '3px 8px', borderRadius: 999, background: G.cardAlt, border: `1px solid ${G.hair}`, color: G.tx }}>
              {styleTab.value}
              <button onClick={() => setStyleTab(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.mu, display: 'flex', padding: 0 }}><X size={11} /></button>
            </span>
          )}
        </div>

        {/* 결과 수 */}
        <div style={{ fontSize: 11, color: G.mu, marginBottom: 12 }}>
          {styleLoading ? '불러오는 중 · 加载中…' : `${visibleStyles.length}개 스타일 · ${visibleStyles.length} 个款式`}
        </div>

        {styleLoading ? (
          <div className="proc-grid">{[...Array(5)].map((_, i) => <SkeletonCard key={i} G={G} />)}</div>
        ) : styleErr ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: G.mu }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: G.bad }}>데이터를 불러올 수 없습니다 · 无法加载数据</div>
            <div style={{ fontSize: 11, color: G.fa, marginTop: 4, marginBottom: 14 }}>{styleErr}</div>
            <button onClick={loadStyles} className="btn-primary" style={{ minHeight: 38, padding: '8px 18px', fontSize: 12 }}>재시도 · 重试</button>
          </div>
        ) : visibleStyles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: G.mu }}>
            <ClipboardCheck size={40} style={{ color: G.fa, marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>표시할 스타일이 없습니다 · 没有可显示的款式</div>
            <div style={{ fontSize: 12, color: G.fa, marginTop: 4 }}>위 미오더 탭을 선택하거나 검색해 보세요 · 请选择未下单标签或搜索</div>
          </div>
        ) : (
          <div className="proc-grid">
            {visibleStyles.map(st => {
              const sk = styleKey(st)
              return (
                <UnorderedStyleCard
                  key={sk} G={G} style={st}
                  factory={styleMeta.factory[sk] || ''}
                  note={styleMeta.note[sk] || ''}
                  onZoom={setZoomSrc}
                  onSaveFactory={onSaveStyleFactory}
                  onSaveNote={onSaveStyleNote}
                  onConvert={onConvertStyle}
                  onDelete={handleDeleteStyle}
                />
              )
            })}
          </div>
        )}
      </>
      )}

      {/* print selection bottom bar */}
      {printMode && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1400, background: G.surf, borderTop: `1px solid ${G.border}`, boxShadow: '0 -4px 16px rgba(0,0,0,0.12)', padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: G.tx }}>{selectedToPrint.size}개 선택 · 已选 {selectedToPrint.size} 个</span>
          <button onClick={doPrint} className="btn-primary" style={{ minHeight: 40, padding: '8px 18px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>🖨 프린트하기 打印</button>
          <button onClick={() => setPrintMode(false)} className="btn-ghost" style={{ minHeight: 40, padding: '8px 18px', fontSize: 13 }}>취소 取消</button>
        </div>
      )}

      {pwOpen && <PwModal G={G} onClose={() => setPwOpen(false)} onSuccess={onPwSuccess} />}
      {zoomSrc && <Lightbox src={zoomSrc} onClose={() => setZoomSrc(null)} />}
      <Toast toast={toast} G={G} />
    </div>
  )
}
