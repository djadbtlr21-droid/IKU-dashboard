import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Shirt, Search, RotateCcw, RefreshCw, X, ChevronDown } from 'lucide-react'
import { fetchStyleList } from '../api/client'
import ZohoImage from '../components/ZohoImage'
import {
  F, pick, recId, imageField, styleImageUrl, styleStatusBadge,
  isOrdered, fmtTime, monthOf, monthLabel, seasonOf, hasSizeSpec,
} from '../utils/styleFields'

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

// 상태값 분류 → 색상/깜빡임 (In Progress·진행=빨강깜빡 · 승인됨·완료=초록 · 그외=뮤트)
function statusInfo(G, val) {
  const s = String(val || '').toLowerCase()
  if (!s) return null
  if (/in.?progress|进行|sampling|제작\s*중|제작중|진행/.test(s)) return { color: G.bad, blink: true }
  if (/approved|승인|已批准|complete|完成|完了|完工/.test(s)) return { color: G.ok, blink: false }
  return { color: G.mu, blink: false }
}

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
// 상세 모달
// ──────────────────────────────────────────────────────────
function StyleModal({ G, rec, onClose, onZoom }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const imgUrl = styleImageUrl(rec)
  const sb = styleStatusBadge(G, pick(rec, F.styleStatus))
  const ordered = isOrdered(rec)

  const rows = [
    ['SKU', pick(rec, F.sku)],
    ['영문명 · Eng Name', pick(rec, F.eng)],
    ['중문명 · 中文款号', pick(rec, F.chi)],
    ['브랜드 · 品牌', pick(rec, F.brand)],
    ['시즌 · 季节', pick(rec, F.season)],
    ['성별 · 性别', pick(rec, F.gender)],
    ['카테고리 · 分类', pick(rec, F.category)],
    ['원단 · 面料', pick(rec, F.fabric)],
    ['목표원가 · 成本', pick(rec, F.cost)],
    ['스타일 상태 · 样品状态', pick(rec, F.styleStatus)],
    ['샘플 상태 · 打样状态', pick(rec, F.sampleStatus)],
    ['오더 상태 · 订单状态', ordered ? '✓ Ordered 已下单' : '× Not Ordered 未下单'],
    ['생성일 · 创建时间', fmtTime(pick(rec, F.created))],
    ['수정일 · 修改时间', fmtTime(pick(rec, F.modified))],
  ]

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: G.overlayBg, zIndex: 2500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, boxShadow: G.cardShadow, width: '100%', maxWidth: 760, maxHeight: '88vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${G.hair}`, position: 'sticky', top: 0, background: G.card, zIndex: 1 }}>
          <div className="syne" style={{ fontSize: 16, fontWeight: 700, color: G.tx }}>{pick(rec, F.sku) || '스타일 상세 · 款式详情'}</div>
          <button onClick={onClose} aria-label="close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.mu, display: 'flex', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: 18, padding: 20, flexWrap: 'wrap' }}>
          {/* 이미지 좌측 */}
          <div style={{ flex: '0 0 260px', maxWidth: '100%' }}>
            <div onClick={() => imgUrl && onZoom(imgUrl)}
              style={{ width: '100%', aspectRatio: '3/4', borderRadius: 10, overflow: 'hidden', border: `1px solid ${G.hair}`, cursor: imgUrl ? 'zoom-in' : 'default', background: G.cardAlt }}>
              <ZohoImage mo={rec} field={imageField(rec) || 'Style_Image'} G={G} alt={pick(rec, F.sku)} placeholderText="No Image · 无图片" />
            </div>
          </div>
          {/* 정보 우측 2단 */}
          <div style={{ flex: '1 1 320px', minWidth: 240 }}>
            {sb && (
              <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#fff', background: sb.color, padding: '3px 10px', borderRadius: 999, marginBottom: 12 }}>{sb.label}</span>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {rows.map(([label, val]) => (
                  <tr key={label}>
                    <td style={{ padding: '7px 8px 7px 0', fontSize: 11, color: G.mu, verticalAlign: 'top', whiteSpace: 'nowrap', borderBottom: `1px solid ${G.hair}` }}>{label}</td>
                    <td style={{ padding: '7px 0', fontSize: 12.5, color: val ? G.tx : G.fa, fontWeight: 500, borderBottom: `1px solid ${G.hair}` }}>{val || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// 스타일 카드
// ──────────────────────────────────────────────────────────
function StyleCard({ G, rec, onOpen, onZoom }) {
  const sku = pick(rec, F.sku)
  const chi = pick(rec, F.chi)
  const brand = pick(rec, F.brand)
  const gender = pick(rec, F.gender)
  const category = pick(rec, F.category)
  const fabric = pick(rec, F.fabric)
  const sampleSt = pick(rec, F.sampleStatus)   // 승인 상태 (Approved / In Progress …)
  const styleSt = pick(rec, F.styleStatus)     // 샘플 상태 (Sampling / Active …)
  const ordered = isOrdered(rec)
  const imgUrl = styleImageUrl(rec)
  const hasSize = hasSizeSpec(rec)

  const sampleInfo = statusInfo(G, styleSt)    // 샘플 상태 색/깜빡
  const approvalInfo = statusInfo(G, sampleSt) // 승인 상태 색/깜빡
  const skuRed = (sampleInfo?.blink || approvalInfo?.blink)   // 제작중이면 SKU 빨강

  // 하단 상태 배지
  const badge = (label, info, key) => label ? (
    <span key={key} className={info?.blink ? 'sty-blink' : undefined}
      style={{ display: 'inline-block', fontSize: 8.5, fontWeight: 700, padding: '2px 6px', borderRadius: 6, lineHeight: 1.3,
        color: info?.color || G.mu, border: `1px solid ${info?.color || G.border}`, background: 'transparent' }}>
      {label}
    </span>
  ) : null

  const meta = [brand, gender, category].filter(Boolean).join(' · ')

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
      onClick={() => onOpen(rec)}>
      {/* ① 이미지 영역 — 오버레이 없음, 고정 높이, object-fit cover, 클릭 시 라이트박스 */}
      <div style={{ width: '100%', height: 185, background: G.cardAlt }}
        onClick={(e) => { if (imgUrl) { e.stopPropagation(); onZoom(imgUrl) } }}>
        <ZohoImage mo={rec} field={imageField(rec) || 'Style_Image'} G={G} alt={sku} placeholderText="" iconSize={22} />
      </div>

      {/* ② 텍스트 영역 (이미지 아래) */}
      <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        {/* 1. SKU */}
        <div className="syne" style={{ fontSize: 11, fontWeight: 700, color: skuRed ? G.bad : G.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sku || '—'}</div>
        {/* 2. 중문명 */}
        {chi && <div style={{ fontSize: 9.5, color: G.mu, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chi}</div>}
        {/* 3. 브랜드·성별·분류 한줄 */}
        {meta && <div style={{ fontSize: 9, color: G.fa, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</div>}
        {/* 4. 원단 */}
        {fabric && <div style={{ fontSize: 9, color: G.mu, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><span style={{ color: G.fa }}>面料 </span>{fabric}</div>}
        {/* 5. 사이즈 유무 (없음=빨강 깜빡) */}
        <div style={{ marginTop: 2 }}>
          <span className={hasSize ? undefined : 'sty-blink'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 8.5, fontWeight: 700, padding: '1px 6px', borderRadius: 999, border: `1px solid ${hasSize ? G.ok : G.bad}`, color: hasSize ? G.ok : G.bad }}>
            {hasSize ? '✓ 사이즈 있음 有尺码' : '✗ 사이즈 없음 无尺码'}
          </span>
        </div>
        {/* 6. 하단 상태 배지 영역 */}
        <div style={{ marginTop: 'auto', paddingTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {badge(styleSt, sampleInfo, 'st')}
          {badge(sampleSt, approvalInfo, 'ap')}
          {badge(ordered ? '오더완료 · 已下单' : '미오더 · 未下单', { color: ordered ? G.ok : G.bad, blink: false }, 'od')}
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
  const [sampleStatus, setSampleStatus] = useState('')
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

  useEffect(() => {
    // 마운트 시 1회 초기 로드 + 전역 새로고침 이벤트 구독 (의도된 패턴)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInitial()
    const h = () => loadInitial()
    window.addEventListener('iku:refresh', h)
    return () => window.removeEventListener('iku:refresh', h)
  }, [loadInitial])

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
      if (sampleStatus && pick(r, F.sampleStatus) !== sampleStatus) return false
      if (ms.type !== 'all' && !msMatch(r)) return false
      if (s) {
        const blob = `${pick(r, F.sku)} ${pick(r, F.eng)} ${pick(r, F.chi)}`.toLowerCase()
        if (!blob.includes(s)) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, brand, category, styleStatus, sampleStatus, ms])

  const resetFilters = () => { setSearch(''); setBrand(''); setCategory(''); setStyleStatus(''); setSampleStatus(''); setMs({ type: 'all', value: '' }) }
  const anyFilter = search || brand || category || styleStatus || sampleStatus || ms.type !== 'all'

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

      {/* ③ [1줄] 샘플 상태 · 打样状态 (Sample_Status 동적 생성, 기본 전체) */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10.5, color: G.mu, fontWeight: 600, marginRight: 2, width: 96 }}>샘플 상태 · 打样状态</span>
        {[''].concat(opts.sampleStatus).map(v => {
          const on = sampleStatus === v
          const cnt = v ? items.filter(r => pick(r, F.sampleStatus) === v).length : items.length
          return (
            <button key={v || 'all'} onClick={() => setSampleStatus(v)} className="chip"
              style={{ border: `1px solid ${on ? G.primary : G.border}`, background: on ? (G.dk ? 'rgba(232,200,152,0.12)' : 'rgba(201,168,110,0.12)') : 'transparent', color: on ? G.accent : G.mu, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5 }}>
              {v || '전체 全部'}
              <span className="num" style={{ fontSize: 9, padding: '1px 5px', borderRadius: 999, background: on ? G.primary : G.hair, color: on ? '#fff' : G.mu }}>{cnt}</span>
            </button>
          )
        })}
      </div>

      {/* ③ [2줄] 월별 · 月份 / 시즌 · 季节 (실제 값 동적 생성, 기본 전체) */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10.5, color: G.mu, fontWeight: 600, marginRight: 2, width: 96 }}>월별·月份 / 시즌·季节</span>
        {(() => {
          const allOn = ms.type === 'all'
          return (
            <button onClick={() => setMs({ type: 'all', value: '' })} className="chip"
              style={{ border: `1px solid ${allOn ? G.primary : G.border}`, background: allOn ? (G.dk ? 'rgba(232,200,152,0.12)' : 'rgba(201,168,110,0.12)') : 'transparent', color: allOn ? G.accent : G.mu, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5 }}>
              전체 全部
              <span className="num" style={{ fontSize: 9, padding: '1px 5px', borderRadius: 999, background: allOn ? G.primary : G.hair, color: allOn ? '#fff' : G.mu }}>{items.length}</span>
            </button>
          )
        })()}
        {msButtons.map(b => {
          const on = ms.type === b.type && ms.value === b.value
          return (
            <button key={`${b.type}:${b.value}`} onClick={() => setMs({ type: b.type, value: b.value })} className="chip"
              style={{ border: `1px solid ${on ? G.primary : G.border}`, background: on ? (G.dk ? 'rgba(232,200,152,0.12)' : 'rgba(201,168,110,0.12)') : 'transparent', color: on ? G.accent : G.mu, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5 }}>
              {b.label}
              <span className="num" style={{ fontSize: 9, padding: '1px 5px', borderRadius: 999, background: on ? G.primary : G.hair, color: on ? '#fff' : G.mu }}>{b.count}</span>
            </button>
          )
        })}
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
          <div className="sty-grid">
            {visible.map(r => <StyleCard key={recId(r)} G={G} rec={r} onOpen={setSelected} onZoom={setZoomSrc} />)}
          </div>
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

      {selected && <StyleModal G={G} rec={selected} onClose={() => setSelected(null)} onZoom={setZoomSrc} />}
      {zoomSrc && <Lightbox src={zoomSrc} onClose={() => setZoomSrc(null)} />}
    </div>
  )
}
