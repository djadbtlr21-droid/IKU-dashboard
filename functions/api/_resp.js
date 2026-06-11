// Shared Response helpers for EdgeOne Pages Functions.
// EdgeOne functions return a Web `Response` object instead of mutating `res`.
// These helpers keep the same CORS behaviour the Vercel deploy applied via
// vercel.json (Access-Control-Allow-Origin: *).

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  })
}

// Standard CORS pre-flight handler.
export function preflight(allow = 'GET, OPTIONS') {
  return new Response(null, {
    status: 204,
    headers: { ...CORS_HEADERS, Allow: allow },
  })
}

export { CORS_HEADERS }
