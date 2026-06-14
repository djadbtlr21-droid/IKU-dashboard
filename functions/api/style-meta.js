// ─────────────────────────────────────────────────────────────
// Style 미오더 메타데이터 store (EdgeOne Pages KV)
//
// KV binding: PROCESS_KV (재사용). 신규 키 (기존 process:* 구조 불변):
//   style_factory:{SKU}  → 오더 예정 공장명 (문자열)
//   style_note:{SKU}     → 스타일 비고 (문자열)
//   style_hidden         → 숨긴 SKU 배열 (JSON)
//
// GET  → { ok, factory:{[SKU]:val}, note:{[SKU]:val}, hidden:[SKU] }
// POST → 비밀번호 불필요 (자주 바뀌는 공개 설정값). actions:
//   { action:'factory', sku, value }
//   { action:'note',    sku, value }
//   { action:'hide',    sku }   ← 오더 전환(숨김)
//   { action:'unhide',  sku }
// ─────────────────────────────────────────────────────────────

import { json, preflight } from './_resp.js';
import { getKV } from './_kv.js';

const FACTORY_PREFIX = 'style_factory:';
const NOTE_PREFIX = 'style_note:';
const HIDDEN_KEY = 'style_hidden';
const MAX_VAL = 300;

function validSku(s) { return typeof s === 'string' && s.length > 0 && s.length <= 160; }

// EdgeOne / Cloudflare-style KV list — normalise the key-name array.
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

  // ── GET — read all style meta ──
  if (request.method === 'GET') {
    if (!kv) return json({ ok: true, factory: {}, note: {}, hidden: [], _warn: 'PROCESS_KV not bound' });
    try {
      const factory = {}, note = {};
      let hidden = [];
      let fKeys = [], nKeys = [];
      try { fKeys = await listKeys(kv, FACTORY_PREFIX); } catch (e) { console.error('[style-meta] list factory', e); }
      try { nKeys = await listKeys(kv, NOTE_PREFIX); } catch (e) { console.error('[style-meta] list note', e); }
      const all = [...fKeys, ...nKeys, HIDDEN_KEY];
      const vals = await Promise.all(all.map(async (k) => { try { return [k, await kv.get(k)]; } catch { return [k, null]; } }));
      for (const [k, raw] of vals) {
        if (raw == null) continue;
        if (k === HIDDEN_KEY) { try { const a = JSON.parse(raw); if (Array.isArray(a)) hidden = a; } catch { /* ignore */ } continue; }
        if (k.startsWith(FACTORY_PREFIX)) factory[k.slice(FACTORY_PREFIX.length)] = raw;
        else if (k.startsWith(NOTE_PREFIX)) note[k.slice(NOTE_PREFIX.length)] = raw;
      }
      return json({ ok: true, factory, note, hidden }, 200, { 'Cache-Control': 'no-store' });
    } catch (err) {
      console.error('[style-meta] GET error', err);
      return json({ ok: false, error: 'read_failed', message: 'KV 읽기 실패 · KV 读取失败' }, 500);
    }
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method Not Allowed' }, 405, { Allow: 'GET, POST, OPTIONS' });
  }

  // ── POST — public mutation (no password) ──
  let body;
  try { const raw = await request.text(); body = raw ? JSON.parse(raw) : {}; }
  catch { return json({ ok: false, error: 'invalid_json', message: '잘못된 요청 형식 · 请求格式错误' }, 400); }

  if (!kv) return json({ ok: false, error: 'kv_not_configured', message: 'PROCESS_KV 바인딩이 없습니다 · 未绑定 PROCESS_KV' }, 503);

  const action = body?.action;
  const sku = body?.sku;
  try {
    if (action === 'factory' || action === 'note') {
      if (!validSku(sku)) return json({ ok: false, error: 'invalid_sku' }, 400);
      let value = typeof body.value === 'string' ? body.value : '';
      if (value.length > MAX_VAL) value = value.slice(0, MAX_VAL);
      const key = (action === 'factory' ? FACTORY_PREFIX : NOTE_PREFIX) + sku;
      if (value) await kv.put(key, value); else await kv.delete(key);
      return json({ ok: true, action, sku, value });
    }
    if (action === 'hide' || action === 'unhide') {
      if (!validSku(sku)) return json({ ok: false, error: 'invalid_sku' }, 400);
      let hidden = [];
      try { const raw = await kv.get(HIDDEN_KEY); const a = raw ? JSON.parse(raw) : []; if (Array.isArray(a)) hidden = a; } catch { /* ignore */ }
      const set = new Set(hidden);
      if (action === 'hide') set.add(sku); else set.delete(sku);
      hidden = [...set].slice(0, 10000);
      await kv.put(HIDDEN_KEY, JSON.stringify(hidden));
      return json({ ok: true, action, sku, hidden });
    }
    return json({ ok: false, error: 'unknown_action' }, 400);
  } catch (err) {
    console.error('[style-meta] POST error', err);
    return json({ ok: false, error: 'kv_write_failed', message: 'KV 저장 실패 · KV 保存失败', detail: err.message || String(err) }, 500);
  }
}
