import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'

const ITEMS = {
  gestao: [
    { label: 'Ao vivo', to: '/obras-ao-vivo', icon: IconLive },
    { label: 'Início', to: '/dashboard', icon: IconHome },
    { label: 'Obras', to: '/obras', icon: IconClipboard },
    { label: 'Agenda', to: '/agenda', icon: IconCalendar },
  ],
  supervisor: [
    { label: 'Início', to: '/supervisor', icon: IconHome },
    { label: 'Agenda', to: '/agenda', icon: IconCalendar },
    { label: 'Obras', to: '/obras', icon: IconBuilding, matchObras: true, ignoreSearch: 'filtro=fotos' },
    { label: 'Fotos', to: '/obras?filtro=fotos', icon: IconCamera, matchSearch: 'filtro=fotos' },
  ],
  pos_venda: [
    { label: 'Início', to: '/obras', icon: IconHome },
    { label: 'Obras', to: '/obras', icon: IconClipboard },
    { label: 'Agenda', to: '/agenda', icon: IconCalendar },
    { label: 'Planejamento', to: '/planejamento', icon: IconChart },
  ],
}

function normalizeRole(role) {
  return role === 'vendedor' ? 'pos_venda' : role
}

export default function BottomNavigation({ onMore }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useStore()
  const role = normalizeRole(profile?.role || 'gestao')
  const items = ITEMS[role] || ITEMS.gestao

  return (
    <nav className="ow-bottom-nav" aria-label="Navegação principal mobile">
      {items.map(item => {
        const Icon = item.icon
        const [path] = item.to.split('?')
        const ignored = item.ignoreSearch ? location.search.includes(item.ignoreSearch) : false
        const hasSearch = item.matchSearch ? location.search.includes(item.matchSearch) : false
        const active = item.matchObras
          ? (location.pathname === '/obras' || location.pathname.startsWith('/obras/')) && !ignored
          : item.matchSearch
            ? location.pathname === path && hasSearch
            : location.pathname === path
        return (
          <button key={`${item.label}-${item.to}`} className={active ? 'active' : ''} onClick={() => navigate(item.to)}>
            <Icon />
            <span>{item.label}</span>
          </button>
        )
      })}
      <button onClick={onMore}>
        <IconMore />
        <span>Mais</span>
      </button>
    </nav>
  )
}

function IconHome() {
  return <svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/><path d="M10 20v-5h4v5"/></svg>
}

function IconLive() {
  return <svg viewBox="0 0 24 24"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3-3 3 2 5-7"/><circle cx="8" cy="15" r="1"/><circle cx="14" cy="14" r="1"/><circle cx="19" cy="7" r="1"/></svg>
}

function IconClipboard() {
  return <svg viewBox="0 0 24 24"><path d="M8 4h8l1 3H7z"/><path d="M6 6H5v15h14V6h-1"/><path d="M8 12h8"/><path d="M8 16h6"/></svg>
}

function IconCalendar() {
  return <svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>
}

function IconChart() {
  return <svg viewBox="0 0 24 24"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5M12 16V8M16 16v-8"/></svg>
}

function IconBuilding() {
  return <svg viewBox="0 0 24 24"><path d="M4 20h16"/><path d="M6 20V7l6-3 6 3v13"/><path d="M9 11h1M14 11h1M9 15h1M14 15h1"/></svg>
}

function IconCamera() {
  return <svg viewBox="0 0 24 24"><path d="M4 8h4l2-3h4l2 3h4v11H4z"/><circle cx="12" cy="13.5" r="3.5"/></svg>
}

function IconMore() {
  return <svg viewBox="0 0 24 24"><path d="M5 12h.01M12 12h.01M19 12h.01"/></svg>
}
