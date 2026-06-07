import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/',            label: 'Dashboard',   icon: IconGrid,     end: true },
  { to: '/obras',       label: 'Obras',       icon: IconBuilding        },
  { to: '/tarefas',     label: 'Tarefas',     icon: IconCheck           },
  { to: '/agenda',      label: 'Agenda',      icon: IconCalendar        },
  { to: '/equipe',      label: 'Equipe',      icon: IconUsers           },
  { to: '/ocorrencias', label: 'Ocorrências', icon: IconAlert           },
  { to: '/gastos',      label: 'Gastos',      icon: IconReceipt         },
]

export default function Sidebar({ collapsed, setCollapsed, isMobile }) {
  const navigate = useNavigate()
  const width = isMobile ? (collapsed ? 0 : 260) : (collapsed ? 64 : 220)

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <aside style={{
      width, minWidth: width,
      background: 'var(--color-surface)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden',
      transition: 'width 0.25s, min-width 0.25s',
      position: isMobile ? 'fixed' : 'relative',
      zIndex: 50, flexShrink: 0,
    }}>

      {/* Header */}
      <div style={{
        padding: collapsed ? '18px 0' : '22px 20px 18px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed && !isMobile ? 'center' : 'space-between',
        gap: 8, overflow: 'hidden',
      }}>
        {(!collapsed || isMobile) && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 600,
              letterSpacing: 5, color: 'var(--color-ink)', whiteSpace: 'nowrap'
            }}>ORNARE</div>
            <div style={{ fontSize: 8, letterSpacing: 4, color: 'var(--color-gold)', marginTop: 1 }}>WORKS</div>
          </div>
        )}
        {!isMobile && (
          <button onClick={() => setCollapsed(c => !c)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-ink-muted)', padding: 6, borderRadius: 8,
            display: 'flex', alignItems: 'center', transition: 'background 0.15s',
          }}>
            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
        )}
        {isMobile && (
          <button onClick={() => setCollapsed(true)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-ink-muted)', padding: 6, borderRadius: 8, display: 'flex',
          }}>
            <IconX />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto', overflowX: 'hidden' }}>
        {/* Label seção */}
        {!collapsed && (
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', padding: '8px 20px 6px', opacity: 0.8 }}>
            Gestão
          </div>
        )}

        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            onClick={() => isMobile && setCollapsed(true)}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center',
              gap: 12,
              padding: collapsed && !isMobile ? '12px 0' : '10px 16px',
              justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
              fontSize: 13,
              color: isActive ? 'var(--color-ink)' : 'var(--color-ink-muted)',
              fontWeight: isActive ? 500 : 400,
              borderLeft: collapsed && !isMobile ? 'none' : (isActive ? '2px solid var(--color-gold)' : '2px solid transparent'),
              background: isActive ? 'rgba(176,154,122,0.08)' : 'transparent',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
              letterSpacing: 0.2,
              position: 'relative',
            })}
            title={collapsed && !isMobile ? label : ''}
          >
            {({ isActive }) => (
              <>
                {collapsed && !isMobile && isActive && (
                  <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, background: 'var(--color-gold)', borderRadius: '0 2px 2px 0' }} />
                )}
                <span style={{
                  display: 'flex', alignItems: 'center', flexShrink: 0,
                  color: isActive ? 'var(--color-gold)' : 'inherit'
                }}>
                  <Icon />
                </span>
                {(!collapsed || isMobile) && <span>{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: collapsed && !isMobile ? '14px 0' : '14px 16px',
        borderTop: '1px solid var(--color-border)',
        display: 'flex', justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
      }}>
        <button onClick={logout} title="Sair" style={{
          background: 'none', border: 'none', fontSize: 12,
          color: 'var(--color-ink-muted)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8, padding: 4, borderRadius: 6,
        }}>
          <IconLogout />
          {(!collapsed || isMobile) && <span>Sair</span>}
        </button>
      </div>
    </aside>
  )
}

/* ── Ícones ── */
function IconGrid() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> }
function IconBuilding() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg> }
function IconCheck() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><polyline points="9 12 11 14 15 10"/></svg> }
function IconCalendar() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }
function IconUsers() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
function IconAlert() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> }
function IconReceipt() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 2v20l3-2 2 2 3-2 2 2 3-2 2 2V2z"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/></svg> }
function IconChevronLeft() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> }
function IconChevronRight() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg> }
function IconX() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> }
function IconLogout() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> }