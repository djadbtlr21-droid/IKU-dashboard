// ─────────────────────────────────────────────────────────────
// Zoho 토큰 KV 캐시 강제 초기화 (일회성 디버그용)
//
// GET → KV "zoho:access_token" 키 삭제 → { success, message }
// 인증 없음. 토큰 회전 직후 캐시를 비울 때 사용. 나중에 삭제해도 무방.
// KV 바인딩은 _zoho.js 와 동일하게 PROCESS_KV 사용(없으면 ANNOTATIONS_KV fallback).
// ─────────────────────────────────────────────────────────────

import { json, preflight } from './_resp.js';
import { getKV } from './_kv.js';

const TOKEN_KEY = 'zoho:access_token';

export async function onRequest(context) {
  const request = context?.request;
  const env = context?.env || {};
  if (request.method === 'OPTIONS') return preflight('GET, OPTIONS');

  const kv = getKV(env, 'PROCESS_KV') || getKV(env, 'ANNOTATIONS_KV');
  if (!kv) {
    return json({ success: false, message: 'KV not bound (PROCESS_KV / ANNOTATIONS_KV)' }, 503);
  }

  try {
    await kv.delete(TOKEN_KEY);
    return json({ success: true, message: 'token cache cleared' }, 200, { 'Cache-Control': 'no-store' });
  } catch (err) {
    console.error('[clear-token-cache] error', err);
    return json({ success: false, message: err.message || String(err) }, 500);
  }
}
