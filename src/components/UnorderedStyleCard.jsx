import { useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import ZohoImage from './ZohoImage'
import {
  F, pick, styleKey, imageField, styleImageUrl, statusInfo,
} from '../utils/styleFields'

// ──────────────────────────────────────────────────────────
// 미오더 스타일 카드 (未下单)
// 수정 모드는 섹션 단위로 통합 제어(editMode prop). 카드 내 개별 수정 버튼 없음.
// 이미지 오버레이 없음 — 모든 정보는 이미지 아래 텍스트 영역에 표시.
// ──────────────────────────────────────────────────────────
export default function UnorderedStyleCard({
  G, style, factory, note, editMode, draftFactory, draftNote,
  onChangeFactory, onChangeNote, onConvert, onDelete, onZoom, onOpenDetail,
}) {
  const sku = styleKey(style)
  const chi = pick(style, F.chi)
  const brand = pick(style, F.brand)
  const gender = pick(style, F.gender)
  const category = pick(style, F.category)
  const fabric = pick(style, F.fabric)
  const styleSt = pick(style, F.styleStatus)    // 샘플 상태 (打样状态)
  const sampleSt = pick(style, F.sampleStatus)  // 승인 상태 (审批状态)
  const imgUrl = styleImageUrl(style)
  const sInfo = statusInfo(G, styleSt)
  const aInfo = statusInfo(G, sampleSt)

  const [confirmConvert, setConfirmConvert] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '4px 6px', fontSize: 10, border: `1px solid ${G.border}`, borderRadius: 5, background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit' }

  // ③ 상태: 라벨(뮤트) + 값(2줄, 말줄임 없음, 상태색/깜빡)
  const statusBlock = (kr, cn, val, info) => (
    <div style={{ marginTop: 2 }}>
      <div style={{ fontSize: 9, color: G.fa }}>{kr} {cn}</div>
      <div className={info?.blink ? 'mio-blink' : undefined}
        style={{ fontSize: 9.5, color: info?.color || G.tx, fontWeight: info ? 700 : 500, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.35 }}>{val || '미정 未定'}</div>
    </div>
  )
  const meta = [brand && `브랜드 品牌 ${brand}`, gender && `성별 性别 ${gender}`, category && `분류 分类 ${category}`].filter(Boolean).join(' · ')
  const stop = (e) => e.stopPropagation()

  return (
    <div className="card" style={{ padding: 0, overflow: 'visible', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* ③ 이미지 — 오버레이 없음, 고정 높이, object-fit cover, 클릭 시 라이트박스 */}
      <div style={{ width: '100%', height: 185, background: G.cardAlt, borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: 'hidden', cursor: imgUrl ? 'zoom-in' : 'default' }}
        onClick={() => { if (imgUrl) onZoom(imgUrl) }}>
        <ZohoImage mo={style} field={imageField(style) || 'Style_Image'} G={G} alt={sku} placeholderText="" iconSize={22} />
      </div>

      {/* ④ 텍스트 영역 — ⑥ 읽기 모드 클릭 시 Style 상세 모달 */}
      <div onClick={() => { if (!editMode && onOpenDetail) onOpenDetail(style) }}
        style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2.5, flex: 1, cursor: (!editMode && onOpenDetail) ? 'pointer' : 'default' }}>
        {/* 1. SKU (+ 수정 모드 시 삭제 버튼) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="syne" style={{ fontSize: 11, fontWeight: 700, color: G.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{pick(style, F.sku) || sku}</span>
          {editMode && (
            <button type="button" onClick={(e) => { stop(e); setConfirmDelete(true) }} title="삭제 · 删除"
              style={{ flexShrink: 0, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', border: `1px solid ${G.bad}`, background: 'transparent', color: G.bad }}>
              <Trash2 size={12} />
            </button>
          )}
        </div>
        {/* ② 아이템명 货号 */}
        <div style={{ fontSize: 9.5, color: G.mu, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ color: G.fa }}>아이템명 货号: </span>{chi || '미정 未定'}
        </div>
        {/* ① 브랜드 品牌 · 성별 性别 · 분류 分类 */}
        {meta && <div style={{ fontSize: 9, color: G.fa, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</div>}
        {/* 원단 面料 */}
        {fabric && <div style={{ fontSize: 9, color: G.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><span style={{ color: G.fa }}>원단 面料: </span>{fabric}</div>}
        {/* ③ 샘플 상태 · 승인 상태 (2줄) */}
        {statusBlock('샘플 상태', '打样状态', styleSt, sInfo)}
        {statusBlock('승인 상태', '审批状态', sampleSt, aInfo)}
        {/* 8. 오더예정공장 预计下单工厂 */}
        <div style={{ marginTop: 2 }}>
          <div style={{ fontSize: 9, color: G.fa }}>오더예정공장 预计下单工厂</div>
          {editMode ? (
            <input value={draftFactory ?? (factory || '')} maxLength={60} onClick={stop} onChange={e => onChangeFactory(sku, e.target.value)} placeholder="공장명 工厂名" style={inputStyle} />
          ) : (
            <div style={{ fontSize: 10, color: factory ? G.tx : G.fa, fontWeight: factory ? 600 : 400 }}>{factory || '미정 未定'}</div>
          )}
        </div>
        {/* 9. 비고 备注 */}
        <div style={{ marginTop: 2 }}>
          <div style={{ fontSize: 9, color: G.fa }}>비고 备注</div>
          {editMode ? (
            <textarea value={draftNote ?? (note || '')} maxLength={300} rows={2} onClick={stop} onChange={e => onChangeNote(sku, e.target.value)} placeholder="비고 输入备注" style={{ ...inputStyle, resize: 'vertical' }} />
          ) : (
            <div style={{ fontSize: 10, color: note ? G.tx : G.fa, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{note || '미정 未定'}</div>
          )}
        </div>
        {/* ④ 미오더 배지 — 오더 전환 버튼 바로 위, 중앙 정렬 */}
        <div style={{ marginTop: 'auto', paddingTop: 6, display: 'flex', justifyContent: 'center' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: G.bad, padding: '2px 10px', borderRadius: 999 }}>미오더 · 未下单</span>
        </div>
        {/* ⑤ 오더 전환 버튼 — 1줄, 100% 폭 */}
        <button type="button" onClick={(e) => { stop(e); setConfirmConvert(true) }} className="btn-ghost"
          style={{ marginTop: 4, width: '100%', minHeight: 30, padding: '6px 4px', fontSize: 10, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <Check size={12} /> 오더 전환 · 转为已下单
        </button>
      </div>

      {/* 오더 전환 확인 모달 */}
      {confirmConvert && (
        <div onClick={e => { if (e.target === e.currentTarget) setConfirmConvert(false) }}
          style={{ position: 'absolute', inset: 0, background: G.overlayBg, borderRadius: 12, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: 14, boxShadow: G.cardShadow, textAlign: 'center', maxWidth: 200 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: G.tx, marginBottom: 4 }}>이 스타일이 오더되었나요?</div>
            <div style={{ fontSize: 10.5, color: G.mu, marginBottom: 12 }}>该款式已下单了吗？<br /><span style={{ fontSize: 9.5, color: G.fa }}>목록에서 숨겨집니다 (Zoho 변경 없음)</span></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button type="button" onClick={() => setConfirmConvert(false)} className="btn-ghost" style={{ minHeight: 30, padding: '6px 12px', fontSize: 11 }}>취소 取消</button>
              <button type="button" onClick={() => { setConfirmConvert(false); onConvert(sku) }} className="btn-primary" style={{ minHeight: 30, padding: '6px 12px', fontSize: 11 }}>확인 确认</button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {confirmDelete && (
        <div onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(false) }}
          style={{ position: 'absolute', inset: 0, background: G.overlayBg, borderRadius: 12, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: 14, boxShadow: G.cardShadow, textAlign: 'center', maxWidth: 210 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: G.tx, marginBottom: 4 }}>이 항목을 목록에서 삭제하시겠습니까?</div>
            <div style={{ fontSize: 10.5, color: G.mu, marginBottom: 8 }}>确认从列表中删除此项目？</div>
            <div style={{ fontSize: 9.5, color: G.fa, marginBottom: 12 }}>Zoho ERP 데이터는 변경되지 않습니다<br />Zoho ERP数据不会被修改</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button type="button" onClick={() => setConfirmDelete(false)} className="btn-ghost" style={{ minHeight: 30, padding: '6px 12px', fontSize: 11 }}>취소 取消</button>
              <button type="button" onClick={() => { setConfirmDelete(false); onDelete(sku) }} className="btn-primary" style={{ minHeight: 30, padding: '6px 12px', fontSize: 11, background: G.bad, borderColor: G.bad }}>확인 确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
