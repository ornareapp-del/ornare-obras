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

  return (
    <Layout>
      <h1>Dashboard Executivo</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
        <KpiCard titulo="Obras Ativas" valor={obras.length} />
        <KpiCard titulo="Em Montagem" valor={obras.filter(o => o.status === 'Em montagem').length} />
        <KpiCard titulo="Pendencias" valor={obras.filter(o => o.status === 'Com pendencias').length} />
        <KpiCard titulo="Concluidas" valor={obras.filter(o => o.status === 'Concluida').length} />
      </div>

      <div style={{ background: '#fff', borderRadius: 18, padding: 24, marginTop: 30 }}>
        <h2>Obras em andamento</h2>

        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Obra</th>
              <th>Cliente</th>
              <th>Status</th>
              <th>Progresso</th>
            </tr>
          </thead>

          <tbody>
            {obras.map(obra => (
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