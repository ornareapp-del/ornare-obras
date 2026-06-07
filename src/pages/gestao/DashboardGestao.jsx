import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import KpiCard from '../../components/KpiCard'

export default function DashboardGestao() {

  const [obras, setObras] = useState([])

  useEffect(() => {
    carregarObras()
  }, [])

  async function carregarObras() {
    const { data } = await supabase
      .from('obras')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setObras(data)
  }

  const obrasAtivas = obras.length
  const emMontagem = obras.filter(x => x.status?.toLowerCase().includes('montagem')).length
  const concluidas = obras.filter(x => x.status?.toLowerCase().includes('conclu')).length
  const pendencias = obras.filter(x => x.status?.toLowerCase().includes('pend')).length

  return (
    <Layout>

      <div style={s.header}>
        <div>
          <h1 style={s.titulo}>Dashboard Executivo</h1>
          <p style={s.subtitulo}>
            Gestão Premium de Obras Ornare
          </p>
        </div>
      </div>

      <div style={s.kpis}>

        <KpiCard
          titulo="Obras Ativas"
          valor={obrasAtivas}
        />

        <KpiCard
          titulo="Em Montagem"
          valor={emMontagem}
        />

        <KpiCard
          titulo="Pendências"
          valor={pendencias}
        />

        <KpiCard
          titulo="Concluídas"
          valor={concluidas}
        />

      </div>

      <div style={s.card}>

        <div style={s.cardTitle}>
          Obras em andamento
        </div>

        <table style={s.table}>

          <thead>
            <tr>
              <th>Obra</th>
              <th>Cliente</th>
              <th>Status</th>
              <th>Progresso</th>
            </tr>
          </thead>

          <tbody>

            {obras.map((obra) => (

              <tr key={obra.id}>
                <td>{obra.nome}</td>
                <td>{obra.cliente_nome}</td>
                <td>{obra.status}</td>
                <td>{obra.progresso}%</td>
              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </Layout>
  )
}

const s = {

  header: {
    marginBottom: 30
  },

  titulo: {
    fontSize: 34,
    margin: 0,
    color: '#2B2B2B'
  },

  subtitulo: {
    color: '#9C8B6A'
  },

  kpis: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4,1fr)',
    gap: 20,
    marginBottom: 30
  },

  card: {
    background: '#fff',
    borderRadius: 18,
    padding: 24,
    border: '1px solid #EEE7DA',
    boxShadow: '0 8px 24px rgba(43,43,43,0.06)'
  },

  cardTitle: {
    fontSize: 22,
    marginBottom: 20,
    color: '#2B2B2B'
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse'
  }

}
