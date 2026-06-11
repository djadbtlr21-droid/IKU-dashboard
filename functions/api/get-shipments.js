import { getAccessToken, zohoBase } from './_zoho.js';
import { json, preflight } from './_resp.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return preflight('GET, OPTIONS');
  try {
    const token = await getAccessToken(env);
    const maxRecords = new URL(request.url).searchParams.get('max_records') || '200';
    const url = `${zohoBase(env)}/report/All_Shipment?max_records=${maxRecords}`;

    const zres = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        Accept: 'application/json',
      },
    });

    const raw = await zres.text();
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = { raw }; }

    if (env.ZOHO_DEBUG === '1') {
      console.log('[get-shipments] status:', zres.status, 'count:', body?.data?.length || 0);
    }

    if (!zres.ok) {
      if (zres.status === 400) {
        console.log('[get-shipments] 400 — treating as empty:', raw.slice(0, 200));
        return json({ code: 3000, data: [], message: 'Empty result' });
      }
      console.error('[get-shipments] upstream error', { status: zres.status, url, body });
      return json({ error: 'Zoho API ' + zres.status, upstream: body }, zres.status);
    }

    return json(body);
  } catch (err) {
    console.error('[get-shipments] error', err);
    return json({
      error: err.message || String(err),
      upstream: err.upstream || null,
      tokenUrl: err.tokenUrl || null,
    }, 500);
  }
}
