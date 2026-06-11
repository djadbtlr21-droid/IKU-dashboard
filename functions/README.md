# EdgeOne Pages Functions

EdgeOne-compatible port of the `/api` serverless functions. Routes map 1:1 by
file path, so the frontend keeps calling the same `/api/*` URLs:

| URL                       | File                                |
| ------------------------- | ----------------------------------- |
| `/api/mo-list`            | `functions/api/mo-list.js`          |
| `/api/mo-detail`          | `functions/api/mo-detail.js`        |
| `/api/style-detail`       | `functions/api/style-detail.js`     |
| `/api/get-shipments`      | `functions/api/get-shipments.js`    |
| `/api/get-production-logs`| `functions/api/get-production-logs.js` |
| `/api/packs-list`         | `functions/api/packs-list.js`       |
| `/api/zoho-image`         | `functions/api/zoho-image.js`       |
| `/api/admin-login`        | `functions/api/admin-login.js`      |
| `/api/admin-logout`       | `functions/api/admin-logout.js`     |
| `/api/admin-status`       | `functions/api/admin-status.js`     |
| `/api/annotations`        | `functions/api/annotations.js`      |
| `/api/gemini-chat`        | `functions/api/gemini-chat.js`      |
| `/api/process`            | `functions/api/process.js` (공정 확인) |

Files prefixed with `_` (`_zoho.js`, `_auth.js`, `_resp.js`) are shared modules,
not routes.

> The original `/api` folder is left untouched so the Vercel deployment keeps
> working in parallel.

## EdgeOne console setup

**Environment variables** (Pages → Settings → Environment variables):

```
ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN
ZOHO_API_DOMAIN   (default https://www.zohoapis.com)
ZOHO_ACCOUNT      (default jeramoda)
ZOHO_APP          (default eom)
ADMIN_PASSWORD            # annotation admin login
ADMIN_SESSION_SECRET      # 32+ chars, signs admin session cookie
GEMINI_API_KEY            # AI panel
PROCESS_PASSWORD          # 공정 확인 edit password (default: jera8888)
```

**KV namespace bindings** (Pages → KV → Bind):

- `PROCESS_KV` — required for the 공정 확인 tab (`/api/process`).
- `ANNOTATIONS_KV` — optional; if omitted, `/api/annotations` falls back to
  `PROCESS_KV`. (On Vercel, annotations use Vercel Blob; EdgeOne has no Blob, so
  the same single-document model is stored under one KV key.)

**SPA fallback**: configure the EdgeOne Pages rewrite so non-`/api` paths serve
`/index.html` (equivalent to the `vercel.json` rewrite used on Vercel).

## Differences vs the Vercel `/api` runtime

- Handlers export `onRequest({ request, env })` and return a Web `Response`.
- Config is read from `env.*` instead of `process.env.*`.
- `_auth.js` uses the Web Crypto API (`crypto.subtle`) for HMAC instead of
  Node's `crypto`. Sessions are signed per-platform and are not cross-portable.
