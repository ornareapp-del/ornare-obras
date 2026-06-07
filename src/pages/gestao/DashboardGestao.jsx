import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function DashboardGestao() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ ativas: 0, montagem: 0, pendencias: 0, concluidas: 0 })
  const [obras, setObras] = useState([])
  const [agenda, setAgenda] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [{ data: todasObras }, { data: agendaHoje }] = await Promise.all([
      supabase.from('obras').select('*').order('created_at', { ascending: false }),
      supabase.from('agenda').select('*').order('hora_inicio', { ascending: true }).limit(5),
    ])

    if (todasObras) {
      setObras(todasObras.slice(0, 5))
      setStats({
        ativas: todasObras.filter(o => o.status === 'em_andamento').length,
        montagem: todasObras.filter(o => o.status === 'em_andamento').length,
        pendencias: todasObras.filter(o => o.status === 'pausada').length,
        concluidas: todasObras.filter(o => o.status === 'concluida').length,
      })
    }
    if (agendaHoje) setAgenda(agendaHoje)
    setLoading(false)
  }

  const statusMap = {
    em_andamento: { label: 'Em andamento', bg: '#edf7f0', color: '#3a7d4f', dot: '#5aab6e' },
    concluida: { label: 'Concluída', bg: '#edf7f0', color: '#3a6a3f', dot: '#4a9a5e' },
    pausada: { label: 'Pausada', bg: '#fdf3e3', color: '#a0692a', dot: '#d4a055' },
    cancelada: { label: 'Cancelada', bg: '#fdecea', color: '#a03030', dot: '#d45555' },
    planejamento: { label: 'Planejamento', bg: '#eef2f8', color: '#3a5580', dot: '#7090c0' },
  }

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 8 }}>
            Gestão Executiva
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 500, color: 'var(--color-ink)', lineHeight: 1.1, margin: 0 }}>
            Dashboard
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 6 }}>
            Obras, pendências e operação em campo
          </p>
        </div>
        <button
          onClick={() => navigate('/gestao/obras/nova')}
          style={{
            background: 'var(--color-ink)', color: 'var(--color-surface)',
            border: 'none', borderRadius: 'var(--radius-sm)',
            padding: '10px 22px', fontSize: 12.5, fontWeight: 500,
            letterSpacing: 0.5,
          }}
        >
          + Nova Obra
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Obras Ativas', value: stats.ativas, desc: 'Em acompanhamento' },
          { label: 'Em Montagem', value: stats.montagem, desc: 'Operação ativa' },
          { label: 'Pendências', value: stats.pendencias, desc: 'Aguardando ação' },
          { label: 'Concluídas', value: stats.concluidas, desc: 'Entregues' },
        ].map(k => (
          <div key={k.label} style={{
            background: 'var(--color-white)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', padding: '20px 22px',
          }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 12 }}>
              {k.label}
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 42, fontWeight: 500, color: 'var(--color-ink)', lineHeight: 1 }}>
              {loading ? '—' : k.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-ink-faint)', marginTop: 8 }}>{k.desc}</div>
          </div>
        ))}
      </div>

      {/* Linha inferior */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>

        {/* Obras recentes */}
        <div style={{ background: 'var(--color-white)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '22px 26px' }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 18 }}>
            Obras em Andamento
          </div>
          {loading ? (
            <div style={{ color: 'var(--color-ink-faint)', fontSize: 13, padding: '20px 0' }}>Carregando...</div>
          ) : obras.length === 0 ? (
            <div style={{ color: 'var(--color-ink-faint)', fontSize: 13, padding: '20px 0' }}>Nenhuma obra cadastrada.</div>
          ) : obras.map(obra => {
            const st = statusMap[obra.status] || statusMap.planejamento
            return (
              <div
                key={obra.id}
                onClick={() => navigate(`/gestao/obras/${obra.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 0', borderBottom: '1px solid var(--color-border-light)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {obra.nome}
                    </span>
                    <span style={{
                      fontSize: 10, padding: '2px 10px', borderRadius: 20, flexShrink: 0,
                      background: st.bg, color: st.color, fontWeight: 500,
                    }}>
                      {st.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-ink-muted)', marginTop: 2 }}>
                    {obra.cliente_nome}{obra.cidade ? ` · ${obra.cidade}` : ''}
                  </div>
                  {obra.progresso > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ height: 3, background: 'var(--color-border-light)', borderRadius: 2 }}>
                        <div style={{ height: 3, background: 'var(--color-gold)', borderRadius: 2, width: `${obra.progresso}%` }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--color-gold)', marginTop: 3 }}>{obra.progresso}%</div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Agenda */}
        <div style={{ background: 'var(--color-white)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '22px 26px' }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 18 }}>
            Agenda de Hoje
          </div>
          {loading ? (
            <div style={{ color: 'var(--color-ink-faint)', fontSize: 13 }}>Carregando...</div>
          ) : agenda.length === 0 ? (
            <div style={{ color: 'var(--color-ink-faint)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
              Nenhum compromisso hoje.
            </div>
          ) : agenda.map((item, i) => (
            <div key={i} style={{
              display: 'flex', gap: 16, padding: '11px 0',
              borderBottom: i < agenda.length - 1 ? '1px solid var(--color-border-light)' : 'none',
            }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--color-gold)', fontWeight: 500, minWidth: 48 }}>
                {item.hora_inicio ? item.hora_inicio.slice(0, 5) : '—'}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-ink)' }}>{item.titulo || item.descricao}</div>
                {item.titulo && item.descricao && (
                  <div style={{ fontSize: 11.5, color: 'var(--color-ink-muted)', marginTop: 2 }}>{item.descricao}</div>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}