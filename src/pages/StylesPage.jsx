import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Shirt, Search, RotateCcw, RefreshCw, X, ChevronDown } from 'lucide-react'
import { fetchStyleList, fetchMoList } from '../api/client'
import ZohoImage from '../components/ZohoImage'
import StyleDetailModal from '../components/StyleDetailModal'
import {
  F, pick, recId, imageField, styleImageUrl,
  monthOf, monthLabel, seasonOf, statusInfo,
} from '../utils/styleFields'
import { getMoSku } from '../utils/moHelpers'

// ──────────────────────────────────────────────────────────
// Style / Sample 管理 — All_Styles 리포트 목록
// 필드 매핑/헬퍼는 ../utils/styleFields 공유. 검색/필터는 클라이언트 사이드.
//   ※ 스타일이 수백 개 이상으로 늘면 서버사이드 필터(criteria)로 전환 권장.
// ──────────────────────────────────────────────────────────

// 10열 카드 배치 (좁은 화면에서 점진 축소) + In Progress 깜빡임
const PAGE_CSS = `
.sty-grid{display:grid;gap:10px;align-items:start;grid-template-columns:repeat(10,minmax(0,1fr))}
@media(max-width:1500px){.sty-grid{grid-template-columns:repeat(8,minmax(0,1fr))}}
@media(max-width:1200px){.sty-grid{grid-template-columns:repeat(6,minmax(0,1fr))}}
@media(max-width:900px){.sty-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:560px){.sty-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@keyframes styBlink{0%,100%{opacity:1}50%{opacity:.25}}
.sty-blink{animation:styBlink 1.6s ease-in-out infinite}
`

// 상태값 색상/깜빡임은 ../utils/styleFields 의 statusInfo 공용 사용
// (Active/Approved=초록 · In Progress/Sampling=빨강+깜빡 · 그외=뮤트)

// Zoho Creator v2.1(이 계정)에서 max_records 가 200 미만이면 HTTP 400(빈 결과)을
// 반환하는 특성이 있어, 앱 전역(mo-list 등)과 동일하게 200 으로 고정한다.
const PAGE_SIZE = 200

// 필터 드롭다운 (모듈 레벨 — 렌더 중 컴포넌트 생성 방지)
function FilterSelect({ G, value, onChange, ph, list }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, border: `1px solid ${G.border}`, background: G.card, color: G.tx, outline: 'none', fontFamily: 'inherit' }}>
      <option value="">{ph}</option>
      {list.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// ──────────────────────────────────────────────────────────
// 그룹 정의 (순서 고정: 오더완료 → 샘플 완료 → 샘플 제작 중) + 색상 팔레트
// ──────────────────────────────────────────────────────────
const STY_GROUPS = [
  { key: 'ordered',  headKr: '오더완료',     headCn: '已下单', badgeKr: '오더완료', badgeCn: '已下单', line: '#97C459', badgeBg: '#EAF3DE', text: '#3B6D11', cardBorder: '#C0DD97' },
  { key: 'done',     headKr: '샘플 완료',     headCn: '已完成', badgeKr: '샘플 완료', badgeCn: '已完成', line: '#378ADD', badgeBg: '#E6F1FB', text: '#185FA5', cardBorder: '#B5D4F4' },
  { key: 'progress', headKr: '샘플 제작 중',  headCn: '打样中', badgeKr: '제작 중',  badgeCn: '打样中', line: '#EF9F27', badgeBg: '#FAEEDA', text: '#854F0B', cardBorder: '#FAC775' },
]
const STY_GROUP_MAP = Object.fromEntries(STY_GROUPS.map(g => [g.key, g]))

// 샘플 상태 분류: 'done'(승인/완료) | 'progress'(제작중/진행) | 'other'
function sampleStatusClass(val) {
  const s = String(val || '').toLowerCase()
  if (/approved|승인|已批准|complete|完成|完了|已完成|done|확정|통과|批准/.test(s)) return 'done'
  if (/in.?progress|进行|sampling|제작\s*중|제작중|진행|打样中|打样|开发/.test(s)) return 'progress'
  return 'other'
}
// 레코드의 분류 그룹 키 (오더완료 우선)
function groupKeyOf(rec, ordered, pickFn, sampleKeys) {
  if (ordered) return 'ordered'
  return sampleStatusClass(pickFn(rec, sampleKeys)) === 'done' ? 'done' : 'progress'
}

// 칩 색조 팔레트 (활성 시 색상, 비활성 시 기본)
function chipTone(G, tone) {
  const gold = { bg: G.dk ? 'rgba(232,200,152,0.12)' : 'rgba(201,168,110,0.12)', border: G.primary, color: G.accent }
  switch (tone) {
    case 'orange': return { bg: '#FAEEDA', border: '#EF9F27', color: '#854F0B' }
    case 'blue':   return { bg: '#E6F1FB', border: '#378ADD', color: '#185FA5' }
    case 'green':  return { bg: '#EAF3DE', border: '#97C459', color: '#3B6D11' }
    case 'red':    return { bg: '#FCEBEB', border: '#E24B4A', color: '#A32D2D' }
    default:       return gold
  }
}

// B안 필터 칩 — 활성 시 tone 색상, 비활성 시 기본
function FilterChip({ G, on, tone, label, count, onClick }) {
  const c = on ? chipTone(G, tone) : { bg: 'transparent', border: G.border, color: G.mu }
  return (
    <button onClick={onClick} className="chip"
      style={{ border: `1px solid ${c.border}`, background: c.bg, color: c.color, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5 }}>
      {label}
      <span className="num" style={{ fontSize: 9, padding: '1px 5px', borderRadius: 999, background: on ? c.border : G.hair, color: on ? '#fff' : G.mu }}>{count}</span>
    </button>
  )
}

// B안 필터 행 — 라벨 고정폭(120px) + 세로 구분선 → 모든 행의 칩 시작 x좌표 통일
function PanelRow({ G, label, divider, children }) {
  return (
    <>
      {divider && <div style={{ height: 1, background: G.hair }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 0' }}>
        <span style={{ width: 120, flexShrink: 0, fontSize: 11, fontWeight: 600, color: G.mu }}>{label}</span>
        <span style={{ width: 1, height: 20, background: G.hair, flexShrink: 0, marginRight: 4 }} />
        {children}
      </div>
    </>
  )
}

// 그룹 헤더 — 좌: 배지 / 중: 가로선 / 우: 개수
function GroupHeader({ g, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 10px' }}>
      <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: g.text, background: g.badgeBg, border: `1px solid ${g.line}`, padding: '3px 12px', borderRadius: 999 }}>{g.headKr} · {g.headCn}</span>
      <div style={{ flex: 1, height: 1, background: g.line, opacity: 0.5 }} />
      <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: g.text }}>{count}개 · {count}个</span>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// 이미지 라이트박스 (MO View 패턴 재사용)
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
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <button onClick={onClose} aria-label="close"
        style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <X size={20} />
      </button>
      {!loaded && !err && <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', animation: 'spin 1s linear infinite' }} />}
      {err ? (
        <div style={{ color: '#fff', fontSize: 14 }}>이미지를 불러올 수 없습니다 · 无法加载图片</div>
      ) : (
        <img src={src} alt="style" onLoad={() => setLoaded(true)} onError={() => setErr(true)} onClick={e => e.stopPropagation()}
          style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', display: loaded ? 'block' : 'none', borderRadius: 8, boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }} />
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// 스타일 카드
// ──────────────────────────────────────────────────────────
function StyleCard({ G, rec, group, onOpen, onZoom }) {
  const sku = pick(rec, F.sku)
  const chi = pick(rec, F.chi)
  const brand = pick(rec, F.brand)
  const gender = pick(rec, F.gender)
  const category = pick(rec, F.category)
  const fabric = pick(rec, F.fabric)
  const sampleSt = pick(rec, F.sampleStatus)   // 승인 상태 (Approved / In Progress …)
  const styleSt = pick(rec, F.styleStatus)     // 샘플 상태 (Sampling / Active …)
  // group: 분류 그룹(오더완료/샘플완료/샘플제작중) — 카드 테두리색·하단 배지색 결정
  const imgUrl = styleImageUrl(rec)

  const sampleInfo = statusInfo(G, styleSt)    // 샘플 상태 색/깜빡
  const approvalInfo = statusInfo(G, sampleSt) // 승인 상태 색/깜빡
  const skuRed = (sampleInfo?.blink || approvalInfo?.blink)   // 제작중이면 SKU 빨강

  // ④ 미오더 카드와 동일 레이아웃: 항목명(뮤트) : 값(기본)
  const row = (kr, cn, val) => (
    <div style={{ fontSize: 9.5, lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      <span style={{ color: G.fa }}>{kr} {cn}: </span>
      <span style={{ color: val ? G.tx : G.fa, fontWeight: val ? 600 : 400 }}>{val || ''}</span>
    </div>
  )
  // 상태: 라벨 줄 + 값 줄(② 1줄 nowrap+ellipsis+tooltip, 상태색/깜빡, 빈값 빈칸)
  const statusBlock = (kr, cn, val, info) => (
    <div style={{ marginTop: 2 }}>
      <div style={{ fontSize: 9, color: G.fa, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{kr} {cn}</div>
      <div className={info?.blink ? 'sty-blink' : undefined} title={val || ''}
        style={{ fontSize: 9.2, color: info?.color || G.tx, fontWeight: info ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.35 }}>{val || ''}</div>
    </div>
  )

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer', border: `1px solid ${group.cardBorder}` }}
      onClick={() => onOpen(rec)}>
      {/* 이미지 — 오버레이 없음, 고정 높이, cover, 클릭 시 라이트박스 */}
      <div style={{ width: '100%', height: 185, background: G.cardAlt }}
        onClick={(e) => { if (imgUrl) { e.stopPropagation(); onZoom(imgUrl) } }}>
        <ZohoImage mo={rec} field={imageField(rec) || 'Style_Image'} G={G} alt={sku} placeholderText="" iconSize={22} />
      </div>

      {/* ④ 텍스트 영역 — 미오더 카드와 동일 구조 */}
      <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2.5, flex: 1 }}>
        {/* 1. SKU */}
        <div className="syne" style={{ fontSize: 11, fontWeight: 700, color: skuRed ? G.bad : G.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sku || '—'}</div>
        {/* 2~4. 항목명:값 */}
        {row('아이템명', '货号', chi)}
        {row('브랜드', '品牌', brand)}
        {row('성별', '性别', gender)}
        {row('분류', '分类', category)}
        {row('원단', '面料', fabric)}
        {/* 5. 샘플 상태 (통합 1줄 — 승인 상태 값 표시) */}
        {statusBlock('샘플 상태', '打样状态', sampleSt, approvalInfo)}
        {/* 9. 그룹 배지 (중앙) — 오더완료 已下单 / 샘플 완료 已完成 / 제작 중 打样中 */}
        <div style={{ marginTop: 'auto', paddingTop: 6, display: 'flex', justifyContent: 'center' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: group.text, background: group.badgeBg, border: `1px solid ${group.line}`, padding: '2px 10px', borderRadius: 999 }}>{group.badgeKr} · {group.badgeCn}</span>
        </div>
      </div>
    </div>
  )
}

// 스켈레톤 카드 (테마는 전역 .card / .shimmer CSS 사용)
function StyleSkeleton() {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="shimmer" style={{ width: '100%', aspectRatio: '3/4' }} />
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="shimmer" style={{ height: 14, width: '60%', borderRadius: 4 }} />
        <div className="shimmer" style={{ height: 11, width: '85%', borderRadius: 4 }} />
        <div className="shimmer" style={{ height: 11, width: '50%', borderRadius: 4 }} />
        <div className="shimmer" style={{ height: 20, width: '45%', borderRadius: 999, marginTop: 4 }} />
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// 메인 페이지
// ──────────────────────────────────────────────────────────
export default function StylesPage({ G }) {
  const [items, setItems] = useState([])
  const [moList, setMoList] = useState([])         // 오더완료 여부 대조용 MO 목록
  const [loading, setLoading] = useState(true)     // 초기 로딩
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const cursorRef = useRef('')   // Zoho v2.1 record_cursor (next page)

  // filters
  const [search, setSearch] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('')
  const [styleStatus, setStyleStatus] = useState('')
  // ① 샘플 상태 필터 · 打样状态: 'all' | 'progress'(제작중) | 'done'(완료)
  const [sampleFilter, setSampleFilter] = useState('all')
  // ② 오더 여부 필터 · 下单状态: 'all' | 'ordered' | 'unordered'
  const [orderFilter, setOrderFilter] = useState('all')
  // ③ 월별/시즌 버튼 필터: { type:'all'|'month'|'season', value }
  const [ms, setMs] = useState({ type: 'all', value: '' })

  const [selected, setSelected] = useState(null)   // 상세 모달 record
  const [zoomSrc, setZoomSrc] = useState(null)     // 라이트박스

  const extract = (d) => d?.data || d?.records || d?.result || []

  // 초기 로드 (첫 페이지) — 재시도용으로 분리
  const loadInitial = useCallback(() => {
    setLoading(true); setError(null)
    cursorRef.current = ''
    fetchStyleList({ maxRecords: PAGE_SIZE })
      .then(d => {
        const list = extract(d)
        setItems(list)
        cursorRef.current = d?.record_cursor || ''
        setHasMore(!!d?.record_cursor)
      })
      .catch(err => { console.error('[StylesPage] load', err); setError(err.message || String(err)) })
      .finally(() => setLoading(false))
  }, [])

  // ① 오더완료 여부 대조용 MO 목록 로드 (기존 mo-list 재사용, 200개 고정)
  const loadMo = useCallback(() => {
    fetchMoList({ perPage: 200 })
      .then(d => setMoList(d?.data || d?.records || d?.result || []))
      .catch(err => console.error('[StylesPage] mo', err))
  }, [])

  useEffect(() => {
    // 마운트 시 1회 초기 로드 + 전역 새로고침 이벤트 구독 (의도된 패턴)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInitial(); loadMo()
    const h = () => { loadInitial(); loadMo() }
    window.addEventListener('iku:refresh', h)
    return () => window.removeEventListener('iku:refresh', h)
  }, [loadInitial, loadMo])

  const loadMore = useCallback(() => {
    if (loadingMore || !cursorRef.current) return
    setLoadingMore(true)
    fetchStyleList({ cursor: cursorRef.current, maxRecords: PAGE_SIZE })
      .then(d => {
        const list = extract(d)
        setItems(prev => {
          const seen = new Set(prev.map(recId))
          return [...prev, ...list.filter(r => !seen.has(recId(r)))]
        })
        cursorRef.current = d?.record_cursor || ''
        setHasMore(!!d?.record_cursor)
      })
      .catch(err => console.error('[StylesPage] loadMore', err))
      .finally(() => setLoadingMore(false))
  }, [loadingMore])

  // 동적 필터 옵션
  const opts = useMemo(() => {
    const u = (keys) => [...new Set(items.map(r => pick(r, keys)).filter(Boolean))].sort()
    return {
      brand: u(F.brand), category: u(F.category),
      styleStatus: u(F.styleStatus), sampleStatus: u(F.sampleStatus),
    }
  }, [items])

  // ① 오더완료 MO 의 SKU 집합 (대소문자 무시·trim) — Style SKU 대조용
  const moSkuSet = useMemo(() => {
    const s = new Set()
    moList.forEach(m => { const sku = getMoSku(m); if (sku && sku !== '—') s.add(sku.trim().toLowerCase()) })
    return s
  }, [moList])

  // Style 레코드가 MO 에 오더되어 있는지 (SKU 대조)
  const isOrderedBySku = useCallback((r) => {
    const sku = pick(r, F.sku).trim().toLowerCase()
    return !!sku && moSkuSet.has(sku)
  }, [moSkuSet])

  // ② 오더 여부 필터 카운트 (전체/오더완료/미오더)
  const orderCounts = useMemo(() => {
    let ordered = 0
    items.forEach(r => { if (isOrderedBySku(r)) ordered++ })
    return { all: items.length, ordered, unordered: items.length - ordered }
  }, [items, isOrderedBySku])

  // ① 샘플 상태 필터 카운트 (전체/제작중/완료)
  const sampleCounts = useMemo(() => {
    let progress = 0, done = 0
    items.forEach(r => { const c = sampleStatusClass(pick(r, F.sampleStatus)); if (c === 'done') done++; else progress++ })
    return { all: items.length, progress, done }
  }, [items])

  // ③ 월/시즌 버튼 목록 (실제 데이터 기준 + 카운트)
  const msButtons = useMemo(() => {
    const months = {}, seasons = {}
    items.forEach(r => {
      const m = monthOf(r); if (m) months[m] = (months[m] || 0) + 1
      const se = seasonOf(r); if (se) seasons[se] = (seasons[se] || 0) + 1
    })
    const monthBtns = Object.keys(months).sort().map(v => ({ type: 'month', value: v, label: monthLabel({ Plan_Month: v }) || `${v}月`, count: months[v] }))
    const seasonBtns = Object.keys(seasons).sort().map(v => ({ type: 'season', value: v, label: `${v} 시즌`, count: seasons[v] }))
    return [...monthBtns, ...seasonBtns]
  }, [items])

  const msMatch = (r) => {
    if (ms.type === 'month') return monthOf(r) === ms.value
    if (ms.type === 'season') return seasonOf(r) === ms.value
    return true
  }

  // 클라이언트 사이드 검색/필터 (샘플 상태 + 월/시즌 AND 조합)
  const visible = useMemo(() => {
    const s = search.trim().toLowerCase()
    return items.filter(r => {
      if (brand && pick(r, F.brand) !== brand) return false
      if (category && pick(r, F.category) !== category) return false
      if (styleStatus && pick(r, F.styleStatus) !== styleStatus) return false
      // ① 샘플 상태 필터 (제작중/완료 — 클래스 기준, AND)
      if (sampleFilter !== 'all') {
        const c = sampleStatusClass(pick(r, F.sampleStatus))
        if (sampleFilter === 'done' && c !== 'done') return false
        if (sampleFilter === 'progress' && c === 'done') return false
      }
      // ② 오더 여부 필터 (샘플 상태 등과 AND 조합)
      if (orderFilter === 'ordered' && !isOrderedBySku(r)) return false
      if (orderFilter === 'unordered' && isOrderedBySku(r)) return false
      if (ms.type !== 'all' && !msMatch(r)) return false
      if (s) {
        const blob = `${pick(r, F.sku)} ${pick(r, F.eng)} ${pick(r, F.chi)}`.toLowerCase()
        if (!blob.includes(s)) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, brand, category, styleStatus, sampleFilter, orderFilter, moSkuSet, ms])

  // 분류 그룹별 카드 묶음 (순서 고정: 오더완료 → 샘플 완료 → 샘플 제작 중)
  const grouped = useMemo(() => {
    const g = { ordered: [], done: [], progress: [] }
    visible.forEach(r => { g[groupKeyOf(r, isOrderedBySku(r), pick, F.sampleStatus)].push(r) })
    return g
  }, [visible, isOrderedBySku])

  const resetFilters = () => { setSearch(''); setBrand(''); setCategory(''); setStyleStatus(''); setSampleFilter('all'); setOrderFilter('all'); setMs({ type: 'all', value: '' }) }
  const anyFilter = search || brand || category || styleStatus || sampleFilter !== 'all' || orderFilter !== 'all' || ms.type !== 'all'

  const inputStyle = { padding: '8px 12px', borderRadius: 8, fontSize: 12, border: `1px solid ${G.border}`, background: G.card, color: G.tx, outline: 'none', fontFamily: 'inherit' }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <style>{PAGE_CSS}</style>

      {/* 헤더 */}
      <div className="card" style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="syne" style={{ background: G.primary, color: '#FFF', padding: '6px 10px', borderRadius: 6, display: 'flex' }}><Shirt size={16} /></span>
          <div>
            <div className="syne" style={{ fontSize: 18, fontWeight: 700, color: G.tx, letterSpacing: '-.3px' }}>Style / Sample 管理</div>
            <div style={{ fontSize: 11, color: G.mu, marginTop: 1 }}>스타일·샘플 관리 · 款式样品管理</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 12, color: G.mu }}>총 <span className="num" style={{ color: G.tx, fontWeight: 700 }}>{items.length}</span>개 · 共{items.length}个</div>
          <button onClick={loadInitial} disabled={loading} className="btn-ghost" style={{ minHeight: 38, padding: '8px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? 0.6 : 1 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> 새로고침 刷新
          </button>
        </div>
      </div>

      {/* 필터/검색 바 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', top: 11, left: 10, color: G.mu, pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="SKU·영문명·중문명 검색 / 搜索" style={{ ...inputStyle, width: '100%', paddingLeft: 30 }} />
        </div>
        <FilterSelect G={G} value={brand} onChange={setBrand} ph="브랜드 · 品牌" list={opts.brand} />
        <FilterSelect G={G} value={category} onChange={setCategory} ph="카테고리 · 分类" list={opts.category} />
        <FilterSelect G={G} value={styleStatus} onChange={setStyleStatus} ph="스타일 상태 · 样品状态" list={opts.styleStatus} />
        {anyFilter && (
          <button onClick={resetFilters} className="btn-ghost" style={{ minHeight: 38, padding: '8px 12px', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 5 }}>
            <RotateCcw size={12} /> 초기화 · 重置
          </button>
        )}
      </div>

      {/* B안 통합 필터 패널 — 3행, 라벨 고정폭 + 세로 구분선으로 칩 시작 위치 통일 */}
      <div style={{ border: `1px solid ${G.border}`, borderRadius: 12, padding: '4px 16px', marginBottom: 14, background: G.card }}>
        {/* 행 1 — 샘플 상태 打样状态 */}
        <PanelRow G={G} label="샘플 상태 · 打样状态">
          <FilterChip G={G} on={sampleFilter === 'all'} tone="gold" onClick={() => setSampleFilter('all')} label="전체 全部" count={sampleCounts.all} />
          <FilterChip G={G} on={sampleFilter === 'progress'} tone="orange" onClick={() => setSampleFilter('progress')} label="샘플 제작 중 打样中" count={sampleCounts.progress} />
          <FilterChip G={G} on={sampleFilter === 'done'} tone="blue" onClick={() => setSampleFilter('done')} label="샘플 완료 已完成" count={sampleCounts.done} />
        </PanelRow>

        {/* 행 2 — 오더 여부 下单状态 */}
        <PanelRow G={G} label="오더 여부 · 下单状态" divider>
          <FilterChip G={G} on={orderFilter === 'all'} tone="gold" onClick={() => setOrderFilter('all')} label="전체 全部" count={orderCounts.all} />
          <FilterChip G={G} on={orderFilter === 'ordered'} tone="green" onClick={() => setOrderFilter('ordered')} label="오더완료 已下单" count={orderCounts.ordered} />
          <FilterChip G={G} on={orderFilter === 'unordered'} tone="red" onClick={() => setOrderFilter('unordered')} label="미오더 未下单" count={orderCounts.unordered} />
        </PanelRow>

        {/* 행 3 — 월·시즌 月份·季节 */}
        <PanelRow G={G} label="월·시즌 · 月份·季节" divider>
          <FilterChip G={G} on={ms.type === 'all'} tone="gold" onClick={() => setMs({ type: 'all', value: '' })} label="전체 全部" count={items.length} />
          {msButtons.map(b => (
            <FilterChip key={`${b.type}:${b.value}`} G={G}
              on={ms.type === b.type && ms.value === b.value} tone="gold"
              onClick={() => setMs({ type: b.type, value: b.value })} label={b.label} count={b.count} />
          ))}
        </PanelRow>
      </div>

      {/* 결과 수 */}
      <div style={{ fontSize: 11, color: G.mu, marginBottom: 12 }}>
        {loading ? '불러오는 중 · 加载中…' : `${visible.length}개 표시 · 显示 ${visible.length} 个`}
      </div>

      {/* 본문 */}
      {loading ? (
        <div className="sty-grid">{[...Array(10)].map((_, i) => <StyleSkeleton key={i} />)}</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: G.mu }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: G.bad }}>데이터를 불러올 수 없습니다 · 无法加载数据</div>
          <div style={{ fontSize: 11, color: G.fa, marginTop: 4, marginBottom: 14 }}>{error}</div>
          <button onClick={loadInitial} className="btn-primary" style={{ minHeight: 38, padding: '8px 18px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={13} /> 재시도 · 重试
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: G.mu }}>
          <Shirt size={40} style={{ color: G.fa, marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>검색 결과가 없습니다 · 没有搜索结果</div>
          <div style={{ fontSize: 12, color: G.fa, marginTop: 4 }}>필터를 조정해 보세요 · 请调整筛选</div>
        </div>
      ) : (
        <>
          {/* 그룹 분리 배치 (순서: 오더완료 → 샘플 완료 → 샘플 제작 중, 빈 그룹은 헤더 숨김) */}
          {STY_GROUPS.map(g => {
            const list = grouped[g.key]
            if (!list.length) return null
            return (
              <div key={g.key}>
                <GroupHeader g={g} count={list.length} />
                <div className="sty-grid">
                  {list.map(r => <StyleCard key={recId(r)} G={G} rec={r} group={g} onOpen={setSelected} onZoom={setZoomSrc} />)}
                </div>
              </div>
            )
          })}
          {/* 더 불러오기 (서버 페이지네이션). 필터 적용 중에는 전체 로드를 권장하는 안내 */}
          {hasMore && !anyFilter && (
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button onClick={loadMore} disabled={loadingMore} className="btn-ghost" style={{ minHeight: 40, padding: '10px 22px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: loadingMore ? 0.6 : 1 }}>
                <ChevronDown size={14} style={{ animation: loadingMore ? 'spin 1s linear infinite' : 'none' }} /> {loadingMore ? '불러오는 중 · 加载中…' : '더 불러오기 · 加载更多'}
              </button>
            </div>
          )}
          {hasMore && anyFilter && (
            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 10.5, color: G.fa }}>
              필터 적용 중 — 전체 결과를 보려면 초기화 후 더 불러오세요 · 筛选中，重置后可加载更多
            </div>
          )}
        </>
      )}

      {selected && <StyleDetailModal G={G} rec={selected} onClose={() => setSelected(null)} onZoom={setZoomSrc} />}
      {zoomSrc && <Lightbox src={zoomSrc} onClose={() => setZoomSrc(null)} />}
    </div>
  )
}
