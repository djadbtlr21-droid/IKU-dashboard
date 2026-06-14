import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Shirt, Search, RotateCcw, RefreshCw, X, Check, ChevronDown } from 'lucide-react'
import { fetchStyleList } from '../api/client'
import ZohoImage from '../components/ZohoImage'

// ──────────────────────────────────────────────────────────
// Style / Sample 管理 — All_Styles 리포트 목록
//
// 필드명은 Zoho 리포트마다 다를 수 있어 후보 배열로 방어적 매핑한다.
// (실제 응답 키는 functions/api/style-list.js 의 ZOHO_DEBUG 로그로 확인 가능)
// 페이지네이션: 50개씩 from_index 증가 후 누적. 검색/필터는 클라이언트 사이드.
//   ※ 스타일이 수백 개 이상으로 늘면 서버사이드 필터(criteria)로 전환 권장.
// ──────────────────────────────────────────────────────────

// Zoho 필드값 → 문자열 (string | {zc_display_value} | {display_value} | lookup)
function fieldStr(v) {
  if (v === null || v === undefined) return ''
  if (Array.isArray(v)) return v.map(fieldStr).filter(Boolean).join(', ')
  if (typeof v === 'object') return String(v.zc_display_value || v.display_value || v.value || '').trim()
  return String(v).trim()
}
// 후보 키들 중 처음으로 값이 있는 것을 반환
function pick(rec, keys) {
  for (const k of keys) {
    const s = fieldStr(rec?.[k])
    if (s) return s
  }
  return ''
}

// 논리 필드 → 실제 후보 키 매핑
const F = {
  sku: ['Style_SKU', 'SKU', 'Style_Code', 'Style_No', 'style_sku'],
  eng: ['Eng_Style_Name', 'English_Style_Name', 'Style_Name', 'Style_Name_EN', 'Name'],
  chi: ['Chinese_Style_Name', 'Chi_Style_Name', 'CN_Style_Name', 'Chinese_Name', 'Style_Name_CN'],
  brand: ['Brand', 'Brand_Name', 'brand'],
  season: ['Season', 'season'],
  gender: ['Gender', 'Sex', 'gender'],
  category: ['Category', 'Style_Category', 'Type', 'category'],
  fabric: ['Fabric', 'Main_Fabric', 'Material', 'Material_Type', 'fabric'],
  cost: ['Target_Cost', 'Estimated_Cost', 'Cost', 'Target_Price', 'target_cost'],
  styleStatus: ['Style_Status', 'Status', 'Style_Stage', 'style_status'],
  sampleStatus: ['Sample_Status', 'Sampling_Status', 'Sample_Stage', 'sample_status'],
  orderStatus: ['Order_Status', 'Ordered', 'order_status'],
  created: ['Created_Time', 'Added_Time', 'Create_Time', 'created_time'],
  modified: ['Modified_Time', 'Updated_Time', 'Modified_time', 'modified_time'],
}
const IMAGE_FIELDS = ['Style_Image', 'Style_Photo', 'Image', 'Photo', 'Main_Image', 'Front_Image', 'Thumbnail']

const recId = (r) => String(r?.ID || r?.id || '')

function imageField(rec) {
  for (const f of IMAGE_FIELDS) {
    const v = rec?.[f]
    if (v && (typeof v === 'string' ? v : (Array.isArray(v) ? v.length : true))) return f
  }
  return null
}
// 라이트박스용 프록시 URL (ZohoImage 의 filepath 규칙과 동일)
function styleImageUrl(rec) {
  const f = imageField(rec)
  if (!f) return null
  const v = rec[f]
  const first = Array.isArray(v) ? v[0] : v
  const path = typeof first === 'string' ? first : (first?.url || first?.filepath || first?.path)
  return path ? `/api/zoho-image?filepath=${encodeURIComponent(path)}` : null
}

// ── 상태 배지 ──
// In Progress 진행: warn(노랑계열) · Completed 완료: ok(초록) · On Hold 홀드: bad(빨강)
// Not Started 미시작: mu(회색) · 기타: 회색
function styleStatusBadge(G, raw) {
  const s = String(raw || '').toLowerCase()
  if (!s) return null
  if (/hold|보류|홀드|暂停|挂起/.test(s)) return { color: G.bad, label: raw }
  if (/complete|done|완료|完成|结束/.test(s)) return { color: G.ok, label: raw }
  if (/progress|진행|进行|制作|开发|开发中/.test(s)) return { color: G.warn, label: raw }
  if (/not.?start|미시작|未开始|待/.test(s)) return { color: G.mu, label: raw }
  return { color: G.mu, label: raw }
}

function isOrdered(rec) {
  const raw = pick(rec, F.orderStatus).toLowerCase()
  if (!raw) return false
  if (/未下单|not.?order|no\b|false|否/.test(raw)) return false
  return /已下单|ordered|yes|true|是|下单/.test(raw)
}

function fmtTime(s) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const PAGE_CSS = `
.sty-grid{display:grid;gap:16px;align-items:start;grid-template-columns:repeat(5,minmax(0,1fr))}
@media(max-width:1500px){.sty-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:1150px){.sty-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:860px){.sty-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.sty-grid{grid-template-columns:repeat(1,minmax(0,1fr))}}
`

const PAGE_SIZE = 50

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
  const eng = pick(rec, F.eng)
  const chi = pick(rec, F.chi)
  const brand = pick(rec, F.brand)
  const gender = pick(rec, F.gender)
  const category = pick(rec, F.category)
  const fabric = pick(rec, F.fabric)
  const cost = pick(rec, F.cost)
  const sample = pick(rec, F.sampleStatus)
  const sb = styleStatusBadge(G, pick(rec, F.styleStatus))
  const ordered = isOrdered(rec)
  const imgUrl = styleImageUrl(rec)
  const modified = pick(rec, F.modified) || pick(rec, F.created)

  const line = (label, val) => val ? (
    <div style={{ display: 'flex', gap: 6, fontSize: 11, lineHeight: 1.45 }}>
      <span style={{ color: G.fa, flexShrink: 0 }}>{label}</span>
      <span style={{ color: G.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
    </div>
  ) : null

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
      onClick={() => onOpen(rec)}>
      {/* 이미지 */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', background: G.cardAlt }}>
        <div style={{ width: '100%', height: '100%' }}
          onClick={(e) => { if (imgUrl) { e.stopPropagation(); onZoom(imgUrl) } }}>
          <ZohoImage mo={rec} field={imageField(rec) || 'Style_Image'} G={G} alt={sku} placeholderText="No Image · 无图片" />
        </div>
        {/* 상태 배지 (이미지 위) */}
        <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          {sb && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: sb.color, padding: '2px 8px', borderRadius: 999, boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>{sb.label}</span>}
          {sample && <span style={{ fontSize: 9.5, fontWeight: 600, color: G.tx, background: 'rgba(255,255,255,0.88)', padding: '2px 7px', borderRadius: 999 }}>{sample}</span>}
        </div>
      </div>

      {/* 정보 */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        <div className="syne" style={{ fontSize: 13.5, fontWeight: 700, color: G.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sku || '—'}</div>
        {eng && <div style={{ fontSize: 11.5, color: G.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eng}</div>}
        {chi && <div style={{ fontSize: 11, color: G.mu, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chi}</div>}
        <div style={{ height: 1, background: G.hair, margin: '5px 0' }} />
        {line('品牌', brand)}
        {line('性别', gender)}
        {line('分类', category)}
        {line('面料', fabric)}
        {line('成本', cost)}
        {/* 오더 상태 배지 */}
        <div style={{ marginTop: 5 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, border: `1px solid ${ordered ? G.ok : G.border}`, color: ordered ? G.ok : G.mu, background: ordered ? (G.dk ? 'rgba(134,181,154,0.12)' : 'rgba(74,112,88,0.08)') : 'transparent' }}>
            {ordered ? <Check size={11} /> : <X size={11} />}
            {ordered ? 'Ordered 已下单' : 'Not Ordered 未下单'}
          </span>
        </div>
        {modified && <div style={{ fontSize: 9.5, color: G.fa, marginTop: 'auto', paddingTop: 6 }}>수정 · 更新: {fmtTime(modified)}</div>}
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
  const fromIndexRef = useRef(1)

  // filters
  const [search, setSearch] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('')
  const [season, setSeason] = useState('')
  const [styleStatus, setStyleStatus] = useState('')
  const [sampleStatus, setSampleStatus] = useState('')

  const [selected, setSelected] = useState(null)   // 상세 모달 record
  const [zoomSrc, setZoomSrc] = useState(null)     // 라이트박스

  const extract = (d) => d?.data || d?.records || d?.result || []

  // 초기 로드 (첫 50개) — 재시도용으로 분리
  const loadInitial = useCallback(() => {
    setLoading(true); setError(null)
    fromIndexRef.current = 1
    fetchStyleList({ fromIndex: 1, maxRecords: PAGE_SIZE })
      .then(d => {
        const list = extract(d)
        setItems(list)
        setHasMore(list.length >= PAGE_SIZE)
        fromIndexRef.current = 1 + list.length
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
    if (loadingMore) return
    setLoadingMore(true)
    fetchStyleList({ fromIndex: fromIndexRef.current, maxRecords: PAGE_SIZE })
      .then(d => {
        const list = extract(d)
        setItems(prev => {
          const seen = new Set(prev.map(recId))
          return [...prev, ...list.filter(r => !seen.has(recId(r)))]
        })
        setHasMore(list.length >= PAGE_SIZE)
        fromIndexRef.current += list.length
      })
      .catch(err => console.error('[StylesPage] loadMore', err))
      .finally(() => setLoadingMore(false))
  }, [loadingMore])

  // 동적 필터 옵션
  const opts = useMemo(() => {
    const u = (keys) => [...new Set(items.map(r => pick(r, keys)).filter(Boolean))].sort()
    return {
      brand: u(F.brand), category: u(F.category), season: u(F.season),
      styleStatus: u(F.styleStatus), sampleStatus: u(F.sampleStatus),
    }
  }, [items])

  // 클라이언트 사이드 검색/필터
  const visible = useMemo(() => {
    const s = search.trim().toLowerCase()
    return items.filter(r => {
      if (brand && pick(r, F.brand) !== brand) return false
      if (category && pick(r, F.category) !== category) return false
      if (season && pick(r, F.season) !== season) return false
      if (styleStatus && pick(r, F.styleStatus) !== styleStatus) return false
      if (sampleStatus && pick(r, F.sampleStatus) !== sampleStatus) return false
      if (s) {
        const blob = `${pick(r, F.sku)} ${pick(r, F.eng)} ${pick(r, F.chi)}`.toLowerCase()
        if (!blob.includes(s)) return false
      }
      return true
    })
  }, [items, search, brand, category, season, styleStatus, sampleStatus])

  const resetFilters = () => { setSearch(''); setBrand(''); setCategory(''); setSeason(''); setStyleStatus(''); setSampleStatus('') }
  const anyFilter = search || brand || category || season || styleStatus || sampleStatus

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
        <FilterSelect G={G} value={season} onChange={setSeason} ph="시즌 · 季节" list={opts.season} />
        <FilterSelect G={G} value={styleStatus} onChange={setStyleStatus} ph="스타일 상태 · 样品状态" list={opts.styleStatus} />
        <FilterSelect G={G} value={sampleStatus} onChange={setSampleStatus} ph="샘플 상태 · 打样状态" list={opts.sampleStatus} />
        {anyFilter && (
          <button onClick={resetFilters} className="btn-ghost" style={{ minHeight: 38, padding: '8px 12px', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 5 }}>
            <RotateCcw size={12} /> 초기화 · 重置
          </button>
        )}
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
