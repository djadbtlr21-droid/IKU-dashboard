import { getAccessToken, zohoBase } from './_zoho.js';

export default async function handler(req, res) {
  try {
    const token = await getAccessToken();
    const maxRecords = req.query?.max_records || '200';

    // Build URL — max_records param (per_page causes Zoho error 1060)
    let url = `${zohoBase()}/report/All_MO?max_records=${maxRecords}`;

    const zres = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        Accept: 'application/json',
      },
    });

    const raw = await zres.text();
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = { raw }; }

    if (process.env.ZOHO_DEBUG === '1') {
      console.log('[mo-list] status:', zres.status, 'count:', body?.data?.length || 0);
    }

    if (!zres.ok) {
      if (zres.status === 400) {
        console.log('[mo-list] 400 — treating as empty:', raw.slice(0, 200));
        return res.status(200).json({ code: 3000, data: [], message: 'Empty result' });
      }
      console.error('[mo-list] upstream error', { status: zres.status, url, body });
      return res.status(zres.status).json({ error: 'Zoho API ' + zres.status, upstream: body });
    }

    return res.status(200).json(body);
  } catch (err) {
    console.error('[mo-list] error', err);
    return res.status(500).json({
      error: err.message || String(err),
      upstream: err.upstream || null,
      tokenUrl: err.tokenUrl || null,
    });
  }
}
