import { useState, useMemo, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import ZohoImage from './ZohoImage'
import {
  F, pick, styleKey, imageField, styleImageUrl, statusInfo,
} from '../utils/styleFields'

// alertBlink 애니메이션 (전역 충돌 방지 위해 mio 접두어)
const ALERT_BLINK_CSS = `
@keyframes mioAlertBlink { 0%,100%{opacity:1} 50%{opacity:0.5} }
.mio-alert-blink { animation: mioAlertBlink 0.8s ease-in-out infinite; }
`

// ──────────────────────────────────────────────────────────
// 미오더 스타일 카드 (未下单)
// 수정 모드는 섹션 단위로 통합 제어(editMode prop). 카드 내 개별 수정 버튼 없음.
// 이미지 오버레이 없음 — 모든 정보는 이미지 아래 텍스트 영역에 표시.
// 예상단가는 editMode 무관, 버튼 클릭으로 언제든 모달 입력 가능.
// ──────────────────────────────────────────────────────────
export default function UnorderedStyleCard({
  G, style, factory, note, price,
  sampleAlert, orderAlert,
  editMode, draftFactory, draftNote,
  onChangeFactory, onChangeNote,
  onToggleSampleAlert, onToggleOrderAlert,
  onSavePrice,
  onDelete, onZoom, onOpenDetail,
}) {
  const sku = styleKey(style)
  const chi = pick(style, F.chi)
  const brand = pick(style, F.brand)
  const gender = pick(style, F.gender)
  const category = pick(style, F.category)
  const fabric = pick(style, F.fabric)
  // 승인 상태(sampleStatus) 값을 "샘플 상태 打样状态" 행에 표시
  const sampleSt = pick(style, F.sampleStatus)
  const aInfo = statusInfo(G, sampleSt)
  const imgUrl = styleImageUrl(style)

  const [confirmDelete, setConfirmDelete] = useState(false)

  // ── 예상단가 모달 상태 ──
  const [priceModal, setPriceModal] = useState(false)
  const [priceForm, setPriceForm] = useState({
    measurePart: '', ikuPrice: '',
    outsource1: { factory: '', price: '' },
    outsource2: { factory: '', price: '' },
    note: '',
  })
  const [priceSaving, setPriceSaving] = useState(false)

  // 저장된 price JSON 파싱
  const priceData = useMemo(() => {
    if (!price) return null
    try { return JSON.parse(price) } catch { return null }
  }, [price])

  const openPriceModal = (e) => {
    e.stopPropagation()
    setPriceForm({
      measurePart: priceData?.measurePart || '',
      ikuPrice: priceData?.ikuPrice || '',
      outsource1: { factory: priceData?.outsource1?.factory || '', price: priceData?.outsource1?.price || '' },
      outsource2: { factory: priceData?.outsource2?.factory || '', price: priceData?.outsource2?.price || '' },
      note: priceData?.note || '',
    })
    setPriceModal(true)
  }

  const closePriceModal = () => setPriceModal(false)

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!priceModal) return
    const handler = (e) => { if (e.key === 'Escape') closePriceModal() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [priceModal])

  const savePriceModal = async () => {
    const json = JSON.stringify(priceForm)
    setPriceSaving(true)
    try { await onSavePrice?.(sku, json) } catch { /* silent */ }
    finally { setPriceSaving(false); setPriceModal(false) }
  }

  // 예상단가 버튼 라벨
  const priceBtnLabel = priceData?.ikuPrice
    ? `예상단가 预算单价  |  IKU: ${priceData.ikuPrice}`
    : '예상단가 预算单价 (미입력 · 未填写)'

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '4px 6px', fontSize: 10, border: `1px solid ${G.border}`, borderRadius: 5, background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit' }

  // 모달 내 입력칸 공통 스타일
  const modalInputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 12px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit' }

  // 상태: 라벨(뮤트) 줄 + 값 줄(1줄 고정 nowrap+ellipsis+tooltip, 상태색/깜빡) — 폰트 +3%
  const statusBlock = (kr, cn, val, info) => (
    <div style={{ marginTop: 2 }}>
      <div style={{ fontSize: 9.3, color: G.fa, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{kr} {cn}</div>
      <div className={info?.blink ? 'mio-blink' : undefined} title={val || ''}
        style={{ fontSize: 9.5, color: info?.color || G.tx, fontWeight: info ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.35 }}>{val || ''}</div>
    </div>
  )

  // ③ 항목명(뮤트) : 값(기본) — Style 탭 카드와 동일 패턴 (폰트 +3%, 빈값 빈칸)
  const row = (kr, cn, val) => (
    <div style={{ fontSize: 9.8, lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      <span style={{ color: G.fa }}>{kr} {cn}: </span>
      <span style={{ color: val ? G.tx : G.fa, fontWeight: val ? 600 : 400 }}>{val || ''}</span>
    </div>
  )
  const stop = (e) => e.stopPropagation()

  // 알림 버튼 공통 스타일
  const alertBtnStyle = (active) => ({
    marginTop: 4,
    width: '100%',
    minHeight: 33,
    padding: '7px 5px',
    fontSize: 11.3,
    fontWeight: active ? 700 : 500,
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 999,
    border: `1px solid ${active ? '#DC2626' : '#D1D5DB'}`,
    background: active ? '#DC2626' : G.bg,
    color: active ? '#fff' : G.tx,
    cursor: 'pointer',
    fontFamily: 'inherit',
  })

  return (
    <div className="card" style={{ padding: 0, overflow: 'visible', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* alertBlink 인라인 CSS */}
      <style>{ALERT_BLINK_CSS}</style>

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
        {/* ② 아이템명 货号 · ③ 항목명 뮤트 / 값 기본 (빈값 빈칸) */}
        {row('아이템명', '货号', chi)}
        {row('브랜드', '品牌', brand)}
        {row('성별', '性别', gender)}
        {row('분류', '分类', category)}
        {row('원단', '面料', fabric)}
        {/* ③ 샘플 상태 (통합 1줄 — 승인 상태 값 표시) */}
        {statusBlock('샘플 상태', '打样状态', sampleSt, aInfo)}
        {/* 8. 오더예정공장 预计下单工厂 */}
        <div style={{ marginTop: 2 }}>
          <div style={{ fontSize: 9.3, color: G.fa, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>오더예정공장 预计下单工厂</div>
          {editMode ? (
            <input value={draftFactory ?? (factory || '')} maxLength={60} onClick={stop} onChange={e => onChangeFactory(sku, e.target.value)} placeholder="공장명 工厂名" style={inputStyle} />
          ) : (
            <div style={{ fontSize: 10.3, color: G.tx, fontWeight: factory ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={factory || ''}>{factory || ''}</div>
          )}
        </div>

        {/* ④ 미오더 배지 */}
        <div style={{ marginTop: 'auto', paddingTop: 6, display: 'flex', justifyContent: 'center' }}>
          <span style={{ fontSize: 9.3, fontWeight: 700, color: '#fff', background: G.bad, padding: '2px 10px', borderRadius: 999 }}>미오더 · 未下单</span>
        </div>

        {/* ⑤ 예상단가 버튼 — editMode 무관 항상 클릭 가능 */}
        <button type="button" onClick={openPriceModal}
          style={{ marginTop: 4, width: '100%', minHeight: 33, padding: '7px 10px', fontSize: 11.3, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, border: '1px solid #EA580C', background: '#FEF3C7', color: '#EA580C', cursor: 'pointer', fontFamily: 'inherit', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {priceBtnLabel}
        </button>

        {/* ⑥ 샘플 완성 알림 버튼 */}
        <button type="button" onClick={(e) => { stop(e); onToggleSampleAlert?.(sku) }}
          className={sampleAlert ? 'mio-alert-blink' : undefined}
          style={alertBtnStyle(sampleAlert)}>
          🔔 {sampleAlert ? '샘플 완성 알림 ON · 提醒开启' : '샘플 완성 알림 · 提醒样品完成'}
        </button>

        {/* ⑦ 오더 전환 알림 버튼 */}
        <button type="button" onClick={(e) => { stop(e); onToggleOrderAlert?.(sku) }}
          className={orderAlert ? 'mio-alert-blink' : undefined}
          style={alertBtnStyle(orderAlert)}>
          📦 {orderAlert ? '오더 전환 알림 ON · 提醒开启' : '오더 전환 알림 · 提醒已下单'}
        </button>
      </div>

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

      {/* 예상단가 입력 모달 — position:fixed 로 화면 중앙에 표시 */}
      {priceModal && (
        <div onClick={closePriceModal}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: G.card, borderRadius: 12, padding: 20, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', border: `1px solid ${G.border}` }}>

            {/* 모달 헤더 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: G.tx }}>예상단가 입력 · 预算单价输入</div>
                <div style={{ fontSize: 11, color: G.fa, marginTop: 3 }}>{sku}</div>
              </div>
              <button type="button" onClick={closePriceModal}
                style={{ width: 28, height: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: `1px solid ${G.border}`, background: 'transparent', color: G.tx, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>✕</button>
            </div>

            {/* 입력 표 */}
            <div style={{ border: '1px solid #D1D5DB', borderRadius: 8, overflow: 'hidden' }}>

              {/* 행 1: 측정 부위 */}
              <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid #E5E7EB' }}>
                <div style={{ width: 140, flexShrink: 0, padding: '10px 12px', fontSize: 11, color: G.fa, borderRight: '1px solid #E5E7EB', display: 'flex', alignItems: 'center' }}>측정 부위 测量部位</div>
                <div style={{ flex: 1, padding: '6px 8px', display: 'flex', alignItems: 'center' }}>
                  <input value={priceForm.measurePart}
                    onChange={e => setPriceForm(p => ({ ...p, measurePart: e.target.value }))}
                    placeholder="측정 부위 입력 · 输入测量部位"
                    style={modalInputStyle} />
                </div>
              </div>

              {/* 행 2: IKU 단가 */}
              <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid #E5E7EB' }}>
                <div style={{ width: 140, flexShrink: 0, padding: '10px 12px', fontSize: 11, color: G.fa, borderRight: '1px solid #E5E7EB', display: 'flex', alignItems: 'center' }}>IKU 단가 单价</div>
                <div style={{ flex: 1, padding: '6px 8px', display: 'flex', alignItems: 'center' }}>
                  <input value={priceForm.ikuPrice}
                    onChange={e => setPriceForm(p => ({ ...p, ikuPrice: e.target.value }))}
                    placeholder="예: ¥45 · 输入单价"
                    style={modalInputStyle} />
                </div>
              </div>

              {/* 행 3: 외주 단가 1 */}
              <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid #E5E7EB' }}>
                <div style={{ width: 140, flexShrink: 0, padding: '10px 12px', fontSize: 11, color: G.fa, borderRight: '1px solid #E5E7EB', display: 'flex', alignItems: 'center' }}>외주 단가 外发单价</div>
                <div style={{ flex: 1, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input value={priceForm.outsource1.factory}
                    onChange={e => setPriceForm(p => ({ ...p, outsource1: { ...p.outsource1, factory: e.target.value } }))}
                    placeholder="공장명 · 工厂名"
                    style={{ ...modalInputStyle, width: '40%', flex: 'none' }} />
                  <input value={priceForm.outsource1.price}
                    onChange={e => setPriceForm(p => ({ ...p, outsource1: { ...p.outsource1, price: e.target.value } }))}
                    placeholder="단가 · 单价"
                    style={{ ...modalInputStyle, flex: 1 }} />
                </div>
              </div>

              {/* 행 4: 외주 단가 2 */}
              <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid #E5E7EB' }}>
                <div style={{ width: 140, flexShrink: 0, padding: '10px 12px', fontSize: 11, color: G.fa, borderRight: '1px solid #E5E7EB', display: 'flex', alignItems: 'center' }}>외주 단가 外发单价</div>
                <div style={{ flex: 1, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input value={priceForm.outsource2.factory}
                    onChange={e => setPriceForm(p => ({ ...p, outsource2: { ...p.outsource2, factory: e.target.value } }))}
                    placeholder="공장명 · 工厂名"
                    style={{ ...modalInputStyle, width: '40%', flex: 'none' }} />
                  <input value={priceForm.outsource2.price}
                    onChange={e => setPriceForm(p => ({ ...p, outsource2: { ...p.outsource2, price: e.target.value } }))}
                    placeholder="단가 · 单价"
                    style={{ ...modalInputStyle, flex: 1 }} />
                </div>
              </div>

              {/* 행 5: 비고 */}
              <div style={{ display: 'flex', alignItems: 'stretch' }}>
                <div style={{ width: 140, flexShrink: 0, padding: '10px 12px', fontSize: 11, color: G.fa, borderRight: '1px solid #E5E7EB', display: 'flex', alignItems: 'center' }}>비고 备注</div>
                <div style={{ flex: 1, padding: '6px 8px', display: 'flex', alignItems: 'center' }}>
                  <input value={priceForm.note}
                    onChange={e => setPriceForm(p => ({ ...p, note: e.target.value }))}
                    placeholder="비고 입력 · 输入备注"
                    style={modalInputStyle} />
                </div>
              </div>
            </div>

            {/* 모달 하단 버튼 */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" onClick={closePriceModal}
                style={{ padding: '8px 18px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: `1px solid ${G.border}`, background: 'transparent', color: G.tx, cursor: 'pointer', fontFamily: 'inherit' }}>
                취소 取消
              </button>
              <button type="button" onClick={savePriceModal} disabled={priceSaving}
                style={{ padding: '8px 18px', fontSize: 12, fontWeight: 700, borderRadius: 8, border: '1px solid #EA580C', background: '#EA580C', color: '#fff', cursor: priceSaving ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                {priceSaving ? '저장 중 · 保存中...' : '저장 保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
