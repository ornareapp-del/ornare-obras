import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'

const NAV = {
  gestao: [
    { path: '/', icon: '▪', label: 'Dashboard' },
    { path: '/obras', icon: '▪', label: 'Obras' },
    { path: '/equipe', icon: '▪', label: 'Equipe' },
    { path: '/agenda', icon: '▪', label: 'Agenda' },
    { path: '/aprovacao', icon: '▪', label: 'Aprovações' },
    { path: '/gastos', icon: '▪', label: 'Gastos' },
    { path: '/relatorios', icon: '▪', label: 'Relatórios' },
  ],
  supervisor: [
    { path: '/', icon: '▪', label: 'Dashboard' },
    { path: '/obras', icon: '▪', label: 'Minhas Obras' },
    { path: '/tarefas', icon: '▪', label: 'Tarefas' },
    { path: '/checklist', icon: '▪', label: 'Checklist' },
    { path: '/ocorrencias', icon: '▪', label: 'Ocorrências' },
    { path: '/resumo', icon: '▪', label: 'Resumo Diário' },
    { path: '/gastos', icon: '▪', label: 'Gastos' },
  ],
  montador: [
    { path: '/', icon: '▪', label: 'Minhas Tarefas' },
    { path: '/checkin', icon: '▪', label: 'Check-in' },
    { path: '/fotos', icon: '▪', label: 'Enviar Fotos' },
    { path: '/ocorrencias', icon: '▪', label: 'Ocorrências' },
  ],
  cliente: [
    { path: '/', icon: '▪', label: 'Minha Obra' },
  ],
}

export default function Layout({ children }) {
  const { profile, logout } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const role = profile?.role || 'montador'
  const navItems = NAV[role] || []

  async function handleLogout() {
    await supabase.auth.signOut()
    logout()
    navigate('/login')
  }

  function NavContent() {
    return (
      <>
        <div style={s.sidebarLogo}>
          <div style={s.logoText}>Ornare</div>
          <div style={s.logoSub}>Gestão de Obras</div>
        </div>

        <nav style={s.nav}>
          {navItems.map(item => (
            <div
              key={item.path}
              style={{
                ...s.navItem,
                ...(location.pathname === item.path ? s.navItemActive : {})
              }}
              onClick={() => { navigate(item.path); setMenuOpen(false) }}
            >
              <span style={s.navDot}></span>
              {item.label}
            </div>
          ))}
        </nav>

        <div style={s.sidebarFooter}>
          <div style={s.userName}>{profile?.full_name || 'Usuário'}</div>
          <div style={s.userRole}>{role}</div>
          <button style={s.logoutBtn} onClick={handleLogout}>Sair</button>
        </div>
      </>
    )
  }

  return (
    <div style={s.root}>
      {/* Sidebar desktop */}
      <aside style={s.sidebar}>
        <NavContent />
      </aside>

      {/* Menu mobile overlay */}
      {menuOpen && (
        <div style={s.overlay} onClick={() => setMenuOpen(false)}>
          <aside style={s.sidebarMobile} onClick={e => e.stopPropagation()}>
            <NavContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div style={s.main}>
        {/* Topbar */}
        <div style={s.topbar}>
          <button style={s.menuBtn} onClick={() => setMenuOpen(true)}>
            ☰
          </button>
          <div style={s.topbarLogo}>Ornare</div>
          <div style={{ width: 40 }} />
        </div>

        {/* Content */}
        <div style={s.content}>
          {children}
        </div>
      </div>
    </div>
  )
}

const s = {
  root: { display: 'flex', minHeight: '100vh' },

  sidebar: {
    width: 220,
    background: 'var(--graphite)',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    top: 0, left: 0, bottom: 0,
    zIndex: 100,
    '@media(max-width:768px)': { display: 'none' },
  },

  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 200,
    display: 'none',
  },

  sidebarMobile: {
    width: 260,
    background: 'var(--graphite)',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },

  sidebarLogo: {
    padding: '28px 24px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },

  logoText: {
    fontFamily: 'Cormorant Garamond, Georgia, serif',
    fontSize: 22,
    fontWeight: 300,
    letterSpacing: 6,
    color: '#FDFCFA',
    textTransform: 'uppercase',
  },

  logoSub: {
    fontSize: 9,
    letterSpacing: 2,
    color: '#D4AF6A',
    textTransform: 'uppercase',
    marginTop: 2,
  },

  nav: { flex: 1, padding: '12px 0', overflowY: 'auto' },

  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '11px 20px',
    color: 'rgba(255,255,255,0.55)',
    cursor: 'pointer',
    fontSize: 13,
    borderLeft: '2px solid transparent',
    transition: 'all .2s',
  },

  navItemActive: {
    color: '#FDFCFA',
    background: 'rgba(255,255,255,0.06)',
    borderLeftColor: '#B8963E',
  },

  navDot: {
    width: 4, height: 4,
    borderRadius: '50%',
    background: 'currentColor',
    flexShrink: 0,
  },

  sidebarFooter: {
    padding: '16px 20px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },

  userName: { fontSize: 13, color: '#FDFCFA', fontWeight: 500 },
  userRole: { fontSize: 10, color: '#D4AF6A', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 },

  logoutBtn: {
    marginTop: 10,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.5)',
    borderRadius: 4,
    padding: '6px 12px',
    fontSize: 11,
    cursor: 'pointer',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  main: {
    marginLeft: 220,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  },

  topbar: {
    display: 'none',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--off-white)',
    borderBottom: '1px solid var(--border)',
    padding: '0 16px',
    height: 52,
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },

  menuBtn: {
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 6,
    width: 36, height: 36,
    cursor: 'pointer',
    fontSize: 16,
    color: 'var(--graphite)',
  },

  topbarLogo: {
    fontFamily: 'Cormorant Garamond, Georgia, serif',
    fontSize: 20,
    letterSpacing: 4,
    color: 'var(--graphite)',
  },

  content: { padding: '28px 32px', flex: 1 },
}