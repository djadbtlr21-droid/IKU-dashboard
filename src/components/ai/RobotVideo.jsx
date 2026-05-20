import { useEffect, useRef } from 'react'

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
  const returnTimerRef = useRef(null)
  const videoSrc = VIDEO_MAP[robotState] || VIDEO_MAP.idle

  // Warm the idle clip in browser cache on first mount
  useEffect(() => {
    const v = document.createElement('video')
    v.src = VIDEO_MAP.idle
    v.preload = 'auto'
  }, [])

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

    const delay = 120000 + Math.random() * 180000  // 2~5분
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
      width: '100%',
      aspectRatio: '16/9',
      borderRadius: '8px 8px 0 0',
      overflow: 'hidden',
      background: '#000',
      transform: 'translateZ(0)',
      willChange: 'transform',
      contain: 'layout style paint',
    }}>
      <video
        key={robotState}
        src={videoSrc}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        onLoadedData={e => {
          e.target.play().catch(err => console.warn('[RobotVideo] autoplay blocked:', err))
        }}
        onError={e => {
          console.error('[RobotVideo] load error:', e.target.error, '| src:', videoSrc)
        }}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  )
}
