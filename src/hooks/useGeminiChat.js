import { useState, useCallback } from 'react'
import { buildSystemPrompt } from '../utils/geminiPersona'
import { useData } from '../contexts/DataContext'

export function useGeminiChat({ setRobotState }) {
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const { data } = useData()

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isStreaming) return

    const userMsg = { role: 'user', content: text, id: `u-${Date.now()}` }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setIsStreaming(true)
    setRobotState('analyzing')

    const assistantId = `a-${Date.now()}`
    setMessages(prev => [...prev, { role: 'assistant', content: '', id: assistantId }])

    const dataContext = JSON.stringify({
      currentPage: data.currentPage,
      moList: data.moList.slice(0, 50),
      kpi: data.kpi,
      factoryStats: data.factoryStats,
      pipelineStats: data.pipelineStats,
      filteredMonth: data.filteredMonth,
    })

    try {
      const res = await fetch('/api/gemini-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          systemPrompt: buildSystemPrompt(),
          dataContext,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`API ${res.status}: ${err}`)
      }

      setRobotState('sending')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const json = line.slice(6).trim()
          if (!json || json === '[DONE]') continue
          try {
            const parsed = JSON.parse(json)
            const chunk = parsed?.candidates?.[0]?.content?.parts?.[0]?.text
            if (chunk) {
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m)
              )
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }

      setRobotState('done')
    } catch (err) {
      console.error('[useGeminiChat]', err)
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: m.content || '오류가 발생했습니다. 다시 시도해 주세요. / 发生错误，请重试。' }
            : m
        )
      )
      setRobotState('error')
    } finally {
      setIsStreaming(false)
    }
  }, [messages, isStreaming, setRobotState, data])

  return { messages, sendMessage, isStreaming }
}
