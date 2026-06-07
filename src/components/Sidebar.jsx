export default function Sidebar() {
  return (
    <aside style={s.sidebar}>
      <div style={s.brand}>
        <div style={s.logo}>ORNARE</div>
        <div style={s.sublogo}>WORKS</div>
      </div>

      <nav style={s.nav}>
        <Item ativo texto="Dashboard" />
        <Item texto="Obras" />
        <Item texto="Agenda" />
        <Item texto="Equipe" />
        <Item texto="Ocorrencias" />
        <Item texto="Gastos" />
        <Item texto="Relatorios" />
        <Item texto="Portal Cliente" />
        <Item texto="Configuracoes" />
      </nav>

      <div style={s.footer}>
        <div style={s.footerTitle}>Ornare App</div>
        <div style={s.footerText}>Gestao premium de obras</div>
      </div>
    </aside>
  )
}

function Item({ texto, ativo }) {
  return (
    <div style={{
      ...s.item,
      background: ativo ? '#F7F4EF' : 'transparent',
      color: ativo ? '#2B2B2B' : '#D8CCB8',
      fontWeight: ativo ? 600 : 400
    }}>
      {texto}
    </div>
  )
}

const s = {
  sidebar: {
    width: 280,
    background: 'linear-gradient(180deg, #242321 0%, #2B2B2B 100%)',
    color: '#fff',
    minHeight: '100vh',
    padding: 30,
    boxSizing: 'border-box',
    position: 'fixed',
    left: 0,
    top: 0
  },
  brand: {
    marginBottom: 54
  },
  logo: {
    fontFamily: 'Georgia, serif',
    fontSize: 31,
    letterSpacing: 8
  },
  sublogo: {
    fontSize: 11,
    letterSpacing: 4,
    color: '#B89B68',
    marginTop: 8,
    textTransform: 'uppercase'
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  },
  item: {
    padding: '14px 18px',
    borderRadius: 14,
    fontSize: 14,
    cursor: 'pointer',
    transition: '0.2s'
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    borderTop: '1px solid rgba(255,255,255,0.12)',
    paddingTop: 18
  },
  footerTitle: {
    color: '#fff',
    fontSize: 13
  },
  footerText: {
    color: '#B8B0A3',
    fontSize: 11,
    marginTop: 4
  }
}