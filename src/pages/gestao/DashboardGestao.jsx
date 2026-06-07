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

  const emMontagem = obras.filter(o => o.status?.toLowerCase().includes('montagem')).length
  const pendencias = obras.filter(o => o.status?.toLowerCase().includes('pend')).length
  const concluidas = obras.filter(o => o.status?.toLowerCase().includes('conclu')).length
  const destaque = obras[0]

  return (
    <Layout>
      <div style={s.header}>
        <div>
          <div style={s.eyebrow}>Ornare Works</div>
          <h1 style={s.title}>Dashboard Executivo</h1>
          <p style={s.subtitle}>Visao geral das obras, montagem, pendencias e operacao em campo.</p>
        </div>

        <button style={s.button}>Nova Obra</button>
      </div>

      <div style={s.kpis}>
        <KpiCard titulo="Obras Ativas" valor={obras.length} detalhe="Total em acompanhamento" />
        <KpiCard titulo="Em Montagem" valor={emMontagem} detalhe="Operacao ativa" />
        <KpiCard titulo="Pendencias" valor={pendencias} detalhe="Aguardando acao" />
        <KpiCard titulo="Concluidas" valor={concluidas} detalhe="Entregues" />
      </div>

      <div style={s.grid}>
        <section style={s.highlightCard}>
          <div style={s.sectionLabel}>Obra em destaque</div>

          {destaque ? (
            <>
              <h2 style={s.obraTitle}>{destaque.nome}</h2>
              <p style={s.client}>{destaque.cliente_nome}</p>

              <div style={s.progressBox}>
                <div style={s.progressTop}>
                  <span>Progresso geral</span>
                  <strong>{destaque.progresso || 0}%</strong>
                </div>

                <div style={s.progressTrack}>
                  <div style={{ ...s.progressFill, width: `${destaque.progresso || 0}%` }} />
                </div>
              </div>

              <div style={s.infoRow}>
                <Info label="Status" value={destaque.status || '-'} />
                <Info label="Previsao" value={formatDate(destaque.data_previsao)} />
                <Info label="Cidade" value={destaque.cidade || '-'} />
              </div>
            </>
          ) : (
            <p>Nenhuma obra cadastrada.</p>
          )}
        </section>

        <section style={s.sideCard}>
          <div style={s.sectionLabel}>Agenda de hoje</div>
          <MiniItem hora="08:00" titulo="Residencia Gustavo" texto="Montagem e conferencia" />
          <MiniItem hora="10:30" titulo="Equipe em campo" texto="Check-ins aguardando validacao" />
          <MiniItem hora="14:00" titulo="Pos-venda" texto="Atualizacao para cliente" />
        </section>
      </div>

      <section style={s.tableCard}>
        <div style={s.tableHeader}>
          <div>
            <div style={s.sectionLabel}>Operacao</div>
            <h2 style={s.tableTitle}>Obras em andamento</h2>
          </div>
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
            {obras.map(obra => (
              <tr key={obra.id}>
                <td>{obra.nome}</td>
                <td>{obra.cliente_nome}</td>
                <td><span style={s.badge}>{obra.status}</span></td>
                <td>{obra.progresso}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Layout>
  )
}

function Info({ label, value }) {
  return (
    <div>
      <div style={s.infoLabel}>{label}</div>
      <div style={s.infoValue}>{value}</div>
    </div>
  )
}

function MiniItem({ hora, titulo, texto }) {
  return (
    <div style={s.miniItem}>
      <div style={s.time}>{hora}</div>
      <div>
        <strong>{titulo}</strong>
        <p>{texto}</p>
      </div>
    </div>
  )
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('pt-BR')
}

const s = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 34
  },
  eyebrow: {
    color: '#B89B68',
    textTransform: 'uppercase',
    letterSpacing: 3,
    fontSize: 12,
    marginBottom: 8
  },
  title: {
    fontSize: 42,
    margin: 0,
    color: '#2B2B2B',
    letterSpacing: -1
  },
  subtitle: {
    marginTop: 10,
    color: '#706A62',
    fontSize: 15
  },
  button: {
    background: '#2B2B2B',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    padding: '14px 22px',
    cursor: 'pointer'
  },
  kpis: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4,1fr)',
    gap: 20,
    marginBottom: 26
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: 24,
    marginBottom: 26
  },
  highlightCard: {
    background: '#fff',
    borderRadius: 24,
    padding: 30,
    border: '1px solid #EEE7DA',
    boxShadow: '0 18px 45px rgba(43,43,43,0.07)'
  },
  sideCard: {
    background: '#fff',
    borderRadius: 24,
    padding: 26,
    border: '1px solid #EEE7DA',
    boxShadow: '0 18px 45px rgba(43,43,43,0.07)'
  },
  sectionLabel: {
    color: '#B89B68',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 11,
    marginBottom: 12
  },
  obraTitle: {
    fontSize: 30,
    margin: 0,
    color: '#2B2B2B'
  },
  client: {
    color: '#706A62',
    marginTop: 8
  },
  progressBox: {
    marginTop: 24
  },
  progressTop: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 10,
    color: '#2B2B2B'
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    background: '#EFE8DA',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    background: '#B89B68',
    borderRadius: 999
  },
  infoRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3,1fr)',
    gap: 18,
    marginTop: 26
  },
  infoLabel: {
    fontSize: 11,
    color: '#9C8B6A',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  infoValue: {
    marginTop: 6,
    color: '#2B2B2B',
    fontWeight: 600
  },
  miniItem: {
    display: 'grid',
    gridTemplateColumns: '56px 1fr',
    gap: 14,
    padding: '14px 0',
    borderBottom: '1px solid #EFE8DA'
  },
  time: {
    color: '#B89B68',
    fontWeight: 700
  },
  tableCard: {
    background: '#fff',
    borderRadius: 24,
    padding: 28,
    border: '1px solid #EEE7DA',
    boxShadow: '0 18px 45px rgba(43,43,43,0.07)'
  },
  tableHeader: {
    marginBottom: 18
  },
  tableTitle: {
    margin: 0,
    color: '#2B2B2B'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  badge: {
    background: '#F1E7D6',
    color: '#7A5D2E',
    padding: '7px 12px',
    borderRadius: 999,
    fontSize: 13
  }
}