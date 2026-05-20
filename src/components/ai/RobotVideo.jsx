import { useState, useEffect, useRef } from 'react'

const VIDEO_MAP = {
  idle:         '/robot/01_idle.mp4',
  idle_special: '/robot/02_idle_special.mp4',
  reading:      '/robot/03_reading.mp4',
  analyzing:    '/robot/04_analyzing.mp4',
  sending:      '/robot/05_sending.mp4',
  done:         '/robot/06_done.mp4',
  error:        '/robot/07_error.mp4',
}

export default function RobotVideo({ robotState, onStateChange }) {
  const [activeLayer, setActiveLayer] = useState(0)
  const [layers, setLayers] = useState([VIDEO_MAP.idle, VIDEO_MAP.idle])

  // Refs to avoid stale closures in effects
  const activeLayerRef = useRef(0)
  const pendingLayer = useRef(null)
  const isFirst = useRef(true)
  const returnTimerRef = useRef(null)

  // Crossfade: load new src on the hidden layer, activate when ready
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      return
    }
    const newSrc = VIDEO_MAP[robotState] || VIDEO_MAP.idle
    const nextLayer = activeLayerRef.current === 0 ? 1 : 0
    pendingLayer.current = nextLayer
    setLayers(prev => {
      const next = [...prev]
      next[nextLayer] = newSrc
      return next
    })
  }, [robotState])

  function activateLayer(idx) {
    activeLayerRef.current = idx
    setActiveLayer(idx)
  }

  // Auto-transitions: done→idle (2s), error→idle (3s)
  useEffect(() => {
    if (robotState === 'done') {
      const t = setTimeout(() => onStateChange('idle'), 2000)
      return () => clearTimeout(t)
    }
    if (robotState === 'error') {
      const t = setTimeout(() => onStateChange('idle'), 3000)
      return () => clearTimeout(t)
    }
  }, [robotState, onStateChange])

  // Idle special: 2~5분 랜덤 간격으로 5초간 전환
  useEffect(() => {
    if (robotState !== 'idle') return

    const delay = 120000 + Math.random() * 180000
    const mainTimer = setTimeout(() => {
      onStateChange('idle_special')
      returnTimerRef.current = setTimeout(() => {
        onStateChange(s => (s === 'idle_special' ? 'idle' : s))
      }, 5000)
    }, delay)

    return () => {
      clearTimeout(mainTimer)
      clearTimeout(returnTimerRef.current)
    }
  }, [robotState, onStateChange])

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      aspectRatio: '16/9',
      borderRadius: '8px 8px 0 0',
      overflow: 'hidden',
      background: '#1a1a1a',
      transform: 'translateZ(0)',
      willChange: 'transform',
      contain: 'layout style paint',
    }}>
      {[0, 1].map(idx => (
        <video
          key={idx}
          src={layers[idx]}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onLoadedData={e => {
            e.target.play().catch(err => console.warn('[RobotVideo] autoplay blocked:', err))
            if (idx === pendingLayer.current) {
              pendingLayer.current = null
              activateLayer(idx)
            }
          }}
          onError={e => {
            console.error('[RobotVideo] load error:', e.target.error, '| src:', layers[idx])
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: activeLayer === idx ? 1 : 0,
            transition: 'opacity 300ms ease-in-out',
          }}
        />
      ))}
    </div>
  )
}
