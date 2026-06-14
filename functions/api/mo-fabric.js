// ─────────────────────────────────────────────────────────────
// MO 원단명 사용자 오버라이드 store (EdgeOne Pages KV)
//
// KV binding: PROCESS_KV (재사용). 신규 키 (기존 process:* 구조 불변):
//   fabric:{MO_ID}  → 원단명/성분 사용자 입력값 (문자열)
//
// GET  → { ok, fabric:{ [MO_ID]: value } }
// POST → { id, value }  (비밀번호 불필요 — 편집모드 진입에서 이미 게이트됨)
// 표시 우선순위: KV 값 > Zoho 자동값(Material_Type)
// ─────────────────────────────────────────────────────────────

import { json, preflight } from './_resp.js';
import { getKV } from './_kv.js';

const PREFIX = 'fabric:';
const MAX_VAL = 200;

function validId(s) { return typeof s === 'string' && s.length > 0 && s.length <= 160; }

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
    if (!kv) return json({ ok: true, fabric: {}, _warn: 'PROCESS_KV not bound' });
    try {
      const fabric = {};
      let keys = [];
      try { keys = await listKeys(kv, PREFIX); } catch (e) { console.error('[mo-fabric] list', e); }
      const vals = await Promise.all(keys.map(async (k) => { try { return [k, await kv.get(k)]; } catch { return [k, null]; } }));
      for (const [k, raw] of vals) {
        if (raw == null) continue;
        fabric[k.slice(PREFIX.length)] = raw;
      }
      return json({ ok: true, fabric }, 200, { 'Cache-Control': 'no-store' });
    } catch (err) {
      console.error('[mo-fabric] GET error', err);
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

  const id = body?.id;
  if (!validId(id)) return json({ ok: false, error: 'invalid_id' }, 400);
  let value = typeof body.value === 'string' ? body.value : '';
  if (value.length > MAX_VAL) value = value.slice(0, MAX_VAL);
  try {
    if (value) await kv.put(PREFIX + id, value); else await kv.delete(PREFIX + id);
    return json({ ok: true, id, value });
  } catch (err) {
    console.error('[mo-fabric] POST error', err);
    return json({ ok: false, error: 'kv_write_failed', message: 'KV 저장 실패 · KV 保存失败', detail: err.message || String(err) }, 500);
  }
}
