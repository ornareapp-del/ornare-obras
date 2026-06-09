import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'

const ST = {
  pendente:     { label: 'Pendente',     color: '#b09a7a' },
  em_andamento: { label: 'Em andamento', color: '#4a90d9' },
  concluida:    { label: 'Concluída',    color: '#5aab6e' },
  bloqueada:    { label: 'Bloqueada',    color: '#d94a4a' },
}

const STATUS_OBRA = {
  'Em montagem':       { bg: '#EFF4FA', color: '#1E3A5F', dot: '#2563EB' },
  'Montagem agendada': { bg: '#E3F2FD', color: '#1565C0', dot: '#1565C0' },
  'Concluída':         { bg: '#E8F5E9', color: '#2E7D32', dot: '#2E7D32' },
  'Pausada':           { bg: '#FFF3E0', color: '#E65100', dot: '#F57C00' },
  'Com pendencias':    { bg: '#FFEBEE', color: '#C62828', dot: '#C62828' },
}

function getStatusObra(s) {
  return STATUS_OBRA[s] || { bg: '#F5F5F5', color: '#616161', dot: '#9E9E9E' }
}

export default function DashboardSupervisor() {
  const navigate = useNavigate()
  const { profile } = useStore()
  const [obras, setObras] = useState([])
  const [tarefas, setTarefas] = useState([])
  const [ocorrencias, setOcorrencias] = useState([])
  const [loading, setLoading] = useState(true)
  const [abaAtiva, setAbaAtiva] = useState('obras')

  useEffect(() => {
    if (profile?.id) carregar()
  }, [profile])

  async function carregar() {
    const [{ data: o }, { data: t }, { data: oc }] = await Promise.all([
      supabase.from('obras')
        .select('*')
        .eq('supervisor_id', profile.id)
        .order('created_at', { ascending: false }),
      supabase.from('tarefas')
        .select('*, obras(nome), responsavel:profiles!tarefas_responsavel_id_fkey(full_name)')
        .in('obra_id',
          (await supabase.from('obras').select('id').eq('supervisor_id', profile.id)).data?.map(o => o.id) || []
        )
        .neq('status', 'concluida')
        .order('prazo', { ascending: true }),
      supabase.from('ocorrencias')
        .select('*, obras(nome)')
        .eq('status', 'Aberta')
        .order('created_at', { ascending: false }),
    ])
    setObras(o || [])
    setTarefas(t || [])
    setOcorrencias(oc || [])
    setLoading(false)
  }

  async function mudarStatusTarefa(id, status) {
    await supabase.from('tarefas').update({ status }).eq('id', id)
    carregar()
  }

  const emMontagem = obras.filter(o => o.status === 'Em montagem').length
  const pendentes = tarefas.filter(t => t.status === 'pendente').length
  const ocAbertas = ocorrencias.length

  const ABAS = [
    { id: 'obras', label: 'Obras (' + obras.length + ')' },
    { id: 'tarefas', label: 'Tarefas (' + tarefas.length + ')' },
    { id: 'ocorrencias', label: 'Ocorrencias (' + ocAbertas + ')' },
  ]

  return (
    <div style={s.page}>

      <div style={s.header}>
        <div>
          <div style={s.breadcrumb}>Supervisor</div>
          <h1 style={s.title}>Ola, {profile?.full_name?.split(' ')[0] || 'Supervisor'}</h1>
          <p style={s.sub}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button style={s.btnNew} onClick={() => navigate('/obras/nova')}>
          + Nova Obra
        </button>
      </div>

      <div style={s.kpiGrid}>
        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>Minhas Obras</div>
          <div style={{ ...s.kpiValue, color: 'var(--color-blue)' }}>{obras.length}</div>
          <div style={s.kpiSub}>sob responsabilidade</div>
        </div>
        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>Em Montagem</div>
          <div style={{ ...s.kpiValue, color: '#7C3AED' }}>{emMontagem}</div>
          <div style={s.kpiSub}>operacao ativa</div>
        </div>
        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>Tarefas Abertas</div>
          <div style={{ ...s.kpiValue, color: '#D97706' }}>{pendentes}</div>
          <div style={s.kpiSub}>aguardando acao</div>
        </div>
        <div style={s.kpiCard}>
          <div style={s.kpiLabel}>Ocorrencias</div>
          <div style={{ ...s.kpiValue, color: '#DC2626' }}>{ocAbertas}</div>
          <div style={s.kpiSub}>abertas</div>
        </div>
      </div>

      <div style={s.tabs}>
        {ABAS.map(a => (
          <button key={a.id} onClick={() => setAbaAtiva(a.id)} style={{
            ...s.tab,
            color: abaAtiva === a.id ? 'var(--color-ink)' : 'var(--color-ink-muted)',
            borderBottom: abaAtiva === a.id ? '2px solid var(--color-blue)' : '2px solid transparent',
            fontWeight: abaAtiva === a.id ? 600 : 400,
          }}>
            {a.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={s.empty}>Carregando...</div>
      ) : (
        <div>

          {abaAtiva === 'obras' && (
            <div style={s.list}>
              {obras.length === 0 ? (
                <div style={s.emptyBox}>
                  <div style={s.emptyIcon}>🏗️</div>
                  <div style={s.emptyTitle}>Nenhuma obra atribuida</div>
                  <div style={s.emptySub}>Obras onde voce e supervisor aparecerao aqui</div>
                </div>
              ) : obras.map(obra => {
                const st = getStatusObra(obra.status)
                return (
                  <div key={obra.id} onClick={() => navigate('/obras/' + obra.id)} style={s.obraCard}>
                    <div style={{ ...s.obraDot, background: st.dot }} />
                    <div style={s.obraInfo}>
                      <div style={s.obraName}>{obra.nome}</div>
                      <div style={s.obraMeta}>
                        {obra.cliente_nome}
                        {obra.cidade ? ' · ' + obra.cidade : ''}
                        {obra.data_previsao ? ' · Prev: ' + new Date(obra.data_previsao + 'T00:00:00').toLocaleDateString('pt-BR') : ''}
                      </div>
                      {obra.progresso > 0 && (
                        <div style={s.progressWrap}>
                          <div style={{ ...s.progressFill, width: obra.progresso + '%' }} />
                        </div>
                      )}
                    </div>
                    <div style={s.obraRight}>
                      <span style={{ ...s.badge, background: st.bg, color: st.color }}>{obra.status}</span>
                      <div style={s.obraPct}>{obra.progresso || 0}%</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {abaAtiva === 'tarefas' && (
            <div style={s.list}>
              {tarefas.length === 0 ? (
                <div style={s.emptyBox}>
                  <div style={s.emptyIcon}>✅</div>
                  <div style={s.emptyTitle}>Nenhuma tarefa pendente</div>
                  <div style={s.emptySub}>Todas as tarefas estao concluidas</div>
                </div>
              ) : tarefas.map(t => {
                const st = ST[t.status] || ST.pendente
                return (
                  <div key={t.id} style={{ ...s.tarefaCard, borderLeftColor: st.color }}>
                    <div style={s.tarefaInfo}>
                      <div style={s.tarefaTitulo}>{t.titulo}</div>
                      <div style={s.tarefaMeta}>
                        {t.obras?.nome && <span>📍 {t.obras.nome}</span>}
                        {t.responsavel?.full_name && <span>👤 {t.responsavel.full_name}</span>}
                        {t.prazo && <span>📅 {new Date(t.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                      </div>
                    </div>
                    <select
                      value={t.status}
                      onChange={e => { e.stopPropagation(); mudarStatusTarefa(t.id, e.target.value) }}
                      style={{ ...s.statusSelect, color: st.color }}>
                      {Object.entries(ST).map(([v, { label }]) => (
                        <option key={v} value={v}>{label}</option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          )}

          {abaAtiva === 'ocorrencias' && (
            <div style={s.list}>
              {ocorrencias.length === 0 ? (
                <div style={s.emptyBox}>
                  <div style={s.emptyIcon}>✅</div>
                  <div style={s.emptyTitle}>Nenhuma ocorrencia aberta</div>
                </div>
              ) : ocorrencias.map(oc => (
                <div key={oc.id} style={{ ...s.ocCard, borderLeftColor: oc.gravidade === 'alta' ? '#ef4444' : oc.gravidade === 'media' ? '#f59e0b' : '#10b981' }}>
                  <div style={s.ocTitulo}>{oc.titulo}</div>
                  <div style={s.ocMeta}>
                    {oc.tipo && <span>{oc.tipo}</span>}
                    {oc.obras?.nome && <span>📍 {oc.obras.nome}</span>}
                    {oc.prazo && <span>📅 {new Date(oc.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  )
}

const s = {
  page: { padding: '32px 40px', maxWidth: 1000, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  breadcrumb: { fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 6 },
  title: { fontFamily: 'var(--font-serif)', fontSize: 36, fontWeight: 500, color: 'var(--color-ink)', margin: 0 },
  sub: { fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 4 },
  btnNew: { background: 'var(--color-blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 },
  kpiCard: { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '18px 20px' },
  kpiLabel: { fontSize: 10, color: 'var(--color-ink-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  kpiValue: { fontSize: 38, fontWeight: 700, lineHeight: 1, marginBottom: 4 },
  kpiSub: { fontSize: 11, color: '#aaa' },
  tabs: { display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: 20 },
  tab: { background: 'none', border: 'none', cursor: 'pointer', padding: '12px 20px', fontSize: 13, whiteSpace: 'nowrap', marginBottom: -1, fontFamily: 'inherit' },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  obraCard: { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' },
  obraDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  obraInfo: { flex: 1, minWidth: 0 },
  obraName: { fontSize: 14, fontWeight: 600, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  obraMeta: { fontSize: 11, color: '#aaa', marginTop: 2 },
  progressWrap: { height: 3, background: 'var(--color-border)', borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: 3, background: 'var(--color-blue)', borderRadius: 2 },
  obraRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  badge: { fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 500, whiteSpace: 'nowrap' },
  obraPct: { fontSize: 11, color: '#aaa' },
  tarefaCard: { background: '#fff', border: '1px solid var(--color-border)', borderLeft: '4px solid', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 },
  tarefaInfo: { flex: 1, minWidth: 0 },
  tarefaTitulo: { fontSize: 14, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 4 },
  tarefaMeta: { display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: '#aaa' },
  statusSelect: { fontSize: 12, padding: '5px 10px', borderRadius: 20, border: '1px solid var(--color-border)', background: '#fafaf8', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  ocCard: { background: '#fff', border: '1px solid var(--color-border)', borderLeft: '4px solid', borderRadius: 10, padding: '14px 18px' },
  ocTitulo: { fontSize: 14, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 4 },
  ocMeta: { display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: '#aaa' },
  empty: { textAlign: 'center', padding: '40px 0', color: '#bbb' },
  emptyBox: { textAlign: 'center', padding: '60px 20px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#aaa' },
}