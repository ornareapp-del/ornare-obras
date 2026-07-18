import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KpiCard as DesignKpiCard, StatusBadge } from '../../components/DesignSystem'
import { supabase } from '../../lib/supabase'
import { theme } from '../../constants/theme'
import { exportarPlanejamentoPdf } from '../../services/pdfService'
import { faseOrnarePorKey, faseOrnarePorTexto } from '../../constants/fasesOrnare'
import { criarNotificacoes } from '../../services/notificacoesService'
import { obraColor } from '../../utils/obraColor'

const THEME = {
  bg: theme.background,
  card: theme.surface,
  border: theme.border,
  ink: theme.textPrimary,
  muted: theme.textSecondary,
  gold: theme.gold,
  success: theme.success,
  danger: theme.error,
  warn: theme.warning,
  blue: '#365C7D',
  elevated: theme.surfaceElevated,
  inputBackground: theme.inputBackground,
  inputBorder: theme.inputBorder,
  inputText: theme.inputText,
}

const FASE_CORES = {
  vistoria_medida: '#9070C0',
  executivo: '#4A90D9',
  producao: '#B8965E',
  vistoria_tecnica: '#D9704A',
  entrega_moveis: '#B09A7A',
  premontagem: '#365C7D',
  montagem: '#2D7A4A',
  montagem_finalizada: '#5AAB6E',
  vistoria_final: '#3A7D4F',
  obra_concluida: '#2D7A4A',
  entrega: '#7A5AA6',
  posvenda: '#A36F22',
  preobra: '#6D675E',
}

const COMPROMISSO_CORES = {
  vistoria: '#2563EB',
  montagem: '#2D7A4A',
  assistencia: '#C0392B',
  medicao: '#7A5AA6',
  entrega: '#E07B39',
  reuniao: '#6D675E',
  interno: '#1D1C19',
}

const FERIADOS_FIXOS = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '12-25']

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const TIPOS_COMPROMISSO = ['Montagem', 'Assistência Técnica', 'Vistoria', 'Medição', 'Entrega', 'Reunião']
const TIPOS_CAMPO = ['montagem', 'assistencia', 'vistoria', 'medicao', 'entrega']

function norm(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function corFase(fase) {
  const faseInfo = faseOrnarePorKey(fase) || faseOrnarePorTexto(fase)
  if (faseInfo?.cor) return faseInfo.cor
  const key = norm(fase).replace(/[^a-z0-9]/g, '')
  return FASE_CORES[key] || THEME.gold
}

function faseOperacional(fase) {
  const faseInfo = faseOrnarePorKey(fase) || faseOrnarePorTexto(fase)
  return {
    key: faseInfo?.key || fase || '',
    label: faseInfo?.label || fase || 'Cronograma',
    cor: faseInfo?.cor || corFase(fase),
  }
}

function corCompromisso(tipo) {
  const texto = norm(tipo)
  if (texto.includes('vistoria')) return COMPROMISSO_CORES.vistoria
  if (texto.includes('montagem')) return COMPROMISSO_CORES.montagem
  if (texto.includes('assist')) return COMPROMISSO_CORES.assistencia
  if (texto.includes('medicao')) return COMPROMISSO_CORES.medicao
  if (texto.includes('entrega')) return COMPROMISSO_CORES.entrega
  if (texto.includes('reuniao')) return COMPROMISSO_CORES.reuniao
  if (texto.includes('intern')) return COMPROMISSO_CORES.interno
  return THEME.gold
}

function tomCompromisso(tipo) {
  const cor = corCompromisso(tipo)
  return {
    cor,
    bg: `${cor}14`,
    border: cor,
  }
}

function isDiaNaoUtil(date) {
  if (!date) return false
  const dia = date.getDay()
  const chave = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return dia === 0 || dia === 6 || FERIADOS_FIXOS.includes(chave)
}

function safeArray(result) {
  return result?.data || []
}

function dateOnly(value) {
  if (!value) return null
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function dataBR(value) {
  if (!value) return '-'
  const d = dateOnly(value)
  return d ? d.toLocaleDateString('pt-BR') : '-'
}

function overlapsRange(start, end, rangeStart, rangeEnd) {
  if (!start && !end) return false
  const s = start || end
  const e = end || start
  return s <= rangeEnd && e >= rangeStart
}

function startOfCalendar(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const day = first.getDay() || 7
  first.setDate(first.getDate() - (day - 1))
  return first
}

function endOfCalendar(monthDate) {
  const last = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
  const day = last.getDay() || 7
  last.setDate(last.getDate() + (7 - day))
  return last
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function nomePessoa(profile) {
  return profile?.full_name || profile?.email || '-'
}

function montadoresNaObservacao(observacao, profiles) {
  const linha = String(observacao || '').split('\n').find(item => norm(item).startsWith('montadores:'))
  if (!linha) return []
  const nomes = linha.replace(/^montadores:\s*/i, '').split(',').map(item => norm(item)).filter(Boolean)
  return profiles.filter(profile => nomes.includes(norm(nomePessoa(profile))))
}

function compromissoVisivelMontador(tipo, obraId) {
  const texto = norm(tipo)
  return Boolean(obraId) && TIPOS_CAMPO.some(item => texto.includes(item))
}

function periodoTrabalhaSabado(item) {
  return /(?:^|\n)Jornada:\s*segunda a sabado(?:\n|$)/i.test(String(item?.observacao || ''))
}

export default function Planejamento() {
  const navigate = useNavigate()
  const [dados, setDados] = useState({ cronogramas: [], obras: [], profiles: [], montadores: [], agenda: [], equipesPeriodo: [], calendario: [] })
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [exportandoPdf, setExportandoPdf] = useState(false)
  const [toast, setToast] = useState('')
  const [modalCompromisso, setModalCompromisso] = useState(null)
  const [diaSelecionado, setDiaSelecionado] = useState(null)
  const [mesAtual, setMesAtual] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [visao, setVisao] = useState('calendario')
  const [filtros, setFiltros] = useState({ mes: monthKey(new Date()), supervisor: '', montador: '', status: '', cidade: '', busca: '', tipo: '' })
  const diaNaoUtilOperacional = date => {
    const excecao = dados.calendario.find(item => item.data === isoDate(date))
    return excecao ? !excecao.dia_util : isDiaNaoUtil(date)
  }

  async function carregarDados() {
    setLoading(true)
    setErro('')

    const [cronogramas, obras, profiles, montadores, agenda, equipesPeriodo, calendario] = await Promise.all([
      supabase.from('obra_cronograma').select('*').order('data_inicio_prevista', { ascending: true }),
      supabase.from('obras').select('id, nome, cliente_nome, cidade, uf, status, supervisor_id, comercial_id, data_previsao').order('nome'),
      supabase.from('profiles').select('id, full_name, email, role'),
      supabase.from('obra_montadores').select('obra_id, montador_id'),
      supabase.from('agenda').select('id, obra_id, tipo, titulo, data, data_fim, hora_inicio, hora_fim, responsavel_id, observacao, reuniao_interna, visivel_montador, percentual_concluido, retorno_necessario, motivo_pausa').order('data'),
      supabase.from('agenda_periodo_montadores').select('agenda_id, montador_id'),
      supabase.from('calendario_operacional').select('data, descricao, dia_util'),
    ])

    const falha = [cronogramas, obras, profiles, montadores, agenda, equipesPeriodo, calendario].find(r => r.error)
    if (falha?.error) setErro(falha.error.message || 'Nao foi possivel carregar todos os dados do planejamento.')

    setDados({
      cronogramas: safeArray(cronogramas),
      obras: safeArray(obras),
      profiles: safeArray(profiles),
      montadores: safeArray(montadores),
      agenda: safeArray(agenda),
      equipesPeriodo: safeArray(equipesPeriodo),
      calendario: safeArray(calendario),
    })
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregarDados() }, [])

  const vm = useMemo(() => {
    const excecaoPorData = new Map(dados.calendario.map(item => [item.data, item]))
    const diaNaoUtil = date => {
      const excecao = excecaoPorData.get(isoDate(date))
      return excecao ? !excecao.dia_util : isDiaNaoUtil(date)
    }
    const obraPorId = new Map(dados.obras.map(o => [o.id, o]))
    const profilePorId = new Map(dados.profiles.map(p => [p.id, p]))
    const montadoresPorObra = new Map()

    dados.montadores.forEach(v => {
      const lista = montadoresPorObra.get(v.obra_id) || []
      lista.push(v.montador_id)
      montadoresPorObra.set(v.obra_id, lista)
    })

    const registros = dados.cronogramas.map(c => {
      const obra = obraPorId.get(c.obra_id) || {}
      const supervisor = profilePorId.get(c.supervisor_id || obra.supervisor_id)
      const montadorIds = montadoresPorObra.get(c.obra_id) || []
      const montadores = montadorIds.map(id => profilePorId.get(id)).filter(Boolean)
      const inicio = dateOnly(c.data_inicio_prevista)
      const fim = dateOnly(c.data_fim_prevista) || inicio
      const faseInfo = faseOperacional(c.fase)
      return {
        ...c,
        obra,
        supervisor,
        montadores,
        inicio,
        fim,
        faseKey: faseInfo.key,
        faseLabel: faseInfo.label,
        faseCor: faseInfo.cor,
      }
    })

    const compromissosAgenda = dados.agenda.map(a => {
      const obra = obraPorId.get(a.obra_id) || {}
      const supervisor = profilePorId.get(a.responsavel_id || obra.supervisor_id)
      const montadoresTexto = montadoresNaObservacao(a.observacao, dados.profiles)
      const equipeIds = dados.equipesPeriodo.filter(item => item.agenda_id === a.id).map(item => item.montador_id)
      const montadorIds = equipeIds.length ? equipeIds : (montadoresPorObra.get(a.obra_id) || [])
      const montadores = montadoresTexto.length ? montadoresTexto : montadorIds.map(id => profilePorId.get(id)).filter(Boolean)
      const inicio = dateOnly(a.data)
      const fim = dateOnly(a.data_fim) || inicio
      return {
        ...a,
        origem: 'agenda',
        obra,
        supervisor,
        montadores,
        inicio,
        fim,
        faseCor: corCompromisso(a.tipo || a.titulo),
        tom: tomCompromisso(a.tipo || a.titulo),
        compromissoTipo: a.tipo || a.titulo || 'Compromisso',
      }
    })

    const mesInicio = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1)
    const mesFim = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0)
    const dias = []
    const calInicio = startOfCalendar(mesAtual)
    const calFim = endOfCalendar(mesAtual)
    const obrasComExecucaoAgendada = new Set(compromissosAgenda.filter(item => norm(item.tipo) === 'periodo de execucao' && item.status !== 'cancelada' && item.inicio <= calFim && item.fim >= calInicio).map(item => item.obra_id).filter(Boolean))
    for (const d = new Date(calInicio); d <= calFim; d.setDate(d.getDate() + 1)) {
      const atual = new Date(d)
      const naoUtil = diaNaoUtil(atual)
      const obrasCronograma = naoUtil
        ? []
        : registros
          .filter(r => r.inicio && r.fim && atual >= r.inicio && atual <= r.fim && !obrasComExecucaoAgendada.has(r.obra_id))
          .map(r => ({ ...r, origem: 'cronograma', compromissoTipo: r.faseLabel || 'Cronograma', tom: { cor: r.faseCor, bg: `${r.faseCor}10`, border: r.faseCor } }))
      const agendaDia = compromissosAgenda.filter(r => {
        if (!r.inicio || !r.fim || atual < r.inicio || atual > r.fim) return false
        if (norm(r.tipo) !== 'periodo de execucao') return true
        const diaSemana = atual.getDay()
        if (diaSemana === 0) return false
        if (diaSemana === 6) return periodoTrabalhaSabado(r) || r.data === r.data_fim
        return !naoUtil
      })
      dias.push({
        data: atual,
        key: isoDate(atual),
        noMes: atual.getMonth() === mesAtual.getMonth(),
        naoUtil,
        obras: [...agendaDia, ...obrasCronograma],
      })
    }

    const filtroMesDate = filtros.mes ? dateOnly(`${filtros.mes}-01`) : mesInicio
    const filtroInicio = filtroMesDate ? new Date(filtroMesDate.getFullYear(), filtroMesDate.getMonth(), 1) : mesInicio
    const filtroFim = filtroMesDate ? new Date(filtroMesDate.getFullYear(), filtroMesDate.getMonth() + 1, 0) : mesFim

    const filtrados = registros.filter(r => {
      const porMes = overlapsRange(r.inicio, r.fim, filtroInicio, filtroFim)
      const porSupervisor = !filtros.supervisor || (r.supervisor_id || r.obra.supervisor_id) === filtros.supervisor
      const porMontador = !filtros.montador || r.montadores.some(m => m.id === filtros.montador)
      const porStatus = !filtros.status || norm(r.status_operacional).includes(norm(filtros.status))
      const porCidade = !filtros.cidade || r.obra.cidade === filtros.cidade
      const porTipo = !filtros.tipo || norm(r.faseLabel || r.fase).includes(norm(filtros.tipo))
      const termo = norm(filtros.busca)
      const porBusca = !termo || norm([r.obra.nome, r.obra.cliente_nome, nomePessoa(r.supervisor), r.montadores.map(nomePessoa).join(' '), r.faseLabel].filter(Boolean).join(' ')).includes(termo)
      return porMes && porSupervisor && porMontador && porStatus && porCidade && porTipo && porBusca
    })

    const mesesGantt = []
    const datas = registros.flatMap(r => [r.inicio, r.fim]).filter(Boolean)
    const inicioBase = datas.length ? new Date(Math.min(...datas.map(d => d.getTime()))) : mesInicio
    const fimBase = datas.length ? new Date(Math.max(...datas.map(d => d.getTime()))) : addMonths(mesInicio, 5)
    const primeiroMes = new Date(inicioBase.getFullYear(), inicioBase.getMonth(), 1)
    const ultimoMes = new Date(fimBase.getFullYear(), fimBase.getMonth(), 1)
    for (const d = new Date(primeiroMes); d <= ultimoMes; d.setMonth(d.getMonth() + 1)) {
      mesesGantt.push(new Date(d))
    }

    const agendaMes = compromissosAgenda.filter(a => a.inicio && overlapsRange(a.inicio, a.fim, mesInicio, mesFim))
    const obrasProgramadasIds = new Set([
      ...registros.filter(r => overlapsRange(r.inicio, r.fim, mesInicio, mesFim)).map(r => r.obra_id),
      ...agendaMes.map(a => a.obra_id),
    ].filter(Boolean))
    const obrasComEquipeIds = new Set(dados.montadores.map(m => m.obra_id).filter(Boolean))
    const obrasComCronogramaIds = new Set(dados.cronogramas.map(c => c.obra_id).filter(Boolean))
    const obrasSemEquipe = dados.obras.filter(o => !obrasComEquipeIds.has(o.id))
    const obrasSemCronograma = dados.obras.filter(o => !obrasComCronogramaIds.has(o.id))
    const obrasSemData = registros.filter(r => !r.data_inicio_prevista || !r.data_fim_prevista)
    const obrasRisco = registros.filter(r => r.travado || norm(r.risco).includes('alto') || norm(r.status_operacional).includes('risco') || norm(r.status_operacional).includes('trav'))
    const hojeOperacional = new Date()
    hojeOperacional.setHours(0, 0, 0, 0)
    const atrasosCronograma = registros.filter(r => r.fim && r.fim < hojeOperacional && Number(r.percentual_concluido || 0) < 100 && !norm(r.status_operacional).includes('conclu'))
    const kpis = {
      montagensMes: agendaMes.filter(a => norm(a.compromissoTipo).includes('montagem')).length,
      obrasProgramadas: obrasProgramadasIds.size,
      obrasSemEquipe: obrasSemEquipe.length,
      obrasSemCronograma: obrasSemCronograma.length,
      obrasSemData: obrasSemData.length,
      atrasosCronograma: atrasosCronograma.length,
      obrasRisco: obrasRisco.length,
      entregasPrevistas: agendaMes.filter(a => norm(a.compromissoTipo).includes('entrega')).length + registros.filter(r => r.faseKey === 'entrega_moveis' && r.fim && r.fim >= mesInicio && r.fim <= mesFim).length,
    }

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const em7 = new Date(hoje)
    em7.setDate(em7.getDate() + 7)
    const alertas = [
      ...obrasSemEquipe.slice(0, 8).map(obra => ({ tipo: 'Sem montador', obra, detalhe: 'Nenhum montador vinculado à obra', cor: THEME.warn })),
      ...obrasSemCronograma.slice(0, 8).map(obra => ({ tipo: 'Sem cronograma', obra, detalhe: 'Obra ainda não possui cronograma operacional', cor: THEME.blue })),
      ...dados.obras.filter(o => !o.data_previsao).slice(0, 8).map(obra => ({ tipo: 'Sem data prevista', obra, detalhe: 'Previsão de entrega não informada', cor: THEME.muted })),
      ...atrasosCronograma.slice(0, 8).map(item => ({ tipo: 'Cronograma atrasado', obra: item.obra, detalhe: `${item.faseLabel} deveria terminar em ${dataBR(item.data_fim_prevista)}`, cor: THEME.danger })),
      ...obrasSemData.slice(0, 8).map(item => ({ tipo: 'Cronograma sem data', obra: item.obra, detalhe: `${item.faseLabel} sem início ou fim previsto`, cor: THEME.warn })),
      ...agendaMes.filter(a => norm(a.compromissoTipo).includes('montagem') && a.inicio >= hoje && a.inicio <= em7).slice(0, 8).map(a => ({ tipo: 'Inicia em breve', obra: a.obra, detalhe: `${a.compromissoTipo} em ${dataBR(a.data)}`, cor: THEME.gold })),
      ...registros.filter(r => r.travado).slice(0, 8).map(r => ({ tipo: 'Obra travada', obra: r.obra, detalhe: r.motivo_trava || 'Cronograma marcado como travado', cor: THEME.danger })),
    ].slice(0, 12)

    const amanha = new Date(hoje)
    amanha.setDate(hoje.getDate() + 1)
    const fimSemanaOperacional = new Date(hoje)
    fimSemanaOperacional.setDate(hoje.getDate() + 7)
    const inicioProximaSemana = new Date(hoje)
    inicioProximaSemana.setDate(hoje.getDate() + 8)
    const fimProximaSemana = new Date(hoje)
    fimProximaSemana.setDate(hoje.getDate() + 14)
    const itensOperacionais = [
      ...compromissosAgenda.map(a => ({ ...a, tipoOperacional: a.compromissoTipo || 'Compromisso', dataBase: a.inicio })),
      ...registros.map(r => ({ ...r, tipoOperacional: r.faseLabel || 'Cronograma', dataBase: r.inicio })),
    ].filter(item => item.dataBase).sort((a, b) => a.dataBase - b.dataBase)
    const mobileAgenda = [
      { titulo: 'Hoje', itens: itensOperacionais.filter(i => i.dataBase.getTime() === hoje.getTime()) },
      { titulo: 'Amanhã', itens: itensOperacionais.filter(i => i.dataBase.getTime() === amanha.getTime()) },
      { titulo: 'Esta semana', itens: itensOperacionais.filter(i => i.dataBase > amanha && i.dataBase <= fimSemanaOperacional) },
      { titulo: 'Próxima semana', itens: itensOperacionais.filter(i => i.dataBase >= inicioProximaSemana && i.dataBase <= fimProximaSemana) },
    ]

    return {
      registros,
      compromissosAgenda,
      dias,
      filtrados,
      mesesGantt,
      kpis,
      alertas,
      supervisores: dados.profiles.filter(p => ['gestao', 'supervisor'].includes(p.role)),
      montadores: dados.profiles.filter(p => p.role === 'montador'),
      cidades: [...new Set(dados.obras.map(o => o.cidade).filter(Boolean))].sort(),
      statuses: [...new Set(dados.cronogramas.map(c => c.status_operacional).filter(Boolean))].sort(),
      agendaMes,
      mobileAgenda,
      capacidade: compromissosAgenda.filter(item => norm(item.tipo) === 'periodo de execucao'),
    }
  }, [dados, filtros, mesAtual])

  function abrirObra(alvo) {
    if (!alvo) return
    if (typeof alvo === 'string') {
      navigate(`/obras/${alvo}`)
      return
    }
    if (!alvo.obra_id) return
    const aba = alvo.origem === 'agenda' ? 'Agenda' : 'Cronograma'
    const extra = alvo.origem === 'agenda' ? `&compromisso=${alvo.id}` : alvo.id ? `&cronograma=${alvo.id}` : ''
    navigate(`/obras/${alvo.obra_id}?aba=${aba}${extra}`)
  }

  function abrirModalDia(data) {
    setModalCompromisso({
      tipo: 'Montagem',
      obra_id: '',
      supervisor_id: '',
      montadores: [],
      data: isoDate(data),
      data_fim: isoDate(data),
      observacao: '',
      anexos: [],
      permitir_nao_util: false,
    })
  }

  async function salvarCompromisso() {
    if (!modalCompromisso?.tipo || !modalCompromisso?.data) return
    const dataInicio = dateOnly(modalCompromisso.data)
    if (diaNaoUtilOperacional(dataInicio) && !modalCompromisso.permitir_nao_util) {
      const confirmar = window.confirm('Você está adicionando trabalho em um dia não útil. Deseja confirmar?')
      if (!confirmar) return
    }
    setSalvando(true)
    setErro('')
    try {
      const obra = dados.obras.find(o => o.id === modalCompromisso.obra_id)
      const reuniaoInterna = modalCompromisso.tipo === 'Reunião' && !modalCompromisso.obra_id
      const visivelMontador = compromissoVisivelMontador(modalCompromisso.tipo, modalCompromisso.obra_id) && !reuniaoInterna
      const supervisorId = modalCompromisso.supervisor_id || obra?.supervisor_id || null
      const montadoresSelecionados = modalCompromisso.montadores
        .map(id => dados.profiles.find(p => p.id === id))
        .filter(Boolean)
        .map(nomePessoa)
      const anexos = Array.from(modalCompromisso.anexos || []).map(a => a.name)
      const blocosObservacao = [
        modalCompromisso.observacao,
        montadoresSelecionados.length ? `Montadores: ${montadoresSelecionados.join(', ')}` : '',
        anexos.length ? `Anexos informados: ${anexos.join(', ')}` : '',
      ].filter(Boolean)

      const { error } = await supabase.from('agenda').insert([{
        titulo: `${modalCompromisso.tipo}${obra?.nome ? ' - ' + obra.nome : ''}`,
        tipo: modalCompromisso.tipo,
        obra_id: reuniaoInterna ? null : (modalCompromisso.obra_id || null),
        responsavel_id: supervisorId,
        data: modalCompromisso.data,
        data_fim: modalCompromisso.data_fim || modalCompromisso.data,
        hora_inicio: '08:00',
        hora_fim: null,
        observacao: blocosObservacao.join('\n'),
        reuniao_interna: reuniaoInterna,
        visivel_montador: visivelMontador,
        visivel_cliente: false,
        status: 'pendente',
      }])

      if (error) {
        console.error('Erro ao salvar compromisso no planejamento:', error)
        setErro(error.message || 'Nao foi possivel salvar o compromisso no planejamento.')
        return
      }

      setToast('Compromisso criado na agenda.')
      setTimeout(() => setToast(''), 3200)
      setModalCompromisso(null)
      await carregarDados()
    } catch (error) {
      console.error('Erro inesperado ao salvar compromisso no planejamento:', error)
      setErro('Nao foi possivel salvar o compromisso no planejamento. Tente novamente em instantes.')
    } finally {
      setSalvando(false)
    }
  }

  async function gerarPdfPlanejamento() {
    if (exportandoPdf) return
    setExportandoPdf(true)
    setErro('')
    setToast('Gerando PDF...')
    try {
      await exportarPlanejamentoPdf({ registros: vm.filtrados, agenda: vm.agendaMes, mesAtual })
      setToast('PDF gerado com sucesso.')
      setTimeout(() => setToast(''), 3200)
    } catch (error) {
      setToast('')
      setErro(error?.message || 'Não foi possível gerar o PDF.')
    } finally {
      setExportandoPdf(false)
    }
  }

  return (
    <div className="pl-page">
      <style>{css}</style>
      {toast && <div className="pl-toast">{toast}</div>}
      {modalCompromisso && (
        <CompromissoModal
          form={modalCompromisso}
          setForm={setModalCompromisso}
          obras={dados.obras}
          supervisores={vm.supervisores}
          montadores={vm.montadores}
          vinculos={dados.montadores}
          salvando={salvando}
          onClose={() => setModalCompromisso(null)}
          onSave={salvarCompromisso}
        />
      )}
      {diaSelecionado && (
        <ResumoDiaModal dia={diaSelecionado} onClose={() => setDiaSelecionado(null)} onOpenItem={abrirObra} onAdd={() => {
          const data = diaSelecionado.data
          setDiaSelecionado(null)
          abrirModalDia(data)
        }} />
      )}

      <header className="pl-header">
        <div>
          <div className="pl-eyebrow">Ornare Works</div>
          <h1>Planejamento</h1>
          <p>Central de Planejamento Operacional da Ornare</p>
        </div>
        <div className="pl-month-nav">
          <button onClick={gerarPdfPlanejamento} disabled={exportandoPdf}>{exportandoPdf ? 'Gerando PDF...' : 'Exportar PDF'}</button>
          <button onClick={() => setMesAtual(m => addMonths(m, -1))}>Anterior</button>
          <strong>{MESES[mesAtual.getMonth()]} {mesAtual.getFullYear()}</strong>
          <button onClick={() => setMesAtual(m => addMonths(m, 1))}>Próximo</button>
        </div>
      </header>

      {erro && <div className="pl-alert">Alguns dados não foram carregados: {erro}</div>}

      <section className="pl-mobile-actions">
        <button className="primary" onClick={() => abrirModalDia(new Date())}>Novo compromisso</button>
        <button onClick={() => setVisao('calendario')}>Calendário</button>
        <button onClick={() => setVisao('tabela')}>Cronograma</button>
      </section>

      <MobileOperacional grupos={vm.mobileAgenda} abrirObra={abrirObra} />

      <section className="pl-kpis">
        <Kpi label="Montagens no mês" value={vm.kpis.montagensMes} />
        <Kpi label="Obras programadas" value={vm.kpis.obrasProgramadas} />
        <Kpi label="Obras sem equipe" value={vm.kpis.obrasSemEquipe} danger={vm.kpis.obrasSemEquipe > 0} />
        <Kpi label="Sem cronograma" value={vm.kpis.obrasSemCronograma} danger={vm.kpis.obrasSemCronograma > 0} />
        <Kpi label="Atrasos" value={vm.kpis.atrasosCronograma} danger={vm.kpis.atrasosCronograma > 0} />
        <Kpi label="Sem data" value={vm.kpis.obrasSemData} danger={vm.kpis.obrasSemData > 0} />
        <Kpi label="Obras em risco" value={vm.kpis.obrasRisco} danger={vm.kpis.obrasRisco > 0} />
        <Kpi label="Entregas previstas" value={vm.kpis.entregasPrevistas} />
      </section>

      <AtencaoPanel alertas={vm.alertas} abrirObra={abrirObra} />

      <nav className="pl-tabs">
        {[
          ['calendario', 'Calendário Mensal'],
          ['tabela', 'Cronograma Operacional'],
          ['gantt', 'Gantt Executivo'],
          ['capacidade', 'Capacidade das Equipes'],
        ].map(([id, label]) => (
          <button key={id} className={visao === id ? 'active' : ''} onClick={() => setVisao(id)}>{label}</button>
        ))}
      </nav>

      {loading ? (
        <div className="pl-empty">Carregando planejamento...</div>
      ) : (
        <>
          {visao === 'calendario' && <Calendario dias={vm.dias} mesAtual={mesAtual} abrirDia={setDiaSelecionado} mudarMes={quantidade => setMesAtual(m => addMonths(m, quantidade))} />}
          {visao === 'tabela' && (
            <CronogramaTabela
              registros={vm.filtrados}
              filtros={filtros}
              setFiltros={setFiltros}
              supervisores={vm.supervisores}
              montadores={vm.montadores}
              statuses={vm.statuses}
              cidades={vm.cidades}
              abrirObra={abrirObra}
            />
          )}
          {visao === 'gantt' && <Gantt registros={vm.filtrados} meses={vm.mesesGantt} abrirObra={abrirObra} />}
          {visao === 'capacidade' && <CapacidadeEquipes periodos={vm.capacidade} montadores={vm.montadores} mesAtual={mesAtual} abrirObra={abrirObra} calendario={dados.calendario} onRefresh={carregarDados} />}
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, danger }) {
  return <DesignKpiCard label={label} value={value} danger={danger} />
}

function AtencaoPanel({ alertas, abrirObra }) {
  return (
    <section className="pl-attention">
      <div className="pl-card-head">
        <h2>Exigem Atenção</h2>
        <span>{alertas.length} itens</span>
      </div>
      {alertas.length === 0 ? (
        <div className="pl-attention-empty">Nenhum alerta operacional relevante para o mês.</div>
      ) : (
        <div className="pl-attention-list">
          {alertas.map((alerta, index) => (
            <button key={`${alerta.tipo}-${alerta.obra?.id || index}-${index}`} onClick={() => abrirObra(alerta.obra?.id)}>
              <i style={{ background: alerta.cor }} />
              <div>
                <strong>{alerta.tipo}</strong>
                <span>{alerta.obra?.nome || 'Obra'} · {alerta.detalhe}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function statusOperacionalMobile(item) {
  const raw = item.data || item.data_inicio_prevista
  if (!raw) return { label: 'Sem data', tone: 'warn' }
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const data = new Date(`${raw}T00:00:00`)
  if (data < hoje) return { label: 'Passado', tone: 'success' }
  if (data.getTime() === hoje.getTime()) return { label: 'Hoje', tone: 'info' }
  return { label: 'Pendente', tone: 'warn' }
}

function MobileOperacional({ grupos, abrirObra }) {
  return (
    <section className="pl-mobile-operational">
      {grupos.map(grupo => (
        <div className="pl-mobile-group" key={grupo.titulo}>
          <div className="pl-mobile-group-head">
            <h2>{grupo.titulo}</h2>
            <span>{grupo.itens.length}</span>
          </div>
          {grupo.itens.length === 0 ? (
            <div className="pl-mobile-empty">Sem compromissos programados.</div>
          ) : grupo.itens.slice(0, 8).map(item => {
            const status = statusOperacionalMobile(item)
            const tom = item.tom || tomCompromisso(item.tipoOperacional || item.compromissoTipo || item.fase)
            return (
            <button className="pl-mobile-item" key={`${grupo.titulo}-${item.origem || 'cronograma'}-${item.id}`} onClick={() => abrirObra(item)} style={{ borderLeftColor: tom.border }}>
              <div>
                <span style={{ color: tom.cor }}>{item.tipoOperacional}</span>
                <strong>{item.obra?.nome || 'Obra'}</strong>
                <small>{dataBR(item.data || item.data_inicio_prevista)}{item.hora_inicio ? ` · ${String(item.hora_inicio).slice(0, 5)}` : ''}</small>
              </div>
              <div className="pl-mobile-side">
                <b className={`tone-${status.tone}`}>{status.label}</b>
                <em>{item.montadores?.[0] ? nomePessoa(item.montadores[0]) : nomePessoa(item.supervisor)}</em>
              </div>
            </button>
            )
          })}
        </div>
      ))}
    </section>
  )
}

function Calendario({ dias, mesAtual, abrirDia, mudarMes }) {
  return (
    <section className="pl-card">
      <div className="pl-card-head">
        <h2>Calendário mensal</h2>
        <span>{MESES[mesAtual.getMonth()]} {mesAtual.getFullYear()}</span>
      </div>
      <div className="pl-calendar-legend" aria-label="Legenda de tipos de compromisso">
        <span className="meaning"><b>Cor do cartão = obra</b></span>
        {[
          ['Vistoria', COMPROMISSO_CORES.vistoria],
          ['Montagem', COMPROMISSO_CORES.montagem],
          ['Assistência', COMPROMISSO_CORES.assistencia],
          ['Medição', COMPROMISSO_CORES.medicao],
          ['Entrega', COMPROMISSO_CORES.entrega],
          ['Reunião', COMPROMISSO_CORES.reuniao],
        ].map(([label, color]) => (
          <span key={label}><i style={{ background: color }} />{label}</span>
        ))}
      </div>
      <div className="pl-weekdays">
        {DIAS.map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="pl-calendar">
        {dias.map(dia => (
          <div key={dia.key} className={`${dia.noMes ? 'pl-day' : 'pl-day outside'}${dia.naoUtil ? ' non-workday' : ''}`} onClick={() => abrirDia(dia)} role="button" tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && abrirDia(dia)} aria-label={`Ver agenda de ${dataBR(dia.key)}`}>
            <div className="pl-day-top"><div className="pl-day-num">{dia.data.getDate()}</div>{dia.obras.length > 0 && <span>{dia.obras.length} {dia.obras.length === 1 ? 'item' : 'itens'}</span>}</div>
            <div className="pl-day-items">
              {dia.obras.slice(0, 4).map(item => (
                <div
                  key={`${dia.key}-${item.origem}-${item.id}`}
                  className={item.origem === 'agenda' ? 'agenda-item' : 'cronograma-item'}
                  style={{ borderLeftColor: obraColor(item.obra).accent, background: obraColor(item.obra).soft }}
                >
                  <strong>{item.obra.nome || 'Obra'}</strong>
                  <span>{item.montadores[0] ? nomePessoa(item.montadores[0]) : nomePessoa(item.supervisor)}</span>
                  <em style={{ color: item.tom?.cor || item.faseCor }}>{item.compromissoTipo}</em>
                  <small>{item.origem === 'cronograma' ? 'Previsão macro' : norm(item.tipo) === 'periodo de execucao' ? 'Execução da equipe' : 'Agenda'}</small>
                </div>
              ))}
              {dia.obras.length > 4 && <small>+{dia.obras.length - 4} obras</small>}
            </div>
          </div>
        ))}
      </div>
      <div className="pl-calendar-bottom-nav">
        <button type="button" onClick={() => mudarMes(-1)}>← Mês anterior</button>
        <strong>{MESES[mesAtual.getMonth()]} {mesAtual.getFullYear()}</strong>
        <button type="button" className="next" onClick={() => mudarMes(1)}>Próximo mês →</button>
      </div>
    </section>
  )
}

function ResumoDiaModal({ dia, onClose, onOpenItem, onAdd }) {
  const tituloData = dia.data.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const pessoas = [...new Set(dia.obras.flatMap(item => [item.supervisor, ...(item.montadores || [])]).filter(Boolean).map(nomePessoa).filter(nome => nome !== '-'))]

  return (
    <div className="pl-modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="pl-modal pl-day-modal" role="dialog" aria-modal="true" aria-labelledby="pl-day-modal-title">
        <div className="pl-modal-head">
          <div><span>Agenda do dia</span><h2 id="pl-day-modal-title">{tituloData}</h2></div>
          <button onClick={onClose} aria-label="Fechar resumo do dia">X</button>
        </div>
        <div className="pl-modal-body">
          <div className="pl-day-summary">
            <div><span>Compromissos</span><strong>{dia.obras.length}</strong></div>
            <div><span>Pessoas alocadas</span><strong>{pessoas.length}</strong></div>
            <div><span>Dia operacional</span><strong>{dia.naoUtil ? 'Não útil' : 'Dia útil'}</strong></div>
          </div>
          {pessoas.length > 0 && <div className="pl-day-team"><span>Equipe do dia</span><div>{pessoas.map(nome => <b key={nome}>{nome}</b>)}</div></div>}
          {dia.obras.length === 0 ? (
            <div className="pl-day-empty"><strong>Agenda livre</strong><span>Não há compromissos ou etapas de cronograma para este dia.</span></div>
          ) : (
            <div className="pl-day-detail-list">
              {dia.obras.map(item => {
                const cor = obraColor(item.obra).accent
                const equipe = (item.montadores || []).map(nomePessoa).filter(nome => nome !== '-')
                const local = [item.obra?.cidade, item.obra?.uf].filter(Boolean).join(' / ')
                return (
                  <article key={`${item.origem}-${item.id}`} style={{ borderLeftColor: cor }}>
                    <div className="pl-day-detail-head">
                      <div><span style={{ color: cor }}>{item.compromissoTipo}</span><h3>{item.obra?.nome || item.titulo || 'Compromisso interno'}</h3></div>
                      <b>{item.hora_inicio ? `${String(item.hora_inicio).slice(0, 5)}${item.hora_fim ? ` – ${String(item.hora_fim).slice(0, 5)}` : ''}` : 'Dia inteiro'}</b>
                    </div>
                    <div className="pl-day-detail-grid">
                      <div><span>Local</span><strong>{local || 'Não informado'}</strong></div>
                      <div><span>Responsável</span><strong>{nomePessoa(item.supervisor)}</strong></div>
                      <div><span>Equipe alocada</span><strong>{equipe.join(', ') || 'Sem equipe definida'}</strong></div>
                      <div><span>Origem</span><strong>{item.origem === 'cronograma' ? 'Previsão macro' : norm(item.tipo) === 'periodo de execucao' ? 'Execução da equipe' : 'Agenda manual'}</strong></div>
                    </div>
                    {item.observacao && <p>{String(item.observacao).split('\n')[0]}</p>}
                    {item.obra_id && <button onClick={() => onOpenItem(item)}>Abrir obra e detalhes →</button>}
                  </article>
                )
              })}
            </div>
          )}
        </div>
        <div className="pl-modal-foot"><button onClick={onClose}>Fechar</button><button className="primary" onClick={onAdd}>+ Adicionar compromisso</button></div>
      </div>
    </div>
  )
}

function CompromissoModal({ form, setForm, obras, supervisores, montadores, vinculos, salvando, onClose, onSave }) {
  const obraSelecionada = obras.find(o => o.id === form.obra_id)
  const dataNaoUtil = isDiaNaoUtil(dateOnly(form.data))
  const montadorIdsDaObra = form.obra_id
    ? vinculos.filter(v => v.obra_id === form.obra_id).map(v => v.montador_id).filter(Boolean)
    : []
  const montadoresDaObra = form.obra_id
    ? montadores.filter(m => montadorIdsDaObra.includes(m.id))
    : []
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const toggleMontador = id => set('montadores', form.montadores.includes(id) ? form.montadores.filter(m => m !== id) : [...form.montadores, id])

  return (
    <div className="pl-modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="pl-modal">
        <div className="pl-modal-head">
          <div>
            <span>Novo compromisso</span>
            <h2>Planejar dia operacional</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar compromisso">X</button>
        </div>

        <div className="pl-modal-body">
          <div className="pl-form-grid">
            <label>
              <span>Tipo de compromisso</span>
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                {TIPOS_COMPROMISSO.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
              </select>
            </label>
            <label>
              <span>Obra</span>
              <select value={form.obra_id} onChange={e => {
                const obra = obras.find(o => o.id === e.target.value)
                const montadoresVinculados = vinculos.filter(v => v.obra_id === e.target.value).map(v => v.montador_id).filter(Boolean)
                setForm(f => ({ ...f, obra_id: e.target.value, supervisor_id: obra?.supervisor_id || f.supervisor_id, montadores: montadoresVinculados }))
              }}>
                <option value="">Sem obra vinculada</option>
                {obras.map(obra => <option key={obra.id} value={obra.id}>{obra.nome}</option>)}
              </select>
            </label>
            <label>
              <span>Supervisor</span>
              <select value={form.supervisor_id || obraSelecionada?.supervisor_id || ''} onChange={e => set('supervisor_id', e.target.value)}>
                <option value="">Sem supervisor</option>
                {supervisores.map(p => <option key={p.id} value={p.id}>{nomePessoa(p)}</option>)}
              </select>
            </label>
            <label>
              <span>Data início</span>
              <input type="date" value={form.data} onChange={e => set('data', e.target.value)} />
            </label>
            <label>
              <span>Data fim</span>
              <input type="date" value={form.data_fim} onChange={e => set('data_fim', e.target.value)} />
            </label>
            <label>
              <span>Anexos</span>
              <input type="file" multiple onChange={e => set('anexos', e.target.files)} />
            </label>
          </div>

          <div className="pl-montadores">
            <span>Montadores</span>
            {!form.obra_id ? (
              <small>Selecione uma obra para carregar os montadores vinculados.</small>
            ) : montadoresDaObra.length === 0 ? (
              <small>Nenhum montador vinculado a esta obra.</small>
            ) : (
              <div>
                {montadoresDaObra.map(m => (
                  <button key={m.id} className={form.montadores.includes(m.id) ? 'active' : ''} onClick={() => toggleMontador(m.id)}>
                    {nomePessoa(m)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {form.obra_id && compromissoVisivelMontador(form.tipo, form.obra_id) && (
            <div className="pl-montador-visibility">
              Este compromisso será exibido no painel do montador porque é operacional e está vinculado a uma obra.
            </div>
          )}

          {form.obra_id && !compromissoVisivelMontador(form.tipo, form.obra_id) && (
            <div className="pl-montador-visibility muted">
              Compromissos internos ou reuniões não serão exibidos ao montador nem ao cliente.
            </div>
          )}

          <label className="pl-observacao">
            <span>Observação</span>
            <textarea rows={4} value={form.observacao} onChange={e => set('observacao', e.target.value)} placeholder="Detalhes para equipe, restrições de acesso, materiais, horários..." />
          </label>

          {dataNaoUtil && (
            <label className="pl-non-workday-warning">
              <input type="checkbox" checked={Boolean(form.permitir_nao_util)} onChange={e => set('permitir_nao_util', e.target.checked)} />
              <span>Permitir trabalho neste sábado, domingo ou feriado.</span>
            </label>
          )}
        </div>

        <div className="pl-modal-foot">
          <button onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={onSave} disabled={salvando || !form.tipo || !form.data}>{salvando ? 'Salvando...' : 'Salvar na agenda'}</button>
        </div>
      </div>
    </div>
  )
}

function CronogramaTabela({ registros, filtros, setFiltros, supervisores, montadores, statuses, cidades, abrirObra }) {
  return (
    <section className="pl-card">
      <div className="pl-card-head">
        <h2>Cronograma operacional</h2>
        <span>{registros.length} obras</span>
      </div>

      <div className="pl-filters">
        <input value={filtros.busca} onChange={e => setFiltros(f => ({ ...f, busca: e.target.value }))} placeholder="Buscar obra, cliente, supervisor ou montador" />
        <input type="month" value={filtros.mes} onChange={e => setFiltros(f => ({ ...f, mes: e.target.value }))} />
        <select value={filtros.supervisor} onChange={e => setFiltros(f => ({ ...f, supervisor: e.target.value }))}>
          <option value="">Supervisor</option>
          {supervisores.map(p => <option key={p.id} value={p.id}>{nomePessoa(p)}</option>)}
        </select>
        <select value={filtros.montador} onChange={e => setFiltros(f => ({ ...f, montador: e.target.value }))}>
          <option value="">Montador</option>
          {montadores.map(p => <option key={p.id} value={p.id}>{nomePessoa(p)}</option>)}
        </select>
        <select value={filtros.status} onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))}>
          <option value="">Status</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filtros.tipo} onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value }))}>
          <option value="">Tipo/fase</option>
          {TIPOS_COMPROMISSO.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
          {[...new Set(registros.map(r => r.faseLabel).filter(Boolean))].sort().map(fase => <option key={fase} value={fase}>{fase}</option>)}
        </select>
        <select value={filtros.cidade} onChange={e => setFiltros(f => ({ ...f, cidade: e.target.value }))}>
          <option value="">Cidade</option>
          {cidades.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="pl-table-wrap">
        <table className="pl-table">
          <thead>
            <tr>
              <th>Obra</th>
              <th>Cliente</th>
              <th>Supervisor</th>
              <th>Montadores</th>
              <th>Fase</th>
              <th>Status</th>
              <th>Prioridade</th>
              <th>Risco</th>
              <th>Inicio</th>
              <th>Fim</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {registros.map(r => (
              <tr key={r.id} onClick={() => abrirObra({ ...r, origem: 'cronograma' })}>
                <td><strong>{r.obra.nome || '-'}</strong><small>{[r.obra.cidade, r.obra.uf].filter(Boolean).join(' / ')}</small></td>
                <td>{r.obra.cliente_nome || '-'}</td>
                <td>{nomePessoa(r.supervisor)}</td>
                <td>{r.montadores.map(nomePessoa).join(', ') || '-'}</td>
                <td><Badge color={r.faseCor}>{r.faseLabel || '-'}</Badge></td>
                <td>{r.status_operacional || '-'}</td>
                <td>{r.prioridade || '-'}</td>
                <td>{r.risco || '-'}</td>
                <td>{dataBR(r.data_inicio_prevista)}</td>
                <td>{dataBR(r.data_fim_prevista)}</td>
                <td>{Number(r.percentual_concluido || 0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Gantt({ registros, meses, abrirObra }) {
  return (
    <section className="pl-card">
      <div className="pl-card-head">
        <h2>Gantt executivo</h2>
        <span>{meses.length} meses</span>
      </div>
      <div className="pl-gantt" style={{ '--cols': meses.length }}>
        <div className="pl-gantt-head">
          <div>Obra</div>
          {meses.map(m => <div key={monthKey(m)}>{MESES[m.getMonth()].slice(0, 3)} {String(m.getFullYear()).slice(2)}</div>)}
        </div>
        {registros.map(r => {
          const startIdx = Math.max(0, meses.findIndex(m => r.inicio && m.getFullYear() === r.inicio.getFullYear() && m.getMonth() === r.inicio.getMonth()))
          const endIdxRaw = meses.findIndex(m => r.fim && m.getFullYear() === r.fim.getFullYear() && m.getMonth() === r.fim.getMonth())
          const endIdx = endIdxRaw >= 0 ? endIdxRaw : startIdx
          return (
            <button className="pl-gantt-row" key={r.id} onClick={() => abrirObra({ ...r, origem: 'cronograma' })}>
              <div className="pl-gantt-name">
                <strong>{r.obra.nome || 'Obra'}</strong>
                <span>{r.status_operacional || '-'}</span>
              </div>
              <div className="pl-gantt-lane" style={{ gridColumn: `span ${meses.length}` }}>
                <i style={{ left: `${(startIdx / meses.length) * 100}%`, width: `${Math.max(((endIdx - startIdx + 1) / meses.length) * 100, 5)}%`, background: r.faseCor }}>
                  {r.faseLabel || 'Cronograma'}
                </i>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function CapacidadeEquipes({ periodos, montadores, mesAtual, abrirObra, calendario, onRefresh }) {
  const totalDias = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0).getDate()
  const dias = Array.from({ length: totalDias }, (_, index) => new Date(mesAtual.getFullYear(), mesAtual.getMonth(), index + 1))
  const [excecao, setExcecao] = useState({ data: '', descricao: '', dia_util: false })

  async function salvarExcecao() {
    if (!excecao.data || !excecao.descricao.trim()) return
    const { error } = await supabase.from('calendario_operacional').upsert([{ ...excecao, descricao: excecao.descricao.trim() }], { onConflict: 'data' })
    if (!error) {
      setExcecao({ data: '', descricao: '', dia_util: false })
      await onRefresh()
    }
  }

  async function removerExcecao(data) {
    await supabase.from('calendario_operacional').delete().eq('data', data)
    await onRefresh()
  }

  async function reagendarPorArraste(periodo, novaData) {
    if (!periodo || periodo.data === novaData) return
    const motivo = window.prompt(`Motivo para mover "${periodo.titulo}" para ${dataBR(novaData)}:`)
    if (!String(motivo || '').trim()) return
    const duracao = Math.max(0, Math.round((dateOnly(periodo.data_fim || periodo.data) - dateOnly(periodo.data)) / 86400000))
    const novoFim = new Date(`${novaData}T12:00:00`)
    novoFim.setDate(novoFim.getDate() + duracao)
    const dataFimNova = isoDate(novoFim)
    const { error } = await supabase.from('agenda').update({ data: novaData, data_fim: dataFimNova }).eq('id', periodo.id)
    if (error) return
    const { data: authData } = await supabase.auth.getUser()
    await supabase.from('agenda_reagendamentos').insert([{ agenda_id: periodo.id, data_anterior: periodo.data, data_fim_anterior: periodo.data_fim || periodo.data, data_nova: novaData, data_fim_nova: dataFimNova, motivo: motivo.trim(), escopo: 'periodo', alterado_por: authData?.user?.id || null }])
    const destinatarios = new Set([periodo.obra?.supervisor_id, periodo.obra?.comercial_id, ...periodo.montadores.map(item => item.id)].filter(Boolean))
    destinatarios.delete(authData?.user?.id)
    if (destinatarios.size) await criarNotificacoes([...destinatarios].map(usuario_id => ({ usuario_id, obra_id: periodo.obra_id, tipo: 'periodo_reagendado', titulo: 'Período reagendado', descricao: `${periodo.titulo}: ${dataBR(periodo.data)} para ${dataBR(novaData)}. Motivo: ${motivo.trim()}`, prioridade: 'alta', status: 'nao_lida', rota: `/obras/${periodo.obra_id}?aba=Cronograma`, entidade_tipo: 'agenda', entidade_id: periodo.id })))
    await onRefresh()
  }
  return (
    <section className="pl-card">
      <div className="pl-card-head"><div><h2>Capacidade das equipes</h2><p>Disponibilidade diária e conflitos de alocação</p></div><span>{montadores.length} montadores</span></div>
      <div className="pl-calendar-config">
        <strong>Calendário operacional</strong>
        <input type="date" value={excecao.data} onChange={e => setExcecao(p => ({ ...p, data: e.target.value }))} />
        <input placeholder="Feriado, plantão ou exceção" value={excecao.descricao} onChange={e => setExcecao(p => ({ ...p, descricao: e.target.value }))} />
        <label><input type="checkbox" checked={excecao.dia_util} onChange={e => setExcecao(p => ({ ...p, dia_util: e.target.checked }))} /> Dia útil</label>
        <button type="button" onClick={salvarExcecao}>Salvar exceção</button>
      </div>
      {calendario.length > 0 && <div className="pl-calendar-tags">{calendario.map(item => <button type="button" key={item.data} onClick={() => removerExcecao(item.data)} title="Clique para remover">{dataBR(item.data)} · {item.descricao} {item.dia_util ? '(útil)' : '(não útil)'} ×</button>)}</div>}
      <p className="pl-drag-hint">Arraste um bloco para outro dia para reagendar. O sistema preserva sua duração e registra o motivo.</p>
      <div className="pl-capacidade" style={{ '--dias': dias.length }}>
        <div className="pl-cap-row pl-cap-head"><div className="pl-cap-name">Montador</div>{dias.map(dia => <div key={isoDate(dia)} className={[0, 6].includes(dia.getDay()) ? 'off' : ''}>{dia.getDate()}<small>{DIAS[dia.getDay()]}</small></div>)}</div>
        {montadores.map(montador => <div className="pl-cap-row" key={montador.id}>
          <div className="pl-cap-name"><strong>{nomePessoa(montador)}</strong></div>
          {dias.map(dia => {
            const data = isoDate(dia)
            const alocacoes = periodos.filter(periodo => periodo.montadores.some(item => item.id === montador.id) && periodo.data <= data && (periodo.data_fim || periodo.data) >= data && periodo.status !== 'cancelada')
            const conflito = alocacoes.length > 1
            return <div key={data} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/agenda-id'); reagendarPorArraste(periodos.find(item => String(item.id) === id), data) }} className={`pl-cap-day ${[0, 6].includes(dia.getDay()) ? 'off' : ''} ${conflito ? 'conflict' : alocacoes.length ? 'busy' : ''}`} title={alocacoes.map(item => `${item.obra?.nome || 'Obra'}: ${item.titulo}`).join('\n')}>
              {alocacoes.slice(0, 2).map(item => <button type="button" draggable onDragStart={e => e.dataTransfer.setData('text/agenda-id', String(item.id))} key={item.id} onClick={() => abrirObra(item)} style={{ background: conflito ? THEME.danger : item.faseCor }}>{(item.obra?.nome || item.titulo || 'Obra').slice(0, 2).toUpperCase()}</button>)}
            </div>
          })}
        </div>)}
      </div>
    </section>
  )
}

function Badge({ color, children }) {
  return <StatusBadge style={{ color, background: `${color}18` }}>{children}</StatusBadge>
}

const css = `
.pl-page{min-height:100vh;background:${THEME.bg};padding:30px 34px 52px;color:${THEME.ink};font-family:var(--font-sans);box-sizing:border-box}
.pl-header{width:100%;max-width:none;margin:0 0 24px;display:flex;justify-content:space-between;gap:18px;align-items:flex-start;box-sizing:border-box}
.pl-eyebrow{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${THEME.gold};font-weight:800;margin-bottom:7px}
.pl-header h1{font-family:var(--font-serif);font-size:40px;line-height:1.05;font-weight:500;margin:0;color:${THEME.ink}}
.pl-header p{margin:7px 0 0;font-size:13px;color:${THEME.muted}}
.pl-month-nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.pl-month-nav strong{min-width:180px;text-align:center;font-size:14px}
.pl-month-nav button,.pl-tabs button{min-height:44px;border:1px solid ${THEME.border};background:${THEME.elevated};color:${THEME.ink};border-radius:8px;padding:12px 24px;font-size:12px;font-weight:600;cursor:pointer}
.pl-alert{width:100%;max-width:none;margin:0 0 14px;border:1px solid rgba(224,82,82,.34);background:rgba(224,82,82,.12);color:${THEME.danger};border-radius:12px;padding:11px 14px;font-size:13px;font-weight:700}
.pl-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:1200;background:${THEME.ink};color:#fff;border-left:3px solid ${THEME.gold};border-radius:13px;padding:12px 18px;font-size:13px;font-weight:800;box-shadow:0 14px 34px rgba(29,28,25,.18)}
.pl-mobile-actions{display:none}
.pl-kpis{width:100%;max-width:none;margin:0 0 16px;display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:12px}
.pl-kpi{background:${THEME.card};border:1px solid ${THEME.border};border-radius:12px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,.3)}
.pl-kpi.danger{border-top-color:${THEME.danger}}
.pl-kpi span{display:block;font-size:10px;letter-spacing:1.7px;text-transform:uppercase;color:${THEME.gold};font-weight:800;margin-bottom:9px;white-space:nowrap}
.pl-kpi.danger span{color:${THEME.danger}}
.pl-kpi strong{display:block;font-size:32px;line-height:1;color:${THEME.ink}}
.pl-tabs{width:100%;max-width:none;margin:0 0 16px;display:flex;gap:8px;overflow-x:auto;padding-bottom:2px}
.pl-tabs button.active{background:${THEME.gold};border-color:${THEME.gold};color:${THEME.bg}}
.pl-attention{width:100%;max-width:none;margin:0 0 16px;background:${THEME.card};border:1px solid ${THEME.border};border-radius:12px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,.3)}
.pl-attention-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.pl-attention-list button{border:1px solid ${THEME.border};background:${THEME.elevated};border-radius:13px;padding:12px;text-align:left;display:flex;gap:10px;align-items:flex-start;cursor:pointer;font-family:inherit}
.pl-attention-list i{width:8px;height:8px;border-radius:999px;margin-top:5px;flex-shrink:0}
.pl-attention-list strong{display:block;font-size:12px;color:${THEME.ink};margin-bottom:3px}
.pl-attention-list span{display:block;font-size:11.5px;color:${THEME.muted};line-height:1.35}
.pl-attention-empty{padding:18px 0;text-align:center;color:#A79F93;font-size:13px}
.pl-mobile-operational{display:none}
.pl-card{width:100%;max-width:none;margin:0;background:${THEME.card};border:1px solid ${THEME.border};border-radius:12px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,.3);box-sizing:border-box}
.pl-card-head{display:flex;justify-content:space-between;gap:14px;align-items:center;margin-bottom:15px}
.pl-card-head h2{font-size:15px;margin:0;font-weight:900;color:${THEME.ink}}
.pl-card-head span{font-size:12px;color:${THEME.gold};font-weight:900}
.pl-calendar-legend{display:flex;gap:8px;flex-wrap:wrap;margin:-4px 0 12px}
.pl-calendar-legend span{display:inline-flex;align-items:center;gap:6px;border:1px solid ${THEME.border};background:${THEME.elevated};border-radius:999px;padding:6px 9px;font-size:10.5px;color:${THEME.muted};font-weight:900}
.pl-calendar-legend i{width:8px;height:8px;border-radius:999px;display:inline-block}
.pl-weekdays{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:8px}
.pl-weekdays div{font-size:11px;color:${THEME.muted};font-weight:900;text-align:center}
.pl-calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
.pl-day{min-height:132px;border:1px solid ${THEME.border};background:${THEME.card};border-radius:13px;padding:9px;min-width:0;cursor:pointer;transition:border-color .15s,box-shadow .15s}
.pl-day:hover{border-color:${THEME.gold};box-shadow:0 10px 24px rgba(29,28,25,.06)}
.pl-day.outside{opacity:.5;background:${THEME.bg}}
.pl-day.non-workday{background:${THEME.elevated};border-color:${THEME.border}}
.pl-day.non-workday .pl-day-num{color:#A36F22}
.pl-day-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.pl-day-top>span{font-size:9.5px;color:${THEME.muted};font-weight:800}
.pl-day-num{font-size:12px;font-weight:900;color:${THEME.gold};margin-bottom:7px}
.pl-day-items{display:flex;flex-direction:column;gap:6px}
.pl-day-items>div{border:1px solid rgba(231,224,213,.8);background:#F6F1E8;border-left:4px solid ${THEME.gold};border-radius:9px;padding:7px 8px;text-align:left;font-family:inherit;min-width:0;box-shadow:0 4px 12px rgba(29,28,25,.035)}
.pl-day-items .agenda-item{border-style:solid}
.pl-day-items .cronograma-item{border-style:dashed}
.pl-day-items strong{display:block;font-size:11.5px;color:${THEME.ink};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pl-day-items span,.pl-day-items small{display:block;font-size:10.5px;color:${THEME.muted};margin-top:2px}
.pl-day-items em{display:inline-flex;margin-top:5px;border-radius:999px;background:${THEME.elevated};color:${THEME.gold};font-style:normal;font-size:9.5px;font-weight:900;padding:2px 6px}
.pl-calendar-bottom-nav{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px;padding-top:16px;border-top:1px solid ${THEME.border}}.pl-calendar-bottom-nav strong{font-size:12px;color:${THEME.muted}}.pl-calendar-bottom-nav button{border:1px solid ${THEME.border};background:${THEME.elevated};color:${THEME.ink};border-radius:9px;min-height:42px;padding:9px 14px;font-size:12px;font-weight:900;cursor:pointer}.pl-calendar-bottom-nav button.next{background:${THEME.gold};border-color:${THEME.gold};color:${THEME.bg}}
.pl-filters{display:grid;grid-template-columns:minmax(220px,1.4fr) repeat(6,minmax(0,1fr));gap:9px;margin-bottom:14px}
.pl-filters input,.pl-filters select{background:${THEME.inputBackground};border:1px solid ${THEME.inputBorder};color:${THEME.inputText};border-radius:8px;padding:10px 14px;width:100%;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit}
.pl-table-wrap{overflow:auto;border:1px solid ${THEME.border};border-radius:14px}
.pl-table{width:100%;border-collapse:collapse;min-width:1120px}
.pl-table th{background:${THEME.elevated};color:${THEME.muted};font-size:10px;letter-spacing:1.2px;text-transform:uppercase;text-align:left;padding:11px 12px;white-space:nowrap}
.pl-table td{border-top:1px solid ${THEME.border};padding:12px;font-size:12.5px;color:${THEME.ink};vertical-align:middle}
.pl-table tr{cursor:pointer}
.pl-table tr:hover{background:${THEME.elevated}}
.pl-table td strong{display:block;font-size:13px}
.pl-table td small{display:block;color:${THEME.muted};font-size:11px;margin-top:3px}
.pl-badge{display:inline-flex;border-radius:999px;padding:5px 8px;font-size:10.5px;font-weight:900;white-space:nowrap}
.pl-gantt{overflow:auto;border:1px solid ${THEME.border};border-radius:14px}
.pl-gantt-head,.pl-gantt-row{display:grid;grid-template-columns:260px repeat(var(--cols),120px);min-width:max-content}
.pl-gantt-head{background:${THEME.elevated};color:${THEME.muted};font-size:10px;letter-spacing:1.2px;text-transform:uppercase;font-weight:900}
.pl-gantt-head>div{padding:11px 12px;border-right:1px solid ${THEME.border}}
.pl-gantt-row{width:100%;border:0;background:${THEME.card};border-top:1px solid ${THEME.border};text-align:left;font-family:inherit;cursor:pointer;padding:0}
.pl-gantt-row:hover{background:${THEME.elevated}}
.pl-gantt-name{padding:12px;border-right:1px solid ${THEME.border};position:sticky;left:0;background:inherit;z-index:2}
.pl-gantt-name strong{display:block;font-size:13px;color:${THEME.ink}}
.pl-gantt-name span{display:block;font-size:11px;color:${THEME.muted};margin-top:3px}
.pl-gantt-lane{position:relative;height:54px;background:repeating-linear-gradient(90deg,${THEME.card} 0,${THEME.card} 119px,${THEME.border} 120px)}
.pl-gantt-lane i{position:absolute;top:16px;height:22px;border-radius:999px;color:#fff;font-style:normal;font-size:10px;font-weight:900;padding:5px 10px;box-sizing:border-box;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;box-shadow:0 8px 18px rgba(29,28,25,.12)}
.pl-capacidade{overflow:auto;border:1px solid ${THEME.border};border-radius:14px}.pl-cap-row{display:grid;grid-template-columns:190px repeat(var(--dias),minmax(42px,1fr));min-width:1500px;border-top:1px solid ${THEME.border}}.pl-cap-row:first-child{border-top:0}.pl-cap-row>div{min-height:48px;border-right:1px solid ${THEME.border};display:flex;align-items:center;justify-content:center;gap:2px}.pl-cap-head{background:${THEME.elevated};font-size:10px;font-weight:900;color:${THEME.muted}}.pl-cap-head>div{flex-direction:column}.pl-cap-head small{font-size:8px}.pl-cap-name{position:sticky;left:0;z-index:3;background:${THEME.card};justify-content:flex-start!important;padding:0 10px;box-sizing:border-box}.pl-cap-head .pl-cap-name{background:${THEME.elevated}}.pl-cap-day.off,.pl-cap-head .off{background:rgba(109,103,94,.08)}.pl-cap-day.busy{background:rgba(201,168,76,.12)}.pl-cap-day.conflict{background:rgba(192,57,43,.16)}.pl-cap-day button{width:24px;height:24px;border:0;border-radius:6px;color:#fff;font-size:8px;font-weight:900;cursor:pointer;padding:0}
.pl-calendar-config{display:grid;grid-template-columns:auto 150px minmax(220px,1fr) auto auto;gap:8px;align-items:center;margin-bottom:10px}.pl-calendar-config input{background:${THEME.inputBackground};color:${THEME.inputText};border:1px solid ${THEME.inputBorder};border-radius:8px;padding:9px}.pl-calendar-config label{font-size:12px;font-weight:800}.pl-calendar-config button{border:0;background:${THEME.gold};color:#fff;border-radius:8px;padding:10px;font-weight:900}.pl-calendar-tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.pl-calendar-tags button{border:1px solid ${THEME.border};background:${THEME.elevated};color:${THEME.muted};border-radius:999px;padding:6px 9px;font-size:10.5px}.pl-drag-hint{font-size:11.5px;color:${THEME.muted}}
@media (max-width:760px){.pl-calendar-config{grid-template-columns:1fr}.pl-calendar-config strong{margin-bottom:2px}.pl-cap-row{grid-template-columns:145px repeat(var(--dias),minmax(40px,1fr))}.pl-drag-hint{line-height:1.4}}
.pl-empty{width:100%;max-width:none;margin:0;background:${THEME.card};border:1px solid ${THEME.border};border-radius:12px;padding:42px;text-align:center;color:${THEME.muted};box-shadow:0 2px 12px rgba(0,0,0,.3)}
.pl-modal-bg{position:fixed;inset:0;background:rgba(29,28,25,.48);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)}
.pl-modal{width:100%;max-width:780px;max-height:92vh;background:${THEME.card};border:1px solid ${THEME.border};border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden}
.pl-modal-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:22px 24px 0}
.pl-modal-head span{display:block;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${THEME.gold};font-weight:900;margin-bottom:5px}
.pl-modal-head h2{font-family:var(--font-serif);font-size:28px;line-height:1.05;font-weight:500;margin:0;color:${THEME.ink}}
.pl-modal-head button{border:1px solid ${THEME.border};background:${THEME.elevated};border-radius:10px;color:${THEME.ink};font-size:12px;font-weight:900;padding:8px 10px;cursor:pointer}
.pl-modal-body{padding:22px 24px;overflow:auto}
.pl-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.pl-form-grid label,.pl-observacao{display:flex;flex-direction:column;gap:6px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${THEME.muted};font-weight:900}
.pl-form-grid input,.pl-form-grid select,.pl-observacao textarea{background:${THEME.inputBackground};border:1px solid ${THEME.inputBorder};color:${THEME.inputText};border-radius:8px;padding:10px 14px;width:100%;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit}
.pl-non-workday-warning{margin-top:12px;display:flex!important;flex-direction:row!important;align-items:center;gap:9px;border:1px solid rgba(224,168,82,.4);background:rgba(224,168,82,.12);border-radius:12px;padding:11px 12px;color:${THEME.warn}!important;letter-spacing:0!important;text-transform:none!important;font-size:12.5px!important}
.pl-non-workday-warning input{width:auto!important}
.pl-montadores{margin:16px 0;border:1px solid ${THEME.border};background:${THEME.card};border-radius:14px;padding:14px}
.pl-montadores>span{display:block;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${THEME.gold};font-weight:900;margin-bottom:9px}
.pl-montadores small{display:block;font-size:12px;color:${THEME.muted}}
.pl-montadores>div{display:flex;gap:8px;flex-wrap:wrap}
.pl-montadores button{min-height:44px;border:1px solid ${THEME.border};background:${THEME.elevated};color:${THEME.ink};border-radius:999px;padding:10px 13px;font-size:12px;font-weight:800;cursor:pointer}
.pl-montadores button.active{background:${THEME.ink};border-color:${THEME.ink};color:#fff}
.pl-montador-visibility{margin:-4px 0 16px;border:1px solid #C8E1D0;background:#F7FCF8;color:${THEME.success};border-radius:12px;padding:10px 12px;font-size:12.5px;font-weight:800;line-height:1.35}
.pl-montador-visibility.muted{border-color:${THEME.border};background:${THEME.elevated};color:${THEME.muted}}
.pl-modal-foot{display:flex;justify-content:flex-end;gap:10px;padding:16px 24px;border-top:1px solid ${THEME.border};background:${THEME.card}}
.pl-modal-foot button{border:1px solid ${THEME.border};background:${THEME.elevated};color:${THEME.ink};border-radius:10px;padding:10px 15px;font-size:13px;font-weight:800;cursor:pointer}
.pl-modal-foot button.primary{background:${THEME.gold};border-color:${THEME.gold};color:#fff}
.pl-day-modal{max-width:860px}.pl-day-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}.pl-day-summary>div{border:1px solid ${THEME.border};background:${THEME.elevated};border-radius:11px;padding:12px}.pl-day-summary span,.pl-day-team>span,.pl-day-detail-grid span{display:block;font-size:9.5px;letter-spacing:1.2px;text-transform:uppercase;color:${THEME.muted};font-weight:900}.pl-day-summary strong{display:block;margin-top:6px;font-size:17px;color:${THEME.ink}}.pl-day-team{border:1px solid ${THEME.border};border-radius:11px;padding:12px;margin-bottom:14px}.pl-day-team>div{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.pl-day-team b{background:${THEME.elevated};border-radius:999px;padding:6px 9px;font-size:11px;color:${THEME.ink}}.pl-day-detail-list{display:grid;gap:10px}.pl-day-detail-list article{border:1px solid ${THEME.border};border-left:4px solid ${THEME.gold};border-radius:11px;padding:14px;background:${THEME.card}}.pl-day-detail-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.pl-day-detail-head span{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;font-weight:900}.pl-day-detail-head h3{font-size:15px;margin:4px 0 0;color:${THEME.ink}}.pl-day-detail-head>b{font-size:11px;background:${THEME.elevated};border-radius:999px;padding:6px 9px;white-space:nowrap}.pl-day-detail-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:14px}.pl-day-detail-grid strong{display:block;font-size:12px;color:${THEME.ink};margin-top:4px;line-height:1.35}.pl-day-detail-list article p{font-size:12px;color:${THEME.muted};margin:12px 0 0;padding-top:10px;border-top:1px solid ${THEME.border}}.pl-day-detail-list article>button{border:0;background:transparent;color:${THEME.gold};font-weight:900;font-size:11.5px;padding:12px 0 0;cursor:pointer}.pl-day-empty{border:1px dashed ${THEME.border};border-radius:12px;padding:28px;text-align:center}.pl-day-empty strong,.pl-day-empty span{display:block}.pl-day-empty span{font-size:12px;color:${THEME.muted};margin-top:5px}
@media (max-width:1100px){.pl-kpis{grid-template-columns:repeat(3,1fr)}.pl-attention-list{grid-template-columns:1fr 1fr}.pl-filters{grid-template-columns:repeat(2,1fr)}.pl-calendar{grid-template-columns:repeat(2,1fr)}.pl-weekdays{display:none}.pl-day{min-height:auto}.pl-day.outside{display:none}.pl-form-grid{grid-template-columns:1fr 1fr}}
@media (max-width:760px){.pl-page{padding:22px 14px calc(112px + env(safe-area-inset-bottom))}.pl-header{display:block;margin-bottom:12px;padding-right:0}.pl-eyebrow{font-size:9px;letter-spacing:2px;margin-bottom:4px}.pl-header h1{font-size:28px;line-height:1.02}.pl-header p{font-size:12.5px;line-height:1.45}.pl-month-nav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;justify-content:flex-start;margin-top:10px}.pl-month-nav strong{grid-column:1/-1;order:-1;text-align:left;min-width:0;font-size:16px}.pl-month-nav button{width:100%;padding:10px 9px;font-size:12px}.pl-mobile-actions{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:8px;margin:0 0 12px;max-width:none}.pl-mobile-actions button{border:1px solid ${THEME.border};background:${THEME.elevated};color:${THEME.ink};border-radius:13px;padding:10px 8px;font-size:12px;font-weight:900;font-family:inherit}.pl-mobile-actions button.primary{background:${THEME.gold};border-color:${THEME.gold};color:#fff}.pl-kpis{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:12px}.pl-kpis>*{flex:0 0 auto;min-width:auto;max-width:none}.pl-kpi{display:flex;align-items:center;gap:7px;border-radius:999px;padding:7px 10px;min-width:auto;max-width:none;border-top:1px solid rgba(184,150,94,.22)}.pl-kpi span{white-space:nowrap;font-size:10.5px;line-height:1;letter-spacing:0;margin:0}.pl-kpi strong{font-size:15px}.pl-attention{padding:15px 13px;border-radius:15px}.pl-attention-list{grid-template-columns:1fr}.pl-mobile-operational{display:grid;gap:10px;margin:0 0 12px;max-width:none}.pl-mobile-group{background:${THEME.card};border:1px solid ${THEME.border};border-radius:16px;padding:13px;box-shadow:0 14px 34px rgba(29,28,25,.045)}.pl-mobile-group-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.pl-mobile-group-head h2{font-size:19px;margin:0}.pl-mobile-group-head span{color:${THEME.gold};font-size:13px;font-weight:900}.pl-mobile-item{width:100%;border:1px solid ${THEME.border};border-left:4px solid ${THEME.gold};background:${THEME.elevated};border-radius:13px;padding:12px;margin-top:8px;display:flex;justify-content:space-between;gap:12px;text-align:left;font-family:inherit}.pl-mobile-item span{display:block;font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:${THEME.gold};font-weight:900;margin-bottom:4px}.pl-mobile-item strong{display:block;font-size:14px;color:${THEME.ink};line-height:1.25}.pl-mobile-item small,.pl-mobile-item em{display:block;font-size:11.5px;color:${THEME.muted};line-height:1.35;font-style:normal}.pl-mobile-side{display:flex;flex-direction:column;align-items:flex-end;gap:6px;min-width:92px}.pl-mobile-side b{border-radius:999px;padding:5px 8px;font-size:10.5px;line-height:1;font-weight:900;white-space:nowrap}.pl-mobile-side b.tone-success{background:rgba(76,175,125,.12);color:${THEME.success}}.pl-mobile-side b.tone-info{background:rgba(59,95,134,.18);color:${THEME.blue}}.pl-mobile-side b.tone-warn{background:rgba(224,168,82,.12);color:${THEME.warn}}.pl-mobile-item em{text-align:right;max-width:120px}.pl-mobile-empty{border:0;border-radius:0;padding:3px 0 2px;text-align:left;color:${THEME.muted};font-size:12.5px}.pl-tabs,.pl-card:has(.pl-calendar){display:none}.pl-card{padding:15px 13px;border-radius:15px}.pl-card-head h2{font-size:20px}.pl-calendar{grid-template-columns:1fr;gap:10px}.pl-day{min-height:78px;padding:11px 12px}.pl-day.outside{display:none}.pl-day-items>div{padding:9px 10px}.pl-day-items strong{white-space:normal}.pl-filters{grid-template-columns:1fr}.pl-gantt-head,.pl-gantt-row{grid-template-columns:190px repeat(var(--cols),100px)}.pl-modal-bg{align-items:flex-end;padding:8px}.pl-modal{max-height:94vh;border-radius:18px 18px 0 0}.pl-modal-head{padding:20px 18px 0}.pl-modal-body{padding:18px}.pl-modal-foot{padding:14px 18px}.pl-form-grid,.pl-day-detail-grid{grid-template-columns:1fr}.pl-day-summary{grid-template-columns:1fr 1fr}.pl-day-summary>div:last-child{grid-column:1/-1}}
`
