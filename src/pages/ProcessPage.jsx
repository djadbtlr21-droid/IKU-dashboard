import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  ClipboardCheck, Search, Lock, Save, X,
  AlertTriangle, Pencil, CheckCircle2, Calendar,
  ChevronLeft, ChevronRight, MessageSquare, ZoomIn, ChevronUp, ChevronDown, Trash2, RefreshCw,
} from 'lucide-react'
import { fetchMoList } from '../api/client'
import {
  fetchProcessData, verifyProcessPassword, saveProcessItem,
  fetchStyleList, fetchStyleMeta, saveStyleFactory, saveStyleNote, hideStyle,
  fetchMoFabric, saveMoFabric,
  fetchDeletions, deleteMo, deleteStyle,
  translateText,
} from '../api/client'
import { getMoNumber, getMoSku, getMoFactory, getMonthKey } from '../utils/moHelpers'
import { pick, F as SF, isOrdered as styleIsOrdered, styleKey, seasonOf, monthOf } from '../utils/styleFields'
import ZohoImage from '../components/ZohoImage'
import { SkeletonCard } from '../components/SkeletonLoader'
import HexiangFactoryWidget from '../components/HexiangFactoryWidget'
import UnorderedStyleCard from '../components/UnorderedStyleCard'
import MoDetailModal from '../components/MoDetailModal'
import StyleDetailModal from '../components/StyleDetailModal'

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

// ⑧생산 이하 섹션 — 생산 돌입 자체가 产前确认(생산 전 체크)의 임무 완수이므로,
// 어떤 상태(裁剪中/裁缝中/包装中/生产完成)를 선택하든 완료(✅·초록, 깜빡임 없음)로 간주한다.
const ALWAYS_DONE_SECTIONS = new Set(['production'])

// Raw-material sections that may use the 입고완료 已入库 chip (item ③).
const RAW_SECTIONS = new Set(['fabric', 'sub_material', 'label', 'wash_label'])

const SECTIONS = [
  {
    id: 'self_sample', no: '①', kr: '자체샘플', cn: '自体样品', fields: [
      { key: 'pattern', kr: '패턴작업중', cn: '纸样制作中', type: 'chip' },
      { key: 'fit', kr: '핏조정중', cn: '版型调整中', type: 'chip' },
      { key: 'done', kr: '완성', cn: '完成', type: 'chip' },
      { key: 'completionDate', kr: '예상 완성일', cn: '预计完成日', type: 'date', completion: true },
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
      { key: 'completionDate', kr: '예상 완성일', cn: '预计完成日', type: 'date', completion: true },
    ],
  },
  {
    id: 'price', no: '③', kr: '단가', cn: '单价', fields: [
      { key: 'cost_fixed', kr: '공장가격확정', cn: '成本核算', type: 'chip', statuses: PRICE_STATUSES },
      { key: 'completionDate', kr: '예상 완성일', cn: '预计完成日', type: 'date', completion: true },
    ],
  },
  {
    id: 'fabric', no: '④', kr: '원단', cn: '面料', fields: [
      { key: 'ordered', kr: '오더완료', cn: '已下单', type: 'chip' },
      { key: 'type_color', kr: '퀄리티·색상확인', cn: '品质及颜色确认', type: 'chip' },
      { key: 'eta', kr: '예상 완성일', cn: '预计完成日', type: 'date', completion: true },
    ],
  },
  {
    id: 'sub_material', no: '⑤', kr: '부자재', cn: '辅料', fields: [
      { key: 'ordered', kr: '오더완료', cn: '已下单', type: 'chip' },
      { key: 'sample_color', kr: '샘플컬러확인', cn: '样品颜色确认', type: 'chip' },
      { key: 'eta', kr: '예상 완성일', cn: '预计完成日', type: 'date', completion: true },
    ],
  },
  {
    id: 'label', no: '⑥', kr: '라벨', cn: '标签', fields: [
      { key: 'ordered', kr: '오더완료', cn: '已下单', type: 'chip' },
      { key: 'eta', kr: '예상 완성일', cn: '预计完成日', type: 'date', completion: true },
    ],
  },
  {
    id: 'wash_label', no: '⑦', kr: '텍라벨', cn: '洗水标', fields: [
      { key: 'ordered', kr: '오더완료', cn: '已下单', type: 'chip' },
      { key: 'eta', kr: '예상 완성일', cn: '预计完成日', type: 'date', completion: true },
    ],
  },
  {
    id: 'production', no: '⑧', kr: '생산', cn: '生产', fields: [
      { key: 'in_production', kr: '생산상태', cn: '生产状态', type: 'chip', statuses: PRODUCTION_STATUSES },
      { key: 'prod_done_eta', kr: '예상 완성일', cn: '预计完成日', type: 'date', completion: true },
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
// secId 가 ALWAYS_DONE_SECTIONS 면 값이 선택된 즉시 'done' (생산 돌입 = 완료).
function chipStatus(cell, secId) {
  const v = cell?.v || ''
  if (!v) return 'none'
  if (ALWAYS_DONE_SECTIONS.has(secId)) return 'done'
  if (DONE_VALUES.has(v)) return 'done'
  return 'mid'
}

// Section aggregate status (chip fields only — dates/text excluded).
//   'ok'   : at least one chip selected and ALL selected are done
//   'warn' : at least one selected chip is a mid (incomplete) status
//   'none' : no chip selected
function sectionStatus(sec, cells) {
  const chips = sec.fields.filter(f => f.type === 'chip')
  const selected = chips.filter(f => cells[`${sec.id}.${f.key}`]?.v)
  if (!selected.length) return 'none'
  if (ALWAYS_DONE_SECTIONS.has(sec.id)) return 'ok'   // ⑧생산: 어떤 상태든 완료
  const anyMid = selected.some(f => !DONE_VALUES.has(cells[`${sec.id}.${f.key}`]?.v))
  return anyMid ? 'warn' : 'ok'
}

// ── 예상 완성일 (완성일) 헬퍼 ──
// 섹션의 완성일 필드(= completion 플래그) 값(yyyy-mm-dd) — 없으면 빈값
function completionField(sec) { return sec.fields.find(f => f.completion) }
function completionDateOf(sec, cells) {
  const f = completionField(sec)
  return f ? (cells[`${sec.id}.${f.key}`]?.d || '') : ''
}
// 완료 판단: 선택된 칩이 1개 이상이고 모든 선택된 칩이 완료값(DONE_VALUES)이어야 완성.
// 하위 항목(패턴/1차샘플/미세조정/사이즈샘플 등)에 중간 상태가 하나라도 있으면 미완성.
// ⑧생산(ALWAYS_DONE_SECTIONS)은 어떤 상태든 선택되면 완성으로 간주.
function sectionDone(sec, cells) {
  const chips = sec.fields.filter(f => f.type === 'chip')
  if (ALWAYS_DONE_SECTIONS.has(sec.id)) return chips.some(f => cells[`${sec.id}.${f.key}`]?.v)
  const selected = chips.filter(f => cells[`${sec.id}.${f.key}`]?.v)
  if (!selected.length) return false
  return selected.every(f => DONE_VALUES.has(cells[`${sec.id}.${f.key}`]?.v))
}
// 접힘 상태 섹션 제목 아래 완성일 행 — 항상 표시, 좌측 정렬, 아이콘 날짜 우측(gap 4).
//   ① 날짜 미설정+미완성 → "예상 완성일 预计完成日:" 라벨만 회색 (아이콘 없음)
//   ②③ 날짜 설정+미완성 → "예상 완성일 预计完成日: yyyy-mm-dd ⚠" 빨강 깜빡 (경과 여부 무관)
//   ④ 완성 → "완성일 完成日: yyyy-mm-dd ✅" 초록 정적 (날짜 없으면 — 표시)
function CompletionBadge({ G, sec, cells }) {
  const ymd = completionDateOf(sec, cells)
  const done = sectionDone(sec, cells)
  const incomplete = !done && !!ymd          // 미완성 + 날짜 설정 = 빨강 깜빡
  const color = done ? G.ok : (incomplete ? G.bad : G.mu)
  const blink = incomplete
  const label = done ? '완성일 完成日:' : '예상 완성일 预计完成日:'
  const dateText = done ? (ymd || '—') : ymd  // 완성+무날짜 → '—', 미완성+무날짜 → 라벨만
  const icon = done ? '✅' : (incomplete ? '⚠' : '')
  return (
    <div className={blink ? 'iku-blink' : undefined}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 4, fontSize: 11, fontWeight: blink ? 700 : (done ? 600 : 400), color, marginTop: 3, marginLeft: 0, paddingLeft: 0 }}>
      <span>{label}</span>
      {dateText && <span className="num">{dateText}</span>}
      {icon && <span>{icon}</span>}
    </div>
  )
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
  // 원단 이름(한/중 명칭) = Fabric_Name · 원단 성분(영문/혼용) = Material_Type
  const name = fieldStr(mo?.Fabric_Name)
  const composition = fieldStr(mo?.Material_Type)
  let weight = fieldStr(mo?.Fabric_Weight)
  if (weight && /^\d+(\.\d+)?$/.test(weight)) weight = `${weight}g`
  const parts = [name, composition, weight].filter(Boolean)
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
          // ⑧생산 이하 섹션은 어떤 값이든 완료(✅) 처리 (화면과 동일)
          const aDone = ALWAYS_DONE_SECTIONS.has(sec.id)
          const done = DONE_VALUES.has(cv) || (aDone && !!cv)
          if (!cv) valHTML = '<span class="empty">— 미선택 未选择</span>'
          else valHTML = `<span class="${done ? 'done' : 'mid'}">${done ? '✅ ' : ''}${escapeHtml(statusLabel(cv))}</span>${cd ? ` <span class="mono">${escapeHtml(cd)}</span>` : ''}`
        }
        const aDoneLbl = ALWAYS_DONE_SECTIONS.has(sec.id)
        const labelCls = f.type === 'chip' && (DONE_VALUES.has(cv) || (aDoneLbl && cv)) ? 'done' : (f.type === 'chip' && cv ? 'mid' : '')
        return `<tr><td class="lbl ${labelCls}">${escapeHtml(f.kr)}<br><span class="cn">${escapeHtml(f.cn)}</span></td><td class="val">${valHTML}</td></tr>`
      }).join('')
      const memo = cells[`${sec.id}._memo`]?.v || ''
      const memoRow = memo ? `<tr><td class="lbl">비고<br><span class="cn">备注</span></td><td class="val memo">${escapeHtml(memo)}</td></tr>` : ''
      return `<div class="sec">${title}<table class="grid">${rows}${memoRow}</table></div>`
    }).join('')

    // 최신현황 메모 最新状况备注 — 헤더 바로 아래(①자체샘플 위), 번호 없음
    const remark = rec.remark || ''
    const remarkHTML = `<div class="sec"><div class="sec-title"><span class="ttl">현황 메모 <span class="cn">状况备注</span></span></div><div class="remark">${remark ? escapeHtml(remark) : '—'}</div></div>`

    return `<section class="card">${header}${remarkHTML}${secsHTML}</section>`
  }

  const body = mos.map(cardHTML).join('')
  return buildPrintShell({ titleText: '产前确认 · 생산 전 체크', body, stamp })
}

// 공통 프린트 셸 (A4 2열 카드 레이아웃 + 페이지네이션) — 오더완료/미오더 공용
function buildPrintShell({ titleText, body, stamp }) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
<title>${escapeHtml(titleText)}</title>
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
  var TITLE = ${JSON.stringify(titleText)};
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
          h.innerHTML = '<h1>' + TITLE + '</h1><div class="stamp">출력일시 打印时间: ' + STAMP + '</div>';
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

// 미오더(Style) 프린트 — 오더완료와 동일한 A4 카드 레이아웃(공통 셸) 재사용
function buildStylePrintHTML({ styles, meta, origin, now }) {
  const stamp = (() => {
    const p = (n) => String(n).padStart(2, '0')
    return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}`
  })()
  // 중간/진행 상태 = 빨강 정적, 승인/활성 = 초록, 그외 기본 (깜빡임 없음)
  const colorOf = (val) => {
    const s = String(val || '').toLowerCase()
    if (/in.?progress|进行|sampling|제작\s*중|제작중|진행/.test(s)) return '#C53030'
    if (/approved|승인|已批准|active|활성|启用|complete|完成/.test(s)) return '#2F855A'
    return '#1A1714'
  }
  const cardHTML = (st) => {
    const key = styleKey(st)
    const sku = pick(st, SF.sku) || key
    const chi = pick(st, SF.chi)
    const brand = pick(st, SF.brand)
    const fabric = pick(st, SF.fabric)
    const styleSt = pick(st, SF.styleStatus)    // 샘플 상태 打样状态
    const sampleSt = pick(st, SF.sampleStatus)  // 승인 상태 审批状态
    const factory = (meta.factory && meta.factory[key]) || ''
    const note = (meta.note && meta.note[key]) || ''
    const v = st?.Style_Image
    const first = Array.isArray(v) ? v[0] : v
    const path = typeof first === 'string' ? first : (first?.url || first?.filepath || first?.path)
    const imgSrc = path ? `${origin}/api/zoho-image?filepath=${encodeURIComponent(path)}` : ''
    const header = `
      <div class="card-head">
        ${imgSrc ? `<img class="thumb" src="${escapeHtml(imgSrc)}" alt="" />` : '<div class="thumb"></div>'}
        <div class="head-info">
          <div class="mo-line">
            <span class="mono mo-no">${escapeHtml(sku)}</span>
            <span class="badge" style="background:#A14E3A">미오더 未下单</span>
          </div>
          ${chi ? `<div class="sku">${escapeHtml(chi)}</div>` : ''}
          ${brand ? `<div class="meta">🏷 브랜드 品牌: ${escapeHtml(brand)}</div>` : ''}
          ${fabric ? `<div class="meta">🧵 원단 面料: ${escapeHtml(fabric)}</div>` : ''}
        </div>
      </div>`
    const row = (kr, cn, val, color) => `<tr><td class="lbl">${escapeHtml(kr)}<br><span class="cn">${escapeHtml(cn)}</span></td><td class="val"${color ? ` style="color:${color};font-weight:600"` : ''}>${val ? escapeHtml(val) : '<span class="empty">— 미입력 未填写</span>'}</td></tr>`
    const sec = `<div class="sec"><div class="sec-title"><span class="ttl">상태 정보 <span class="cn">状态信息</span></span></div><table class="grid">
      ${row('샘플 상태', '打样状态', styleSt, colorOf(styleSt))}
      ${row('승인 상태', '审批状态', sampleSt, colorOf(sampleSt))}
      ${row('오더예정공장', '预计下单工厂', factory)}
    </table></div>`
    const remarkHTML = `<div class="sec"><div class="sec-title"><span class="ttl">비고 <span class="cn">备注</span></span></div><div class="remark">${note ? escapeHtml(note) : '—'}</div></div>`
    return `<section class="card">${header}${sec}${remarkHTML}</section>`
  }
  const body = styles.map(cardHTML).join('')
  return buildPrintShell({ titleText: '产前确认 · 생산 전 체크 — 미오더 未下单', body, stamp })
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
/* ⑥ 미오더 카드 그리드 — 1줄 10개 (Style 탭과 동일) */
.mio-grid{display:grid;gap:10px;align-items:stretch;grid-template-columns:repeat(10,minmax(0,1fr))}
@media(max-width:1500px){.mio-grid{grid-template-columns:repeat(8,minmax(0,1fr))}}
@media(max-width:1200px){.mio-grid{grid-template-columns:repeat(6,minmax(0,1fr))}}
@media(max-width:900px){.mio-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:768px){.mio-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:520px){.mio-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
/* ⑤ 상태 깜빡임 (opacity 1↔0.25) */
@keyframes mioBlink {0%,100%{opacity:1}50%{opacity:.25}}
.mio-blink{animation:mioBlink 1.6s ease-in-out infinite}
`

// ──────────────────────────────────────────────────────────
// Lightweight bilingual date picker (item ④)
// ──────────────────────────────────────────────────────────
// Monday-first weekday headers, Chinese only (item ③).
const WEEKDAYS_CN = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
function DatePicker({ G, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })   // 달력 팝업 위치(fixed)
  const btnRef = useRef(null)
  const sel = parseYMD(value)
  const [view, setView] = useState(() => {
    const b = sel || new Date()
    return { y: b.getFullYear(), m: b.getMonth() }
  })

  // 카드 overflow 영향을 받지 않도록 position:fixed + 높은 z-index. 버튼 위치 기준 좌표 계산.
  const toggle = () => {
    if (open) { setOpen(false); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) {
      const W = 232, H = 300
      const left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8))
      const top = (r.bottom + H + 8 > window.innerHeight) ? Math.max(8, r.top - H - 4) : r.bottom + 4
      setCoords({ top, left })
    }
    setOpen(true)
  }

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
      <button ref={btnRef} type="button" onClick={toggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 6, fontSize: 12, border: `1px solid ${G.border}`, background: G.bg, color: value ? G.tx : G.fa, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <Calendar size={12} style={{ flexShrink: 0, color: G.mu }} />
        <span className="num" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || '날짜 선택 · 选择日期'}</span>
      </button>
      {open && (
        <>
          {/* 카드 overflow 무시: backdrop + 팝업 모두 fixed, z-index 9999 */}
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
          <div style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 9999, background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', padding: 10, width: 232, maxWidth: '80vw' }}>
            {/* header — 중국어 단독 (2026年6月) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <button type="button" onClick={prev} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.mu, display: 'flex', padding: 4 }}><ChevronLeft size={16} /></button>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: G.tx }}>{view.y}年{view.m + 1}月</span>
              <button type="button" onClick={next} style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.mu, display: 'flex', padding: 4 }}><ChevronRight size={16} /></button>
            </div>
            {/* weekday row — Monday first, 중국어 단독 (周一…周日), 周六 cool · 周日 red */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 2 }}>
              {WEEKDAYS_CN.map((w, i) => (
                <div key={w} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, lineHeight: 1.2, color: i === 6 ? G.bad : (i === 5 ? G.cool : G.mu), padding: '3px 0' }}>{w}</div>
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
            {/* footer — 중국어 단독 (今天 / 删除) */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button type="button" onClick={goToday} style={{ flex: 1, padding: '5px 0', fontSize: 11, borderRadius: 6, border: `1px solid ${G.border}`, background: 'transparent', color: G.accent, cursor: 'pointer', fontWeight: 600 }}>今天</button>
              <button type="button" onClick={clear} style={{ flex: 1, padding: '5px 0', fontSize: 11, borderRadius: 6, border: `1px solid ${G.border}`, background: 'transparent', color: G.bad, cursor: 'pointer', fontWeight: 600 }}>删除</button>
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
function CellEditor({ G, field, cell, editable, allowStock, onChange, alwaysDone = false, isBlue = false }) {
  const v = cell?.v || ''
  const d = cell?.d || ''
  const h = !!cell?.h
  const hlBg = G.dk ? 'rgba(212,165,114,0.18)' : 'rgba(252,211,77,0.28)'
  const done = DONE_VALUES.has(v) || (alwaysDone && !!v)

  if (!editable) {
    const empty = !v && !d
    const midRead = field.type === 'chip' && !!v && !done && !isBlue
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', padding: h ? '3px 6px' : 0, background: h ? hlBg : 'transparent', borderRadius: 6, textAlign: 'center' }}>
        {empty ? (
          <span style={{ fontSize: 12.7, color: G.fa }}>—</span>
        ) : (
          <>
            {v && (
              <span className={midRead ? 'iku-blink' : undefined}
                style={{ fontSize: 12.7, fontWeight: 600,
                  color: isBlue ? '#1D4ED8' : (done ? G.ok : (midRead ? G.bad : G.tx)),
                  padding: '2px 8px',
                  background: isBlue ? '#DBEAFE' : G.cardAlt,
                  border: `1px solid ${isBlue ? '#3B82F6' : G.hair}`,
                  borderRadius: 999 }}>
                {!isBlue && done ? '✅ ' : ''}{statusLabel(v)}
              </span>
            )}
            {d && <span className="num" style={{ fontSize: 12.7, color: isBlue ? '#3B82F6' : G.accent, fontWeight: 600 }}>{d}</span>}
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
          return (
            <button key={o.v} type="button"
              onClick={() => onChange({ ...cell, v: on ? '' : o.v })}
              style={{ padding: '3px 8px', fontSize: 10.5, borderRadius: 999, cursor: 'pointer', fontWeight: 600,
                border: `1px solid ${on ? (isBlue ? '#3B82F6' : G.primary) : G.border}`,
                background: on ? (isBlue ? '#DBEAFE' : (G.dk ? 'rgba(232,200,152,0.18)' : 'rgba(201,168,110,0.16)')) : 'transparent',
                color: on ? (isBlue ? '#1D4ED8' : G.accent) : G.mu, lineHeight: 1.35 }}>
              {o.ko} {o.cn}
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

// Section status dot (item ②): green ✅ when complete, amber ⚠ when a
// mid status is present, nothing when no status is selected.
function SectionIndicator({ G, status, isProduction = false, productionValue = '' }) {
  if (isProduction && status === 'ok') {
    const label = productionValue === '生产完成' ? '[생산완료]' : '[생산 중]'
    return <span style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', flexShrink: 0 }}>{label}</span>
  }
  if (status === 'ok') return <CheckCircle2 size={15} style={{ color: '#15803D', flexShrink: 0 }} />
  if (status === 'warn') return <AlertTriangle size={15} className="iku-blink" style={{ color: '#D97706', flexShrink: 0 }} />
  return null
}

// Collapse / expand toggle for a section (item ①) — bilingual label.
function SectionToggle({ G, collapsed, onToggle, isProduction = false }) {
  const btnColor = isProduction ? '#1D4ED8' : G.mu
  const btnBorder = isProduction ? '#3B82F6' : G.border
  const btnBg = isProduction ? (G.dk ? 'rgba(59,130,246,0.14)' : '#EFF6FF') : 'none'
  return (
    <button type="button" onClick={onToggle} title={collapsed ? '펴기 展开' : '접기 收起'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: btnBg, border: `1px solid ${btnBorder}`, borderRadius: 6, cursor: 'pointer', color: btnColor, padding: '3px 8px', fontSize: 13.2, fontWeight: 600, fontFamily: 'inherit' }}>
      {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
      {collapsed ? '펴기 展开' : '접기 收起'}
    </button>
  )
}

// ──────────────────────────────────────────────────────────
// C안 통합 필터 패널 — 행(라벨+칩), 칩, 구분선, 행 전환(height) 헬퍼
// ──────────────────────────────────────────────────────────
function FilterRow({ G, label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '7px 0' }}>
      <span style={{ width: 120, flexShrink: 0, fontSize: 11, fontWeight: 600, color: G.mu }}>{label}</span>
      <span style={{ width: 1, height: 20, background: G.hair, flexShrink: 0, marginRight: 4 }} />
      {children}
    </div>
  )
}
function PanelDivider({ G }) {
  return <div style={{ height: 1, background: G.hair }} />
}
// 행 표시/숨김 — grid-template-rows 0fr↔1fr 로 height transition 0.2s
function CollapseRow({ show, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateRows: show ? '1fr' : '0fr', transition: 'grid-template-rows .2s ease' }}>
      <div style={{ overflow: 'hidden', minHeight: 0 }}>{children}</div>
    </div>
  )
}
// 통합 패널 칩 — tone='ok' 이면 초록(오더완료), 기본은 골드 accent
function PanelChip({ G, on, onClick, label, cn, count, tone }) {
  const onColor = tone === 'ok' ? G.ok : G.accent
  const onBg = tone === 'ok'
    ? (G.dk ? 'rgba(110,190,140,0.14)' : 'rgba(60,160,90,0.10)')
    : (G.dk ? 'rgba(232,200,152,0.12)' : 'rgba(201,168,110,0.12)')
  const onBorder = tone === 'ok' ? G.ok : G.primary
  const strongBorder = G.dk ? '#4A453E' : '#D9D0BE'
  return (
    <button type="button" onClick={onClick} className="chip" style={{
      border: `1px solid ${on ? onBorder : strongBorder}`,
      background: on ? onBg : 'transparent',
      color: on ? onColor : G.mu, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>
      {label}{cn ? <span style={{ color: on ? onColor : G.mu, fontWeight: 500, opacity: 0.85 }}>{cn}</span> : null}
      <span className="num" style={{ fontSize: 11, padding: '1px 6px', borderRadius: 999, background: on ? onBorder : G.hair, color: on ? '#fff' : G.mu }}>{count}</span>
    </button>
  )
}

// ──────────────────────────────────────────────────────────
// 현황 메모 状况备注 — 헤더 바로 아래(①자체샘플 위). 번호 없음.
// 접기/펴기 토글 + 중→한 번역(Gemini) + 작성자 기입 기능. KV 키(remark)는 기존 그대로.
// ──────────────────────────────────────────────────────────
function RemarkBlock({ G, remark, remarkAuthor = '', editable, onChange, onAuthorChange, authorError, collapsed, onToggle, showToast }) {
  const [tOpen, setTOpen] = useState(false)
  const [tLoading, setTLoading] = useState(false)
  const [tResult, setTResult] = useState('')
  const [authorTouched, setAuthorTouched] = useState(false)
  const hasText = !!(remark && remark.trim())
  const transBg = G.dk ? 'rgba(55,138,221,0.14)' : '#EAF4FB'
  const showAuthorErr = (authorError || (authorTouched && !remarkAuthor.trim())) && hasText
  const onTranslate = async () => {
    if (tOpen) { setTOpen(false); return }
    if (!hasText || tLoading) return
    setTLoading(true)
    try {
      const r = await translateText(remark.trim(), 'ko')
      if (r?.ok && r.translation) { setTResult(r.translation); setTOpen(true) }
      else showToast?.('번역 실패 · 翻译失败, 잠시 후 다시 시도해주세요', 'bad')
    } catch {
      showToast?.('번역 실패 · 翻译失败, 잠시 후 다시 시도해주세요', 'bad')
    } finally { setTLoading(false) }
  }
  return (
    <div style={{ paddingTop: 4, paddingBottom: 12 }}>
      {/* 제목 행: 현황 메모 + 번역 버튼 + 접기/펴기 토글 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: collapsed ? 0 : 8 }}>
        <span style={{ fontSize: 15.18, fontWeight: 700, color: G.tx, lineHeight: 1.2 }}>현황 메모 <span style={{ color: G.mu, fontWeight: 500 }}>状况备注</span></span>
        <button type="button" onClick={onTranslate} disabled={!hasText || tLoading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 6, fontSize: 10.5, fontWeight: 600, fontFamily: 'inherit', cursor: (!hasText || tLoading) ? 'default' : 'pointer', border: `1px solid ${G.border}`, background: 'transparent', color: (!hasText || tLoading) ? G.fa : G.accent, opacity: (!hasText || tLoading) ? 0.55 : 1 }}>
          {tLoading ? <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> : null}
          {tLoading ? '번역 중... · 翻译中...' : '중→한 번역 · 翻译'}
        </button>
        <span style={{ marginLeft: 'auto', flexShrink: 0 }}>
          <SectionToggle G={G} collapsed={collapsed} onToggle={onToggle} />
        </span>
      </div>
      {/* 본문 (접기/펴기) */}
      <div style={{ display: 'grid', gridTemplateRows: collapsed ? '0fr' : '1fr', transition: 'grid-template-rows .25s ease' }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          {editable ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0, width: 110 }}>
                <label style={{ fontSize: 10, color: G.mu, fontWeight: 600 }}>작성자 · 修改人</label>
                <input type="text" value={remarkAuthor} onChange={e => onAuthorChange(e.target.value)}
                  onBlur={() => setAuthorTouched(true)}
                  placeholder="이름 · 姓名"
                  style={{ width: '100%', padding: '7px 8px', fontSize: 12, border: `1px solid ${showAuthorErr ? G.bad : G.border}`, borderRadius: 7, background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                {showAuthorErr && <div style={{ fontSize: 10, color: G.bad, lineHeight: 1.2 }}>필수 입력 · 必填</div>}
              </div>
              <span style={{ color: G.mu, paddingTop: 23, flexShrink: 0 }}>:</span>
              <textarea value={remark} onChange={e => onChange(e.target.value)} rows={2}
                placeholder="자유 메모 · 自由备注"
                style={{ flex: 1, padding: '8px 10px', fontSize: 13.2, border: `1px solid ${G.border}`, borderRadius: 8, background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', minHeight: '78px' }} />
            </div>
          ) : (
            <div style={{ fontSize: 14.5, color: remark ? G.tx : G.fa, whiteSpace: 'pre-wrap', lineHeight: 1.5, minHeight: '78px' }}>
              {remarkAuthor ? <><span style={{ fontWeight: 700, color: '#B45309' }}>{remarkAuthor}</span><span style={{ color: G.mu }}> : </span></> : null}
              {remark || '—'}
            </div>
          )}
          {/* 번역 결과 — 슬라이드 다운 (0.3s) */}
          <div style={{ display: 'grid', gridTemplateRows: tOpen ? '1fr' : '0fr', transition: 'grid-template-rows .3s ease' }}>
            <div style={{ overflow: 'hidden', minHeight: 0 }}>
              <div style={{ position: 'relative', marginTop: 8, padding: '8px 26px 8px 10px', borderRadius: 8, background: transBg }}>
                <div style={{ fontSize: 11, color: G.mu, fontWeight: 600, marginBottom: 4 }}>🇰🇷 한국어 번역</div>
                <div style={{ fontSize: 13.8, color: G.tx, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{tResult}</div>
                <button type="button" onClick={() => setTOpen(false)} title="닫기 · 关闭"
                  style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: 'none', background: 'transparent', color: G.mu, cursor: 'pointer' }}>
                  <X size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Process card (one order)
// ──────────────────────────────────────────────────────────
function ProcessCard({ G, mo, record, editable, onZoom, showToast,
  collapsedFor, onToggleSection, printMode, checked, onToggleChecked, fabricKv = '', onDelete, onOpenDetail, draft, onDraft, authorError = false }) {
  const [confirmDelete, setConfirmDelete] = useState(false)   // ③ 삭제 확인
  const itemNo = itemNoOf(mo)

  const savedCells = record?.cells || {}
  const savedRemark = record?.remark || ''
  const savedRemarkAuthor = record?.remarkAuthor || ''

  // Collapse state is owned by the parent so the print feature can read it.
  const toggleSection = onToggleSection

  // ① 컨트롤드: 편집값은 부모 draft 로 일원화(카드 자체 저장 없음, 일괄저장)
  const cells = (draft && draft.cells) ? draft.cells : savedCells
  const remark = (draft && draft.remark !== undefined) ? draft.remark : savedRemark
  const remarkAuthor = (draft && draft.remarkAuthor !== undefined) ? draft.remarkAuthor : savedRemarkAuthor

  const setCell = (cellKey, val) => {
    const base = (draft && draft.cells) ? draft.cells : savedCells
    const next = { ...base, [cellKey]: val }
    if (!val || (!val.v && !val.d && !val.h)) delete next[cellKey]
    onDraft(itemNo, { cells: next })
  }
  const setRemark = (val) => onDraft(itemNo, { remark: val })
  const setRemarkAuthor = (val) => onDraft(itemNo, { remarkAuthor: val })

  const badge = procStatusBadge(mo, G)
  const chiName = typeof mo.Chi_Style_Name === 'string' ? mo.Chi_Style_Name : (mo.Chi_Style_Name?.zc_display_value || '')
  const monthKey = getMonthKey(mo)
  const fabric = getFabricInfo(mo)
  const imgUrl = styleImageUrl(mo)
  const legacyFabricName = cells['fabric.fabricName']?.v || ''  // 구버전 process-cell 원단명(폴백)
  // ③ 원단 "이름" = Fabric_Name 만 사용 (성분 Material_Type 로 fallback 절대 금지)
  const zohoFabric = fabric.name || ''
  // 표시 우선순위: KV 사용자입력 > 구버전 입력 > Zoho 원단 이름 (성분 아님)
  const savedFabric = fabricKv || legacyFabricName || zohoFabric
  const fabricInput = (draft && draft.fabric !== undefined) ? draft.fabric : savedFabric
  const displayFabric = savedFabric                       // 읽기 표시 값
  const setFabric = (val) => onDraft(itemNo, { fabric: val })
  const totalQty = fieldStr(mo?.Plan_Total_Quantity)       // 총 수량 (Zoho)

  // 경고 항목 요약 — ①~⑦ 섹션 중 중간 상태(완성/완료 아닌 상태)가 선택된 섹션
  // (⑧생산은 sectionStatus가 항상 'ok'를 반환하므로 warnList에 포함되지 않음)
  const warnList = []
  for (const sec of SECTIONS) {
    if (ALWAYS_DONE_SECTIONS.has(sec.id)) continue  // ⑧ 생산 제외
    if (sectionStatus(sec, cells) !== 'warn') continue
    const mids = sec.fields
      .filter(f => f.type === 'chip')
      .map(f => cells[`${sec.id}.${f.key}`]?.v)
      .filter(v => v && !DONE_VALUES.has(v))
    warnList.push(`${sec.kr} ${mids.map(statusLabel).join('/')}`.trim())
  }
  // 전체 완료: ①~⑦ 섹션이 모두 'ok' (⑧생산 제외 — 생산은 별도 표시)
  const allDone = !warnList.length && SECTIONS.filter(sec => !ALWAYS_DONE_SECTIONS.has(sec.id)).every(sec => sectionStatus(sec, cells) === 'ok')
  // ⑧생산 현재 상태값 (헤더 파란색 표시용)
  const prodVal = cells['production.in_production']?.v || ''
  const prodStatusObj = prodVal ? ALL_STATUS.find(x => x.v === prodVal) : null

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
      <div style={{ display: 'flex', gap: 12, padding: 14, borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
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
        {/* ⑤ 이미지 우측 텍스트 영역 클릭 → MO 상세 모달 (수정 모드에선 모달 비활성) */}
        <div onClick={() => { if (!editable && onOpenDetail) onOpenDetail() }} title={!editable ? '상세 보기 · 查看详情' : ''}
          style={{ flex: 1, minWidth: 0, cursor: (!editable && onOpenDetail) ? 'pointer' : 'default' }}>
          {/* 오더번호 + 상태배지 동일 행 (수정 모드: 우측에 삭제버튼 추가) */}
          {editable ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
              <span className="num" title={getMoNumber(mo)} style={{ fontSize: 14.5, fontWeight: 700, color: G.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 auto', minWidth: 0 }}>{getMoNumber(mo)}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: badge.color, padding: '2.2px 7.7px', borderRadius: 999, flexShrink: 0, minWidth: 58, textAlign: 'center', whiteSpace: 'nowrap' }}>
                {badge.kr}{badge.cn ? ` · ${badge.cn}` : ''}
              </span>
              {isShipped(mo) && <span style={{ fontSize: 9.5, color: G.ok, border: `1px solid ${G.ok}`, padding: '1px 6px', borderRadius: 999, flexShrink: 0, whiteSpace: 'nowrap' }}>출고 已出货</span>}
              <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }} title="삭제 · 删除"
                style={{ marginLeft: 'auto', flexShrink: 0, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', border: `1px solid ${G.border}`, background: G.card, color: G.bad }}>
                <Trash2 size={13} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
              <span className="num" style={{ fontSize: 14.5, fontWeight: 700, color: G.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 auto', minWidth: 0 }}>{getMoNumber(mo)}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: badge.color, padding: '2.2px 7.7px', borderRadius: 999, flexShrink: 0, minWidth: 58, textAlign: 'center', whiteSpace: 'nowrap' }}>
                {badge.kr}{badge.cn ? ` · ${badge.cn}` : ''}
              </span>
              {isShipped(mo) && <span style={{ fontSize: 9.5, color: G.ok, border: `1px solid ${G.ok}`, padding: '1px 6px', borderRadius: 999, flexShrink: 0, whiteSpace: 'nowrap' }}>출고 已出货</span>}
            </div>
          )}
          <div title={getMoSku(mo)} style={{ fontSize: 13.3, color: G.tx, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getMoSku(mo)}</div>
          {chiName && <div title={chiName} style={{ fontSize: 13.3, color: G.mu, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chiName}</div>}
          {/* 🏭 공장 · 📅 월 */}
          <div style={{ fontSize: 13.3, color: G.fa, marginTop: 3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>🏭 {getMoFactory(mo)}</span>
            {monthKey && <span>📅 {monthKey}</span>}
          </div>
          {/* ① 수량 + 원단 1줄 (말줄임, 2줄 금지, hover tooltip) */}
          {(totalQty || displayFabric) && (
            <div title={[totalQty ? `${totalQty}件` : '', displayFabric].filter(Boolean).join(' · ')}
              style={{ fontSize: 13.3, color: G.mu, fontWeight: 600, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {totalQty && <span className="num">📦 {totalQty}件</span>}
              {totalQty && displayFabric && <span style={{ color: G.fa }}> · </span>}
              {displayFabric && <span>🧵 {displayFabric}</span>}
            </div>
          )}
          {/* 경고/완성 영역 — 항상 최소 3행 높이 확보하여 카드 헤더 높이 통일 */}
          {(() => {
            const MAX_WARNS = 3
            const displayed = warnList.slice(0, MAX_WARNS)
            const extra = warnList.length > MAX_WARNS ? warnList.length - MAX_WARNS : 0
            return (
              <div style={{ marginTop: 4, minHeight: 57, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {allDone ? (
                  <div style={{ fontSize: 13.3, fontWeight: 700, color: G.ok, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    ✅ 생산 전 체크 항목 완료 · 产前项目全部完成
                  </div>
                ) : (
                  <>
                    {displayed.map((w, i) => (
                      <div key={i} className="iku-blink" title={`⚠ ${w}`}
                        style={{ fontSize: 13.3, fontWeight: 700, color: G.bad, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        ⚠ {w}
                      </div>
                    ))}
                    {extra > 0 && (
                      <div style={{ fontSize: 12, color: G.mu, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        +{extra}개 더 · 更多{extra}项
                      </div>
                    )}
                  </>
                )}
                {prodVal && (
                  <div style={{ fontSize: 13.3, fontWeight: 700, color: '#1D4ED8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    🏭 {prodStatusObj?.ko || prodVal} · {prodStatusObj?.cn || prodVal}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </div>

      {/* 현황 메모 — 헤더와 한 세트(동일 계열 배경), 하단 진한 구분선 */}
      <div style={{ background: G.cardAlt, padding: '0 14px', borderBottom: `2px solid #9CA3AF` }}>
        <RemarkBlock G={G} remark={remark} remarkAuthor={remarkAuthor} editable={editable}
          onChange={setRemark} onAuthorChange={setRemarkAuthor} authorError={authorError}
          collapsed={collapsedFor('remark')} onToggle={() => toggleSection('remark')} showToast={showToast} />
      </div>
      {/* Checklist — ①~⑧ 공정 체크리스트 */}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {SECTIONS.map(sec => {
          const allowStock = RAW_SECTIONS.has(sec.id)
          const memoKey = `${sec.id}._memo`
          const memo = cells[memoKey]?.v || ''
          const status = sectionStatus(sec, cells)   // item ② aggregate status
          const isCollapsed = collapsedFor(sec.id)   // item ① collapse state (parent-owned)
          return (
            <div key={sec.id} style={{ paddingBottom: 20, borderBottom: `1px solid ${G.hair}`, ...(ALWAYS_DONE_SECTIONS.has(sec.id) ? { background: G.dk ? 'rgba(59,130,246,0.12)' : '#EFF6FF', borderLeft: '4px solid #3B82F6', borderRadius: 6, paddingLeft: 10, marginLeft: -4 } : {}) }}>
              {/* section title (number scales with it); flexWrap so right-side
                  items drop below instead of overlapping on narrow cards */}
              <div style={{ fontSize: 15.18, fontWeight: 700, color: ALWAYS_DONE_SECTIONS.has(sec.id) ? '#1D4ED8' : G.tx, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', lineHeight: 1.2 }}>
                <span><span style={{ color: ALWAYS_DONE_SECTIONS.has(sec.id) ? '#3B82F6' : G.accent, marginRight: 5 }}>{sec.no}</span>{sec.kr} <span style={{ color: ALWAYS_DONE_SECTIONS.has(sec.id) ? '#93C5FD' : G.mu, fontWeight: 500 }}>{sec.cn}</span></span>
                {!editable && <MemoBadge G={G} memo={memo} />}
                {/* ⑥ 원단명/성분 (read): Zoho 자동값 + KV 오버라이드 우선 — 제목 우측 */}
                {sec.id === 'fabric' && !editable && displayFabric && (
                  <span title={displayFabric} style={{ flex: 1, textAlign: 'center', fontSize: 13.2, fontWeight: 500, color: G.mu, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                    🧵 {displayFabric}
                  </span>
                )}
                {/* ⑥ 원단명/성분 (edit): 제목 바로 우측 input, 저장 시 KV(fabric:{`{MO_ID}`}) */}
                {sec.id === 'fabric' && editable && (
                  <input value={fabricInput} onChange={e => setFabric(e.target.value)}
                    placeholder="원단 이름 · 面料名称"
                    style={{ flex: 1, minWidth: 0, marginLeft: 4, padding: '4px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 500, border: `1px solid ${G.border}`, background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit' }} />
                )}
                {/* item ②/① — when collapsed, indicator + expand toggle live in the title row */}
                {isCollapsed && (
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <SectionIndicator G={G} status={status} isProduction={ALWAYS_DONE_SECTIONS.has(sec.id)} productionValue={cells[`${sec.id}.in_production`]?.v || ''} />
                    <SectionToggle G={G} collapsed onToggle={() => toggleSection(sec.id)} isProduction={ALWAYS_DONE_SECTIONS.has(sec.id)} />
                  </span>
                )}
              </div>
              {/* 접힘 상태: 완성일 표시 (⑧생산은 생산 상태 표시로 대체) */}
              {isCollapsed && (ALWAYS_DONE_SECTIONS.has(sec.id) ? (() => {
                const pv = cells[`${sec.id}.in_production`]?.v || ''
                if (!pv) return null
                const pso = ALL_STATUS.find(x => x.v === pv)
                return <div style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', marginTop: 3 }}>{pv === '生产完成' ? '[생산완료]' : '[생산 중]'}: {pso?.ko} {pso?.cn}</div>
              })() : <CompletionBadge G={G} sec={sec} cells={cells} />)}
              {/* collapsible body (item ① — smooth grid-rows animation) */}
              <div style={{ display: 'grid', gridTemplateRows: isCollapsed ? '0fr' : '1fr', transition: 'grid-template-rows .25s ease' }}>
              <div style={{ overflow: 'hidden', minHeight: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: editable ? 8 : 4, paddingLeft: 4 }}>
                {/* ⑥ 원단명/성분 편집은 섹션 제목 우측 input 으로 이동(상단) */}
                {sec.fields.map(f => {
                  const cellKey = `${sec.id}.${f.key}`
                  const cell = cells[cellKey]
                  const st = f.type === 'chip' ? chipStatus(cell, sec.id) : 'none'
                  const labelColor = ALWAYS_DONE_SECTIONS.has(sec.id) ? '#1D4ED8' : (st === 'done' ? G.ok : (st === 'mid' ? G.bad : G.mu))
                  return (
                    <div key={cellKey} style={{ display: 'grid', gridTemplateColumns: '104px 1fr', gap: 8, alignItems: editable ? 'start' : 'center' }}>
                      <div style={{ fontSize: 13.97, paddingTop: editable ? 7 : 0, lineHeight: 1.3 }}>
                        {/* label kr/cn (done = green, no ✅; mid = red blink) */}
                        <span className={st === 'mid' ? 'iku-blink' : undefined} style={{ color: labelColor, fontWeight: st === 'none' ? 400 : 600 }}>
                          {f.kr}<br />
                          <span style={{ color: st === 'none' ? G.fa : labelColor, fontSize: 12.7 }}>{f.cn}</span>
                        </span>
                      </div>
                      <CellEditor G={G} field={f} cell={cell} editable={editable} allowStock={allowStock} alwaysDone={ALWAYS_DONE_SECTIONS.has(sec.id)} isBlue={ALWAYS_DONE_SECTIONS.has(sec.id)} onChange={(val) => setCell(cellKey, val)} />
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
                  <SectionIndicator G={G} status={status} isProduction={ALWAYS_DONE_SECTIONS.has(sec.id)} productionValue={cells[`${sec.id}.in_production`]?.v || ''} />
                  <SectionToggle G={G} collapsed={false} onToggle={() => toggleSection(sec.id)} isProduction={ALWAYS_DONE_SECTIONS.has(sec.id)} />
                </div>
              </div>
              </div>
              </div>
            </div>
          )
        })}

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
  // ① 오더완료 일괄저장: 변경 draft { [itemNo]: { cells?, remark?, fabric? } } + 상태
  const [orderDrafts, setOrderDrafts] = useState({})
  const [orderSaving, setOrderSaving] = useState(false)
  const [orderExitConfirm, setOrderExitConfirm] = useState(false)
  const [styleSaving, setStyleSaving] = useState(false)
  const [styleExitConfirm, setStyleExitConfirm] = useState(false)
  const [editorName, setEditorName] = useState('')
  const [editorError, setEditorError] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [toast, setToast] = useState(null)
  const [zoomSrc, setZoomSrc] = useState(null)  // image lightbox
  const [selectedMo, setSelectedMo] = useState(null)  // MO 상세 모달 { id, row }
  const [selectedStyle, setSelectedStyle] = useState(null)  // 미오더 Style 상세 모달
  const [authorErrorItems, setAuthorErrorItems] = useState(new Set())
  const editorRef = useRef(null)
  const fabricDiagRef = useRef(false)

  // Section collapse — owned here so the print feature can read expanded sections.
  // Shape: { [itemNo]: { [secId]: bool } }. Default (absent) = collapsed (item ②).
  const [collapsedByItem, setCollapsedByItem] = useState({})
  // 'remark'(현 상황 비고)은 기본 펼침, 나머지 섹션은 기본 접힘
  const defaultCollapsed = (secId) => secId !== 'remark'
  const sectionCollapsed = useCallback((itemNo, secId) => {
    const m = collapsedByItem[itemNo]
    return m && secId in m ? m[secId] : defaultCollapsed(secId)
  }, [collapsedByItem])
  const toggleCardSection = useCallback((itemNo, secId) => {
    setCollapsedByItem(prev => {
      const cur = prev[itemNo] || {}
      const curVal = secId in cur ? cur[secId] : defaultCollapsed(secId)
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

  // ── C안 통합 필터: 구분 分类 ('all' 전체 | 'ordered' 오더완료 | 'unordered' 미오더) ──
  const [gubun, setGubun] = useState('all')
  const [styleTab, setStyleTab] = useState(null)   // { type:'month'|'season', value } — 시즌·월 행

  // 미오더(Style) 데이터 + 메타(공장/비고/숨김)
  const [styleList, setStyleList] = useState([])
  const [styleLoading, setStyleLoading] = useState(true)
  const [styleErr, setStyleErr] = useState(null)
  const [styleMeta, setStyleMeta] = useState({ factory: {}, note: {}, hidden: [] })

  // ⑥ MO 원단명 오버라이드 (key fabric:{MO_ID}) — KV값 우선
  const [moFabric, setMoFabric] = useState({})

  // 미오더 섹션 통합 수정 모드 + draft (오더예정공장/비고)
  const [styleEditMode, setStyleEditMode] = useState(false)
  const [styleDrafts, setStyleDrafts] = useState({})   // { [sku]: { factory?, note? } }

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
    // ① 순서: 시즌 → 월별 (전체 버튼은 렌더에서 앞에 별도 배치)
    return [...mk(seasons, 'season'), ...mk(months, 'month')]
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
    if (editMode) return   // 편집 종료는 별도 버튼(편집 종료 退出编辑)에서 처리
    setPwOpen(true)
  }
  const onPwSuccess = (pw) => {
    setPassword(pw); setPwOpen(false); setEditMode(true); setOrderDrafts({})
    showToast('편집 모드 · 编辑模式', 'ok')
  }
  const onOrderDraft = useCallback((itemNo, partial) => {
    setOrderDrafts(d => ({ ...d, [itemNo]: { ...d[itemNo], ...partial } }))
  }, [])
  const orderDirty = Object.keys(orderDrafts).length > 0
  const exitOrderEdit = () => { setEditMode(false); setOrderDrafts({}); setOrderExitConfirm(false); setPassword(''); setEditorError(false) }

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

  // ① 오더완료 일괄저장 — 변경된 모든 카드(공정/비고/원단명) 한꺼번에 KV 저장, 편집모드 유지
  const batchSaveOrders = useCallback(async () => {
    if (!requireEditor()) return
    // 현황 메모가 있는데 작성자가 없으면 저장 전 경고
    const missingAuthor = new Set()
    for (const [itemNo, d] of Object.entries(orderDrafts)) {
      if (d.remark !== undefined && d.remark.trim()) {
        const rec = proc.items[itemNo] || {}
        const effectiveAuthor = d.remarkAuthor !== undefined ? d.remarkAuthor : (rec.remarkAuthor || '')
        if (!effectiveAuthor.trim()) missingAuthor.add(itemNo)
      }
    }
    if (missingAuthor.size > 0) {
      setAuthorErrorItems(missingAuthor)
      showToast('작성자를 입력하세요 · 请输入修改人姓名', 'bad')
      return
    }
    setAuthorErrorItems(new Set())
    setOrderSaving(true)
    let ok = true
    try {
      for (const [itemNo, d] of Object.entries(orderDrafts)) {
        const rec = proc.items[itemNo] || {}
        if (d.cells !== undefined || d.remark !== undefined || d.remarkAuthor !== undefined) {
          const cellsSrc = d.cells !== undefined ? d.cells : (rec.cells || {})
          const cleaned = {}
          for (const [k, val] of Object.entries(cellsSrc)) if (val && (val.v || val.d || val.h)) cleaned[k] = val
          const remarkVal = d.remark !== undefined ? d.remark : (rec.remark || '')
          const remarkAuthorVal = d.remarkAuthor !== undefined ? d.remarkAuthor : (rec.remarkAuthor || '')
          try {
            const res = await saveProcessItem({ password, editorName: editorName.trim(), itemNo, cells: cleaned, remark: remarkVal, remarkAuthor: remarkAuthorVal })
            if (res?.ok) setProc(p => ({ ...p, items: { ...p.items, [itemNo]: res.record }, lastUpdated: res.record.lastUpdated, lastUpdatedBy: res.record.lastUpdatedBy }))
            else ok = false
          } catch { ok = false }
        }
        if (d.fabric !== undefined) {
          const v = d.fabric.trim()
          setMoFabric(prev => { const n = { ...prev }; if (v) n[itemNo] = v; else delete n[itemNo]; return n })
          try { const r = await saveMoFabric(itemNo, v); if (!r?.ok) ok = false } catch { ok = false }
        }
      }
    } catch { ok = false }
    setOrderSaving(false)
    if (ok) { setOrderDrafts({}); showToast('일괄저장 완료 · 批量保存成功', 'ok') }
    else showToast('저장 실패 · 保存失败, 다시 시도해주세요', 'bad')
    return ok
  }, [orderDrafts, proc.items, password, editorName, requireEditor, showToast])

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
    setGubun('all'); setCategory('all'); setSubFactory(''); setSearch(''); setFactorySel([]); setMonth(''); setProcFilter(''); setStyleTab(null)
  }
  // 구분 변경 시 하위 행(공장·시즌/월) 선택값 초기화
  const changeGubun = (g) => { setGubun(g); setCategory('all'); setSubFactory(''); setStyleTab(null) }
  // 행 표시 조건 + 카드 목록 표시 조건
  const showOrdered = gubun !== 'unordered'      // 전체·오더완료
  const showUnordered = gubun !== 'ordered'      // 전체·미오더

  // ── 미오더 섹션 통합 수정 모드 (비밀번호 불필요) ──
  const onChangeStyleFactory = useCallback((sku, value) => {
    setStyleDrafts(prev => ({ ...prev, [sku]: { ...prev[sku], factory: value } }))
  }, [])
  const onChangeStyleNote = useCallback((sku, value) => {
    setStyleDrafts(prev => ({ ...prev, [sku]: { ...prev[sku], note: value } }))
  }, [])
  const styleDirty = Object.keys(styleDrafts).length > 0
  const exitStyleEdit = () => { setStyleEditMode(false); setStyleDrafts({}); setStyleExitConfirm(false) }
  // ① 미오더 일괄저장 — 편집모드 유지, 스피너
  const saveStyleEdit = useCallback(async () => {
    const drafts = styleDrafts
    const tasks = []
    const nextFactory = { ...styleMeta.factory }
    const nextNote = { ...styleMeta.note }
    for (const [sku, d] of Object.entries(drafts)) {
      if (d.factory !== undefined && d.factory.trim() !== (styleMeta.factory[sku] || '')) {
        const v = d.factory.trim(); nextFactory[sku] = v; tasks.push(saveStyleFactory(sku, v))
      }
      if (d.note !== undefined && d.note.trim() !== (styleMeta.note[sku] || '')) {
        const v = d.note.trim(); nextNote[sku] = v; tasks.push(saveStyleNote(sku, v))
      }
    }
    setStyleMeta(prev => ({ ...prev, factory: nextFactory, note: nextNote }))
    if (!tasks.length) { setStyleDrafts({}); showToast('변경 없음 · 无更改', 'ok'); return true }
    setStyleSaving(true)
    try {
      const rs = await Promise.all(tasks)
      const ok = rs.every(r => r?.ok)
      setStyleSaving(false); setStyleDrafts({})   // 편집 모드 유지
      showToast(ok ? '일괄저장 완료 · 批量保存成功' : '저장 실패 · 保存失败, 다시 시도해주세요', ok ? 'ok' : 'bad')
      return ok
    } catch {
      setStyleSaving(false); showToast('저장 실패 · 保存失败, 다시 시도해주세요', 'bad'); return false
    }
  }, [styleDrafts, styleMeta, showToast])
  const onConvertStyle = useCallback((sku) => {
    setStyleMeta(prev => ({ ...prev, hidden: [...new Set([...(prev.hidden || []), sku])] }))
    hideStyle(sku)
      .then(r => showToast(r?.ok ? '오더 전환됨 · 已转为下单' : '실패 · 失败', r?.ok ? 'ok' : 'bad'))
      .catch(() => showToast('실패 · 失败', 'bad'))
  }, [showToast])

  // 미오더 프린트 — 오더완료와 동일한 A4 카드 레이아웃으로 출력
  const doStylePrint = useCallback(() => {
    if (!visibleStyles.length) { showToast('표시할 스타일이 없습니다 · 无款式', 'bad'); return }
    let win
    try { win = window.open('', '_blank') } catch { win = null }
    if (!win) { showToast('팝업이 차단되었습니다 · 弹窗被拦截', 'bad'); return }
    const html = buildStylePrintHTML({ styles: visibleStyles, meta: styleMeta, origin: window.location.origin, now: new Date() })
    win.document.open(); win.document.write(html); win.document.close()
  }, [visibleStyles, styleMeta, showToast])

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

  // 페이지 한정 버튼/칩 스케일·테두리 강화 (10%) — .proc-page 스코프
  const strongBorder = G.dk ? '#4A453E' : '#D9D0BE'
  const pageBtnCss = `
.proc-page .chip{padding:7.7px 15.4px!important;font-size:12.1px!important;min-height:35px!important}
.proc-page .chip .num{font-size:11px!important}
.proc-page .btn-ghost{border-color:${strongBorder}}
`

  return (
    <div className="proc-page" style={{ animation: 'fadeIn 0.4s ease' }}>
      <style>{PAGE_CSS}</style>
      <style>{pageBtnCss}</style>

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
        {/* ④ 헤더 우측: 최근 수정 정보만 (수정·프린트 버튼은 카드 목록 위로 이동) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {proc.lastUpdated && (
            <div style={{ fontSize: 10.5, color: G.mu, textAlign: 'right' }}>
              최근 수정 · 最近修改<br /><span className="num" style={{ color: G.tx }}>{fmtTime(proc.lastUpdated)}</span>{proc.lastUpdatedBy ? ` · ${proc.lastUpdatedBy}` : ''}
            </div>
          )}
        </div>
      </div>

      {/* ── C안 통합 필터 패널 (구분 / 공장 / 시즌·월) ── */}
      <div style={{ position: 'relative', border: `1px solid ${G.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 14, background: G.card }}>
        {/* 우측 상단 총계 (구분에 따라 텍스트 변경) */}
        <div style={{ position: 'absolute', top: 12, right: 16, fontSize: 11, color: G.mu, textAlign: 'right' }}>
          {gubun === 'ordered' ? (
            <>총 <b style={{ color: G.tx }}>{catCounts.all}</b>개 오더 · 共{catCounts.all}个订单</>
          ) : gubun === 'unordered' ? (
            <>총 <b style={{ color: G.tx }}>{unorderedStyles.length}</b>개 스타일 · 共{unorderedStyles.length}个款式</>
          ) : (
            <>총 <b style={{ color: G.tx }}>{catCounts.all}</b>개 오더 · <b style={{ color: G.tx }}>{unorderedStyles.length}</b>개 스타일 · 共{catCounts.all}个订单·{unorderedStyles.length}个款式</>
          )}
        </div>

        {/* 행 1 — 구분 分类 (항상 표시) */}
        <FilterRow G={G} label="구분 分类">
          <PanelChip G={G} on={gubun === 'all'} onClick={() => changeGubun('all')} label="전체" cn="全部" count={catCounts.all + unorderedStyles.length} />
          <PanelChip G={G} on={gubun === 'ordered'} onClick={() => changeGubun('ordered')} label="오더완료" cn="已下单" count={catCounts.all} tone="ok" />
          <PanelChip G={G} on={gubun === 'unordered'} onClick={() => changeGubun('unordered')} label="미오더" cn="未下单" count={unorderedStyles.length} />
        </FilterRow>

        {/* 행 2 — 공장 工厂 (구분=전체·오더완료 시 표시) */}
        <CollapseRow show={showOrdered}>
          <PanelDivider G={G} />
          <FilterRow G={G} label="공장 工厂">
            <PanelChip G={G} on={category === 'all'} onClick={() => { setCategory('all'); setSubFactory('') }} label="전체" cn="全部" count={catCounts.all} />
            <PanelChip G={G} on={category === 'hexiang'} onClick={() => { setCategory('hexiang'); setSubFactory('') }} label="HEXIANG" cn="合祥" count={catCounts.hx} />
            <PanelChip G={G} on={category === 'outsource'} onClick={() => setCategory('outsource')} label="외주공장" cn="外发工厂" count={catCounts.out} />
          </FilterRow>
        </CollapseRow>

        {/* 행 3 — 시즌·월 季节·月份 (구분=전체·미오더 시 표시) */}
        <CollapseRow show={showUnordered}>
          <PanelDivider G={G} />
          <FilterRow G={G} label="시즌·월 季节">
            <PanelChip G={G} on={!styleTab} onClick={() => setStyleTab(null)} label="전체" cn="全部" count={unorderedStyles.length} />
            {styleLoading ? (
              <span style={{ fontSize: 11, color: G.fa }}>불러오는 중 · 加载中…</span>
            ) : unorderedTabs.length === 0 ? (
              <span style={{ fontSize: 11, color: G.fa }}>미오더 항목 없음 · 暂无未下单</span>
            ) : unorderedTabs.map(t => (
              <PanelChip key={`${t.type}:${t.value}`}
                G={G} on={!!styleTab && styleTab.type === t.type && styleTab.value === t.value}
                onClick={() => setStyleTab({ type: t.type, value: t.value })}
                label={t.type === 'season' ? `${t.label} 시즌` : t.label} cn="" count={t.count} />
            ))}
          </FilterRow>
        </CollapseRow>
      </div>

      {showOrdered && (
      <>
      {gubun === 'all' && (
        <div style={{ fontSize: 12, fontWeight: 700, color: G.accent, margin: '4px 0 10px' }}>오더완료 · 下单完成</div>
      )}
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
          <button onClick={resetFilters} style={{ fontSize: 11.55, color: G.accent, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>전체 초기화 · 重置</button>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 16, padding: 14, borderRadius: 10, fontSize: 13, color: G.bad, background: `${G.bad}1A`, border: `1px solid ${G.bad}40` }}>
          <strong>오류 · 错误:</strong> {error}
        </div>
      )}

      {/* HEXIANG 工人情况 위젯 — 전체/HEXIANG 탭에서 표시, 외주공장 탭에서만 숨김 (DOM 유지) */}
      <HexiangFactoryWidget G={G} visible={category !== 'outsource'} />

      {/* ① 카드 목록 위 우측: 수정 / (수정 모드) 일괄저장 + 편집 종료 + 프린트 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, color: G.mu, marginRight: 'auto' }}>
          {loading ? '불러오는 중 · 加载中…' : `${visible.length}개 오더 · ${visible.length} 个订单`}
        </div>
        {editMode ? (
          <>
            {/* ③ 수정자 입력칸 — 일괄저장 버튼 왼쪽 (상단 편집바에서 이동) */}
            <input
              ref={editorRef}
              value={editorName}
              onChange={e => { setEditorName(e.target.value); if (editorError) setEditorError(false) }}
              onAnimationEnd={() => setShaking(false)}
              placeholder="수정자 이름 · 修改人姓名"
              style={{ ...inputStyle, minHeight: 40, padding: '8px 13px', width: 180, fontSize: 13.2, border: `1px solid ${editorError ? G.bad : G.border}`, animation: shaking ? 'ikuShake .4s ease' : undefined }}
            />
            <button onClick={batchSaveOrders} disabled={orderSaving} className="btn-primary"
              style={{ minHeight: 40, padding: '8px 15px', fontSize: 13.2, display: 'flex', alignItems: 'center', gap: 6, opacity: orderSaving ? 0.6 : 1 }}>
              {orderSaving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />} 일괄저장 批量保存
            </button>
            <button onClick={() => { if (orderDirty) setOrderExitConfirm(true); else exitOrderEdit() }} className="btn-ghost"
              style={{ minHeight: 40, padding: '8px 15px', fontSize: 13.2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <X size={14} /> 편집 종료 退出编辑
            </button>
          </>
        ) : (
          <>
            <button onClick={onEditClick} disabled={styleEditMode} title={styleEditMode ? '미오더 수정 중 · 未下单编辑中' : ''} className="btn-ghost"
              style={{ minHeight: 40, padding: '8px 15px', fontSize: 13.2, display: 'flex', alignItems: 'center', gap: 6, opacity: styleEditMode ? 0.5 : 1 }}>
              <Pencil size={14} /> 수정 修改
            </button>
            <button onClick={enterPrintMode} disabled={loading || procLoading || visible.length === 0} className="btn-ghost"
              style={{ minHeight: 40, padding: '8px 15px', fontSize: 13.2, display: 'flex', alignItems: 'center', gap: 6, opacity: (loading || procLoading || visible.length === 0) ? 0.5 : 1 }}>
              🖨 프린트 打印
            </button>
          </>
        )}
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
              onZoom={setZoomSrc}
              showToast={showToast}
              collapsedFor={(secId) => sectionCollapsed(itemNoOf(mo), secId)}
              onToggleSection={(secId) => toggleCardSection(itemNoOf(mo), secId)}
              printMode={printMode}
              checked={selectedToPrint.has(itemNoOf(mo))}
              onToggleChecked={() => togglePrintChecked(itemNoOf(mo))}
              fabricKv={moFabric[itemNoOf(mo)] || ''}
              draft={orderDrafts[itemNoOf(mo)]}
              onDraft={onOrderDraft}
              onDelete={handleDeleteMo}
              onOpenDetail={() => setSelectedMo({ id: itemNoOf(mo), row: mo })}
              authorError={authorErrorItems.has(itemNoOf(mo))}
            />
          ))}
        </div>
      )}
      </>
      )}

      {showUnordered && (
      <>
        {/* ── 미오더 섹션 (Style) ── */}
        {/* ① 전체 모드: 오더완료 ↔ 미오더 간격 80px + 40px 지점 구분선, ② 제목 2배 확대 + 빨간 배지 */}
        {gubun === 'all' && (
          <div style={{ marginTop: 80, position: 'relative' }}>
            <div style={{ position: 'absolute', top: -40, left: 0, right: 0, height: 1, background: G.hair }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#A32D2D', background: '#FCEBEB', border: '1px solid #E24B4A', padding: '3px 12px', borderRadius: 999 }}>미오더 未下单</span>
              <span style={{ fontSize: 24, fontWeight: 500, color: G.tx }}>미오더 · 未下单</span>
            </div>
          </div>
        )}
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

        {/* ① 미오더 카드 목록 위 우측: 수정/저장/취소 + 프린트 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, color: G.mu, marginRight: 'auto' }}>
            {styleLoading ? '불러오는 중 · 加载中…' : `${visibleStyles.length}개 스타일 · ${visibleStyles.length} 个款式`}
          </div>
          {styleEditMode ? (
            <>
              <button onClick={saveStyleEdit} disabled={styleSaving} className="btn-primary" style={{ minHeight: 40, padding: '8px 15px', fontSize: 13.2, display: 'flex', alignItems: 'center', gap: 6, opacity: styleSaving ? 0.6 : 1 }}>
                {styleSaving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />} 일괄저장 批量保存
              </button>
              <button onClick={() => { if (styleDirty) setStyleExitConfirm(true); else exitStyleEdit() }} className="btn-ghost" style={{ minHeight: 40, padding: '8px 15px', fontSize: 13.2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <X size={14} /> 편집 종료 退出编辑
              </button>
            </>
          ) : (
            <button onClick={() => { setStyleDrafts({}); setStyleEditMode(true) }} disabled={editMode} title={editMode ? '오더완료 수정 중 · 下单完成编辑中' : ''} className="btn-ghost" style={{ minHeight: 40, padding: '8px 15px', fontSize: 13.2, display: 'flex', alignItems: 'center', gap: 6, opacity: editMode ? 0.5 : 1 }}>
              <Pencil size={14} /> 수정 修改
            </button>
          )}
          {!styleEditMode && (
            <button onClick={doStylePrint} disabled={styleLoading || visibleStyles.length === 0} className="btn-ghost"
              style={{ minHeight: 40, padding: '8px 15px', fontSize: 13.2, display: 'flex', alignItems: 'center', gap: 6, opacity: (styleLoading || visibleStyles.length === 0) ? 0.5 : 1 }}>
              🖨 프린트 打印
            </button>
          )}
        </div>

        {styleLoading ? (
          <div className="mio-grid">{[...Array(10)].map((_, i) => <SkeletonCard key={i} G={G} />)}</div>
        ) : styleErr ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: G.mu }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: G.bad }}>데이터를 불러올 수 없습니다 · 无法加载数据</div>
            <div style={{ fontSize: 11, color: G.fa, marginTop: 4, marginBottom: 14 }}>{styleErr}</div>
            <button onClick={loadStyles} className="btn-primary" style={{ minHeight: 42, padding: '9px 20px', fontSize: 13.2 }}>재시도 · 重试</button>
          </div>
        ) : visibleStyles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: G.mu }}>
            <ClipboardCheck size={40} style={{ color: G.fa, marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>표시할 스타일이 없습니다 · 没有可显示的款式</div>
            <div style={{ fontSize: 12, color: G.fa, marginTop: 4 }}>위 미오더 탭을 선택하거나 검색해 보세요 · 请选择未下单标签或搜索</div>
          </div>
        ) : (
          <div className="mio-grid">
            {visibleStyles.map(st => {
              const sk = styleKey(st)
              return (
                <UnorderedStyleCard
                  key={sk} G={G} style={st}
                  factory={styleMeta.factory[sk] || ''}
                  note={styleMeta.note[sk] || ''}
                  editMode={styleEditMode}
                  draftFactory={styleDrafts[sk]?.factory}
                  draftNote={styleDrafts[sk]?.note}
                  onChangeFactory={onChangeStyleFactory}
                  onChangeNote={onChangeStyleNote}
                  onZoom={setZoomSrc}
                  onConvert={onConvertStyle}
                  onDelete={handleDeleteStyle}
                  onOpenDetail={(st) => setSelectedStyle(st)}
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
          <button onClick={doPrint} className="btn-primary" style={{ minHeight: 44, padding: '9px 20px', fontSize: 14.3, display: 'flex', alignItems: 'center', gap: 6 }}>🖨 프린트하기 打印</button>
          <button onClick={() => setPrintMode(false)} className="btn-ghost" style={{ minHeight: 44, padding: '9px 20px', fontSize: 14.3 }}>취소 取消</button>
        </div>
      )}

      {pwOpen && <PwModal G={G} onClose={() => setPwOpen(false)} onSuccess={onPwSuccess} />}
      {zoomSrc && <Lightbox src={zoomSrc} onClose={() => setZoomSrc(null)} />}
      {/* MO 상세 모달 (MO View 와 동일) */}
      {selectedMo && <MoDetailModal G={G} mo={selectedMo.row} moId={selectedMo.id} onClose={() => setSelectedMo(null)} />}
      {/* ⑥ 미오더 Style 상세 모달 (Style 탭과 동일 컴포넌트) */}
      {selectedStyle && <StyleDetailModal G={G} rec={selectedStyle} onClose={() => setSelectedStyle(null)} onZoom={setZoomSrc} />}

      {/* ① 편집 종료 — 미저장 변경 확인 모달 (오더완료) */}
      {orderExitConfirm && (
        <div onClick={e => { if (e.target === e.currentTarget) setOrderExitConfirm(false) }}
          style={{ position: 'fixed', inset: 0, background: G.overlayBg, zIndex: 2600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 20, boxShadow: G.cardShadow, maxWidth: 360, textAlign: 'center' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: G.tx, marginBottom: 6 }}>저장하지 않은 변경사항이 있습니다. 종료하시겠습니까?</div>
            <div style={{ fontSize: 11.5, color: G.mu, marginBottom: 16 }}>有未保存的更改，确认退出？</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={async () => { const ok = await batchSaveOrders(); if (ok) exitOrderEdit() }} className="btn-primary" style={{ minHeight: 37, padding: '8px 13px', fontSize: 12.65 }}>일괄저장 후 종료 · 保存并退出</button>
              <button onClick={exitOrderEdit} className="btn-ghost" style={{ minHeight: 37, padding: '8px 13px', fontSize: 12.65, color: G.bad, borderColor: G.bad }}>저장 없이 종료 · 直接退出</button>
              <button onClick={() => setOrderExitConfirm(false)} className="btn-ghost" style={{ minHeight: 37, padding: '8px 13px', fontSize: 12.65 }}>취소 · 取消</button>
            </div>
          </div>
        </div>
      )}
      {/* ① 편집 종료 — 미저장 변경 확인 모달 (미오더) */}
      {styleExitConfirm && (
        <div onClick={e => { if (e.target === e.currentTarget) setStyleExitConfirm(false) }}
          style={{ position: 'fixed', inset: 0, background: G.overlayBg, zIndex: 2600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 20, boxShadow: G.cardShadow, maxWidth: 360, textAlign: 'center' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: G.tx, marginBottom: 6 }}>저장하지 않은 변경사항이 있습니다. 종료하시겠습니까?</div>
            <div style={{ fontSize: 11.5, color: G.mu, marginBottom: 16 }}>有未保存的更改，确认退出？</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={async () => { const ok = await saveStyleEdit(); if (ok) exitStyleEdit() }} className="btn-primary" style={{ minHeight: 37, padding: '8px 13px', fontSize: 12.65 }}>일괄저장 후 종료 · 保存并退出</button>
              <button onClick={exitStyleEdit} className="btn-ghost" style={{ minHeight: 37, padding: '8px 13px', fontSize: 12.65, color: G.bad, borderColor: G.bad }}>저장 없이 종료 · 直接退出</button>
              <button onClick={() => setStyleExitConfirm(false)} className="btn-ghost" style={{ minHeight: 37, padding: '8px 13px', fontSize: 12.65 }}>취소 · 取消</button>
            </div>
          </div>
        </div>
      )}
      <Toast toast={toast} G={G} />
    </div>
  )
}
