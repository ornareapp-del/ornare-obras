import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const ST = {
  'Em montagem':        { label: 'Em montagem',        bg: '#EFF4FA', color: '#1E3A5F', dot: '#2563EB' },
  'Aguardando montagem':{ label: 'Ag. montagem',        bg: '#FFF3E0', color: '#E65100', dot: '#F57C00' },
  'Montagem agendada':  { label: 'Mont. agendada',      bg: '#E3F2FD', color: '#1565C0', dot: '#1565C0' },
  'Vistoria final':     { label: 'Vistoria final',      bg: '#F3E5F5', color: '#6A1B9A', dot: '#9C27B0' },
  'Concluída':          { label: 'Concluída',           bg: '#E8F5E9', color: '#2E7D32', dot: '#2E7D32' },
  'Pausada':            { label: 'Pausada',             bg: '#FFF3E0', color: '#E65100', dot: '#F57C00' },
  'Cancelada':          { label: 'Cancelada',           bg: '#FFEBEE', color: '#C62828', dot: '#C62828' },
  'Aguardando início':  { label: 'Ag. início',          bg: '#F5F5F5', color: '#616161', dot: '#9E9E9E' },
  'Em produção':        { label: 'Em produção',         bg: '#EFF4FA', color: '#1E3A5F', dot: '#1E3A5F' },
}

function getStatus(s) { return ST[s] || { label: s || '—', bg: '#F5F5F5', color: '#666', dot: '#ccc' } }

export default function DashboardGestao() {
  const navigate = useNavigate()
  const [obras, setObras] = useState([])
  const [agenda, setAgenda] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const [{ data: o }, { data: a }] = await Promise.all([
      supabase.from('obras').select('*').order('created_at', { ascending: false }),
      supabase.from('agenda').select('*, obras(nome)').order('data').order('hora_inicio').limit(6),
    ])
    setObras(o || [])
    setAgenda(a || [])
    setLoading(false)
  }

  const ativas    = obras.filter(o => ['Em montagem','Em produção','Montagem agendada','Em medição'].includes(o.status)).length
  const montagem  = obras.filter(o => o.status === 'Em montagem').length
  const pendentes = obras.filter(o => ['Pausada','Aguardando início','Aguardando montagem'].includes(o.status)).length
  const concluidas = obras.filter(o => o.status === 'Concluída').length

  const hoje = new Date().toISOString().split('T')[0]
  const agendaHoje = agenda.filter(a => a.data === hoje)

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1280, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: 26, fontWeight: 500, color: 'var(--ink)', margin: 0 }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button onClick={() => navigate('/obras/nova')} style={{
          background: 'var(--blue)', color: '#fff', border: 'none',
          borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 500,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          + Nova Obra
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Obras Ativas',  value: ativas,     sub: 'Em acompanhamento', color: 'var(--blue)' },
          { label: 'Em Montagem',   value: montagem,   sub: 'Operação ativa',    color: '#2563EB' },
          { label: 'Pendências',    value: pendentes,  sub: 'Aguardando ação',   color: 'var(--orange)' },
          { label: 'Concluídas',    value: concluidas, sub: 'Entregues',         color: 'var(--green)' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', borderTop: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 500, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.label}</div>
            <div style={{ fontSize: 36, fontWeight: 600, color: 'var(--ink)', lineHeight: 1 }}>{loading ? '—' : k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 6 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>

        {/* Obras */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Obras recentes</div>
            <button onClick={() => navigate('/obras')} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--blue)', cursor: 'pointer', fontWeight: 500 }}>Ver todas →</button>
          </div>
          {loading ? <div style={{ color: 'var(--ink-4)', fontSize: 13 }}>Carregando...</div>
            : obras.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--ink-4)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🏗</div>
                <div style={{ fontSize: 13 }}>Nenhuma obra cadastrada.</div>
                <button onClick={() => navigate('/obras/nova')} style={{ marginTop: 12, background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 18px', fontSize: 12, cursor: 'pointer' }}>Criar primeira obra</button>
              </div>
            ) : obras.slice(0,6).map(obra => {
              const st = getStatus(obra.status)
              return (
                <div key={obra.id} onClick={() => navigate(`/obras/${obra.id}`)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 0', borderBottom: '1px solid var(--border-light)', cursor: 'pointer',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--border-light)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{obra.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>{obra.cliente_nome}{obra.cidade ? ` · ${obra.cidade}` : ''}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {obra.progresso > 0 && (
                      <div style={{ width: 60, height: 4, background: 'var(--border)', borderRadius: 2 }}>
                        <div style={{ height: 4, background: 'var(--blue)', borderRadius: 2, width: `${obra.progresso}%` }} />
                      </div>
                    )}
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: st.bg, color: st.color, fontWeight: 500, whiteSpace: 'nowrap' }}>{st.label}</span>
                  </div>
                </div>
              )
            })
          }
        </div>

        {/* Agenda */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Agenda de hoje</div>
            <button onClick={() => navigate('/agenda')} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--blue)', cursor: 'pointer', fontWeight: 500 }}>Ver agenda →</button>
          </div>
          {loading ? <div style={{ color: 'var(--ink-4)', fontSize: 13 }}>Carregando...</div>
            : agendaHoje.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--ink-4)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📅</div>
                <div style={{ fontSize: 13 }}>Nenhum compromisso hoje.</div>
              </div>
            ) : agendaHoje.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < agendaHoje.length-1 ? '1px solid var(--border-light)' : 'none' }}>
                <div style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 600, minWidth: 42, paddingTop: 2 }}>
                  {item.hora_inicio ? String(item.hora_inicio).slice(0,5) : '—'}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{item.titulo}</div>
                  {item.obras?.nome && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>📍 {item.obras.nome}</div>}
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}