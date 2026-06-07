import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/', icon: '▦', label: 'Dashboard', exact: true },
  { to: '/obras', icon: '◫', label: 'Obras' },
  { to: '/tarefas', icon: '✓', label: 'Tarefas' },
  { to: '/agenda', icon: '▭', label: 'Agenda' },
  { to: '/equipe', icon: '◎', label: 'Equipe' },
  { to: '/ocorrencias', icon: '△', label: 'Ocorrências' },
  { to: '/gastos', icon: '◇', label: 'Gastos' },
]

export default function Sidebar() {
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <aside style={{
      width: 220, background: 'var(--color-surface)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh',
    }}>
      <div style={{ padding: '28px 28px 24px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, letterSpacing: 4, color: 'var(--color-ink)' }}>ORNARE</div>
        <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', marginTop: 3 }}>WORKS</div>
      </div>

      <nav style={{ flex: 1, padding: '20px 0' }}>
        {NAV.map(({ to, icon, label, exact }) => (
          <NavLink key={to} to={to} end={exact} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 24px', fontSize: 12.5,
            color: isActive ? 'var(--color-ink)' : 'var(--color-ink-muted)',
            fontWeight: isActive ? 500 : 400,
            borderLeft: isActive ? '2px solid var(--color-gold)' : '2px solid transparent',
            background: isActive ? 'var(--color-border-light)' : 'transparent',
            transition: 'all 0.15s', letterSpacing: 0.3,
          })}>
            <span style={{ fontSize: 14, opacity: 0.7 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)' }}>
        <button onClick={handleLogout} style={{
          background: 'none', border: 'none', fontSize: 12,
          color: 'var(--color-ink-muted)', cursor: 'pointer', padding: 0,
        }}>← Sair</button>
      </div>
    </aside>
  )
}