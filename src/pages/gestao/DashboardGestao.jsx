import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'

const ST = {
  'Em montagem':         { label: 'Em montagem',     bg: '#EFF4FA', color: '#1E3A5F', dot: '#2563EB' },
  'Aguardando montagem': { label: 'Ag. montagem',    bg: '#FFF3E0', color: '#E65100', dot: '#F57C00' },
  'Montagem agendada':   { label: 'Mont. agendada',  bg: '#E3F2FD', color: '#1565C0', dot: '#1565C0' },
  'Vistoria final':      { label: 'Vistoria final',  bg: '#F3E5F5', color: '#6A1B9A', dot: '#9C27B0' },
  'Concluída':           { label: 'Concluída',        bg: '#E8F5E9', color: '#2E7D32', dot: '#2E7D32' },
  'Pausada':             { label: 'Pausada',          bg: '#FFF3E0', color: '#E65100', dot: '#F57C00' },
  'Cancelada':           { label: 'Cancelada',        bg: '#FFEBEE', color: '#C62828', dot: '#C62828' },
  'Aguardando início':   { label: 'Ag. início',       bg: '#F5F5F5', color: '#616161', dot: '#9E9E9E' },
  'Em produção':         { label: 'Em produção',      bg: '#EFF4FA', color: '#1E3A5F', dot: '#1E3A5F' },
  'Em medição':          { label: 'Em medição',       bg: '#F3E5F5', color: '#6A1B9A', dot: '#9C27B0' },
}

function getStatus(s) {
  return ST[s] || { label: s || '—', bg: '#F5F5F5', color: '#666', dot: '#ccc' }
}

export default function DashboardGestao() {
  const navigate = useNavigate()
  const { profile } = useStore()
  const [obras, setObras] = useState([])
  const [agenda, setAgenda] = useState([])
  const [ocorrencias, setOcorrencias] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const [{ data: o }, { data: a }, { data: oc }] = await Promise.all([
      supabase.from('obras').select('*').order('created_at', { ascending: false }),
      supabase.from('agenda').select('*, obras(nome)').order('data').order('hora_inicio').limit(8),
      supabase.from('ocorrencias').select('*').eq('status', 'Aberta').order('created_at', { ascending: false }).limit(5),
    ])
    setObras(o || [])
    setAgenda(a || [])
    setOcorrencias(oc || [])
    setLoading(false)
  }

  const ativas    = obras.filter(o => ['Em montagem','Em produção','Montagem agendada','Em medição'].includes(o.status)).length
  const montagem  = obras.filter(o => o.status === 'Em montagem').length
  const pendentes = obras.filter(o => ['Pausada','Aguardando início','Aguardando montagem'].includes(o.status)).length
  const concluidas = obras.filter(o => o.status === 'Concluída').length

  const hoje = new Date().toISOString().split('T')[0]
  const agendaHoje = agenda.filter(a => a.data === hoje)
  const agendaProxima = agenda.filter(a => a.data > hoje).slice(0, 4)

  const kpis = [
    { label: 'Obras Ativas',  value: ativas,    sub: 'Em acompanhamento', color: '#2563EB', icon: '🏗️' },
    { label: 'Em Montagem',   value: montagem,  sub: 'Operação ativa',    color: '#7C3AED', icon: '🔧' },
    { label: 'Pendências',    value: pendentes, sub: 'Aguardando ação',   color: '#D97706', icon: '⏳' },
    { label: 'Concluídas',    value: concluidas,sub: 'Entregues',         color: '#059669', icon: '✅' },
  ]

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.breadcrumb}>Gestão</div>
          <h1 style={s.title}>Dashboard</h1>
          <p style={s.date}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button onClick={() => navigate('/obras/nova')} style={s.btnNew}>
          + Nova Obra
        </button>
      </div>

      {/* KPIs */}
      <div style={s.kpiGrid}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...s.kpiCard, borderTop: `3px solid ${k.color}` }}>
            <div style={s.kpiIcon}>{k.icon}</div>
            <div style={s.kpiLabel}>{k.label}</div>
            <div style={{ ...s.kpiValue, color: k.color }}>{loading ? '—' : k.value}</div>
            <div style={s.kpiSub}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={s.grid}>

        {/* Obras recentes */}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <div style={s.cardTitle}>Obras recentes</div>
            <button onClick={() => navigate('/obras')} style={s.btnLink}>Ver todas →</button>
          </div>
          {loading ? (
            <div style={s.empty}>Carregando...</div>
          ) : obras.length === 0 ? (
            <div style={s.emptyBox}>
              <div style={s.emptyIcon}>🏗️</div>
              <div style={s.emptyTitle}>Nenhuma obra cadastrada</div>
              <button onClick={() => navigate('/obras/nova')} style={s.btnNew}>Criar primeira obra</button>
            </div>
          ) : obras.slice(0, 7).map(obra => {
            const st = getStatus(obra.status)
            return (
              <div key={obra.id} onClick={() => navigate(`/obras/${obra.id}`)} style={s.obraRow}>
                <div style={{ ...s.obraDot, background: st.dot }} />
                <div style={s.obraInfo}>
                  <div style={s.obraName}>{obra.nome}</div>
                  <div style={s.obraMeta}>
                    {obra.cliente_nome}
                    {obra.cidade ? ` · ${obra.cidade}` : ''}
                    {obra.numero_contrato ? ` · Contrato ${obra.numero_contrato}` : ''}
                  </div>
                </div>
                <div style={s.obraRight}>
                  {obra.progresso > 0 && (
                    <div style={s.progressWrap}>
                      <div style={{ ...s.progressFill, width: `${obra.progresso}%` }} />
                    </div>
                  )}
                  <span style={{ ...s.badge, background: st.bg, color: st.color }}>{st.label}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Coluna direita */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Agenda hoje */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <div style={s.cardTitle}>Agenda de hoje</div>
              <button onClick={() => navigate('/agenda')} style={s.btnLink}>Ver agenda →</button>
            </div>
            {loading ? (
              <div style={s.empty}>Carregando...</div>
            ) : agendaHoje.length === 0 ? (
              <div style={s.emptyBox}>
                <div style={s.emptyIcon}>📅</div>
                <div style={s.emptyTitle}>Nenhum compromisso hoje</div>
                <button onClick={() => navigate('/agenda')} style={{ ...s.btnNew, fontSize: 12, padding: '7px 14px' }}>
                  + Novo evento
                </button>
              </div>
            ) : agendaHoje.map((item, i) => (
              <div key={i} style={{ ...s.agendaRow, borderBottom: i < agendaHoje.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <div style={s.agendaHora}>{item.hora_inicio ? String(item.hora_inicio).slice(0, 5) : '—'}</div>
                <div>
                  <div style={s.agendaTitulo}>{item.titulo}</div>
                  {item.obras?.nome && <div style={s.agendaMeta}>📍 {item.obras.nome}</div>}
                </div>
              </div>
            ))}
            {agendaProxima.length > 0 && (
              <>
                <div style={s.agendaSeparator}>Próximos</div>
                {agendaProxima.map((item, i) => (
                  <div key={i} style={{ ...s.agendaRow, opacity: 0.6 }}>
                    <div style={s.agendaHora}>{new Date(item.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</div>
                    <div style={s.agendaTitulo}>{item.titulo}</div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Ocorrências abertas */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <div style={s.cardTitle}>Ocorrências abertas</div>
              <button onClick={() => navigate('/ocorrencias')} style={s.btnLink}>Ver todas →</button>
            </div>
            {loading ? (
              <div style={s.empty}>Carregando...</div>
            ) : ocorrencias.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#bbb', fontSize: 13 }}>
                ✅ Nenhuma ocorrência aberta
              </div>
            ) : ocorrencias.map(oc => (
              <div key={oc.id} style={s.ocRow}>
                <div style={{ ...s.ocDot, background: oc.gravidade === 'alta' ? '#ef4444' : oc.gravidade === 'media' ? '#f59e0b' : '#10b981' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.ocTitulo}>{oc.titulo}</div>
                  <div style={s.ocMeta}>{oc.tipo} · {oc.gravidade}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}

const s = {
  page: { padding: '28px 36px', maxWidth: 1280, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  breadcrumb: { fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 6 },
  title: { fontFamily: 'var(--font-serif)', fontSize: 36, fontWeight: 500, color: 'var(--color-ink)', margin: 0 },
  date: { fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 4 },
  btnNew: { background: 'var(--color-blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 },
  kpiCard: { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '18px 20px', position: 'relative' },
  kpiIcon: { fontSize: 20, marginBottom: 8 },
  kpiLabel: { fontSize: 10, color: 'var(--color-ink-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  kpiValue: { fontSize: 38, fontWeight: 700, lineHeight: 1, marginBottom: 4 },
  kpiSub: { fontSize: 11, color: '#aaa' },
  grid: { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 },
  card: { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: '20px 22px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' },
  btnLink: { background: 'none', border: 'none', fontSize: 12, color: 'var(--color-blue)', cursor: 'pointer', fontWeight: 500 },
  obraRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--color-border)', cursor: 'pointer' },
  obraDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  obraInfo: { flex: 1, minWidth: 0 },
  obraName: { fontSize: 13, fontWeight: 500, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  obraMeta: { fontSize: 11, color: '#aaa', marginTop: 1 },
  obraRight: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  progressWrap: { width: 60, height: 4, background: 'var(--color-border)', borderRadius: 2 },
  progressFill: { height: 4, background: 'var(--color-blue)', borderRadius: 2 },
  badge: { fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 500, whiteSpace: 'nowrap' },
  agendaRow: { display: 'flex', gap: 12, padding: '10px 0', alignItems: 'flex-start' },
  agendaHora: { fontSize: 12, color: 'var(--color-blue)', fontWeight: 600, minWidth: 38, paddingTop: 1 },
  agendaTitulo: { fontSize: 13, fontWeight: 500, color: 'var(--color-ink)' },
  agendaMeta: { fontSize: 11, color: '#aaa', marginTop: 2 },
  agendaSeparator: { fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: '#bbb', margin: '12px 0 8px' },
  ocRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-border)' },
  ocDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  ocTitulo: { fontSize: 13, fontWeight: 500, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  ocMeta: { fontSize: 11, color: '#aaa', marginTop: 1 },
  empty: { color: '#bbb', fontSize: 13, padding: '20px 0', textAlign: 'center' },
  emptyBox: { textAlign: 'center', padding: '24px 0' },
  emptyIcon: { fontSize: 28, marginBottom: 8 },
  emptyTitle: { fontSize: 13, color: '#aaa', marginBottom: 12 },
}