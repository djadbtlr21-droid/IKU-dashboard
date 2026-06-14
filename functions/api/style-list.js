import { zohoFetch, zohoBase } from './_zoho.js';
import { json, preflight } from './_resp.js';

// ─────────────────────────────────────────────────────────────
// All_Styles list (Style / Sample 管理)
//
// GET /api/style-list?max_records=50&cursor=<record_cursor>
//   → Zoho Creator v2.1 report All_Styles.
//   Returns the upstream body ({ code, data:[...] }) plus record_cursor for
//   pagination; the frontend extracts only the fields it needs.
//
// NOTE: Zoho Creator v2.1 does NOT accept a `from_index` query param (it returns
// error 1060 with HTTP 401). Pagination is cursor-based: the response carries a
// `record_cursor` header when more rows exist; send it back as a request header
// to fetch the next page. mo-list.js works because it only sends max_records.
//
// Auth + token caching reuse _zoho.js (zohoFetch). Report name All_Styles is
// fixed (do not rename).
// ─────────────────────────────────────────────────────────────
export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return preflight('GET, OPTIONS');
  try {
    const sp = new URL(request.url).searchParams;
    const maxRecords = sp.get('max_records') || '50';
    const cursor = sp.get('cursor') || '';

    // mo-list.js parity: ONLY max_records in the query (no from_index → no 1060).
    const url = `${zohoBase(env)}/report/All_Styles?max_records=${encodeURIComponent(maxRecords)}`;

    const headers = { Accept: 'application/json' };
    if (cursor) headers.record_cursor = cursor;   // v2.1 cursor pagination

    const zres = await zohoFetch(env, url, { headers });

    const raw = await zres.text();
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = { raw }; }

    if (env.ZOHO_DEBUG === '1') {
      console.log('[style-list] status:', zres.status, 'count:', body?.data?.length || 0);
      if (body?.data?.[0]) console.log('[style-list] record keys:', Object.keys(body.data[0]));
    }

    if (!zres.ok) {
      // Zoho returns 400 / 3100 when the report has no (more) matching rows.
      if (zres.status === 400) {
        return json({ code: 3000, data: [], message: 'Empty result' });
      }
      console.error('[style-list] upstream error', { status: zres.status, url, body });
      return json({ error: 'Zoho API ' + zres.status, upstream: body }, zres.status);
    }

    // Surface the pagination cursor (present only when more rows remain).
    const nextCursor = zres.headers.get('record_cursor') || null;
    return json({ ...(body || {}), record_cursor: nextCursor });
  } catch (err) {
    console.error('[style-list] error', err);
    return json({
      error: err.message || String(err),
      upstream: err.upstream || null,
      tokenUrl: err.tokenUrl || null,
    }, 500);
  }
}
