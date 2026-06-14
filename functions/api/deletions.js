// ─────────────────────────────────────────────────────────────
// 목록 삭제 store (EdgeOne Pages KV) — 숨기기 기능 대체
//
// KV binding: PROCESS_KV (재사용). 신규 키 (기존 process:* 구조 불변):
//   deleted_mo:{MO_ID}     → "1"  (오더완료 카드 삭제)
//   deleted_style:{SKU}    → "1"  (미오더 카드 삭제)
//
// GET  → { ok, mo:[MO_ID...], style:[SKU...] }
// POST → { type:'mo'|'style', id }  (비밀번호 불필요, 복원 없음)
//   Zoho ERP 데이터는 변경하지 않음 — 화면 목록에서만 제외.
// ─────────────────────────────────────────────────────────────

import { json, preflight } from './_resp.js';
import { getKV } from './_kv.js';

const MO_PREFIX = 'deleted_mo:';
const STYLE_PREFIX = 'deleted_style:';

function validId(s) { return typeof s === 'string' && s.length > 0 && s.length <= 200; }

async function listKeys(kv, prefix) {
  const out = [];
  let cursor;
  for (let i = 0; i < 50; i++) {
    const res = await kv.list(cursor ? { prefix, cursor } : { prefix });
    const keys = res?.keys || res?.data || [];
    for (const k of keys) out.push(typeof k === 'string' ? k : k.name || k.key);
    if (res?.list_complete || res?.complete || !res?.cursor) break;
    cursor = res.cursor;
  }
  return out.filter(Boolean);
}

export async function onRequest(context) {
  const request = context?.request;
  const env = context?.env || {};
  if (request.method === 'OPTIONS') return preflight('GET, POST, OPTIONS');

  const kv = getKV(env, 'PROCESS_KV');

  if (request.method === 'GET') {
    if (!kv) return json({ ok: true, mo: [], style: [], _warn: 'PROCESS_KV not bound' });
    try {
      let moKeys = [], styleKeys = [];
      try { moKeys = await listKeys(kv, MO_PREFIX); } catch (e) { console.error('[deletions] list mo', e); }
      try { styleKeys = await listKeys(kv, STYLE_PREFIX); } catch (e) { console.error('[deletions] list style', e); }
      const mo = moKeys.map(k => k.slice(MO_PREFIX.length)).filter(Boolean);
      const style = styleKeys.map(k => k.slice(STYLE_PREFIX.length)).filter(Boolean);
      return json({ ok: true, mo, style }, 200, { 'Cache-Control': 'no-store' });
    } catch (err) {
      console.error('[deletions] GET error', err);
      return json({ ok: false, error: 'read_failed', message: 'KV 읽기 실패 · KV 读取失败' }, 500);
    }
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method Not Allowed' }, 405, { Allow: 'GET, POST, OPTIONS' });
  }

  let body;
  try { const raw = await request.text(); body = raw ? JSON.parse(raw) : {}; }
  catch { return json({ ok: false, error: 'invalid_json', message: '잘못된 요청 형식 · 请求格式错误' }, 400); }

  if (!kv) return json({ ok: false, error: 'kv_not_configured', message: 'PROCESS_KV 바인딩이 없습니다 · 未绑定 PROCESS_KV' }, 503);

  const type = body?.type;
  const id = body?.id;
  if (type !== 'mo' && type !== 'style') return json({ ok: false, error: 'invalid_type' }, 400);
  if (!validId(id)) return json({ ok: false, error: 'invalid_id' }, 400);
  try {
    const key = (type === 'mo' ? MO_PREFIX : STYLE_PREFIX) + id;
    await kv.put(key, '1');
    return json({ ok: true, type, id });
  } catch (err) {
    console.error('[deletions] POST error', err);
    return json({ ok: false, error: 'kv_write_failed', message: 'KV 저장 실패 · KV 保存失败', detail: err.message || String(err) }, 500);
  }
}
