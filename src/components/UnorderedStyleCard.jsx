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
  onChangeFactory, onChangeNote, onConvert, onDelete, onZoom,
}) {
  const sku = styleKey(style)
  const chi = pick(style, F.chi)
  const brand = pick(style, F.brand)
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

  // ⑤ 항목명(한/중): 값 — 상태값 색/깜빡 적용
  const statusRow = (kr, cn, val, info) => (
    <div style={{ display: 'flex', gap: 4, fontSize: 9.5, lineHeight: 1.45 }}>
      <span style={{ color: G.fa, flexShrink: 0 }}>{kr} {cn}:</span>
      <span className={info?.blink ? 'mio-blink' : undefined}
        style={{ color: info?.color || G.tx, fontWeight: info ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val || '—'}</span>
    </div>
  )

  return (
    <div className="card" style={{ padding: 0, overflow: 'visible', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* ③ 이미지 — 오버레이 없음, 고정 높이, object-fit cover, 클릭 시 라이트박스 */}
      <div style={{ width: '100%', height: 185, background: G.cardAlt, borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: 'hidden', cursor: imgUrl ? 'zoom-in' : 'default' }}
        onClick={() => { if (imgUrl) onZoom(imgUrl) }}>
        <ZohoImage mo={style} field={imageField(style) || 'Style_Image'} G={G} alt={sku} placeholderText="" iconSize={22} />
      </div>

      {/* ④ 텍스트 영역 */}
      <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2.5, flex: 1 }}>
        {/* 1. SKU (+ 수정 모드 시 삭제 버튼) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="syne" style={{ fontSize: 11, fontWeight: 700, color: G.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{pick(style, F.sku) || sku}</span>
          {editMode && (
            <button type="button" onClick={() => setConfirmDelete(true)} title="삭제 · 删除"
              style={{ flexShrink: 0, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', border: `1px solid ${G.bad}`, background: 'transparent', color: G.bad }}>
              <Trash2 size={12} />
            </button>
          )}
        </div>
        {/* 2. 중문 스타일명 */}
        {chi && <div style={{ fontSize: 9.5, color: G.mu, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chi}</div>}
        {/* 3. 브랜드 品牌 · 분류 分类 */}
        {(brand || category) && (
          <div style={{ fontSize: 9, color: G.fa, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[brand && `品牌 ${brand}`, category && `分类 ${category}`].filter(Boolean).join(' · ')}
          </div>
        )}
        {/* 4. 원단 面料 */}
        {fabric && <div style={{ fontSize: 9, color: G.mu, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><span style={{ color: G.fa }}>面料 </span>{fabric}</div>}
        {/* 5. 샘플 상태 · 6. 승인 상태 */}
        {statusRow('샘플 상태', '打样状态', styleSt, sInfo)}
        {statusRow('승인 상태', '审批状态', sampleSt, aInfo)}
        {/* 7. 미오더 */}
        <div style={{ fontSize: 9, fontWeight: 700, color: G.bad }}>미오더 · 未下单</div>
        {/* 8. 오더예정공장 */}
        <div style={{ marginTop: 2 }}>
          <div style={{ fontSize: 9, color: G.fa }}>预计下单工厂 · 오더예정공장</div>
          {editMode ? (
            <input value={draftFactory ?? (factory || '')} maxLength={60} onChange={e => onChangeFactory(sku, e.target.value)} placeholder="공장명 · 工厂名" style={inputStyle} />
          ) : (
            <div style={{ fontSize: 10, color: factory ? G.tx : G.fa, fontWeight: factory ? 600 : 400 }}>{factory || '미정 · 未定'}</div>
          )}
        </div>
        {/* 9. 비고 */}
        <div style={{ marginTop: 2 }}>
          <div style={{ fontSize: 9, color: G.fa }}>备注 · 비고</div>
          {editMode ? (
            <textarea value={draftNote ?? (note || '')} maxLength={300} rows={2} onChange={e => onChangeNote(sku, e.target.value)} placeholder="비고 · 输入备注" style={{ ...inputStyle, resize: 'vertical' }} />
          ) : (
            <div style={{ fontSize: 10, color: note ? G.tx : G.fa, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{note || '—'}</div>
          )}
        </div>
        {/* 10. 오더 전환 (하단 고정) */}
        <button type="button" onClick={() => setConfirmConvert(true)} className="btn-ghost"
          style={{ marginTop: 'auto', minHeight: 30, padding: '6px 8px', fontSize: 10.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
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
