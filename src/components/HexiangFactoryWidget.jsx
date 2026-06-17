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

// 작업복 팔레트 (8가지)
const SUITS = ['#C0392B','#8BBEDB','#A8D5A2','#7C3AED','#F2A65A','#B8A9D9','#F4A7B9','#0F766E']
// 다리 색상 — suit보다 한 톤 어둡게
const LEG_DARK = {
  '#C0392B':'#922B21',
  '#8BBEDB':'#5A9AB8',
  '#A8D5A2':'#6BAF65',
  '#7C3AED':'#6D28D9',
  '#F2A65A':'#C97A2E',
  '#B8A9D9':'#8B78B8',
  '#F4A7B9':'#D4758A',
  '#0F766E':'#0F5659',
}
// 레고 표준 노란색
const LEGO_YELLOW = '#F5CD2F'
// 헤어 색상 6가지 순환
const HAIR_COLORS = ['#1F2937','#92400E','#111827','#7C3AED','#78350F','#1D4ED8']
// ⑤ 옷감 색상 6가지 (검/회/흰/분홍/파랑/초록)
const FABRIC_COLORS = ['#1F2937','#9CA3AF','#F1F5F9','#FBCFE8','#BFDBFE','#BBF7D0']

// 위상 오프셋 — 공인마다 애니메이션 시작점을 다르게.
const phase = (idx, lineIdx, mod) => `-${(idx * 41 + lineIdx * 97) % mod}ms`

// 위젯 전용 CSS (전역 충돌 방지를 위해 hx 프리픽스).
const WIDGET_CSS = `
@keyframes hxNeedle { 0%,100%{transform:translateY(0)} 50%{transform:translateY(5px)} }
@keyframes hxBob    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-1.8px)} }
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
// 공인 SVG — 앉은 자세 레고 공인 + 세련된 재봉틀 (viewBox 0 0 44 72)
// ──────────────────────────────────────────────────────────
function SewingWorker({ idx, lineIdx }) {
  const ci       = lineIdx * 7 + idx
  const suit     = SUITS[ci % 8]
  const leg      = LEG_DARK[suit]
  const fc       = FABRIC_COLORS[ci % 6]
  const hc       = HAIR_COLORS[ci % 6]
  const isFemale = (lineIdx + idx) % 2 === 0
  const fabricType = ci % 4

  // ⑤ 흰색 계열 옷감은 stroke 윤곽선으로 구분
  const isWhiteFabric = fc === '#F1F5F9'
  const seamColor     = isWhiteFabric ? 'rgba(100,116,139,0.4)' : 'rgba(255,255,255,0.18)'
  const fStroke       = isWhiteFabric ? '#CBD5E1' : 'none'
  const fSW           = isWhiteFabric ? '0.8' : '0'

  const nd = `-${(idx * 41 + lineIdx * 97) % 450}ms`
  // ④ bob 주기 1.13s
  const bd = `-${(idx * 41 + lineIdx * 97 + 300) % 1130}ms`
  const ad = `-${(idx * 41 + lineIdx * 97 + 100) % 800}ms`

  const femaleHair = () => {
    switch (ci % 5) {
      case 0: return <>
        <path d="M13,7 Q10,14 10,20 Q9,24 13,25" stroke={hc} strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        <path d="M31,7 Q34,14 34,20 Q35,24 31,25" stroke={hc} strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        <rect x="13" y="1" width="18" height="7" rx="3.5" fill={hc}/>
      </>
      case 1: return <>
        <path d="M13,7 Q10,12 11,17" stroke={hc} strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        <path d="M31,7 Q34,12 33,17" stroke={hc} strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        <rect x="13" y="1" width="18" height="7" rx="3.5" fill={hc}/>
        <path d="M12,17 Q22,21 32,17" stroke={hc} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      </>
      case 2: return <>
        <rect x="13" y="1" width="18" height="7" rx="3.5" fill={hc}/>
        <ellipse cx="22" cy="0" rx="4" ry="2.5" fill={hc}/>
        <path d="M23,-1 Q31,-4 33,2" stroke={hc} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      </>
      case 3: return <>
        <path d="M13,7 Q9,11 11,15 Q13,19 10,22" stroke={hc} strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        <path d="M31,7 Q35,11 33,15 Q31,19 34,22" stroke={hc} strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        <rect x="13" y="1" width="18" height="7" rx="3.5" fill={hc}/>
      </>
      default: return <>
        <path d="M13,7 Q10,11 11,16" stroke={hc} strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        <path d="M31,7 Q34,11 33,16" stroke={hc} strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        <rect x="13" y="1" width="18" height="7" rx="3.5" fill={hc}/>
        <path d="M12,16 Q22,20 32,16" stroke={hc} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <circle cx="13" cy="7" r="2.5" fill="#FCA5A5"/>
        <circle cx="13" cy="7" r="1.2" fill="#FDE68A"/>
      </>
    }
  }

  const maleHair = () => {
    switch (ci % 6) {
      case 0: return <>
        <rect x="13" y="1" width="18" height="8" rx="4" fill={hc}/>
        <rect x="12" y="6" width="20" height="3" rx="1" fill={hc}/>
      </>
      case 1: return <>
        <rect x="13" y="1" width="18" height="8" rx="4" fill={hc}/>
        <rect x="11" y="5" width="5" height="5" rx="2" fill={hc}/>
        <rect x="28" y="5" width="5" height="5" rx="2" fill={hc}/>
      </>
      case 2: return <>
        <rect x="13" y="3" width="18" height="6" rx="2" fill={hc}/>
        <rect x="19" y="0" width="6" height="6" rx="3" fill={hc}/>
      </>
      case 3: return <>
        <rect x="13" y="1" width="18" height="8" rx="4" fill={hc}/>
        <path d="M22,1 L20,9" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeLinecap="round"/>
        <rect x="11" y="5" width="4" height="4" rx="2" fill={hc}/>
      </>
      case 4: return <>
        <circle cx="16" cy="5" r="4" fill={hc}/>
        <circle cx="22" cy="2.5" r="4" fill={hc}/>
        <circle cx="28" cy="5" r="4" fill={hc}/>
        <rect x="13" y="5" width="18" height="4" rx="1" fill={hc}/>
      </>
      default: return <>
        <rect x="13" y="1" width="18" height="8" rx="4" fill={hc}/>
        <path d="M13,5 Q10,7 10,11" stroke={hc} strokeWidth="3" fill="none" strokeLinecap="round"/>
      </>
    }
  }

  return (
    <svg viewBox="0 0 44 72" width="56" height="72"
      style={{ display: 'block', margin: '14px auto 0', overflow: 'visible' }}
      aria-hidden="true">

      {/* ── 공인 전체 — bob 애니메이션 (재봉틀·옷감·바늘은 밖에 고정) ── */}
      <g style={{ animation: `hxBob 1.13s ease-in-out ${bd} infinite`, transformBox: 'view-box', transformOrigin: '22px 36px' }}>

      {/* ── Layer 1: 헤어 (머리 뒤) ── */}
      {isFemale ? femaleHair() : maleHair()}

      {/* ── Layer 2: 얼굴 ── */}
      <rect x="13" y="6" width="18" height="15" rx="5" fill={LEGO_YELLOW}/>
      <path d="M17,11 Q19,10 21,11" stroke="#78350F" strokeWidth="0.8" fill="none"/>
      <path d="M23,11 Q25,10 27,11" stroke="#78350F" strokeWidth="0.8" fill="none"/>
      <ellipse cx="19" cy="13.5" rx="1.8" ry="2" fill="#1F2937"/>
      <ellipse cx="25" cy="13.5" rx="1.8" ry="2" fill="#1F2937"/>
      <circle cx="19.7" cy="12.8" r="0.65" fill="white"/>
      <circle cx="25.7" cy="12.8" r="0.65" fill="white"/>
      {isFemale ? (
        <>
          <path d="M18.5,18 Q22,20.5 25.5,18" stroke="#B45309" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <circle cx="18.5" cy="16" r="0.75" fill="#F97316" opacity="0.45"/>
          <circle cx="25.5" cy="16" r="0.75" fill="#F97316" opacity="0.45"/>
        </>
      ) : (
        <path d="M19,18 Q22,20 25,18" stroke="#92400E" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      )}

      {/* ── Layer 3: 목+어깨+몸통 ── */}
      <rect x="19.5" y="21" width="5" height="3" rx="1" fill={LEGO_YELLOW}/>
      <rect x="10" y="23" width="24" height="3" rx="1.5" fill={suit}/>
      <rect x="13" y="25" width="18" height="12" rx="2.5" fill={suit}/>
      <rect x="13" y="25" width="18" height="4" rx="2.5" fill="rgba(255,255,255,0.1)"/>
      <line x1="22" y1="27" x2="22" y2="36" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8"/>
      <circle cx="22" cy="29" r="0.9" fill="rgba(255,255,255,0.35)"/>
      <circle cx="22" cy="32" r="0.9" fill="rgba(255,255,255,0.35)"/>
      <circle cx="22" cy="35" r="0.9" fill="rgba(255,255,255,0.35)"/>

      {/* ── Layer 4: 팔+손 (앞으로 뻗어 재봉틀 위) ── */}
      <path d="M13,27 Q9,33 8,40" stroke={suit} strokeWidth="5" strokeLinecap="round" fill="none"
        style={{ animation: `hxTilt 0.9s ease-in-out ${ad} infinite`, transformBox: 'view-box', transformOrigin: '13px 27px' }}/>
      <path d="M31,27 Q35,33 36,40" stroke={suit} strokeWidth="5" strokeLinecap="round" fill="none"
        style={{ animation: `hxTilt 0.9s ease-in-out ${ad} infinite reverse`, transformBox: 'view-box', transformOrigin: '31px 27px' }}/>
      <circle cx="8" cy="41" r="3" fill={LEGO_YELLOW}/>
      <circle cx="36" cy="41" r="3" fill={LEGO_YELLOW}/>

      {/* ── Layer 5: 다리+발+의자시트 (앉은 자세) ── */}
      <rect x="9" y="37" width="11" height="5" rx="2" fill={leg}/>
      <rect x="24" y="37" width="11" height="5" rx="2" fill={leg}/>
      <rect x="9" y="42" width="5" height="9" rx="2" fill={leg}/>
      <rect x="30" y="42" width="5" height="9" rx="2" fill={leg}/>
      <rect x="7" y="50" width="9" height="3.5" rx="1.8" fill="#1C1917"/>
      <rect x="28" y="50" width="9" height="3.5" rx="1.8" fill="#1C1917"/>
      <rect x="8" y="50" width="4" height="1.5" rx="0.75" fill="rgba(255,255,255,0.1)"/>
      <rect x="29" y="50" width="4" height="1.5" rx="0.75" fill="rgba(255,255,255,0.1)"/>
      <rect x="8" y="42" width="28" height="1.5" rx="0.75" fill="#94A3B8" opacity="0.4"/>

      </g>

      {/* ── Layer 6: 재봉틀 본체 (bob 밖 — 고정) ── */}
      <rect x="2" y="55" width="40" height="14" rx="3.5" fill="#E2E8F0"/>
      <rect x="3" y="56" width="38" height="12" rx="3" fill="#CBD5E1"/>
      <rect x="4" y="54" width="36" height="9" rx="2.5" fill="#F1F5F9"/>
      <rect x="5" y="54.5" width="16" height="2.5" rx="1.25" fill="rgba(255,255,255,0.65)"/>
      <rect x="30" y="55.5" width="9" height="6" rx="1.5" fill="#94A3B8"/>
      <rect x="31" y="56.5" width="3" height="1.2" rx="0.6" fill="#475569"/>
      <rect x="31" y="58.5" width="3" height="1.2" rx="0.6" fill="#475569"/>
      <circle cx="38" cy="59" r="3" fill="#64748B"/>
      <circle cx="38" cy="59" r="1.8" fill="#94A3B8"/>
      <circle cx="38" cy="59" r="0.7" fill="#475569"/>
      <ellipse cx="12" cy="54" rx="2.3" ry="1.3" fill="#CBD5E1"/>
      <ellipse cx="20" cy="54" rx="2.3" ry="1.3" fill="#CBD5E1"/>
      <ellipse cx="28" cy="54" rx="2.3" ry="1.3" fill="#CBD5E1"/>

      {/* ── Layer 7: 옷감 (상판 위) — 4형태 × 6색상, 흰색은 윤곽선 추가 ── */}
      {fabricType === 0 && <>
        {/* 티셔츠 */}
        <rect x="11" y="48" width="22" height="9" rx="1.5" fill={fc} opacity="0.92" stroke={fStroke} strokeWidth={fSW}/>
        <path d="M11,48 Q7,47 6,50 Q7,52 11,52 Z" fill={fc} opacity="0.92" stroke={fStroke} strokeWidth={fSW}/>
        <path d="M33,48 Q37,47 38,50 Q37,52 33,52 Z" fill={fc} opacity="0.92" stroke={fStroke} strokeWidth={fSW}/>
        <path d="M17,48 Q22,45.5 27,48" stroke={seamColor} strokeWidth="0.9" fill="none"/>
        <line x1="29" y1="48" x2="29" y2="57" stroke={seamColor} strokeWidth="0.6" strokeDasharray="2,2"/>
      </>}
      {fabricType === 1 && <>
        {/* 바지 */}
        <rect x="11" y="46" width="22" height="3.5" rx="1.5" fill={fc} opacity="0.95" stroke={fStroke} strokeWidth={fSW}/>
        <rect x="11" y="49" width="9.5" height="8" rx="1.5" fill={fc} opacity="0.92" stroke={fStroke} strokeWidth={fSW}/>
        <rect x="23.5" y="49" width="9.5" height="8" rx="1.5" fill={fc} opacity="0.92" stroke={fStroke} strokeWidth={fSW}/>
        <line x1="22" y1="49.5" x2="22" y2="57" stroke={seamColor} strokeWidth="0.6" strokeDasharray="1.5,2"/>
        <line x1="29" y1="46" x2="29" y2="57" stroke={seamColor} strokeWidth="0.6" strokeDasharray="2,2"/>
      </>}
      {fabricType === 2 && <>
        {/* 원단 롤 */}
        <rect x="8" y="50" width="28" height="7" rx="3.5" fill={fc} opacity="0.85" stroke={fStroke} strokeWidth={fSW}/>
        <ellipse cx="22" cy="50" rx="14" ry="3" fill={fc} opacity="0.95" stroke={fStroke} strokeWidth={fSW}/>
        <line x1="10" y1="50" x2="34" y2="50" stroke={seamColor} strokeWidth="0.5" strokeDasharray="3,2"/>
        <line x1="10" y1="52" x2="34" y2="52" stroke={isWhiteFabric ? 'rgba(100,116,139,0.3)' : 'rgba(255,255,255,0.15)'} strokeWidth="0.5" strokeDasharray="3,2"/>
        <line x1="29" y1="48" x2="29" y2="57" stroke={seamColor} strokeWidth="0.6" strokeDasharray="2,2"/>
      </>}
      {fabricType === 3 && <>
        {/* 조끼/민소매 */}
        <rect x="14" y="47" width="16" height="10" rx="1.5" fill={fc} opacity="0.92" stroke={fStroke} strokeWidth={fSW}/>
        <rect x="15" y="45" width="4" height="4" rx="1" fill={fc} opacity="0.9" stroke={fStroke} strokeWidth={fSW}/>
        <rect x="25" y="45" width="4" height="4" rx="1" fill={fc} opacity="0.9" stroke={fStroke} strokeWidth={fSW}/>
        <path d="M17,47 L22,51 L27,47" stroke={isWhiteFabric ? 'rgba(100,116,139,0.45)' : 'rgba(255,255,255,0.25)'} strokeWidth="0.8" fill="none"/>
        <line x1="29" y1="47" x2="29" y2="57" stroke={seamColor} strokeWidth="0.6" strokeDasharray="2,2"/>
      </>}

      {/* ── Layer 8: 바늘 어셈블리 (은색) ── */}
      <rect x="17" y="47" width="13" height="2" rx="1" fill="#64748B"/>
      <rect x="28" y="49" width="2.5" height="3" rx="1.25" fill="#64748B"/>
      <g style={{ animation: `hxNeedle 0.45s ease-in-out ${nd} infinite`, transformBox: 'view-box', transformOrigin: '29.25px 52px' }}>
        <rect x="28.5" y="52" width="1.5" height="8" rx="0.75" fill="#C0C8D4"/>
        <rect x="28.3" y="52" width="1.9" height="3" rx="0.75" fill="#D8DEE6"/>
        <path d="M28.5,60 L29.25,62.5 L30,60" fill="#A8B4C0"/>
        <circle cx="29.25" cy="61.5" r="0.9" fill="white" opacity="0.4"/>
      </g>

      {/* ── Layer 9: 실 장식 ── */}
      <path d="M18,47 Q16,42 17,38" stroke="#94A3B8" strokeWidth="0.5" fill="none" strokeDasharray="1.5,2" opacity="0.5"/>
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
