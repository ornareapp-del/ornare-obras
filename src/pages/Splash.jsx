import { useEffect, useState } from 'react'

export default function Splash({ onDone }) {
  const [fase, setFase] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setFase(1), 300)
    const t2 = setTimeout(() => setFase(2), 1200)
    const t3 = setTimeout(() => setFase(3), 2800)
    const t4 = setTimeout(() => onDone(), 3400)
    return () => [t1,t2,t3,t4].forEach(clearTimeout)
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#1a1814',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      opacity: fase === 3 ? 0 : 1,
      transition: 'opacity 0.8s ease',
      zIndex: 9999,
    }}>
      <div style={{
        textAlign: 'center',
        transform: fase >= 1 ? 'translateY(0)' : 'translateY(30px)',
        opacity: fase >= 1 ? 1 : 0,
        transition: 'all 1s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <img
          src="/logo-ornare.png"
          alt="Ornare"
          style={{
            height: 80,
            objectFit: 'contain',
            display: 'block',
            margin: '0 auto 16px',
            filter: 'invert(1) brightness(2)',
          }}
        />
        <div style={{
          fontSize: 10, letterSpacing: 5, color: '#b09a7a',
          opacity: fase >= 2 ? 1 : 0,
          transition: 'opacity 0.6s 0.3s',
        }}>
          GESTÃO DE OBRAS
        </div>
        <div style={{
          width: 40, height: 1, background: '#b09a7a',
          margin: '16px auto 0',
          transform: fase >= 2 ? 'scaleX(1)' : 'scaleX(0)',
          transition: 'transform 0.7s 0.5s',
        }} />
      </div>
    </div>
  )
}