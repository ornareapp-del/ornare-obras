import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {isMobile && !collapsed && (
        <div onClick={() => setCollapsed(true)} style={{
          position: 'fixed', inset: 0, background: 'rgba(26,24,20,0.45)',
          zIndex: 40, backdropFilter: 'blur(2px)'
        }} />
      )}
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} isMobile={isMobile} />
      <main style={{ flex: 1, overflowY: 'auto', transition: 'all 0.25s' }}>
        {isMobile && collapsed && (
          <button onClick={() => setCollapsed(false)} style={{
            position: 'fixed', top: 16, left: 16, zIndex: 30,
            background: '#fff', border: '1px solid var(--color-border)',
            borderRadius: 10, padding: '8px 10px', cursor: 'pointer',
            boxShadow: '0 2px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 6
          }}>
            <IconMenu />
            <span style={{ fontSize: 11, fontFamily: 'var(--font-serif)', letterSpacing: 2, color: 'var(--color-ink)' }}>ORNARE</span>
          </button>
        )}
        <Outlet />
      </main>
    </div>
  )
}

function IconMenu() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
}