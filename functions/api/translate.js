// EdgeOne Pages Function — 중국어 → 한국어 번역 (현 상황 비고 번역 기능).
// POST { text: "번역할 텍스트", targetLang: "ko" }  →  { ok: true, translation: "..." }
// 1순위: env.GEMINI_API_KEY 로 Gemini API 직접 호출 (gemini-chat.js 와 동일 키).
// 2순위: 키가 없으면 기존 JEMINI 프록시(api.jera-iku.top)로 폴백.
import { json, preflight } from './_resp.js'

const SYS_PROMPT = '다음 중국어 텍스트를 자연스러운 한국어로 번역해주세요. 번역 결과만 출력하고 다른 설명은 하지 마세요.'

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return preflight('POST, OPTIONS')
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  let parsed = {}
  try { parsed = await request.json() } catch { parsed = {} }
  const text = String(parsed?.text || '').trim()
  if (!text) return json({ ok: false, error: 'empty text' }, 400)

  const apiKey = env.GEMINI_API_KEY

  // ── 1순위: Gemini API 직접 호출 (gemini-chat.js 와 동일 모델) ──
  let lastErr = ''
  if (apiKey) {
    // gemini-chat.js 와 동일 모델. thinkingBudget:0 필수 (없으면 thinking 토큰 소모로 빈 응답).
    const models = ['gemini-3-flash-preview', 'gemini-2.5-flash']
    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
      const body = {
        system_instruction: { parts: [{ text: SYS_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4000, thinkingConfig: { thinkingBudget: 0 } },
      }
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (r.ok) {
          const data = await r.json()
          const out = (data?.candidates?.[0]?.content?.parts || []).map(p => p?.text || '').join('').trim()
          if (out) return json({ ok: true, translation: out, source: 'gemini:' + model })
          lastErr += ` ${model}:empty`
        } else {
          lastErr += ` ${model}:${r.status}:${(await r.text()).replace(/\s+/g, ' ').slice(0, 300)}`
        }
      } catch (e) { lastErr += ` ${model}:ex:${e.message}` }
    }
  } else {
    lastErr = 'no-key'
  }

  // ── 2순위: 기존 JEMINI 프록시 폴백 ──
  try {
    const r = await fetch('https://api.jera-iku.top/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt: SYS_PROMPT, prompt: text, messages: [{ role: 'user', content: text }] }),
    })
    if (r.ok) {
      const data = await r.json().catch(() => null)
      const out = String(
        data?.translation || data?.text || data?.result || data?.output ||
        data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      ).trim()
      if (out) return json({ ok: true, translation: out, source: 'proxy' })
      lastErr += ' | proxy:empty'
    } else {
      lastErr += ` | proxy:${r.status}`
    }
  } catch (e) { lastErr += ` | proxy:ex:${e.message}` }

  return json({ ok: false, error: 'translation failed', detail: lastErr }, 502)
}
