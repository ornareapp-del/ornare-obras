import { useEffect, useState } from 'react'

export default function Splash({ onDone }) {
  const [fase, setFase] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setFase(1), 200)
    const t2 = setTimeout(() => setFase(2), 900)
    const t3 = setTimeout(() => setFase(3), 1800)
    const t4 = setTimeout(() => onDone(), 2400)
    return () => [t1,t2,t3,t4].forEach(clearTimeout)
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#1a1814',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      opacity: fase === 3 ? 0 : 1,
      transition: 'opacity 0.5s ease',
      zIndex: 9999,
    }}>
      <div style={{
        textAlign: 'center',
        transform: fase >= 1 ? 'translateY(0)' : 'translateY(24px)',
        opacity: fase >= 1 ? 1 : 0,
        transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Tenta mostrar logo, fallback para texto */}
        <img
          src="/logo-ornare.png"
          alt="Ornare"
          style={{ height: 48, objectFit: 'contain', marginBottom: 12, filter: 'invert(1)' }}
          onError={e => { e.target.style.display = 'none'; document.getElementById('splash-text').style.display = 'block' }}
        />
        <div id="splash-text" style={{ display: 'none', fontFamily: "'Cormorant Garamond', serif", fontSize: 44, fontWeight: 600, letterSpacing: 10, color: '#f5f2ee', marginBottom: 8 }}>
          ORNARE
        </div>
        <div style={{
          fontSize: 9, letterSpacing: 5, color: '#b09a7a',
          opacity: fase >= 2 ? 1 : 0,
          transition: 'opacity 0.5s 0.2s',
        }}>
          GESTÃO DE OBRAS
        </div>
        <div style={{
          width: 32, height: 1, background: '#b09a7a',
          margin: '20px auto 0',
          transform: fase >= 2 ? 'scaleX(1)' : 'scaleX(0)',
          transition: 'transform 0.6s 0.4s',
        }} />
      </div>
    </div>
  )
}