import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import RobotVideo from './RobotVideo'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import { useGeminiChat } from '../../hooks/useGeminiChat'

const CREAM = '#FAFAF7'
const BORDER = '#E4DED2'
const GOLD = '#C9A86E'
const TEXT = '#1A1714'
const MUTED = '#5A5248'

export default function AIPanel({ open, onClose, G }) {
  const [robotState, setRobotState] = useState('idle')
  const messagesEndRef = useRef(null)

  // Stable setter that accepts value or functional updater (for idle_special timer)
  const handleStateChange = (stateOrFn) => {
    if (typeof stateOrFn === 'function') {
      setRobotState(stateOrFn)
    } else {
      setRobotState(stateOrFn)
    }
  }

  const { messages, sendMessage, isStreaming } = useGeminiChat({ setRobotState })

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 49,
            background: 'rgba(0,0,0,0.25)',
          }}
          onClick={onClose}
        />
      )}

      {/* Slide-in panel */}
      <div style={{
        position: 'fixed', right: 0, top: 0,
        height: '100vh',
        width: 'clamp(396px, 24vw, 506px)',
        background: CREAM,
        borderLeft: `1px solid ${BORDER}`,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms ease-in-out',
        boxShadow: open ? '-8px 0 32px rgba(26,23,20,0.12)' : 'none',
      }}>

        {/* Top: robot video */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <RobotVideo robotState={robotState} onStateChange={handleStateChange} />

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 8, right: 8,
              background: 'rgba(0,0,0,0.55)', border: 'none',
              borderRadius: '50%', width: 30, height: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff', zIndex: 2,
              transition: 'background .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.75)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.55)' }}
          >
            <X size={14} strokeWidth={2.5} />
          </button>

          {/* State badge */}
          <div style={{
            position: 'absolute', bottom: 8, left: 8,
            background: 'rgba(0,0,0,0.55)', borderRadius: 999,
            padding: '3px 8px', fontSize: 10, color: '#fff',
            fontWeight: 600, letterSpacing: '.5px',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: robotState === 'idle' || robotState === 'idle_special'
                ? '#86EFAC'
                : robotState === 'error' ? '#FCA5A5'
                : GOLD,
              flexShrink: 0,
            }} />
            {robotState === 'idle' || robotState === 'idle_special' ? 'Ready' :
             robotState === 'reading' ? 'Reading…' :
             robotState === 'analyzing' ? 'Analyzing…' :
             robotState === 'sending' ? 'Sending…' :
             robotState === 'done' ? 'Done' : 'Error'}
          </div>
        </div>

        {/* Panel header */}
        <div style={{
          padding: '10px 16px 10px',
          borderBottom: `1px solid ${BORDER}`,
          background: CREAM,
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, whiteSpace: 'nowrap' }}>
            IKU AI 분석가 · Senior ERP Analyst
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 4px' }}>
          {messages.length === 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', gap: 12, padding: '32px 0',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}44)`,
                border: `1px solid ${GOLD}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>
                🤖
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 4 }}>
                  MO나 공장에 대해 물어보세요
                </div>
                <div style={{ fontSize: 11, color: MUTED }}>询问MO或工厂数据分析</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 280 }}>
                {[
                  '이번 달 지연 MO 분석해줘',
                  '공장별 생산 현황 요약',
                  '북미 애슬레저 시장 동향은?',
                ].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    disabled={isStreaming}
                    style={{
                      background: '#fff', border: `1px solid ${BORDER}`,
                      borderRadius: 8, padding: '8px 12px', fontSize: 12,
                      color: TEXT, cursor: 'pointer', textAlign: 'left',
                      transition: 'border-color .15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <ChatMessage key={msg.id || i} message={msg} />
          ))}
          <div ref={messagesEndRef} style={{ height: 8 }} />
        </div>

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          disabled={isStreaming}
          setRobotState={setRobotState}
        />
      </div>
    </>
  )
}
