import { zohoFetch, zohoBase } from './_zoho.js';
import { json, preflight } from './_resp.js';

// ─────────────────────────────────────────────────────────────
// All_Styles list (Style / Sample 管理)
//
// GET /api/style-list?from_index=1&max_records=50
//   → Zoho Creator v2.1 report All_Styles, paginated.
//   Returns the upstream body verbatim ({ code, data:[...] }); the frontend
//   extracts only the fields it needs.
//
// Auth + token caching reuse _zoho.js (zohoFetch). Report name All_Styles is
// fixed (do not rename).
// ─────────────────────────────────────────────────────────────
export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return preflight('GET, OPTIONS');
  try {
    const sp = new URL(request.url).searchParams;
    // client-tunable pagination (defaults: from_index=1, max_records=50)
    const maxRecords = sp.get('max_records') || '50';
    const fromIndex = sp.get('from_index') || '1';

    const url = `${zohoBase(env)}/report/All_Styles?max_records=${encodeURIComponent(maxRecords)}&from_index=${encodeURIComponent(fromIndex)}`;

    const zres = await zohoFetch(env, url, { headers: { Accept: 'application/json' } });

    const raw = await zres.text();
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = { raw }; }

    if (env.ZOHO_DEBUG === '1') {
      console.log('[style-list] status:', zres.status, 'count:', body?.data?.length || 0);
      if (body?.data?.[0]) console.log('[style-list] record keys:', Object.keys(body.data[0]));
    }

    if (!zres.ok) {
      // Zoho returns 400 when from_index is past the end of the data set.
      if (zres.status === 400) {
        return json({ code: 3000, data: [], message: 'Empty result' });
      }
      console.error('[style-list] upstream error', { status: zres.status, url, body });
      return json({ error: 'Zoho API ' + zres.status, upstream: body }, zres.status);
    }

    return json(body);
  } catch (err) {
    console.error('[style-list] error', err);
    return json({
      error: err.message || String(err),
      upstream: err.upstream || null,
      tokenUrl: err.tokenUrl || null,
    }, 500);
  }
}
