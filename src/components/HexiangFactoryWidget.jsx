import { useState, useEffect, useRef, useCallback } from 'react'
import { Minus, Plus, Users, CheckCircle2, AlertTriangle } from 'lucide-react'
import { fetchFactoryConfig, saveFactoryConfig } from '../api/client'

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
  { id: 'yoga', kr: '4楼瑜伽车间 · 4층 요가 라인' },
]

// 옷감(검정·다크그레이만) / 작업복 / 피부색 순환 팔레트
const FABRIC = ['#111827', '#1F2937', '#374151', '#4B5563']
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

  const dNeedle = { animationDelay: phase(idx, lineIdx, 400) }
  const dBob = { animationDelay: phase(idx, lineIdx, 1200) }
  const dTilt = { animationDelay: phase(idx, lineIdx, 800) }

  return (
    <svg viewBox="0 0 44 72" width="58" style={{ display: 'block', margin: '0 auto', overflow: 'visible' }} aria-hidden="true">
      <g className="hxw-bob" style={dBob}>
        {/* ── 재봉틀 (하단) ── */}
        <rect x="5" y="54" width="34" height="15" rx="2" fill="#9CA3AF" />
        <rect x="2" y="46" width="40" height="9" rx="1.5" fill="#D1D5DB" />
        <circle cx="36" cy="50.5" r="2.3" fill="#9CA3AF" />

        {/* ── 옷감 (기계 상판 위) — 검정·다크그레이만 ── */}
        {isPants ? (
          <g>
            {/* 바지: 허리밴드 + 다리 두 개 */}
            <rect x="11" y="40" width="16" height="3" rx="1" fill={cloth} />
            <path d="M11 43 L17 43 L17.5 49 L14 49 Z" fill={cloth} />
            <path d="M21 43 L27 43 L24 49 L20.5 49 Z" fill={cloth} />
            <line x1="19" y1="43" x2="19" y2="49" stroke="#fff" strokeWidth="0.6" strokeDasharray="2,2" opacity="0.5" />
          </g>
        ) : (
          <g>
            {/* 티셔츠: 어깨+소매+몸통 실루엣 */}
            <path d="M13 41 L16 39 L22 39 L25 41 L23 44 L22 43 L22 48 L16 48 L16 43 L15 44 Z" fill={cloth} />
            <line x1="16.5" y1="41.5" x2="21.5" y2="41.5" stroke={cloth} strokeWidth="0.6" strokeDasharray="1.5,1.5" opacity="0.85" />
            {/* 가슴선 점선 */}
            <line x1="19" y1="42.5" x2="19" y2="47" stroke="#fff" strokeWidth="0.6" strokeDasharray="2,2" opacity="0.5" />
          </g>
        )}

        {/* ── 바늘 + 바늘암 ── */}
        <rect x="33" y="26" width="3.5" height="20" rx="1" fill="#4B5563" />
        <rect x="16" y="26" width="18" height="3.5" rx="1" fill="#4B5563" />
        <rect className="hxw-needle" style={dNeedle} x="18.1" y="29.5" width="1.6" height="9" fill="#374151" />
        <circle className="hxw-dot" style={dNeedle} cx="18.9" cy="42.5" r="1" fill="#fff" opacity="0.4" />

        {/* ── 공인 (앉아서 작업 중) — 상체+팔에 tilt ── */}
        <g className="hxw-tilt" style={dTilt}>
          {/* 팔: 몸통 → 테이블 면 방향 (아래·앞) */}
          <line x1="13.5" y1="26" x2="15.5" y2="40.5" stroke={wear} strokeWidth="2.6" strokeLinecap="round" />
          <line x1="24.5" y1="26" x2="22.5" y2="40.5" stroke={wear} strokeWidth="2.6" strokeLinecap="round" />
          {/* 상체 */}
          <rect x="11" y="22" width="16" height="12" rx="5" fill={wear} />
          {/* 손 (테이블 가장자리) */}
          <circle cx="15.5" cy="41" r="2" fill={skin} />
          <circle cx="22.5" cy="41" r="2" fill={skin} />
          {/* 머리 */}
          <circle cx="19" cy="14" r="6.5" fill={skin} />
          <ellipse cx="19" cy="10" rx="7.3" ry="4.8" fill="#1F2937" />
          {/* 눈 (아래를 내려다보는 형태) */}
          <ellipse cx="16.4" cy="15.2" rx="0.85" ry="1.5" fill="#1F2937" />
          <ellipse cx="21.6" cy="15.2" rx="0.85" ry="1.5" fill="#1F2937" />
          {/* 눈썹 (집중·안쪽으로 기울어짐) */}
          <line x1="14.3" y1="12.3" x2="17" y2="13.1" stroke="#1F2937" strokeWidth="0.9" strokeLinecap="round" />
          <line x1="23.7" y1="12.3" x2="21" y2="13.1" stroke="#1F2937" strokeWidth="0.9" strokeLinecap="round" />
          {/* 입 (집중 미소) */}
          <path d="M16.8 18 Q19 19.6 21.2 18" stroke="#1F2937" strokeWidth="0.9" fill="none" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  )
}

// ──────────────────────────────────────────────────────────
// 한 라인 (헤더 + 공인 그리드)
// ──────────────────────────────────────────────────────────
function WorkerLine({ G, lineIdx, def, count, tasks, onCountChange, onTaskChange }) {
  // fadein/fadeout 연출용 로컬 인덱스 추적
  const [entering, setEntering] = useState(null)   // 막 추가된 인덱스
  const [leaving, setLeaving] = useState(null)     // 사라지는 중인 인덱스
  const enterTimer = useRef(null)
  const leaveTimer = useRef(null)

  useEffect(() => () => { clearTimeout(enterTimer.current); clearTimeout(leaveTimer.current) }, [])

  const add = () => {
    if (count >= 100 || leaving !== null) return
    const newIdx = count
    onCountChange(count + 1)          // 즉시 저장
    setEntering(newIdx)
    clearTimeout(enterTimer.current)
    enterTimer.current = setTimeout(() => setEntering(null), 320)
  }

  const remove = () => {
    if (count <= 0 || leaving !== null) return
    const removeIdx = count - 1
    setLeaving(removeIdx)             // fadeout 시작 (DOM 은 잠시 유지)
    clearTimeout(leaveTimer.current)
    leaveTimer.current = setTimeout(() => {
      setLeaving(null)
      onCountChange(count - 1)        // 0.2s 후 실제 제거 + 즉시 저장
    }, 200)
  }

  // 렌더링 인덱스: leaving 중이면 그 셀을 한 번 더 보여줌
  const total = leaving !== null ? Math.max(count, leaving + 1) : count
  const cells = []
  for (let i = 0; i < total; i++) cells.push(i)

  return (
    <div style={{ background: G.cardAlt, border: `0.5px solid ${G.hair}`, borderRadius: 10, padding: 12, minWidth: 0 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: G.tx }}>{def.kr}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600, color: G.accent, background: G.dk ? 'rgba(232,200,152,0.12)' : 'rgba(201,168,110,0.14)', border: `1px solid ${G.hair}`, borderRadius: 999, padding: '2px 8px' }}>
            <Users size={11} /> {count}명 작업 중 · {count}名工人
          </span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <button type="button" onClick={remove} aria-label="감소" title="감소 减少"
              style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', border: `1px solid ${G.border}`, background: 'transparent', color: G.mu }}>
              <Minus size={13} />
            </button>
            <span className="num" style={{ minWidth: 18, textAlign: 'center', fontSize: 13, fontWeight: 700, color: G.tx }}>{count}</span>
            <button type="button" onClick={add} aria-label="증가" title="증가 增加"
              style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', border: `1px solid ${G.border}`, background: 'transparent', color: G.mu }}>
              <Plus size={13} />
            </button>
          </div>
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
                  onChange={e => onTaskChange(i, e.target.value)}
                  placeholder="공정명 工序"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '3px 4px', fontSize: 9.5, textAlign: 'center', border: `1px solid ${G.border}`, borderRadius: 5, background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit' }}
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
  const [lines, setLines] = useState({ old: { count: 15, tasks: {} }, yoga: { count: 6, tasks: {} } })
  const [loaded, setLoaded] = useState(false)
  const [toast, setToast] = useState(null)   // { type:'ok'|'bad', msg }

  const taskTimer = useRef(null)
  const toastTimer = useRef(null)
  const linesRef = useRef(lines)
  useEffect(() => { linesRef.current = lines }, [lines])

  const showToast = useCallback((type, msg) => {
    setToast({ type, msg })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1500)
  }, [])

  // 초기 로드 — KV 값 (없으면 기본값 유지)
  useEffect(() => {
    let alive = true
    fetchFactoryConfig()
      .then(d => {
        if (!alive) return
        if (d?.lines) {
          setLines({
            old: { count: d.lines.old?.count ?? 15, tasks: d.lines.old?.tasks || {} },
            yoga: { count: d.lines.yoga?.count ?? 6, tasks: d.lines.yoga?.tasks || {} },
          })
        }
      })
      .catch(err => console.error('[HexiangWidget] load', err))
      .finally(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [])

  useEffect(() => () => { clearTimeout(taskTimer.current); clearTimeout(toastTimer.current) }, [])

  const persist = useCallback((next) => {
    saveFactoryConfig(next)
      .then(res => { if (res?.ok) showToast('ok', '저장됨 · 已保存'); else showToast('bad', '저장 실패 · 保存失败') })
      .catch(() => showToast('bad', '저장 실패 · 保存失败'))
  }, [showToast])

  // 인원 변경 → 즉시 저장 (count 줄 때 범위 밖 공정명 정리)
  const handleCount = useCallback((lineId, nextCount) => {
    setLines(prev => {
      const line = prev[lineId]
      const tasks = {}
      for (const [k, v] of Object.entries(line.tasks)) {
        if (Number(k) < nextCount) tasks[k] = v
      }
      const next = { ...prev, [lineId]: { count: nextCount, tasks } }
      persist(next)
      return next
    })
  }, [persist])

  // 공정명 변경 → 1초 디바운스 저장
  const handleTask = useCallback((lineId, idx, value) => {
    setLines(prev => {
      const line = prev[lineId]
      const tasks = { ...line.tasks }
      if (value) tasks[String(idx)] = value
      else delete tasks[String(idx)]
      return { ...prev, [lineId]: { ...line, tasks } }
    })
    clearTimeout(taskTimer.current)
    taskTimer.current = setTimeout(() => persist(linesRef.current), 1000)
  }, [persist])

  return (
    <div style={{ display: visible ? 'block' : 'none' }} aria-hidden={!visible}>
      <style>{WIDGET_CSS}</style>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: G.tx, marginBottom: 12 }}>
          🏭 HEXIANG 合祥 공장 현황 · 工厂现场
        </div>
        <div className="hxw-body">
          {LINES.map((def, li) => (
            <WorkerLine
              key={def.id} G={G} lineIdx={li} def={def}
              count={lines[def.id].count}
              tasks={lines[def.id].tasks}
              onCountChange={(n) => handleCount(def.id, n)}
              onTaskChange={(idx, v) => handleTask(def.id, idx, v)}
            />
          ))}
        </div>
        {!loaded && (
          <div style={{ fontSize: 10.5, color: G.fa, marginTop: 8 }}>불러오는 중 · 加载中…</div>
        )}
      </div>

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
