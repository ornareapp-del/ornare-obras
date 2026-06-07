import { useEffect, useState } from 'react'

export default function Splash({ onDone }) {
  const [fase, setFase] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setFase(1), 300)
    const t2 = setTimeout(() => setFase(2), 1200)
    const t3 = setTimeout(() => setFase(3), 2000)
    const t4 = setTimeout(() => onDone(), 2800)
    return () => [t1, t2, t3, t4].forEach(clearTimeout)
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#1a1814',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      transition: 'opacity 0.6s',
      opacity: fase === 3 ? 0 : 1,
      zIndex: 9999,
    }}>
      <div style={{
        transform: fase >= 1 ? 'translateY(0)' : 'translateY(20px)',
        opacity: fase >= 1 ? 1 : 0,
        transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1)',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 42, fontWeight: 600,
          letterSpacing: 10, color: '#f5f2ee',
          marginBottom: 6,
        }}>
          ORNARE
        </div>
        <div style={{
          fontSize: 10, letterSpacing: 5,
          color: '#b09a7a', marginBottom: 48,
          opacity: fase >= 2 ? 1 : 0,
          transition: 'opacity 0.5s 0.2s',
        }}>
          GESTÃO DE OBRAS
        </div>
        <div style={{
          width: 40, height: 1,
          background: '#b09a7a',
          margin: '0 auto',
          transform: fase >= 2 ? 'scaleX(1)' : 'scaleX(0)',
          transition: 'transform 0.6s 0.3s',
          transformOrigin: 'center',
        }} />
      </div>
    </div>
  )
}