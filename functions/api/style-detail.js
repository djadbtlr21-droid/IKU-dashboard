import { zohoFetch, zohoBase } from './_zoho.js';
import { json, preflight } from './_resp.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return preflight('GET, OPTIONS');
  try {
    const searchParams = new URL(request.url).searchParams;
    const sku = searchParams.get('sku');
    const id = searchParams.get('id');
    if (!sku && !id) return json({ error: 'Missing sku or id param' }, 400);

    // ?id= → direct record fetch (fast path)
    let url;
    if (id) {
      url = `${zohoBase(env)}/report/All_Styles/${encodeURIComponent(id)}`;
    } else {
      // ?sku= → criteria filter
      const criteria = `(Style_SKU:equals:${sku})`;
      url = `${zohoBase(env)}/report/All_Styles?criteria=${encodeURIComponent(criteria)}&max_records=1`;
    }

    const zres = await zohoFetch(env, url, { headers: { Accept: 'application/json' } });

    const raw = await zres.text();
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = { raw }; }

    // DIAGNOSTIC: log image-field structure on first call (helps map field names)
    console.log('[style-detail] status:', zres.status, id ? 'id:' + id : 'sku:' + sku);
    if (body?.data) {
      const rec = Array.isArray(body.data) ? body.data[0] : body.data;
      if (rec) {
        console.log('[style-detail] record keys:', Object.keys(rec));
        const imageFields = Object.entries(rec).filter(([k]) => {
          const lower = k.toLowerCase();
          return (lower.includes('image') || lower.includes('photo') || lower.includes('pic') || lower.includes('flat'));
        });
        console.log('[style-detail] image-like fields:',
          imageFields.map(([k, v]) => `${k}: ${typeof v === 'string' ? v.slice(0, 80) : JSON.stringify(v).slice(0, 80)}`));
      }
    }

    if (!zres.ok) {
      if (zres.status === 400 || zres.status === 404) {
        return json({ code: 3000, data: [], message: 'No style found' });
      }
      console.error('[style-detail] upstream error', { status: zres.status, body });
      return json({ error: 'Zoho API ' + zres.status, upstream: body }, zres.status);
    }

    return json(body);
  } catch (err) {
    console.error('[style-detail] error', err);
    return json({
      error: err.message || String(err),
      upstream: err.upstream || null,
      tokenUrl: err.tokenUrl || null,
    }, 500);
  }
}
