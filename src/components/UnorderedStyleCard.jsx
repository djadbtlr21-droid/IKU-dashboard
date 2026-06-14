import { useState } from 'react'
import { Pencil, Save, X, Check, Factory, MessageSquare, Trash2 } from 'lucide-react'
import ZohoImage from './ZohoImage'
import {
  F, pick, styleKey, imageField, styleImageUrl, styleStatusBadge,
} from '../utils/styleFields'

// ──────────────────────────────────────────────────────────
// 미오더 스타일 카드 (未下单)
// 체크리스트 대신: 스타일/샘플 상태 배지 + 오더예정공장 + 비고 + 오더 전환
// 오더예정공장·비고는 비밀번호 없이 "수정" 버튼 → input → 저장 (KV).
// ──────────────────────────────────────────────────────────
export default function UnorderedStyleCard({ G, style, factory, note, onZoom, onSaveFactory, onSaveNote, onConvert, onDelete }) {
  const sku = styleKey(style)
  const eng = pick(style, F.eng)
  const chi = pick(style, F.chi)
  const brand = pick(style, F.brand)
  const category = pick(style, F.category)
  const fabric = pick(style, F.fabric)
  const cost = pick(style, F.cost)
  const styleSt = pick(style, F.styleStatus)
  const sampleSt = pick(style, F.sampleStatus)
  const sb = styleStatusBadge(G, styleSt)
  const imgUrl = styleImageUrl(style)

  // 오더 예정 공장 편집
  const [editFactory, setEditFactory] = useState(false)
  const [draftFactory, setDraftFactory] = useState(factory || '')
  // 비고 편집
  const [editNote, setEditNote] = useState(false)
  const [draftNote, setDraftNote] = useState(note || '')
  // 오더 전환 확인
  const [confirmConvert, setConfirmConvert] = useState(false)
  // 삭제 확인
  const [confirmDelete, setConfirmDelete] = useState(false)

  const startFactory = () => { setDraftFactory(factory || ''); setEditFactory(true) }
  const saveFactory = () => { onSaveFactory(sku, draftFactory.trim()); setEditFactory(false) }
  const startNote = () => { setDraftNote(note || ''); setEditNote(true) }
  const saveNote = () => { onSaveNote(sku, draftNote.trim()); setEditNote(false) }

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '5px 8px', fontSize: 11.5, border: `1px solid ${G.border}`, borderRadius: 6, background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit' }
  const miniBtn = (extra = {}) => ({ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 600, padding: '3px 8px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${G.border}`, background: 'transparent', color: G.mu, ...extra })

  const infoLine = (label, val) => val ? (
    <div style={{ display: 'flex', gap: 6, fontSize: 11, lineHeight: 1.45 }}>
      <span style={{ color: G.fa, flexShrink: 0 }}>{label}</span>
      <span style={{ color: G.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
    </div>
  ) : null

  return (
    <div className="card" style={{ padding: 0, overflow: 'visible', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* 이미지 + 상태 배지 */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', background: G.cardAlt, borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: 'hidden' }}>
        <div style={{ width: '100%', height: '100%', cursor: imgUrl ? 'zoom-in' : 'default' }}
          onClick={() => { if (imgUrl) onZoom(imgUrl) }}>
          <ZohoImage mo={style} field={imageField(style) || 'Style_Image'} G={G} alt={sku} placeholderText="No Image · 无图片" />
        </div>
        <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          {sb && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: sb.color, padding: '2px 8px', borderRadius: 999, boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>{sb.label}</span>}
          {sampleSt && <span style={{ fontSize: 9.5, fontWeight: 600, color: G.tx, background: 'rgba(255,255,255,0.88)', padding: '2px 7px', borderRadius: 999 }}>{sampleSt}</span>}
        </div>
        {/* ② 미오더 배지(한/중) + ③ 삭제 버튼 (우상단) */}
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: G.bad, padding: '2px 7px', borderRadius: 999 }}>미오더 · 未下单</span>
          <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }} title="삭제 · 删除"
            style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', border: 'none', background: 'rgba(0,0,0,0.5)', color: '#fff' }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* 정보 */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div className="syne" style={{ fontSize: 13.5, fontWeight: 700, color: G.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pick(style, F.sku) || sku}</div>
        {eng && <div style={{ fontSize: 11.5, color: G.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eng}</div>}
        {chi && <div style={{ fontSize: 11, color: G.mu, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chi}</div>}
        <div style={{ height: 1, background: G.hair, margin: '5px 0' }} />
        {infoLine('브랜드 品牌', brand)}
        {infoLine('분류 分类', category)}
        {infoLine('원단 面料', fabric)}
        {infoLine('원가 成本', cost)}

        {/* ①② 상태 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
          <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
            <span style={{ color: G.fa, flexShrink: 0, width: 64 }}>样品状态</span>
            <span style={{ color: styleSt ? G.tx : G.fa, fontWeight: 500 }}>{styleSt || '—'}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
            <span style={{ color: G.fa, flexShrink: 0, width: 64 }}>打样状态</span>
            <span style={{ color: sampleSt ? G.tx : G.fa, fontWeight: 500 }}>{sampleSt || '—'}</span>
          </div>
        </div>

        {/* ③ 오더 예정 공장 */}
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 10.5, color: G.mu, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Factory size={11} /> 오더예정공장 · 预计下单工厂</span>
            {!editFactory && <button type="button" onClick={startFactory} style={miniBtn()}><Pencil size={10} /> 수정 修改</button>}
          </div>
          {editFactory ? (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <input value={draftFactory} maxLength={60} onChange={e => setDraftFactory(e.target.value)} placeholder="공장명 · 工厂名" style={inputStyle} autoFocus />
              <button type="button" onClick={saveFactory} style={miniBtn({ color: '#fff', background: G.tx, borderColor: G.tx })}><Save size={11} /></button>
              <button type="button" onClick={() => setEditFactory(false)} style={miniBtn()}><X size={11} /></button>
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: factory ? G.tx : G.fa, fontWeight: factory ? 600 : 400 }}>{factory || '미정 · 未定'}</div>
          )}
        </div>

        {/* ④ 비고 */}
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 10.5, color: G.mu, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><MessageSquare size={11} /> 비고 · 备注</span>
            {!editNote && <button type="button" onClick={startNote} style={miniBtn()}><Pencil size={10} /> 수정 修改</button>}
          </div>
          {editNote ? (
            <div style={{ display: 'flex', gap: 5, alignItems: 'flex-start' }}>
              <textarea value={draftNote} maxLength={300} rows={2} onChange={e => setDraftNote(e.target.value)} placeholder="비고 입력 · 输入备注" style={{ ...inputStyle, resize: 'vertical' }} autoFocus />
              <button type="button" onClick={saveNote} style={miniBtn({ color: '#fff', background: G.tx, borderColor: G.tx })}><Save size={11} /></button>
              <button type="button" onClick={() => setEditNote(false)} style={miniBtn()}><X size={11} /></button>
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: note ? G.tx : G.fa, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{note || '—'}</div>
          )}
        </div>

        {/* 하단 — 오더 전환 */}
        <button type="button" onClick={() => setConfirmConvert(true)} className="btn-ghost"
          style={{ marginTop: 10, minHeight: 34, padding: '7px 10px', fontSize: 11.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <Check size={13} /> 오더 전환 · 转为已下单
        </button>
      </div>

      {/* 오더 전환 확인 모달 (카드 위 오버레이) */}
      {confirmConvert && (
        <div onClick={e => { if (e.target === e.currentTarget) setConfirmConvert(false) }}
          style={{ position: 'absolute', inset: 0, background: G.overlayBg, borderRadius: 12, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: 16, boxShadow: G.cardShadow, textAlign: 'center', maxWidth: 220 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: G.tx, marginBottom: 4 }}>이 스타일이 오더되었나요?</div>
            <div style={{ fontSize: 11, color: G.mu, marginBottom: 12 }}>该款式已下单了吗？<br /><span style={{ fontSize: 10, color: G.fa }}>목록에서 숨겨집니다 (Zoho 변경 없음)</span></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button type="button" onClick={() => setConfirmConvert(false)} className="btn-ghost" style={{ minHeight: 32, padding: '6px 12px', fontSize: 11 }}>취소 取消</button>
              <button type="button" onClick={() => { setConfirmConvert(false); onConvert(sku) }} className="btn-primary" style={{ minHeight: 32, padding: '6px 12px', fontSize: 11 }}>확인 确认</button>
            </div>
          </div>
        </div>
      )}

      {/* ③ 삭제 확인 모달 */}
      {confirmDelete && (
        <div onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(false) }}
          style={{ position: 'absolute', inset: 0, background: G.overlayBg, borderRadius: 12, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: 16, boxShadow: G.cardShadow, textAlign: 'center', maxWidth: 230 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: G.tx, marginBottom: 4 }}>이 항목을 목록에서 삭제하시겠습니까?</div>
            <div style={{ fontSize: 11, color: G.mu, marginBottom: 10 }}>确认从列表中删除此项目？</div>
            <div style={{ fontSize: 10, color: G.fa, marginBottom: 12 }}>Zoho ERP 데이터는 변경되지 않습니다<br />Zoho ERP数据不会被修改</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button type="button" onClick={() => setConfirmDelete(false)} className="btn-ghost" style={{ minHeight: 32, padding: '6px 12px', fontSize: 11 }}>취소 取消</button>
              <button type="button" onClick={() => { setConfirmDelete(false); onDelete(sku) }} className="btn-primary" style={{ minHeight: 32, padding: '6px 12px', fontSize: 11, background: G.bad, borderColor: G.bad }}>확인 确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
