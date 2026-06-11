// EdgeOne Pages port of /api/gemini-chat.js (additive — the Vercel original is
// left untouched). Streams Gemini SSE straight through to the client.
import { CORS_HEADERS } from './_resp.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...CORS_HEADERS, Allow: 'POST, OPTIONS' } });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  let parsed = {};
  try { parsed = await request.json(); } catch { parsed = {}; }
  const { messages = [], systemPrompt = '', dataContext = '' } = parsed || {};

  const model = 'gemini-3-flash-preview';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const contents = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content || '' }],
  }));

  const fullSystem = dataContext
    ? `${systemPrompt}\n\n[현재 페이지 데이터]\n${dataContext}`
    : systemPrompt;

  const body = {
    system_instruction: { parts: [{ text: fullSystem }] },
    contents,
    generationConfig: {
      thinkingConfig: { thinkingBudget: 0 },
      maxOutputTokens: 8000,
      temperature: 0.7,
    },
  };

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      return new Response(JSON.stringify({ error: err }), {
        status: upstream.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...CORS_HEADERS,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
}
