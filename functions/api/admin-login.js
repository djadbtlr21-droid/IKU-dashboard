import { verifyAdminPassword, buildLoginCookie, readJsonBody } from './_auth.js';
import { json, preflight, CORS_HEADERS } from './_resp.js';

// In-memory rate limiter (per warm isolate — best-effort, same as Vercel ver).
const attempts = new Map();
const LIMIT = 5;
const WINDOW_MS = 60 * 1000;

function tooMany(ip) {
  if (!ip) return false;
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > LIMIT;
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return preflight('POST, OPTIONS');
  if (request.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405, { Allow: 'POST' });
  }

  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || request.headers.get('eo-connecting-ip')
    || '';
  if (tooMany(ip)) {
    return json({ error: 'Too many attempts. Try again in a minute.' }, 429);
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const password = body.data?.password;

  try {
    if (!verifyAdminPassword(env, password)) {
      return json({ ok: false }, 401);
    }
  } catch (err) {
    return json({ error: err.message }, err.status || 500);
  }

  const cookie = await buildLoginCookie(env);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Set-Cookie': cookie, ...CORS_HEADERS },
  });
}
