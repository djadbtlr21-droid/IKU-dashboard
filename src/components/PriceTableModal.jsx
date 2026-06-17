import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchStylePriceTable, saveStylePriceTable, translateText } from '../api/client'

// 신규 SKU는 빈 행 3개만 표시
let _rowId = 0
function makeRow(process = '') {
  return { id: ++_rowId, process, iku: '', p1: '', p2: '', p3: '', p4: '', note: '' }
}
function makeDefaultRows() {
  return [makeRow(), makeRow(), makeRow()]
}

// ── 단순 입력칸 (번역 결과 슬라이드 포함, 버튼 없음) ──
function TransCell({ value, onChange, translation, showTrans, onCloseTranslation, placeholder, G }) {
  return (
    <div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '4px 5px', fontSize: 12.1,
          border: '1px solid #E5E7EB', borderRadius: 4,
          background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit',
        }}
      />
      {/* 슬라이드 다운 번역 결과 */}
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

// ── 단가 입력칸 (¥, 주황색, 우측 정렬) ──
function PriceInput({ value, onChange, G }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 11, color: '#EA580C', flexShrink: 0 }}>¥</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          flex: 1, minWidth: 0, padding: '4px 3px', fontSize: 12.1,
          border: '1px solid #E5E7EB', borderRadius: 4,
          background: G.bg, color: '#EA580C', outline: 'none',
          fontFamily: 'inherit', textAlign: 'right',
        }}
      />
    </div>
  )
}

// ── 열 일괄 번역 버튼 ──
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
        marginLeft: 5, fontSize: 10, padding: '2px 6px', whiteSpace: 'nowrap',
        border: '1px solid #D1D5DB', borderRadius: 3, background: '#F9FAFB',
        color: '#6B7280', cursor: status === 'busy' ? 'default' : 'pointer',
        fontFamily: 'inherit', opacity: status === 'busy' ? 0.6 : 1,
        verticalAlign: 'middle',
      }}
    >
      {label}
    </button>
  )
}

// ── 예상단가 표 모달 (메인 컴포넌트) ──
export default function PriceTableModal({ G, sku, onClose, onSavePrice }) {
  const [rows, setRows] = useState(makeDefaultRows)
  const [factory2, setFactory2] = useState('')
  const [factory3, setFactory3] = useState('')
  const [factory4, setFactory4] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const toastRef = useRef(null)

  // ② 일괄 번역 상태 — { [rowId]: translation string }
  const [procTrans, setProcTrans] = useState({})   // 공정명 번역 결과
  const [procOpen, setProcOpen] = useState({})     // 공정명 번역 표시 여부
  const [noteTrans, setNoteTrans] = useState({})   // 비고 번역 결과
  const [noteOpen, setNoteOpen] = useState({})     // 비고 번역 표시 여부
  const [procBulkSt, setProcBulkSt] = useState('idle')  // 'idle'|'busy'|'done'
  const [noteBulkSt, setNoteBulkSt] = useState('idle')

  // ESC 닫기
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  useEffect(() => () => clearTimeout(toastRef.current), [])

  // KV 로드
  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchStylePriceTable(sku)
      .then(res => {
        if (!alive) return
        const d = res?.data
        if (d && Array.isArray(d.rows) && d.rows.length > 0) {
          setRows(d.rows.map((r) => ({
            id: ++_rowId,
            process: r.process || '',
            iku: r.iku || '',
            p1: r.p1 || '',
            p2: r.p2 || '',
            p3: r.p3 || '',
            p4: r.p4 || '',
            note: r.note || '',
          })))
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

  // ② 일괄 번역 — 공정명 / 비고 공통 핸들러
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

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = {
        factory2: factory2.trim(),
        factory3: factory3.trim(),
        factory4: factory4.trim(),
        rows: rows.map(({ id, ...r }) => r),
        updatedAt: new Date().toISOString(),
      }
      const res = await saveStylePriceTable(sku, data)
      if (res?.ok) {
        const jsonStr = JSON.stringify(data)
        onSavePrice?.(sku, jsonStr)
        showToast('ok', '저장됨 · 已保存')
        setTimeout(() => onClose(), 900)
      } else {
        showToast('bad', '저장 실패 · 保存失败')
      }
    } catch {
      showToast('bad', '저장 실패 · 保存失败')
    } finally {
      setSaving(false)
    }
  }

  const thStyle = {
    padding: '7px 5px', fontSize: 11.6, fontWeight: 700, color: G.tx,
    background: G.cardAlt || '#F9FAFB', borderBottom: `1px solid ${G.border || '#E5E7EB'}`,
    textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'bottom',
  }
  const tdStyle = {
    padding: '4px 4px', borderBottom: `1px solid ${G.border || '#E5E7EB'}`,
    verticalAlign: 'top',
  }
  const headerInputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '2px 4px', fontSize: 11,
    border: 'none', borderBottom: '1px dashed #9CA3AF', marginTop: 3,
    background: 'transparent', color: G.tx, outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: G.card, borderRadius: 12,
          width: '92%', maxWidth: 1265, maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(0,0,0,0.28)',
          border: `1px solid ${G.border}`,
        }}
      >
        {/* ── 헤더 ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 21px', borderBottom: `1px solid ${G.border}`, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15.4, fontWeight: 700, color: G.tx }}>예상단가 입력 · 预算单价输入</div>
            <div style={{ fontSize: 11.6, color: G.fa, marginTop: 2 }}>{sku}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: `1px solid ${G.border}`, background: 'transparent', color: G.tx, cursor: 'pointer', fontSize: 15.4, fontFamily: 'inherit' }}
          >✕</button>
        </div>

        {/* ── 스크롤 영역 ── */}
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
                    <col style={{ width: 26 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={thStyle}>#</th>
                      {/* ② 공정명 헤더 — 일괄 번역 버튼 */}
                      <th style={{ ...thStyle, whiteSpace: 'normal' }}>
                        <span>공정명 工序名</span>
                        <BulkTransBtn
                          status={procBulkSt}
                          onClick={() => bulkTranslate('process', setProcBulkSt, setProcTrans, setProcOpen)}
                        />
                      </th>
                      <th style={thStyle}>IKU 단가<br /><span style={{ fontWeight: 500, fontSize: 10.5 }}>公司单价</span></th>
                      {/* ① HEXIANG 헤더 2줄 */}
                      <th style={{ ...thStyle, whiteSpace: 'normal', wordBreak: 'keep-all' }}>
                        <div>1. HEXIANG단가</div>
                        <div style={{ fontWeight: 500, fontSize: 10.5 }}>合祥单价</div>
                      </th>
                      {/* 외주단가 2 */}
                      <th style={thStyle}>
                        <div>2. 외주단가 外发单价</div>
                        <input
                          value={factory2}
                          onChange={e => setFactory2(e.target.value)}
                          placeholder="공장명 · 工厂名"
                          style={headerInputStyle}
                        />
                      </th>
                      {/* 외주단가 3 */}
                      <th style={thStyle}>
                        <div>3. 외주단가 外发单价</div>
                        <input
                          value={factory3}
                          onChange={e => setFactory3(e.target.value)}
                          placeholder="공장명 · 工厂名"
                          style={headerInputStyle}
                        />
                      </th>
                      {/* 외주단가 4 */}
                      <th style={thStyle}>
                        <div>4. 외주단가 外发单价</div>
                        <input
                          value={factory4}
                          onChange={e => setFactory4(e.target.value)}
                          placeholder="공장명 · 工厂名"
                          style={headerInputStyle}
                        />
                      </th>
                      {/* ② 비고 헤더 — 일괄 번역 버튼 */}
                      <th style={{ ...thStyle, whiteSpace: 'normal' }}>
                        <span>비고 · 备注</span>
                        <BulkTransBtn
                          status={noteBulkSt}
                          onClick={() => bulkTranslate('note', setNoteBulkSt, setNoteTrans, setNoteOpen)}
                        />
                      </th>
                      <th style={thStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={row.id}>
                        <td style={{ ...tdStyle, textAlign: 'center', fontSize: 11.6, color: G.fa, paddingTop: 6 }}>{i + 1}</td>
                        {/* ② 공정명 — 개별 번역 버튼 없음, 일괄 번역 결과만 표시 */}
                        <td style={tdStyle}>
                          <TransCell
                            value={row.process}
                            onChange={v => updateRow(row.id, 'process', v)}
                            translation={procTrans[row.id]}
                            showTrans={!!procOpen[row.id]}
                            onCloseTranslation={() => setProcOpen(s => ({ ...s, [row.id]: false }))}
                            placeholder="공정명 工序名"
                            G={G}
                          />
                        </td>
                        <td style={tdStyle}>
                          <PriceInput value={row.iku} onChange={v => updateRow(row.id, 'iku', v)} G={G} />
                        </td>
                        <td style={tdStyle}>
                          <PriceInput value={row.p1} onChange={v => updateRow(row.id, 'p1', v)} G={G} />
                        </td>
                        <td style={tdStyle}>
                          <PriceInput value={row.p2} onChange={v => updateRow(row.id, 'p2', v)} G={G} />
                        </td>
                        <td style={tdStyle}>
                          <PriceInput value={row.p3} onChange={v => updateRow(row.id, 'p3', v)} G={G} />
                        </td>
                        <td style={tdStyle}>
                          <PriceInput value={row.p4} onChange={v => updateRow(row.id, 'p4', v)} G={G} />
                        </td>
                        {/* ② 비고 — 개별 번역 버튼 없음, 일괄 번역 결과만 표시 */}
                        <td style={tdStyle}>
                          <TransCell
                            value={row.note}
                            onChange={v => updateRow(row.id, 'note', v)}
                            translation={noteTrans[row.id]}
                            showTrans={!!noteOpen[row.id]}
                            onCloseTranslation={() => setNoteOpen(s => ({ ...s, [row.id]: false }))}
                            placeholder="비고 · 备注"
                            G={G}
                          />
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', paddingTop: 6 }}>
                          <button
                            type="button"
                            onClick={() => deleteRow(row.id)}
                            style={{ fontSize: 14.3, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px', fontFamily: 'inherit', lineHeight: 1 }}
                          >×</button>
                        </td>
                      </tr>
                    ))}
                    {/* 합계 행 */}
                    <tr style={{ background: G.cardAlt || '#F9FAFB' }}>
                      <td colSpan={2} style={{ ...tdStyle, borderBottom: 'none', paddingLeft: 8 }}>
                        <span style={{ fontSize: 12.1, fontWeight: 700, color: G.tx }}>합계 合計</span>
                      </td>
                      <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right', paddingRight: 6 }}>
                        <span style={{ fontSize: 12.1, fontWeight: 700, color: '#EA580C' }}>¥{sumField('iku')}</span>
                      </td>
                      <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right', paddingRight: 6 }}>
                        <span style={{ fontSize: 12.1, fontWeight: 700, color: '#EA580C' }}>¥{sumField('p1')}</span>
                      </td>
                      <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right', paddingRight: 6 }}>
                        <span style={{ fontSize: 12.1, fontWeight: 700, color: '#EA580C' }}>¥{sumField('p2')}</span>
                      </td>
                      <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right', paddingRight: 6 }}>
                        <span style={{ fontSize: 12.1, fontWeight: 700, color: '#EA580C' }}>¥{sumField('p3')}</span>
                      </td>
                      <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right', paddingRight: 6 }}>
                        <span style={{ fontSize: 12.1, fontWeight: 700, color: '#EA580C' }}>¥{sumField('p4')}</span>
                      </td>
                      <td colSpan={2} style={{ ...tdStyle, borderBottom: 'none' }}></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 공정 추가 버튼 */}
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
            </>
          )}
        </div>

        {/* ── 하단 버튼 ── */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '13px 18px', borderTop: `1px solid ${G.border}`, flexShrink: 0 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '9px 21px', fontSize: 13.2, fontWeight: 500, borderRadius: 8, border: `1px solid ${G.border}`, background: 'transparent', color: G.tx, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            취소 取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '9px 21px', fontSize: 13.2, fontWeight: 700, borderRadius: 8, border: '1px solid #EA580C', background: '#EA580C', color: '#fff', cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? '저장 중 · 保存中...' : '저장 保存'}
          </button>
        </div>
      </div>

      {/* 토스트 */}
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
