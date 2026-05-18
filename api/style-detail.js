import { getAccessToken, zohoBase } from './_zoho.js';

export default async function handler(req, res) {
  try {
    const sku = req.query?.sku;
    if (!sku) return res.status(400).json({ error: 'Missing sku param' });

    const token = await getAccessToken();

    // Search by SKU using criteria filter
    const criteria = `(Style_SKU:equals:${sku})`;
    const url = `${zohoBase()}/report/All_Styles?criteria=${encodeURIComponent(criteria)}&max_records=1`;

    const zres = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        Accept: 'application/json',
      },
    });

    const raw = await zres.text();
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = { raw }; }

    // DIAGNOSTIC: log image field structure
    console.log('[style-detail] status:', zres.status, 'sku:', sku);
    if (body?.data?.length) {
      const rec = body.data[0];
      console.log('[style-detail] record keys:', Object.keys(rec));
      const imageFields = Object.entries(rec).filter(([k, v]) =>
        typeof v === 'string' && (k.toLowerCase().includes('image') || k.toLowerCase().includes('photo') || k.toLowerCase().includes('pic'))
      );
      console.log('[style-detail] image fields:', imageFields.map(([k, v]) => `${k}: ${String(v).slice(0, 60)}`));
      console.log('[style-detail] full record:', JSON.stringify(rec).slice(0, 1500));
    }

    if (!zres.ok) {
      if (zres.status === 400) {
        return res.status(200).json({ code: 3000, data: [], message: 'No style found' });
      }
      console.error('[style-detail] upstream error', { status: zres.status, body });
      return res.status(zres.status).json({ error: 'Zoho API ' + zres.status, upstream: body });
    }

    return res.status(200).json(body);
  } catch (err) {
    console.error('[style-detail] error', err);
    return res.status(500).json({
      error: err.message || String(err),
      upstream: err.upstream || null,
      tokenUrl: err.tokenUrl || null,
    });
  }
}
