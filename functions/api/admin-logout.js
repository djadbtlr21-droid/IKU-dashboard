import { buildLogoutCookie } from './_auth.js';
import { json, preflight, CORS_HEADERS } from './_resp.js';

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return preflight('POST, OPTIONS');
  if (request.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405, { Allow: 'POST' });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': buildLogoutCookie(),
      ...CORS_HEADERS,
    },
  });
}
