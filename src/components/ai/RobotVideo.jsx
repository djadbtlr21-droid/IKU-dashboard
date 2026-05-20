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
  const videoRef = useRef(null)
  const returnTimerRef = useRef(null)

  // Play the new clip whenever state changes
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.load()
    video.play().catch(() => {})
  }, [robotState])

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

  // Idle special: every 30-60s show idle_special for 5s then back to idle
  useEffect(() => {
    if (robotState !== 'idle') return

    const delay = 30000 + Math.random() * 30000
    const mainTimer = setTimeout(() => {
      onStateChange('idle_special')
      returnTimerRef.current = setTimeout(() => {
        // functional update: only go back to idle if still idle_special
        onStateChange(s => (s === 'idle_special' ? 'idle' : s))
      }, 5000)
    }, delay)

    return () => {
      clearTimeout(mainTimer)
      clearTimeout(returnTimerRef.current)
    }
  }, [robotState, onStateChange])

  return (
    <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: '8px 8px 0 0', overflow: 'hidden', background: '#000' }}>
      <video
        ref={videoRef}
        src={VIDEO_MAP[robotState] || VIDEO_MAP.idle}
        autoPlay
        muted
        loop
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  )
}
