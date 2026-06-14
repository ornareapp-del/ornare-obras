import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'

// ─── DEFINICAO DO MENU POR ROLE ───────────────────────────────────────────────
//
// readOnly: true  → chip "somente leitura" exibido ao lado do label
// roles: []       → quais roles enxergam este item
//
const NAV_ITEMS = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: IconGrid,
    end: true,
    roles: ['gestao'],
  },
  {
    to: '/obras',
    label: 'Obras',
    icon: IconBuilding,
    roles: ['gestao', 'supervisor', 'pos_venda'],
    readOnly: ['pos_venda'],
  },
  {
    to: '/tarefas',
    label: 'Tarefas',
    icon: IconCheck,
    roles: ['gestao', 'supervisor'],
  },
  {
    to: '/agenda',
    label: 'Agenda',
    icon: IconCalendar,
    roles: ['gestao', 'supervisor', 'pos_venda'],
  },
  {
    to: '/planejamento',
    label: 'Planejamento',
    icon: IconTimeline,
    roles: ['gestao', 'supervisor', 'pos_venda'],
    readOnly: ['pos_venda'],
  },
  {
    to: '/equipe',
    label: 'Equipe',
    icon: IconUsers,
    roles: ['gestao', 'supervisor'],  // supervisor gerencia montadores
  },
  {
    to: '/ocorrencias',
    label: 'Ocorrencias',
    icon: IconAlert,
    roles: ['gestao', 'supervisor'],
  },
  {
    to: '/gastos',
    label: 'Gastos',
    icon: IconReceipt,
    roles: ['gestao', 'supervisor'],
  },
]

// Label amigavel por role (exibido embaixo do nome do usuario)
const ROLE_LABEL = {
  gestao:     'Gestao',
  supervisor: 'Supervisor',
  montador:   'Montador',
  pos_venda:  'Pos-venda',
  vendedor:   'Pos-venda',
  cliente:    'Cliente',
}

function normalizeRole(role) {
  return role === 'vendedor' ? 'pos_venda' : role
}

export default function Sidebar({ collapsed, setCollapsed, isMobile }) {
  const navigate = useNavigate()
  const { profile } = useStore()
  const role = normalizeRole(profile?.role || 'gestao')

  const width = isMobile ? (collapsed ? 0 : 260) : (collapsed ? 56 : 224)

  // filtra itens visiveis para o role atual
  const navVisivel = NAV_ITEMS.filter(item => item.roles.includes(role))

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const initials = (profile?.full_name || profile?.email || 'U')
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const isReadOnly = (item) => item.readOnly?.includes(role)

  return (
    <aside style={{
      width, minWidth: width,
      background: C.sidebarBg,
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden',
      transition: 'width 0.22s ease, min-width 0.22s ease',
      position: isMobile ? 'fixed' : 'relative',
      zIndex: 50, flexShrink: 0,
      borderRight: '1px solid rgba(200,168,106,0.10)',
    }}>

      {/* ── LOGO ──────────────────────────────────────────────────────────── */}
      <div style={{
        padding: collapsed && !isMobile ? '18px 0' : '18px 16px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed && !isMobile ? 'center' : 'space-between',
        gap: 8, minHeight: 64,
      }}>
        {(!collapsed || isMobile) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            <img
              src="/logo-ornare.png"
              alt="Ornare"
              style={{ height: 22, objectFit: 'contain', filter: 'brightness(10)', flexShrink: 0 }}
              onError={e => e.target.style.display = 'none'}
            />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: 3 }}>ORNARE</div>
              <div style={{ fontSize: 8, color: C.gold, letterSpacing: 2, marginTop: 1 }}>WORKS</div>
            </div>
          </div>
        )}

        {collapsed && !isMobile && (
          <div style={{ width: 28, height: 28, borderRadius: 6, background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: 1 }}>O</span>
          </div>
        )}

        {!isMobile && (
          <button onClick={() => setCollapsed(c => !c)} style={bt.toggle} title={collapsed ? 'Expandir menu' : 'Recolher menu'}>
            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
        )}
        {isMobile && (
          <button onClick={() => setCollapsed(true)} style={bt.toggle}>
            <IconX />
          </button>
        )}
      </div>

      {/* ── NAV ───────────────────────────────────────────────────────────── */}
      <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto', overflowX: 'hidden' }}>
        {!collapsed && (
          <div style={{ fontSize: 8, letterSpacing: 2.5, color: 'rgba(200,168,106,0.45)', textTransform: 'uppercase', padding: '10px 16px 8px', fontWeight: 600 }}>
            Menu
          </div>
        )}

        {navVisivel.map(({ to, label, icon: Icon, end, readOnly: roItem }) => {
          const somenteLeitura = isReadOnly({ readOnly: roItem })
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => isMobile && setCollapsed(true)}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center',
                gap: 10,
                padding: collapsed && !isMobile ? '11px 0' : '9px 12px',
                margin: collapsed && !isMobile ? '2px 0' : '2px 8px',
                justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#fff' : C.navMuted,
                borderRadius: collapsed && !isMobile ? 0 : 8,
                background: isActive ? 'rgba(200,168,106,0.14)' : 'transparent',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                position: 'relative',
                textDecoration: 'none',
                fontFamily: 'inherit',
              })}
              title={collapsed && !isMobile ? label : ''}
            >
              {({ isActive }) => (
                <>
                  {/* indicador lateral dourado no item ativo */}
                  {!collapsed && !isMobile && isActive && (
                    <div style={{
                      position: 'absolute', left: 0, top: '18%', bottom: '18%',
                      width: 3, background: C.gold, borderRadius: '0 2px 2px 0',
                    }} />
                  )}

                  {/* icone */}
                  <span style={{
                    display: 'flex', alignItems: 'center', flexShrink: 0,
                    color: isActive ? C.gold : C.navMuted,
                    transition: 'color 0.15s',
                  }}>
                    <Icon />
                  </span>

                  {/* label + chip readonly */}
                  {(!collapsed || isMobile) && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                      <span style={{ flex: 1 }}>{label}</span>
                      {somenteLeitura && (
                        <span style={{
                          fontSize: 8, letterSpacing: 0.5, color: 'rgba(200,168,106,0.5)',
                          background: 'rgba(200,168,106,0.08)', borderRadius: 4,
                          padding: '2px 5px', fontWeight: 500, whiteSpace: 'nowrap',
                        }}>
                          leitura
                        </span>
                      )}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* ── USUARIO + LOGOUT ──────────────────────────────────────────────── */}
      <div style={{
        padding: collapsed && !isMobile ? '12px 0' : '12px 10px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed && !isMobile ? 'center' : 'space-between',
        gap: 8,
      }}>
        {(!collapsed || isMobile) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, overflow: 'hidden' }}>
            {/* avatar */}
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'linear-gradient(135deg, #C8A86A 0%, #a8884a 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
              boxShadow: '0 0 0 2px rgba(200,168,106,0.25)',
            }}>
              {initials}
            </div>
            {/* nome e role */}
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.full_name?.split(' ')[0] || 'Usuario'}
                {profile?.full_name?.split(' ')[1] ? ' ' + profile.full_name.split(' ')[1][0] + '.' : ''}
              </div>
              <div style={{ fontSize: 9, color: C.gold, textTransform: 'uppercase', letterSpacing: 1, marginTop: 1 }}>
                {ROLE_LABEL[role] || role}
              </div>
            </div>
          </div>
        )}

        <button onClick={logout} title="Sair" style={bt.logout}>
          <IconLogout />
        </button>
      </div>
    </aside>
  )
}

// ─── TOKENS DE COR ────────────────────────────────────────────────────────────
const C = {
  sidebarBg: '#1A1A18',
  gold:      '#C8A86A',
  navMuted:  'rgba(200,192,176,0.55)',
}

// ─── ESTILOS DE BOTAO ─────────────────────────────────────────────────────────
const bt = {
  toggle: {
    background: 'rgba(200,168,106,0.10)',
    border: 'none', cursor: 'pointer',
    color: 'rgba(200,168,106,0.7)',
    padding: 6, borderRadius: 6,
    display: 'flex', alignItems: 'center', flexShrink: 0,
    transition: 'background 0.15s',
  },
  logout: {
    background: 'rgba(255,255,255,0.06)',
    border: 'none', cursor: 'pointer',
    color: 'rgba(200,192,176,0.55)',
    padding: 7, borderRadius: 6,
    display: 'flex', alignItems: 'center', flexShrink: 0,
    transition: 'background 0.15s',
  },
}

// ─── ICONES ───────────────────────────────────────────────────────────────────
function IconGrid()         { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> }
function IconBuilding()     { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg> }
function IconCheck()        { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><polyline points="9 12 11 14 15 10"/></svg> }
function IconCalendar()     { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }
function IconTimeline()     { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/><rect x="6" y="4" width="5" height="4" rx="1"/><rect x="10" y="10" width="8" height="4" rx="1"/><rect x="8" y="16" width="6" height="4" rx="1"/></svg> }
function IconUsers()        { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
function IconAlert()        { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> }
function IconReceipt()      { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 2v20l3-2 2 2 3-2 2 2 3-2 2 2V2z"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/></svg> }
function IconChevronLeft()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> }
function IconChevronRight() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg> }
function IconX()            { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> }
function IconLogout()       { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> }
