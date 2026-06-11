import { getAccessToken, trim } from './_zoho.js';
import { CORS_HEADERS } from './_resp.js';

const PLACEHOLDER_SVG = (text) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#FBF9F4"/>
  <rect x="140" y="120" width="120" height="100" rx="8" fill="none" stroke="#E4DED2" stroke-width="2"/>
  <circle cx="175" cy="155" r="12" fill="#E4DED2"/>
  <polyline points="140,220 180,170 210,195 250,150 300,220" fill="none" stroke="#E4DED2" stroke-width="2"/>
  <text x="200" y="285" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#9A7228">${text || 'No Image'}</text>
  <text x="200" y="305" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#C8C0B2">无图片</text>
</svg>`;

function placeholder(text, status = 200) {
  return new Response(PLACEHOLDER_SVG(text), {
    status,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=60',
      ...CORS_HEADERS,
    },
  });
}

function streamUpstream(zres) {
  const contentType = zres.headers.get('Content-Type') || 'image/jpeg';
  return new Response(zres.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      ...CORS_HEADERS,
    },
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...CORS_HEADERS, Allow: 'GET, OPTIONS' } });
  }
  try {
    const searchParams = new URL(request.url).searchParams;
    const report = searchParams.get('report');
    const recordId = searchParams.get('recordId');
    const field = searchParams.get('field');
    const index = searchParams.get('index');
    const filepath = searchParams.get('filepath');

    const token = await getAccessToken(env);
    const domain = (trim(env.ZOHO_API_DOMAIN) || 'https://www.zohoapis.com').replace(/\/+$/, '');
    const account = trim(env.ZOHO_ACCOUNT) || 'jeramoda';
    const app = trim(env.ZOHO_APP) || 'eom';

    // ── Path 1: direct filepath passthrough (preferred — client extracts from field value) ──
    // NOTE: Zoho file downloads live on creator.zoho.com, NOT www.zohoapis.com.
    const creatorHost = (trim(env.ZOHO_CREATOR_DOMAIN) || 'https://creator.zoho.com').replace(/\/+$/, '');
    if (filepath) {
      let url;
      if (/^https?:\/\//i.test(filepath)) {
        url = filepath;
      } else if (filepath.startsWith('/api/') || filepath.startsWith('/creator/')) {
        url = `${creatorHost}${filepath}`;
      } else if (filepath.startsWith('/')) {
        url = `${creatorHost}${filepath}`;
      } else {
        if (report && recordId && field) {
          url = `${creatorHost}/api/v2.1/${account}/${app}/report/${encodeURIComponent(report)}/${encodeURIComponent(recordId)}/${encodeURIComponent(field)}/download?filepath=${encodeURIComponent(filepath)}`;
        } else {
          url = `${creatorHost}/${filepath}`;
        }
      }

      const zres = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
      if (!zres.ok) {
        console.error('[zoho-image] filepath upstream', zres.status, url);
        return placeholder('No Image');
      }
      return streamUpstream(zres);
    }

    // ── Path 2: report/recordId/field/[index]/download ──
    if (!report || !recordId || !field) {
      return new Response(JSON.stringify({ error: 'Missing report, recordId, or field' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
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
    const zres = await fetch(imageUrl, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
    if (zres.ok) return streamUpstream(zres);
    console.error('[zoho-image] upstream', zres.status, imageUrl);

    // 404 retry: drop index if present
    if (zres.status === 404 && index !== undefined && index !== '' && index !== null) {
      const fallbackUrl = `${domain}/creator/v2.1/data/${account}/${app}/report/${encodeURIComponent(report)}/${encodeURIComponent(recordId)}/${encodeURIComponent(field)}/download`;
      console.log('[zoho-image] retry w/o index →', fallbackUrl);
      const retry = await fetch(fallbackUrl, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
      if (retry.ok) return streamUpstream(retry);
      console.error('[zoho-image] retry failed', retry.status);
    }

    return placeholder('No Image');
  } catch (err) {
    console.error('[zoho-image] FATAL', err);
    return placeholder('Error');
  }
}
