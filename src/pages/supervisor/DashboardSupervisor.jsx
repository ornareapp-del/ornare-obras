import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'

const ST_TAREFA = {
  pendente:     { label: 'Pendente',     color: '#b09a7a' },
  em_andamento: { label: 'Em andamento', color: '#4a90d9' },
  concluida:    { label: 'Concluida',    color: '#5aab6e' },
  bloqueada:    { label: 'Bloqueada',    color: '#d94a4a' },
}

const ST_OBRA = {
  'Em montagem':       { bg: '#EFF4FA', color: '#1E3A5F', dot: '#2563EB' },
  'Montagem agendada': { bg: '#E3F2FD', color: '#1565C0', dot: '#1565C0' },
  'Concluida':         { bg: '#E8F5E9', color: '#2E7D32', dot: '#2E7D32' },
  'Pausada':           { bg: '#FFF3E0', color: '#E65100', dot: '#F57C00' },
  'Em producao':       { bg: '#EFF4FA', color: '#1E3A5F', dot: '#1E3A5F' },
}
function getStObra(s) {
  return ST_OBRA[s] || { bg: '#F5F5F5', color: '#616161', dot: '#9E9E9E' }
}

// saude da obra para semaforo
function saude(obra) {
  const hoje = new Date()
  const prev = obra.data_previsao ? new Date(obra.data_previsao + 'T00:00:00') : null
  if (prev && prev < hoje)          return { cor: '#B84040', label: 'Atrasada' }
  if (prev) {
    const dias = (prev - hoje) / 86400000
    if (dias <= 7)                  return { cor: '#C8A86A', label: 'Atencao' }
  }
  return { cor: '#2D7A4A', label: 'No prazo' }
}

export default function DashboardSupervisor() {
  const navigate  = useNavigate()
  const { profile } = useStore()

  const [obras,       setObras]       = useState([])
  const [tarefas,     setTarefas]     = useState([])
  const [ocorrencias, setOcorrencias] = useState([])
  const [checkins,    setCheckins]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [abaAtiva,    setAbaAtiva]    = useState('obras')

  useEffect(() => { if (profile?.id) carregar() }, [profile])

  async function carregar() {
    // busca ids das obras deste supervisor
    const { data: minhasObras } = await supabase
      .from('obras').select('id').eq('supervisor_id', profile.id)
    const obraIds = (minhasObras || []).map(o => o.id)

    const [
      { data: o },
      { data: t },
      { data: oc },
      { data: ci },
    ] = await Promise.all([
      supabase.from('obras')
        .select('*')
        .eq('supervisor_id', profile.id)
        .order('created_at', { ascending: false }),
      obraIds.length
        ? supabase.from('tarefas')
            .select('*, obras(nome), responsavel:profiles!tarefas_responsavel_id_fkey(full_name)')
            .in('obra_id', obraIds)
            .neq('status', 'concluida')
            .order('prazo', { ascending: true })
        : { data: [] },
      obraIds.length
        ? supabase.from('ocorrencias')
            .select('*, obras(nome)')
            .in('obra_id', obraIds)
            .eq('status', 'Aberta')
            .order('created_at', { ascending: false })
        : { data: [] },
      supabase.from('checkins')
        .select('*, profiles(full_name), obras(nome)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    setObras(o       || [])
    setTarefas(t     || [])
    setOcorrencias(oc || [])
    setCheckins(ci   || [])
    setLoading(false)
  }

  async function mudarStatusTarefa(id, status) {
    await supabase.from('tarefas').update({ status }).eq('id', id)
    carregar()
  }

  const emMontagem = obras.filter(o => o.status === 'Em montagem').length
  const ocAbertas  = ocorrencias.length
  const tAtrasadas = tarefas.filter(t => t.prazo && new Date(t.prazo + 'T00:00:00') < new Date()).length

  // ultimo checkin
  const emServico  = checkins.some(c => !c.saida)
  const ultimoCI   = checkins[0]

  const ABAS = [
    { id: 'obras',       label: 'Obras',       count: obras.length       },
    { id: 'tarefas',     label: 'Tarefas',     count: tarefas.length     },
    { id: 'ocorrencias', label: 'Ocorrencias', count: ocAbertas          },
  ]

  const kpis = [
    { label: 'Minhas obras',    value: obras.length, sub: 'sob responsabilidade', cor: '#C8A86A' },
    { label: 'Em montagem',     value: emMontagem,   sub: 'operacao ativa',       cor: '#3a5580' },
    { label: 'Tarefas abertas', value: tarefas.length, sub: tAtrasadas > 0 ? tAtrasadas + ' atrasadas' : 'em andamento', cor: tAtrasadas > 0 ? '#B84040' : '#C8A86A' },
    { label: 'Ocorrencias',     value: ocAbertas,    sub: 'abertas',              cor: ocAbertas > 0 ? '#B84040' : '#2D7A4A' },
  ]

  return (
    <div style={s.page}>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div style={s.header}>
        <div>
          <div style={s.breadcrumb}>Supervisor</div>
          <h1 style={s.title}>
            Ola, {profile?.full_name?.split(' ')[0] || 'Supervisor'}
          </h1>
          <p style={s.sub}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {/* status check-in */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ ...s.checkinChip, background: emServico ? '#edf7f0' : '#f5f5f5', color: emServico ? '#2D7A4A' : '#aaa', border: '1px solid ' + (emServico ? '#5aab6e44' : '#ddd') }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: emServico ? '#2D7A4A' : '#ccc' }} />
            {emServico ? 'Em servico' : 'Fora de servico'}
            {ultimoCI && (
              <span style={{ fontSize: 10, color: '#aaa' }}>
                · {new Date(ultimoCI.entrada || ultimoCI.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <button style={s.btnNew} onClick={() => navigate('/obras/nova')}>
            + Nova Obra
          </button>
        </div>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────────── */}
      <div style={s.kpiGrid}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...s.kpiCard, borderTop: '3px solid ' + k.cor }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: k.cor, textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontSize: 38, fontWeight: 700, color: 'var(--color-ink)', lineHeight: 1, marginBottom: 4 }}>
              {loading ? '—' : k.value}
            </div>
            <div style={{ fontSize: 11, color: k.cor === '#B84040' && k.value > 0 ? '#B84040' : '#aaa' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── ABAS ────────────────────────────────────────────────────────────── */}
      <div style={s.tabs}>
        {ABAS.map(a => (
          <button key={a.id} onClick={() => setAbaAtiva(a.id)} style={{
            ...s.tab,
            color:        abaAtiva === a.id ? 'var(--color-gold)' : 'var(--color-ink-muted)',
            borderBottom: abaAtiva === a.id ? '2px solid var(--color-gold)' : '2px solid transparent',
            fontWeight:   abaAtiva === a.id ? 600 : 400,
          }}>
            {a.label}
            {a.count > 0 && (
              <span style={{ marginLeft: 6, background: abaAtiva === a.id ? 'var(--color-gold)' : '#e8e4de', color: abaAtiva === a.id ? '#fff' : '#888', borderRadius: 20, fontSize: 10, fontWeight: 700, padding: '1px 7px' }}>
                {a.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={s.empty}>Carregando...</div>
      ) : (
        <div>

          {/* ── ABA OBRAS ───────────────────────────────────────────────────── */}
          {abaAtiva === 'obras' && (
            <div style={s.list}>
              {obras.length === 0 ? (
                <div style={s.emptyBox}>
                  <div style={s.emptyIcon}>🏗️</div>
                  <div style={s.emptyTitle}>Nenhuma obra atribuida</div>
                  <div style={s.emptySub}>Obras onde voce e supervisor aparecerao aqui</div>
                </div>
              ) : obras.map(obra => {
                const st  = getStObra(obra.status)
                const sd  = saude(obra)
                return (
                  <div key={obra.id} onClick={() => navigate('/obras/' + obra.id)} style={s.obraCard}>
                    {/* semaforo */}
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: sd.cor, flexShrink: 0, boxShadow: '0 0 0 3px ' + sd.cor + '28' }} title={sd.label} />
                    <div style={s.obraInfo}>
                      <div style={s.obraName}>{obra.nome}</div>
                      <div style={s.obraMeta}>
                        {obra.cliente_nome}
                        {obra.cidade         ? ' · ' + obra.cidade : ''}
                        {obra.data_previsao  ? ' · Prev: ' + new Date(obra.data_previsao + 'T00:00:00').toLocaleDateString('pt-BR') : ''}
                      </div>
                      {obra.progresso > 0 && (
                        <div style={s.progressWrap}>
                          <div style={{ ...s.progressFill, width: obra.progresso + '%', background: sd.cor }} />
                        </div>
                      )}
                    </div>
                    <div style={s.obraRight}>
                      <span style={{ ...s.badge, background: st.bg, color: st.color }}>{obra.status}</span>
                      <div style={{ fontSize: 11, color: '#aaa' }}>{obra.progresso || 0}%</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── ABA TAREFAS ─────────────────────────────────────────────────── */}
          {abaAtiva === 'tarefas' && (
            <div style={s.list}>
              {tarefas.length === 0 ? (
                <div style={s.emptyBox}>
                  <div style={s.emptyIcon}>✅</div>
                  <div style={s.emptyTitle}>Nenhuma tarefa pendente</div>
                  <div style={s.emptySub}>Todas as tarefas estao concluidas</div>
                </div>
              ) : tarefas.map(t => {
                const st      = ST_TAREFA[t.status] || ST_TAREFA.pendente
                const atrasada = t.prazo && new Date(t.prazo + 'T00:00:00') < new Date()
                return (
                  <div key={t.id} style={{ ...s.tarefaCard, borderLeftColor: atrasada ? '#B84040' : st.color }}>
                    <div style={s.tarefaInfo}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={s.tarefaTitulo}>{t.titulo}</div>
                        {atrasada && (
                          <span style={{ fontSize: 10, background: '#fdecea', color: '#B84040', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>Atrasada</span>
                        )}
                      </div>
                      <div style={s.tarefaMeta}>
                        {t.obras?.nome               && <span>📍 {t.obras.nome}</span>}
                        {t.responsavel?.full_name     && <span>👤 {t.responsavel.full_name}</span>}
                        {t.prazo                     && <span>📅 {new Date(t.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                      </div>
                    </div>
                    <select
                      value={t.status}
                      onChange={e => { e.stopPropagation(); mudarStatusTarefa(t.id, e.target.value) }}
                      style={{ ...s.statusSelect, color: st.color }}>
                      {Object.entries(ST_TAREFA).map(([v, { label }]) => (
                        <option key={v} value={v}>{label}</option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── ABA OCORRENCIAS ─────────────────────────────────────────────── */}
          {abaAtiva === 'ocorrencias' && (
            <div style={s.list}>
              {ocorrencias.length === 0 ? (
                <div style={s.emptyBox}>
                  <div style={s.emptyIcon}>✅</div>
                  <div style={s.emptyTitle}>Nenhuma ocorrencia aberta</div>
                  <div style={s.emptySub}>Todas as ocorrencias foram resolvidas</div>
                </div>
              ) : ocorrencias.map(oc => {
                const corGrav = oc.gravidade === 'alta' ? '#B84040' : oc.gravidade === 'media' ? '#C8A86A' : '#2D7A4A'
                return (
                  <div key={oc.id} style={{ ...s.ocCard, borderLeftColor: corGrav }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={s.ocTitulo}>{oc.titulo}</div>
                      <span style={{ fontSize: 10, background: corGrav + '18', color: corGrav, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
                        {oc.gravidade}
                      </span>
                    </div>
                    <div style={s.ocMeta}>
                      {oc.tipo        && <span>{oc.tipo}</span>}
                      {oc.obras?.nome && <span>📍 {oc.obras.nome}</span>}
                      {oc.prazo       && <span>📅 {new Date(oc.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const s = {
  page:         { padding: '32px 40px', maxWidth: 1000, margin: '0 auto' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  breadcrumb:   { fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 6 },
  title:        { fontFamily: 'var(--font-serif)', fontSize: 36, fontWeight: 500, color: 'var(--color-ink)', margin: 0 },
  sub:          { fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 4 },
  btnNew:       { background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  checkinChip:  { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, borderRadius: 20, padding: '5px 12px' },
  kpiGrid:      { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 },
  kpiCard:      { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '18px 20px' },
  tabs:         { display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: 20 },
  tab:          { background: 'none', border: 'none', cursor: 'pointer', padding: '12px 20px', fontSize: 13, whiteSpace: 'nowrap', marginBottom: -1, fontFamily: 'inherit', display: 'flex', alignItems: 'center' },
  list:         { display: 'flex', flexDirection: 'column', gap: 10 },
  obraCard:     { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'border-color .15s' },
  obraInfo:     { flex: 1, minWidth: 0 },
  obraName:     { fontSize: 14, fontWeight: 600, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  obraMeta:     { fontSize: 11, color: '#aaa', marginTop: 2 },
  progressWrap: { height: 3, background: 'var(--color-border)', borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 2, transition: 'width .3s' },
  obraRight:    { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  badge:        { fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 500, whiteSpace: 'nowrap' },
  tarefaCard:   { background: '#fff', border: '1px solid var(--color-border)', borderLeft: '4px solid', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 },
  tarefaInfo:   { flex: 1, minWidth: 0 },
  tarefaTitulo: { fontSize: 14, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 4 },
  tarefaMeta:   { display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: '#aaa' },
  statusSelect: { fontSize: 12, padding: '5px 10px', borderRadius: 20, border: '1px solid var(--color-border)', background: '#fafaf8', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  ocCard:       { background: '#fff', border: '1px solid var(--color-border)', borderLeft: '4px solid', borderRadius: 10, padding: '14px 18px' },
  ocTitulo:     { fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' },
  ocMeta:       { display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: '#aaa' },
  empty:        { textAlign: 'center', padding: '40px 0', color: '#bbb' },
  emptyBox:     { textAlign: 'center', padding: '60px 20px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12 },
  emptyIcon:    { fontSize: 40, marginBottom: 12 },
  emptyTitle:   { fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 6 },
  emptySub:     { fontSize: 13, color: '#aaa' },
}
