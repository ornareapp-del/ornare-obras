export default function KpiCard({ titulo, valor, detalhe }) {
  return (
    <div style={s.card}>
      <div style={s.titulo}>{titulo}</div>
      <div style={s.valor}>{valor}</div>
      {detalhe && <div style={s.detalhe}>{detalhe}</div>}
    </div>
  )
}

const s = {
  card: {
    background: '#fff',
    borderRadius: 18,
    padding: 24,
    boxShadow: '0 8px 24px rgba(43,43,43,0.06)',
    border: '1px solid #EEE7DA'
  },
  titulo: {
    color: '#6F6874',
    fontSize: 14,
    marginBottom: 10
  },
  valor: {
    color: '#2B2B2B',
    fontSize: 34,
    fontWeight: 700
  },
  detalhe: {
    color: '#9C8B6A',
    fontSize: 12,
    marginTop: 8
  }
}
