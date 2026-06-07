import { NavLink } from 'react-router-dom'

export default function Sidebar() {
  return (
    <aside style={s.sidebar}>
      <div style={s.brand}>
        <div style={s.logo}>ORNARE</div>
        <div style={s.sublogo}>WORKS</div>
      </div>

      <nav style={s.nav}>
        <Item to="/" texto="Dashboard" />
        <Item to="/obras" texto="Obras" />
        <Item to="/tarefas" texto="Tarefas" />
        <Item to="/agenda" texto="Agenda" />
        <Item to="/equipe" texto="Equipe" />
        <Item to="/ocorrencias" texto="Ocorrencias" />
        <Item to="/gastos" texto="Gastos" />
      </nav>
    </aside>
  )
}

function Item({ to, texto }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      style={({ isActive }) => ({
        ...s.item,
        background: isActive ? '#F7F4EF' : 'transparent',
        color: isActive ? '#2B2B2B' : '#D8CCB8',
        fontWeight: isActive ? 700 : 400,
        textDecoration: 'none'
      })}
    >
      {texto}
    </NavLink>
  )
}

const s = {
  sidebar: {
    width: 280,
    background: '#2B2B2B',
    color: '#fff',
    minHeight: '100vh',
    padding: 30,
    boxSizing: 'border-box',
    position: 'fixed',
    left: 0,
    top: 0
  },
  brand: { marginBottom: 54 },
  logo: { fontFamily: 'Georgia, serif', fontSize: 31, letterSpacing: 8 },
  sublogo: { fontSize: 11, letterSpacing: 4, color: '#B89B68', marginTop: 8 },
  nav: { display: 'flex', flexDirection: 'column', gap: 12 },
  item: { padding: '14px 18px', borderRadius: 14, fontSize: 14, display: 'block' }
}
