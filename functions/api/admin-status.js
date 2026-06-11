import { isAdminRequest } from './_auth.js';
import { json, preflight } from './_resp.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return preflight('GET, OPTIONS');
  if (request.method !== 'GET') {
    return json({ error: 'Method Not Allowed' }, 405, { Allow: 'GET' });
  }
  let isAdmin = false;
  try { isAdmin = await isAdminRequest(request, env); } catch { isAdmin = false; }
  return json({ isAdmin }, 200, { 'Cache-Control': 'no-store' });
}
