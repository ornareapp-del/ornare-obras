import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'

// ─── STATUS MAP ───────────────────────────────────────────────────────────────
const ST = {
  'Em montagem':         { label: 'Em montagem',    bg: '#EFF4FA', color: '#1E3A5F', dot: '#2563EB' },
  'Aguardando montagem': { label: 'Ag. montagem',   bg: '#FFF3E0', color: '#E65100', dot: '#F57C00' },
  'Montagem agendada':   { label: 'Mont. agendada', bg: '#E3F2FD', color: '#1565C0', dot: '#1565C0' },
  'Vistoria final':      { label: 'Vistoria final', bg: '#F3E5F5', color: '#6A1B9A', dot: '#9C27B0' },
  'Concluida':           { label: 'Concluida',      bg: '#E8F5E9', color: '#2E7D32', dot: '#2E7D32' },
  'Pausada':             { label: 'Pausada',         bg: '#FFF3E0', color: '#E65100', dot: '#F57C00' },
  'Cancelada':           { label: 'Cancelada',       bg: '#FFEBEE', color: '#C62828', dot: '#C62828' },
  'Aguardando inicio':   { label: 'Ag. inicio',      bg: '#F5F5F5', color: '#616161', dot: '#9E9E9E' },
  'Em producao':         { label: 'Em producao',     bg: '#EFF4FA', color: '#1E3A5F', dot: '#1E3A5F' },
  'Em medicao':          { label: 'Em medicao',      bg: '#F3E5F5', color: '#6A1B9A', dot: '#9C27B0' },
}
function getStatus(s) {
  return ST[s] || { label: s || '—', bg: '#F5F5F5', color: '#666', dot: '#ccc' }
}

// ─── SEMAFORO DE SAUDE ────────────────────────────────────────────────────────
// verde = no prazo, amarelo = risco (previsao nos proximos 7 dias), vermelho = atrasada ou com ocorrencia critica
function saudeObra(obra, ocorrenciasIds) {
  const hoje = new Date()
  const previsao = obra.data_previsao ? new Date(obra.data_previsao + 'T00:00:00') : null
  const temOcorrenciaCritica = ocorrenciasIds.includes(obra.id)
  if (temOcorrenciaCritica) return { cor: '#B84040', label: 'Critica' }
  if (previsao && previsao < hoje) return { cor: '#B84040', label: 'Atrasada' }
  if (previsao) {
    const diff = (previsao - hoje) / (1000 * 60 * 60 * 24)
    if (diff <= 7) return { cor: '#C8A86A', label: 'Atencao' }
  }
  return { cor: '#2D7A4A', label: 'No prazo' }
}

// ─── COMPONENTE FEED ITEM ─────────────────────────────────────────────────────
function FeedItem({ icon, texto, sub, tempo }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--color-border)', alignItems: 'flex-start' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f5f2ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: 'var(--color-ink)', lineHeight: 1.4 }}>{texto}</div>
        {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 10, color: '#bbb', flexShrink: 0, paddingTop: 2 }}>{tempo}</div>
    </div>
  )
}

function tempoRelativo(iso) {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso)) / 1000
  if (diff < 60)   return 'agora'
  if (diff < 3600) return Math.floor(diff / 60) + 'min'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h'
  return Math.floor(diff / 86400) + 'd'
}

// ─── DASHBOARD GESTAO ─────────────────────────────────────────────────────────
export default function DashboardGestao() {
  const navigate = useNavigate()
  const { profile } = useStore()
  const [obras,       setObras]       = useState([])
  const [agenda,      setAgenda]      = useState([])
  const [ocorrencias, setOcorrencias] = useState([])
  const [checkins,    setCheckins]    = useState([])
  const [fotos,       setFotos]       = useState([])
  const [gastos,      setGastos]      = useState([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const [
      { data: o },
      { data: a },
      { data: oc },
      { data: ci },
      { data: ft },
      { data: gs },
    ] = await Promise.all([
      supabase.from('obras').select('*').order('created_at', { ascending: false }),
      supabase.from('agenda').select('*, obras(nome)').order('data').order('hora_inicio').limit(8),
      supabase.from('ocorrencias').select('*').eq('status', 'Aberta').order('created_at', { ascending: false }).limit(20),
      supabase.from('checkins').select('*, profiles(full_name), obras(nome)').order('created_at', { ascending: false }).limit(10),
      supabase.from('fotos').select('*, obras(nome)').order('created_at', { ascending: false }).limit(10),
      supabase.from('gastos').select('*, obras(nome)').order('created_at', { ascending: false }).limit(10),
    ])
    setObras(o    || [])
    setAgenda(a   || [])
    setOcorrencias(oc || [])
    setCheckins(ci  || [])
    setFotos(ft     || [])
    setGastos(gs    || [])
    setLoading(false)
  }

  // ── KPIs
  const ativas     = obras.filter(o => ['Em montagem', 'Em producao', 'Montagem agendada', 'Em medicao'].includes(o.status)).length
  const montagem   = obras.filter(o => o.status === 'Em montagem').length
  const pendentes  = obras.filter(o => ['Pausada', 'Aguardando inicio', 'Aguardando montagem'].includes(o.status)).length
  const concluidas = obras.filter(o => o.status === 'Concluida').length

  // ── Semaforo
  const obrasComOcCritica = [...new Set(ocorrencias.filter(oc => oc.gravidade === 'alta').map(oc => oc.obra_id))]

  // ── Agenda
  const hoje        = new Date().toISOString().split('T')[0]
  const agendaHoje  = agenda.filter(a => a.data === hoje)
  const agendaProx  = agenda.filter(a => a.data > hoje).slice(0, 3)

  // ── Ocorrencias criticas (max 5 para o painel)
  const ocCriticas = ocorrencias.filter(oc => oc.gravidade === 'alta').slice(0, 5)
  const ocOutras   = ocorrencias.filter(oc => oc.gravidade !== 'alta').slice(0, 3)

  // ── Feed de atividade — mescla checkins + fotos + gastos ordenados por data
  const feed = [
    ...checkins.map(c => ({
      tipo: 'checkin', icon: c.saida ? '🔴' : '🟢',
      texto: `${c.profiles?.full_name || 'Alguem'} fez ${c.saida ? 'check-out' : 'check-in'}`,
      sub: c.obras?.nome || '',
      ts: c.created_at,
    })),
    ...fotos.map(f => ({
      tipo: 'foto', icon: '📷',
      texto: `Nova foto enviada`,
      sub: f.obras?.nome || '',
      ts: f.created_at,
    })),
    ...gastos.map(g => ({
      tipo: 'gasto', icon: '💰',
      texto: `Gasto lancado: ${g.descricao}`,
      sub: g.obras?.nome || '',
      ts: g.created_at,
    })),
  ].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 8)

  // ── Gastos do mes
  const mesAtual = new Date().toISOString().slice(0, 7)
  const gastosMes = gastos.filter(g => g.created_at?.slice(0, 7) === mesAtual)
  const totalMes  = gastosMes.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0)

  // ── Obras com gasto acima de 80% do orcamento
  const obrasAlerta = obras.filter(o => {
    if (!o.gasto_meta || o.gasto_meta <= 0) return false
    const gasto = gastos.filter(g => g.obra_id === o.id).reduce((s, g) => s + (parseFloat(g.valor) || 0), 0)
    return gasto / o.gasto_meta >= 0.8
  })

  const kpis = [
    { label: 'Obras Ativas',  value: ativas,    sub: 'Em acompanhamento', cor: '#C8A86A' },
    { label: 'Em Montagem',   value: montagem,  sub: 'Operacao ativa',    cor: '#3a5580' },
    { label: 'Pendencias',    value: pendentes, sub: 'Aguardando acao',   cor: '#B84040' },
    { label: 'Concluidas',    value: concluidas,sub: 'Entregues',         cor: '#2D7A4A' },
  ]

  return (
    <div style={s.page}>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div style={s.header}>
        <div>
          <div style={s.breadcrumb}>Gestao</div>
          <h1 style={s.title}>Dashboard</h1>
          <p style={s.date}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button onClick={() => navigate('/obras/nova')} style={s.btnNew}>
          + Nova Obra
        </button>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────────── */}
      <div style={s.kpiGrid}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...s.kpiCard, borderTop: '3px solid ' + k.cor }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: k.cor, textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--color-ink)', lineHeight: 1, marginBottom: 4 }}>
              {loading ? '—' : k.value}
            </div>
            <div style={{ fontSize: 11, color: '#aaa' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── ALERTA ORCAMENTO ────────────────────────────────────────────────── */}
      {obrasAlerta.length > 0 && (
        <div style={s.alertaBanner}>
          <span style={{ fontSize: 14 }}>⚠️</span>
          <span style={{ flex: 1, fontSize: 13 }}>
            <strong>{obrasAlerta.length} obra{obrasAlerta.length > 1 ? 's' : ''}</strong> com gasto acima de 80% do orcamento:
            {' '}{obrasAlerta.map(o => o.nome).join(', ')}
          </span>
          <button onClick={() => navigate('/gastos')} style={s.alertaLink}>Ver gastos</button>
        </div>
      )}

      {/* ── GRID PRINCIPAL ──────────────────────────────────────────────────── */}
      <div style={s.grid}>

        {/* ── COLUNA ESQUERDA ── obras com semaforo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={s.card}>
            <div style={s.cardHeader}>
              <div style={s.cardTitle}>Obras — saude atual</div>
              <button onClick={() => navigate('/obras')} style={s.btnLink}>Ver todas →</button>
            </div>
            {loading ? (
              <div style={s.empty}>Carregando...</div>
            ) : obras.length === 0 ? (
              <div style={s.emptyBox}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🏗️</div>
                <div style={{ fontSize: 13, color: '#aaa', marginBottom: 12 }}>Nenhuma obra cadastrada</div>
                <button onClick={() => navigate('/obras/nova')} style={s.btnNew}>Criar primeira obra</button>
              </div>
            ) : obras.filter(o => o.status !== 'Concluida' && o.status !== 'Cancelada').slice(0, 8).map(obra => {
              const st    = getStatus(obra.status)
              const saude = saudeObra(obra, obrasComOcCritica)
              return (
                <div key={obra.id} onClick={() => navigate(`/obras/${obra.id}`)} style={s.obraRow}>
                  {/* semaforo */}
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: saude.cor, flexShrink: 0, boxShadow: '0 0 0 3px ' + saude.cor + '28' }} title={saude.label} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.obraName}>{obra.nome}</div>
                    <div style={s.obraMeta}>
                      {obra.cliente_nome}
                      {obra.cidade ? ' · ' + obra.cidade : ''}
                      {obra.data_previsao ? ' · Prev: ' + new Date(obra.data_previsao + 'T00:00:00').toLocaleDateString('pt-BR') : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {obra.progresso > 0 && (
                      <div style={{ width: 52, height: 4, background: 'var(--color-border)', borderRadius: 2 }}>
                        <div style={{ height: 4, background: saude.cor, borderRadius: 2, width: obra.progresso + '%' }} />
                      </div>
                    )}
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: st.bg, color: st.color, fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {st.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── GASTOS DO MES ── */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <div style={s.cardTitle}>Gastos do mes</div>
              <button onClick={() => navigate('/gastos')} style={s.btnLink}>Ver todos →</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 500, color: 'var(--color-ink)' }}>
                R$ {totalMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: 11, color: '#aaa' }}>{gastosMes.length} lancamento{gastosMes.length !== 1 ? 's' : ''}</span>
            </div>
            {gastos.slice(0, 4).map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-ink)' }}>{g.descricao}</div>
                  <div style={{ fontSize: 11, color: '#aaa' }}>{g.obras?.nome || 'Sem obra'}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>
                  R$ {parseFloat(g.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
            {gastos.length === 0 && <div style={s.empty}>Nenhum gasto registrado.</div>}
          </div>

        </div>

        {/* ── COLUNA DIREITA ── agenda + ocorrencias + feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Agenda */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <div style={s.cardTitle}>Agenda de hoje</div>
              <button onClick={() => navigate('/agenda')} style={s.btnLink}>Ver agenda →</button>
            </div>
            {loading ? (
              <div style={s.empty}>Carregando...</div>
            ) : agendaHoje.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 11, color: '#bbb', marginBottom: 10 }}>Nenhum compromisso hoje</div>
                <button onClick={() => navigate('/agenda')} style={{ ...s.btnNew, fontSize: 12, padding: '7px 14px' }}>+ Novo evento</button>
              </div>
            ) : agendaHoje.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: i < agendaHoje.length - 1 ? '1px solid var(--color-border)' : 'none', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 12, color: 'var(--color-gold)', fontWeight: 700, minWidth: 38, paddingTop: 1 }}>
                  {item.hora_inicio ? String(item.hora_inicio).slice(0, 5) : '—'}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-ink)' }}>{item.titulo}</div>
                  {item.obras?.nome && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>📍 {item.obras.nome}</div>}
                </div>
              </div>
            ))}
            {agendaProx.length > 0 && (
              <>
                <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: '#bbb', margin: '12px 0 8px' }}>Proximos</div>
                {agendaProx.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '7px 0', opacity: 0.6, alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-gold)', fontWeight: 600, minWidth: 38 }}>
                      {new Date(item.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-ink)' }}>{item.titulo}</div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Ocorrencias */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <div style={s.cardTitle}>Ocorrencias abertas</div>
              <button onClick={() => navigate('/ocorrencias')} style={s.btnLink}>Ver todas →</button>
            </div>
            {loading ? (
              <div style={s.empty}>Carregando...</div>
            ) : ocorrencias.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: '#bbb' }}>Nenhuma ocorrencia aberta</div>
            ) : (
              <>
                {ocCriticas.map(oc => (
                  <div key={oc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#B84040', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{oc.titulo}</div>
                      <div style={{ fontSize: 11, color: '#aaa' }}>{oc.tipo} · Alta gravidade</div>
                    </div>
                  </div>
                ))}
                {ocOutras.map(oc => (
                  <div key={oc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-border)', opacity: 0.7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: oc.gravidade === 'media' ? '#C8A86A' : '#aaa', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{oc.titulo}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Feed de atividade */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <div style={s.cardTitle}>Atividade recente</div>
            </div>
            {loading ? (
              <div style={s.empty}>Carregando...</div>
            ) : feed.length === 0 ? (
              <div style={{ fontSize: 12, color: '#bbb', padding: '12px 0', textAlign: 'center' }}>Nenhuma atividade registrada.</div>
            ) : feed.map((item, i) => (
              <FeedItem key={i} icon={item.icon} texto={item.texto} sub={item.sub} tempo={tempoRelativo(item.ts)} />
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const s = {
  page:         { padding: '28px 36px', maxWidth: 1320, margin: '0 auto' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  breadcrumb:   { fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 6 },
  title:        { fontFamily: 'var(--font-serif)', fontSize: 36, fontWeight: 500, color: 'var(--color-ink)', margin: 0 },
  date:         { fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 4 },
  btnNew:       { background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  kpiGrid:      { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 },
  kpiCard:      { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '18px 20px' },
  alertaBanner: { display: 'flex', alignItems: 'center', gap: 12, background: '#fdf8f0', border: '1px solid #e8d9b8', borderLeft: '3px solid #C8A86A', borderRadius: 10, padding: '12px 16px', marginBottom: 20, flexWrap: 'wrap' },
  alertaLink:   { background: 'none', border: 'none', color: 'var(--color-gold)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  grid:         { display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 },
  card:         { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: '20px 22px' },
  cardHeader:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle:    { fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' },
  btnLink:      { background: 'none', border: 'none', fontSize: 12, color: 'var(--color-gold)', cursor: 'pointer', fontWeight: 500 },
  obraRow:      { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--color-border)', cursor: 'pointer' },
  obraName:     { fontSize: 13, fontWeight: 500, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  obraMeta:     { fontSize: 11, color: '#aaa', marginTop: 1 },
  empty:        { color: '#bbb', fontSize: 13, padding: '20px 0', textAlign: 'center' },
  emptyBox:     { textAlign: 'center', padding: '24px 0' },
}
