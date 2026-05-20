import ReactMarkdown from 'react-markdown'

const GOLD = '#C9A86E'
const CREAM = '#FAFAF7'
const BORDER = '#E4DED2'
const TEXT = '#1A1714'
const MUTED = '#5A5248'

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 12,
      alignItems: 'flex-end',
      gap: 8,
    }}>
      {!isUser && (
        <div style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
          background: `linear-gradient(135deg, ${GOLD} 0%, #A8854A 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 2,
        }}>A</div>
      )}
      <div style={{
        maxWidth: '82%',
        padding: isUser ? '9px 13px' : '10px 14px',
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        background: isUser ? GOLD : CREAM,
        color: TEXT,
        border: isUser ? 'none' : `1px solid ${BORDER}`,
        fontSize: isUser ? 13 : 14,
        lineHeight: 1.65,
        boxShadow: isUser ? 'none' : '0 1px 4px rgba(26,23,20,0.06)',
      }}>
        {isUser ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
        ) : (
          <div className="ai-md" style={{ color: TEXT }}>
            {message.content ? (
              <ReactMarkdown
                components={{
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: GOLD, textDecoration: 'underline', wordBreak: 'break-all' }}
                    >
                      {children}
                    </a>
                  ),
                  p: ({ children }) => <p style={{ margin: '0 0 6px' }}>{children}</p>,
                  ul: ({ children }) => <ul style={{ margin: '4px 0 6px', paddingLeft: 16 }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ margin: '4px 0 6px', paddingLeft: 16 }}>{children}</ol>,
                  li: ({ children }) => <li style={{ marginBottom: 3 }}>{children}</li>,
                  strong: ({ children }) => <strong style={{ fontWeight: 700, color: '#1A1714' }}>{children}</strong>,
                  h1: ({ children }) => <div style={{ fontWeight: 700, fontSize: 14, margin: '8px 0 4px', color: '#1A1714' }}>{children}</div>,
                  h2: ({ children }) => <div style={{ fontWeight: 700, fontSize: 13, margin: '6px 0 3px', color: '#1A1714' }}>{children}</div>,
                  h3: ({ children }) => <div style={{ fontWeight: 600, fontSize: 13, margin: '4px 0 2px', color: MUTED }}>{children}</div>,
                  code: ({ children }) => (
                    <code style={{ background: '#F0EDE8', padding: '1px 4px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace' }}>
                      {children}
                    </code>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote style={{ borderLeft: `3px solid ${GOLD}`, paddingLeft: 10, margin: '4px 0', color: MUTED }}>
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            ) : (
              <span style={{ color: MUTED, fontStyle: 'italic', fontSize: 12 }}>분석 중 · 分析中…</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
