import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { EmptyState, KpiCard as DesignKpiCard, PremiumCard } from '../../components/DesignSystem'
import { limparNome } from '../../utils/ui'
import { theme } from '../../constants/theme'
import { faseOrnarePorKey, faseOrnarePorTexto } from '../../constants/fasesOrnare'

const THEME = {
  bg: theme.background,
  card: theme.surface,
  border: theme.border,
  ink: theme.textPrimary,
  muted: theme.textSecondary,
  gold: theme.gold,
  danger: theme.error,
  success: theme.success,
  warn: theme.warning,
  blue: '#3B5F86',
  elevated: theme.surfaceElevated,
}

const STATUS = {
  producao: ['Em produção', 'Em producao'],
  montagem: ['Em montagem', 'Montagem agendada'],
  aguardandoCliente: ['Aguardando cliente'],
  aguardandoProducao: ['Aguardando início', 'Aguardando inicio', 'Em medição', 'Em medicao', 'Medição agendada', 'Medicao agendada', 'Projeto em conferência', 'Projeto em conferencia'],
  concluidas: ['Concluída', 'Concluida'],
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
  return 'R$ ' + valorSeguro(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

function valorSeguro(valor) {
  const parsed = parseFloat(String(valor ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function tempoRelativo(iso) {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso)) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return Math.floor(diff / 60) + 'min'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h'
  return Math.floor(diff / 86400) + 'd'
}

function diasDesde(value) {
  if (!value) return 999
  const data = new Date(value)
  if (Number.isNaN(data.getTime())) return 999
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  data.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((hoje - data) / 86400000))
}

function faseObra(obra) {
  const fase = faseOrnarePorKey(obra?.fase)
    || faseOrnarePorKey(obra?.fase_atual)
    || faseOrnarePorTexto(obra?.fase || obra?.fase_atual || obra?.status)
  return fase?.label || obra?.fase || obra?.fase_atual || obra?.status || 'Sem fase'
}

function statusBadge(status) {
  if (inStatus({ status }, STATUS.montagem)) return { bg: '#EFF4FA', color: '#1E3A5F', label: status || '-' }
  if (inStatus({ status }, STATUS.producao)) return { bg: '#F0F3EA', color: '#415B34', label: status || '-' }
  if (inStatus({ status }, STATUS.travadas)) return { bg: '#FDECEA', color: '#9E2F2F', label: status || '-' }
  if (inStatus({ status }, STATUS.concluidas)) return { bg: '#E8F5E9', color: '#2E7D32', label: status || '-' }
  return { bg: '#F5F1EA', color: THEME.muted, label: status || '-' }
}

function activityColor(tipo) {
  const t = normalizar(tipo)
  if (t.includes('foto')) return '#9E9E9E'
  if (t.includes('gasto')) return '#E07B39'
  if (t.includes('ocorrencia')) return '#C0392B'
  return THEME.gold
}

function safeArray(result) {
  return result?.data || []
}

function erroConsulta(label, result) {
  if (!result?.error) return null
  return `${label}: ${result.error.message || 'falha ao carregar'}`
}

function mapearCheckinsComPerfis(checkins, profiles) {
  const perfilPorId = new Map((profiles || []).map(profile => [profile.id, profile]))
  return (checkins || []).map(checkin => ({
    ...checkin,
    profiles: perfilPorId.get(checkin.user_id) || null,
  }))
}

function criarDadosVazios() {
  return {
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
    cronogramas: [],
  }
}

function isConcluido(status) {
  return ['concluida', 'concluido', 'finalizada', 'finalizado', 'resolvida', 'resolvido'].includes(normalizar(status))
}

function isAberto(status) {
  const atual = normalizar(status || 'aberta')
  return !isConcluido(atual) && !['fechada', 'fechado', 'cancelada', 'cancelado'].includes(atual)
}

function fotoPendenteAprovacao(foto) {
  return !(foto?.aprovada === true && foto?.aprovada_gestao === true)
}

function statusGasto(gasto) {
  const status = String(gasto?.status || 'aprovado').trim()
  if (status === 'pendente') return 'pendente_aprovacao'
  if (['aprovado', 'pendente_aprovacao', 'recusado'].includes(status)) return status
  return 'aprovado'
}

function gastoContaNoRealizado(gasto) {
  return statusGasto(gasto) === 'aprovado'
}

function rotaObra(obraId, aba, params = {}) {
  if (!obraId) return ''
  const query = new URLSearchParams({ aba })
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value)
  })
  return `/obras/${obraId}?${query.toString()}`
}

export default function DashboardGestao() {
  const navigate = useNavigate()
  const [fluxoAberto, setFluxoAberto] = useState(false)
  const [dados, setDados] = useState(criarDadosVazios)
  const [loading, setLoading] = useState(true)
  const [erroDados, setErroDados] = useState('')

  async function carregar() {
    setLoading(true)
    setErroDados('')
    try {
      const [
        obrasResult,
        agendaResult,
        ocorrenciasResult,
        checkinsResult,
        fotosResult,
        gastosResult,
        tarefasResult,
        profilesResult,
        montadoresResult,
        checklistResult,
        cronogramasResult,
      ] = await Promise.all([
        supabase.from('obras').select('*').order('created_at', { ascending: false }),
        supabase.from('agenda').select('*, obras(nome)').order('data').order('hora_inicio').limit(80),
        supabase.from('ocorrencias').select('*').order('created_at', { ascending: false }).limit(120),
        supabase.from('checkins').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('fotos').select('*, obras(nome)').order('created_at', { ascending: false }).limit(80),
        supabase.from('gastos').select('*, obras(nome)').order('created_at', { ascending: false }),
        supabase.from('tarefas').select('*').order('prazo', { ascending: true }).limit(200),
        supabase.from('profiles').select('id, full_name, email, role'),
        supabase.from('obra_montadores').select('obra_id, montador_id, montador:profiles!obra_montadores_montador_id_fkey(full_name)'),
        supabase.from('checklist_items').select('id, obra_id, descricao, concluido, concluido_em').limit(500),
        supabase.from('obra_cronograma').select('id, obra_id, fase, travado, motivo_trava, risco, updated_at').limit(300),
      ])

      const falhas = [
        erroConsulta('Obras', obrasResult),
        erroConsulta('Agenda', agendaResult),
        erroConsulta('Ocorrencias', ocorrenciasResult),
        erroConsulta('Check-ins', checkinsResult),
        erroConsulta('Fotos', fotosResult),
        erroConsulta('Gastos', gastosResult),
        erroConsulta('Tarefas', tarefasResult),
        erroConsulta('Perfis', profilesResult),
        erroConsulta('Montadores alocados', montadoresResult),
        erroConsulta('Checklist', checklistResult),
        erroConsulta('Cronograma', cronogramasResult),
      ].filter(Boolean)

      if (falhas.length > 0) console.error('Falhas ao carregar DashboardGestao:', falhas)

      setDados({
        obras: safeArray(obrasResult),
        agenda: safeArray(agendaResult),
        ocorrencias: safeArray(ocorrenciasResult),
        checkins: mapearCheckinsComPerfis(safeArray(checkinsResult), safeArray(profilesResult)),
        fotos: safeArray(fotosResult),
        gastos: safeArray(gastosResult),
        tarefas: safeArray(tarefasResult),
        profiles: safeArray(profilesResult),
        montadores: safeArray(montadoresResult),
        checklist: safeArray(checklistResult),
        cronogramas: safeArray(cronogramasResult),
      })
      setErroDados(falhas.join(' / '))
    } catch (error) {
      console.error('Falha inesperada ao carregar DashboardGestao:', error)
      setDados(criarDadosVazios())
      setErroDados(error?.message || 'falha inesperada ao carregar o dashboard')
    } finally {
      setLoading(false)
    }
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
    const amanha = new Date(hoje)
    amanha.setDate(amanha.getDate() + 1)
    const mesAtual = hoje.toISOString().slice(0, 7)
    const ativos = dados.obras.filter(o => !inStatus(o, STATUS.concluidas) && !inStatus(o, STATUS.travadas))

    const ocorrenciasAbertas = dados.ocorrencias.filter(o => isAberto(o.status))
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

    const gastosRealizados = dados.gastos.filter(gastoContaNoRealizado)
    const gastosPorObra = new Map()
    gastosRealizados.forEach(g => {
      if (!g.obra_id) return
      gastosPorObra.set(g.obra_id, (gastosPorObra.get(g.obra_id) || 0) + valorSeguro(g.valor))
    })

    const checklistPendentes = dados.checklist.filter(i => !i.concluido)
    const fotosPendentes = dados.fotos.filter(fotoPendenteAprovacao)
    const naoConformidades = dados.fotos.filter(f => normalizar(f.categoria || f.etapa) === 'nao conformidade')
    const naoConformidadesPendentes = naoConformidades.filter(fotoPendenteAprovacao)
    const tarefasAtrasadas = dados.tarefas.filter(t => t.prazo && t.prazo < hojeStr && !isConcluido(t.status))
    const agenda7 = dados.agenda.filter(a => a.data >= hojeStr && a.data <= em7Str)
    const tipoAgenda = termo => agenda7.filter(a => normalizar(a.tipo || a.titulo).includes(termo))
    const gastosMes = gastosRealizados.filter(g => (g.data || g.created_at || '').slice(0, 7) === mesAtual)
    const gastosPendentes = dados.gastos.filter(g => statusGasto(g) === 'pendente_aprovacao')
    const checkinsHoje = dados.checkins.filter(c => {
      const base = c.entrada || c.created_at
      if (!base) return false
      const data = new Date(base)
      return data >= hoje && data < amanha
    })
    const checkinsAbertosHoje = checkinsHoje.filter(c => !c.saida)
    const montadoresComCheckin = new Set(checkinsHoje.map(c => c.user_id).filter(Boolean))
    const montadoresEmCampo = new Set(checkinsAbertosHoje.map(c => c.user_id).filter(Boolean))
    const checkinsPorObra = new Map()
    dados.checkins.forEach(checkin => {
      if (!checkin.obra_id) return
      const data = new Date(checkin.entrada || checkin.created_at || 0)
      const atual = checkinsPorObra.get(checkin.obra_id)
      if (!atual || data > atual) checkinsPorObra.set(checkin.obra_id, data)
    })

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
      if ((ocorrPorObra.get(obra.id) || []).length > 0) motivos.push('ocorrência aberta')
      if (itens.some(i => !i.concluido)) motivos.push('checklist pendente')
      if (semFotoRecente) motivos.push('sem fotos recentes')
      if (previsao && previsao < hoje) motivos.push('atrasada')
      return { obra, motivos }
    }).filter(item => item.motivos.length > 0).slice(0, 7)

    const obrasSemCheckinRecente = ativos
      .map(obra => ({ obra, ultima: checkinsPorObra.get(obra.id) }))
      .filter(item => !item.ultima || diasDesde(item.ultima) > 2)
      .sort((a, b) => (b.ultima?.getTime() || 0) - (a.ultima?.getTime() || 0))

    const checklistPorObraPendentes = [...checklistPorObra.entries()]
      .map(([obraId, itens]) => ({
        obraId,
        nome: obraNome(dados.obras, obraId),
        total: itens.filter(i => !i.concluido).length,
        itemId: itens.find(i => !i.concluido)?.id,
      }))
      .filter(item => item.total > 0)
      .sort((a, b) => b.total - a.total)

    const fotosPendentesPorObra = [...fotosPorObra.entries()]
      .map(([obraId, fotos]) => ({
        obraId,
        nome: obraNome(dados.obras, obraId),
        total: fotos.filter(fotoPendenteAprovacao).length,
        fotoId: fotos.find(fotoPendenteAprovacao)?.id,
      }))
      .filter(item => item.total > 0)
      .sort((a, b) => b.total - a.total)

    const atrasadasPorFase = saude
      .filter(s => s.atrasada)
      .reduce((acc, item) => {
        const fase = faseObra(item.obra)
        acc.set(fase, (acc.get(fase) || 0) + 1)
        return acc
      }, new Map())

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
      .map(p => ({ nome: limparNome(p.full_name || p.email || 'Supervisor'), total: dados.obras.filter(o => o.supervisor_id === p.id).length }))
      .filter(p => p.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    const atividade = [
      ...dados.fotos.slice(0, 8).map(f => ({ tipo: 'Foto', texto: f.categoria || 'Nova foto enviada', sub: f.obras?.nome || obraNome(dados.obras, f.obra_id), ts: f.created_at })),
      ...dados.ocorrencias.slice(0, 8).map(o => ({ tipo: 'Ocorrência', texto: o.titulo || o.descricao || 'Ocorrência registrada', sub: obraNome(dados.obras, o.obra_id), ts: o.created_at })),
      ...dados.checklist.filter(i => i.concluido && i.concluido_em).slice(0, 8).map(i => ({ tipo: 'Checklist', texto: i.descricao || 'Item concluído', sub: obraNome(dados.obras, i.obra_id), ts: i.concluido_em })),
      ...dados.checkins.slice(0, 8).map(c => ({ tipo: 'Equipe', texto: `${limparNome(c.profiles?.full_name) || 'Equipe'} fez ${c.saida ? 'check-out' : 'check-in'}`, sub: obraNome(dados.obras, c.obra_id), ts: c.created_at })),
      ...dados.gastos.slice(0, 8).map(g => ({ tipo: 'Gasto', texto: g.descricao || 'Gasto lançado', sub: `${g.obras?.nome || obraNome(dados.obras, g.obra_id)} - ${moeda(g.valor)}`, ts: g.created_at })),
    ].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 10)

    const pendenciasCriticasExecutivas = [
      ...ocorrenciasAbertas.slice(0, 3).map(o => ({ id: `oc-${o.id}`, tipo: 'Ocorrencia aberta', titulo: o.titulo || o.descricao || 'Ocorrencia sem titulo', obraId: o.obra_id, detalhe: obraNome(dados.obras, o.obra_id), rota: rotaObra(o.obra_id, 'Ocorrencias', { ocorrencia: o.id }) })),
      ...checklistPendentes.slice(0, 3).map(i => ({ id: `ck-${i.id}`, tipo: 'Checklist pendente', titulo: i.descricao || 'Checklist pendente', obraId: i.obra_id, detalhe: obraNome(dados.obras, i.obra_id), rota: rotaObra(i.obra_id, 'Checklist', { checklist: i.id }) })),
      ...tarefasAtrasadas.slice(0, 3).map(t => ({ id: `ta-${t.id}`, tipo: 'Tarefa atrasada', titulo: t.titulo || t.descricao || 'Tarefa atrasada', obraId: t.obra_id, detalhe: obraNome(dados.obras, t.obra_id), rota: `/tarefas?tarefa=${t.id}` })),
    ].slice(0, 5)

    return {
      hojeStr,
      travadasLista: dados.obras
        .filter(o => inStatus(o, STATUS.travadas) || (ocorrPorObra.get(o.id) || []).some(oc => normalizar(oc.gravidade) === 'alta'))
        .slice(0, 4),
      riscoLista: saude.filter(s => s.atrasada || s.risco).map(s => s.obra).slice(0, 4),
      obrasSemCheckinRecente,
      checklistPorObraPendentes,
      fotosPendentesPorObra,
      atrasadasPorFase: [...atrasadasPorFase.entries()].map(([fase, total]) => ({ fase, total })).sort((a, b) => b.total - a.total),
      operacao: {
        andamento: ativos.length,
        producao: dados.obras.filter(o => inStatus(o, STATUS.producao)).length,
        montagem: dados.obras.filter(o => inStatus(o, STATUS.montagem)).length,
        aguardandoCliente: dados.obras.filter(o => inStatus(o, STATUS.aguardandoCliente)).length,
        aguardandoProducao: dados.obras.filter(o => inStatus(o, STATUS.aguardandoProducao)).length,
        concluidas: dados.obras.filter(o => inStatus(o, STATUS.concluidas)).length,
        travadas: dados.obras.filter(o => inStatus(o, STATUS.travadas) || (ocorrPorObra.get(o.id) || []).some(oc => normalizar(oc.gravidade) === 'alta')).length + dados.cronogramas.filter(c => c.travado || normalizar(c.risco) === 'alto').length,
      },
      saude: {
        atrasadas: saude.filter(s => s.atrasada).length,
        risco: saude.filter(s => !s.atrasada && s.risco).length,
        prazo: saude.filter(s => !s.atrasada && !s.risco).length,
      },
      equipe: {
        supervisores: dados.profiles.filter(p => ['gestao', 'supervisor'].includes(p.role)).length,
        montadores: new Set(dados.montadores.map(m => m.montador_id)).size,
        checkinsHoje: checkinsHoje.length,
        montadoresComCheckin: montadoresComCheckin.size,
        montadoresEmCampo: montadoresEmCampo.size,
        obrasPorSupervisor,
      },
      agenda7: {
        montagens: tipoAgenda('montagem'),
        vistorias: tipoAgenda('vistoria'),
        assistencias: agenda7.filter(a => normalizar(a.tipo || a.titulo).includes('assistencia') || normalizar(a.tipo || a.titulo).includes('tecnica')),
      },
      pendencias: {
        ocorrenciasAbertas,
        naoConformidades,
        tarefasAtrasadas,
        checklistPendentes,
      },
      aprovacoes: {
        fotosPendentes,
        fotosCliente: fotosPendentes.filter(f => f.visivel_cliente),
        checklistPendentes,
        naoConformidades,
        vistoriasPendentes: dados.agenda.filter(a => normalizar(a.tipo || a.titulo).includes('vistoria') && !isConcluido(a.status)),
        gastosPendentes,
        cronogramasTravados: dados.cronogramas.filter(c => c.travado || normalizar(c.risco) === 'alto'),
        naoConformidadesPendentes,
      },
      financeiro: {
        totalMes: gastosMes.reduce((s, g) => s + valorSeguro(g.valor), 0),
        totalOperacional: gastosRealizados.reduce((s, g) => s + valorSeguro(g.valor), 0),
        gastosMes,
        topObras: [...gastosPorObra.entries()].map(([obraId, total]) => ({ obraId, nome: obraNome(dados.obras, obraId), total })).sort((a, b) => b.total - a.total).slice(0, 5),
        acimaMeta: dados.obras.filter(o => valorSeguro(o.gasto_meta) > 0 && (gastosPorObra.get(o.id) || 0) >= valorSeguro(o.gasto_meta) * 0.9),
        pertoMeta: dados.obras.filter(o => {
          const meta = valorSeguro(o.gasto_meta)
          const usado = gastosPorObra.get(o.id) || 0
          return meta > 0 && usado >= meta * 0.7 && usado < meta * 0.9
        }),
      },
      fluxo,
      atencao,
      atividade,
      obrasOperacionais: ativos.slice(0, 8),
      pendenciasCriticasExecutivas,
      ocorrPorObra,
    }
  }, [dados])

  const kpisExecutivos = [
    { label: 'Em andamento', value: vm.operacao.andamento, sub: 'operação ativa', tone: THEME.gold, onClick: () => navigate('/obras') },
    { label: 'Montadores em campo', value: vm.equipe.montadoresEmCampo, sub: `${vm.equipe.montadoresComCheckin} com check-in`, tone: THEME.blue, onClick: () => navigate('/dashboard?painel=equipe') },
    { label: 'Check-ins hoje', value: vm.equipe.checkinsHoje, sub: 'movimentações do dia', tone: THEME.success, onClick: () => navigate('/dashboard?painel=checkins') },
    { label: 'Sem check-in recente', value: vm.obrasSemCheckinRecente.length, sub: 'obra sem visita recente', tone: vm.obrasSemCheckinRecente.length ? THEME.warn : THEME.success, onClick: () => vm.obrasSemCheckinRecente[0]?.obra?.id ? navigate(`/obras/${vm.obrasSemCheckinRecente[0].obra.id}?aba=Equipe`) : navigate('/obras') },
    { label: 'Fotos pendentes', value: vm.aprovacoes.fotosPendentes.length, sub: 'aguardando validação', tone: vm.aprovacoes.fotosPendentes.length ? THEME.warn : THEME.success, onClick: () => vm.aprovacoes.fotosPendentes[0]?.obra_id ? navigate(`/obras/${vm.aprovacoes.fotosPendentes[0].obra_id}?aba=Fotos&foto=${vm.aprovacoes.fotosPendentes[0].id}`) : navigate('/obras?filtro=fotos') },
    { label: 'Travadas', value: vm.operacao.travadas, sub: 'ação imediata', tone: THEME.danger, onClick: () => navigate('/planejamento?filtro=travadas') },
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

      {erroDados && <div className="dg-load-alert">Parte dos dados não foi carregada: {erroDados}</div>}

      <section className="dg-mobile-home" aria-label="Resumo executivo">
        <button className={vm.operacao.travadas ? 'critical' : ''} onClick={() => navigate('/obras')}>
          <strong>{loading ? '-' : vm.operacao.travadas}</strong>
          <span>travadas</span>
        </button>
        <button className={vm.pendenciasCriticasExecutivas.length ? 'warn' : ''} onClick={() => navigate('/ocorrencias')}>
          <strong>{loading ? '-' : vm.pendenciasCriticasExecutivas.length}</strong>
          <span>pendências</span>
        </button>
        <button className={vm.saude.risco ? 'warn' : ''} onClick={() => navigate('/planejamento')}>
          <strong>{loading ? '-' : vm.saude.risco}</strong>
          <span>em risco</span>
        </button>
        <div className="dg-mobile-quick">
          <button onClick={() => navigate('/obras')}>Obras</button>
          <button onClick={() => navigate('/agenda')}>Agenda</button>
          <button onClick={() => navigate('/planejamento')}>Planejamento</button>
        </div>
      </section>

      <section className="dg-kpis" aria-label="Indicadores operacionais">
        {kpisExecutivos.map(k => <Kpi key={k.label} {...k} loading={loading} />)}
      </section>

      <section className="dg-productivity-grid" aria-label="Produtividade operacional">
        <Card title="Campo hoje" action="Equipe" onAction={() => navigate('/equipe')}>
          <MetricLine label="Montadores em campo" value={vm.equipe.montadoresEmCampo} color={THEME.success} />
          <MetricLine label="Check-ins registrados" value={vm.equipe.checkinsHoje} color={THEME.gold} />
          <MetricLine label="Obras sem check-in recente" value={vm.obrasSemCheckinRecente.length} color={vm.obrasSemCheckinRecente.length ? THEME.warn : THEME.success} />
          <div className="dg-mini-list">
            {vm.obrasSemCheckinRecente.slice(0, 3).map(item => (
              <button className="dg-line-button" key={item.obra.id} onClick={() => navigate(`/obras/${item.obra.id}?aba=Equipe`)}>
                <span>{item.obra.nome}</span>
                <small>{item.ultima ? `Último check-in há ${diasDesde(item.ultima)}d` : 'Sem check-in'}</small>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Pendências por obra" action="Obras" onAction={() => navigate('/obras')}>
          <MetricLine label="Fotos pendentes" value={vm.aprovacoes.fotosPendentes.length} color={THEME.warn} />
          <MetricLine label="Checklist pendente" value={vm.aprovacoes.checklistPendentes.length} color={THEME.gold} />
          <div className="dg-mini-list">
            {vm.fotosPendentesPorObra.slice(0, 2).map(item => (
              <button className="dg-line-button" key={`foto-${item.obraId}`} onClick={() => navigate(`/obras/${item.obraId}?aba=Fotos${item.fotoId ? `&foto=${item.fotoId}` : ''}`)}>
                <span>{item.nome}</span>
                <small>{item.total} foto{item.total === 1 ? '' : 's'}</small>
              </button>
            ))}
            {vm.checklistPorObraPendentes.slice(0, 2).map(item => (
              <button className="dg-line-button" key={`check-${item.obraId}`} onClick={() => navigate(`/obras/${item.obraId}?aba=Checklist${item.itemId ? `&checklist=${item.itemId}` : ''}`)}>
                <span>{item.nome}</span>
                <small>{item.total} checklist</small>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Atrasos e metas" action="Planejamento" onAction={() => navigate('/planejamento')}>
          <MetricLine label="Obras atrasadas" value={vm.saude.atrasadas} color={THEME.danger} />
          <MetricLine label="Gastos próximos/acima da meta" value={vm.financeiro.pertoMeta.length + vm.financeiro.acimaMeta.length} color={THEME.warn} />
          <div className="dg-mini-list">
            {vm.atrasadasPorFase.slice(0, 3).map(item => <Line key={item.fase} title={item.fase} meta={`${item.total} atrasada${item.total === 1 ? '' : 's'}`} />)}
            {vm.financeiro.acimaMeta.slice(0, 2).map(obra => (
              <button className="dg-line-button" key={`meta-${obra.id}`} onClick={() => navigate(`/obras/${obra.id}?aba=Gastos`)}>
                <span>{obra.nome}</span>
                <small>meta crítica</small>
              </button>
            ))}
          </div>
        </Card>
      </section>

      <section className="dg-priority-board">
        <Card title="Exigem atenção agora" action="Abrir obras" onAction={() => navigate('/obras')}>
          {vm.atencao.length === 0 ? <Empty text="Nenhuma pendência crítica." /> : vm.atencao.slice(0, 4).map(item => (
            <button className="dg-attention dg-attention-priority" key={item.obra.id} onClick={() => navigate(`/obras/${item.obra.id}`)}>
              <div>
                <strong>{item.obra.nome}</strong>
                <span>{item.obra.cliente_nome || item.obra.cidade || 'Sem cliente informado'}</span>
              </div>
              <div className="dg-tags">{item.motivos.slice(0, 3).map(m => <span key={m}>{m}</span>)}</div>
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
          {vm.pendenciasCriticasExecutivas.length === 0 ? <Empty text="Nenhuma pendência crítica." /> : vm.pendenciasCriticasExecutivas.map(item => (
            <button className="dg-priority-row compact" key={item.id} disabled={!item.rota && !item.obraId} onClick={() => navigate(item.rota || `/obras/${item.obraId}`)}>
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

      <section className="dg-approval-panel">
        <Card title="Aprovações pendentes" action="Fotos" onAction={() => navigate('/obras')}>
          <div className="dg-approval-grid">
            <button className={vm.aprovacoes.fotosPendentes.length ? 'warn' : ''} disabled={!vm.aprovacoes.fotosPendentes[0]?.obra_id} onClick={() => navigate(`/obras/${vm.aprovacoes.fotosPendentes[0].obra_id}?aba=Fotos&foto=${vm.aprovacoes.fotosPendentes[0].id}`)}>
              <strong>{loading ? '-' : vm.aprovacoes.fotosPendentes.length}</strong>
              <span>Fotos para aprovar</span>
            </button>
            <button className={vm.aprovacoes.checklistPendentes.length ? 'warn' : ''} disabled={!vm.aprovacoes.checklistPendentes[0]?.obra_id} onClick={() => navigate(`/obras/${vm.aprovacoes.checklistPendentes[0].obra_id}?aba=Checklist&checklist=${vm.aprovacoes.checklistPendentes[0].id}`)}>
              <strong>{loading ? '-' : vm.aprovacoes.checklistPendentes.length}</strong>
              <span>Checklist pendente</span>
            </button>
            <button className={vm.aprovacoes.fotosCliente.length ? 'hot' : ''} disabled={!vm.aprovacoes.fotosCliente[0]?.obra_id} onClick={() => navigate(`/obras/${vm.aprovacoes.fotosCliente[0].obra_id}?aba=Fotos&foto=${vm.aprovacoes.fotosCliente[0].id}`)}>
              <strong>{loading ? '-' : vm.aprovacoes.fotosCliente.length}</strong>
              <span>Cliente aguardando</span>
            </button>
            <button className={vm.aprovacoes.naoConformidades.length ? 'danger' : ''} disabled={!vm.aprovacoes.naoConformidades[0]?.obra_id} onClick={() => navigate(`/obras/${vm.aprovacoes.naoConformidades[0].obra_id}?aba=Fotos&foto=${vm.aprovacoes.naoConformidades[0].id}`)}>
              <strong>{loading ? '-' : vm.aprovacoes.naoConformidades.length}</strong>
              <span>Não conformidades</span>
            </button>
            <button className={vm.aprovacoes.vistoriasPendentes.length ? 'info' : ''} disabled={!vm.aprovacoes.vistoriasPendentes[0]?.id} onClick={() => navigate(`/agenda?compromisso=${vm.aprovacoes.vistoriasPendentes[0].id}`)}>
              <strong>{loading ? '-' : vm.aprovacoes.vistoriasPendentes.length}</strong>
              <span>Vistorias pendentes</span>
            </button>
            <button className={vm.aprovacoes.gastosPendentes.length ? 'hot' : ''} onClick={() => vm.aprovacoes.gastosPendentes[0]?.obra_id ? navigate(`/obras/${vm.aprovacoes.gastosPendentes[0].obra_id}?aba=Gastos&gasto=${vm.aprovacoes.gastosPendentes[0].id}`) : navigate('/gastos')}>
              <strong>{loading ? '-' : vm.aprovacoes.gastosPendentes.length}</strong>
              <span>Gastos pendentes</span>
            </button>
            <button className={vm.aprovacoes.cronogramasTravados.length ? 'danger' : ''} disabled={!vm.aprovacoes.cronogramasTravados[0]?.obra_id} onClick={() => navigate(`/obras/${vm.aprovacoes.cronogramasTravados[0].obra_id}?aba=Cronograma&cronograma=${vm.aprovacoes.cronogramasTravados[0].id}`)}>
              <strong>{loading ? '-' : vm.aprovacoes.cronogramasTravados.length}</strong>
              <span>Cronogramas travados</span>
            </button>
          </div>
          {vm.aprovacoes.fotosPendentes.length === 0 && vm.aprovacoes.checklistPendentes.length === 0 && vm.aprovacoes.fotosCliente.length === 0 && vm.aprovacoes.naoConformidades.length === 0 && vm.aprovacoes.vistoriasPendentes.length === 0 && vm.aprovacoes.gastosPendentes.length === 0 && vm.aprovacoes.cronogramasTravados.length === 0 ? (
            <Empty text="Nada aguardando aprovação agora." />
          ) : (
            <div className="dg-approval-list">
              {vm.aprovacoes.naoConformidades.slice(0, 2).map(foto => (
                <button className="danger" key={foto.id} onClick={() => navigate(`/obras/${foto.obra_id}?aba=Fotos&foto=${foto.id}`)}>
                  <i />
                  <div>
                    <strong>Não conformidade</strong>
                    <span>{foto.obras?.nome || obraNome(dados.obras, foto.obra_id)}</span>
                  </div>
                </button>
              ))}
              {vm.aprovacoes.fotosPendentes.slice(0, 3).map(foto => (
                <button className={foto.visivel_cliente ? 'hot' : ''} key={foto.id} onClick={() => navigate(`/obras/${foto.obra_id}?aba=Fotos&foto=${foto.id}`)}>
                  <i />
                  <div>
                    <strong>{foto.visivel_cliente ? 'Foto liberada ao cliente' : (foto.categoria || 'Foto enviada')}</strong>
                    <span>{foto.obras?.nome || obraNome(dados.obras, foto.obra_id)}</span>
                  </div>
                </button>
              ))}
              {vm.aprovacoes.checklistPendentes.slice(0, 3).map(item => (
                <button key={item.id} onClick={() => navigate(`/obras/${item.obra_id}?aba=Checklist&checklist=${item.id}`)}>
                  <i />
                  <div>
                    <strong>{item.descricao || 'Checklist pendente'}</strong>
                    <span>{obraNome(dados.obras, item.obra_id)}</span>
                  </div>
                </button>
              ))}
              {vm.aprovacoes.vistoriasPendentes.slice(0, 2).map(item => (
                <button key={item.id} onClick={() => navigate(`/agenda?compromisso=${item.id}`)}>
                  <i className="blue" />
                  <div>
                    <strong>{item.titulo || 'Vistoria pendente'}</strong>
                    <span>{item.obras?.nome || obraNome(dados.obras, item.obra_id)} - {dataBR(item.data)}</span>
                  </div>
                </button>
              ))}
              {vm.aprovacoes.gastosPendentes.slice(0, 2).map(gasto => (
                <button className="hot" key={gasto.id} onClick={() => gasto.obra_id ? navigate(`/obras/${gasto.obra_id}?aba=Gastos&gasto=${gasto.id}`) : navigate('/gastos')}>
                  <i className="orange" />
                  <div>
                    <strong>{gasto.descricao || 'Gasto pendente'}</strong>
                    <span>{gasto.obras?.nome || obraNome(dados.obras, gasto.obra_id)} - {moeda(gasto.valor)}</span>
                  </div>
                </button>
              ))}
              {vm.aprovacoes.cronogramasTravados.slice(0, 2).map(crono => (
                <button className="danger" key={crono.id} onClick={() => navigate(`/obras/${crono.obra_id}?aba=Cronograma&cronograma=${crono.id}`)}>
                  <i />
                  <div>
                    <strong>Cronograma travado</strong>
                    <span>{obraNome(dados.obras, crono.obra_id)}{crono.motivo_trava ? ` - ${crono.motivo_trava}` : ''}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="dg-agenda-mobile">
        <Card title="Agenda dos próximos dias" action="Agenda" onAction={() => navigate('/agenda')}>
          <MiniAgenda label="Montagens" itens={vm.agenda7.montagens} />
          <MiniAgenda label="Vistorias" itens={vm.agenda7.vistorias} />
          <MiniAgenda label="Assist. técnicas" itens={vm.agenda7.assistencias} />
        </Card>
      </section>

      <section className="dg-grid-3">
        <Card title="Saúde operacional" action="Ver obras" onAction={() => navigate('/obras')}>
          <div className="dg-health">
            <Health label="Atrasadas" value={vm.saude.atrasadas} color={THEME.danger} />
            <Health label="Em risco" value={vm.saude.risco} color={THEME.warn} />
            <Health label="No prazo" value={vm.saude.prazo} color={THEME.success} />
          </div>
        </Card>

        <Card title="Próximos 7 dias" action="Agenda" onAction={() => navigate('/agenda')}>
          <MiniAgenda label="Montagens" itens={vm.agenda7.montagens} />
          <MiniAgenda label="Vistorias" itens={vm.agenda7.vistorias} />
          <MiniAgenda label="Assist. técnicas" itens={vm.agenda7.assistencias} />
        </Card>

        <Card title="Equipe">
          <div className="dg-team-kpis">
            <Health label="Supervisores" value={vm.equipe.supervisores} color={THEME.gold} />
            <Health label="Montadores" value={vm.equipe.montadores} color={THEME.blue} />
          </div>
          <MetricLine label="Montadores em campo" value={vm.equipe.montadoresEmCampo} color={THEME.success} />
          <MetricLine label="Check-ins hoje" value={vm.equipe.checkinsHoje} color={THEME.gold} />
          <div className="dg-mini-list">
            {vm.equipe.obrasPorSupervisor.length === 0 ? <Empty text="Sem obras por supervisor." /> : vm.equipe.obrasPorSupervisor.map(s => (
              <Line key={s.nome} title={s.nome} meta={`${s.total} obra${s.total === 1 ? '' : 's'}`} />
            ))}
          </div>
        </Card>
      </section>

      <section className="dg-main">
        <div className="dg-stack">
          <Card title="Fluxo Ornare" action={fluxoAberto ? 'Ocultar fluxo' : 'Ver fluxo completo'} onAction={() => setFluxoAberto(v => !v)}>
            {fluxoAberto ? (
              <div className="dg-flow">
                {vm.fluxo.map((f, i) => (
                  <div className="dg-flow-step" key={f.label}>
                    <div className="dg-flow-num">{loading ? '-' : f.value}</div>
                    <div className="dg-flow-label">{f.label}</div>
                    {i < vm.fluxo.length - 1 && <div className="dg-flow-line" />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="dg-flow-summary">
                {vm.fluxo.slice(0, 3).map(f => (
                  <span key={f.label}><strong>{loading ? '-' : f.value}</strong>{f.label}</span>
                ))}
              </div>
            )}
          </Card>

          <Card title="Operação em andamento" action="Ver todas" onAction={() => navigate('/obras')}>
            {vm.obrasOperacionais.length === 0 ? <Empty text="Sem obras operacionais." /> : vm.obrasOperacionais.map(obra => {
              const st = statusBadge(obra.status)
              const temOc = (vm.ocorrPorObra.get(obra.id) || []).length > 0
              return (
                <button className="dg-work-row" key={obra.id} onClick={() => navigate(`/obras/${obra.id}`)}>
                  <div className="dg-work-main">
                    <strong>{obra.nome}</strong>
                    <span>{[obra.cliente_nome, obra.cidade, obra.data_previsao ? `Prev. ${dataBR(obra.data_previsao)}` : null].filter(Boolean).join(' · ')}</span>
                  </div>
                  <div className="dg-progress-wrap">
                    <div className="dg-progress"><i style={{ width: `${obra.progresso || 0}%`, background: temOc ? THEME.danger : THEME.gold }} /></div>
                    <b>{obra.progresso || 0}%</b>
                  </div>
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
            <MetricLine label="Checklist pendente" value={vm.pendencias.checklistPendentes.length} color={THEME.gold} />
            <MetricLine label="Tarefas atrasadas" value={vm.pendencias.tarefasAtrasadas.length} color={THEME.blue} />
            <div className="dg-mini-list">
              {vm.pendencias.tarefasAtrasadas.slice(0, 4).map(t => <Line key={t.id} title={t.titulo || 'Tarefa atrasada'} meta={obraNome(dados.obras, t.obra_id)} />)}
            </div>
          </Card>

          <Card title="Financeiro operacional" action="Gastos" onAction={() => navigate('/gastos')}>
            <div className="dg-money">{moeda(vm.financeiro.totalMes)}</div>
            <div className="dg-muted">{vm.financeiro.gastosMes.length} lançamento{vm.financeiro.gastosMes.length === 1 ? '' : 's'} no mês</div>
            <MetricLine label="Total operacional" value={moeda(vm.financeiro.totalOperacional)} color={THEME.gold} />
            <MetricLine label="Gastos pendentes" value={vm.aprovacoes.gastosPendentes.length} color={THEME.warn} />
            <MetricLine label="Obras próximas da meta" value={vm.financeiro.pertoMeta.length} color={THEME.warn} />
            <MetricLine label="Obras críticas/acima da meta" value={vm.financeiro.acimaMeta.length} color={THEME.danger} />
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
                <span style={{ color: activityColor(a.tipo) }}>{a.tipo}</span>
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

function Kpi({ label, value, sub, tone, loading, onClick }) {
  const content = (
    <DesignKpiCard label={label} value={loading ? '-' : value} helper={sub} tone={tone === THEME.danger ? 'danger' : tone === THEME.success ? 'success' : tone === THEME.warn ? 'warning' : 'gold'} />
  )
  if (!onClick) return content
  return <button className="dg-kpi-button" onClick={onClick}>{content}</button>
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
.dg-page{min-height:100vh;background:${THEME.bg};padding:30px 34px 52px;color:${THEME.ink};font-family:var(--font-sans);box-sizing:border-box;display:flex;flex-direction:column}
.dg-header{width:100%;max-width:none;margin:0 0 20px;display:flex;justify-content:space-between;gap:18px;align-items:flex-start;box-sizing:border-box;order:0}
.dg-eyebrow{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${THEME.gold};font-weight:800;margin-bottom:7px}
.dg-header h1{font-family:var(--font-serif);font-size:38px;line-height:1.05;font-weight:500;margin:0;color:${THEME.ink}}
.dg-header p{margin:6px 0 0;font-size:13px;color:${THEME.muted}}
.dg-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.dg-actions button{border:1px solid ${THEME.border};background:${THEME.elevated};color:${THEME.ink};border-radius:8px;padding:12px 24px;min-height:44px;font-size:13px;font-weight:600;cursor:pointer}
.dg-actions .primary{background:${THEME.gold};border-color:${THEME.gold};color:${THEME.bg}}
.dg-load-alert{width:100%;max-width:none;margin:0 0 12px;border:1px solid rgba(224,82,82,.34);background:rgba(224,82,82,.12);color:${THEME.danger};border-radius:12px;padding:11px 14px;font-size:13px;font-weight:800}
.dg-mobile-home{display:none}
.dg-priority-board{width:100%;max-width:none;margin:0 0 16px;display:grid;grid-template-columns:1.35fr .95fr 1.1fr .95fr;gap:12px;order:2}
.dg-productivity-grid{width:100%;max-width:none;margin:0 0 16px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;order:4}
.dg-agenda-mobile{width:100%;max-width:none;margin:0 0 16px;order:6}
.dg-approval-panel{width:100%;max-width:none;margin:0 0 16px;order:5}
.dg-approval-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px}
.dg-approval-grid button{border:1px solid ${THEME.border};background:${THEME.elevated};border-radius:14px;padding:13px;min-height:72px;text-align:left;font-family:inherit;cursor:pointer}
.dg-approval-grid button:disabled{cursor:not-allowed;opacity:.5}
.dg-approval-grid button.warn{border-color:rgba(224,168,82,.5);background:rgba(224,168,82,.13)}
.dg-approval-grid button.hot{border-color:rgba(224,123,57,.55);background:rgba(224,123,57,.12)}
.dg-approval-grid button.danger{border-color:${THEME.danger};background:rgba(224,82,82,.12)}
.dg-approval-grid button.info{border-color:#2563EB;background:#F5F8FF}
.dg-approval-grid strong{display:block;font-size:26px;line-height:1;color:${THEME.ink}}
.dg-approval-grid span{display:block;font-size:11.5px;color:${THEME.muted};font-weight:900;margin-top:7px}
.dg-approval-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px}
.dg-approval-list button{border:1px solid ${THEME.border};background:${THEME.elevated};border-radius:13px;padding:11px;min-height:44px;display:flex;gap:10px;text-align:left;font-family:inherit;cursor:pointer}
.dg-approval-list button:disabled{cursor:not-allowed;opacity:.5}
.dg-approval-list i{width:9px;height:9px;border-radius:99px;background:${THEME.warn};margin-top:5px;flex-shrink:0}
.dg-approval-list i.blue{background:#2563EB}
.dg-approval-list i.orange{background:${THEME.warn}}
.dg-approval-list button.hot{border-color:rgba(224,123,57,.55);background:rgba(224,123,57,.12)}
.dg-approval-list button.danger{border-color:${THEME.danger};background:rgba(224,82,82,.12)}
.dg-approval-list button.danger i{background:${THEME.danger}}
.dg-approval-list strong{display:block;font-size:13px;color:${THEME.ink};line-height:1.25}
.dg-approval-list span{display:block;font-size:11.5px;color:${THEME.muted};margin-top:3px}
.dg-priority-row{width:100%;border:0;background:transparent;border-bottom:1px solid ${THEME.border};padding:11px 0;min-height:44px;display:flex;gap:10px;align-items:flex-start;text-align:left;cursor:pointer;font-family:inherit}
.dg-priority-row:disabled{cursor:not-allowed;opacity:.5}
.dg-priority-row:last-child{border-bottom:0}
.dg-priority-row i{width:9px;height:9px;border-radius:99px;margin-top:5px;flex-shrink:0}
.dg-priority-row strong{display:block;font-size:13px;color:${THEME.ink};font-weight:900;line-height:1.25}
.dg-priority-row span{display:block;font-size:11.5px;color:${THEME.muted};line-height:1.35;margin-top:3px}
.dg-priority-row.compact{padding:9px 0}
.dg-kpis{width:100%;max-width:none;margin:0 0 16px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;order:3}
.dg-kpi-button{border:0;background:transparent;padding:0;text-align:left;font-family:inherit;cursor:pointer}
.dg-kpi-button>*{height:100%}
.dg-kpi{background:${THEME.card};border:1px solid ${THEME.border};border-radius:12px;padding:20px;min-width:0;box-shadow:0 2px 12px rgba(0,0,0,.3)}
.dg-kpi span{display:block;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;font-weight:800;margin-bottom:9px;white-space:nowrap}
.dg-kpi strong{display:block;font-size:34px;line-height:1;color:${THEME.ink}}
.dg-kpi small{display:block;font-size:12px;color:${THEME.muted};margin-top:7px}
.dg-grid-3,.dg-main{width:100%;max-width:none;margin:0 0 16px;display:grid;gap:16px}
.dg-grid-3{grid-template-columns:1fr 1.15fr 1fr}
.dg-grid-3{order:7}
.dg-main{grid-template-columns:minmax(0,1.35fr) minmax(340px,.8fr);order:8;align-items:start}
.dg-stack{display:flex;flex-direction:column;gap:16px}
.dg-card{background:${THEME.card};border:1px solid ${THEME.border};border-radius:12px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,.3);min-width:0}
.dg-card-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px}
.dg-card-head h2{font-size:14px;font-weight:800;margin:0;color:${THEME.ink}}
.dg-card-head button{border:0;background:transparent;color:${THEME.gold};font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap}
.dg-health,.dg-team-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.dg-team-kpis{grid-template-columns:1fr 1fr;margin-bottom:12px}
.dg-health-item{border:1px solid ${THEME.border};border-radius:12px;padding:12px;background:${THEME.elevated}}
.dg-health-item strong{display:block;font-size:26px;line-height:1}
.dg-health-item span{display:block;font-size:12px;color:${THEME.muted};margin-top:6px}
.dg-agenda-block{border-top:1px solid ${THEME.border};padding:11px 0}
.dg-agenda-block:first-of-type{border-top:0;padding-top:0}
.dg-agenda-block>div:first-child{display:flex;align-items:baseline;gap:8px;margin-bottom:7px}
.dg-agenda-block strong{font-size:22px;color:${THEME.gold}}
.dg-agenda-block span{font-size:12px;color:${THEME.muted};font-weight:700}
.dg-flow{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}
.dg-flow-step{position:relative;border:1px solid ${THEME.border};background:${THEME.elevated};border-radius:13px;padding:13px;min-height:82px}
.dg-flow-num{font-size:28px;font-weight:800;color:${THEME.ink};line-height:1}
.dg-flow-label{font-size:11px;color:${THEME.muted};margin-top:8px;font-weight:700}
.dg-flow-line{position:absolute;right:-10px;top:50%;width:10px;height:1px;background:${THEME.border}}
.dg-flow-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.dg-flow-summary span{border:1px solid ${THEME.border};background:${THEME.elevated};border-radius:13px;padding:13px;font-size:11px;color:${THEME.muted};font-weight:800}
.dg-flow-summary strong{display:block;font-size:24px;line-height:1;color:${THEME.ink};margin-bottom:7px}
.dg-attention,.dg-work-row{width:100%;border:0;background:transparent;border-bottom:1px solid ${THEME.border};padding:12px 0;display:flex;gap:12px;align-items:center;text-align:left;cursor:pointer;font-family:inherit}
.dg-attention-priority{align-items:flex-start}
.dg-attention strong,.dg-work-row strong{display:block;font-size:13.5px;color:${THEME.ink};margin-bottom:3px}
.dg-attention span,.dg-work-row span,.dg-muted{font-size:12px;color:${THEME.muted}}
.dg-attention strong,.dg-attention span,.dg-work-main strong,.dg-work-main span{overflow:hidden;text-overflow:ellipsis}
.dg-tags{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.dg-tags span{background:#F7EFE4;color:${THEME.warn};border-radius:999px;padding:4px 8px;font-size:10px;font-weight:800}
.dg-work-main{flex:1;min-width:0}
.dg-progress-wrap{width:118px;display:flex;align-items:center;gap:8px;flex-shrink:0}
.dg-progress-wrap b{font-size:11px;color:${THEME.muted};font-weight:900;min-width:30px;text-align:right}
.dg-progress{width:100%;height:6px;background:#E8E4DE;border-radius:999px;overflow:hidden;flex-shrink:0}
.dg-progress i{display:block;height:100%;border-radius:999px}
.dg-badge{font-size:10px;font-weight:800;border-radius:999px;padding:5px 8px;white-space:nowrap}
.dg-metric-line,.dg-line{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid ${THEME.border};align-items:center}
.dg-line-button{width:100%;border:0;background:transparent;display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid ${THEME.border};align-items:center;text-align:left;font-family:inherit;cursor:pointer}
.dg-metric-line span,.dg-line span{font-size:12.5px;color:${THEME.ink};font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dg-line-button span{font-size:12.5px;color:${THEME.ink};font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dg-metric-line strong{font-size:18px}
.dg-line small{font-size:11px;color:${THEME.muted};white-space:nowrap}
.dg-line-button small{font-size:11px;color:${THEME.muted};white-space:nowrap}
.dg-mini-list.spaced{margin-top:12px}
.dg-money{font-family:var(--font-serif);font-size:32px;line-height:1.05;color:${THEME.ink};margin-bottom:4px}
.dg-alert{margin-top:12px;border:1px solid rgba(224,168,82,.4);background:rgba(224,168,82,.12);color:${THEME.warn};border-radius:11px;padding:10px 12px;font-size:12px;font-weight:800}
.dg-activity{display:grid;grid-template-columns:72px 1fr auto;gap:10px;align-items:start;padding:9px 0;border-bottom:1px solid ${THEME.border}}
.dg-activity>span{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:${THEME.gold};font-weight:800}
.dg-activity strong{display:block;font-size:12.5px;color:${THEME.ink};font-weight:700}
.dg-activity small{display:block;font-size:11px;color:${THEME.muted};margin-top:2px}
.dg-activity em{font-style:normal;font-size:10px;color:#aaa}
.dg-stack:last-child .ow-premium-card:last-child{max-height:540px;overflow:auto}
.dg-empty{padding:24px 0;text-align:center;color:#aaa;font-size:13px}
@media (max-width:1100px){.dg-grid-3,.dg-main,.dg-productivity-grid{grid-template-columns:1fr}.dg-flow{grid-template-columns:repeat(3,1fr)}.dg-flow-line{display:none}}
@media (max-width:1100px){.dg-priority-board{grid-template-columns:1fr 1fr}.dg-agenda-mobile{display:block}}
@media (min-width:761px){.dg-agenda-mobile{display:none}}
@media (max-width:760px){.dg-page{padding:22px 14px calc(112px + env(safe-area-inset-bottom));display:flex;flex-direction:column}.dg-header{display:block;margin-bottom:12px;order:0;padding-right:0}.dg-eyebrow{font-size:9px;letter-spacing:2px;margin-bottom:4px}.dg-header h1{font-size:28px;line-height:1.02}.dg-header p{font-size:12.5px;line-height:1.45}.dg-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;justify-content:flex-start;margin-top:10px}.dg-actions button{width:100%;padding:10px 9px;font-size:12px}.dg-mobile-home{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;order:1;margin:0 0 12px;max-width:none;width:100%}.dg-mobile-home>button{border:1px solid ${THEME.border};background:${THEME.elevated};border-radius:15px;padding:11px 9px;text-align:left;font-family:inherit;box-shadow:0 10px 26px rgba(0,0,0,.16)}.dg-mobile-home>button.warn{border-color:rgba(224,168,82,.4);background:rgba(224,168,82,.12)}.dg-mobile-home>button.critical{border-color:rgba(224,82,82,.34);background:rgba(224,82,82,.12)}.dg-mobile-home strong{display:block;font-size:24px;line-height:1;color:${THEME.ink}}.dg-mobile-home span{display:block;font-size:10.5px;color:${THEME.muted};font-weight:900;margin-top:5px}.dg-mobile-quick{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.dg-mobile-quick button{border:1px solid ${THEME.border};background:${THEME.elevated};color:${THEME.ink};border-radius:13px;padding:10px 8px;font-size:12px;font-weight:900}.dg-priority-board{grid-template-columns:1fr;gap:10px;margin-bottom:12px;order:2}.dg-priority-board>*:nth-child(n+2){display:none}.dg-productivity-grid{grid-template-columns:1fr;order:4;gap:12px}.dg-priority-row{padding:11px 0}.dg-agenda-mobile{order:3}.dg-main{order:5}.dg-kpis{order:2;display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:12px}.dg-kpis>*{flex:0 0 auto;min-width:auto;max-width:none}.dg-kpi{display:flex;align-items:center;gap:7px;border-radius:999px;padding:7px 10px;min-width:auto;max-width:none;border-top:1px solid rgba(184,150,94,.22)}.dg-kpi span{white-space:nowrap;font-size:10.5px;line-height:1;letter-spacing:0;margin:0}.dg-kpi strong{font-size:15px}.dg-kpi small{display:none}.dg-grid-3,.dg-main{gap:12px}.dg-grid-3{display:none}.dg-card{padding:15px 13px;border-radius:15px}.dg-card-head h2{font-size:19px}.dg-health{grid-template-columns:1fr 1fr 1fr}.dg-flow{display:none}.dg-card:has(.dg-flow){display:none}.dg-attention,.dg-work-row{align-items:flex-start;flex-direction:column}.dg-attention strong,.dg-attention span,.dg-work-main strong,.dg-work-main span{display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;white-space:normal}.dg-tags{margin-left:0;justify-content:flex-start}.dg-tags span:nth-child(n+3){display:none}.dg-progress{width:100%}.dg-activity{grid-template-columns:62px 1fr}.dg-activity em{display:none}}
@media (max-width:760px){.dg-kpis{order:2}.dg-priority-board{order:3}.dg-agenda-mobile{order:4}.dg-main{order:5}.dg-card:has(.dg-flow){display:block}.dg-flow{display:grid;grid-template-columns:1fr 1fr}.dg-flow-summary{grid-template-columns:1fr}.dg-progress-wrap{width:100%}.dg-progress-wrap b{text-align:left}.dg-work-row{gap:9px}}
`
