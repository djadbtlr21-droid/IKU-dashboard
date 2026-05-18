import { getAccessToken, zohoBase } from './_zoho.js';

export default async function handler(req, res) {
  try {
    const id = req.query?.id;
    if (!id) return res.status(400).json({ error: 'Missing id param' });

    const token = await getAccessToken();
    const url = `${zohoBase()}/report/All_MO/${encodeURIComponent(id)}`;

    const zres = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        Accept: 'application/json',
      },
    });

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
      return res.status(zres.status).json({ error: 'Zoho API ' + zres.status, upstream: body });
    }

    return res.status(200).json(body);
  } catch (err) {
    console.error('[mo-detail] error', err);
    return res.status(500).json({
      error: err.message || String(err),
      upstream: err.upstream || null,
      tokenUrl: err.tokenUrl || null,
    });
  }
}
