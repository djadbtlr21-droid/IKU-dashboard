// Build / version stamp — bump to force Vercel to re-bundle the function
// when the in-memory cachedToken in a warm instance might be stale.
const VERSION = '2026-05-19-r3-trim-and-log';

let cachedToken = null;
let cachedExp = 0;
let lastMeta = null;

// TEMP — set to `true` to bypass the in-memory token cache for one deploy.
// Useful when a refresh_token was just rotated and warm instances may
// still be holding an access_token minted from the old refresh_token.
// Flip back to `false` after one good production call.
const DISABLE_TOKEN_CACHE = true;

function trim(v) {
  return typeof v === 'string' ? v.trim().replace(/^["']|["']$/g, '') : v;
}

function maskToken(t) {
  if (!t || typeof t !== 'string') return '(none)';
  if (t.length <= 16) return `${t.slice(0, 4)}…${t.slice(-2)} (len=${t.length})`;
  return `${t.slice(0, 8)}…${t.slice(-6)} (len=${t.length})`;
}

function accountsDomain() {
  const explicit = trim(process.env.ZOHO_ACCOUNTS_DOMAIN);
  if (explicit) return explicit.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const api = (trim(process.env.ZOHO_API_DOMAIN) || 'https://www.zohoapis.com')
    .replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const m = api.match(/zohoapis\.(.+)$/i);
  const tld = m ? m[1] : 'com';
  return 'accounts.zoho.' + tld;
}

export async function getAccessToken() {
  const now = Date.now();

  // In-memory cache (disabled while DISABLE_TOKEN_CACHE is true)
  if (!DISABLE_TOKEN_CACHE && cachedToken && now < cachedExp - 5 * 60 * 1000) {
    return cachedToken;
  }

  const ZOHO_CLIENT_ID = trim(process.env.ZOHO_CLIENT_ID);
  const ZOHO_CLIENT_SECRET = trim(process.env.ZOHO_CLIENT_SECRET);
  const ZOHO_REFRESH_TOKEN = trim(process.env.ZOHO_REFRESH_TOKEN);

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

  const host = accountsDomain();
  const tokenUrl = `https://${host}/oauth/v2/token`;

  // Pre-flight diagnostic — surfaces in Vercel function logs so the user can
  // compare what the function actually sees against the values in the Vercel UI.
  console.log('[_zoho] OAuth request', {
    VERSION,
    tokenUrl,
    grant_type: 'refresh_token',
    cacheDisabled: DISABLE_TOKEN_CACHE,
    apiDomain: trim(process.env.ZOHO_API_DOMAIN) || '(default)',
    accountsDomainExplicit: trim(process.env.ZOHO_ACCOUNTS_DOMAIN) || '(derived)',
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
  lastMeta = {
    tokenUrl,
    scope: body.scope || null,
    api_domain: body.api_domain || null,
    refreshed_at: new Date(now).toISOString(),
  };
  console.log('[_zoho] OAuth success', {
    scope: body.scope,
    api_domain: body.api_domain,
    expires_in: body.expires_in,
    access_token: maskToken(body.access_token),
  });
  return cachedToken;
}

export function zohoBase() {
  const domain = (trim(process.env.ZOHO_API_DOMAIN) || 'https://www.zohoapis.com').replace(/\/+$/, '');
  const account = trim(process.env.ZOHO_ACCOUNT) || 'jeramoda';
  const app = trim(process.env.ZOHO_APP) || 'eom';
  return `${domain}/creator/v2.1/data/${account}/${app}`;
}
