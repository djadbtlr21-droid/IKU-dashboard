import { useState, useEffect, useRef, useCallback } from 'react'
import { Minus, Plus, Users, CheckCircle2, AlertTriangle, Pencil, Save, X, Lock, ChevronDown, ChevronRight } from 'lucide-react'
import { fetchFactoryConfig, saveFactoryConfig, verifyProcessPassword } from '../api/client'

// ──────────────────────────────────────────────────────────
// HEXIANG 合祥 工厂现场 — 공인(工人) 애니메이션 위젯
//
// 表示条件: ProcessPage 의 공장 카테고리 필터가 HEXIANG 일 때만 (parent toggles
// `display`; DOM 은 항상 유지하여 애니메이션/상태가 살아있음).
//
// 저장: KV `factory:worker_config` (PROCESS_KV 재사용, 별도 키).
//   - 인원(+/-) 변경 → 즉시 저장
//   - 공정명 입력     → 1초 디바운스 저장
// 외부 라이브러리·이미지 금지 — 인라인 SVG + CSS keyframes + React state 만 사용.
// ──────────────────────────────────────────────────────────

const LINES = [
  { id: 'old', kr: '老车间 · 기존 라인' },
  { id: 'yoga', kr: '4楼挂式车间 · 4층 자동화라인' },
]

// 옷감(검정·다크그레이만) / 작업복 / 피부색 순환 팔레트
const FABRIC = ['#111827', '#1F2937', '#374151', '#1F2937', '#4B5563', '#374151', '#111827', '#1F2937']
const WORKWEAR = ['#2563EB', '#16A34A', '#DC2626', '#7C3AED', '#EA580C', '#0891B2', '#B45309', '#0F766E']
const SKIN = ['#FBBF24', '#F97316', '#FCD34D', '#D97706']

// 위상 오프셋 — 공인마다 애니메이션 시작점을 다르게.
const phase = (idx, lineIdx, mod) => `-${(idx * 41 + lineIdx * 97) % mod}ms`

// 위젯 전용 CSS (전역 충돌 방지를 위해 hx 프리픽스).
const WIDGET_CSS = `
@keyframes hxNeedle { 0%,100%{transform:translateY(0)} 50%{transform:translateY(6px)} }
@keyframes hxBob    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-1.5px)} }
@keyframes hxTilt   { 0%,100%{transform:rotate(-2deg)} 50%{transform:rotate(2deg)} }
@keyframes hxFadein { from{opacity:0;transform:scale(0.7)} to{opacity:1;transform:scale(1)} }
@keyframes hxFadeout{ from{opacity:1;transform:scale(1)} to{opacity:0;transform:scale(0.7)} }
.hxw-needle,.hxw-dot{animation:hxNeedle .45s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 0%}
.hxw-tilt{animation:hxTilt .9s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
.hxw-bob{animation:hxBob 1.2s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
.hxw-cell.entering{animation:hxFadein .3s ease-out}
.hxw-cell.leaving{animation:hxFadeout .2s ease-in forwards}
.hxw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(62px,1fr));gap:10px 6px}
.hxw-body{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:768px){.hxw-body{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.hxw-needle,.hxw-dot,.hxw-tilt,.hxw-bob{animation:none}}
`

// ──────────────────────────────────────────────────────────
// 공인 SVG — 재봉틀에 앉아 작업 중 (viewBox 0 0 44 72)
// 바늘은 옷감(아래)을 찍는 방향으로만 움직임 (사람 방향 금지).
// ──────────────────────────────────────────────────────────
function SewingWorker({ idx, lineIdx }) {
  const skin = SKIN[idx % SKIN.length]
  const wear = WORKWEAR[idx % WORKWEAR.length]
  const cloth = FABRIC[idx % FABRIC.length]
  const isPants = idx % 2 === 1   // 짝수=티셔츠, 홀수=바지

  const nd = phase(idx, lineIdx, 400)   // needle delay
  const bd = phase(idx, lineIdx, 1200)  // bob delay
  const td = phase(idx, lineIdx, 800)   // tilt delay

  // 바늘 그룹: 바늘 상단(31.4,38) 고정, 아래로만 translateY
  const needleStyle = { animationDelay: nd, transformBox: 'view-box', transformOrigin: '31.4px 38px' }
  // tilt: rotate 이므로 회전 피벗을 viewBox 좌표(22,32)로 고정
  const tiltStyle = { animationDelay: td, transformBox: 'view-box', transformOrigin: '22px 32px' }

  return (
    <svg viewBox="0 0 44 72" width="56" height="72" style={{ display: 'block', margin: '0 auto', overflow: 'visible' }} aria-hidden="true">
      {/* 1. 재봉틀 본체 (하단) */}
      <rect x="3" y="44" width="38" height="24" rx="3" fill="#9CA3AF" />
      <rect x="5" y="46" width="34" height="16" rx="2" fill="#D1D5DB" />
      <rect x="5" y="46" width="34" height="3" rx="1" fill="#B0B7C3" />
      <circle cx="38" cy="50" r="2.5" fill="#6B7280" />
      <circle cx="38" cy="50" r="1.2" fill="#9CA3AF" />
      <rect x="8" y="64" width="28" height="4" rx="2" fill="#6B7280" />

      {/* 2. 옷감 (상판 위) — 검정·다크그레이만 */}
      {isPants ? (
        <g>
          <rect x="10" y="40" width="24" height="6" rx="2" fill={cloth} stroke="#555" strokeWidth="0.5" />
          <rect x="10" y="46" width="10" height="12" rx="1" fill={cloth} stroke="#555" strokeWidth="0.5" />
          <rect x="22" y="46" width="10" height="12" rx="1" fill={cloth} stroke="#555" strokeWidth="0.5" />
          <line x1="22" y1="46" x2="22" y2="58" stroke="rgba(255,255,255,0.3)" strokeDasharray="2,2" />
        </g>
      ) : (
        <g>
          <path d="M10,40 Q22,37 34,40 L36,44 L30,44 L30,57 L14,57 L14,44 L8,44 Z" fill={cloth} stroke="#555" strokeWidth="0.5" opacity="0.92" />
          <line x1="22" y1="44" x2="22" y2="57" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" strokeDasharray="2,2" />
        </g>
      )}
      <line x1="15" y1="50" x2="29" y2="50" stroke="white" strokeWidth="0.7" strokeDasharray="2,2" opacity="0.4" />

      {/* 3. 바늘 어셈블리 — 옷감 위에서 아래로 수직 찌르기 (왼쪽 수직 파이프 기둥 제거) */}
      {/* 바늘암 수평봉 (옷감 위 공간, 사람 방향 아님) */}
      <rect x="18" y="32" width="14" height="2.5" rx="1.2" fill="#4B5563" />
      {/* 바늘암 수직 고정봉 (정적) */}
      <rect x="30" y="32" width="2.5" height="6" rx="1" fill="#4B5563" />
      {/* 바늘 본체 + 팁 + 스티치 도트 (하나의 g, 아래로만 이동) */}
      <g className="hxw-needle" style={needleStyle}>
        <rect x="30.5" y="38" width="1.8" height="10" rx="0.9" fill="#374151" />
        <rect x="30" y="47" width="2.8" height="2" rx="0.5" fill="#111827" />
        <circle cx="31.4" cy="50" r="1.3" fill="white" opacity="0.35" />
      </g>

      {/* 4 + 5. 공인 (상체 + 머리) — 전체를 bob 으로 감쌈 */}
      <g className="hxw-bob" style={{ animationDelay: bd }}>
        {/* 4. 상체 (앞으로 숙인 작업 자세, 다리 없음) — tilt 는 상체 g 에만 */}
        <g className="hxw-tilt" style={tiltStyle}>
          <line x1="15" y1="31" x2="7" y2="40" stroke={wear} strokeWidth="5" strokeLinecap="round" />
          <line x1="29" y1="31" x2="37" y2="40" stroke={wear} strokeWidth="5" strokeLinecap="round" />
          <rect x="15" y="24" width="14" height="14" rx="5" fill={wear} />
          <circle cx="7" cy="41" r="3.2" fill={skin} />
          <circle cx="37" cy="41" r="3.2" fill={skin} />
        </g>

        {/* 5. 머리 */}
        <circle cx="22" cy="17" r="8" fill={skin} />
        <ellipse cx="22" cy="10" rx="7.5" ry="5" fill="#1F2937" />
        <ellipse cx="19" cy="18" rx="1.2" ry="1.5" fill="#1F2937" />
        <ellipse cx="25" cy="18" rx="1.2" ry="1.5" fill="#1F2937" />
        <path d="M17.5 14.5 L21 14" stroke="#1F2937" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        <path d="M23 14 L26.5 14.5" stroke="#1F2937" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        <path d="M20 21.5 Q22 23 24 21.5" stroke="#92400E" strokeWidth="0.8" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  )
}

// ──────────────────────────────────────────────────────────
// 비밀번호 모달 (라인별 수정 진입 게이트 — 서버사이드 검증, jera8888)
// 디자인은 생산 전 체크 탭의 수정 모달과 통일.
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
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: G.overlayBg || 'rgba(0,0,0,0.45)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <form onSubmit={submit} style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 12, padding: 22, width: '100%', maxWidth: 360, boxShadow: G.cardShadow || '0 12px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: G.tx, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={15} /> 수정 인증 · 修改认证
        </div>
        <div style={{ fontSize: 11, color: G.mu, marginBottom: 16 }}>인원·비고를 수정하려면 비밀번호가 필요합니다 · 修改人数·备注需要密码</div>
        <input ref={inputRef} type="password" value={pw} onChange={e => setPw(e.target.value)}
          placeholder="비밀번호 · 密码" autoComplete="current-password"
          style={{ width: '100%', padding: '10px 12px', fontSize: 14, border: `1px solid ${G.border}`, borderRadius: 8, background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
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
// 한 라인 (헤더 + 비고 + 공인 그리드)
// 읽기 모드: 인원 텍스트 · 비고 텍스트 · 공정명 읽기전용 · "수정" 버튼
// 편집 모드: 인원 ± · 비고 input · 공정명 input · "저장 / 취소"
// ──────────────────────────────────────────────────────────
function WorkerLine({ G, lineIdx, def, line, editing, draft, onDraft }) {
  // 컨트롤드: 편집 중엔 draft, 아니면 committed(line) 사용
  const src = (editing && draft) ? draft : line
  const count = src.count
  const tasks = src.tasks || {}
  const remark = src.remark || ''

  // fadein/fadeout 연출용 로컬 인덱스 추적
  const [entering, setEntering] = useState(null)
  const [leaving, setLeaving] = useState(null)
  const enterTimer = useRef(null)
  const leaveTimer = useRef(null)

  useEffect(() => () => { clearTimeout(enterTimer.current); clearTimeout(leaveTimer.current) }, [])

  const add = () => {
    if (!editing || count >= 100 || leaving !== null) return
    const newIdx = count
    onDraft({ count: count + 1 })
    setEntering(newIdx)
    clearTimeout(enterTimer.current)
    enterTimer.current = setTimeout(() => setEntering(null), 320)
  }

  const remove = () => {
    if (!editing || count <= 0 || leaving !== null) return
    const removeIdx = count - 1
    setLeaving(removeIdx)
    clearTimeout(leaveTimer.current)
    leaveTimer.current = setTimeout(() => {
      setLeaving(null)
      const t = {}
      for (const [k, v] of Object.entries(tasks)) if (Number(k) < removeIdx) t[k] = v
      onDraft({ count: removeIdx, tasks: t })
    }, 200)
  }

  const onTask = (i, v) => {
    const t = { ...tasks }
    if (v) t[String(i)] = v; else delete t[String(i)]
    onDraft({ tasks: t })
  }

  const total = (editing && leaving !== null) ? Math.max(count, leaving + 1) : count
  const cells = []
  for (let i = 0; i < total; i++) cells.push(i)

  const stepBtnStyle = { width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', border: `1px solid ${G.border}`, background: 'transparent', color: G.mu }

  return (
    <div style={{ background: G.cardAlt, border: `0.5px solid ${G.hair}`, borderRadius: 10, padding: 12, minWidth: 0 }}>
      {/* 헤더: 좌 제목 · 중앙 비고 · 우 인원(+편집 시 ±) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: G.tx, flexShrink: 0 }}>{def.kr}</span>

        {/* 라인 비고 (헤더 중앙) */}
        <div style={{ flex: '1 1 140px', minWidth: 120 }}>
          {editing ? (
            <input type="text" value={remark} maxLength={120}
              onChange={e => onDraft({ remark: e.target.value })}
              placeholder="라인 비고 입력 · 输入备注"
              style={{ width: '100%', boxSizing: 'border-box', padding: '4px 8px', fontSize: 11, border: `1px solid ${G.border}`, borderRadius: 6, background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit' }} />
          ) : (
            remark ? (
              <span style={{ fontSize: 11, color: G.tx }}>{remark}</span>
            ) : (
              <span style={{ fontSize: 11, color: G.fa }}>비고 없음 · 暂无备注</span>
            )
          )}
        </div>

        {/* 우측: 인원 배지 + (편집 시) 인원 조절 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, color: G.accent, background: G.dk ? 'rgba(232,200,152,0.12)' : 'rgba(201,168,110,0.14)', border: `1px solid ${G.hair}`, borderRadius: 999, padding: '2px 8px' }}>
            <Users size={11} /> {count}명 작업 중 · {count}名工人
          </span>
          {editing && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <button type="button" onClick={remove} aria-label="감소" title="감소 减少" style={stepBtnStyle}><Minus size={13} /></button>
              <span className="num" style={{ minWidth: 18, textAlign: 'center', fontSize: 13, fontWeight: 700, color: G.tx }}>{count}</span>
              <button type="button" onClick={add} aria-label="증가" title="증가 增加" style={stepBtnStyle}><Plus size={13} /></button>
            </div>
          )}
        </div>
      </div>

      {/* 공인 그리드 */}
      {total === 0 ? (
        <div style={{ fontSize: 11, color: G.fa, padding: '14px 0', textAlign: 'center' }}>작업 중인 공인 없음 · 暂无工人</div>
      ) : (
        <div className="hxw-grid">
          {cells.map(i => {
            const cls = i === entering ? 'entering' : (i === leaving ? 'leaving' : '')
            return (
              <div key={i} className={`hxw-cell ${cls}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <input
                  type="text" maxLength={7} value={tasks[String(i)] || ''}
                  onChange={e => onTask(i, e.target.value)}
                  readOnly={!editing}
                  placeholder="공정명 工序"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '3px 4px', fontSize: 9.5, textAlign: 'center', border: `1px solid ${G.border}`, borderRadius: 5, background: editing ? G.bg : 'transparent', color: G.tx, outline: 'none', fontFamily: 'inherit', cursor: editing ? 'text' : 'default' }}
                />
                <SewingWorker idx={i} lineIdx={lineIdx} />
                <span style={{ fontSize: 10, color: G.fa, fontWeight: 600 }}>#{i + 1}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// 위젯 본체
// ──────────────────────────────────────────────────────────
export default function HexiangFactoryWidget({ G, visible }) {
  const [lines, setLines] = useState({
    old: { count: 15, tasks: {}, remark: '' },
    yoga: { count: 6, tasks: {}, remark: '' },
  })
  const [loaded, setLoaded] = useState(false)
  const [toast, setToast] = useState(null)   // { type:'ok'|'bad', msg }

  // ① 단일 수정 모드 (양쪽 라인 동시 편집) + draft + 검증된 비밀번호
  const [editMode, setEditMode] = useState(false)
  const [drafts, setDrafts] = useState(null)     // { old:{count,tasks,remark}, yoga:{...} } | null
  const [password, setPassword] = useState('')
  const [pwModal, setPwModal] = useState(false)

  // ④ 접기/펴기 (localStorage 유지, 기본값 펼침)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('hexiang_widget_collapsed') === '1' } catch { return false }
  })
  const toggleCollapse = () => setCollapsed(c => {
    const n = !c
    try { localStorage.setItem('hexiang_widget_collapsed', n ? '1' : '0') } catch { /* ignore */ }
    return n
  })

  const toastTimer = useRef(null)
  const showToast = useCallback((type, msg) => {
    setToast({ type, msg })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1500)
  }, [])

  // 초기 로드 — KV 값 (없으면 기본값 유지). remark 없으면 빈 문자열 처리(호환).
  useEffect(() => {
    let alive = true
    fetchFactoryConfig()
      .then(d => {
        if (!alive) return
        if (d?.lines) {
          const oc = d.lines.old?.count ?? 15
          const yc = d.lines.yoga?.count ?? 6
          setLines({
            old: { count: oc, tasks: d.lines.old?.tasks || {}, remark: d.lines.old?.remark || '' },
            yoga: { count: yc, tasks: d.lines.yoga?.tasks || {}, remark: d.lines.yoga?.remark || '' },
          })
        }
      })
      .catch(err => console.error('[HexiangWidget] load', err))
      .finally(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [])

  useEffect(() => () => { clearTimeout(toastTimer.current) }, [])

  // ① 단일 수정 버튼 → 비밀번호 모달 → 양쪽 라인 동시 편집
  const requestEdit = () => setPwModal(true)
  const onPwSuccess = (pw) => {
    setPassword(pw)
    setDrafts({
      old: { count: lines.old.count, tasks: { ...lines.old.tasks }, remark: lines.old.remark || '' },
      yoga: { count: lines.yoga.count, tasks: { ...lines.yoga.tasks }, remark: lines.yoga.remark || '' },
    })
    setEditMode(true)
    setPwModal(false)
  }
  const onDraft = useCallback((lineId, partial) => {
    setDrafts(d => (d ? { ...d, [lineId]: { ...d[lineId], ...partial } } : d))
  }, [])
  const cancelEdit = () => { setEditMode(false); setDrafts(null) }
  const saveEdit = () => {
    if (!drafts) return
    const prune = (l) => {
      const t = {}
      for (const [k, v] of Object.entries(l.tasks || {})) if (Number(k) < l.count) t[k] = v
      return { count: l.count, tasks: t, remark: (l.remark || '').trim() }
    }
    const next = { old: prune(drafts.old), yoga: prune(drafts.yoga) }
    setLines(next); setEditMode(false); setDrafts(null)
    saveFactoryConfig(next, password)
      .then(res => showToast(res?.ok ? 'ok' : 'bad', res?.ok ? '저장됨 · 已保存' : '저장 실패 · 保存失败'))
      .catch(() => showToast('bad', '저장 실패 · 保存失败'))
  }
  const totalWorkers = (editMode && drafts)
    ? (drafts.old.count + drafts.yoga.count)
    : (lines.old.count + lines.yoga.count)

  return (
    <div style={{ display: visible ? 'block' : 'none' }} aria-hidden={!visible}>
      <style>{WIDGET_CSS}</style>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        {/* 제목 행 — ④ 접기/펴기 토글 + ① 제목 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: collapsed ? 0 : 12 }}>
          <button type="button" onClick={toggleCollapse} className="btn-ghost"
            title={collapsed ? '펴기 展开' : '접기 收起'}
            style={{ minHeight: 28, padding: '4px 9px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            {collapsed ? '펴기 · 展开' : '접기 · 收起'}
          </button>
          <div style={{ fontSize: 14, fontWeight: 700, color: G.tx }}>
            🏭 HEXIANG 合祥 공인 현황 · 工人情况
          </div>
          {/* 총 투입 인원 (실시간 합산) — ① 폰트/패딩 10% 축소 */}
          <span style={{ marginLeft: 'auto', fontSize: 12.9, fontWeight: 600, color: G.mu, background: G.cardAlt, border: `1px solid ${G.hair}`, borderRadius: 999, padding: '3.6px 11.7px', whiteSpace: 'nowrap' }}>
            총 <span className="num" style={{ color: G.accent, fontWeight: 700 }}>{totalWorkers}</span>명 투입 · 共{totalWorkers}名投入
          </span>
          {/* ① 총 투입 인원 우측 단일 수정 버튼 (양쪽 라인 동시 편집) */}
          {editMode ? (
            <>
              <button type="button" onClick={saveEdit} className="btn-primary" style={{ minHeight: 30, padding: '5px 11px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <Save size={12} /> 저장 保存
              </button>
              <button type="button" onClick={cancelEdit} className="btn-ghost" style={{ minHeight: 30, padding: '5px 11px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <X size={12} /> 취소 取消
              </button>
            </>
          ) : (
            <button type="button" onClick={requestEdit} className="btn-ghost" style={{ minHeight: 30, padding: '5px 11px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <Pencil size={12} /> 수정 修改
            </button>
          )}
        </div>

        {/* 본문 — 접힘 시 height 0 트랜지션 */}
        <div style={{ maxHeight: collapsed ? 0 : 3000, opacity: collapsed ? 0 : 1, overflow: 'hidden', transition: 'max-height 0.25s ease, opacity 0.25s ease' }}>
          <div className="hxw-body">
            {LINES.map((def, li) => (
              <WorkerLine
                key={def.id} G={G} lineIdx={li} def={def}
                line={lines[def.id]}
                editing={editMode}
                draft={drafts ? drafts[def.id] : null}
                onDraft={(partial) => onDraft(def.id, partial)}
              />
            ))}
          </div>
          {!loaded && (
            <div style={{ fontSize: 10.5, color: G.fa, marginTop: 8 }}>불러오는 중 · 加载中…</div>
          )}
        </div>
      </div>

      {/* ③ 비밀번호 모달 */}
      {pwModal && <PwModal G={G} onClose={() => setPwModal(false)} onSuccess={onPwSuccess} />}

      {/* 조용한 토스트 */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          zIndex: 2000, padding: '9px 16px', borderRadius: 9,
          background: toast.type === 'ok' ? G.ok : G.bad, color: '#fff', fontSize: 12.5, fontWeight: 600,
          boxShadow: '0 6px 20px rgba(0,0,0,0.22)', display: 'flex', alignItems: 'center', gap: 7,
          animation: 'fadeIn .2s ease', maxWidth: '90vw',
        }}>
          {toast.type === 'ok' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
