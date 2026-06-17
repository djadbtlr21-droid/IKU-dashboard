import { useState, useEffect, useRef } from 'react'
import { fetchStylePriceTable, saveStylePriceTable, translateText } from '../api/client'

// 기본 공정 10개
const DEFAULT_PROCESSES = [
  '재단 裁剪', '시접 缝份', '어깨봉제 缝肩', '소매봉제 缝袖', '옆선봉제 缝侧缝',
  '밑단봉제 缝下摆', '지퍼달기 装拉链', '라벨달기 钉标签', '마무리 整烫', '검품 检验',
]

let _rowId = 0
function makeRow(process = '') {
  return { id: ++_rowId, process, iku: '', p1: '', p2: '', p3: '', note: '' }
}
function makeDefaultRows() {
  return DEFAULT_PROCESSES.map(p => makeRow(p))
}

// ── 번역 버튼이 달린 입력칸 ──
function TranslatableInput({ value, onChange, placeholder, G }) {
  const [busy, setBusy] = useState(false)
  const [translation, setTranslation] = useState(null)
  const [open, setOpen] = useState(false)

  const toggle = async () => {
    if (open) { setOpen(false); return }
    if (!value.trim() || busy) return
    setBusy(true)
    try {
      const res = await translateText(value)
      if (res?.translation) { setTranslation(res.translation); setOpen(true) }
    } catch { /* silent */ } finally { setBusy(false) }
  }

  const btnDisabled = busy || (!open && !value.trim())
  const btnLabel = busy ? '번역 중 翻译中...' : open ? '닫기 关闭' : '번역 翻译'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1, minWidth: 0, padding: '4px 5px', fontSize: 11,
            border: '1px solid #E5E7EB', borderRadius: 4,
            background: G.bg, color: G.tx, outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button
          type="button"
          onClick={toggle}
          disabled={btnDisabled}
          style={{
            flexShrink: 0, fontSize: 10, padding: '1px 5px', whiteSpace: 'nowrap',
            border: '1px solid #D1D5DB', borderRadius: 3, background: '#F9FAFB',
            color: '#6B7280', cursor: btnDisabled ? 'default' : 'pointer',
            fontFamily: 'inherit', opacity: btnDisabled && !open ? 0.45 : 1,
          }}
        >
          {btnLabel}
        </button>
      </div>
      {/* 슬라이드 다운 번역 결과 */}
      <div style={{
        overflow: 'hidden',
        maxHeight: open && translation ? '80px' : '0',
        opacity: open && translation ? 1 : 0,
        transition: 'max-height 0.25s ease, opacity 0.25s ease',
      }}>
        <div style={{
          marginTop: 3, padding: '3px 6px', borderRadius: 4,
          background: '#EFF6FF', display: 'flex', alignItems: 'flex-start', gap: 4,
        }}>
          <span style={{ fontSize: 10, flexShrink: 0, lineHeight: 1.7 }}>🇰🇷</span>
          <span style={{ fontSize: 11, flex: 1, color: '#1E40AF', lineHeight: 1.5 }}>{translation}</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{ flexShrink: 0, fontSize: 12, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, fontFamily: 'inherit' }}
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
      <span style={{ fontSize: 10, color: '#EA580C', flexShrink: 0 }}>¥</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          flex: 1, minWidth: 0, padding: '4px 3px', fontSize: 11,
          border: '1px solid #E5E7EB', borderRadius: 4,
          background: G.bg, color: '#EA580C', outline: 'none',
          fontFamily: 'inherit', textAlign: 'right',
        }}
      />
    </div>
  )
}

// ── 예상단가 표 모달 (메인 컴포넌트) ──
// Props:
//   G         — 테마 오브젝트
//   sku       — 스타일 SKU (로드/저장 키)
//   onClose   — 닫기 콜백
//   onSavePrice — (sku, jsonString) 저장 성공 시 부모 상태 업데이트 콜백
export default function PriceTableModal({ G, sku, onClose, onSavePrice }) {
  const [rows, setRows] = useState(makeDefaultRows)
  const [factory2, setFactory2] = useState('')
  const [factory3, setFactory3] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const toastRef = useRef(null)

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
          setRows(d.rows.map((r, i) => ({ ...r, id: ++_rowId })))
          if (d.factory2) setFactory2(d.factory2)
          if (d.factory3) setFactory3(d.factory3)
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

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = {
        factory2: factory2.trim(),
        factory3: factory3.trim(),
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
    padding: '7px 5px', fontSize: 10.5, fontWeight: 700, color: G.tx,
    background: G.cardAlt || '#F9FAFB', borderBottom: `1px solid ${G.border || '#E5E7EB'}`,
    textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'bottom',
  }
  const tdStyle = {
    padding: '4px 4px', borderBottom: `1px solid ${G.border || '#E5E7EB'}`,
    verticalAlign: 'top',
  }
  const headerInputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '2px 4px', fontSize: 10,
    border: 'none', borderBottom: '1px dashed #9CA3AF', marginTop: 3,
    background: 'transparent', color: G.tx, outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: G.card, borderRadius: 12,
          width: '90%', maxWidth: 1100, maxHeight: '93vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(0,0,0,0.28)',
          border: `1px solid ${G.border}`,
        }}
      >
        {/* ── 헤더 ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', borderBottom: `1px solid ${G.border}`, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: G.tx }}>예상단가 입력 · 预算单价输入</div>
            <div style={{ fontSize: 10.5, color: G.fa, marginTop: 2 }}>{sku}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: `1px solid ${G.border}`, background: 'transparent', color: G.tx, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}
          >✕</button>
        </div>

        {/* ── 스크롤 영역 ── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
          {loading ? (
            <div style={{ padding: 28, textAlign: 'center', color: G.fa, fontSize: 12 }}>불러오는 중 · 加载中…</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: 28 }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '12%' }} />
                    <col />
                    <col style={{ width: 26 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={thStyle}>#</th>
                      <th style={thStyle}>공정명 工序名</th>
                      <th style={thStyle}>IKU 단가<br /><span style={{ fontWeight: 500, fontSize: 9.5 }}>公司单价</span></th>
                      <th style={thStyle}>
                        <div>① HEXIANG合祥</div>
                        <div style={{ fontSize: 9.5, fontWeight: 500, color: G.mu, marginTop: 2 }}>외주단가 · 外发价</div>
                      </th>
                      <th style={thStyle}>
                        <div>② 외주단가 · 外发价</div>
                        <input
                          value={factory2}
                          onChange={e => setFactory2(e.target.value)}
                          placeholder="공장명 · 工厂名"
                          style={headerInputStyle}
                        />
                      </th>
                      <th style={thStyle}>
                        <div>③ 외주단가 · 外发价</div>
                        <input
                          value={factory3}
                          onChange={e => setFactory3(e.target.value)}
                          placeholder="공장명 · 工厂名"
                          style={headerInputStyle}
                        />
                      </th>
                      <th style={thStyle}>비고 · 备注</th>
                      <th style={thStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={row.id}>
                        <td style={{ ...tdStyle, textAlign: 'center', fontSize: 10.5, color: G.fa, paddingTop: 6 }}>{i + 1}</td>
                        <td style={tdStyle}>
                          <TranslatableInput
                            value={row.process}
                            onChange={v => updateRow(row.id, 'process', v)}
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
                          <TranslatableInput
                            value={row.note}
                            onChange={v => updateRow(row.id, 'note', v)}
                            placeholder="비고 · 备注"
                            G={G}
                          />
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', paddingTop: 6 }}>
                          <button
                            type="button"
                            onClick={() => deleteRow(row.id)}
                            style={{ fontSize: 13, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px', fontFamily: 'inherit', lineHeight: 1 }}
                          >×</button>
                        </td>
                      </tr>
                    ))}
                    {/* 합계 행 */}
                    <tr style={{ background: G.cardAlt || '#F9FAFB' }}>
                      <td colSpan={2} style={{ ...tdStyle, borderBottom: 'none', paddingLeft: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: G.tx }}>합계 合計</span>
                      </td>
                      <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right', paddingRight: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#EA580C' }}>¥{sumField('iku')}</span>
                      </td>
                      <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right', paddingRight: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#EA580C' }}>¥{sumField('p1')}</span>
                      </td>
                      <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right', paddingRight: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#EA580C' }}>¥{sumField('p2')}</span>
                      </td>
                      <td style={{ ...tdStyle, borderBottom: 'none', textAlign: 'right', paddingRight: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#EA580C' }}>¥{sumField('p3')}</span>
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
                  marginTop: 8, width: '100%', padding: '8px 0',
                  fontSize: 12, fontWeight: 600, color: G.mu,
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
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '11px 16px', borderTop: `1px solid ${G.border}`, flexShrink: 0 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 18px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: `1px solid ${G.border}`, background: 'transparent', color: G.tx, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            취소 取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 18px', fontSize: 12, fontWeight: 700, borderRadius: 8, border: '1px solid #EA580C', background: '#EA580C', color: '#fff', cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}
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
