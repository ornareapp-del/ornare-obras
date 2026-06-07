export default function KpiCard({ titulo, valor, detalhe }) {
  return (
    <div style={s.card}>
      <div style={s.topLine}></div>
      <div style={s.titulo}>{titulo}</div>
      <div style={s.valor}>{valor}</div>
      {detalhe && <div style={s.detalhe}>{detalhe}</div>}
    </div>
  )
}

const s = {
  card: {
    background: 'linear-gradient(180deg, #FFFFFF 0%, #FBF8F2 100%)',
    borderRadius: 22,
    padding: 26,
    boxShadow: '0 18px 45px rgba(43,43,43,0.08)',
    border: '1px solid #EDE4D6',
    position: 'relative',
    overflow: 'hidden'
  },
  topLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    background: '#B89B68'
  },
  titulo: {
    color: '#6F6874',
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12
  },
  valor: {
    color: '#2B2B2B',
    fontSize: 38,
    fontWeight: 700,
    lineHeight: 1
  },
  detalhe: {
    color: '#9C8B6A',
    fontSize: 12,
    marginTop: 10
  }
}