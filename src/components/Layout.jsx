import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile]   = useState(false)

  useEffect(() => {
    function check() {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      setCollapsed(mobile)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--color-bg, #F5F2EE)' }}>

      {/* overlay mobile */}
      {isMobile && !collapsed && (
        <div
          onClick={() => setCollapsed(true)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(26,24,20,0.55)',
            zIndex: 40, backdropFilter: 'blur(2px)',
          }}
        />
      )}

      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} isMobile={isMobile} />

      <main style={{ flex: 1, overflowY: 'auto', transition: 'all 0.25s', background: 'var(--color-bg, #F5F2EE)' }}>

        {/* botao hamburguer mobile — nova identidade */}
        {isMobile && collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            style={{
              position: 'fixed', top: 14, left: 14, zIndex: 30,
              background: '#1A1A18',
              border: '1px solid rgba(200,168,106,0.25)',
              borderRadius: 10, padding: '8px 12px',
              cursor: 'pointer',
              boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <IconMenu />
            <span style={{
              fontSize: 10,
              fontFamily: 'var(--font-serif, serif)',
              letterSpacing: 3,
              color: '#C8A86A',
              fontWeight: 600,
            }}>
              ORNARE
            </span>
          </button>
        )}

        <Outlet />
      </main>
    </div>
  )
}

function IconMenu() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C8A86A" strokeWidth="2.5">
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}
