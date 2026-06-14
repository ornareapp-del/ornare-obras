import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'

const THEME = {
  bg: '#F6F3EE',
  card: '#FFFFFF',
  border: '#E7E0D5',
  ink: '#1D1C19',
  muted: '#6D675E',
  gold: '#B8965E',
  danger: '#B84040',
  warn: '#B8965E',
  success: '#2D7A4A',
  blue: '#3B5F86',
}

const STATUS_OBRA = {
  'Em montagem': { bg: '#EDF2F7', color: '#2B4C70', label: 'Em montagem' },
  'Montagem agendada': { bg: '#EAF3FB', color: '#1E5A8A', label: 'Montagem agendada' },
  'Concluida': { bg: '#EAF5EE', color: '#2D7A4A', label: 'Concluida' },
  'Concluída': { bg: '#EAF5EE', color: '#2D7A4A', label: 'Concluida' },
  'Pausada': { bg: '#FFF3E0', color: '#9A5B13', label: 'Pausada' },
  'Em producao': { bg: '#F4EFE6', color: '#8A6A38', label: 'Em producao' },
  'Em produção': { bg: '#F4EFE6', color: '#8A6A38', label: 'Em producao' },
}

const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const dataBR = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR') : '-'

const isConcluido = status => ['concluida', 'concluido', 'finalizada', 'finalizado'].includes(norm(status))

const obraStatus = status => STATUS_OBRA[status] || { bg: '#F5F1EA', color: THEME.muted, label: status || '-' }

const agendaTipo = item => {
  const tipo = norm(item.tipo || item.titulo || item.descricao)
  if (tipo.includes('vistoria')) return 'vistorias'
  if (tipo.includes('assist')) return 'assistencias'
  if (tipo.includes('reuniao') || tipo.includes('reuni')) return 'reunioes'
  return 'montagens'
}

function saudeObra(obra, hoje) {
  const previsao = obra.data_previsao || obra.data_previsao_entrega
  const data = previsao ? new Date(`${previsao}T00:00:00`) : null
  if (data && data < hoje && !isConcluido(obra.status)) return 'atrasada'
  if (data) {
    const dias = Math.ceil((data.getTime() - hoje.getTime()) / 86400000)
    if (dias <= 7 && !isConcluido(obra.status)) return 'risco'
  }
  return 'prazo'
}

function safeArray(result) {
  return result?.data || []
}

export default function DashboardSupervisor() {
  const navigate = useNavigate()
  const { profile } = useStore()

  const [dados, setDados] = useState({
    obras: [],
    agenda: [],
    tarefas: [],
    ocorrencias: [],
    checkins: [],
    obraMontadores: [],
    profiles: [],
    checklist: [],
    fotos: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    let ativo = true

    async function carregar() {
      setLoading(true)

      const obrasResult = await supabase
        .from('obras')
        .select('*')
        .eq('supervisor_id', profile.id)
        .order('created_at', { ascending: false })

      if (!ativo) return

      const obras = safeArray(obrasResult)
      const obraIds = obras.map(o => o.id)

      if (!obraIds.length) {
        setDados(prev => ({ ...prev, obras }))
        setLoading(false)
        return
      }

      const [
        agendaResult,
        tarefasResult,
        ocorrenciasResult,
        obraMontadoresResult,
        checklistResult,
        fotosResult,
      ] = await Promise.all([
        supabase.from('agenda').select('*').in('obra_id', obraIds).order('data').order('hora_inicio'),
        supabase.from('tarefas').select('*').in('obra_id', obraIds).order('prazo', { ascending: true }),
        supabase.from('ocorrencias').select('*').in('obra_id', obraIds).order('created_at', { ascending: false }),
        supabase.from('obra_montadores').select('obra_id, montador_id').in('obra_id', obraIds),
        supabase.from('checklist_items').select('id, obra_id, descricao, concluido, concluido_em, ambiente_id').in('obra_id', obraIds),
        supabase.from('fotos').select('*').in('obra_id', obraIds).order('created_at', { ascending: false }),
      ])

      if (!ativo) return

      const obraMontadores = safeArray(obraMontadoresResult)
      const montadorIds = [...new Set(obraMontadores.map(m => m.montador_id).filter(Boolean))]

      const [profilesResult, checkinsResult] = await Promise.all([
        montadorIds.length
          ? supabase.from('profiles').select('id, full_name, email, role').in('id', montadorIds)
          : { data: [] },
        montadorIds.length
          ? supabase.from('checkins').select('*').in('user_id', montadorIds).order('created_at', { ascending: false }).limit(120)
          : { data: [] },
      ])

      if (!ativo) return

      setDados({
        obras,
        agenda: safeArray(agendaResult),
        tarefas: safeArray(tarefasResult),
        ocorrencias: safeArray(ocorrenciasResult),
        checkins: safeArray(checkinsResult),
        obraMontadores,
        profiles: safeArray(profilesResult),
        checklist: safeArray(checklistResult),
        fotos: safeArray(fotosResult),
      })
      setLoading(false)
    }

    carregar()

    return () => { ativo = false }
  }, [profile?.id])

  const vm = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const amanha = new Date(hoje)
    amanha.setDate(hoje.getDate() + 1)
    const fimSemana = new Date(hoje)
    fimSemana.setDate(hoje.getDate() + 7)
    const seteDiasAtras = new Date(hoje)
    seteDiasAtras.setDate(hoje.getDate() - 7)

    const obraPorId = new Map(dados.obras.map(o => [o.id, o]))
    const profilePorId = new Map(dados.profiles.map(p => [p.id, p]))
    const montadorIds = [...new Set(dados.obraMontadores.map(m => m.montador_id).filter(Boolean))]

    const tarefasAbertas = dados.tarefas.filter(t => !isConcluido(t.status))
    const tarefasAtrasadas = tarefasAbertas.filter(t => t.prazo && new Date(`${t.prazo}T00:00:00`) < hoje)
    const ocorrenciasAbertas = dados.ocorrencias.filter(o => !isConcluido(o.status) && norm(o.status) !== 'fechada')
    const ocorrenciasCriticas = ocorrenciasAbertas.filter(o => ['alta', 'critica', 'crítica'].includes(norm(o.gravidade || o.prioridade)))
    const checklistPendentes = dados.checklist.filter(i => !i.concluido)
    const checklistConcluidos = dados.checklist.filter(i => i.concluido)
    const fotosPendentes = dados.fotos.filter(f => f.aprovada === false || f.aprovada_gestao === false)
    const fotosNaoConformidade = dados.fotos.filter(f => norm(f.categoria || f.etapa).includes('conformidade'))

    const agendaSemana = dados.agenda.filter(item => {
      if (!item.data) return false
      const data = new Date(`${item.data}T00:00:00`)
      return data >= hoje && data <= fimSemana
    })

    const agenda = agendaSemana.reduce((acc, item) => {
      acc[agendaTipo(item)].push(item)
      return acc
    }, { montagens: [], vistorias: [], assistencias: [], reunioes: [] })

    const checkinsHoje = dados.checkins.filter(c => {
      const base = c.entrada || c.created_at
      if (!base) return false
      const data = new Date(base)
      return data >= hoje && data < amanha
    })
    const entraramIds = new Set(checkinsHoje.map(c => c.user_id).filter(Boolean))
    const emServicoIds = new Set(checkinsHoje.filter(c => !c.saida).map(c => c.user_id).filter(Boolean))

    const obrasPorMontador = montadorIds.map(id => {
      const obrasIds = dados.obraMontadores.filter(m => m.montador_id === id).map(m => m.obra_id)
      return {
        id,
        nome: profilePorId.get(id)?.full_name || profilePorId.get(id)?.email || 'Montador',
        obras: obrasIds.map(obraId => obraPorId.get(obraId)).filter(Boolean),
        entrouHoje: entraramIds.has(id),
        emServico: emServicoIds.has(id),
      }
    })

    const saude = dados.obras.reduce((acc, obra) => {
      acc[saudeObra(obra, hoje)] += 1
      return acc
    }, { atrasada: 0, risco: 0, prazo: 0 })

    const pendenciasPorObra = new Map()
    checklistPendentes.forEach(item => {
      pendenciasPorObra.set(item.obra_id, (pendenciasPorObra.get(item.obra_id) || 0) + 1)
    })
    const obrasComMaisChecklist = [...pendenciasPorObra.entries()]
      .map(([obraId, total]) => ({ obra: obraPorId.get(obraId), total }))
      .filter(item => item.obra)
      .sort((a, b) => b.total - a.total)

    const fotosPorObra = new Map()
    dados.fotos.forEach(foto => {
      if (!foto.obra_id) return
      const atual = fotosPorObra.get(foto.obra_id)
      const data = new Date(foto.created_at || 0)
      if (!atual || data > atual) fotosPorObra.set(foto.obra_id, data)
    })

    const acoes = []
    ocorrenciasCriticas.slice(0, 4).forEach(oc => acoes.push({
      tipo: 'Ocorrencia critica',
      titulo: oc.titulo || oc.descricao || 'Ocorrencia sem titulo',
      detalhe: obraPorId.get(oc.obra_id)?.nome || 'Obra',
      obraId: oc.obra_id,
      cor: THEME.danger,
    }))
    tarefasAtrasadas.slice(0, 4).forEach(t => acoes.push({
      tipo: 'Tarefa atrasada',
      titulo: t.titulo || t.descricao || 'Tarefa sem titulo',
      detalhe: `${obraPorId.get(t.obra_id)?.nome || 'Obra'} - ${dataBR(t.prazo)}`,
      obraId: t.obra_id,
      cor: THEME.danger,
    }))
    obrasComMaisChecklist.slice(0, 4).forEach(item => acoes.push({
      tipo: 'Checklist pendente',
      titulo: item.obra.nome || 'Obra',
      detalhe: `${item.total} item${item.total === 1 ? '' : 's'} pendente${item.total === 1 ? '' : 's'}`,
      obraId: item.obra.id,
      cor: THEME.warn,
    }))
    dados.obras.forEach(obra => {
      const ultima = fotosPorObra.get(obra.id)
      if (!isConcluido(obra.status) && (!ultima || ultima < seteDiasAtras)) {
        acoes.push({
          tipo: 'Sem foto recente',
          titulo: obra.nome || 'Obra',
          detalhe: ultima ? `Ultima foto em ${ultima.toLocaleDateString('pt-BR')}` : 'Nenhuma foto registrada',
          obraId: obra.id,
          cor: THEME.blue,
        })
      }
    })

    const obrasDetalhadas = dados.obras.map(obra => {
      const atrasada = saudeObra(obra, hoje) === 'atrasada'
      const temOcorrencia = ocorrenciasAbertas.some(o => o.obra_id === obra.id)
      const temChecklist = checklistPendentes.some(i => i.obra_id === obra.id)
      const ultimaFoto = fotosPorObra.get(obra.id)
      const semFotoRecente = !isConcluido(obra.status) && (!ultimaFoto || ultimaFoto < seteDiasAtras)
      const alertas = [
        atrasada && 'Atrasada',
        temOcorrencia && 'Ocorrencia',
        temChecklist && 'Checklist',
        semFotoRecente && 'Sem foto recente',
      ].filter(Boolean)
      return { ...obra, alertas }
    })

    return {
      kpis: {
        minhasObras: dados.obras.length,
        emMontagem: dados.obras.filter(o => norm(o.status).includes('montagem')).length,
        atrasadas: saude.atrasada,
        pendencias: tarefasAbertas.length + ocorrenciasAbertas.length + checklistPendentes.length,
        fotosPendentes: fotosPendentes.length,
        checkinsHoje: checkinsHoje.length,
      },
      saude,
      agenda,
      checkins: {
        entraram: entraramIds.size,
        emServico: emServicoIds.size,
        aindaNaoEntraram: Math.max(montadorIds.length - entraramIds.size, 0),
      },
      checklist: {
        pendentes: checklistPendentes.length,
        concluidos: checklistConcluidos.length,
        obras: obrasComMaisChecklist,
      },
      equipe: {
        montadores: obrasPorMontador,
        total: montadorIds.length,
      },
      fotos: {
        total: dados.fotos.length,
        pendentes: fotosPendentes.length,
        naoConformidades: fotosNaoConformidade.length,
      },
      ocorrencias: {
        abertas: ocorrenciasAbertas.length,
        andamento: ocorrenciasAbertas.filter(o => norm(o.status).includes('andamento')).length,
        criticas: ocorrenciasCriticas.length,
      },
      obras: obrasDetalhadas,
      acoes: acoes.slice(0, 10),
      obraPorId,
    }
  }, [dados])

  const kpis = [
    { label: 'Minhas obras', value: vm.kpis.minhasObras, sub: 'sob responsabilidade', tone: THEME.gold },
    { label: 'Em montagem', value: vm.kpis.emMontagem, sub: 'operacao ativa', tone: THEME.blue },
    { label: 'Atrasadas', value: vm.kpis.atrasadas, sub: 'exigem plano', tone: vm.kpis.atrasadas ? THEME.danger : THEME.success },
    { label: 'Pendencias', value: vm.kpis.pendencias, sub: 'tarefas, ocorrencias e checklist', tone: vm.kpis.pendencias ? THEME.warn : THEME.success },
    { label: 'Fotos pendentes', value: vm.kpis.fotosPendentes, sub: 'aguardando validacao', tone: vm.kpis.fotosPendentes ? THEME.warn : THEME.success },
    { label: 'Check-ins hoje', value: vm.kpis.checkinsHoje, sub: 'movimentacoes de equipe', tone: THEME.gold },
  ]

  return (
    <div className="ds-page">
      <style>{css}</style>

      <header className="ds-header">
        <div>
          <div className="ds-eyebrow">Supervisor Ornare</div>
          <h1>Central do Supervisor</h1>
          <p>Obras sob sua responsabilidade, equipe em campo e pendencias da semana</p>
        </div>
        <div className="ds-actions">
          <button onClick={() => navigate('/obras')}>Minhas obras</button>
          <button onClick={() => navigate('/agenda')}>Agenda</button>
          <button className="primary" onClick={() => navigate('/ocorrencias')}>Registrar ocorrencia</button>
        </div>
      </header>

      <section className="ds-kpis" aria-label="Indicadores do supervisor">
        {kpis.map(kpi => <Kpi key={kpi.label} {...kpi} loading={loading} />)}
      </section>

      <section className="ds-grid-3">
        <Card title="Saude das minhas obras">
          <div className="ds-health">
            <Health label="Atrasadas" value={vm.saude.atrasada} color={THEME.danger} loading={loading} />
            <Health label="Em risco" value={vm.saude.risco} color={THEME.warn} loading={loading} />
            <Health label="No prazo" value={vm.saude.prazo} color={THEME.success} loading={loading} />
          </div>
        </Card>

        <Card title="Agenda da semana" action="Abrir agenda" onAction={() => navigate('/agenda')}>
          <MiniAgenda label="Montagens" items={vm.agenda.montagens} loading={loading} />
          <MiniAgenda label="Vistorias" items={vm.agenda.vistorias} loading={loading} />
          <MiniAgenda label="Assistencias tecnicas" items={vm.agenda.assistencias} loading={loading} />
          <MiniAgenda label="Reunioes" items={vm.agenda.reunioes} loading={loading} />
        </Card>

        <Card title="Check-ins de hoje">
          <div className="ds-health">
            <Health label="Entraram" value={vm.checkins.entraram} color={THEME.gold} loading={loading} />
            <Health label="Ainda nao" value={vm.checkins.aindaNaoEntraram} color={THEME.warn} loading={loading} />
            <Health label="Em servico" value={vm.checkins.emServico} color={THEME.success} loading={loading} />
          </div>
        </Card>
      </section>

      <section className="ds-main">
        <div className="ds-stack">
          <Card title="Minhas obras" action="Ver obras" onAction={() => navigate('/obras')}>
            {loading ? <Empty text="Carregando obras..." /> : vm.obras.length === 0 ? <Empty text="Nenhuma obra atribuida." /> : (
              <div className="ds-work-list">
                {vm.obras.slice(0, 10).map(obra => {
                  const st = obraStatus(obra.status)
                  const previsao = obra.data_previsao || obra.data_previsao_entrega
                  return (
                    <button className="ds-work-row" key={obra.id} onClick={() => navigate(`/obras/${obra.id}`)}>
                      <div className="ds-work-main">
                        <strong>{obra.nome || 'Obra sem nome'}</strong>
                        <span>{[obra.cliente_nome, obra.cidade].filter(Boolean).join(' - ') || 'Cliente nao informado'}</span>
                        <div className="ds-tags">
                          {obra.alertas.length ? obra.alertas.slice(0, 3).map(a => <em key={a}>{a}</em>) : <em className="ok">Sem alerta</em>}
                        </div>
                      </div>
                      <div className="ds-progress"><i style={{ width: `${obra.progresso || 0}%`, background: obra.alertas.length ? THEME.warn : THEME.gold }} /></div>
                      <small>{previsao ? dataBR(previsao) : 'Sem previsao'}</small>
                      <span className="ds-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </Card>

          <Card title="Checklist">
            <div className="ds-split">
              <Metric label="Pendentes" value={vm.checklist.pendentes} color={THEME.warn} loading={loading} />
              <Metric label="Concluidos" value={vm.checklist.concluidos} color={THEME.success} loading={loading} />
            </div>
            <div className="ds-mini-list spaced">
              {loading ? <Empty text="Carregando checklist..." /> : vm.checklist.obras.length === 0 ? <Empty text="Nenhuma pendencia de checklist." /> : vm.checklist.obras.slice(0, 5).map(item => (
                <Line key={item.obra.id} label={item.obra.nome || 'Obra'} value={`${item.total} pendente${item.total === 1 ? '' : 's'}`} onClick={() => navigate(`/obras/${item.obra.id}`)} />
              ))}
            </div>
          </Card>
        </div>

        <div className="ds-stack">
          <Card title="Proximas acoes">
            {loading ? <Empty text="Carregando acoes..." /> : vm.acoes.length === 0 ? <Empty text="Operacao sem acoes urgentes." /> : vm.acoes.map((acao, i) => (
              <button className="ds-action-row" key={`${acao.tipo}-${i}`} onClick={() => acao.obraId && navigate(`/obras/${acao.obraId}`)}>
                <span style={{ background: acao.cor }} />
                <div>
                  <strong>{acao.titulo}</strong>
                  <small>{acao.tipo} - {acao.detalhe}</small>
                </div>
              </button>
            ))}
          </Card>

          <Card title="Equipe">
            <MetricLine label="Montadores alocados" value={vm.equipe.total} color={THEME.gold} loading={loading} />
            <div className="ds-mini-list spaced">
              {loading ? <Empty text="Carregando equipe..." /> : vm.equipe.montadores.length === 0 ? <Empty text="Nenhum montador alocado." /> : vm.equipe.montadores.slice(0, 6).map(m => (
                <Line
                  key={m.id}
                  label={m.nome}
                  value={`${m.obras.length} obra${m.obras.length === 1 ? '' : 's'}${m.emServico ? ' - em servico' : ''}`}
                />
              ))}
            </div>
          </Card>

          <Card title="Fotos">
            <MetricLine label="Fotos enviadas" value={vm.fotos.total} color={THEME.gold} loading={loading} />
            <MetricLine label="Aguardando aprovacao" value={vm.fotos.pendentes} color={THEME.warn} loading={loading} />
            <MetricLine label="Nao conformidades" value={vm.fotos.naoConformidades} color={THEME.danger} loading={loading} />
          </Card>

          <Card title="Ocorrencias">
            <MetricLine label="Abertas" value={vm.ocorrencias.abertas} color={THEME.warn} loading={loading} />
            <MetricLine label="Em andamento" value={vm.ocorrencias.andamento} color={THEME.blue} loading={loading} />
            <MetricLine label="Criticas" value={vm.ocorrencias.criticas} color={THEME.danger} loading={loading} />
          </Card>
        </div>
      </section>
    </div>
  )
}

function Kpi({ label, value, sub, tone, loading }) {
  return (
    <div className="ds-kpi" style={{ borderTopColor: tone }}>
      <span style={{ color: tone }}>{label}</span>
      <strong>{loading ? '-' : value}</strong>
      <small>{sub}</small>
    </div>
  )
}

function Card({ title, action, onAction, children }) {
  return (
    <section className="ds-card">
      <div className="ds-card-head">
        <h2>{title}</h2>
        {action && <button onClick={onAction}>{action}</button>}
      </div>
      {children}
    </section>
  )
}

function Health({ label, value, color, loading }) {
  return (
    <div className="ds-health-item">
      <strong style={{ color }}>{loading ? '-' : value}</strong>
      <span>{label}</span>
    </div>
  )
}

function MiniAgenda({ label, items, loading }) {
  const primeiro = items[0]
  return (
    <div className="ds-agenda-block">
      <div>
        <strong>{loading ? '-' : items.length}</strong>
        <span>{label}</span>
      </div>
      {primeiro && <small>{dataBR(primeiro.data)} - {primeiro.titulo || primeiro.tipo || 'Agenda'}</small>}
    </div>
  )
}

function Metric({ label, value, color, loading }) {
  return (
    <div className="ds-metric">
      <strong style={{ color }}>{loading ? '-' : value}</strong>
      <span>{label}</span>
    </div>
  )
}

function MetricLine({ label, value, color, loading }) {
  return (
    <div className="ds-metric-line">
      <span>{label}</span>
      <strong style={{ color }}>{loading ? '-' : value}</strong>
    </div>
  )
}

function Line({ label, value, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className="ds-line" onClick={onClick}>
      <span>{label}</span>
      <small>{value}</small>
    </Tag>
  )
}

function Empty({ text }) {
  return <div className="ds-empty">{text}</div>
}

const css = `
.ds-page{min-height:100vh;background:${THEME.bg};padding:30px 34px 52px;color:${THEME.ink};font-family:var(--font-sans);box-sizing:border-box}
.ds-header{max-width:1380px;margin:0 auto 22px;display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
.ds-eyebrow{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${THEME.gold};font-weight:800;margin-bottom:7px}
.ds-header h1{font-family:var(--font-serif);font-size:38px;line-height:1.05;font-weight:500;margin:0;color:${THEME.ink}}
.ds-header p{margin:6px 0 0;font-size:13px;color:${THEME.muted}}
.ds-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.ds-actions button{border:1px solid ${THEME.border};background:#fff;color:${THEME.ink};border-radius:10px;padding:10px 14px;font-size:13px;font-weight:800;cursor:pointer}
.ds-actions .primary{background:${THEME.gold};border-color:${THEME.gold};color:#fff}
.ds-kpis{max-width:1380px;margin:0 auto 18px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}
.ds-kpi{background:#fff;border:1px solid ${THEME.border};border-top:3px solid ${THEME.gold};border-radius:14px;padding:15px 16px;min-width:0}
.ds-kpi span{display:block;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;font-weight:800;margin-bottom:9px;white-space:nowrap}
.ds-kpi strong{display:block;font-size:34px;line-height:1;color:${THEME.ink}}
.ds-kpi small{display:block;font-size:12px;color:${THEME.muted};margin-top:7px}
.ds-grid-3,.ds-main{max-width:1380px;margin:0 auto 16px;display:grid;gap:16px}
.ds-grid-3{grid-template-columns:1fr 1.15fr 1fr}
.ds-main{grid-template-columns:minmax(0,1.45fr) minmax(340px,.75fr)}
.ds-stack{display:flex;flex-direction:column;gap:16px}
.ds-card{background:#fff;border:1px solid ${THEME.border};border-radius:16px;padding:18px 20px;box-shadow:0 14px 34px rgba(29,28,25,.045);min-width:0}
.ds-card-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px}
.ds-card-head h2{font-size:14px;font-weight:800;margin:0;color:${THEME.ink}}
.ds-card-head button{border:0;background:transparent;color:${THEME.gold};font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap}
.ds-health,.ds-split{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.ds-split{grid-template-columns:1fr 1fr;margin-bottom:4px}
.ds-health-item,.ds-metric{border:1px solid ${THEME.border};border-radius:12px;padding:12px;background:#FFFEFC}
.ds-health-item strong,.ds-metric strong{display:block;font-size:26px;line-height:1}
.ds-health-item span,.ds-metric span{display:block;font-size:12px;color:${THEME.muted};margin-top:6px}
.ds-agenda-block{border-top:1px solid ${THEME.border};padding:10px 0}
.ds-agenda-block:first-of-type{border-top:0;padding-top:0}
.ds-agenda-block>div:first-child{display:flex;align-items:baseline;gap:8px;margin-bottom:5px}
.ds-agenda-block strong{font-size:22px;color:${THEME.gold}}
.ds-agenda-block span{font-size:12px;color:${THEME.muted};font-weight:800}
.ds-agenda-block small{display:block;font-size:11px;color:${THEME.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-work-list{display:flex;flex-direction:column}
.ds-work-row{width:100%;border:0;background:transparent;border-bottom:1px solid ${THEME.border};padding:12px 0;display:grid;grid-template-columns:minmax(0,1fr) 86px auto auto;gap:12px;align-items:center;text-align:left;cursor:pointer;font-family:inherit}
.ds-work-row:last-child{border-bottom:0}
.ds-work-main{min-width:0}
.ds-work-main strong{display:block;font-size:13.5px;color:${THEME.ink};margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-work-main span{display:block;font-size:12px;color:${THEME.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-progress{width:86px;height:5px;background:${THEME.border};border-radius:999px;overflow:hidden}
.ds-progress i{display:block;height:100%;border-radius:999px}
.ds-work-row>small{font-size:11px;color:${THEME.muted};white-space:nowrap}
.ds-badge{font-size:10px;font-weight:800;border-radius:999px;padding:5px 8px;white-space:nowrap}
.ds-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.ds-tags em{font-style:normal;background:#F7EFE4;color:${THEME.warn};border-radius:999px;padding:4px 8px;font-size:10px;font-weight:800}
.ds-tags em.ok{background:#EAF5EE;color:${THEME.success}}
.ds-action-row{width:100%;border:0;background:transparent;border-bottom:1px solid ${THEME.border};padding:11px 0;display:flex;gap:10px;align-items:flex-start;text-align:left;cursor:pointer;font-family:inherit}
.ds-action-row>span{width:8px;height:8px;border-radius:99px;margin-top:5px;flex-shrink:0}
.ds-action-row strong{display:block;font-size:13px;color:${THEME.ink};font-weight:800}
.ds-action-row small{display:block;font-size:11.5px;color:${THEME.muted};margin-top:2px}
.ds-metric-line,.ds-line{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid ${THEME.border};align-items:center}
.ds-line{width:100%;border-left:0;border-right:0;border-top:0;background:transparent;text-align:left;font-family:inherit}
.ds-metric-line span,.ds-line span{font-size:12.5px;color:${THEME.ink};font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-metric-line strong{font-size:18px}
.ds-line small{font-size:11px;color:${THEME.muted};white-space:nowrap}
.ds-mini-list.spaced{margin-top:12px}
.ds-empty{padding:24px 0;text-align:center;color:#A79F93;font-size:13px}
@media (max-width:1100px){.ds-grid-3,.ds-main{grid-template-columns:1fr}.ds-work-row{grid-template-columns:minmax(0,1fr) 86px auto auto}}
@media (max-width:760px){.ds-page{padding:18px 14px 34px}.ds-header{display:block}.ds-header h1{font-size:31px}.ds-actions{justify-content:flex-start;margin-top:14px}.ds-actions button{flex:1;min-width:132px}.ds-kpis{display:flex;overflow-x:auto;padding-bottom:6px;scroll-snap-type:x mandatory}.ds-kpi{min-width:165px;scroll-snap-align:start}.ds-grid-3,.ds-main{gap:12px}.ds-card{padding:16px 14px;border-radius:14px}.ds-health{grid-template-columns:1fr 1fr 1fr}.ds-work-row{display:flex;align-items:flex-start;flex-direction:column}.ds-progress{width:100%}.ds-work-row>small{white-space:normal}.ds-badge{align-self:flex-start}.ds-action-row{padding:12px 0}.ds-split{grid-template-columns:1fr 1fr}}
`
