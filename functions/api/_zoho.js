// EdgeOne Pages Functions — Zoho OAuth + base URL helper.
// Ported from /api/_zoho.js. The OAuth flow is fetch-based so it transfers
// 1:1; the only change is reading config from `env` (EdgeOne binding) instead
// of process.env, and accepting that as an argument.
//
// Token caching (rate-limit protection):
//   Zoho limits access-token issuance to ~5 per 10 min PER refresh_token.
//   On EdgeOne each request can hit a cold isolate, so a module-scoped cache
//   alone is not enough — independent isolates would each refresh and quickly
//   trip "Access Denied". We therefore add a SHARED cache in KV (PROCESS_KV)
//   under the key "zoho:access_token", read before every refresh and written
//   after a successful one. KV access is wrapped in try/catch so any KV outage
//   gracefully degrades to the old per-call refresh behaviour.

const VERSION = '2026-edgeone-r2-kvcache';

// Module-scoped token cache — survives across requests on a warm isolate.
let cachedToken = null;
let cachedExp = 0;

// Shared KV cache key + lifetimes.
const KV_TOKEN_KEY = 'zoho:access_token';
const TOKEN_TTL_MS = 50 * 60 * 1000;       // store for 50 min (Zoho tokens last 60)
const TOKEN_SAFETY_MS = 5 * 60 * 1000;     // treat as expired 5 min early

// TEMP — set to `true` to bypass ALL token caches for one deploy
// (useful right after rotating a refresh_token).
const DISABLE_TOKEN_CACHE = false;

function trim(v) {
  return typeof v === 'string' ? v.trim().replace(/^["']|["']$/g, '') : v;
}

function maskToken(t) {
  if (!t || typeof t !== 'string') return '(none)';
  if (t.length <= 16) return `${t.slice(0, 4)}…${t.slice(-2)} (len=${t.length})`;
  return `${t.slice(0, 8)}…${t.slice(-6)} (len=${t.length})`;
}

function accountsDomain(env) {
  const explicit = trim(env.ZOHO_ACCOUNTS_DOMAIN);
  if (explicit) return explicit.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const api = (trim(env.ZOHO_API_DOMAIN) || 'https://www.zohoapis.com')
    .replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const m = api.match(/zohoapis\.(.+)$/i);
  const tld = m ? m[1] : 'com';
  return 'accounts.zoho.' + tld;
}

function getKV(env) {
  return env && env.PROCESS_KV ? env.PROCESS_KV : null;
}

// Read a still-valid token from KV. Returns the token string or null.
async function readKvToken(env) {
  const kv = getKV(env);
  if (!kv) return null;
  try {
    const raw = await kv.get(KV_TOKEN_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.token !== 'string' || typeof data.expiresAt !== 'number') return null;
    if (Date.now() >= data.expiresAt - TOKEN_SAFETY_MS) return null; // expired / about to
    return data.token;
  } catch (err) {
    console.warn('[_zoho] KV read failed — falling back to refresh', err?.message || err);
    return null;
  }
}

async function writeKvToken(env, token, expiresAt) {
  const kv = getKV(env);
  if (!kv) return;
  try {
    await kv.put(KV_TOKEN_KEY, JSON.stringify({ token, expiresAt }));
  } catch (err) {
    console.warn('[_zoho] KV write failed (token still usable)', err?.message || err);
  }
}

async function deleteKvToken(env) {
  const kv = getKV(env);
  if (!kv) return;
  try {
    await kv.delete(KV_TOKEN_KEY);
  } catch (err) {
    console.warn('[_zoho] KV delete failed', err?.message || err);
  }
}

// Clear every cache layer so the next getAccessToken() forces a fresh refresh.
// Async because it may need to remove the shared KV entry.
export async function invalidateToken(env) {
  cachedToken = null;
  cachedExp = 0;
  await deleteKvToken(env);
  console.log('[_zoho] token cache invalidated (in-memory + KV)');
}

// Perform the actual OAuth refresh_token → access_token exchange.
async function refreshAccessToken(env) {
  const now = Date.now();
  const ZOHO_CLIENT_ID = trim(env.ZOHO_CLIENT_ID);
  const ZOHO_CLIENT_SECRET = trim(env.ZOHO_CLIENT_SECRET);
  const ZOHO_REFRESH_TOKEN = trim(env.ZOHO_REFRESH_TOKEN);

  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN) {
    const err = new Error('Missing Zoho OAuth env vars');
    err.status = 500;
    err.upstream = {
      ZOHO_CLIENT_ID: !!ZOHO_CLIENT_ID,
      ZOHO_CLIENT_SECRET: !!ZOHO_CLIENT_SECRET,
      ZOHO_REFRESH_TOKEN: !!ZOHO_REFRESH_TOKEN,
    };
    throw err;
  }

  const params = new URLSearchParams({
    refresh_token: ZOHO_REFRESH_TOKEN,
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });

  const host = accountsDomain(env);
  const tokenUrl = `https://${host}/oauth/v2/token`;

  console.log('[_zoho] OAuth request', {
    VERSION,
    tokenUrl,
    grant_type: 'refresh_token',
    cacheDisabled: DISABLE_TOKEN_CACHE,
    apiDomain: trim(env.ZOHO_API_DOMAIN) || '(default)',
    accountsDomainExplicit: trim(env.ZOHO_ACCOUNTS_DOMAIN) || '(derived)',
    refresh_token: maskToken(ZOHO_REFRESH_TOKEN),
    client_id_len: ZOHO_CLIENT_ID.length,
    client_secret_len: ZOHO_CLIENT_SECRET.length,
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: params.toString(),
  });

  const rawText = await res.text();
  let body = null;
  try { body = rawText ? JSON.parse(rawText) : null; } catch { body = { raw: rawText }; }

  console.log('[_zoho] OAuth response', { httpStatus: res.status, body });

  if (!res.ok || !body || body.error || !body.access_token) {
    const err = new Error('Zoho token refresh failed: ' + (body?.error || 'HTTP ' + res.status));
    err.status = res.status;
    err.upstream = body;
    err.tokenUrl = tokenUrl;
    err.hint = body?.error === 'invalid_code'
      ? 'invalid_code with grant_type=refresh_token typically means the refresh_token is revoked, wrong region, or contains hidden whitespace. Re-generate the refresh_token in Zoho Developer Console (matching the ZOHO_API_DOMAIN region) and re-paste WITHOUT trailing newline/spaces.'
      : undefined;
    throw err;
  }

  const expiresAt = now + TOKEN_TTL_MS;
  cachedToken = body.access_token;
  cachedExp = expiresAt;
  if (!DISABLE_TOKEN_CACHE) {
    await writeKvToken(env, body.access_token, expiresAt);
  }

  console.log('[_zoho] OAuth success', {
    scope: body.scope,
    api_domain: body.api_domain,
    expires_in: body.expires_in,
    access_token: maskToken(body.access_token),
  });
  return cachedToken;
}

// Resolve a usable access token, preferring caches (in-memory → KV) and only
// refreshing when nothing valid is available. Pass { force:true } to bypass the
// caches entirely (used by the 401 retry path).
export async function getAccessToken(env, opts = {}) {
  const force = !!opts.force;
  const useCache = !DISABLE_TOKEN_CACHE && !force;
  const now = Date.now();

  // 1) in-memory (warm isolate) — fastest
  if (useCache && cachedToken && now < cachedExp - TOKEN_SAFETY_MS) {
    return cachedToken;
  }

  // 2) shared KV cache — avoids refreshes across cold isolates
  if (useCache) {
    const kvToken = await readKvToken(env);
    if (kvToken) {
      cachedToken = kvToken;
      // We don't know the exact KV expiry here; trust it for a conservative
      // window and let the 401 retry path recover if it's actually stale.
      cachedExp = now + TOKEN_TTL_MS - TOKEN_SAFETY_MS;
      console.log('[_zoho] using KV-cached access token', maskToken(kvToken));
      return kvToken;
    }
  }

  // 3) refresh (and repopulate caches)
  return refreshAccessToken(env);
}

// Authenticated Zoho fetch with one automatic 401 recovery: on 401 the cache
// is invalidated and a single forced refresh + retry is attempted. Returns the
// raw Response so callers can stream or parse as they like. Pass Accept (etc.)
// via init.headers; Authorization is added/overridden here.
export async function zohoFetch(env, url, init = {}) {
  const doFetch = (token) => fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Zoho-oauthtoken ${token}` },
  });

  let token = await getAccessToken(env);
  let res = await doFetch(token);

  if (res.status === 401) {
    console.log('[_zoho] 401 from Zoho — invalidating token and retrying once');
    await invalidateToken(env);
    token = await getAccessToken(env, { force: true });
    res = await doFetch(token);
  }

  return res;
}

export function zohoBase(env) {
  const domain = (trim(env.ZOHO_API_DOMAIN) || 'https://www.zohoapis.com').replace(/\/+$/, '');
  const account = trim(env.ZOHO_ACCOUNT) || 'jeramoda';
  const app = trim(env.ZOHO_APP) || 'eom';
  return `${domain}/creator/v2.1/data/${account}/${app}`;
}

export { trim };
