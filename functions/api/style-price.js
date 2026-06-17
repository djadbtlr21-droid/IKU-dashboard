// ─────────────────────────────────────────────────────────────
// 예상단가 표 전용 엔드포인트 (style_price:{SKU} — PROCESS_KV)
//
// GET  /api/style-price?sku={SKU}  → { ok, data: { factory2, factory3, rows, updatedAt } | null }
// POST /api/style-price            → { ok } (body: { sku, data })
//
// style-meta.js 의 style_price: 키와 동일 KV 키를 사용하므로 fetchStyleMeta()
// GET 응답에도 price[sku]로 새 JSON이 반영됨 (카드 버튼 라벨 업데이트 연동).
// 기존 style-meta.js MAX_VAL=300 제한 없음 — 최대 32KB 허용.
// ─────────────────────────────────────────────────────────────
import { json, preflight } from './_resp.js'
import { getKV } from './_kv.js'

const PRICE_PREFIX = 'style_price:'
const MAX_SIZE = 32768

function validSku(s) { return typeof s === 'string' && s.length > 0 && s.length <= 160 }

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return preflight('GET, POST, OPTIONS')

  const kv = getKV(env, 'PROCESS_KV')
  if (!kv) return json({ ok: false, error: 'kv_not_configured', message: 'PROCESS_KV 바인딩이 없습니다' }, 503)

  // ── GET: SKU별 예상단가 표 로드 ──
  if (request.method === 'GET') {
    const url = new URL(request.url)
    const sku = url.searchParams.get('sku')
    if (!validSku(sku)) return json({ ok: false, error: 'invalid_sku' }, 400)
    try {
      const raw = await kv.get(PRICE_PREFIX + sku)
      if (!raw) return json({ ok: true, data: null })
      let parsed
      try { parsed = JSON.parse(raw) } catch { return json({ ok: true, data: null }) }
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.rows)) {
        return json({ ok: true, data: parsed }, 200, { 'Cache-Control': 'no-store' })
      }
      return json({ ok: true, data: null })
    } catch (err) {
      console.error('[style-price] GET error', err)
      return json({ ok: false, error: 'read_failed' }, 500)
    }
  }

  // ── POST: SKU별 예상단가 표 저장 ──
  if (request.method === 'POST') {
    let body
    try { body = await request.json() } catch { return json({ ok: false, error: 'invalid_json' }, 400) }
    const { sku, data } = body || {}
    if (!validSku(sku)) return json({ ok: false, error: 'invalid_sku' }, 400)
    if (!data || typeof data !== 'object' || !Array.isArray(data.rows)) {
      return json({ ok: false, error: 'invalid_data', message: 'data.rows 배열이 필요합니다' }, 400)
    }
    const str = JSON.stringify(data)
    if (str.length > MAX_SIZE) return json({ ok: false, error: 'data_too_large' }, 413)
    try {
      await kv.put(PRICE_PREFIX + sku, str)
      return json({ ok: true })
    } catch (err) {
      console.error('[style-price] POST error', err)
      return json({ ok: false, error: 'write_failed' }, 500)
    }
  }

  return json({ ok: false, error: 'Method Not Allowed' }, 405, { Allow: 'GET, POST, OPTIONS' })
}
