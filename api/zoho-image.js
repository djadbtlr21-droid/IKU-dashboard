import { getAccessToken } from './_zoho.js';

const PLACEHOLDER_SVG = (text) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#2F3650"/>
  <rect x="140" y="120" width="120" height="100" rx="8" fill="none" stroke="#3A4268" stroke-width="2"/>
  <circle cx="175" cy="155" r="12" fill="#3A4268"/>
  <polyline points="140,220 180,170 210,195 250,150 300,220" fill="none" stroke="#3A4268" stroke-width="2"/>
  <text x="200" y="285" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#3A4268">${text || '이미지 없음'}</text>
  <text x="200" y="305" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#3A4268">无图片</text>
</svg>`;

export default async function handler(req, res) {
  try {
    const { report, recordId, field } = req.query || {};

    if (!report || !recordId || !field) {
      return res.status(400).json({ error: 'Missing report, recordId, or field' });
    }

    const token = await getAccessToken();
    const domain = (process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com').replace(/\/+$/, '');
    const account = process.env.ZOHO_ACCOUNT || 'jeramoda';
    const app = process.env.ZOHO_APP || 'eom';

    const imageUrl = `${domain}/creator/v2.1/data/${account}/${app}/report/${encodeURIComponent(report)}/${encodeURIComponent(recordId)}/${encodeURIComponent(field)}/download`;

    console.log('[zoho-image] fetching:', imageUrl);

    const zres = await fetch(imageUrl, {
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
      },
    });

    if (!zres.ok) {
      console.error('[zoho-image] upstream error', zres.status, imageUrl);
      // Return placeholder SVG instead of error
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.status(200).send(PLACEHOLDER_SVG(field));
    }

    const contentType = zres.headers.get('Content-Type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Stream response body
    if (zres.body) {
      const reader = zres.body.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const total = chunks.reduce((acc, c) => acc + c.length, 0);
      const buf = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) { buf.set(c, offset); offset += c.length; }
      return res.status(200).send(Buffer.from(buf));
    }

    // Fallback: arrayBuffer
    const buf = await zres.arrayBuffer();
    return res.status(200).send(Buffer.from(buf));
  } catch (err) {
    console.error('[zoho-image] error', err);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).send(PLACEHOLDER_SVG('Error'));
  }
}
