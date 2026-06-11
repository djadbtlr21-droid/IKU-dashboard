import { zohoFetch, zohoBase } from './_zoho.js';
import { json, preflight } from './_resp.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return preflight('GET, OPTIONS');
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return json({ error: 'Missing id param' }, 400);

    const url = `${zohoBase(env)}/report/All_MO/${encodeURIComponent(id)}`;

    const zres = await zohoFetch(env, url, { headers: { Accept: 'application/json' } });

    const raw = await zres.text();
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = { raw }; }

    // DIAGNOSTIC: log full structure to identify all fields and subforms
    console.log('[mo-detail] status:', zres.status, 'id:', id);
    if (body?.data) {
      const rec = Array.isArray(body.data) ? body.data[0] : body.data;
      console.log('[mo-detail] record keys:', Object.keys(rec || {}));
      console.log('[mo-detail] full record:', JSON.stringify(rec).slice(0, 2000));
      const subforms = Object.entries(rec || {}).filter(([, v]) => Array.isArray(v));
      console.log('[mo-detail] subforms found:', subforms.map(([k, v]) => `${k}(${v.length})`));
    }

    if (!zres.ok) {
      console.error('[mo-detail] upstream error', { status: zres.status, url, body });
      return json({ error: 'Zoho API ' + zres.status, upstream: body }, zres.status);
    }

    return json(body);
  } catch (err) {
    console.error('[mo-detail] error', err);
    return json({
      error: err.message || String(err),
      upstream: err.upstream || null,
      tokenUrl: err.tokenUrl || null,
    }, 500);
  }
}
