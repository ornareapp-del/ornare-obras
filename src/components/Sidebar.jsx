import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'
import { theme } from '../constants/theme'

// Definicao do menu por role.
//
// readOnly: true  → chip "somente leitura" exibido ao lado do label
// roles: []       → quais roles enxergam este item
//
const NAV_ITEMS = [
  {
    to: '/obras-ao-vivo',
    label: 'Obras ao vivo',
    icon: IconLive,
    group: 'Operação',
    color: theme.status.successDeep,
    roles: ['gestao'],
  },
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: IconGrid,
    group: 'Operação',
    color: theme.status.goldMuted,
    end: true,
    roles: ['gestao'],
  },
  {
    to: '/obras',
    label: 'Obras',
    icon: IconBuilding,
    group: 'Operação',
    color: theme.status.info,
    roles: ['gestao', 'supervisor', 'pos_venda'],
    readOnly: ['pos_venda'],
  },
  {
    to: '/planejamento',
    label: 'Planejamento',
    icon: IconTimeline,
    group: 'Operação',
    color: theme.status.purple,
    roles: ['gestao', 'supervisor', 'pos_venda'],
    readOnly: ['pos_venda'],
  },
  {
    to: '/agenda',
    label: 'Agenda',
    icon: IconCalendar,
    group: 'Operação',
    color: theme.status.successDeep,
    roles: ['gestao', 'supervisor', 'pos_venda'],
    readOnly: ['pos_venda'],
  },
  {
    to: '/tarefas',
    label: 'Tarefas',
    icon: IconCheck,
    group: 'Controle',
    color: theme.status.successDeep,
    roles: ['gestao', 'supervisor'],
  },
  {
    to: '/ocorrencias',
    label: 'Ocorrências',
    icon: IconAlert,
    group: 'Controle',
    color: theme.status.danger,
    roles: ['gestao', 'supervisor'],
  },
  {
    to: '/equipe',
    label: 'Equipe',
    icon: IconUsers,
    group: 'Equipe',
    color: theme.status.info,
    roles: ['gestao', 'supervisor'],  // supervisor gerencia montadores
  },
  {
    to: '/gastos',
    label: 'Gastos',
    icon: IconReceipt,
    group: 'Financeiro',
    color: theme.status.finance,
    roles: ['gestao', 'supervisor'],
  },
  {
    to: '/biblioteca-mestre',
    label: 'Biblioteca Mestre',
    icon: IconCheck,
    group: 'Administração',
    color: theme.status.goldMuted,
    roles: ['gestao', 'supervisor'],
  },
]

const GROUP_ORDER = ['Operação', 'Controle', 'Equipe', 'Financeiro', 'Administração']

// Label amigavel por role.
const ROLE_LABEL = {
  gestao:     'Gestão',
  supervisor: 'Supervisor',
  montador:   'Montador',
  pos_venda:  'Pós-venda',
  vendedor:   'Pós-venda',
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
  const grupos = GROUP_ORDER
    .map(nome => ({ nome, itens: navVisivel.filter(item => item.group === nome) }))
    .filter(grupo => grupo.itens.length > 0)

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
      background: C.background,
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden',
      transition: 'width 0.22s ease, min-width 0.22s ease',
      position: isMobile ? 'fixed' : 'relative',
      zIndex: 50, flexShrink: 0,
      borderRight: '1px solid ' + C.border,
    }}>

      {/* Logo */}
      <div style={{
        padding: collapsed && !isMobile ? '18px 0' : '18px 16px 16px',
        borderBottom: '1px solid ' + C.divider,
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
              <div style={{ fontSize: 11, fontWeight: 700, color: C.text, letterSpacing: 3 }}>ORNARE</div>
              <div style={{ fontSize: 8, color: C.gold, letterSpacing: 2, marginTop: 1 }}>WORKS</div>
            </div>
          </div>
        )}

        {collapsed && !isMobile && (
          <div style={{ width: 28, height: 28, borderRadius: 6, background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.text, letterSpacing: 1 }}>O</span>
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

      {/* Navegacao */}
      <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto', overflowX: 'hidden' }}>
        {grupos.map(grupo => (
          <div key={grupo.nome} style={{ paddingTop: collapsed && !isMobile ? 4 : 8 }}>
            {(!collapsed || isMobile) && (
              <div style={{ fontSize: 8, letterSpacing: 2.2, color: C.groupText, textTransform: 'uppercase', padding: '8px 16px 6px', fontWeight: 800 }}>
                {grupo.nome}
              </div>
            )}

            {grupo.itens.map(({ to, label, icon: Icon, end, readOnly: roItem, color }) => {
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
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? C.text : C.muted,
                    borderRadius: collapsed && !isMobile ? 0 : 9,
                    background: isActive ? C.activeBg : 'transparent',
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
                      {!collapsed && !isMobile && isActive && (
                        <div style={{
                          position: 'absolute', left: 0, top: '18%', bottom: '18%',
                          width: 3, background: color || C.gold, borderRadius: '0 2px 2px 0',
                        }} />
                      )}

                      <span style={{
                        width: 25, height: 25, borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        color: isActive ? C.text : color,
                        background: isActive ? color : `${color}22`,
                        transition: 'all 0.15s',
                      }}>
                        <Icon />
                      </span>

                      {(!collapsed || isMobile) && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                          <span style={{ flex: 1 }}>{label}</span>
                          {somenteLeitura && (
                            <span style={{
                              fontSize: 8, letterSpacing: 0.5, color: C.readOnlyText,
                              background: C.readOnlyBg, borderRadius: 4,
                              padding: '2px 5px', fontWeight: 700, whiteSpace: 'nowrap',
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
          </div>
        ))}
      </nav>

      {/* Usuario + logout */}
      <div style={{
        padding: collapsed && !isMobile ? '12px 0' : '12px 10px',
        borderTop: '1px solid ' + C.divider,
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed && !isMobile ? 'center' : 'space-between',
        gap: 8,
      }}>
        {(!collapsed || isMobile) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, overflow: 'hidden' }}>
            {/* avatar */}
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDeep} 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: C.text, flexShrink: 0,
              boxShadow: '0 0 0 2px ' + C.avatarRing,
            }}>
              {initials}
            </div>
            {/* nome e role */}
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.full_name?.split(' ')[0] || 'Usuário'}
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
  ...theme.sidebar,
}

// ─── ESTILOS DE BOTAO ─────────────────────────────────────────────────────────
const bt = {
  toggle: {
    background: C.controlBg,
    border: 'none', cursor: 'pointer',
    color: C.controlColor,
    padding: 6, borderRadius: 6,
    display: 'flex', alignItems: 'center', flexShrink: 0,
    transition: 'background 0.15s',
  },
  logout: {
    background: C.logoutBg,
    border: 'none', cursor: 'pointer',
    color: C.muted,
    padding: 7, borderRadius: 6,
    display: 'flex', alignItems: 'center', flexShrink: 0,
    transition: 'background 0.15s',
  },
}

// ─── ICONES ───────────────────────────────────────────────────────────────────
function IconGrid()         { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> }
function IconLive()         { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3-3 3 2 5-7"/><circle cx="8" cy="15" r="1"/><circle cx="14" cy="14" r="1"/><circle cx="19" cy="7" r="1"/></svg> }
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
