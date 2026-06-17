import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchStylePriceTable, saveStylePriceTable, translateText } from '../api/client'

let _rowId = 0
function makeRow(process = '') {
  return { id: ++_rowId, process, iku: '', p1: '', p2: '', p3: '', p4: '', note: '' }
}
function makeDefaultRows() {
  return [makeRow(), makeRow(), makeRow()]
}

const PRICE_FIELDS = ['process', 'iku', 'p1', 'p2', 'p3', 'p4', 'note']
function stripId(rows) {
  return rows.map(({ id, ...r }) => r)
}

const C_IKU = '#16A34A'
const C_HX  = '#5B8DEF'
const C_OS  = '#EA580C'
const SUB_H = 24

function TransCell({ value, onChange, translation, showTrans, onCloseTranslation, placeholder, G, readOnly }) {
  return (
    <div>
      <input
        value={value}
        onChange={e => !readOnly && onChange(e.target.value)}
        readOnly={readOnly}
        placeholder={readOnly ? '' : placeholder}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '4px 5px', fontSize: 12.1,
          border: readOnly ? 'none' : '1px solid #E5E7EB',
          borderRadius: 4,
          background: 'transparent', color: G.tx, outline: 'none', fontFamily: 'inherit',
          cursor: readOnly ? 'default' : 'text',
        }}
      />
      <div style={{
        overflow: 'hidden',
        maxHeight: (showTrans && translation) ? '80px' : '0',
        opacity: (showTrans && translation) ? 1 : 0,
        transition: 'max-height 0.25s ease, opacity 0.25s ease',
      }}>
        <div style={{
          marginTop: 3, padding: '3px 6px', borderRadius: 4,
          background: '#EFF6FF', display: 'flex', alignItems: 'flex-start', gap: 4,
        }}>
          <span style={{ fontSize: 11, flexShrink: 0, lineHeight: 1.7 }}>🇰🇷</span>
          <span style={{ fontSize: 12.1, flex: 1, color: '#1E40AF', lineHeight: 1.5 }}>{translation || ''}</span>
          <button
            type="button"
            onClick={onCloseTranslation}
            style={{ flexShrink: 0, fontSize: 13.2, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, fontFamily: 'inherit' }}
          >×</button>
        </div>
      </div>
    </div>
  )
}

function PriceInput({ value, onChange, G, color = C_OS, readOnly }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 11, color, flexShrink: 0 }}>¥</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={e => !readOnly && onChange(e.target.value)}
        readOnly={readOnly}
        style={{
          flex: 1, minWidth: 0, padding: '4px 3px', fontSize: 12.1,
          border: readOnly ? 'none' : '1px solid #E5E7EB',
          borderRadius: 4,
          background: 'transparent', color, outline: 'none',
          fontFamily: 'inherit', textAlign: 'right',
          cursor: readOnly ? 'default' : 'text',
        }}
      />
    </div>
  )
}

// ① 읽기/수정 모드 양쪽에서 항상 표시 (readOnly 가드 제거)
function BulkTransBtn({ status, onClick }) {
  const label = status === 'busy'
    ? '번역 중... · 翻译中...'
    : status === 'done'
    ? '번역완료 · 已翻译'
    : '전체번역 全部翻译'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={status === 'busy'}
      style={{
        fontSize: 10, padding: '2px 6px', whiteSpace: 'nowrap',
        border: '1px solid #D1D5DB', borderRadius: 3, background: '#F9FAFB',
        color: '#6B7280', cursor: status === 'busy' ? 'default' : 'pointer',
        fontFamily: 'inherit', opacity: status === 'busy' ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  )
}

function SubSlot({ children, justify = 'center', visible = true }) {
  return (
    <div style={{
      height: SUB_H,
      display: 'flex', alignItems: 'center', justifyContent: justify,
      visibility: visible ? 'visible' : 'hidden',
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      {children}
    </div>
  )
}

// ③ buttons 배열 지원 — 3버튼 다이얼로그용
function ConfirmDialog({ G, msg, onOk, onCancel, buttons }) {
  const btns = buttons || [
    { label: '취소 取消', onClick: onCancel, danger: false },
    { label: '확인 确认', onClick: onOk, danger: true },
  ]
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) (onCancel || btns[0]?.onClick)?.() }}
      style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 10, padding: 20, boxShadow: G.cardShadow, textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: G.tx, marginBottom: 16, lineHeight: 1.5 }}>{msg}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {btns.map((btn, i) => (
            <button key={i} type="button" onClick={btn.onClick}
              style={{
                padding: '8px 16px', fontSize: 12, fontWeight: btn.danger || btn.primary ? 700 : 500,
                borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
                border: btn.danger ? '1px solid #DC2626' : btn.primary ? '1px solid #EA580C' : `1px solid ${G.border}`,
                background: btn.danger ? '#DC2626' : btn.primary ? '#EA580C' : 'transparent',
                color: (btn.danger || btn.primary) ? '#fff' : G.tx,
              }}>
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function PriceTableModal({ G, sku, onClose, onSavePrice, onSaved }) {
  const [rows, setRows] = useState(makeDefaultRows)
  const [factory2, setFactory2] = useState('')
  const [factory3, setFactory3] = useState('')
  const [factory4, setFactory4] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const toastRef = useRef(null)

  const [readOnly, setReadOnly] = useState(true)
  const [originalData, setOriginalData] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null)

  const [procTrans, setProcTrans] = useState({})
  const [procOpen, setProcOpen] = useState({})
  const [noteTrans, setNoteTrans] = useState({})
  const [noteOpen, setNoteOpen] = useState({})
  const [procBulkSt, setProcBulkSt] = useState('idle')
  const [noteBulkSt, setNoteBulkSt] = useState('idle')

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  useEffect(() => () => clearTimeout(toastRef.current), [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchStylePriceTable(sku)
      .then(res => {
        if (!alive) return
        const d = res?.data
        if (d && Array.isArray(d.rows) && d.rows.length > 0) {
          const loadedRows = d.rows.map((r) => ({
            id: ++_rowId,
            process: r.process || '',
            iku: r.iku || '',
            p1: r.p1 || '',
            p2: r.p2 || '',
            p3: r.p3 || '',
            p4: r.p4 || '',
            note: r.note || '',
          }))
          setRows(loadedRows)
          if (d.factory2) setFactory2(d.factory2)
          if (d.factory3) setFactory3(d.factory3)
          if (d.factory4) setFactory4(d.factory4)
        }
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [sku])

  const showToast = (type, msg) => {
    setToast({ type, msg })
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 2000)
  }

  const enterEditMode = () => {
    setOriginalData({ rows: stripId(rows), factory2, factory3, factory4 })
    setReadOnly(false)
  }

  const isDirty = useCallback((curRows, f2, f3, f4) => {
    if (!originalData) return false
    return JSON.stringify({ rows: stripId(curRows), factory2: f2, factory3: f3, factory4: f4 }) !==
      JSON.stringify({ rows: originalData.rows, factory2: originalData.factory2, factory3: originalData.factory3, factory4: originalData.factory4 })
  }, [originalData])

  const restoreOriginal = useCallback(() => {
    if (!originalData) return
    setRows(originalData.rows.map(r => ({ id: ++_rowId, ...r })))
    setFactory2(originalData.factory2)
    setFactory3(originalData.factory3)
    setFactory4(originalData.factory4)
  }, [originalData])

  const handleClearAll = () => {
    setConfirmDialog({
      msg: '모든 데이터를 삭제하시겠습니까? · 确认删除所有数据？',
      onOk: () => {
        setRows([makeRow(), makeRow(), makeRow()])
        setFactory2('')
        setFactory3('')
        setFactory4('')
        setConfirmDialog(null)
      },
      onCancel: () => setConfirmDialog(null),
    })
  }

  const updateRow = (id, field, val) =>
    setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: val } : r))
  const deleteRow = (id) => setRows(rs => rs.filter(r => r.id !== id))
  const addRow = () => setRows(rs => [...rs, makeRow()])

  const sumField = (field) => {
    const total = rows.reduce((acc, r) => {
      const v = parseFloat(r[field])
      return acc + (isNaN(v) ? 0 : v)
    }, 0)
    if (total === 0) return '0'
    return Number.isInteger(total) ? String(total) : total.toFixed(2).replace(/\.?0+$/, '')
  }

  const bulkTranslate = useCallback(async (field, setBulkSt, setTrans, setOpen) => {
    setBulkSt('busy')
    const targets = rows.filter(r => (r[field] || '').trim())
    const results = await Promise.all(
      targets.map(r =>
        translateText(r[field])
          .then(res => ({ id: r.id, text: res?.translation || null }))
          .catch(() => ({ id: r.id, text: '번역실패 · 翻译失败' }))
      )
    )
    const newTrans = {}
    const newOpen = {}
    results.forEach(({ id, text }) => {
      if (text) { newTrans[id] = text; newOpen[id] = true }
    })
    setTrans(prev => ({ ...prev, ...newTrans }))
    setOpen(prev => ({ ...prev, ...newOpen }))
    setBulkSt('done')
    setTimeout(() => setBulkSt('idle'), 3000)
  }, [rows])

  // ② 저장 후 모달 닫지 않고 읽기 모드로 전환
  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const cleanRows = stripId(rows).filter(r => PRICE_FIELDS.some(f => (r[f] || '').trim()))
      const data = {
        factory2: factory2.trim(),
        factory3: factory3.trim(),
        factory4: factory4.trim(),
        rows: cleanRows,
        updatedAt: new Date().toISOString(),
      }
      const res = await saveStylePriceTable(sku, data)
      if (res?.ok) {
        const jsonStr = JSON.stringify(data)
        onSavePrice?.(sku, jsonStr)
        onSaved?.()
        showToast('ok', '저장됨 · 已保存')
        // 모달 닫지 않고 읽기 모드로 전환
        setReadOnly(true)
        setOriginalData(null)
      } else {
        showToast('bad', '저장 실패 · 保存失败')
      }
    } catch {
      showToast('bad', '저장 실패 · 保存失败')
    } finally {
      setSaving(false)
    }
  }, [rows, factory2, factory3, factory4, sku, onSavePrice, onSaved])

  // ③ 수정종료 버튼 — 변경사항 없으면 즉시, 있으면 3버튼 확인
  const handleEndEdit = useCallback(() => {
    if (!isDirty(rows, factory2, factory3, factory4)) {
      restoreOriginal()
      setReadOnly(true)
      return
    }
    setConfirmDialog({
      msg: '저장하지 않은 변경사항이 있습니다. 수정을 종료하시겠습니까? · 有未保存的更改，确认结束修改？',
      buttons: [
        {
          label: '저장 후 종료 · 保存并退出',
          primary: true,
          onClick: () => { setConfirmDialog(null); handleSave() },
        },
        {
          label: '저장 없이 종료 · 直接退出',
          danger: false,
          onClick: () => { restoreOriginal(); setReadOnly(true); setConfirmDialog(null) },
        },
        {
          label: '취소 · 取消',
          danger: false,
          onClick: () => setConfirmDialog(null),
        },
      ],
    })
  }, [isDirty, rows, factory2, factory3, factory4, restoreOriginal, handleSave])

  const thBase = {
    padding: '7px 5px', fontSize: 11.6, fontWeight: 700,
    background: G.cardAlt || '#F9FAFB', borderBottom: `1px solid ${G.border || '#E5E7EB'}`,
    textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'bottom',
  }
  const tdStyle = {
    padding: '4px 4px', borderBottom: `1px solid ${G.border || '#E5E7EB'}`,
    verticalAlign: 'top',
  }
  const factoryInputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '2px 4px', fontSize: 11,
    border: 'none', borderBottom: readOnly ? 'none' : '1px dashed #9CA3AF',
    background: 'transparent', color: G.tx, outline: 'none', fontFamily: 'inherit',
    cursor: readOnly ? 'default' : 'text',
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          background: G.card, borderRadius: 12,
          width: '92%', maxWidth: 1265, maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(0,0,0,0.28)',
          border: `1px solid ${G.border}`,
        }}
      >
        {confirmDialog && (
          <ConfirmDialog
            G={G}
            msg={confirmDialog.msg}
            onOk={confirmDialog.onOk}
            onCancel={confirmDialog.onCancel || (() => setConfirmDialog(null))}
            buttons={confirmDialog.buttons}
          />
        )}

        {/* 모달 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 21px', borderBottom: `1px solid ${G.border}`, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15.4, fontWeight: 700, color: G.tx }}>
                {readOnly ? '예상단가 조회 · 预算单价查看' : '예상단가 수정 · 预算单价修改'}
              </span>
              {readOnly ? (
                <button
                  type="button"
                  onClick={enterEditMode}
                  style={{ fontSize: 11.6, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid #EA580C', background: '#FFF7ED', color: '#EA580C', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  수정 修改
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  style={{ fontSize: 11.6, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#F3F4F6', color: '#9CA3AF', cursor: 'default', fontFamily: 'inherit' }}
                >
                  수정 중 修改中
                </button>
              )}
            </div>
            <div style={{ fontSize: 11.6, color: G.fa, marginTop: 2 }}>{sku}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: `1px solid ${G.border}`, background: 'transparent', color: G.tx, cursor: 'pointer', fontSize: 15.4, fontFamily: 'inherit' }}
          >✕</button>
        </div>

        {/* 스크롤 영역 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>
          {loading ? (
            <div style={{ padding: 28, textAlign: 'center', color: G.fa, fontSize: 13.2 }}>불러오는 중 · 加载中…</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: 28 }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '10%' }} />
                    <col />
                    {!readOnly && <col style={{ width: 26 }} />}
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={thBase}>
                        <div>#</div>
                        <SubSlot visible={false} />
                      </th>
                      <th style={{ ...thBase, whiteSpace: 'normal' }}>
                        <div>공정명 工序名</div>
                        {/* ① 읽기/수정 모드 모두 번역 버튼 표시 */}
                        <SubSlot>
                          <BulkTransBtn
                            status={procBulkSt}
                            onClick={() => bulkTranslate('process', setProcBulkSt, setProcTrans, setProcOpen)}
                          />
                        </SubSlot>
                      </th>
                      <th style={{ ...thBase, whiteSpace: 'normal', color: C_IKU }}>
                        <div>IKU 단가</div>
                        <SubSlot>
                          <span style={{ fontWeight: 500, fontSize: 10.5 }}>公司单价</span>
                        </SubSlot>
                      </th>
                      <th style={{ ...thBase, whiteSpace: 'normal', wordBreak: 'keep-all', color: C_HX }}>
                        <div>1. HEXIANG단가</div>
                        <SubSlot>
                          <span style={{ fontWeight: 500, fontSize: 10.5 }}>合祥单价</span>
                        </SubSlot>
                      </th>
                      <th style={{ ...thBase, whiteSpace: 'normal', color: C_OS }}>
                        <div>2. 외주단가 外发单价</div>
                        <SubSlot justify="stretch">
                          <input
                            value={factory2}
                            onChange={e => setFactory2(e.target.value)}
                            readOnly={readOnly}
                            placeholder={readOnly ? '' : '공장명 · 工厂名'}
                            style={factoryInputStyle}
                          />
                        </SubSlot>
                      </th>
                      <th style={{ ...thBase, whiteSpace: 'normal', color: C_OS }}>
                        <div>3. 외주단가 外发单价</div>
                        <SubSlot justify="stretch">
                          <input
                            value={factory3}
                            onChange={e => setFactory3(e.target.value)}
                            readOnly={readOnly}
                            placeholder={readOnly ? '' : '공장명 · 工厂名'}
                            style={factoryInputStyle}
                          />
                        </SubSlot>
                      </th>
                      <th style={{ ...thBase, whiteSpace: 'normal', color: C_OS }}>
                        <div>4. 외주단가 外发单价</div>
                        <SubSlot justify="stretch">
                          <input
                            value={factory4}
                            onChange={e => setFactory4(e.target.value)}
                            readOnly={readOnly}
                            placeholder={readOnly ? '' : '공장명 · 工厂名'}
                            style={factoryInputStyle}
                          />
                        </SubSlot>
                      </th>
                      <th style={{ ...thBase, whiteSpace: 'normal' }}>
                        <div>비고 · 备注</div>
                        {/* ① 읽기/수정 모드 모두 번역 버튼 표시 */}
                        <SubSlot>
                          <BulkTransBtn
                            status={noteBulkSt}
                            onClick={() => bulkTranslate('note', setNoteBulkSt, setNoteTrans, setNoteOpen)}
                          />
                        </SubSlot>
                      </th>
                      {!readOnly && (
                        <th style={thBase}>
                          <SubSlot visible={false} />
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={row.id}>
                        <td style={{ ...tdStyle, textAlign: 'center', fontSize: 11.6, color: G.fa, paddingTop: 6 }}>{i + 1}</td>
                        <td style={tdStyle}>
                          <TransCell
                            value={row.process}
                            onChange={v => updateRow(row.id, 'process', v)}
                            translation={procTrans[row.id]}
                            showTrans={!!procOpen[row.id]}
                            onCloseTranslation={() => setProcOpen(s => ({ ...s, [row.id]: false }))}
                            placeholder="공정명 工序名"
                            G={G}
                            readOnly={readOnly}
                          />
                        </td>
                        <td style={tdStyle}>
                          <PriceInput value={row.iku} onChange={v => updateRow(row.id, 'iku', v)} G={G} color={C_IKU} readOnly={readOnly} />
                        </td>
                        <td style={tdStyle}>
                          <PriceInput value={row.p1} onChange={v => updateRow(row.id, 'p1', v)} G={G} color={C_HX} readOnly={readOnly} />
                        </td>
                        <td style={tdStyle}>
                          <PriceInput value={row.p2} onChange={v => updateRow(row.id, 'p2', v)} G={G} color={C_OS} readOnly={readOnly} />
                        </td>
                        <td style={tdStyle}>
                          <PriceInput value={row.p3} onChange={v => updateRow(row.id, 'p3', v)} G={G} color={C_OS} readOnly={readOnly} />
                        </td>
                        <td style={tdStyle}>
                          <PriceInput value={row.p4} onChange={v => updateRow(row.id, 'p4', v)} G={G} color={C_OS} readOnly={readOnly} />
                        </td>
                        <td style={tdStyle}>
                          <TransCell
                            value={row.note}
                            onChange={v => updateRow(row.id, 'note', v)}
                            translation={noteTrans[row.id]}
                            showTrans={!!noteOpen[row.id]}
                            onCloseTranslation={() => setNoteOpen(s => ({ ...s, [row.id]: false }))}
                            placeholder="비고 · 备注"
                            G={G}
                            readOnly={readOnly}
                          />
                        </td>
                        {!readOnly && (
                          <td style={{ ...tdStyle, textAlign: 'center', paddingTop: 6 }}>
                            <button
                              type="button"
                              onClick={() => deleteRow(row.id)}
                              style={{ fontSize: 14.3, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px', fontFamily: 'inherit', lineHeight: 1 }}
                            >×</button>
                          </td>
                        )}
                      </tr>
                    ))}

                    {/* 합계 행 */}
                    <tr style={{ background: G.cardAlt || '#F9FAFB' }}>
                      <td colSpan={2} style={{ ...tdStyle, borderBottom: 'none', paddingLeft: 8 }}>
                        <span style={{ fontSize: 12.1, fontWeight: 700, color: G.tx }}>합계 合計</span>
                      </td>
                      <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right', paddingRight: 6 }}>
                        <span style={{ fontSize: 12.1, fontWeight: 700, color: C_IKU }}>¥{sumField('iku')}</span>
                      </td>
                      <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right', paddingRight: 6 }}>
                        <span style={{ fontSize: 12.1, fontWeight: 700, color: C_HX }}>¥{sumField('p1')}</span>
                      </td>
                      <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right', paddingRight: 6 }}>
                        <span style={{ fontSize: 12.1, fontWeight: 700, color: C_OS }}>¥{sumField('p2')}</span>
                      </td>
                      <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right', paddingRight: 6 }}>
                        <span style={{ fontSize: 12.1, fontWeight: 700, color: C_OS }}>¥{sumField('p3')}</span>
                      </td>
                      <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right', paddingRight: 6 }}>
                        <span style={{ fontSize: 12.1, fontWeight: 700, color: C_OS }}>¥{sumField('p4')}</span>
                      </td>
                      <td colSpan={readOnly ? 1 : 2} style={{ ...tdStyle, borderBottom: 'none' }}></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {!readOnly && (
                <button
                  type="button"
                  onClick={addRow}
                  style={{
                    marginTop: 8, width: '100%', padding: '9px 0',
                    fontSize: 13.2, fontWeight: 600, color: G.mu,
                    background: 'transparent', border: `1px dashed ${G.border || '#D1D5DB'}`,
                    borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  ＋ 공정 추가 · 添加工序
                </button>
              )}
            </>
          )}
        </div>

        {/* ③ 하단 버튼 재배치 */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', padding: '13px 18px', borderTop: `1px solid ${G.border}`, flexShrink: 0 }}>
          {readOnly ? (
            /* 읽기 모드: 닫기 버튼만 */
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '9px 21px', fontSize: 13.2, fontWeight: 500, borderRadius: 8, border: `1px solid ${G.border}`, background: 'transparent', color: G.tx, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              닫기 关闭
            </button>
          ) : (
            /* 수정 모드: [전체삭제][수정종료] ... [저장] */
            <>
              <button
                type="button"
                onClick={handleClearAll}
                style={{ marginRight: 4, padding: '9px 16px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: '1px solid #EF4444', background: 'transparent', color: '#EF4444', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                전체삭제 全部删除
              </button>
              <button
                type="button"
                onClick={handleEndEdit}
                style={{ marginRight: 'auto', padding: '9px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: `1px solid ${G.border}`, background: 'transparent', color: G.tx, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                수정종료 结束修改
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{ padding: '9px 21px', fontSize: 13.2, fontWeight: 700, borderRadius: 8, border: '1px solid #EA580C', background: '#EA580C', color: '#fff', cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? '저장 중 · 保存中...' : '저장 保存'}
              </button>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10000, padding: '9px 16px', borderRadius: 9,
          background: toast.type === 'ok' ? '#10B981' : '#EF4444',
          color: '#fff', fontSize: 12.5, fontWeight: 600,
          boxShadow: '0 6px 20px rgba(0,0,0,0.22)', whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
