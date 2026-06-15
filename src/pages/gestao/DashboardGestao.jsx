import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { EmptyState, KpiCard as DesignKpiCard, PremiumCard } from '../../components/DesignSystem'

const THEME = {
  bg: '#F6F3EE',
  card: '#FFFFFF',
  border: '#E7E0D5',
  ink: '#1D1C19',
  muted: '#6D675E',
  gold: '#B8965E',
  danger: '#B94A48',
  success: '#2F7D55',
  warn: '#B8872E',
}

const STATUS = {
  producao: ['Em producao', 'Em produção'],
  montagem: ['Em montagem', 'Montagem agendada'],
  aguardandoCliente: ['Aguardando cliente'],
  aguardandoProducao: ['Aguardando inicio', 'Em medicao', 'Em medição', 'Medicao agendada', 'Medição agendada', 'Projeto em conferencia', 'Projeto em conferência'],
  concluidas: ['Concluida', 'Concluída'],
  travadas: ['Pausada', 'Cancelada'],
  producaoFinalizada: ['Pronta para entrega'],
  aguardandoAgendamento: ['Aguardando montagem'],
}

function normalizar(v) {
  return (v || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function inStatus(obra, lista) {
  const atual = normalizar(obra.status)
  return lista.some(s => normalizar(s) === atual)
}

function dataBR(data) {
  if (!data) return '-'
  return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function moeda(valor) {
  return 'R$ ' + Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

function tempoRelativo(iso) {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso)) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return Math.floor(diff / 60) + 'min'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h'
  return Math.floor(diff / 86400) + 'd'
}

function statusBadge(status) {
  if (inStatus({ status }, STATUS.montagem)) return { bg: '#EFF4FA', color: '#1E3A5F', label: status || '-' }
  if (inStatus({ status }, STATUS.producao)) return { bg: '#F0F3EA', color: '#415B34', label: status || '-' }
  if (inStatus({ status }, STATUS.travadas)) return { bg: '#FDECEA', color: '#9E2F2F', label: status || '-' }
  if (inStatus({ status }, STATUS.concluidas)) return { bg: '#E8F5E9', color: '#2E7D32', label: status || '-' }
  return { bg: '#F5F1EA', color: THEME.muted, label: status || '-' }
}

export default function DashboardGestao() {
  const navigate = useNavigate()
  const [dados, setDados] = useState({
    obras: [],
    agenda: [],
    ocorrencias: [],
    checkins: [],
    fotos: [],
    gastos: [],
    tarefas: [],
    profiles: [],
    montadores: [],
    checklist: [],
  })
  const [loading, setLoading] = useState(true)

  async function carregar() {
    const [
      { data: obras },
      { data: agenda },
      { data: ocorrencias },
      { data: checkins },
      { data: fotos },
      { data: gastos },
      { data: tarefas },
      { data: profiles },
      { data: montadores },
      { data: checklist },
    ] = await Promise.all([
      supabase.from('obras').select('*').order('created_at', { ascending: false }),
      supabase.from('agenda').select('*, obras(nome)').order('data').order('hora_inicio').limit(80),
      supabase.from('ocorrencias').select('*').order('created_at', { ascending: false }).limit(120),
      supabase.from('checkins').select('*, profiles(full_name), obras(nome)').order('created_at', { ascending: false }).limit(20),
      supabase.from('fotos').select('*, obras(nome)').order('created_at', { ascending: false }).limit(80),
      supabase.from('gastos').select('*, obras(nome)').order('created_at', { ascending: false }).limit(200),
      supabase.from('tarefas').select('*').order('prazo', { ascending: true }).limit(200),
      supabase.from('profiles').select('id, full_name, email, role'),
      supabase.from('obra_montadores').select('obra_id, montador_id, montador:profiles!obra_montadores_montador_id_fkey(full_name)'),
      supabase.from('checklist_items').select('id, obra_id, descricao, concluido, concluido_em').limit(300),
    ])

    setDados({
      obras: obras || [],
      agenda: agenda || [],
      ocorrencias: ocorrencias || [],
      checkins: checkins || [],
      fotos: fotos || [],
      gastos: gastos || [],
      tarefas: tarefas || [],
      profiles: profiles || [],
      montadores: montadores || [],
      checklist: checklist || [],
    })
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [])

  const vm = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const agoraMs = hoje.getTime()
    const hojeStr = hoje.toISOString().split('T')[0]
    const em7 = new Date(hoje)
    em7.setDate(em7.getDate() + 7)
    const em7Str = em7.toISOString().split('T')[0]
    const mesAtual = hoje.toISOString().slice(0, 7)
    const ativos = dados.obras.filter(o => !inStatus(o, STATUS.concluidas) && !inStatus(o, STATUS.travadas))

    const ocorrenciasAbertas = dados.ocorrencias.filter(o => ['Aberta', 'aberta', 'Pendente', 'pendente'].includes(o.status || 'Aberta'))
    const ocorrPorObra = new Map()
    ocorrenciasAbertas.forEach(o => {
      if (!o.obra_id) return
      ocorrPorObra.set(o.obra_id, [...(ocorrPorObra.get(o.obra_id) || []), o])
    })

    const checklistPorObra = new Map()
    dados.checklist.forEach(i => {
      if (!i.obra_id) return
      checklistPorObra.set(i.obra_id, [...(checklistPorObra.get(i.obra_id) || []), i])
    })

    const fotosPorObra = new Map()
    dados.fotos.forEach(f => {
      if (!f.obra_id) return
      fotosPorObra.set(f.obra_id, [...(fotosPorObra.get(f.obra_id) || []), f])
    })

    const gastosPorObra = new Map()
    dados.gastos.forEach(g => {
      if (!g.obra_id) return
      gastosPorObra.set(g.obra_id, (gastosPorObra.get(g.obra_id) || 0) + (parseFloat(g.valor) || 0))
    })

    const tarefasAtrasadas = dados.tarefas.filter(t => t.prazo && t.prazo < hojeStr && t.status !== 'concluida')
    const agenda7 = dados.agenda.filter(a => a.data >= hojeStr && a.data <= em7Str)
    const tipoAgenda = termo => agenda7.filter(a => normalizar(a.tipo || a.titulo).includes(termo))
    const gastosMes = dados.gastos.filter(g => (g.data || g.created_at || '').slice(0, 7) === mesAtual)

    const saude = ativos.map(obra => {
      const previsao = obra.data_previsao ? new Date(obra.data_previsao + 'T00:00:00') : null
      const temOcAlta = (ocorrPorObra.get(obra.id) || []).some(o => ['alta', 'critica', 'crítica'].includes(normalizar(o.gravidade)))
      const atrasada = previsao && previsao < hoje
      const risco = temOcAlta || (previsao && (previsao - hoje) / 86400000 <= 7)
      return { obra, atrasada, risco }
    })

    const atencao = ativos.map(obra => {
      const motivos = []
      const itens = checklistPorObra.get(obra.id) || []
      const fotos = fotosPorObra.get(obra.id) || []
      const ultimaFoto = fotos[0]?.created_at ? new Date(fotos[0].created_at) : null
      const semFotoRecente = !ultimaFoto || (agoraMs - ultimaFoto.getTime()) / 86400000 > 7
      const previsao = obra.data_previsao ? new Date(obra.data_previsao + 'T00:00:00') : null
      if ((ocorrPorObra.get(obra.id) || []).length > 0) motivos.push('ocorrencia aberta')
      if (itens.some(i => !i.concluido)) motivos.push('checklist pendente')
      if (semFotoRecente) motivos.push('sem fotos recentes')
      if (previsao && previsao < hoje) motivos.push('atrasada')
      return { obra, motivos }
    }).filter(item => item.motivos.length > 0).slice(0, 7)

    const fluxo = [
      { label: 'Aguardando Produção', value: dados.obras.filter(o => inStatus(o, STATUS.aguardandoProducao)).length },
      { label: 'Em Produção', value: dados.obras.filter(o => inStatus(o, STATUS.producao)).length },
      { label: 'Produção Finalizada', value: dados.obras.filter(o => inStatus(o, STATUS.producaoFinalizada)).length },
      { label: 'Aguardando Agendamento', value: dados.obras.filter(o => inStatus(o, STATUS.aguardandoAgendamento)).length },
      { label: 'Em Montagem', value: dados.obras.filter(o => inStatus(o, STATUS.montagem)).length },
      { label: 'Concluída', value: dados.obras.filter(o => inStatus(o, STATUS.concluidas)).length },
    ]

    const obrasPorSupervisor = dados.profiles
      .filter(p => ['gestao', 'supervisor'].includes(p.role))
      .map(p => ({ nome: p.full_name || p.email || 'Supervisor', total: dados.obras.filter(o => o.supervisor_id === p.id).length }))
      .filter(p => p.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    const atividade = [
      ...dados.fotos.slice(0, 8).map(f => ({ tipo: 'Foto', texto: f.categoria || 'Nova foto enviada', sub: f.obras?.nome || obraNome(dados.obras, f.obra_id), ts: f.created_at })),
      ...dados.checklist.filter(i => i.concluido && i.concluido_em).slice(0, 8).map(i => ({ tipo: 'Checklist', texto: i.descricao || 'Item concluido', sub: obraNome(dados.obras, i.obra_id), ts: i.concluido_em })),
      ...dados.checkins.slice(0, 8).map(c => ({ tipo: 'Equipe', texto: `${c.profiles?.full_name || 'Equipe'} fez ${c.saida ? 'check-out' : 'check-in'}`, sub: c.obras?.nome || '', ts: c.created_at })),
      ...dados.gastos.slice(0, 8).map(g => ({ tipo: 'Gasto', texto: g.descricao || 'Gasto lancado', sub: `${g.obras?.nome || obraNome(dados.obras, g.obra_id)} - ${moeda(g.valor)}`, ts: g.created_at })),
    ].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 10)

    return {
      hojeStr,
      travadasLista: dados.obras
        .filter(o => inStatus(o, STATUS.travadas) || (ocorrPorObra.get(o.id) || []).some(oc => normalizar(oc.gravidade) === 'alta'))
        .slice(0, 4),
      riscoLista: saude.filter(s => s.atrasada || s.risco).map(s => s.obra).slice(0, 4),
      pendenciasCriticas: [
        ...ocorrenciasAbertas.slice(0, 3).map(o => ({ id: `oc-${o.id}`, tipo: 'Ocorrência aberta', titulo: o.titulo || o.descricao || 'Ocorrência sem título', obraId: o.obra_id, detalhe: obraNome(dados.obras, o.obra_id) })),
        ...tarefasAtrasadas.slice(0, 3).map(t => ({ id: `ta-${t.id}`, tipo: 'Tarefa atrasada', titulo: t.titulo || t.descricao || 'Tarefa atrasada', obraId: t.obra_id, detalhe: obraNome(dados.obras, t.obra_id) })),
      ].slice(0, 5),
      operacao: {
        producao: dados.obras.filter(o => inStatus(o, STATUS.producao)).length,
        montagem: dados.obras.filter(o => inStatus(o, STATUS.montagem)).length,
        aguardandoCliente: dados.obras.filter(o => inStatus(o, STATUS.aguardandoCliente)).length,
        aguardandoProducao: dados.obras.filter(o => inStatus(o, STATUS.aguardandoProducao)).length,
        concluidas: dados.obras.filter(o => inStatus(o, STATUS.concluidas)).length,
        travadas: dados.obras.filter(o => inStatus(o, STATUS.travadas) || (ocorrPorObra.get(o.id) || []).some(oc => normalizar(oc.gravidade) === 'alta')).length,
      },
      saude: {
        atrasadas: saude.filter(s => s.atrasada).length,
        risco: saude.filter(s => !s.atrasada && s.risco).length,
        prazo: saude.filter(s => !s.atrasada && !s.risco).length,
      },
      equipe: {
        supervisores: dados.profiles.filter(p => ['gestao', 'supervisor'].includes(p.role)).length,
        montadores: new Set(dados.montadores.map(m => m.montador_id)).size,
        obrasPorSupervisor,
      },
      agenda7: {
        montagens: tipoAgenda('montagem'),
        vistorias: tipoAgenda('vistoria'),
        assistencias: agenda7.filter(a => normalizar(a.tipo || a.titulo).includes('assistencia') || normalizar(a.tipo || a.titulo).includes('tecnica')),
      },
      pendencias: {
        ocorrenciasAbertas,
        naoConformidades: dados.fotos.filter(f => normalizar(f.categoria) === 'nao conformidade'),
        tarefasAtrasadas,
      },
      financeiro: {
        totalMes: gastosMes.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0),
        gastosMes,
        topObras: [...gastosPorObra.entries()].map(([obraId, total]) => ({ obraId, nome: obraNome(dados.obras, obraId), total })).sort((a, b) => b.total - a.total).slice(0, 5),
        acimaMeta: dados.obras.filter(o => o.gasto_meta && (gastosPorObra.get(o.id) || 0) > Number(o.gasto_meta)),
      },
      fluxo,
      atencao,
      atividade,
      obrasOperacionais: ativos.slice(0, 8),
      ocorrPorObra,
    }
  }, [dados])

  const kpis = [
    { label: 'Em Produção', value: vm.operacao.producao, sub: 'fábrica e preparação', tone: THEME.gold },
    { label: 'Em Montagem', value: vm.operacao.montagem, sub: 'campo ativo', tone: '#1E3A5F' },
    { label: 'Aguard. Cliente', value: vm.operacao.aguardandoCliente, sub: 'dependencia externa', tone: THEME.warn },
    { label: 'Aguard. Produção', value: vm.operacao.aguardandoProducao, sub: 'pré-operação', tone: '#6B5B43' },
    { label: 'Concluídas', value: vm.operacao.concluidas, sub: 'entregues', tone: THEME.success },
    { label: 'Travadas', value: vm.operacao.travadas, sub: 'acao imediata', tone: THEME.danger },
  ]

  return (
    <div className="dg-page">
      <style>{css}</style>

      <header className="dg-header">
        <div>
          <div className="dg-eyebrow">Gestão Ornare</div>
          <h1>Central de Gestão</h1>
          <p>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="dg-actions">
          <button onClick={() => navigate('/obras')}>Obras</button>
          <button onClick={() => navigate('/agenda')}>Agenda</button>
          <button onClick={() => navigate('/equipe')}>Equipe</button>
          <button className="primary" onClick={() => navigate('/obras/nova')}>Nova Obra</button>
        </div>
      </header>

      <section className="dg-priority-board">
        <Card title="Exigem atenção agora" action="Abrir obras" onAction={() => navigate('/obras')}>
          {vm.atencao.length === 0 ? <Empty text="Nenhuma pendência crítica." /> : vm.atencao.slice(0, 4).map(item => (
            <button className="dg-priority-row" key={item.obra.id} onClick={() => navigate(`/obras/${item.obra.id}`)}>
              <i style={{ background: item.motivos.includes('atrasada') ? THEME.danger : THEME.warn }} />
              <div>
                <strong>{item.obra.nome}</strong>
                <span>{item.motivos.slice(0, 2).join(' · ')}</span>
              </div>
            </button>
          ))}
        </Card>

        <Card title="Obras travadas">
          {vm.travadasLista.length === 0 ? <Empty text="Nenhuma obra travada." /> : vm.travadasLista.map(obra => (
            <button className="dg-priority-row compact" key={obra.id} onClick={() => navigate(`/obras/${obra.id}`)}>
              <i style={{ background: THEME.danger }} />
              <div><strong>{obra.nome}</strong><span>{obra.status || 'Ação imediata'}</span></div>
            </button>
          ))}
        </Card>

        <Card title="Pendências críticas">
          {vm.pendenciasCriticas.length === 0 ? <Empty text="Nenhuma pendência crítica." /> : vm.pendenciasCriticas.map(item => (
            <button className="dg-priority-row compact" key={item.id} onClick={() => item.obraId && navigate(`/obras/${item.obraId}`)}>
              <i style={{ background: THEME.warn }} />
              <div><strong>{item.titulo}</strong><span>{item.tipo} · {item.detalhe}</span></div>
            </button>
          ))}
        </Card>

        <Card title="Obras em risco">
          {vm.riscoLista.length === 0 ? <Empty text="Nenhuma obra em risco." /> : vm.riscoLista.map(obra => (
            <button className="dg-priority-row compact" key={obra.id} onClick={() => navigate(`/obras/${obra.id}`)}>
              <i style={{ background: THEME.warn }} />
              <div><strong>{obra.nome}</strong><span>{obra.data_previsao ? `Prev. ${dataBR(obra.data_previsao)}` : 'Sem previsão'}</span></div>
            </button>
          ))}
        </Card>
      </section>

      <section className="dg-agenda-mobile">
        <Card title="Agenda dos próximos dias" action="Agenda" onAction={() => navigate('/agenda')}>
          <MiniAgenda label="Montagens" itens={vm.agenda7.montagens} />
          <MiniAgenda label="Vistorias" itens={vm.agenda7.vistorias} />
          <MiniAgenda label="Assist. técnicas" itens={vm.agenda7.assistencias} />
        </Card>
      </section>

      <section className="dg-kpis" aria-label="Indicadores operacionais">
        {kpis.map(k => <Kpi key={k.label} {...k} loading={loading} />)}
      </section>

      <section className="dg-grid-3">
        <Card title="Saude operacional" action="Ver obras" onAction={() => navigate('/obras')}>
          <div className="dg-health">
            <Health label="Atrasadas" value={vm.saude.atrasadas} color={THEME.danger} />
            <Health label="Em risco" value={vm.saude.risco} color={THEME.warn} />
            <Health label="No prazo" value={vm.saude.prazo} color={THEME.success} />
          </div>
        </Card>

        <Card title="Proximos 7 dias" action="Agenda" onAction={() => navigate('/agenda')}>
          <MiniAgenda label="Montagens" itens={vm.agenda7.montagens} />
          <MiniAgenda label="Vistorias" itens={vm.agenda7.vistorias} />
          <MiniAgenda label="Assist. tecnicas" itens={vm.agenda7.assistencias} />
        </Card>

        <Card title="Equipe">
          <div className="dg-team-kpis">
            <Health label="Supervisores" value={vm.equipe.supervisores} color={THEME.gold} />
            <Health label="Montadores" value={vm.equipe.montadores} color="#1E3A5F" />
          </div>
          <div className="dg-mini-list">
            {vm.equipe.obrasPorSupervisor.length === 0 ? <Empty text="Sem obras por supervisor." /> : vm.equipe.obrasPorSupervisor.map(s => (
              <Line key={s.nome} title={s.nome} meta={`${s.total} obra${s.total === 1 ? '' : 's'}`} />
            ))}
          </div>
        </Card>
      </section>

      <section className="dg-main">
        <div className="dg-stack">
          <Card title="Fluxo Ornare" action="Obras" onAction={() => navigate('/obras')}>
            <div className="dg-flow">
              {vm.fluxo.map((f, i) => (
                <div className="dg-flow-step" key={f.label}>
                  <div className="dg-flow-num">{loading ? '-' : f.value}</div>
                  <div className="dg-flow-label">{f.label}</div>
                  {i < vm.fluxo.length - 1 && <div className="dg-flow-line" />}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Obras que precisam atencao" action="Abrir obras" onAction={() => navigate('/obras')}>
            {vm.atencao.length === 0 ? <Empty text="Nenhuma obra critica neste momento." /> : vm.atencao.map(item => (
              <button className="dg-attention" key={item.obra.id} onClick={() => navigate(`/obras/${item.obra.id}`)}>
                <div>
                  <strong>{item.obra.nome}</strong>
                  <span>{item.obra.cliente_nome || item.obra.cidade || 'Sem cliente informado'}</span>
                </div>
                <div className="dg-tags">{item.motivos.slice(0, 3).map(m => <span key={m}>{m}</span>)}</div>
              </button>
            ))}
          </Card>

          <Card title="Operacao em andamento" action="Ver todas" onAction={() => navigate('/obras')}>
            {vm.obrasOperacionais.length === 0 ? <Empty text="Sem obras operacionais." /> : vm.obrasOperacionais.map(obra => {
              const st = statusBadge(obra.status)
              const temOc = (vm.ocorrPorObra.get(obra.id) || []).length > 0
              return (
                <button className="dg-work-row" key={obra.id} onClick={() => navigate(`/obras/${obra.id}`)}>
                  <div className="dg-work-main">
                    <strong>{obra.nome}</strong>
                    <span>{[obra.cliente_nome, obra.cidade, obra.data_previsao ? `Prev. ${dataBR(obra.data_previsao)}` : null].filter(Boolean).join(' · ')}</span>
                  </div>
                  <div className="dg-progress"><i style={{ width: `${obra.progresso || 0}%`, background: temOc ? THEME.danger : THEME.gold }} /></div>
                  <span className="dg-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                </button>
              )
            })}
          </Card>
        </div>

        <div className="dg-stack">
          <Card title="Pendências" action="Ocorrências" onAction={() => navigate('/ocorrencias')}>
            <MetricLine label="Ocorrências abertas" value={vm.pendencias.ocorrenciasAbertas.length} color={THEME.danger} />
            <MetricLine label="Não conformidades" value={vm.pendencias.naoConformidades.length} color={THEME.warn} />
            <MetricLine label="Tarefas atrasadas" value={vm.pendencias.tarefasAtrasadas.length} color="#1E3A5F" />
            <div className="dg-mini-list">
              {vm.pendencias.tarefasAtrasadas.slice(0, 4).map(t => <Line key={t.id} title={t.titulo || 'Tarefa atrasada'} meta={obraNome(dados.obras, t.obra_id)} />)}
            </div>
          </Card>

          <Card title="Financeiro operacional" action="Gastos" onAction={() => navigate('/gastos')}>
            <div className="dg-money">{moeda(vm.financeiro.totalMes)}</div>
            <div className="dg-muted">{vm.financeiro.gastosMes.length} lancamentos no mes</div>
            <div className="dg-mini-list spaced">
              {vm.financeiro.topObras.map(o => <Line key={o.obraId} title={o.nome} meta={moeda(o.total)} />)}
            </div>
            {vm.financeiro.acimaMeta.length > 0 && (
              <div className="dg-alert">{vm.financeiro.acimaMeta.length} obra{vm.financeiro.acimaMeta.length === 1 ? '' : 's'} acima da meta</div>
            )}
          </Card>

          <Card title="Atividade recente">
            {vm.atividade.length === 0 ? <Empty text="Nenhuma atividade recente." /> : vm.atividade.map((a, i) => (
              <div className="dg-activity" key={`${a.tipo}-${i}`}>
                <span>{a.tipo}</span>
                <div><strong>{a.texto}</strong><small>{a.sub}</small></div>
                <em>{tempoRelativo(a.ts)}</em>
              </div>
            ))}
          </Card>
        </div>
      </section>
    </div>
  )
}

function obraNome(obras, id) {
  return obras.find(o => o.id === id)?.nome || 'Sem obra'
}

function Kpi({ label, value, sub, tone, loading }) {
  return (
    <DesignKpiCard label={label} value={loading ? '-' : value} helper={sub} tone={tone === THEME.danger ? 'danger' : tone === THEME.success ? 'success' : tone === THEME.warn ? 'warning' : 'gold'} />
  )
}

function Card({ title, action, onAction, children }) {
  return (
    <PremiumCard title={title} action={action && <button className="ow-action-button secondary" onClick={onAction}>{action}</button>}>
      {children}
    </PremiumCard>
  )
}

function Health({ label, value, color }) {
  return (
    <div className="dg-health-item">
      <strong style={{ color }}>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function MiniAgenda({ label, itens }) {
  return (
    <div className="dg-agenda-block">
      <div><strong>{itens.length}</strong><span>{label}</span></div>
      {itens.slice(0, 2).map(i => <Line key={i.id} title={i.titulo || i.tipo || label} meta={`${dataBR(i.data)} ${i.hora_inicio ? String(i.hora_inicio).slice(0, 5) : ''}`} />)}
    </div>
  )
}

function MetricLine({ label, value, color }) {
  return (
    <div className="dg-metric-line">
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
    </div>
  )
}

function Line({ title, meta }) {
  return (
    <div className="dg-line">
      <span>{title}</span>
      <small>{meta}</small>
    </div>
  )
}

function Empty({ text }) {
  return <EmptyState title={text} />
}

const css = `
.dg-page{min-height:100vh;background:${THEME.bg};padding:30px 34px 52px;color:${THEME.ink};font-family:var(--font-sans);box-sizing:border-box}
.dg-header{max-width:1380px;margin:0 auto 22px;display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
.dg-eyebrow{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${THEME.gold};font-weight:800;margin-bottom:7px}
.dg-header h1{font-family:var(--font-serif);font-size:38px;line-height:1.05;font-weight:500;margin:0;color:${THEME.ink}}
.dg-header p{margin:6px 0 0;font-size:13px;color:${THEME.muted}}
.dg-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.dg-actions button{border:1px solid ${THEME.border};background:#fff;color:${THEME.ink};border-radius:10px;padding:10px 14px;font-size:13px;font-weight:700;cursor:pointer}
.dg-actions .primary{background:${THEME.gold};border-color:${THEME.gold};color:#fff}
.dg-priority-board{max-width:1380px;margin:0 auto 16px;display:grid;grid-template-columns:1.25fr 1fr 1fr 1fr;gap:12px}
.dg-agenda-mobile{max-width:1380px;margin:0 auto 16px}
.dg-priority-row{width:100%;border:0;background:transparent;border-bottom:1px solid ${THEME.border};padding:11px 0;display:flex;gap:10px;align-items:flex-start;text-align:left;cursor:pointer;font-family:inherit}
.dg-priority-row:last-child{border-bottom:0}
.dg-priority-row i{width:9px;height:9px;border-radius:99px;margin-top:5px;flex-shrink:0}
.dg-priority-row strong{display:block;font-size:13px;color:${THEME.ink};font-weight:900;line-height:1.25}
.dg-priority-row span{display:block;font-size:11.5px;color:${THEME.muted};line-height:1.35;margin-top:3px}
.dg-priority-row.compact{padding:9px 0}
.dg-kpis{max-width:1380px;margin:0 auto 18px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}
.dg-kpi{background:#fff;border:1px solid ${THEME.border};border-top:3px solid ${THEME.gold};border-radius:14px;padding:15px 16px;min-width:0}
.dg-kpi span{display:block;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;font-weight:800;margin-bottom:9px;white-space:nowrap}
.dg-kpi strong{display:block;font-size:34px;line-height:1;color:${THEME.ink}}
.dg-kpi small{display:block;font-size:12px;color:${THEME.muted};margin-top:7px}
.dg-grid-3,.dg-main{max-width:1380px;margin:0 auto 16px;display:grid;gap:16px}
.dg-grid-3{grid-template-columns:1fr 1.15fr 1fr}
.dg-main{grid-template-columns:minmax(0,1.45fr) minmax(340px,.75fr)}
.dg-stack{display:flex;flex-direction:column;gap:16px}
.dg-card{background:#fff;border:1px solid ${THEME.border};border-radius:16px;padding:18px 20px;box-shadow:0 14px 34px rgba(29,28,25,.045);min-width:0}
.dg-card-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px}
.dg-card-head h2{font-size:14px;font-weight:800;margin:0;color:${THEME.ink}}
.dg-card-head button{border:0;background:transparent;color:${THEME.gold};font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap}
.dg-health,.dg-team-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.dg-team-kpis{grid-template-columns:1fr 1fr;margin-bottom:12px}
.dg-health-item{border:1px solid ${THEME.border};border-radius:12px;padding:12px;background:#FFFEFC}
.dg-health-item strong{display:block;font-size:26px;line-height:1}
.dg-health-item span{display:block;font-size:12px;color:${THEME.muted};margin-top:6px}
.dg-agenda-block{border-top:1px solid ${THEME.border};padding:11px 0}
.dg-agenda-block:first-of-type{border-top:0;padding-top:0}
.dg-agenda-block>div:first-child{display:flex;align-items:baseline;gap:8px;margin-bottom:7px}
.dg-agenda-block strong{font-size:22px;color:${THEME.gold}}
.dg-agenda-block span{font-size:12px;color:${THEME.muted};font-weight:700}
.dg-flow{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}
.dg-flow-step{position:relative;border:1px solid ${THEME.border};background:#FFFEFC;border-radius:13px;padding:13px;min-height:82px}
.dg-flow-num{font-size:28px;font-weight:800;color:${THEME.ink};line-height:1}
.dg-flow-label{font-size:11px;color:${THEME.muted};margin-top:8px;font-weight:700}
.dg-flow-line{position:absolute;right:-10px;top:50%;width:10px;height:1px;background:${THEME.border}}
.dg-attention,.dg-work-row{width:100%;border:0;background:transparent;border-bottom:1px solid ${THEME.border};padding:12px 0;display:flex;gap:12px;align-items:center;text-align:left;cursor:pointer;font-family:inherit}
.dg-attention strong,.dg-work-row strong{display:block;font-size:13.5px;color:${THEME.ink};margin-bottom:3px}
.dg-attention span,.dg-work-row span,.dg-muted{font-size:12px;color:${THEME.muted}}
.dg-attention strong,.dg-attention span,.dg-work-main strong,.dg-work-main span{overflow:hidden;text-overflow:ellipsis}
.dg-tags{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.dg-tags span{background:#F7EFE4;color:${THEME.warn};border-radius:999px;padding:4px 8px;font-size:10px;font-weight:800}
.dg-work-main{flex:1;min-width:0}
.dg-progress{width:72px;height:5px;background:${THEME.border};border-radius:999px;overflow:hidden;flex-shrink:0}
.dg-progress i{display:block;height:100%;border-radius:999px}
.dg-badge{font-size:10px;font-weight:800;border-radius:999px;padding:5px 8px;white-space:nowrap}
.dg-metric-line,.dg-line{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid ${THEME.border};align-items:center}
.dg-metric-line span,.dg-line span{font-size:12.5px;color:${THEME.ink};font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dg-metric-line strong{font-size:18px}
.dg-line small{font-size:11px;color:${THEME.muted};white-space:nowrap}
.dg-mini-list.spaced{margin-top:12px}
.dg-money{font-family:var(--font-serif);font-size:32px;line-height:1.05;color:${THEME.ink};margin-bottom:4px}
.dg-alert{margin-top:12px;border:1px solid #ECD7B5;background:#FFF8EC;color:${THEME.warn};border-radius:11px;padding:10px 12px;font-size:12px;font-weight:800}
.dg-activity{display:grid;grid-template-columns:72px 1fr auto;gap:10px;align-items:start;padding:9px 0;border-bottom:1px solid ${THEME.border}}
.dg-activity>span{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:${THEME.gold};font-weight:800}
.dg-activity strong{display:block;font-size:12.5px;color:${THEME.ink};font-weight:700}
.dg-activity small{display:block;font-size:11px;color:${THEME.muted};margin-top:2px}
.dg-activity em{font-style:normal;font-size:10px;color:#aaa}
.dg-empty{padding:24px 0;text-align:center;color:#aaa;font-size:13px}
@media (max-width:1100px){.dg-grid-3,.dg-main{grid-template-columns:1fr}.dg-flow{grid-template-columns:repeat(3,1fr)}.dg-flow-line{display:none}}
@media (max-width:1100px){.dg-priority-board{grid-template-columns:1fr 1fr}.dg-agenda-mobile{display:block}}
@media (min-width:761px){.dg-agenda-mobile{display:none}}
@media (max-width:760px){.dg-page{padding:22px 14px calc(112px + env(safe-area-inset-bottom));display:flex;flex-direction:column}.dg-header{display:block;margin-bottom:14px;order:0}.dg-eyebrow{font-size:9px;letter-spacing:2px;margin-bottom:4px}.dg-header h1{font-size:28px;line-height:1.02}.dg-header p{font-size:12.5px;line-height:1.45}.dg-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;justify-content:flex-start;margin-top:10px}.dg-actions button{width:100%;padding:10px 9px;font-size:12px}.dg-priority-board{grid-template-columns:1fr;gap:10px;margin-bottom:12px;order:1}.dg-priority-row{padding:11px 0}.dg-agenda-mobile{order:2}.dg-main{order:3}.dg-kpis{order:4;display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:12px}.dg-kpis>*{flex:0 0 auto;min-width:auto;max-width:none}.dg-kpi{display:flex;align-items:center;gap:7px;border-radius:999px;padding:7px 10px;min-width:auto;max-width:none;border-top:1px solid rgba(184,150,94,.22)}.dg-kpi span{white-space:nowrap;font-size:10.5px;line-height:1;letter-spacing:0;margin:0}.dg-kpi strong{font-size:15px}.dg-kpi small{display:none}.dg-grid-3,.dg-main{gap:12px}.dg-grid-3{display:none}.dg-card{padding:15px 13px;border-radius:15px}.dg-card-head h2{font-size:19px}.dg-health{grid-template-columns:1fr 1fr 1fr}.dg-flow{display:none}.dg-card:has(.dg-flow){display:none}.dg-attention,.dg-work-row{align-items:flex-start;flex-direction:column}.dg-attention strong,.dg-attention span,.dg-work-main strong,.dg-work-main span{display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;white-space:normal}.dg-tags{margin-left:0;justify-content:flex-start}.dg-tags span:nth-child(n+3){display:none}.dg-progress{width:100%}.dg-activity{grid-template-columns:62px 1fr}.dg-activity em{display:none}}
`
