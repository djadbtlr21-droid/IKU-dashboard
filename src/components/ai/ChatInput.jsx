import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'

export default function ChatInput({ onSend, disabled, setRobotState }) {
  const [value, setValue] = useState('')
  const typingTimer = useRef(null)
  const textareaRef = useRef(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [value])

  function handleChange(e) {
    setValue(e.target.value)
    if (e.target.value.trim()) {
      setRobotState('reading')
      clearTimeout(typingTimer.current)
      typingTimer.current = setTimeout(() => setRobotState('idle'), 2000)
    } else {
      clearTimeout(typingTimer.current)
      setRobotState('idle')
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSend() {
    const text = value.trim()
    if (!text || disabled) return
    setValue('')
    clearTimeout(typingTimer.current)
    onSend(text)
    // Let sendMessage handle state transition to 'analyzing'
  }

  const canSend = !disabled && value.trim().length > 0

  return (
    <div style={{
      padding: '10px 14px 14px',
      borderTop: '1px solid #E4DED2',
      background: '#FAFAF7',
      display: 'flex', gap: 8, alignItems: 'flex-end',
    }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="MO나 공장에 대해 물어보세요 / 询问MO或工厂"
        rows={1}
        style={{
          flex: 1, resize: 'none', border: '1px solid #E4DED2',
          borderRadius: 10, padding: '10px 12px', fontSize: 13,
          fontFamily: 'inherit', outline: 'none', background: disabled ? '#F5F2EE' : '#fff',
          color: '#1A1714', lineHeight: 1.5, minHeight: 42,
          transition: 'border-color .15s',
          overflowY: 'hidden',
        }}
        onFocus={e => { e.target.style.borderColor = '#C9A86E' }}
        onBlur={e => { e.target.style.borderColor = '#E4DED2' }}
      />
      <button
        onClick={handleSend}
        disabled={!canSend}
        style={{
          width: 42, height: 42, borderRadius: 10, border: 'none',
          background: canSend ? '#C9A86E' : '#E4DED2',
          color: canSend ? '#1A1714' : '#9A9080',
          cursor: canSend ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, transition: 'background .15s',
        }}
      >
        <Send size={16} strokeWidth={2} />
      </button>
    </div>
  )
}
