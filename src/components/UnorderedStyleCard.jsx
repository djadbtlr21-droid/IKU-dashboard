import { useState, useEffect, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import ZohoImage from './ZohoImage'
import PriceTableModal from './PriceTableModal'
import { fetchStylePriceTable } from '../api/client'
import {
  F, pick, styleKey, imageField, styleImageUrl,
} from '../utils/styleFields'

const PRICE_FIELDS = ['process', 'iku', 'p1', 'p2', 'p3', 'p4', 'note']

function hasRealData(d) {
  const rows = d?.rows
  return Array.isArray(rows) && rows.length >= 1 &&
    rows.some(r => PRICE_FIELDS.some(f => (r[f] || '').trim() !== ''))
}

export default function UnorderedStyleCard({
  G, style, factory, note, price,
  sampleDone,
  waiting,
  sampleAlert, orderAlert,
  editMode, draftFactory, draftNote,
  onChangeFactory, onChangeNote,
  onToggleSampleAlert, onToggleOrderAlert,
  onSavePrice,
  onDelete, onZoom, onOpenDetail,
  borderColor,
}) {
  const sku = styleKey(style)
  const chi = pick(style, F.chi)
  const brand = pick(style, F.brand)
  const gender = pick(style, F.gender)
  const category = pick(style, F.category)
  const fabric = pick(style, F.fabric)
  const sampleSt = pick(style, F.sampleStatus)
  const imgUrl = styleImageUrl(style)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [priceModal, setPriceModal] = useState(false)
  const [priceKvStatus, setPriceKvStatus] = useState(null)

  const fetchPriceStatus = useCallback(() => {
    fetchStylePriceTable(sku)
      .then(res => {
        setPriceKvStatus(hasRealData(res?.data) ? 'ok' : 'empty')
      })
      .catch(() => setPriceKvStatus('empty'))
  }, [sku])

  useEffect(() => {
    let cancelled = false
    fetchStylePriceTable(sku)
      .then(res => {
        if (cancelled) return
        setPriceKvStatus(hasRealData(res?.data) ? 'ok' : 'empty')
      })
      .catch(() => { if (!cancelled) setPriceKvStatus('empty') })
    return () => { cancelled = true }
  }, [sku])

  const openPriceModal = (e) => { e.stopPropagation(); setPriceModal(true) }
  const stop = (e) => e.stopPropagation()

  const priceLoading = priceKvStatus === null
  const priceOk = priceKvStatus === 'ok'
  const priceIcon = priceOk ? '✅' : '⚠'
  const priceColor = priceLoading ? G.tx : priceOk ? '#16A34A' : '#DC2626'
  const priceBg = priceLoading ? G.bg : priceOk ? '#EAF3DE' : '#FCEBEB'
  const priceBorderColor = priceLoading ? G.border : priceOk ? '#97C459' : '#F09595'
  const priceBlink = !priceLoading && !priceOk

  const alertBtnStyle = (active) => ({
    marginTop: 4, width: '100%', minHeight: 33,
    padding: '7px 5px', fontSize: 11.3,
    fontWeight: active ? 700 : 500,
    whiteSpace: 'nowrap',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderRadius: 999,
    border: `1px solid ${active ? '#DC2626' : '#D1D5DB'}`,
    background: active ? '#DC2626' : G.bg,
    color: active ? '#fff' : G.tx,
    cursor: 'pointer', fontFamily: 'inherit',
  })

  const bigLabelStyle = {
    fontSize: 11.2, fontWeight: 700, color: G.fa,
    textAlign: 'center',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  }

  const sampleValColor = sampleDone ? '#16A34A' : waiting ? '#7C3AED' : '#DC2626'

  const row = (kr, cn, val) => (
    <div style={{ fontSize: 9.8, lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      <span style={{ color: G.fa }}>{kr} {cn}: </span>
      <span style={{ color: val ? G.tx : G.fa, fontWeight: val ? 600 : 400 }}>{val || ''}</span>
    </div>
  )

  return (
    <div className="card" style={{ padding: 0, overflow: 'visible', display: 'flex', flexDirection: 'column', position: 'relative', ...(borderColor ? { border: `1px solid ${borderColor}` } : {}) }}>

      {/* 이미지 */}
      <div style={{ width: '100%', height: 185, background: G.cardAlt, borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: 'hidden', cursor: imgUrl ? 'zoom-in' : 'default' }}
        onClick={() => { if (imgUrl) onZoom(imgUrl) }}>
        <ZohoImage mo={style} field={imageField(style) || 'Style_Image'} G={G} alt={sku} placeholderText="" iconSize={22} />
      </div>

      {/* 텍스트 영역 */}
      <div
        onClick={() => { if (!editMode && onOpenDetail) onOpenDetail(style) }}
        style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2.5, flex: 1, cursor: (!editMode && onOpenDetail) ? 'pointer' : 'default' }}
      >
        {/* SKU + 삭제 버튼 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="syne" style={{ fontSize: 11, fontWeight: 700, color: G.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{pick(style, F.sku) || sku}</span>
          {editMode && (
            <button type="button" onClick={(e) => { stop(e); setConfirmDelete(true) }} title="삭제 · 删除"
              style={{ flexShrink: 0, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', border: `1px solid ${G.bad}`, background: 'transparent', color: G.bad }}>
              <Trash2 size={12} />
            </button>
          )}
        </div>

        {/* 일반 정보 행 */}
        {row('아이템명', '货号', chi)}
        {row('브랜드', '品牌', brand)}
        {row('성별', '性别', gender)}
        {row('분류', '分类', category)}
        {row('원단', '面料', fabric)}

        {/* 샘플 상태 */}
        <div style={{ marginTop: 14 }}>
          <div style={bigLabelStyle}>샘플 상태 打样状态</div>
          <div
            className={!sampleDone ? 'g-blink' : undefined}
            title={sampleSt || ''}
            style={{
              fontSize: 11.4, fontWeight: 700, color: sampleValColor,
              textAlign: 'center',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.35,
            }}
          >{sampleSt || ''}</div>
        </div>

        {/* 오더예정공장 */}
        <div style={{ marginTop: 14 }}>
          <div style={bigLabelStyle}>오더예정공장 预计下单工厂</div>
          {editMode ? (
            <input
              value={draftFactory ?? (factory || '')} maxLength={60}
              onClick={stop} onChange={e => onChangeFactory(sku, e.target.value)}
              placeholder="공장명 工厂名"
              style={{ width: '100%', boxSizing: 'border-box', padding: '4px 6px', fontSize: 10, border: `1px solid ${G.border}`, borderRadius: 5, background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit' }}
            />
          ) : (
            <div
              className={!factory ? 'g-blink' : undefined}
              title={factory || ''}
              style={{
                fontSize: 12.4, fontWeight: 700,
                color: factory ? '#16A34A' : '#DC2626',
                textAlign: 'center',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {factory || '미입력 · 未填写'}
            </div>
          )}
        </div>

        {/* 예상단가 버튼 */}
        <button
          type="button"
          onClick={openPriceModal}
          className={priceBlink ? 'g-blink' : undefined}
          style={{
            marginTop: 12, width: '100%', minHeight: 33,
            padding: '7px 5px', fontSize: 11.3, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            whiteSpace: 'nowrap', borderRadius: 999,
            border: `1px solid ${priceBorderColor}`,
            background: priceBg, color: priceColor,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {!priceLoading && <span>{priceIcon}</span>}
          <span>예상단가 预算单价</span>
          {priceLoading && <span style={{ fontSize: 10, color: G.fa }}>...</span>}
        </button>

        {/* 그룹별 알림 버튼 */}
        {sampleDone ? (
          <button type="button" onClick={(e) => { stop(e); onToggleOrderAlert?.(sku) }}
            className={orderAlert ? 'g-blink' : undefined}
            style={alertBtnStyle(orderAlert)}>
            <span>{orderAlert ? '⚠' : '🔔'}</span>
            <span>{orderAlert ? '오더 전환 알림 ON · 提醒开启' : '오더 전환 알림 · 提醒已下单'}</span>
          </button>
        ) : (
          <button type="button" onClick={(e) => { stop(e); onToggleSampleAlert?.(sku) }}
            className={sampleAlert ? 'g-blink' : undefined}
            style={alertBtnStyle(sampleAlert)}>
            <span>{sampleAlert ? '⚠' : '🔔'}</span>
            <span>{sampleAlert ? '샘플 완성 알림 ON · 提醒开启' : '샘플 완성 알림 · 提醒样品完成'}</span>
          </button>
        )}
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

      {/* 예상단가 모달 */}
      {priceModal && (
        <PriceTableModal
          G={G}
          sku={sku}
          onClose={() => setPriceModal(false)}
          onSavePrice={onSavePrice}
          onSaved={fetchPriceStatus}
        />
      )}
    </div>
  )
}
