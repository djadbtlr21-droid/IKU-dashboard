// EdgeOne Pages Function — 중국어 → 한국어 번역 (현 상황 비고 번역 기능).
// POST { text: "번역할 텍스트", targetLang: "ko" }  →  { ok: true, translation: "..." }
//
// EdgeOne(텐센트) 엣지 노드는 Gemini API 가 지역 차단("User location is not supported")하므로
// Gemini 직접 호출은 사용 불가. 따라서 지원 리전(서울)에 있는 기존 JEMINI 프록시
// (api.jera-iku.top/api/translate) 를 사용한다. 키가 별도로 있으면 직접 호출도 시도.
import { json, preflight } from './_resp.js'

const SYS_PROMPT = `당신은 의류 제조업 및 의류 공장 전문 번역가입니다.
봉제, 재단, 원단, 샘플, 패턴, 공정, 단가, 발주 등 의류 업계 전문 용어에 능통합니다.
다음 중국어 텍스트를 의류 제조업 업계 용어를 기반으로 자연스러운 한국어로 번역해주세요.
번역 결과만 출력하고 다른 설명, 주석, 부연은 절대 하지 마세요:`

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return preflight('POST, OPTIONS')
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  let parsed = {}
  try { parsed = await request.json() } catch { parsed = {} }
  const text = String(parsed?.text || '').trim()
  const targetLang = String(parsed?.targetLang || 'ko')
  if (!text) return json({ ok: false, error: 'empty text' }, 400)

  let lastErr = ''

  // ── 1순위: JEMINI 프록시 전용 번역 엔드포인트 (서울 리전 → Gemini 지역 제한 회피) ──
  try {
    const r = await fetch('https://api.jera-iku.top/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sourceLang: 'zh', targetLang }),
    })
    if (r.ok) {
      const data = await r.json().catch(() => null)
      const out = String(data?.translation || data?.text || data?.result || '').trim()
      if (out) return json({ ok: true, translation: out, source: 'proxy-translate' })
      lastErr += ' proxy-translate:empty'
    } else { lastErr += ` proxy-translate:${r.status}` }
  } catch (e) { lastErr += ` proxy-translate:ex:${e.message}` }

  // ── 2순위: JEMINI 프록시 채팅 엔드포인트(SSE) 폴백 ──
  try {
    const r = await fetch('https://api.jera-iku.top/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt: SYS_PROMPT, messages: [{ role: 'user', content: text }] }),
    })
    if (r.ok) {
      const raw = await r.text()
      // SSE: 여러 "data: {json}" 줄에서 candidates[].content.parts[].text 누적
      let out = ''
      for (const line of raw.split('\n')) {
        const m = line.match(/^data:\s*(.+)$/)
        if (!m) continue
        try {
          const obj = JSON.parse(m[1])
          const parts = obj?.candidates?.[0]?.content?.parts || []
          out += parts.map(p => p?.text || '').join('')
        } catch { /* skip non-json data lines */ }
      }
      out = out.trim()
      if (out) return json({ ok: true, translation: out, source: 'proxy-chat' })
      lastErr += ' proxy-chat:empty'
    } else { lastErr += ` proxy-chat:${r.status}` }
  } catch (e) { lastErr += ` proxy-chat:ex:${e.message}` }

  // ── 3순위: GEMINI_API_KEY 직접 호출 (지원 리전에서만 동작) ──
  const apiKey = env?.GEMINI_API_KEY
    ?? globalThis.GEMINI_API_KEY
    ?? (typeof GEMINI_API_KEY !== 'undefined' ? GEMINI_API_KEY : null)
  if (apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
    const body = {
      contents: [{ parts: [{ text: `${SYS_PROMPT}\n\n${text}` }] }],  // SYS_PROMPT ends with ':', so this appends \n\n{text}
      generationConfig: { temperature: 0.3, maxOutputTokens: 1000 },
    }
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const rawBody = await r.text()
      if (r.ok) {
        let data = null
        try { data = JSON.parse(rawBody) } catch { lastErr += ' gemini:json-parse-fail' }
        const out = (data?.candidates?.[0]?.content?.parts || []).map(p => p?.text || '').join('').trim()
        if (out) return json({ ok: true, translation: out, source: 'gemini' })
        lastErr += ' gemini:empty'
      } else {
        console.error('[translate] Gemini API error body:', rawBody)
        lastErr += ` gemini:${r.status}`
      }
    } catch (e) { lastErr += ` gemini:ex:${e.message}` }
  }

  console.error('[translate] all routes failed:', lastErr, { apiKeyPresent: !!apiKey })
  return json({ ok: false, error: 'translation failed', detail: lastErr, apiKeyPresent: !!apiKey }, 502)
}
