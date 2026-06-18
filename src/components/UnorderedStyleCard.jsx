import { useState, useEffect, useCallback } from 'react'
import { Trash2, Pencil } from 'lucide-react'
import ZohoImage from './ZohoImage'
import PriceTableModal from './PriceTableModal'
import { fetchStylePriceTable, saveStyleProgress, saveStyleMemo } from '../api/client'
import {
  F, pick, styleKey, imageField, styleImageUrl,
} from '../utils/styleFields'

const PRICE_FIELDS = ['process', 'iku', 'p1', 'p2', 'p3', 'p4', 'note']

const PROGRESS_OPTIONS = [
  '자체제작 중 公司制作中',
  '자체수정 중 公司修改中',
  '공장제작 중 工厂制作中',
  '공장수정 중 工厂修改中',
  '단가산출 중 单价算出中',
]

function hasRealData(d) {
  const rows = d?.rows
  return Array.isArray(rows) && rows.length >= 1 &&
    rows.some(r => PRICE_FIELDS.some(f => (r[f] || '').trim() !== ''))
}

export default function UnorderedStyleCard({
  G, style, factory, note, price,
  progress, memo,
  sampleDone,
  waiting,
  sampleAlert, orderAlert,
  editMode, draftFactory, draftNote,
  onChangeFactory, onChangeNote,
  onToggleSampleAlert, onToggleOrderAlert,
  onSavePrice,
  onProgressSaved, onMemoSaved,
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

  const [cardEditMode, setCardEditMode] = useState(false)
  const [draftProgress, setDraftProgress] = useState('')
  const [draftMemo, setDraftMemo] = useState('')
  const [cardSaving, setCardSaving] = useState(false)

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

  const enterCardEdit = (e) => {
    stop(e)
    setDraftProgress(progress || '')
    setDraftMemo(memo || '')
    setCardEditMode(true)
  }

  const cancelCardEdit = (e) => {
    stop(e)
    setCardEditMode(false)
  }

  const saveCard = async (e) => {
    stop(e)
    setCardSaving(true)
    try {
      await Promise.all([
        saveStyleProgress(sku, draftProgress),
        saveStyleMemo(sku, draftMemo),
      ])
      onProgressSaved?.(sku, draftProgress)
      onMemoSaved?.(sku, draftMemo)
      setCardEditMode(false)
    } catch (err) {
      console.error('[UnorderedStyleCard] save failed', err)
    } finally {
      setCardSaving(false)
    }
  }

  const priceLoading = priceKvStatus === null
  const priceOk = priceKvStatus === 'ok'
  const priceIcon = priceOk ? '✅' : '⚠'
  const priceColor = priceLoading ? G.tx : priceOk ? '#16A34A' : '#DC2626'
  const priceBg = priceLoading ? G.bg : priceOk ? '#EAF3DE' : '#FCEBEB'
  const priceBorderColor = priceLoading ? G.border : priceOk ? '#97C459' : '#F09595'
  const priceBlink = !priceLoading && !priceOk

  const alertBtnStyle = (active) => ({
    marginTop: 4, width: '100%', minHeight: 33,
    padding: '7px 5px', fontSize: 10.74,
    fontWeight: active ? 700 : 500,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderRadius: 999,
    border: `1px solid ${active ? '#DC2626' : '#D1D5DB'}`,
    background: active ? '#DC2626' : G.bg,
    color: active ? '#fff' : G.tx,
    cursor: 'pointer', fontFamily: 'inherit',
    overflow: 'hidden', minWidth: 0,
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
        onClick={() => { if (!editMode && !cardEditMode && onOpenDetail) onOpenDetail(style) }}
        style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2.5, flex: 1, cursor: (!editMode && !cardEditMode && onOpenDetail) ? 'pointer' : 'default', overflow: 'hidden' }}
      >
        {/* SKU + 버튼들 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="syne" style={{ fontSize: 11, fontWeight: 700, color: G.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{pick(style, F.sku) || sku}</span>
          {editMode && (
            <button type="button" onClick={(e) => { stop(e); setConfirmDelete(true) }} title="삭제 · 删除"
              style={{ flexShrink: 0, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', border: `1px solid ${G.bad}`, background: 'transparent', color: G.bad }}>
              <Trash2 size={12} />
            </button>
          )}
          {!editMode && !cardEditMode && (
            <button type="button" onClick={enterCardEdit} title="수정 修改"
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 5, cursor: 'pointer', border: `1px solid ${G.border}`, background: 'transparent', color: G.mu, fontSize: 9.5, fontWeight: 500, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              <Pencil size={9} /> 수정 修改
            </button>
          )}
          {!editMode && cardEditMode && (
            <>
              <button type="button" onClick={saveCard} disabled={cardSaving}
                style={{ flexShrink: 0, padding: '2px 7px', borderRadius: 5, cursor: cardSaving ? 'default' : 'pointer', border: '1px solid #1D4ED8', background: '#1D4ED8', color: '#fff', fontSize: 9.5, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: cardSaving ? 0.6 : 1 }}>
                {cardSaving ? '…' : '저장 保存'}
              </button>
              <button type="button" onClick={cancelCardEdit}
                style={{ flexShrink: 0, padding: '2px 6px', borderRadius: 5, cursor: 'pointer', border: `1px solid ${G.border}`, background: 'transparent', color: G.mu, fontSize: 9.5, fontWeight: 500, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                취소 取消
              </button>
            </>
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

        {/* 현재 진행상황 */}
        <div style={{ marginTop: 14 }}>
          <div style={bigLabelStyle}>현재 진행상황 目前情况</div>
          {cardEditMode ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {PROGRESS_OPTIONS.map(opt => {
                const on = draftProgress === opt
                return (
                  <button key={opt} type="button"
                    onClick={e => { stop(e); setDraftProgress(on ? '' : opt) }}
                    style={{
                      padding: '4px 8px', fontSize: 11, borderRadius: 12,
                      border: `1px solid ${on ? '#1D4ED8' : G.border}`,
                      background: on ? '#1D4ED8' : G.cardAlt,
                      color: on ? '#fff' : G.mu,
                      cursor: 'pointer', fontFamily: 'inherit',
                      fontWeight: on ? 500 : 400, whiteSpace: 'nowrap',
                    }}>
                    {opt}
                  </button>
                )
              })}
            </div>
          ) : (
            <div style={{
              fontSize: 11, fontWeight: progress ? 700 : 400,
              color: progress ? G.tx : G.fa,
              textAlign: 'center',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {progress || '미설정 · 未设置'}
            </div>
          )}
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

        {/* 현황 메모 — 카드 편집 모드이거나 메모가 있을 때만 표시 */}
        {(cardEditMode || memo) && (
          <div style={{ marginTop: 8 }}>
            <div style={bigLabelStyle}>현황 메모 状况备注</div>
            {cardEditMode ? (
              <textarea
                value={draftMemo}
                onClick={stop}
                onChange={e => setDraftMemo(e.target.value)}
                maxLength={2000}
                placeholder="현황 메모 입력 · 输入状况备注"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '6px 8px', fontSize: 12,
                  border: `1px solid ${G.border}`, borderRadius: 6,
                  background: G.bg, color: G.tx, outline: 'none',
                  fontFamily: 'inherit', resize: 'vertical',
                  minHeight: 60, maxHeight: 120,
                  marginTop: 3,
                }}
              />
            ) : (
              <div style={{
                fontSize: 10.5, color: G.mu, lineHeight: 1.45,
                display: '-webkit-box', WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical', overflow: 'hidden',
                wordBreak: 'break-all',
              }}>
                {memo}
              </div>
            )}
          </div>
        )}

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
            overflow: 'hidden', minWidth: 0,
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
            <span style={{ flexShrink: 0 }}>{orderAlert ? '⚠' : '🔔'}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{orderAlert ? '오더 전환 알림 ON · 提醒开启' : '오더 전환 알림 · 提醒已下单'}</span>
          </button>
        ) : (
          <button type="button" onClick={(e) => { stop(e); onToggleSampleAlert?.(sku) }}
            className={sampleAlert ? 'g-blink' : undefined}
            style={alertBtnStyle(sampleAlert)}>
            <span style={{ flexShrink: 0 }}>{sampleAlert ? '⚠' : '🔔'}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{sampleAlert ? '샘플 완성 알림 ON · 提醒开启' : '샘플 완성 알림 · 提醒样品完成'}</span>
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
