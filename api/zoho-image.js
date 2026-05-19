import { getAccessToken } from './_zoho.js';

const PLACEHOLDER_SVG = (text) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#FBF9F4"/>
  <rect x="140" y="120" width="120" height="100" rx="8" fill="none" stroke="#E4DED2" stroke-width="2"/>
  <circle cx="175" cy="155" r="12" fill="#E4DED2"/>
  <polyline points="140,220 180,170 210,195 250,150 300,220" fill="none" stroke="#E4DED2" stroke-width="2"/>
  <text x="200" y="285" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#9A7228">${text || 'No Image'}</text>
  <text x="200" y="305" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#C8C0B2">无图片</text>
</svg>`;

function placeholder(res, text, status = 200) {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=60');
  return res.status(status).send(PLACEHOLDER_SVG(text));
}

async function streamUpstream(zres, res) {
  const contentType = zres.headers.get('Content-Type') || 'image/jpeg';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=3600');

  if (zres.body && typeof zres.body.getReader === 'function') {
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
  const buf = await zres.arrayBuffer();
  return res.status(200).send(Buffer.from(buf));
}

export default async function handler(req, res) {
  try {
    const { report, recordId, field, index, filepath } = req.query || {};
    const token = await getAccessToken();
    const domain = (process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com').replace(/\/+$/, '');
    const account = process.env.ZOHO_ACCOUNT || 'jeramoda';
    const app = process.env.ZOHO_APP || 'eom';

    // ── Path 1: direct filepath passthrough (preferred when client has Zoho's raw URL) ──
    if (filepath) {
      let url;
      if (/^https?:\/\//i.test(filepath)) {
        url = filepath;
      } else if (filepath.startsWith('/')) {
        url = `${domain}${filepath}`;
      } else {
        url = `${domain}/${filepath}`;
      }
      console.log('[zoho-image] filepath →', url);
      const zres = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
      if (!zres.ok) {
        console.error('[zoho-image] filepath upstream', zres.status, url);
        return placeholder(res, 'No Image');
      }
      return streamUpstream(zres, res);
    }

    // ── Path 2: report/recordId/field/[index]/download ──
    if (!report || !recordId || !field) {
      return res.status(400).json({ error: 'Missing report, recordId, or field' });
    }

    const segments = [
      'creator', 'v2.1', 'data', account, app,
      'report', encodeURIComponent(report), encodeURIComponent(recordId), encodeURIComponent(field),
    ];
    if (index !== undefined && index !== '' && index !== null) {
      segments.push(encodeURIComponent(index));
    }
    segments.push('download');
    const imageUrl = `${domain}/${segments.join('/')}`;
    console.log('[zoho-image] fetching →', imageUrl);

    const zres = await fetch(imageUrl, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });

    if (zres.ok) return streamUpstream(zres, res);

    console.error('[zoho-image] upstream', zres.status, imageUrl);

    // 404 retry: drop index if present
    if (zres.status === 404 && index !== undefined && index !== '' && index !== null) {
      const fallbackUrl = `${domain}/creator/v2.1/data/${account}/${app}/report/${encodeURIComponent(report)}/${encodeURIComponent(recordId)}/${encodeURIComponent(field)}/download`;
      console.log('[zoho-image] retry w/o index →', fallbackUrl);
      const retry = await fetch(fallbackUrl, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
      if (retry.ok) return streamUpstream(retry, res);
      console.error('[zoho-image] retry failed', retry.status);
    }

    return placeholder(res, 'No Image');
  } catch (err) {
    console.error('[zoho-image] FATAL', err);
    return placeholder(res, 'Error');
  }
}
