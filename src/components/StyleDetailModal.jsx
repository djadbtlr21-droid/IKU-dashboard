import { useEffect } from 'react'
import { X } from 'lucide-react'
import ZohoImage from './ZohoImage'
import {
  F, pick, fmtTime, styleStatusBadge, isOrdered, imageField, styleImageUrl,
} from '../utils/styleFields'

// ──────────────────────────────────────────────────────────
// Style 상세 모달 (All_Styles) — Style 탭 / 미오더 섹션 공용
// 닫기: X 버튼 / 배경 클릭 / ESC
// ──────────────────────────────────────────────────────────
export default function StyleDetailModal({ G, rec, onClose, onZoom }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const imgUrl = styleImageUrl(rec)
  const sb = styleStatusBadge(G, pick(rec, F.styleStatus))
  const ordered = isOrdered(rec)

  const rows = [
    ['SKU', pick(rec, F.sku)],
    ['영문명 · Eng Name', pick(rec, F.eng)],
    ['중문명 · 中文款号', pick(rec, F.chi)],
    ['브랜드 · 品牌', pick(rec, F.brand)],
    ['시즌 · 季节', pick(rec, F.season)],
    ['성별 · 性别', pick(rec, F.gender)],
    ['카테고리 · 分类', pick(rec, F.category)],
    ['원단 · 面料', pick(rec, F.fabric)],
    ['목표원가 · 成本', pick(rec, F.cost)],
    ['스타일 상태 · 样品状态', pick(rec, F.styleStatus)],
    ['샘플 상태 · 打样状态', pick(rec, F.sampleStatus)],
    ['오더 상태 · 订单状态', ordered ? '✓ 오더완료 已下单' : '× 미오더 未下单'],
    ['생성일 · 创建时间', fmtTime(pick(rec, F.created))],
    ['수정일 · 修改时间', fmtTime(pick(rec, F.modified))],
  ]

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: G.overlayBg, zIndex: 2500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: 14, boxShadow: G.cardShadow, width: '100%', maxWidth: 760, maxHeight: '88vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${G.hair}`, position: 'sticky', top: 0, background: G.card, zIndex: 1 }}>
          <div className="syne" style={{ fontSize: 16, fontWeight: 700, color: G.tx }}>{pick(rec, F.sku) || '스타일 상세 · 款式详情'}</div>
          <button onClick={onClose} aria-label="close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: G.mu, display: 'flex', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: 18, padding: 20, flexWrap: 'wrap' }}>
          {/* 이미지 좌측 */}
          <div style={{ flex: '0 0 260px', maxWidth: '100%' }}>
            <div onClick={() => imgUrl && onZoom && onZoom(imgUrl)}
              style={{ width: '100%', aspectRatio: '3/4', borderRadius: 10, overflow: 'hidden', border: `1px solid ${G.hair}`, cursor: imgUrl ? 'zoom-in' : 'default', background: G.cardAlt }}>
              <ZohoImage mo={rec} field={imageField(rec) || 'Style_Image'} G={G} alt={pick(rec, F.sku)} placeholderText="No Image · 无图片" />
            </div>
          </div>
          {/* 정보 우측 */}
          <div style={{ flex: '1 1 320px', minWidth: 240 }}>
            {sb && (
              <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#fff', background: sb.color, padding: '3px 10px', borderRadius: 999, marginBottom: 12 }}>{sb.label}</span>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {rows.map(([label, val]) => (
                  <tr key={label}>
                    <td style={{ padding: '7px 8px 7px 0', fontSize: 11, color: G.mu, verticalAlign: 'top', whiteSpace: 'nowrap', borderBottom: `1px solid ${G.hair}` }}>{label}</td>
                    <td style={{ padding: '7px 0', fontSize: 12.5, color: val ? G.tx : G.fa, fontWeight: 500, borderBottom: `1px solid ${G.hair}` }}>{val || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
