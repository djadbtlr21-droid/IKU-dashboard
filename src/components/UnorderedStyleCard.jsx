import { useState, useEffect, useCallback, useRef } from 'react'
import { Trash2, Pencil } from 'lucide-react'
import ZohoImage from './ZohoImage'
import PriceTableModal from './PriceTableModal'
import { fetchStylePriceTable, saveStyleProgress, saveStyleMemo, saveStyleFactory } from '../api/client'
import {
  F, pick, styleKey, imageField, styleImageUrl,
} from '../utils/styleFields'

const PRICE_FIELDS = ['process', 'iku', 'p1', 'p2', 'p3', 'p4', 'note']

const SAMPLE_DONE_LABEL = '샘플완료 样品完成'

const PROGRESS_OPTIONS = [
  '자체제작 중 公司制作中',
  '자체수정 중 公司修改中',
  '공장제작 중 工厂制作中',
  '공장수정 중 工厂修改中',
  '단가산출 중 单价算出中',
  SAMPLE_DONE_LABEL,
]

function hasRealData(d) {
  const rows = d?.rows
  return Array.isArray(rows) && rows.length >= 1 &&
    rows.some(r => PRICE_FIELDS.some(f => (r[f] || '').trim() !== ''))
}

// style_memo:{SKU} 에 due_date와 메모 텍스트를 JSON으로 함께 저장
function parseMemo(raw) {
  if (!raw) return { date: '', text: '' }
  try {
    const obj = JSON.parse(raw)
    if (obj && typeof obj === 'object' && ('d' in obj || 't' in obj)) {
      return { date: obj.d || '', text: obj.t || '' }
    }
  } catch { /* ignore */ }
  return { date: '', text: raw }  // 구버전 plain text 호환
}

function serializeMemo(date, text) {
  const d = (date || '').trim()
  const t = (text || '').trim()
  if (!d && !t) return ''
  return JSON.stringify({ d, t })
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
  onProgressSaved, onMemoSaved, onFactorySaved,
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
  const [progressStatus, setProgressStatus] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [memoText, setMemoText] = useState('')
  const [draftFactoryCard, setDraftFactoryCard] = useState('')
  const [cardSaving, setCardSaving] = useState(false)
  const [exitConfirm, setExitConfirm] = useState(false)
  const [cardToast, setCardToast] = useState(null)
  const toastTimer = useRef(null)

  const { date: savedDate, text: savedMemoText } = parseMemo(memo)

  const fetchPriceStatus = useCallback(() => {
    fetchStylePriceTable(sku)
      .then(res => setPriceKvStatus(hasRealData(res?.data) ? 'ok' : 'empty'))
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

  const showCardToast = (msg, type = 'ok') => {
    setCardToast({ msg, type })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setCardToast(null), 1500)
  }

  const openPriceModal = (e) => { e.stopPropagation(); setPriceModal(true) }
  const stop = (e) => e.stopPropagation()

  const enterCardEdit = (e) => {
    stop(e)
    const parsed = parseMemo(memo)
    setProgressStatus(progress || '')
    setDueDate(parsed.date)
    setMemoText(parsed.text)
    setDraftFactoryCard(factory || '')
    setExitConfirm(false)
    setCardEditMode(true)
  }

  const checkDirty = useCallback(() => {
    const { date: origDate, text: origText } = parseMemo(memo)
    return progressStatus !== (progress || '') ||
      dueDate !== origDate ||
      memoText !== origText ||
      draftFactoryCard !== (factory || '')
  }, [memo, progress, factory, progressStatus, dueDate, memoText, draftFactoryCard])

  const doSave = useCallback(async () => {
    setCardSaving(true)
    try {
      const combined = serializeMemo(dueDate, memoText)
      await Promise.all([
        saveStyleProgress(sku, progressStatus),
        saveStyleMemo(sku, combined),
        saveStyleFactory(sku, draftFactoryCard),
      ])
      onProgressSaved?.(sku, progressStatus)
      onMemoSaved?.(sku, combined)
      onFactorySaved?.(sku, draftFactoryCard)
      setCardEditMode(false)
      setExitConfirm(false)
      showCardToast('저장됨 · 已保存', 'ok')
    } catch {
      showCardToast('저장 실패 · 保存失败', 'bad')
    } finally {
      setCardSaving(false)
    }
  }, [sku, progressStatus, dueDate, memoText, draftFactoryCard, onProgressSaved, onMemoSaved, onFactorySaved])

  const saveCard = (e) => { stop(e); doSave() }

  const handleEndEdit = (e) => {
    stop(e)
    if (!checkDirty()) {
      setCardEditMode(false)
    } else {
      setExitConfirm(true)
    }
  }

  const priceLoading = priceKvStatus === null
  const priceOk = priceKvStatus === 'ok'
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

  // 완성 판단: sampleDone(Zoho) OR 진행상황이 "샘플완료"
  const isCompletedRead = sampleDone || progress === SAMPLE_DONE_LABEL
  const isCompletedEdit = sampleDone || progressStatus === SAMPLE_DONE_LABEL

  // due date 표시 로직
  const dueDateLabel = isCompletedRead ? '완성 날짜 完成日期' : '예상 완성 날짜 预计完成日期'
  const editDateLabel = isCompletedEdit ? '완성 날짜 完成日期' : '예상 완성 날짜 预计完成日期'
  const dueDateColor = savedDate ? (isCompletedRead ? '#16A34A' : '#DC2626') : G.fa
  const dueDateBlink = !!(savedDate && !isCompletedRead)

  // 진행상황 읽기 모드 색상
  const progressIsComplete = progress === SAMPLE_DONE_LABEL
  const progressReadColor = progress ? (progressIsComplete ? '#16A34A' : '#DC2626') : G.fa
  const progressReadBlink = !!(progress && !progressIsComplete)

  const row = (kr, cn, val) => (
    <div style={{ fontSize: 9.8, lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      <span style={{ color: G.fa }}>{kr} {cn}: </span>
      <span style={{ color: val ? G.tx : G.fa, fontWeight: val ? 600 : 400 }}>{val || ''}</span>
    </div>
  )

  return (
    <div className="card" style={{ padding: 0, overflow: 'visible', display: 'flex', flexDirection: 'column', position: 'relative', ...(borderColor ? { border: `1px solid ${borderColor}` } : {}) }}>

      {/* 카드 로컬 토스트 */}
      {cardToast && (
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, padding: '4px 10px', borderRadius: 7, whiteSpace: 'nowrap',
          background: cardToast.type === 'ok' ? '#10B981' : '#EF4444',
          color: '#fff', fontSize: 10.5, fontWeight: 600,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}>
          {cardToast.msg}
        </div>
      )}

      {/* 수정종료 확인 다이얼로그 */}
      {exitConfirm && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setExitConfirm(false) }}
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 30, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}
        >
          <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: 16, boxShadow: G.cardShadow, textAlign: 'center' }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: G.tx, marginBottom: 12, lineHeight: 1.4 }}>
              저장하지 않은 변경사항이 있습니다.<br />有未保存的更改。
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button type="button" onClick={(e) => { stop(e); setExitConfirm(false); doSave() }}
                style={{ padding: '6px 12px', fontSize: 10.5, fontWeight: 700, borderRadius: 7, border: '1px solid #EA580C', background: '#EA580C', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                저장 후 종료 · 保存并退出
              </button>
              <button type="button" onClick={(e) => { stop(e); setCardEditMode(false); setExitConfirm(false) }}
                style={{ padding: '6px 12px', fontSize: 10.5, fontWeight: 500, borderRadius: 7, border: `1px solid ${G.border}`, background: 'transparent', color: G.tx, cursor: 'pointer', fontFamily: 'inherit' }}>
                저장 없이 종료 · 直接退出
              </button>
              <button type="button" onClick={(e) => { stop(e); setExitConfirm(false) }}
                style={{ padding: '6px 12px', fontSize: 10.5, fontWeight: 500, borderRadius: 7, border: `1px solid ${G.border}`, background: 'transparent', color: G.mu, cursor: 'pointer', fontFamily: 'inherit' }}>
                취소 · 取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 이미지 */}
      <div style={{ width: '100%', height: 185, background: G.cardAlt, borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: 'hidden', cursor: imgUrl ? 'zoom-in' : 'default' }}
        onClick={() => { if (imgUrl) onZoom(imgUrl) }}>
        <ZohoImage mo={style} field={imageField(style) || 'Style_Image'} G={G} alt={sku} placeholderText="" iconSize={22} />
      </div>

      {/* 텍스트 영역 */}
      <div
        onClick={() => { if (!editMode && !cardEditMode && onOpenDetail) onOpenDetail(style) }}
        style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2.5, flex: 1, cursor: (!editMode && !cardEditMode && onOpenDetail) ? 'pointer' : 'default' }}
      >
        {/* SKU + 버튼 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="syne" style={{ fontSize: 11, fontWeight: 700, color: G.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
            {pick(style, F.sku) || sku}
          </span>
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
              <button type="button" onClick={handleEndEdit}
                style={{ flexShrink: 0, padding: '2px 7px', borderRadius: 5, cursor: 'pointer', border: `1px solid ${G.border}`, background: 'transparent', color: G.mu, fontSize: 9.5, fontWeight: 500, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                종료 结束
              </button>
            </>
          )}
        </div>

        {/* 기본 정보 행 */}
        {row('아이템명', '货号', chi)}
        {row('브랜드', '品牌', brand)}
        {row('성별', '性别', gender)}
        {row('분류', '分类', category)}
        {row('원단', '面料', fabric)}

        {/* ── 샘플 상태 ── */}
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

        {/* ── 예상 완성 날짜 ── */}
        <div style={{ marginTop: 8 }}>
          {cardEditMode ? (
            <>
              <div style={bigLabelStyle}>{editDateLabel}</div>
              {dueDate && (
                <div style={{ fontSize: 11, color: '#374151', textAlign: 'center', marginBottom: 2, marginTop: 2 }}>
                  {dueDate}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <input
                  type="date"
                  lang="zh-CN"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  onClick={stop}
                  style={{ flex: 1, fontSize: 12, border: `1px solid ${G.border}`, borderRadius: 6, padding: '4px 8px', background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit' }}
                />
                {dueDate && (
                  <button type="button" onClick={(e) => { stop(e); setDueDate('') }}
                    style={{ flexShrink: 0, fontSize: 13, color: G.mu, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontFamily: 'inherit', lineHeight: 1 }}>
                    ×
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={bigLabelStyle}>{dueDateLabel}</div>
              <div
                className={dueDateBlink ? 'g-blink' : undefined}
                style={{
                  fontSize: 11.4, fontWeight: savedDate ? 700 : 400, color: dueDateColor,
                  textAlign: 'center', lineHeight: 1.35,
                }}
              >
                {savedDate || '미설정 · 未设置'}
              </div>
            </>
          )}
        </div>

        {/* ── 현재 진행상황 ── */}
        <div style={{ marginTop: 8 }}>
          <div style={bigLabelStyle}>현재 진행상황 目前情况</div>
          {cardEditMode ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {PROGRESS_OPTIONS.map(opt => {
                const active = progressStatus === opt
                const isDone = opt === SAMPLE_DONE_LABEL
                const btnBg = active ? (isDone ? '#EAF3DE' : '#FCEBEB') : '#F9FAFB'
                const btnBorder = active ? (isDone ? '#16A34A' : '#DC2626') : '#D1D5DB'
                const btnColor = active ? (isDone ? '#16A34A' : '#DC2626') : '#6B7280'
                return (
                  <button
                    key={opt}
                    type="button"
                    className={active && !isDone ? 'g-blink' : undefined}
                    onClick={(e) => { stop(e); setProgressStatus(active ? '' : opt) }}
                    style={{
                      fontSize: 11, padding: '4px 8px', borderRadius: 12,
                      border: `1px solid ${btnBorder}`,
                      background: btnBg,
                      color: btnColor,
                      fontWeight: active ? 600 : 400,
                      cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                    }}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          ) : (
            <div
              className={progressReadBlink ? 'g-blink' : undefined}
              style={{
                fontSize: 11.4, fontWeight: progress ? 700 : 400,
                color: progressReadColor,
                textAlign: 'center', lineHeight: 1.35,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {progress || '미설정 · 未设置'}
            </div>
          )}
        </div>

        {/* ── 오더예정공장 ── */}
        <div style={{ marginTop: 8 }}>
          <div style={bigLabelStyle}>오더예정공장 预计下单工厂</div>
          {cardEditMode ? (
            <input
              value={draftFactoryCard} maxLength={60}
              onClick={stop} onChange={e => setDraftFactoryCard(e.target.value)}
              placeholder="공장명 工厂名"
              style={{ width: '100%', boxSizing: 'border-box', padding: '4px 6px', fontSize: 10, border: `1px solid ${G.border}`, borderRadius: 5, background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit', marginTop: 4 }}
            />
          ) : editMode ? (
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

        {/* ── 현황 메모 (내용 있을 때만 읽기 모드 표시) ── */}
        <div style={{ marginTop: 8 }}>
          {cardEditMode ? (
            <>
              <div style={bigLabelStyle}>현황 메모 状况备注</div>
              <textarea
                value={memoText}
                onChange={e => setMemoText(e.target.value)}
                onClick={stop}
                placeholder="현황 메모 입력 · 输入状况备注"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  minHeight: 60, maxHeight: 120, resize: 'vertical',
                  fontSize: 12, border: `1px solid ${G.border}`, borderRadius: 6,
                  padding: '6px 8px', marginTop: 4,
                  background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit',
                }}
              />
            </>
          ) : savedMemoText ? (
            <>
              <div style={bigLabelStyle}>현황 메모 状况备注</div>
              <div style={{
                marginTop: 3, fontSize: 11, color: G.tx, textAlign: 'center',
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                overflow: 'hidden', lineHeight: 1.4,
              }}>
                {savedMemoText}
              </div>
            </>
          ) : null}
        </div>

        {/* ── 예상단가 버튼 ── */}
        <button
          type="button"
          onClick={openPriceModal}
          className={priceBlink ? 'g-blink' : undefined}
          style={{
            marginTop: 14, width: '100%', minHeight: 33,
            padding: '7px 5px', fontSize: 11.3, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            whiteSpace: 'nowrap', borderRadius: 999,
            border: `1px solid ${priceBorderColor}`,
            background: priceBg, color: priceColor,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {!priceLoading && <span>{priceOk ? '✅' : '⚠'}</span>}
          <span>예상단가 预算单价</span>
          {priceLoading && <span style={{ fontSize: 10, color: G.fa }}>...</span>}
        </button>

        {/* ── 알림 버튼 ── */}
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

      {/* 삭제 확인 */}
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
