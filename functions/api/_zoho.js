// EdgeOne Pages Functions — Zoho OAuth + base URL helper.
// Ported from /api/_zoho.js. The OAuth flow is fetch-based so it transfers
// 1:1; the only change is reading config from `env` (EdgeOne binding) instead
// of process.env, and accepting that as an argument.

const VERSION = '2026-edgeone-r1';

// Module-scoped token cache — survives across requests on a warm isolate.
let cachedToken = null;
let cachedExp = 0;

// TEMP — set to `true` to bypass the in-memory token cache for one deploy
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

export function invalidateToken() {
  cachedToken = null;
  cachedExp = 0;
  console.log('[_zoho] token cache invalidated (force refresh on next call)');
}

export async function getAccessToken(env) {
  const now = Date.now();

  if (!DISABLE_TOKEN_CACHE && cachedToken && now < cachedExp - 5 * 60 * 1000) {
    return cachedToken;
  }

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

  cachedToken = body.access_token;
  cachedExp = now + 50 * 60 * 1000;
  console.log('[_zoho] OAuth success', {
    scope: body.scope,
    api_domain: body.api_domain,
    expires_in: body.expires_in,
    access_token: maskToken(body.access_token),
  });
  return cachedToken;
}

export function zohoBase(env) {
  const domain = (trim(env.ZOHO_API_DOMAIN) || 'https://www.zohoapis.com').replace(/\/+$/, '');
  const account = trim(env.ZOHO_ACCOUNT) || 'jeramoda';
  const app = trim(env.ZOHO_APP) || 'eom';
  return `${domain}/creator/v2.1/data/${account}/${app}`;
}

export { trim };
