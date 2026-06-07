export default function Sidebar() {
  return (
    <aside style={s.sidebar}>
      <div style={s.logo}>ORNARE</div>
      <div style={s.sublogo}>WORKS</div>

      <nav style={s.nav}>
        <Item ativo texto="Dashboard" />
        <Item texto="Obras" />
        <Item texto="Agenda" />
        <Item texto="Equipe" />
        <Item texto="Ocorrências" />
        <Item texto="Gastos" />
        <Item texto="Relatórios" />
        <Item texto="Portal Cliente" />
        <Item texto="Configurações" />
      </nav>
    </aside>
  )
}

function Item({ texto, ativo }) {
  return (
    <div style={{
      ...s.item,
      background: ativo ? '#F7F4EF' : 'transparent',
      color: ativo ? '#2B2B2B' : '#D8CCB8'
    }}>
      {texto}
    </div>
  )
}

const s = {
  sidebar: {
    width: 260,
    background: '#2B2B2B',
    color: '#fff',
    minHeight: '100vh',
    padding: 28,
    boxSizing: 'border-box',
    position: 'fixed',
    left: 0,
    top: 0
  },
  logo: {
    fontFamily: 'Georgia, serif',
    fontSize: 28,
    letterSpacing: 6
  },
  sublogo: {
    fontSize: 11,
    letterSpacing: 3,
    color: '#B89B68',
    marginTop: 4,
    marginBottom: 42
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  item: {
    padding: '13px 16px',
    borderRadius: 12,
    fontSize: 14,
    cursor: 'pointer'
  }
}
