import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState, PremiumCard } from '../../components/DesignSystem'
import { faseOrnarePorKey, faseOrnarePorTexto } from '../../constants/fasesOrnare'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { limparNome } from '../../utils/ui'
import { theme } from '../../constants/theme'

const THEME = {
  bg: theme.background,
  card: theme.surface,
  border: theme.border,
  ink: theme.textPrimary,
  muted: theme.textSecondary,
  soft: theme.textMuted,
  gold: theme.gold,
  danger: theme.error,
  warn: theme.warning,
  success: theme.success,
  blue: '#3B5F86',
  elevated: theme.surfaceElevated,
}

const STATUS_OBRA = {
  'Em montagem': { bg: '#EDF2F7', color: '#2B4C70', label: 'Em montagem' },
  'Montagem agendada': { bg: '#EAF3FB', color: '#1E5A8A', label: 'Montagem agendada' },
  'Concluida': { bg: '#EAF5EE', color: '#2D7A4A', label: 'Concluída' },
  'Concluída': { bg: '#EAF5EE', color: '#2D7A4A', label: 'Concluída' },
  'Pausada': { bg: '#FFF3E0', color: '#9A5B13', label: 'Pausada' },
  'Em producao': { bg: '#F4EFE6', color: '#8A6A38', label: 'Em produção' },
  'Em produção': { bg: '#F4EFE6', color: '#8A6A38', label: 'Em produção' },
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

const PERIODOS = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mês' },
]

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

function fotoPendenteAprovacao(foto) {
  return !(foto?.aprovada === true && foto?.aprovada_gestao === true)
}

function erroConsulta(label, result) {
  if (!result?.error) return null
  return `${label}: ${result.error.message || 'falha ao carregar'}`
}

function diasDesde(value) {
  if (!value) return 0
  const data = new Date(value)
  if (Number.isNaN(data.getTime())) return 0
  return Math.max(0, Math.floor((new Date().setHours(0, 0, 0, 0) - data.setHours(0, 0, 0, 0)) / 86400000))
}

function faseKeyObra(obra) {
  const fase = faseOrnarePorKey(obra?.fase)
    || faseOrnarePorKey(obra?.fase_atual)
    || faseOrnarePorTexto(obra?.fase || obra?.fase_atual || obra?.status)
  return fase?.key || null
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
    gastos: [],
    cronogramas: [],
  })
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('semana')
  const [fluxoAberto, setFluxoAberto] = useState(false)
  const [metricasAberto, setMetricasAberto] = useState(false)
  const [equipeAberta, setEquipeAberta] = useState(false)
  const [erroDados, setErroDados] = useState('')

  useEffect(() => {
    if (!profile?.id) return
    let ativo = true

    async function carregar() {
      setLoading(true)
      setErroDados('')
      const falhas = []

      const obrasResult = await supabase
        .from('obras')
        .select('*')
        .eq('supervisor_id', profile.id)
        .order('created_at', { ascending: false })

      if (!ativo) return

      if (obrasResult.error) {
        setErroDados(obrasResult.error.message || 'Nao foi possivel carregar as obras do supervisor.')
        setDados(prev => ({ ...prev, obras: [] }))
        setLoading(false)
        return
      }

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
        gastosResult,
        cronogramasResult,
      ] = await Promise.all([
        supabase.from('agenda').select('*').in('obra_id', obraIds).order('data').order('hora_inicio'),
        supabase.from('tarefas').select('*').in('obra_id', obraIds).order('prazo', { ascending: true }),
        supabase.from('ocorrencias').select('*').in('obra_id', obraIds).order('created_at', { ascending: false }),
        supabase.from('obra_montadores').select('obra_id, montador_id').in('obra_id', obraIds),
        supabase.from('checklist_items').select('id, obra_id, descricao, concluido, concluido_em, ambiente_id').in('obra_id', obraIds),
        supabase.from('fotos').select('*').in('obra_id', obraIds).order('created_at', { ascending: false }),
        supabase.from('gastos').select('*').in('obra_id', obraIds).order('created_at', { ascending: false }),
        supabase.from('obra_cronograma').select('id, obra_id, fase, travado, motivo_trava, risco, updated_at').in('obra_id', obraIds),
      ])

      if (!ativo) return

      falhas.push(...[
        erroConsulta('Agenda', agendaResult),
        erroConsulta('Tarefas', tarefasResult),
        erroConsulta('Ocorrencias', ocorrenciasResult),
        erroConsulta('Equipe alocada', obraMontadoresResult),
        erroConsulta('Checklist', checklistResult),
        erroConsulta('Fotos', fotosResult),
        erroConsulta('Gastos', gastosResult),
        erroConsulta('Cronograma', cronogramasResult),
      ].filter(Boolean))

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

      falhas.push(...[
        erroConsulta('Perfis dos montadores', profilesResult),
        erroConsulta('Check-ins', checkinsResult),
      ].filter(Boolean))

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
        gastos: safeArray(gastosResult),
        cronogramas: safeArray(cronogramasResult),
      })
      setErroDados(falhas.join(' / '))
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
    const fimPeriodo = new Date(hoje)
    if (periodo === 'hoje') fimPeriodo.setDate(hoje.getDate() + 1)
    else if (periodo === 'mes') fimPeriodo.setMonth(hoje.getMonth() + 1, 1)
    else fimPeriodo.setDate(hoje.getDate() + 7)
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
    const fotosPendentes = dados.fotos.filter(fotoPendenteAprovacao)
    const fotosNaoConformidade = dados.fotos.filter(f => norm(f.categoria || f.etapa) === 'nao conformidade')
    const fotosNaoConformidadePendentes = fotosNaoConformidade.filter(fotoPendenteAprovacao)

    const agendaSemana = dados.agenda.filter(item => {
      if (!item.data) return false
      const data = new Date(`${item.data}T00:00:00`)
      return data >= hoje && data <= fimPeriodo
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
    const checkinHojePorMontador = new Map()
    checkinsHoje.forEach(checkin => {
      if (!checkin.user_id) return
      const atual = checkinHojePorMontador.get(checkin.user_id)
      const dataAtual = new Date(atual?.entrada || atual?.created_at || 0)
      const dataCheckin = new Date(checkin.entrada || checkin.created_at || 0)
      if (!atual || dataCheckin > dataAtual) checkinHojePorMontador.set(checkin.user_id, checkin)
    })

    const obrasPorMontador = montadorIds.map(id => {
      const obrasIds = dados.obraMontadores.filter(m => m.montador_id === id).map(m => m.obra_id)
      const checkinHoje = checkinHojePorMontador.get(id)
      const obraAtual = obraPorId.get(checkinHoje?.obra_id) || obraPorId.get(obrasIds[0])
      return {
        id,
        nome: limparNome(profilePorId.get(id)?.full_name || profilePorId.get(id)?.email || 'Montador'),
        obras: obrasIds.map(obraId => obraPorId.get(obraId)).filter(Boolean),
        entrouHoje: entraramIds.has(id),
        emServico: emServicoIds.has(id),
        checkinHoje,
        obraAtual,
      }
    })

    const saude = dados.obras.reduce((acc, obra) => {
      acc[saudeObra(obra, hoje)] += 1
      return acc
    }, { atrasada: 0, risco: 0, prazo: 0 })

    const pendenciasPorObra = new Map()
    checklistPendentes.forEach(item => {
      const atual = pendenciasPorObra.get(item.obra_id) || { total: 0, itemId: item.id }
      pendenciasPorObra.set(item.obra_id, { total: atual.total + 1, itemId: atual.itemId || item.id })
    })
    const obrasComMaisChecklist = [...pendenciasPorObra.entries()]
      .map(([obraId, pendencia]) => ({ obra: obraPorId.get(obraId), total: pendencia.total, itemId: pendencia.itemId }))
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
      tipo: 'Ocorrência crítica',
      titulo: oc.titulo || oc.descricao || 'Ocorrência sem título',
      detalhe: obraPorId.get(oc.obra_id)?.nome || 'Obra',
      obraId: oc.obra_id,
      aba: 'Ocorrencias',
      params: { ocorrencia: oc.id },
      cor: THEME.danger,
    }))
    tarefasAtrasadas.slice(0, 4).forEach(t => acoes.push({
      tipo: 'Tarefa atrasada',
      titulo: t.titulo || t.descricao || 'Tarefa sem título',
      detalhe: `${obraPorId.get(t.obra_id)?.nome || 'Obra'} - ${dataBR(t.prazo)}`,
      obraId: t.obra_id,
      cor: THEME.danger,
    }))
    obrasComMaisChecklist.slice(0, 4).forEach(item => acoes.push({
      tipo: 'Checklist pendente',
      titulo: item.obra.nome || 'Obra',
      detalhe: `${item.total} item${item.total === 1 ? '' : 's'} pendente${item.total === 1 ? '' : 's'}`,
      obraId: item.obra.id,
      aba: 'Checklist',
      params: item.itemId ? { checklist: item.itemId } : {},
      cor: THEME.warn,
    }))
    dados.obras.forEach(obra => {
      const ultima = fotosPorObra.get(obra.id)
      if (!isConcluido(obra.status) && (!ultima || ultima < seteDiasAtras)) {
        acoes.push({
          tipo: 'Sem foto recente',
          titulo: obra.nome || 'Obra',
          detalhe: ultima ? `Última foto em ${ultima.toLocaleDateString('pt-BR')}` : 'Nenhuma foto registrada',
          obraId: obra.id,
          aba: 'Fotos',
          cor: THEME.blue,
        })
      }
    })

    dados.obras.forEach(obra => {
      const fase = faseKeyObra(obra)
      const diasNaFase = diasDesde(obra.updated_at || obra.created_at || obra.data_inicio || hoje)
      if (fase === 'vistoria_tecnica' && diasNaFase > 3) {
        acoes.push({
          tipo: 'Vistoria técnica',
          titulo: obra.nome || 'Obra',
          detalhe: `Vistoria técnica pendente há ${diasNaFase} dias`,
          obraId: obra.id,
          cor: THEME.warn,
        })
      }
      if (fase === 'entrega_moveis' && !obra.data_inicio_prevista && !obra.data_previsao_inicio) {
        acoes.push({
          tipo: 'Entrega',
          titulo: obra.nome || 'Obra',
          detalhe: 'Entrega não programada',
          obraId: obra.id,
          cor: THEME.blue,
        })
      }
      if (fase === 'montagem_finalizada' && diasNaFase > 2) {
        acoes.push({
          tipo: 'Vistoria final',
          titulo: obra.nome || 'Obra',
          detalhe: 'Vistoria final não agendada',
          obraId: obra.id,
          cor: THEME.danger,
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
        temOcorrencia && 'Ocorrência',
        temChecklist && 'Checklist',
        semFotoRecente && 'Sem foto recente',
      ].filter(Boolean)
      return { ...obra, alertas }
    })

    const statusResumo = {
      emProducao: dados.obras.filter(o => norm(o.status).includes('producao')).length,
      emMontagem: dados.obras.filter(o => norm(o.status).includes('montagem')).length,
      aguardandoCliente: dados.obras.filter(o => norm(o.status).includes('aguard') && norm(o.status).includes('cliente')).length,
      aguardandoProducao: dados.obras.filter(o => norm(o.status).includes('aguard') && norm(o.status).includes('producao')).length,
      concluidas: dados.obras.filter(o => isConcluido(o.status)).length,
      travadas: dados.obras.filter(o => norm(o.status).includes('travad') || norm(o.status).includes('pausad')).length,
    }

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
      aprovacoes: {
        fotosPendentes,
        fotosNaoConformidade: fotosNaoConformidadePendentes,
        vistoriasPendentes: dados.agenda.filter(a => norm(a.tipo || a.titulo).includes('vistoria') && !['realizada', 'concluida', 'concluída'].includes(norm(a.status))),
        gastosPendentes: dados.gastos.filter(g => norm(g.status).includes('pendente')),
        cronogramasTravados: dados.cronogramas.filter(c => c.travado || norm(c.risco) === 'alto'),
      },
      atalhos: {
        primeiraFotoPendente: fotosPendentes[0],
        primeiraNaoConformidade: fotosNaoConformidadePendentes[0] || fotosNaoConformidade[0],
        primeiroChecklistPendente: checklistPendentes[0],
        primeiraOcorrenciaAberta: ocorrenciasAbertas[0],
      },
      obras: obrasDetalhadas,
      acoes: acoes.slice(0, 10),
      statusResumo,
      obraPorId,
    }
  }, [dados, periodo])

  const kpisPrincipais = [
    { label: 'Obras ativas', value: vm.kpis.minhasObras, sub: 'sob responsabilidade', tone: THEME.gold },
    { label: 'Pendências', value: vm.kpis.pendencias, sub: 'tarefas, ocorrências e checklist', tone: vm.kpis.pendencias ? THEME.warn : THEME.success },
    { label: 'Travadas', value: vm.statusResumo.travadas, sub: 'ação imediata', tone: vm.statusResumo.travadas ? THEME.danger : THEME.success, onClick: () => navigate('/obras?status=travada') },
  ]

  const kpisSecundarios = [
    { label: 'Fotos pendentes', value: vm.kpis.fotosPendentes, sub: 'aguardando validação', tone: vm.kpis.fotosPendentes ? THEME.warn : THEME.success },
    { label: 'Check-ins hoje', value: vm.kpis.checkinsHoje, sub: 'movimentações de equipe', tone: THEME.gold },
    { label: 'Em montagem', value: vm.kpis.emMontagem, sub: 'operação ativa', tone: THEME.blue },
  ]

  const statusCards = [
    { label: 'Em produção', value: vm.statusResumo.emProducao, tone: THEME.gold, status: 'em-producao' },
    { label: 'Em montagem', value: vm.statusResumo.emMontagem, tone: THEME.blue, status: 'em-montagem' },
    { label: 'Aguard. cliente', value: vm.statusResumo.aguardandoCliente, tone: THEME.warn, status: 'aguardando-cliente' },
    { label: 'Aguard. produção', value: vm.statusResumo.aguardandoProducao, tone: THEME.gold, status: 'aguardando-producao' },
    { label: 'Concluídas', value: vm.statusResumo.concluidas, tone: THEME.success, status: 'concluida' },
    { label: 'Travadas', value: vm.statusResumo.travadas, tone: THEME.danger, status: 'travada' },
  ]

  const agendaVisivel = [
    { label: 'Montagens', items: vm.agenda.montagens },
    { label: 'Vistorias', items: vm.agenda.vistorias },
    { label: 'Assistências técnicas', items: vm.agenda.assistencias },
    { label: 'Reuniões', items: vm.agenda.reunioes },
  ].filter(item => loading || item.items.length > 0)

  function abrirObraOperacional(obraId, aba = 'Resumo', params = {}) {
    if (!obraId) return
    const query = new URLSearchParams({ aba, ...params })
    navigate(`/obras/${obraId}?${query.toString()}`)
  }

  function abrirAcaoOperacional(acao) {
    if (!acao?.obraId) return
    abrirObraOperacional(acao.obraId, acao.aba || 'Resumo', acao.params || {})
  }

  return (
    <div className="ds-page">
      <style>{css}</style>

      {equipeAberta && (
        <div className="ds-modal" role="dialog" aria-modal="true">
          <div className="ds-modal-card">
            <button className="ds-modal-close" onClick={() => setEquipeAberta(false)}>Fechar</button>
            <span>Equipe em campo</span>
            <h2>Montadores alocados</h2>
            <div className="ds-field-status modal-status">
              <div>
                <strong>{loading ? '-' : vm.checkins.emServico}</strong>
                <span>em serviço</span>
              </div>
              <div>
                <strong>{loading ? '-' : vm.checkins.entraram}</strong>
                <span>entraram hoje</span>
              </div>
              <div className={vm.checkins.aindaNaoEntraram ? 'warn' : ''}>
                <strong>{loading ? '-' : vm.checkins.aindaNaoEntraram}</strong>
                <span>sem entrada</span>
              </div>
            </div>
            <div className="ds-mini-list spaced">
              {loading ? <Empty text="Carregando equipe..." /> : vm.equipe.montadores.length === 0 ? <Empty text="Nenhum montador alocado." /> : vm.equipe.montadores.map(m => (
                <button className="ds-field-person" key={m.id} onClick={() => abrirObraOperacional(m.obraAtual?.id, 'Equipe')}>
                  <span className={m.emServico ? 'on' : m.entrouHoje ? 'done' : 'off'} />
                  <div>
                    <strong>{m.nome}</strong>
                    {m.obraAtual?.nome && <small className="ds-field-work">{m.obraAtual.nome}</small>}
                    <small>{m.emServico ? 'Em serviço agora' : m.entrouHoje ? 'Entrada registrada' : 'Ainda sem check-in'} · {m.obras.length} obra{m.obras.length === 1 ? '' : 's'}</small>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <header className="ds-header">
        <div>
          <div className="ds-eyebrow">Supervisor Ornare</div>
          <h1>Central do Supervisor</h1>
          <p>Obras sob sua responsabilidade, equipe em campo e pendências da semana</p>
        </div>
      </header>

      <div className="ds-period-filter" aria-label="Filtro de período">
        {PERIODOS.map(item => (
          <button
            key={item.id}
            className={periodo === item.id ? 'active' : ''}
            onClick={() => setPeriodo(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="ds-kpis primary-kpis" aria-label="Indicadores principais do supervisor">
        {kpisPrincipais.map(kpi => <Kpi key={kpi.label} {...kpi} loading={loading} />)}
      </section>

      <section className="ds-secondary-metrics">
        <button className="ds-collapse-trigger" onClick={() => setMetricasAberto(v => !v)}>
          {metricasAberto ? 'Ocultar indicadores complementares' : 'Ver indicadores complementares'}
        </button>
        {metricasAberto && (
          <div className="ds-kpis secondary-kpis">
            {kpisSecundarios.map(kpi => <Kpi key={kpi.label} {...kpi} loading={loading} />)}
          </div>
        )}
      </section>

      <section className="ds-status-flow">
        {erroDados && <div className="ds-load-alert">Alguns dados do supervisor nao foram carregados: {erroDados}</div>}
        <Card title="Fluxo Ornare" action={fluxoAberto ? 'Ocultar fluxo' : 'Ver fluxo completo'} onAction={() => setFluxoAberto(v => !v)}>
          {fluxoAberto ? (
            <div className="ds-status-grid">
              {statusCards.map(card => (
                <button
                  key={card.label}
                  className={card.status === 'travada' ? 'urgent' : ''}
                  style={{ borderTopColor: card.tone }}
                  onClick={() => navigate(`/obras?status=${card.status}`)}
                >
                  <strong>{loading ? '-' : card.value}</strong>
                  <span>{card.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <button className="ds-collapsed-note" onClick={() => setFluxoAberto(true)}>
              Ver os 6 status operacionais da carteira
            </button>
          )}
        </Card>
      </section>

      <section className="ds-priorities">
        <Card title="Exigem atenção agora">
          {loading ? <Empty text="Carregando prioridades..." /> : vm.acoes.length === 0 ? <Empty text="Nenhuma prioridade crítica agora." /> : vm.acoes.slice(0, 5).map((acao, i) => (
            <button className={`ds-priority-row ${priorityClass(acao.tipo)}`} key={`${acao.tipo}-${i}`} onClick={() => abrirAcaoOperacional(acao)}>
              <i style={{ background: acao.cor }} />
              <div>
                <span>{acao.tipo}</span>
                <strong>{acao.titulo}</strong>
                <small>{acao.detalhe}</small>
              </div>
            </button>
          ))}
        </Card>
      </section>

      <section className="ds-approval-panel">
        <Card title="Aprovações pendentes">
          <div className="ds-approval-grid">
            <button className={vm.aprovacoes.fotosPendentes.length ? 'warn' : ''} onClick={() => vm.atalhos.primeiraFotoPendente?.obra_id ? abrirObraOperacional(vm.atalhos.primeiraFotoPendente.obra_id, 'Fotos', { foto: vm.atalhos.primeiraFotoPendente.id }) : navigate('/obras?filtro=fotos')}>
              <strong>{loading ? '-' : vm.aprovacoes.fotosPendentes.length}</strong>
              <span>Fotos para validar</span>
            </button>
            <button className={vm.aprovacoes.fotosNaoConformidade.length ? 'danger' : ''} onClick={() => vm.atalhos.primeiraNaoConformidade?.obra_id ? abrirObraOperacional(vm.atalhos.primeiraNaoConformidade.obra_id, 'Fotos', { foto: vm.atalhos.primeiraNaoConformidade.id }) : navigate('/obras?filtro=nao-conformidade')}>
              <strong>{loading ? '-' : vm.aprovacoes.fotosNaoConformidade.length}</strong>
              <span>Não conformidades</span>
            </button>
            <button className={vm.aprovacoes.vistoriasPendentes.length ? 'info' : ''} onClick={() => vm.aprovacoes.vistoriasPendentes[0]?.id ? navigate(`/agenda?compromisso=${vm.aprovacoes.vistoriasPendentes[0].id}`) : navigate('/agenda')}>
              <strong>{loading ? '-' : vm.aprovacoes.vistoriasPendentes.length}</strong>
              <span>Vistorias pendentes</span>
            </button>
            <button className={vm.aprovacoes.gastosPendentes.length ? 'warn' : ''} onClick={() => vm.aprovacoes.gastosPendentes[0]?.obra_id ? navigate(`/obras/${vm.aprovacoes.gastosPendentes[0].obra_id}?aba=Gastos&gasto=${vm.aprovacoes.gastosPendentes[0].id}`) : navigate('/obras?filtro=gastos')}>
              <strong>{loading ? '-' : vm.aprovacoes.gastosPendentes.length}</strong>
              <span>Gastos pendentes</span>
            </button>
            <button className={vm.aprovacoes.cronogramasTravados.length ? 'danger' : ''} onClick={() => vm.aprovacoes.cronogramasTravados[0]?.obra_id ? navigate(`/obras/${vm.aprovacoes.cronogramasTravados[0].obra_id}?aba=Cronograma&cronograma=${vm.aprovacoes.cronogramasTravados[0].id}`) : navigate('/obras?filtro=cronograma')}>
              <strong>{loading ? '-' : vm.aprovacoes.cronogramasTravados.length}</strong>
              <span>Cronogramas travados</span>
            </button>
          </div>
          {vm.aprovacoes.fotosPendentes.length === 0 && vm.aprovacoes.fotosNaoConformidade.length === 0 && vm.aprovacoes.vistoriasPendentes.length === 0 && vm.aprovacoes.gastosPendentes.length === 0 && vm.aprovacoes.cronogramasTravados.length === 0 ? (
            <Empty text="Nada aguardando validação agora." />
          ) : (
            <div className="ds-approval-list">
              {vm.aprovacoes.fotosNaoConformidade.slice(0, 2).map(foto => (
                <button className="danger" key={foto.id} onClick={() => abrirObraOperacional(foto.obra_id, 'Fotos', { foto: foto.id })}>
                  <i />
                  <div>
                    <strong>Não conformidade</strong>
                    <span>{vm.obraPorId.get(foto.obra_id)?.nome || 'Obra'}</span>
                  </div>
                </button>
              ))}
              {vm.aprovacoes.fotosPendentes.slice(0, 3).map(foto => (
                <button key={foto.id} onClick={() => abrirObraOperacional(foto.obra_id, 'Fotos', { foto: foto.id })}>
                  <i />
                  <div>
                    <strong>{foto.categoria || 'Foto enviada'}</strong>
                    <span>{vm.obraPorId.get(foto.obra_id)?.nome || 'Obra'}</span>
                  </div>
                </button>
              ))}
              {vm.aprovacoes.vistoriasPendentes.slice(0, 2).map(item => (
                <button key={item.id} onClick={() => navigate(`/agenda?compromisso=${item.id}`)}>
                  <i className="blue" />
                  <div>
                    <strong>{item.titulo || 'Vistoria pendente'}</strong>
                    <span>{vm.obraPorId.get(item.obra_id)?.nome || 'Obra'} - {dataBR(item.data)}</span>
                  </div>
                </button>
              ))}
              {vm.aprovacoes.gastosPendentes.slice(0, 2).map(gasto => (
                <button key={gasto.id} onClick={() => navigate(`/obras/${gasto.obra_id}?aba=Gastos&gasto=${gasto.id}`)}>
                  <i className="orange" />
                  <div>
                    <strong>{gasto.descricao || 'Gasto pendente'}</strong>
                    <span>{vm.obraPorId.get(gasto.obra_id)?.nome || 'Obra'}</span>
                  </div>
                </button>
              ))}
              {vm.aprovacoes.cronogramasTravados.slice(0, 2).map(crono => (
                <button className="danger" key={crono.id} onClick={() => navigate(`/obras/${crono.obra_id}?aba=Cronograma&cronograma=${crono.id}`)}>
                  <i />
                  <div>
                    <strong>Cronograma travado</strong>
                    <span>{vm.obraPorId.get(crono.obra_id)?.nome || 'Obra'}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="ds-mobile-ops">
        <Card title="Equipe em campo" action="Ver equipe" onAction={() => setEquipeAberta(true)}>
          <div className="ds-field-status">
            <div>
              <strong>{loading ? '-' : vm.checkins.emServico}</strong>
              <span>em serviço</span>
            </div>
            <div>
              <strong>{loading ? '-' : vm.checkins.entraram}</strong>
              <span>entraram hoje</span>
            </div>
            <div className={vm.checkins.aindaNaoEntraram ? 'warn' : ''}>
              <strong>{loading ? '-' : vm.checkins.aindaNaoEntraram}</strong>
              <span>sem entrada</span>
            </div>
          </div>
          <button className="ds-team-open" onClick={() => setEquipeAberta(true)}>Abrir lista completa</button>
        </Card>

        <Card title="Agenda da semana" action="Abrir agenda" onAction={() => navigate('/agenda')}>
          {agendaVisivel.length === 0 ? <Empty text="Nenhum compromisso no período." /> : agendaVisivel.map(item => (
            <MiniAgenda key={item.label} label={item.label} items={item.items} loading={loading} />
          ))}
        </Card>
      </section>

      <section className="ds-grid-3">
        <Card title="Saúde das minhas obras">
          <div className="ds-health">
            <Health label="Atrasadas" value={vm.saude.atrasada} color={THEME.danger} loading={loading} />
            <Health label="Em risco" value={vm.saude.risco} color={THEME.warn} loading={loading} />
            <Health label="No prazo" value={vm.saude.prazo} color={THEME.success} loading={loading} />
          </div>
        </Card>

        <Card title="Agenda da semana" action="Abrir agenda" onAction={() => navigate('/agenda')}>
          {agendaVisivel.length === 0 ? <Empty text="Nenhum compromisso no período." /> : agendaVisivel.map(item => (
            <MiniAgenda key={item.label} label={item.label} items={item.items} loading={loading} />
          ))}
        </Card>

        <Card title="Check-ins de hoje">
          <div className="ds-health">
            <Health label="Entraram" value={vm.checkins.entraram} color={THEME.gold} loading={loading} />
            <Health label="Ainda não" value={vm.checkins.aindaNaoEntraram} color={THEME.warn} loading={loading} />
            <Health label="Em serviço" value={vm.checkins.emServico} color={THEME.success} loading={loading} />
          </div>
        </Card>
      </section>

      <section className="ds-main">
        <div className="ds-stack">
          <Card title="Minhas obras" action="Ver obras" onAction={() => navigate('/obras')}>
            {loading ? <Empty text="Carregando obras..." /> : vm.obras.length === 0 ? <Empty text="Nenhuma obra atribuída." /> : (
              <div className="ds-work-list">
                {vm.obras.slice(0, 10).map(obra => {
                  const st = obraStatus(obra.status)
                  const previsao = obra.data_previsao || obra.data_previsao_entrega
                  return (
                    <button className="ds-work-row" key={obra.id} onClick={() => navigate(`/obras/${obra.id}`)}>
                      <div className="ds-work-main">
                        <strong>{obra.nome || 'Obra sem nome'}</strong>
                        <span>{[obra.cliente_nome, obra.cidade].filter(Boolean).join(' - ') || 'Cliente não informado'}</span>
                        <div className="ds-tags">
                          {obra.alertas.length ? obra.alertas.slice(0, 3).map(a => <em key={a}>{a}</em>) : <em className="ok">Sem alerta</em>}
                        </div>
                      </div>
                      <div className="ds-progress-wrap">
                        <div className="ds-progress"><i style={{ width: `${obra.progresso || 0}%`, background: THEME.gold }} /></div>
                        <b>{Number(obra.progresso || 0)}%</b>
                      </div>
                      <small>{previsao ? dataBR(previsao) : 'Sem previsão'}</small>
                      <span className="ds-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </Card>

          <div className="ds-compact-grid">
            <CompactCard
              title="Checklist"
              value={loading ? '-' : vm.checklist.pendentes}
              suffix={vm.checklist.pendentes === 1 ? 'pendente' : 'pendentes'}
              color={THEME.warn}
              onClick={() => vm.atalhos.primeiroChecklistPendente?.obra_id
                ? abrirObraOperacional(vm.atalhos.primeiroChecklistPendente.obra_id, 'Checklist', { checklist: vm.atalhos.primeiroChecklistPendente.id })
                : navigate('/obras?filtro=checklist')}
            />
            <CompactCard
              title="Fotos"
              value={loading ? '-' : vm.fotos.pendentes}
              suffix={vm.fotos.pendentes === 1 ? 'pendente' : 'pendentes'}
              color={THEME.gold}
              onClick={() => vm.atalhos.primeiraFotoPendente?.obra_id
                ? abrirObraOperacional(vm.atalhos.primeiraFotoPendente.obra_id, 'Fotos', { foto: vm.atalhos.primeiraFotoPendente.id })
                : navigate('/obras?filtro=fotos')}
            />
            <CompactCard
              title="Ocorrências"
              value={loading ? '-' : vm.ocorrencias.abertas}
              suffix={vm.ocorrencias.abertas === 1 ? 'aberta' : 'abertas'}
              color={THEME.danger}
              onClick={() => vm.atalhos.primeiraOcorrenciaAberta?.obra_id
                ? abrirObraOperacional(vm.atalhos.primeiraOcorrenciaAberta.obra_id, 'Ocorrencias', { ocorrencia: vm.atalhos.primeiraOcorrenciaAberta.id })
                : navigate('/ocorrencias')}
            />
          </div>
        </div>

        <div className="ds-stack">
          <Card title="Equipe" action="Ver equipe" onAction={() => setEquipeAberta(true)}>
            <MetricLine label="Montadores alocados" value={vm.equipe.total} color={THEME.gold} loading={loading} />
            <button className="ds-team-open" onClick={() => setEquipeAberta(true)}>Abrir lista completa</button>
          </Card>
        </div>
      </section>

      <button className="ds-fab" onClick={() => navigate('/ocorrencias')}>
        Registrar ocorrência
      </button>
    </div>
  )
}

function priorityClass(tipo) {
  const t = norm(tipo)
  if (t.includes('ocorrencia')) return 'critical'
  if (t.includes('tarefa')) return 'late'
  if (t.includes('checklist')) return 'checklist'
  if (t.includes('foto')) return 'photo'
  return ''
}

function Kpi({ label, value, sub, tone, loading, onClick }) {
  const content = (
    <div className="ds-kpi" style={{ borderTopColor: tone }}>
      <span>{label}</span>
      <strong>{loading ? '-' : value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  )
  if (!onClick) return content
  return <button className="ds-kpi-button" onClick={onClick}>{content}</button>
}

function Card({ title, action, onAction, children }) {
  return (
    <PremiumCard
      title={title}
      className="ds-card"
      action={action ? <button onClick={onAction}>{action}</button> : null}
    >
      {children}
    </PremiumCard>
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
      {primeiro && <small>{dataBR(primeiro.data)} · {primeiro.titulo || primeiro.tipo || 'Agenda'}</small>}
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

function CompactCard({ title, value, suffix, color, onClick }) {
  return (
    <button className="ds-compact-card" onClick={onClick}>
      <span>{title}</span>
      <strong style={{ color }}>{value}</strong>
      <small>{suffix}</small>
    </button>
  )
}

function Empty({ text }) {
  return <EmptyState title={text} />
}

const css = `
.ds-page{min-height:100vh;background:${THEME.bg};padding:30px 34px 52px;color:${THEME.ink};font-family:var(--font-sans);box-sizing:border-box}
.ds-header{width:100%;max-width:none;margin:0 0 22px;display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
.ds-eyebrow{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${THEME.gold};font-weight:800;margin-bottom:7px}
.ds-header h1{font-family:var(--font-serif);font-size:38px;line-height:1.05;font-weight:500;margin:0;color:${THEME.ink}}
.ds-header p{margin:6px 0 0;font-size:13px;color:${THEME.muted}}
.ds-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.ds-actions button{border:1px solid ${THEME.border};background:${THEME.elevated};color:${THEME.ink};border-radius:8px;padding:12px 24px;font-size:13px;font-weight:600;cursor:pointer}
.ds-actions .primary{background:${THEME.gold};border-color:${THEME.gold};color:${THEME.bg}}
.ds-period-filter{width:100%;max-width:none;margin:0 0 14px;display:flex;gap:8px;flex-wrap:wrap}
.ds-period-filter button{border:1px solid ${THEME.gold};background:${THEME.elevated};color:${THEME.ink};border-radius:999px;padding:9px 13px;min-height:44px;font-size:12px;font-weight:900;cursor:pointer;font-family:inherit}
.ds-period-filter button.active{background:${THEME.gold};color:${THEME.bg}}
.ds-secondary-metrics{width:100%;max-width:none;margin:0 0 14px}
.ds-collapse-trigger,.ds-collapsed-note,.ds-team-open{border:1px solid ${THEME.border};background:${THEME.elevated};color:${THEME.ink};border-radius:999px;padding:9px 13px;min-height:44px;font-size:12px;font-weight:900;cursor:pointer;font-family:inherit}
.ds-collapsed-note{width:100%;border-style:dashed;color:${THEME.muted};border-radius:14px;padding:18px;background:${THEME.elevated}}
.ds-priorities{width:100%;max-width:none;margin:0 0 16px}
.ds-status-flow{width:100%;max-width:none;margin:0 0 16px}
.ds-load-alert{width:100%;max-width:none;margin:0 0 12px;border:1px solid rgba(224,82,82,.34);background:rgba(224,82,82,.12);color:${THEME.danger};border-radius:12px;padding:11px 14px;font-size:13px;font-weight:800}
.ds-approval-panel{width:100%;max-width:none;margin:0 0 16px}
.ds-approval-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px}
.ds-approval-grid button{border:1px solid ${THEME.border};background:${THEME.elevated};border-radius:14px;padding:13px;min-height:72px;text-align:left;font-family:inherit;cursor:pointer}
.ds-approval-grid button.warn{border-color:rgba(224,168,82,.5);background:rgba(224,168,82,.13)}
.ds-approval-grid button.danger{border-color:${THEME.danger};background:rgba(224,82,82,.12)}
.ds-approval-grid button.info{border-color:#2563EB;background:#F5F8FF}
.ds-approval-grid strong{display:block;font-size:26px;line-height:1;color:${THEME.ink}}
.ds-approval-grid span{display:block;font-size:11.5px;color:${THEME.muted};font-weight:900;margin-top:7px}
.ds-approval-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px}
.ds-approval-list button{border:1px solid ${THEME.border};background:${THEME.elevated};border-radius:13px;padding:11px;min-height:44px;display:flex;gap:10px;text-align:left;font-family:inherit;cursor:pointer}
.ds-approval-list i{width:9px;height:9px;border-radius:99px;background:${THEME.warn};margin-top:5px;flex-shrink:0}
.ds-approval-list i.blue{background:#2563EB}
.ds-approval-list i.orange{background:${THEME.warn}}
.ds-approval-list button.danger{border-color:${THEME.danger};background:rgba(224,82,82,.12)}
.ds-approval-list button.danger i{background:${THEME.danger}}
.ds-approval-list strong{display:block;font-size:13px;color:${THEME.ink};line-height:1.25}
.ds-approval-list span{display:block;font-size:11.5px;color:${THEME.muted};margin-top:3px}
.ds-mobile-ops{display:none}
.ds-priority-row{width:100%;border:0;border-left:4px solid transparent;background:transparent;border-bottom:1px solid ${THEME.border};padding:12px 12px;min-height:44px;display:flex;gap:11px;align-items:flex-start;text-align:left;cursor:pointer;font-family:inherit;border-radius:12px;margin-bottom:6px}
.ds-priority-row:last-child{border-bottom:0}
.ds-priority-row.critical{border-left-color:${THEME.danger};background:rgba(224,82,82,.12)}
.ds-priority-row.late{border-left-color:${THEME.warn};background:rgba(224,168,82,.12)}
.ds-priority-row.checklist{border-left-color:${THEME.gold};background:#FDFAF5}
.ds-priority-row.photo{border-left-color:${THEME.soft};background:#FAFAFA}
.ds-priority-row i{width:9px;height:9px;border-radius:999px;flex-shrink:0;margin-top:6px}
.ds-priority-row span{display:block;font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:${THEME.gold};font-weight:900;margin-bottom:4px}
.ds-priority-row strong{display:block;font-size:14px;color:${THEME.ink};line-height:1.25}
.ds-priority-row small{display:block;font-size:12px;color:${THEME.muted};line-height:1.35;margin-top:3px}
.ds-kpis{width:100%;max-width:none;margin:0 0 18px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.ds-kpis.secondary-kpis{grid-template-columns:repeat(3,minmax(0,1fr));margin-top:10px;margin-bottom:0}
.ds-kpi-button{border:0;background:transparent;padding:0;text-align:left;font-family:inherit;cursor:pointer}
.ds-kpi-button>*{height:100%}
.ds-kpi{background:${THEME.card};border:1px solid ${THEME.border};border-radius:12px;padding:20px;min-width:0;box-shadow:0 2px 12px rgba(0,0,0,.3)}
.ds-kpi span{display:block;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;font-weight:800;margin-bottom:9px;white-space:nowrap}
.ds-kpi strong{display:block;font-size:34px;line-height:1;color:${THEME.ink}}
.ds-kpi small{display:block;font-size:12px;color:${THEME.muted};margin-top:7px}
.ds-status-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
.ds-status-grid button{border:1px solid ${THEME.border};border-top:3px solid ${THEME.gold};background:${THEME.elevated};border-radius:13px;padding:14px 12px;min-height:72px;text-align:left;font-family:inherit;cursor:pointer}
.ds-status-grid button.urgent{background:rgba(224,82,82,.12);border-color:rgba(224,82,82,.34)}
.ds-status-grid strong{display:block;font-size:28px;line-height:1;color:${THEME.ink};margin-bottom:8px}
.ds-status-grid span{font-size:11px;color:${THEME.muted};font-weight:900;letter-spacing:.6px;text-transform:uppercase}
.ds-grid-3,.ds-main{width:100%;max-width:none;margin:0 0 16px;display:grid;gap:16px}
.ds-grid-3{grid-template-columns:1fr 1.15fr 1fr}
.ds-main{grid-template-columns:minmax(0,1.45fr) minmax(340px,.75fr)}
.ds-stack{display:flex;flex-direction:column;gap:16px}
.ds-card{background:${THEME.card};border:1px solid ${THEME.border};border-radius:12px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,.3);min-width:0}
.ds-card-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px}
.ds-card-head h2{font-size:14px;font-weight:800;margin:0;color:${THEME.ink}}
.ds-card-head button{border:0;background:transparent;color:${THEME.gold};font-size:12px;font-weight:800;cursor:pointer;min-height:44px;text-align:right}
.ds-health,.ds-split{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.ds-split{grid-template-columns:1fr 1fr;margin-bottom:4px}
.ds-health-item,.ds-metric{border:1px solid ${THEME.border};border-radius:12px;padding:12px;background:${THEME.elevated}}
.ds-health-item strong,.ds-metric strong{display:block;font-size:26px;line-height:1}
.ds-health-item span,.ds-metric span{display:block;font-size:12px;color:${THEME.muted};margin-top:6px}
.ds-agenda-block{border-top:1px solid ${THEME.border};padding:10px 0}
.ds-agenda-block:first-of-type{border-top:0;padding-top:0}
.ds-agenda-block>div:first-child{display:flex;align-items:baseline;gap:8px;margin-bottom:5px}
.ds-agenda-block strong{font-size:22px;color:${THEME.gold}}
.ds-agenda-block span{font-size:12px;color:${THEME.muted};font-weight:800}
.ds-agenda-block small{display:block;font-size:11px;color:${THEME.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-work-list{display:flex;flex-direction:column}
.ds-work-row{width:100%;border:0;background:transparent;border-bottom:1px solid ${THEME.border};padding:12px 0;display:grid;grid-template-columns:minmax(0,1fr) 120px auto auto;gap:12px;align-items:center;text-align:left;cursor:pointer;font-family:inherit}
.ds-work-row:last-child{border-bottom:0}
.ds-work-main{min-width:0}
.ds-work-main strong{display:block;font-size:13.5px;color:${THEME.ink};margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-work-main span{display:block;font-size:12px;color:${THEME.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-progress-wrap{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}
.ds-progress{width:100%;height:6px;background:#E0E0E0;border-radius:999px;overflow:hidden}
.ds-progress i{display:block;height:100%;border-radius:999px}
.ds-progress-wrap b{font-size:11px;color:${THEME.ink};font-weight:900}
.ds-work-row>small{font-size:11px;color:${THEME.muted};white-space:nowrap}
.ds-badge{font-size:10px;font-weight:800;border-radius:999px;padding:5px 8px;white-space:nowrap}
.ds-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.ds-tags em{font-style:normal;background:#F7EFE4;color:${THEME.warn};border-radius:999px;padding:4px 8px;font-size:10px;font-weight:800}
.ds-tags em.ok{background:#EAF5EE;color:${THEME.success}}
.ds-action-row{width:100%;border:0;background:transparent;border-bottom:1px solid ${THEME.border};padding:11px 0;display:flex;gap:10px;align-items:flex-start;text-align:left;cursor:pointer;font-family:inherit}
.ds-action-row>span{width:8px;height:8px;border-radius:99px;margin-top:5px;flex-shrink:0}
.ds-action-row strong{display:block;font-size:13px;color:${THEME.ink};font-weight:800}
.ds-action-row small{display:block;font-size:11.5px;color:${THEME.muted};margin-top:2px}
.ds-field-status{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.ds-field-status div{background:${THEME.elevated};border:1px solid ${THEME.border};border-radius:13px;padding:10px}
.ds-field-status div.warn{border-color:rgba(224,168,82,.4);background:rgba(224,168,82,.12)}
.ds-field-status strong{display:block;font-size:22px;line-height:1;color:${THEME.ink}}
.ds-field-status span{display:block;font-size:10.5px;color:${THEME.muted};margin-top:5px;font-weight:800}
.ds-field-person{width:100%;border:0;background:transparent;display:flex;gap:9px;align-items:flex-start;padding:9px 0;border-bottom:1px solid ${THEME.border};text-align:left;font-family:inherit;cursor:pointer;min-height:44px}
.ds-field-person:last-child{border-bottom:0}
.ds-field-person>span{width:9px;height:9px;border-radius:999px;margin-top:5px;background:#CFC7BB;flex-shrink:0}
.ds-field-person>span.on{background:${THEME.success};box-shadow:0 0 0 4px rgba(45,122,74,.08)}
.ds-field-person>span.done{background:${THEME.gold}}
.ds-field-person strong{display:block;font-size:13px;color:${THEME.ink};line-height:1.25;overflow-wrap:anywhere}
.ds-field-person small{display:block;font-size:11.5px;color:${THEME.muted};margin-top:2px}
.ds-field-work{max-width:100%;overflow-wrap:anywhere;color:${THEME.gold}!important;font-weight:800}
.ds-compact-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.ds-compact-card{border:1px solid ${THEME.border};background:${THEME.card};border-radius:12px;padding:20px;min-height:104px;text-align:left;font-family:inherit;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.3)}
.ds-compact-card span{display:block;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:${THEME.muted};font-weight:900;margin-bottom:10px}
.ds-compact-card strong{display:block;font-size:30px;line-height:1}
.ds-compact-card small{display:block;margin-top:6px;color:${THEME.muted};font-size:12px;font-weight:800}
.ds-metric-line,.ds-line{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid ${THEME.border};align-items:center}
.ds-line{width:100%;border-left:0;border-right:0;border-top:0;background:transparent;text-align:left;font-family:inherit}
.ds-metric-line span,.ds-line span{font-size:12.5px;color:${THEME.ink};font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-metric-line strong{font-size:18px}
.ds-line small{font-size:11px;color:${THEME.muted};white-space:nowrap}
.ds-mini-list.spaced{margin-top:12px}
.ds-empty{padding:24px 0;text-align:center;color:#A79F93;font-size:13px}
.ds-modal{position:fixed;inset:0;z-index:80;background:rgba(15,14,12,.52);display:flex;align-items:center;justify-content:center;padding:18px}
.ds-modal-card{width:min(520px,100%);max-height:min(720px,88vh);overflow:auto;background:${THEME.card};border:1px solid ${THEME.border};border-radius:12px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,.3);position:relative}
.ds-modal-close{position:absolute;right:14px;top:14px;border:1px solid ${THEME.border};background:${THEME.elevated};color:${THEME.ink};border-radius:999px;padding:7px 10px;min-height:44px;font-size:12px;font-weight:900;cursor:pointer}
.ds-modal-card>span{display:block;color:${THEME.gold};font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:900;margin-bottom:7px}
.ds-modal-card h2{font-family:var(--font-serif);font-size:27px;font-weight:500;margin:0 0 14px;color:${THEME.ink}}
.modal-status{margin-bottom:8px}
.ds-fab{position:fixed;right:22px;bottom:calc(92px + env(safe-area-inset-bottom));z-index:50;border:0;background:${THEME.gold};color:#fff;border-radius:999px;padding:14px 18px;min-height:44px;font-size:13px;font-weight:950;box-shadow:0 18px 42px rgba(201,169,110,.36);cursor:pointer;font-family:inherit}
@media (max-width:1100px){.ds-grid-3,.ds-main{grid-template-columns:1fr}.ds-work-row{grid-template-columns:minmax(0,1fr) 120px auto auto}.ds-status-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:760px){.ds-page{padding:22px 14px calc(128px + env(safe-area-inset-bottom));display:flex;flex-direction:column}.ds-header{display:block;margin-bottom:12px;order:0}.ds-period-filter{order:1;margin-bottom:10px}.primary-kpis{order:2}.ds-secondary-metrics{order:3}.ds-status-flow{order:4;margin-bottom:12px}.ds-priorities{order:5;margin-bottom:12px}.ds-mobile-ops{display:grid;gap:12px;order:6;margin:0 0 12px;max-width:none;width:100%}.ds-main{order:7}.ds-grid-3{display:none}.ds-eyebrow{font-size:9px;letter-spacing:2px;margin-bottom:4px}.ds-header h1{font-size:28px;line-height:1.02}.ds-header p{font-size:12.5px;line-height:1.45}.ds-period-filter{overflow-x:auto;flex-wrap:nowrap;padding-bottom:2px}.ds-period-filter button{white-space:nowrap;padding:8px 12px}.ds-kpis{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:10px}.ds-kpis.secondary-kpis{grid-template-columns:1fr;gap:8px}.ds-kpi{border-radius:14px;padding:10px 9px;min-width:0;border-top:3px solid rgba(184,150,94,.55)}.ds-kpi span{font-size:9px;line-height:1.1;letter-spacing:.8px;margin-bottom:7px;white-space:normal}.ds-kpi strong{font-size:24px}.ds-kpi small{font-size:10px;line-height:1.25}.ds-kpi-button{width:100%}.ds-collapse-trigger{width:100%;margin-bottom:8px}.ds-status-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ds-status-grid button{padding:11px 10px}.ds-status-grid strong{font-size:22px;margin-bottom:5px}.ds-status-grid span{font-size:9.5px}.ds-main{gap:12px}.ds-card{padding:15px 13px;border-radius:15px}.ds-card-head h2{font-size:19px}.ds-health{grid-template-columns:1fr 1fr 1fr}.ds-work-row{display:block;padding:13px 0}.ds-work-main strong{font-size:15px;line-height:1.2;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.ds-work-main span{font-size:12px}.ds-tags em:nth-child(n+3){display:none}.ds-progress-wrap{grid-template-columns:minmax(0,1fr) auto;margin:10px 0 9px}.ds-work-row>small{display:inline-block;white-space:nowrap;margin-right:8px}.ds-badge{display:inline-flex;align-self:flex-start}.ds-compact-grid{grid-template-columns:1fr}.ds-action-row{padding:12px 0}.ds-split{grid-template-columns:1fr 1fr}.ds-fab{right:16px;bottom:calc(88px + env(safe-area-inset-bottom));padding:13px 16px}.ds-modal{align-items:flex-end;padding:12px}.ds-modal-card{max-height:86vh;border-radius:22px 22px 16px 16px}}
`
