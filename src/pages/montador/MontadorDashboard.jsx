import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { CHECKLIST_MONTAGEM_GERAL } from '../../constants/checklistOrnare'
import { faseOrnarePorKey, faseOrnarePorTexto } from '../../constants/fasesOrnare'
import { theme } from '../../constants/theme'

const THEME = {
  bg: theme.background,
  card: theme.surface,
  border: theme.border,
  ink: theme.textPrimary,
  muted: theme.textSecondary,
  textMuted: theme.textMuted,
  gold: theme.gold,
  success: theme.success,
  danger: theme.error,
  warn: theme.warning,
  elevated: theme.surfaceElevated,
  inputBackground: theme.inputBackground,
  inputBorder: theme.inputBorder,
  inputText: theme.inputText,
  inputPlaceholder: theme.inputPlaceholder,
}

const FOTO_CATEGORIAS = [
  'Vistoria',
  'Antes da montagem',
  'Durante a montagem',
  'Finalizado',
  'Não conformidade',
  'Técnica',
  'Entrega',
  'Cliente',
  'Geral',
]

const VISTORIA_CHECKLIST = [
  'Conferir acesso à obra, elevador, carga e descarga.',
  'Conferir pontos elétricos, hidráulicos e interferências aparentes.',
  'Confirmar se a obra está apta para montagem.',
  'Registrar fotos de vistoria por ambiente.',
  'Sinalizar pendências que podem impedir início.',
  'Validar se ambientes estão limpos e desimpedidos.',
]

const MONTAGEM_CHECKLIST = CHECKLIST_MONTAGEM_GERAL

const safeArray = result => result?.data || []
const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const VISTORIA_CHECKLIST_NORMALIZADO = new Set(VISTORIA_CHECKLIST.map(norm))
const isConcluido = status => ['concluida', 'concluido', 'finalizada', 'finalizado'].includes(norm(status))
const isAberta = status => !isConcluido(status) && !['fechada', 'resolvida', 'cancelada'].includes(norm(status))

function isChecklistVistoriaCampo(item) {
  const texto = norm(item?.descricao)
  if (!texto) return false
  return (
    texto.includes('vistoria') ||
    texto.includes('elevador') ||
    texto.includes('carga e descarga') ||
    texto.includes('pontos eletricos') ||
    texto.includes('pontos hidraulicos') ||
    texto.includes('interferencias aparentes') ||
    texto.includes('apta para montagem') ||
    texto.includes('apta para receber') ||
    texto.includes('impedir o inicio') ||
    texto.includes('ambientes estao limpos') ||
    texto.includes('limpos liberados') ||
    VISTORIA_CHECKLIST_NORMALIZADO.has(texto)
  )
}

function dataInicioPrevistaObra(obra) {
  return obra?.data_previsao_inicio || obra?.data_inicio_prevista || obra?.data_inicio || null
}

function dataFimPrevistaObra(obra) {
  return obra?.data_previsao || obra?.data_previsao_entrega || obra?.data_fim_prevista || obra?.data_previsao_fim || null
}

function mesAnoBR(data) {
  const partes = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).split(' de ')
  if (partes.length !== 2) return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return `${partes[0].charAt(0).toUpperCase()}${partes[0].slice(1)} de ${partes[1]}`
}

function fotoUrl(foto) {
  if (foto.url) return foto.url
  if (!foto.storage_path) return ''
  return supabase.storage.from('fotos-obras').getPublicUrl(foto.storage_path).data.publicUrl
}

function dataBR(value) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR') : '-'
}

function dataCurtaMes(value) {
  if (!value) return '-'
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}

function horaBR(value) {
  return value ? new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'
}

function mesmoDia(value, base) {
  if (!value) return false
  const data = new Date(value)
  return data.getFullYear() === base.getFullYear() && data.getMonth() === base.getMonth() && data.getDate() === base.getDate()
}

function coordenadaCurta(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num.toFixed(4) : null
}

function localizacaoCheckin(checkin) {
  if (!checkin?.latitude || !checkin?.longitude) return 'Localização não registrada'
  const lat = coordenadaCurta(checkin.latitude)
  const lng = coordenadaCurta(checkin.longitude)
  return lat && lng ? `Localização salva (${lat}, ${lng})` : 'Localização salva'
}

function statusAgenda(item) {
  const statusOriginal = item?.status || item?.situacao || item?.situacao_agenda
  if (statusOriginal) {
    const n = norm(statusOriginal)
    if (n.includes('conclu') || n.includes('realiz')) return { label: 'Concluída', tone: 'success' }
    if (n.includes('andamento')) return { label: 'Em andamento', tone: 'info' }
    if (n.includes('atras')) return { label: 'Atrasada', tone: 'danger' }
    if (n.includes('pend')) return { label: 'Pendente', tone: 'warn' }
    return { label: statusOriginal, tone: 'warn' }
  }

  if (!item?.data) return { label: 'Pendente', tone: 'warn' }
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const data = new Date(`${item.data}T00:00:00`)
  if (data < hoje) return { label: 'Realizada', tone: 'success' }
  if (data.getTime() === hoje.getTime()) return { label: 'Hoje', tone: 'info' }
  return { label: 'Pendente', tone: 'warn' }
}

function cidadeBairro(obra) {
  if (!obra) return 'Local não informado'
  return [obra.cidade, obra.bairro || obra.uf].filter(Boolean).join(' · ') || obra.cidade || obra.uf || 'Local não informado'
}

function tipoAgenda(item) {
  if (item.origem === 'inicio_previsto') return 'Início previsto'
  if (item.origem === 'fim_previsto') return 'Previsão de término'
  const tipo = norm(item.tipo || item.titulo || item.observacao || item.descricao)
  if (tipo.includes('vistoria')) return 'Vistoria'
  if (tipo.includes('assist')) return 'Assistência técnica'
  if (tipo.includes('medicao') || tipo.includes('medi')) return 'Medição'
  if (tipo.includes('entrega')) return 'Entrega'
  if (tipo.includes('reuniao') || tipo.includes('reuni')) return 'Reunião'
  return 'Montagem'
}

function corDataOperacional(item) {
  const tipo = norm(tipoAgenda(item))
  if (tipo.includes('vistoria')) return { bg: '#EAF3FF', border: '#4A90D9', color: '#1F5D9E' }
  if (tipo.includes('montagem')) return { bg: '#EAF5EE', border: THEME.success, color: THEME.success }
  if (tipo.includes('assist')) return { bg: '#FFF5EA', border: '#E07B39', color: '#B95A1F' }
  if (tipo.includes('medicao')) return { bg: '#F1ECFA', border: '#9070C0', color: '#6D4E9E' }
  if (tipo.includes('entrega')) return { bg: '#F6F0E6', border: '#B09A7A', color: '#7A6241' }
  if (tipo.includes('termino')) return { bg: '#F3F1ED', border: THEME.ink, color: THEME.ink }
  if (tipo.includes('inicio previsto')) return { bg: '#FFF8EA', border: THEME.gold, color: THEME.warn }
  return { bg: '#F6F3EE', border: THEME.border, color: THEME.muted }
}

function obraAguardandoInicio(obra) {
  const status = norm(obra?.status)
  return status.includes('aguardando inicio') || status.includes('aguardando montagem')
}

function obraEmMontagem(obra) {
  const status = norm(obra?.status)
  const fase = norm(obra?.fase || obra?.fase_atual)
  return status.includes('em montagem') || status.includes('montagem') || fase.includes('montagem')
}

function faseObraMontador(obra) {
  const fase = faseOrnarePorKey(obra?.fase) || faseOrnarePorKey(obra?.fase_atual) || faseOrnarePorTexto(obra?.fase || obra?.fase_atual || obra?.status)
  const key = fase?.key
  const status = norm(obra?.status)
  if (status.includes('conclu')) return { key: 'obra_concluida', label: 'Concluída', bg: '#EAF5EE', color: THEME.success, border: THEME.success }
  if (status.includes('em montagem')) return { key: 'montagem', label: 'Em montagem', bg: '#EAF5EE', color: THEME.success, border: THEME.success, andamento: true }
  if (status.includes('aguardando montagem')) return { key, label: 'Aguardando liberação', bg: '#FFF7E8', color: '#9A6A22', border: '#E8A020' }
  if (status.includes('aguardando inicio') && ['producao', 'executivo', 'vistoria_medida'].includes(key)) return { key, label: 'Em produção', bg: 'rgba(255,255,255,.15)', color: '#FFFFFF', border: 'rgba(255,255,255,.28)', producao: true }
  if (key === 'vistoria_tecnica' || key === 'entrega_moveis') return { key, label: 'Aguardando liberação', bg: '#FFF7E8', color: '#9A6A22', border: '#E8A020' }
  if (key === 'montagem') return { key, label: 'Em montagem', bg: '#EAF5EE', color: THEME.success, border: THEME.success, andamento: true }
  if (key === 'montagem_finalizada') return { key, label: 'Montagem finalizada', bg: '#EEF5FF', color: '#2563EB', border: '#2563EB', solicitarVistoria: true }
  if (key === 'vistoria_final') return { key, label: 'Vistoria final pendente', bg: '#FFF8EC', color: THEME.gold, border: THEME.gold }
  return { key: key || 'aguardando', label: 'Aguardando início', bg: '#F3F1ED', color: '#8A8175', border: '#9E9E9E' }
}

function diasEmAndamento(obra) {
  const inicio = obra?.data_inicio_real || obra?.data_inicio
  if (!inicio) return null
  const dataInicio = new Date(`${String(inicio).slice(0, 10)}T00:00:00`)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.max(1, Math.floor((hoje - dataInicio) / (1000 * 60 * 60 * 24)) + 1)
}

async function buscarDadosOperacionais(obraId, userId) {
  const [
    tarefasResult,
    checkinsResult,
    checklistResult,
    ambientesResult,
    fotosResult,
    ocorrenciasResult,
    agendaResult,
  ] = await Promise.all([
    supabase.from('tarefas').select('*').eq('obra_id', obraId).eq('responsavel_id', userId).order('prazo'),
    supabase.from('checkins').select('*').eq('user_id', userId).eq('obra_id', obraId).order('created_at', { ascending: false }).limit(20),
    supabase.from('checklist_items').select('id, obra_id, ambiente_id, descricao, concluido, concluido_por, concluido_em').eq('obra_id', obraId).order('descricao'),
    supabase.from('obra_ambientes').select('id, nome, status').eq('obra_id', obraId).order('nome'),
    supabase.from('fotos').select('*').eq('obra_id', obraId).order('created_at', { ascending: false }).limit(60),
    supabase.from('ocorrencias').select('*').eq('obra_id', obraId).order('created_at', { ascending: false }).limit(40),
    supabase.from('agenda').select('*').eq('obra_id', obraId).order('data').order('hora_inicio'),
  ])

  return {
    tarefasResult,
    checkinsResult,
    checklistResult,
    ambientesResult,
    fotosResult,
    ocorrenciasResult,
    agendaResult,
  }
}

function registrarErrosOperacionais(contexto, dados) {
  Object.entries({
    tarefas: dados.tarefasResult,
    checkins: dados.checkinsResult,
    checklist: dados.checklistResult,
    ambientes: dados.ambientesResult,
    fotos: dados.fotosResult,
    ocorrencias: dados.ocorrenciasResult,
    agenda: dados.agendaResult,
  }).forEach(([nome, result]) => {
    if (result?.error) console.error(`Erro ao carregar ${nome} (${contexto}):`, result.error)
  })
}

export default function MontadorDashboard() {
  const navigate = useNavigate()
  const { user, profile, setUser, setProfile } = useStore()

  const [obras, setObras] = useState([])
  const [obraAtiva, setObraAtiva] = useState(null)
  const [tarefas, setTarefas] = useState([])
  const [checkins, setCheckins] = useState([])
  const [checklist, setChecklist] = useState([])
  const [ambientes, setAmbientes] = useState([])
  const [fotos, setFotos] = useState([])
  const [ocorrencias, setOcorrencias] = useState([])
  const [agenda, setAgenda] = useState([])
  const [agendaCalendario, setAgendaCalendario] = useState([])

  const [loading, setLoading] = useState(true)
  const [loadingObra, setLoadingObra] = useState(false)
  const [checkando, setCheckando] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [salvandoProblema, setSalvandoProblema] = useState(false)
  const [modalProblema, setModalProblema] = useState(null)
  const [tarefaAberta, setTarefaAberta] = useState(null)
  const [observacaoTarefa, setObservacaoTarefa] = useState('')
  const [calendarioAberto, setCalendarioAberto] = useState(false)
  const [mesCalendario, setMesCalendario] = useState(new Date())
  const [diaCalendario, setDiaCalendario] = useState('')
  const [problema, setProblema] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [servicoFeedback, setServicoFeedback] = useState('')
  const [preview, setPreview] = useState(null)
  const [formFoto, setFormFoto] = useState({ categoria: '', ambiente_id: '', agenda_id: '', observacao: '' })
  const [ambienteSelecionado, setAmbienteSelecionado] = useState('geral')
  const [itemAcao, setItemAcao] = useState('')
  const [novoChecklist, setNovoChecklist] = useState('')
  const [criandoChecklist, setCriandoChecklist] = useState(false)
  const [telaAtiva, setTelaAtiva] = useState('hoje')

  const checklistRef = useRef(null)
  const fotosRef = useRef(null)
  const ocorrenciasRef = useRef(null)
  const perfilRef = useRef(null)
  const longPressRef = useRef(null)

  function mostrarSucesso(msg) {
    setSucesso(msg)
    window.setTimeout(() => setSucesso(''), 3200)
  }

  const garantirChecklistMontagem = useCallback(async (obra, itensAtuais = []) => {
    if (!obra?.id || !obraEmMontagem(obra)) return itensAtuais

    const vistoriaSolta = itensAtuais
      .filter(item => !item.ambiente_id && !item.concluido && isChecklistVistoriaCampo(item))
      .map(item => item.id)
      .filter(Boolean)

    const itensBase = itensAtuais.filter(item => !vistoriaSolta.includes(item.id))
    const descricoes = new Set(itensBase.map(item => norm(item.descricao)))
    const rows = MONTAGEM_CHECKLIST
      .filter(descricao => !descricoes.has(norm(descricao)))
      .map((descricao, index) => ({
        obra_id: obra.id,
        ambiente_id: null,
        descricao,
        concluido: false,
        fase: 'Montagem',
        responsavel_perfil: 'montador',
        responsavel_id: user?.id || null,
        status: 'pendente',
        criticidade: index <= 1 ? 'alta' : 'media',
        exige_foto: index === 8,
      }))

    if (rows.length > 0) {
      const { error } = await supabase.from('checklist_items').insert(rows)
      if (error) {
        console.error('Erro ao criar checklist operacional de montagem:', error)
        return itensBase
      }
    }

    if (vistoriaSolta.length > 0) {
      const { error } = await supabase.from('checklist_items').delete().in('id', vistoriaSolta)
      if (error) console.error('Erro ao remover checklist de vistoria do fluxo de montagem:', error)
    }

    const { data, error } = await supabase
      .from('checklist_items')
      .select('id, obra_id, ambiente_id, descricao, concluido, concluido_por, concluido_em')
      .eq('obra_id', obra.id)
      .order('descricao')

    if (error) {
      console.error('Erro ao recarregar checklist operacional de montagem:', error)
      return itensBase
    }

    return (data || []).filter(item => !(!item.ambiente_id && !item.concluido && isChecklistVistoriaCampo(item)))
  }, [user?.id])

  async function carregarDadosObra(obra = obraAtiva) {
    if (!obra?.id || !user?.id) return

    setLoadingObra(true)
    try {
      const dados = await buscarDadosOperacionais(obra.id, user.id)
      registrarErrosOperacionais('recarregar obra', dados)

      setTarefas(safeArray(dados.tarefasResult))
      setCheckins(safeArray(dados.checkinsResult))
      setChecklist(await garantirChecklistMontagem(obra, safeArray(dados.checklistResult)))
      setAmbientes(safeArray(dados.ambientesResult))
      setFotos(safeArray(dados.fotosResult).map(foto => ({ ...foto, categoria: foto.categoria || 'Geral', publicUrl: fotoUrl(foto) })))
      setOcorrencias(safeArray(dados.ocorrenciasResult))
      setAgenda(safeArray(dados.agendaResult))
    } catch (error) {
      console.error('Erro inesperado ao recarregar dados da obra:', error)
      mostrarSucesso('Não foi possível atualizar os dados da obra.')
    } finally {
      setLoadingObra(false)
    }
  }

  useEffect(() => {
    if (!user?.id) return
    let ativo = true

    async function carregar() {
      setLoading(true)
      const vinculosResult = await supabase
        .from('obra_montadores')
        .select('obra_id')
        .eq('montador_id', user.id)

      if (vinculosResult.error) {
        console.error('Erro ao carregar vínculos do montador:', vinculosResult.error)
        mostrarSucesso('Não foi possível carregar suas obras.')
      }

      if (!ativo) return

      const obraIds = [...new Set(safeArray(vinculosResult).map(v => v.obra_id).filter(Boolean))]
      if (!obraIds.length) {
        setObras([])
        setObraAtiva(null)
        setLoading(false)
        return
      }

      const obrasResult = await supabase
        .from('obras')
        .select('*')
        .in('id', obraIds)
        .order('created_at', { ascending: false })

      const agendaTodasResult = await supabase
        .from('agenda')
        .select('*, obras(nome)')
        .in('obra_id', obraIds)
        .order('data')
        .order('hora_inicio')

      if (obrasResult.error) console.error('Erro ao carregar obras do montador:', obrasResult.error)
      if (agendaTodasResult.error) console.error('Erro ao carregar agenda geral do montador:', agendaTodasResult.error)

      if (!ativo) return

      const lista = safeArray(obrasResult)
      setObras(lista)
      setAgendaCalendario(safeArray(agendaTodasResult))
      setObraAtiva(atual => {
        const anterior = lista.find(o => o.id === atual?.id)
        return anterior || lista.find(o => ['em montagem', 'em andamento', 'montagem agendada'].includes(norm(o.status))) || lista[0] || null
      })
      setLoading(false)
    }

    carregar()

    return () => { ativo = false }
  }, [user?.id])

  useEffect(() => {
    if (!obraAtiva?.id || !user?.id) return
    let ativo = true

    async function carregar() {
      setLoadingObra(true)
      try {
        const dados = await buscarDadosOperacionais(obraAtiva.id, user.id)

        if (!ativo) return

        registrarErrosOperacionais('troca de obra', dados)
        setTarefas(safeArray(dados.tarefasResult))
        setCheckins(safeArray(dados.checkinsResult))
        setChecklist(await garantirChecklistMontagem(obraAtiva, safeArray(dados.checklistResult)))
        setAmbientes(safeArray(dados.ambientesResult))
        setFotos(safeArray(dados.fotosResult).map(foto => ({ ...foto, categoria: foto.categoria || 'Geral', publicUrl: fotoUrl(foto) })))
        setOcorrencias(safeArray(dados.ocorrenciasResult))
        setAgenda(safeArray(dados.agendaResult))
      } catch (error) {
        console.error('Erro inesperado ao carregar dados da obra ativa:', error)
        if (ativo) mostrarSucesso('Não foi possível carregar os dados da obra.')
      } finally {
        if (ativo) setLoadingObra(false)
      }
    }

    carregar()

    return () => { ativo = false }
  }, [obraAtiva, garantirChecklistMontagem, user?.id])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAmbienteSelecionado('geral')
      setNovoChecklist('')
      setItemAcao('')
      setTelaAtiva('hoje')
    }, 0)
    return () => window.clearTimeout(timer)
  }, [obraAtiva?.id])

  async function logout() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setObras([])
    setObraAtiva(null)
    navigate('/login', { replace: true })
  }

  function compromissoAtual() {
    const agora = new Date()
    const hoje = agora.toISOString().split('T')[0]
    const operacionais = agenda
      .filter(item => item.data === hoje)
      .filter(item => ['vistoria', 'montagem', 'assist', 'medicao', 'entrega'].some(termo => norm(item.tipo || item.titulo).includes(termo)))
      .sort((a, b) => `${a.hora_inicio || ''}`.localeCompare(`${b.hora_inicio || ''}`))
    return operacionais[0] || agenda.find(item => item.data === hoje) || null
  }

  async function criarNotificacoesOperacionais({ tipo, titulo, descricao, entidadeTipo, entidadeId, agendaId, prioridade = 'normal' }) {
    if (!obraAtiva || !user) return
    const destinatarios = new Set([obraAtiva.supervisor_id, obraAtiva.comercial_id].filter(Boolean))
    const { data: gestores, error: gestoresError } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['gestao', 'pos_venda', 'vendedor'])

    if (gestoresError) {
      console.error('Erro ao buscar destinatários das notificações:', gestoresError)
    }

    ;(gestores || []).forEach(p => p.id && destinatarios.add(p.id))
    destinatarios.delete(user.id)

    let rota = `/obras/${obraAtiva.id}`
    if (entidadeTipo === 'fotos') rota = `/obras/${obraAtiva.id}?aba=Fotos&foto=${entidadeId || ''}`
    else if (entidadeTipo === 'ocorrencias') rota = `/obras/${obraAtiva.id}?aba=Ocorrencias&ocorrencia=${entidadeId || ''}`
    else if (entidadeTipo === 'checklist_items') rota = `/obras/${obraAtiva.id}?aba=Checklist&checklist=${entidadeId || ''}`
    else if (entidadeTipo === 'tarefas') rota = `/tarefas?tarefa=${entidadeId || ''}`
    else if (entidadeTipo === 'checkin') rota = agendaId ? `/agenda?compromisso=${agendaId}` : `/obras/${obraAtiva.id}?aba=Agenda`
    else if (agendaId) rota = `/agenda?compromisso=${agendaId}`

    const registros = [...destinatarios].map(usuario_id => ({
      usuario_id,
      obra_id: obraAtiva.id,
      tipo,
      titulo,
      descricao,
      prioridade,
      status: 'nao_lida',
      rota,
      entidade_tipo: entidadeTipo,
      entidade_id: entidadeId || agendaId || obraAtiva.id,
    }))

    if (registros.length) {
      const { error } = await supabase.from('notificacoes').insert(registros)
      if (error) console.error('Erro ao criar notificações operacionais:', error)
    }
  }

  async function fazerCheckin() {
    if (!obraAtiva || !user) return
    setCheckando(true)
    setServicoFeedback('')

    let lat = null
    let lng = null
    let localizacaoAutorizada = false

    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
      )
      lat = pos.coords.latitude
      lng = pos.coords.longitude
      localizacaoAutorizada = true
    } catch (error) {
      console.warn('Check-in sem localização disponível:', error)
      // O check-in continua mesmo se a localização não estiver disponível.
    }

    const compromisso = compromissoAtual()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    const userId = authData?.user?.id || user.id

    if (authError || !userId) {
      console.error('Erro ao identificar usuário para check-in:', authError)
      mostrarSucesso('Não foi possível identificar o usuário logado.')
      setCheckando(false)
      return
    }

    const entrada = new Date().toISOString()
    const payloadCompleto = {
      user_id: userId,
      obra_id: obraAtiva.id,
      agenda_id: compromisso?.id || null,
      entrada,
      localizacao_autorizada: localizacaoAutorizada,
      entrada_latitude: lat,
      entrada_longitude: lng,
      latitude: lat,
      longitude: lng,
    }
    const payloadMinimo = {
      user_id: userId,
      obra_id: obraAtiva.id,
      entrada,
    }

    let resultado = await supabase.from('checkins').insert([payloadCompleto])
    if (resultado.error) {
      console.error('Erro no check-in com payload completo:', resultado.error)
      resultado = await supabase.from('checkins').insert([payloadMinimo])
    }

    if (resultado.error) {
      console.error('Erro no check-in com payload mínimo:', resultado.error)
      mostrarSucesso('Não foi possível registrar o check-in. Verifique permissão de acesso à obra.')
      setCheckando(false)
      return
    }

    const mensagem = lat ? 'Check-in registrado com localização.' : 'Check-in registrado.'
    setServicoFeedback(mensagem)
    mostrarSucesso(mensagem)
    if (compromisso?.id) {
      const agendaResult = await supabase.from('agenda').update({ status: 'em andamento' }).eq('id', compromisso.id)
      if (agendaResult.error) console.error('Check-in registrado, mas nao foi possivel atualizar a agenda:', agendaResult.error)
    }
    await criarNotificacoesOperacionais({
      tipo: 'checkin',
      titulo: 'Montador fez check-in',
      descricao: `${profile?.full_name || 'Montador'} iniciou serviço em ${obraAtiva.nome || 'obra'}.`,
      entidadeTipo: 'checkin',
      entidadeId: null,
      agendaId: compromisso?.id,
      prioridade: 'normal',
    })
    await carregarDadosObra()
    setCheckando(false)
  }

  async function fazerCheckout() {
    setCheckando(true)
    const ultimo = checkins.find(c => !c.saida)
    if (ultimo) {
      let lat = null
      let lng = null
      try {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
        )
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch (error) {
        console.warn('Check-out sem localização disponível:', error)
        // Check-out continua mesmo sem localizacao.
      }
      const { error } = await supabase.from('checkins').update({
        saida: new Date().toISOString(),
        saida_latitude: lat,
        saida_longitude: lng,
      }).eq('id', ultimo.id)
      if (error) {
        mostrarSucesso('Não foi possível registrar o check-out.')
        setCheckando(false)
        return
      }
      await criarNotificacoesOperacionais({
        tipo: 'checkout',
        titulo: 'Montador fez check-out',
        descricao: `${profile?.full_name || 'Montador'} finalizou serviço em ${obraAtiva.nome || 'obra'}.`,
        entidadeTipo: 'checkin',
        entidadeId: ultimo.id,
        agendaId: ultimo.agenda_id,
        prioridade: 'normal',
      })
    }
    setServicoFeedback('Check-out registrado.')
    mostrarSucesso('Check-out registrado.')
    await carregarDadosObra()
    setCheckando(false)
  }

  function abrirTarefa(tarefa) {
    setTarefaAberta(tarefa)
    setObservacaoTarefa(tarefa?.observacao || '')
  }

  async function gerarChecklistVistoriaTarefa(tarefa) {
    if (!tarefa?.obra_id || !norm(tarefa.tipo || tarefa.titulo).includes('vistoria')) return
    const { data: existentes, error: consultaError } = await supabase
      .from('checklist_items')
      .select('id')
      .eq('obra_id', tarefa.obra_id)
      .ilike('descricao', '%vistoria%')
      .limit(1)

    if (consultaError) {
      console.error('Erro ao consultar checklist de vistoria:', consultaError)
      return
    }

    if ((existentes || []).length > 0) return

    const rows = VISTORIA_CHECKLIST.map((descricao, index) => ({
      obra_id: tarefa.obra_id,
      ambiente_id: null,
      descricao,
      concluido: false,
      fase: 'Pré-Montagem',
      responsavel_perfil: 'montador',
      responsavel_id: user?.id || null,
      status: 'pendente',
      criticidade: index === 3 ? 'alta' : 'media',
      exige_foto: index === 3,
    }))

    const { error } = await supabase.from('checklist_items').insert(rows)
    if (error) console.error('Erro ao criar checklist de vistoria:', error)
  }

  async function mudarStatus(id, status, tarefaBase = null) {
    const tarefa = tarefaBase || tarefas.find(t => t.id === id)
    const { error } = await supabase.from('tarefas').update({ status }).eq('id', id)
    if (error) {
      console.error('Erro ao atualizar tarefa:', error)
      mostrarSucesso('Não foi possível atualizar a tarefa.')
      return
    }
    if (status === 'em_andamento') await gerarChecklistVistoriaTarefa(tarefa)
    if (status === 'em_andamento' || status === 'concluida') {
      await criarNotificacoesOperacionais({
        tipo: status === 'concluida' ? 'tarefa_concluida' : 'tarefa_iniciada',
        titulo: status === 'concluida' ? 'Tarefa concluída' : 'Tarefa iniciada',
        descricao: `${profile?.full_name || 'Montador'} ${status === 'concluida' ? 'concluiu' : 'iniciou'} ${tarefa?.titulo || tarefa?.descricao || 'uma tarefa operacional'}.`,
        entidadeTipo: 'tarefas',
        entidadeId: id,
        prioridade: status === 'concluida' ? 'normal' : 'media',
      })
    }
    if (tarefaAberta?.id === id) setTarefaAberta(p => p ? { ...p, status } : p)
    await carregarDadosObra()
  }

  async function salvarObservacaoTarefa() {
    if (!tarefaAberta?.id) return
    const { error } = await supabase.from('tarefas').update({ observacao: observacaoTarefa }).eq('id', tarefaAberta.id)
    if (error) {
      console.error('Erro ao salvar observação da tarefa:', error)
      mostrarSucesso('Não foi possível salvar a observação.')
      return
    }
    mostrarSucesso('Observação salva.')
    setTarefaAberta(p => p ? { ...p, observacao: observacaoTarefa } : p)
    await carregarDadosObra()
  }

  async function toggleChecklist(item) {
    if (!user) return
    const concluindo = !item.concluido
    const { error } = await supabase.from('checklist_items').update({
      concluido: concluindo,
      concluido_por: concluindo ? user.id : null,
      concluido_em: concluindo ? new Date().toISOString() : null,
    }).eq('id', item.id)
    if (error) {
      console.error('Erro ao salvar checklist:', { error, item })
      mostrarSucesso('Não foi possível salvar o checklist.')
      return
    }
    if (concluindo) {
      await criarNotificacoesOperacionais({
        tipo: 'checklist',
        titulo: 'Item de checklist concluído',
        descricao: item.descricao || 'Checklist atualizado pelo montador.',
        entidadeTipo: 'checklist_items',
        entidadeId: item.id,
        agendaId: item.agenda_id,
        prioridade: 'normal',
      })
    }
    await carregarDadosObra()
  }

  async function excluirChecklistItem(item) {
    if (!item?.id) return
    if (!window.confirm('Excluir este item do checklist?')) return
    const { error } = await supabase.from('checklist_items').delete().eq('id', item.id)
    if (error) {
      console.error('Erro ao excluir checklist:', { error, item })
      mostrarSucesso('Não foi possível excluir o item.')
      return
    }
    setItemAcao('')
    mostrarSucesso('Item excluído.')
    await carregarDadosObra()
  }

  async function adicionarChecklistItem(ambienteId) {
    if (!obraAtiva?.id || !novoChecklist.trim()) return
    setCriandoChecklist(true)
    const { error } = await supabase.from('checklist_items').insert([{
      obra_id: obraAtiva.id,
      ambiente_id: ambienteId === 'geral' ? null : ambienteId,
      descricao: novoChecklist.trim(),
      concluido: false,
    }])
    if (error) {
      console.error('Erro ao adicionar checklist:', error)
      mostrarSucesso('Não foi possível adicionar o item.')
    } else {
      setNovoChecklist('')
      mostrarSucesso('Item adicionado ao checklist.')
      await carregarDadosObra()
    }
    setCriandoChecklist(false)
  }

  function iniciarLongPress(itemId) {
    window.clearTimeout(longPressRef.current)
    longPressRef.current = window.setTimeout(() => setItemAcao(itemId), 700)
  }

  function cancelarLongPress() {
    window.clearTimeout(longPressRef.current)
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !obraAtiva || !user) return
    if (!formFoto.categoria) {
      mostrarSucesso('Escolha uma categoria antes de enviar.')
      e.target.value = ''
      return
    }

    setUploading(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${obraAtiva.id}/${Date.now()}.${ext}`

    try {
      const { error: uploadError } = await supabase.storage.from('fotos-obras').upload(path, file)
      if (uploadError) throw uploadError

      const { data: fotoCriada, error: insertError } = await supabase.from('fotos').insert([{
        obra_id: obraAtiva.id,
        enviada_por: user.id,
        categoria: formFoto.categoria,
        ambiente_id: formFoto.ambiente_id || null,
        agenda_id: formFoto.agenda_id || null,
        aprovada: false,
        aprovada_gestao: false,
        visivel_cliente: false,
        visibilidade: 'interna',
        observacao: formFoto.observacao || file.name,
        storage_path: path,
      }]).select('id, agenda_id, categoria').single()
      if (insertError) throw insertError

      await criarNotificacoesOperacionais({
        tipo: 'foto',
        titulo: 'Foto aguardando aprovação',
        descricao: `${profile?.full_name || 'Montador'} enviou foto de ${fotoCriada?.categoria || formFoto.categoria}.`,
        entidadeTipo: 'fotos',
        entidadeId: fotoCriada?.id,
        agendaId: fotoCriada?.agenda_id || formFoto.agenda_id,
        prioridade: formFoto.categoria === 'Não conformidade' ? 'alta' : 'normal',
      })
      setFormFoto({ categoria: '', ambiente_id: '', agenda_id: '', observacao: '' })
      mostrarSucesso('Foto enviada.')
      await carregarDadosObra()
    } catch (error) {
      console.error('Erro ao enviar foto do montador:', error)
      mostrarSucesso('Não foi possível enviar a foto.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function salvarProblema() {
    if (!problema.trim() || !obraAtiva || !user) return
    setSalvandoProblema(true)

    const { data: ocorrenciaCriada, error } = await supabase.from('ocorrencias').insert([{
      obra_id: obraAtiva.id,
      criado_por: user.id,
      tipo: 'Problema técnico',
      titulo: modalProblema?.titulo || 'Problema reportado pelo montador',
      descricao: problema.trim(),
      gravidade: 'media',
      status: 'Aberta',
    }]).select('id, titulo').single()

    if (error) {
      console.error('Erro ao registrar problema do montador:', error)
      mostrarSucesso('Não foi possível registrar o problema.')
      setSalvandoProblema(false)
      return
    }

    await criarNotificacoesOperacionais({
      tipo: 'ocorrencia',
      titulo: 'Ocorrência criada',
      descricao: ocorrenciaCriada?.titulo || 'Problema reportado pelo montador.',
      entidadeTipo: 'ocorrencias',
      entidadeId: ocorrenciaCriada?.id,
      agendaId: modalProblema?.agenda_id,
      prioridade: 'alta',
    })

    setModalProblema(null)
    setProblema('')
    setSalvandoProblema(false)
    mostrarSucesso('Problema registrado.')
    await carregarDadosObra()
  }

  function selecionarObraPorId(obraId) {
    const obra = obras.find(item => item.id === obraId)
    if (obra) setObraAtiva(obra)
  }

  const vm = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const amanha = new Date(hoje)
    amanha.setDate(hoje.getDate() + 1)

    const tarefasAbertas = tarefas.filter(t => !isConcluido(t.status))
    const tarefasConcluidasHoje = tarefas.filter(t => isConcluido(t.status) && mesmoDia(t.updated_at || t.concluido_em || t.created_at, hoje))
    const checklistPendentes = checklist.filter(i => !i.concluido)
    const checklistConcluidos = checklist.filter(i => i.concluido)
    const ocorrenciasAbertas = ocorrencias.filter(o => isAberta(o.status))
    const fotosHoje = fotos.filter(f => {
      if (!f.created_at) return false
      const data = new Date(f.created_at)
      return data >= hoje && data < amanha
    })
    const agendaFutura = agenda
      .filter(item => item.data && new Date(`${item.data}T00:00:00`) >= hoje)
      .sort((a, b) => `${a.data || ''}${a.hora_inicio || ''}`.localeCompare(`${b.data || ''}${b.hora_inicio || ''}`))
    const proximaAgenda = agendaFutura[0] || null
    const agendaGeral = agendaCalendario
      .filter(item => item.data)
      .map(item => ({
        ...item,
        origem: 'agenda',
        obra_nome: item.obras?.nome || obras.find(obra => obra.id === item.obra_id)?.nome || 'Obra',
      }))
    const iniciosPrevistos = obras
      .map(obra => ({
        id: `inicio-${obra.id}`,
        obra_id: obra.id,
        obra_nome: obra.nome || 'Obra',
        data: dataInicioPrevistaObra(obra),
        hora_inicio: '',
        tipo: 'Início previsto',
        titulo: 'Início previsto',
        origem: 'inicio_previsto',
      }))
      .filter(item => item.data)
    const finsPrevistos = obras
      .map(obra => ({
        id: `fim-${obra.id}`,
        obra_id: obra.id,
        obra_nome: obra.nome || 'Obra',
        data: dataFimPrevistaObra(obra),
        hora_inicio: '',
        tipo: 'Previsão de término',
        titulo: 'Previsão de término',
        origem: 'fim_previsto',
      }))
      .filter(item => item.data)
    const datasOperacionais = [...agendaGeral, ...iniciosPrevistos, ...finsPrevistos]
      .sort((a, b) => `${a.data || ''}${a.hora_inicio || ''}`.localeCompare(`${b.data || ''}${b.hora_inicio || ''}`))
    const proximasDatas = datasOperacionais
      .filter(item => item.data && new Date(`${item.data}T00:00:00`) >= hoje)
      .sort((a, b) => `${a.data || ''}${a.hora_inicio || ''}`.localeCompare(`${b.data || ''}${b.hora_inicio || ''}`))
      .slice(0, 6)
    const proximaAgendaStatus = proximaAgenda ? statusAgenda(proximaAgenda) : null
    const preMontagemAgenda = agendaFutura.find(item => norm(item.tipo || item.titulo || item.observacao).includes('pre-montagem') || norm(item.tipo || item.titulo || item.observacao).includes('pre montagem'))

    const registrosHoje = checkins.filter(c => mesmoDia(c.entrada || c.created_at, hoje))
    const registroAbertoHoje = registrosHoje.find(c => !c.saida) || null
    const emServico = Boolean(registroAbertoHoje)
    const ultimoCheckin = registroAbertoHoje || registrosHoje[0] || checkins[0] || null
    const registroHoje = registrosHoje.find(c => !c.saida) || registrosHoje[0] || null
    const ultimoServico = checkins.find(c => c.saida) || ultimoCheckin
    const pctChecklist = checklist.length ? Math.round((checklistConcluidos.length / checklist.length) * 100) : 0

    const checklistGrupos = [
      { id: 'geral', nome: 'Geral', itens: checklist.filter(item => !item.ambiente_id) },
      ...ambientes.map(ambiente => ({
        id: ambiente.id,
        nome: ambiente.nome || 'Ambiente',
        itens: checklist.filter(item => item.ambiente_id === ambiente.id),
      })),
    ]

    const fotosGrupos = FOTO_CATEGORIAS.map(categoria => ({
      categoria,
      fotos: fotos.filter(foto => (foto.categoria || 'Geral') === categoria),
    })).filter(grupo => grupo.fotos.length > 0)
    const fotosVistoria = fotos.filter(foto => norm(foto.categoria || foto.etapa).includes('vistoria'))

    const historico = [
      ...checkins.slice(0, 4).map(c => ({
        id: `checkin-${c.id}`,
        tipo: c.saida ? 'Check-out' : 'Check-in',
        detalhe: horaBR(c.entrada || c.created_at),
        data: c.created_at || c.entrada,
      })),
      ...fotos.slice(0, 4).map(f => ({
        id: `foto-${f.id}`,
        tipo: 'Foto enviada',
        detalhe: f.categoria || 'Geral',
        data: f.created_at,
      })),
      ...checklistConcluidos.slice(0, 4).map(i => ({
        id: `checklist-${i.id}`,
        tipo: 'Checklist concluído',
        detalhe: i.descricao,
        data: i.concluido_em,
      })),
    ].filter(item => item.data).sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 8)

    return {
      tarefasAbertas,
      tarefasConcluidasHoje,
      checklistPendentes,
      checklistConcluidos,
      ocorrenciasAbertas,
      fotosHoje,
      proximaAgenda,
      proximasDatas,
      datasOperacionais,
      proximaAgendaStatus,
      preMontagemAgenda,
      emServico,
      ultimoCheckin,
      registroHoje,
      ultimoServico,
      pctChecklist,
      checklistGrupos,
      fotosGrupos,
      fotosVistoria,
      historico,
    }
  }, [agenda, agendaCalendario, ambientes, checkins, checklist, fotos, obras, ocorrencias, tarefas])

  const ambienteNome = ambienteId => ambientes.find(a => a.id === ambienteId)?.nome || 'Sem ambiente'
  const vistoriasAgenda = agenda.filter(item => norm(item.tipo || item.titulo).includes('vistoria'))
  const calendarioAno = mesCalendario.getFullYear()
  const calendarioMes = mesCalendario.getMonth()
  const primeiroDiaCalendario = new Date(calendarioAno, calendarioMes, 1)
  const inicioGradeCalendario = new Date(primeiroDiaCalendario)
  inicioGradeCalendario.setDate(1 - primeiroDiaCalendario.getDay())
  const eventosPorDia = (vm.datasOperacionais || []).reduce((acc, item) => {
    if (!item.data) return acc
    acc[item.data] = [...(acc[item.data] || []), item]
    return acc
  }, {})
  const diasCalendario = Array.from({ length: 42 }, (_, index) => {
    const data = new Date(inicioGradeCalendario)
    data.setDate(inicioGradeCalendario.getDate() + index)
    const key = data.toISOString().split('T')[0]
    return {
      key,
      dia: data.getDate(),
      noMes: data.getMonth() === calendarioMes,
      eventos: eventosPorDia[key] || [],
    }
  })

  function mudarMesCalendario(delta) {
    setMesCalendario(data => new Date(data.getFullYear(), data.getMonth() + delta, 1))
    setDiaCalendario('')
  }

  if (loading) {
    return (
      <div className="md-page">
        <style>{css}</style>
        <div className="md-loading">Carregando sua operação...</div>
      </div>
    )
  }

  if (!obraAtiva) {
    return (
      <div className="md-page">
        <style>{css}</style>
        <header className="md-top">
          <div>
            <span>Ornare Works</span>
            <h1>Olá, {profile?.full_name?.split(' ')[0] || 'Montador'}</h1>
          </div>
        </header>
        <section className="md-empty-card">
          <strong>Nenhuma obra alocada</strong>
          <p>Aguarde seu supervisor vincular você a uma obra.</p>
          <button className="md-profile-logout" onClick={logout}>Sair da conta</button>
        </section>
      </div>
    )
  }

  const previsao = obraAtiva.data_previsao || obraAtiva.data_previsao_entrega

  return (
    <div className="md-page">
      <style>{css}</style>

      {preview && (
        <div className="md-preview" onClick={() => setPreview(null)}>
          <img src={preview} alt="Foto da obra" />
        </div>
      )}

      {modalProblema && (
        <div className="md-modal-bg" onClick={e => e.target === e.currentTarget && setModalProblema(null)}>
          <div className="md-modal">
            <h2>Relatar problema</h2>
            <p>{typeof modalProblema === 'string' ? modalProblema : modalProblema.titulo || 'Ocorrência da obra'}</p>
            <textarea value={problema} onChange={e => setProblema(e.target.value)} placeholder="Descreva o que aconteceu..." rows={4} />
            <div className="md-modal-actions">
              <button onClick={() => { setModalProblema(null); setProblema('') }}>Cancelar</button>
              <button className="danger" onClick={salvarProblema} disabled={salvandoProblema}>
                {salvandoProblema ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tarefaAberta && (
        <div className="md-modal-bg" onClick={e => e.target === e.currentTarget && setTarefaAberta(null)}>
          <div className="md-modal">
            <h2>{tarefaAberta.titulo || 'Tarefa'}</h2>
            <p>{tarefaAberta.descricao || tarefaAberta.tipo || 'Detalhe operacional da tarefa.'}</p>
            <div className="md-task-detail-status">
              <span>{tarefaAberta.status || 'pendente'}</span>
              {tarefaAberta.prazo && <small>Previsto para {dataBR(tarefaAberta.prazo)}</small>}
            </div>
            <div className="md-modal-actions split">
              {norm(tarefaAberta.status) === 'pendente' && (
                <button className="gold" onClick={() => mudarStatus(tarefaAberta.id, 'em_andamento', tarefaAberta)}>Iniciar tarefa</button>
              )}
              {norm(tarefaAberta.status) === 'em_andamento' && (
                <button className="success" onClick={() => mudarStatus(tarefaAberta.id, 'concluida', tarefaAberta)}>Concluir tarefa</button>
              )}
            </div>
            {norm(tarefaAberta.tipo || tarefaAberta.titulo).includes('vistoria') && (
              <div className="md-task-checklist-preview">
                <strong>Checklist de vistoria</strong>
                {VISTORIA_CHECKLIST.map(item => <span key={item}>- {item}</span>)}
              </div>
            )}
            <div className="md-task-photo-actions">
              <button onClick={() => { setFormFoto(p => ({ ...p, categoria: 'Vistoria' })); setTarefaAberta(null); setTelaAtiva('fotos') }}>Tirar/enviar foto</button>
            </div>
            <textarea value={observacaoTarefa} onChange={e => setObservacaoTarefa(e.target.value)} placeholder="Observação da tarefa..." rows={4} />
            <div className="md-modal-actions">
              <button onClick={() => setTarefaAberta(null)}>Fechar</button>
              <button className="gold" onClick={salvarObservacaoTarefa}>Salvar observação</button>
            </div>
          </div>
        </div>
      )}

      {calendarioAberto && (
        <div className="md-modal-bg" onClick={e => e.target === e.currentTarget && setCalendarioAberto(false)}>
          <div className="md-modal calendar">
            <div className="md-calendar-head">
              <button onClick={() => mudarMesCalendario(-1)}>{'<'}</button>
              <h2>{mesAnoBR(mesCalendario)}</h2>
              <button onClick={() => mudarMesCalendario(1)}>{'>'}</button>
            </div>
            <div className="md-calendar-week">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => <span key={dia}>{dia}</span>)}
            </div>
            <div className="md-calendar-grid">
              {diasCalendario.map(dia => (
                <button key={dia.key} className={`${dia.noMes ? '' : 'muted'} ${dia.eventos.length ? 'busy' : ''}`} onClick={() => setDiaCalendario(dia.key)}>
                  <span>{dia.dia}</span>
                  {dia.eventos.length > 0 && <i />}
                </button>
              ))}
            </div>
            <div className="md-calendar-day">
              <strong>{diaCalendario ? dataBR(diaCalendario) : 'Selecione um dia'}</strong>
              {diaCalendario && (eventosPorDia[diaCalendario] || []).length === 0 && <p>Nenhum compromisso neste dia.</p>}
              {diaCalendario && (eventosPorDia[diaCalendario] || []).map(item => (
                <div key={item.id} className="md-calendar-event" style={{ borderLeftColor: corDataOperacional(item).border }}>
                  <span>{tipoAgenda(item)}</span>
                  <strong>{item.obra_nome || item.titulo || item.obras?.nome || obraAtiva.nome}</strong>
                  <small>{item.hora_inicio ? item.hora_inicio.slice(0, 5) : 'Data operacional'}</small>
                </div>
              ))}
            </div>
            <div className="md-modal-actions">
              <button onClick={() => setCalendarioAberto(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {sucesso && <div className="md-toast">{sucesso}</div>}

      <header className="md-top" ref={perfilRef}>
        <div>
          <span>Ornare Works</span>
          <h1>Olá, {profile?.full_name?.split(' ')[0] || 'Montador'}</h1>
          <small>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</small>
        </div>
        <div className="md-top-actions">
          <div className={vm.emServico ? 'md-avatar active' : 'md-avatar'}>
            {(profile?.full_name || user?.email || '?')[0].toUpperCase()}
          </div>
        </div>
      </header>

      {obras.length > 1 && (
        <section className="md-field">
          <label>Obra ativa</label>
          <select value={obraAtiva.id} onChange={e => setObraAtiva(obras.find(o => o.id === e.target.value) || null)}>
            {obras.map(obra => <option key={obra.id} value={obra.id}>{obra.nome}</option>)}
          </select>
        </section>
      )}

      <section className="md-obra-card" style={telaAtiva === 'hoje' ? undefined : { display: 'none' }}>
        <div className="md-obra-head">
          <div>
            {(() => {
              const faseMontador = faseObraMontador(obraAtiva)
              return (
                <>
                  <span className="md-phase-badge" style={{ background: faseMontador.bg, color: faseMontador.color, borderColor: faseMontador.border }}>{faseMontador.label}</span>
                </>
              )
            })()}
            <h2 style={{ color: '#FFFFFF', fontFamily: 'var(--font-sans, system-ui, sans-serif)', fontSize: 20, fontWeight: 900, lineHeight: 1.12, margin: '2px 0 0', letterSpacing: 0 }}>
              {obraAtiva.nome || 'Obra sem nome'}
            </h2>
          </div>
          <strong>{obraAtiva.progresso || 0}%</strong>
        </div>
        <p>{cidadeBairro(obraAtiva)}</p>
        <div className="md-progress"><i style={{ width: `${obraAtiva.progresso || 0}%` }} /></div>
        <div className="md-obra-dates">
          <small>Início previsto: {obraAtiva.data_previsao_inicio ? dataBR(obraAtiva.data_previsao_inicio) : dataBR(obraAtiva.data_inicio)}</small>
          <small>Previsão de término: {previsao ? dataBR(previsao) : 'não informada'}</small>
        </div>
        {(() => {
          const faseMontador = faseObraMontador(obraAtiva)
          if (obraAguardandoInicio(obraAtiva)) {
            return <div className="md-work-day muted">Aguardando liberação para montagem</div>
          }
          if (faseMontador.solicitarVistoria) {
            return <button className="md-start-work secondary" onClick={() => setModalProblema({ titulo: 'Solicitar vistoria final', agenda_id: null })}>Solicitar vistoria final</button>
          }
          if (faseMontador.key === 'vistoria_final') {
            return <div className="md-work-day gold">Vistoria final pendente</div>
          }
          if (faseMontador.andamento || norm(obraAtiva.status).includes('montagem')) {
            return <div className="md-work-day">Em andamento · Dia {diasEmAndamento(obraAtiva) || 1}</div>
          }
          return <div className="md-work-day muted">{faseMontador.label}</div>
        })()}
      </section>

      <section className={vm.emServico ? 'md-check-card active' : 'md-check-card'} style={telaAtiva === 'hoje' ? undefined : { display: 'none' }}>
        <div className="md-check-info">
          <span>Hoje - {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
          {obraAguardandoInicio(obraAtiva) ? (
            <>
              <p className="md-check-primary">Obra ainda não iniciada</p>
              <small>Inicie a obra antes de registrar presença em campo.</small>
            </>
          ) : vm.emServico && vm.ultimoCheckin ? (
            <>
              <p className="md-check-primary">Em serviço desde {horaBR(vm.ultimoCheckin.entrada || vm.ultimoCheckin.created_at)}</p>
              <small>{localizacaoCheckin(vm.ultimoCheckin)}</small>
            </>
          ) : vm.registroHoje?.saida ? (
            <>
              <p className="md-check-primary done">Trabalhou hoje: {horaBR(vm.registroHoje.entrada || vm.registroHoje.created_at)} às {horaBR(vm.registroHoje.saida)}</p>
              <small>{localizacaoCheckin(vm.registroHoje)}</small>
            </>
          ) : (
            <>
              <p className="md-check-primary">Fora de serviço · Sem registro hoje</p>
              <small>Obra: {obraAtiva.nome || 'Obra ativa'}</small>
            </>
          )}
          {servicoFeedback && <div className="md-check-feedback">{servicoFeedback}</div>}
        </div>
        {obraAguardandoInicio(obraAtiva) ? (
          <button className="disabled" disabled>Aguardando</button>
        ) : vm.emServico ? (
          <button className="checkout" onClick={fazerCheckout} disabled={checkando}>{checkando ? '...' : 'Check-out'}</button>
        ) : (
          <button onClick={fazerCheckin} disabled={checkando}>{checkando ? '...' : 'Check-in'}</button>
        )}
      </section>

      {loadingObra && telaAtiva === 'hoje' && <div className="md-loading-inline">Atualizando dados da obra...</div>}

      {telaAtiva === 'hoje' && vm.tarefasAbertas.length > 0 && (
        <section className="md-card compact-card">
          <div className="md-card-head compact">
            <div>
              <h2>Tarefas abertas</h2>
              <small className="md-card-sub">{vm.tarefasAbertas.length} pendente{vm.tarefasAbertas.length > 1 ? 's' : ''} para esta obra</small>
            </div>
            <span>{vm.tarefasConcluidasHoje.length} hoje</span>
          </div>
          {vm.tarefasAbertas.slice(0, 4).map(tarefa => (
            <button key={tarefa.id} className="md-task compact" onClick={() => abrirTarefa(tarefa)}>
              <div>
                <strong>{tarefa.titulo || tarefa.descricao || tarefa.tipo || 'Tarefa operacional'}</strong>
                <small>{tarefa.prazo ? `Prevista para ${dataBR(tarefa.prazo)}` : tarefa.status || 'Pendente'}</small>
              </div>
              <span>{'>'}</span>
            </button>
          ))}
        </section>
      )}

      <section className="md-card md-check-progress-card" style={telaAtiva === 'hoje' ? undefined : { display: 'none' }}>
        <div className="md-card-head compact">
          <div>
            <h2>Checklist do dia</h2>
            <small className="md-card-sub">{vm.checklistConcluidos.length} de {checklist.length} itens concluídos</small>
          </div>
          <span>{vm.pctChecklist}%</span>
        </div>
        <div className="md-progress soft"><i style={{ width: `${vm.pctChecklist}%` }} /></div>
        <button className="md-open-checklist" onClick={() => setTelaAtiva('checklist')}>Abrir checklist</button>
      </section>

      <section className="md-card" ref={checklistRef} style={telaAtiva === 'checklist' ? undefined : { display: 'none' }}>
        <div className="md-card-head">
          <div>
            <h2>Checklist · Selecione o ambiente</h2>
            <small className="md-card-sub">{vm.checklistConcluidos.length} de {checklist.length} itens</small>
          </div>
          <span>{vm.pctChecklist}%</span>
        </div>
        <div className="md-progress soft"><i style={{ width: `${vm.pctChecklist}%` }} /></div>
        <div className="md-next-dates">
          <div className="md-card-head">
            <h2>Próximas datas</h2>
            <button onClick={() => setCalendarioAberto(true)}>Ver calendário completo {'>'}</button>
          </div>
          {vm.proximasDatas.length === 0 ? (
            <div className="md-empty-compact">Nenhuma data programada</div>
          ) : (
            <div className="md-date-list">
              {vm.proximasDatas.map(item => {
                const cor = corDataOperacional(item)
                return (
                <button key={item.id} onClick={() => { selecionarObraPorId(item.obra_id); setDiaCalendario(item.data); setMesCalendario(new Date(`${item.data}T00:00:00`)); setCalendarioAberto(true) }}>
                  <strong style={{ color: cor.color }}>{dataCurtaMes(item.data)}</strong>
                  <span>
                    <i style={{ background: cor.bg, borderColor: cor.border, color: cor.color }}>{tipoAgenda(item)}</i>
                    <b>{item.obra_nome || 'Obra'}</b>
                    {item.hora_inicio ? <small>{item.hora_inicio.slice(0, 5)}</small> : null}
                  </span>
                </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="md-env-chips">
          {vm.checklistGrupos.map(grupo => {
            const feitos = grupo.itens.filter(i => i.concluido).length
            const done = grupo.itens.length > 0 && feitos === grupo.itens.length
            return (
              <button key={grupo.id} className={`${ambienteSelecionado === grupo.id ? 'active' : ''} ${done ? 'done' : ''}`} onClick={() => setAmbienteSelecionado(grupo.id)}>
                {grupo.nome} {done ? 'OK' : grupo.itens.length ? `(${grupo.itens.length})` : ''}
              </button>
            )
          })}
        </div>
        {(() => {
          const grupo = vm.checklistGrupos.find(item => item.id === ambienteSelecionado) || vm.checklistGrupos[0]
          if (!grupo) return <Empty text="Nenhum item de checklist nesta obra." />
          if (grupo.itens.length === 0) {
            return (
              <div className="md-add-check">
                <Empty text="Nenhum item neste ambiente." />
                <input value={novoChecklist} onChange={e => setNovoChecklist(e.target.value)} placeholder="+ Adicionar item" />
                {novoChecklist.trim() && (
                  <button onClick={() => adicionarChecklistItem(grupo.id)} disabled={criandoChecklist}>{criandoChecklist ? 'Salvando...' : 'Adicionar item'}</button>
                )}
              </div>
            )
          }
          return grupo.itens.map(item => (
            <div className={item.concluido ? 'md-check-item done' : 'md-check-item'} key={item.id} onClick={() => toggleChecklist(item)} onMouseDown={() => item.concluido && iniciarLongPress(item.id)} onMouseUp={cancelarLongPress} onMouseLeave={cancelarLongPress} onTouchStart={() => item.concluido && iniciarLongPress(item.id)} onTouchEnd={cancelarLongPress}>
              <i>{item.concluido ? 'OK' : ''}</i>
              <span>{item.descricao}</span>
              {itemAcao === item.id && <button className="md-check-delete" onClick={e => { e.stopPropagation(); excluirChecklistItem(item) }}>Excluir</button>}
            </div>
          ))
        })()}
      </section>

      {telaAtiva === 'fotos' && (
      <section className="md-card" ref={fotosRef}>
        <div className="md-card-head">
          <h2>Fotos da obra</h2>
          <span>{fotos.length}</span>
        </div>
        <div className="md-upload">
          <select value={formFoto.categoria} onChange={e => setFormFoto(p => ({ ...p, categoria: e.target.value }))}>
            <option value="">Categoria obrigatória</option>
            {FOTO_CATEGORIAS.map(categoria => <option key={categoria} value={categoria}>{categoria}</option>)}
          </select>
          <select value={formFoto.ambiente_id} onChange={e => setFormFoto(p => ({ ...p, ambiente_id: e.target.value }))}>
            <option value="">Sem ambiente</option>
            {ambientes.map(ambiente => <option key={ambiente.id} value={ambiente.id}>{ambiente.nome}</option>)}
          </select>
          {formFoto.categoria === 'Vistoria' && (
            <select value={formFoto.agenda_id} onChange={e => setFormFoto(p => ({ ...p, agenda_id: e.target.value }))}>
              <option value="">Sem vistoria vinculada</option>
              {vistoriasAgenda.map(item => <option key={item.id} value={item.id}>{item.titulo || 'Vistoria'}{item.data ? ` - ${dataBR(item.data)}` : ''}</option>)}
            </select>
          )}
          <input value={formFoto.observacao} onChange={e => setFormFoto(p => ({ ...p, observacao: e.target.value }))} placeholder="Observação opcional" />
          <label className={formFoto.categoria ? 'md-file' : 'md-file disabled'}>
            {uploading ? 'Enviando...' : 'Selecionar e enviar foto'}
            <input type="file" accept="image/*" capture="environment" onChange={handleUpload} disabled={uploading || !formFoto.categoria} />
          </label>
        </div>
        {fotos.length === 0 ? <Empty text="Nenhuma foto enviada ainda." /> : vm.fotosGrupos.map(grupo => (
          <div className="md-photo-group" key={grupo.categoria}>
            <h3>{grupo.categoria}</h3>
            <div className="md-photo-grid">
              {grupo.fotos.map(foto => (
                <button key={foto.id} className="md-photo" onClick={() => foto.publicUrl && setPreview(foto.publicUrl)}>
                  {foto.publicUrl && <img src={foto.publicUrl} alt={foto.observacao || foto.categoria} />}
                  <span>{ambienteNome(foto.ambiente_id)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
      )}

      {telaAtiva === 'ocorrencias' && (
      <section className="md-card" ref={ocorrenciasRef}>
        <div className="md-card-head">
          <h2>Ocorrências</h2>
          <button onClick={() => setModalProblema('Ocorrência geral')}>Relatar</button>
        </div>
        {vm.ocorrenciasAbertas.length === 0 ? <Empty text="Nenhuma ocorrência aberta." /> : vm.ocorrenciasAbertas.map(oc => (
          <article className="md-occ" key={oc.id}>
            <strong>{oc.titulo || 'Ocorrência'}</strong>
            {oc.descricao && <p>{oc.descricao}</p>}
            <small>{oc.gravidade || 'sem gravidade'} · {oc.status || 'Aberta'}</small>
          </article>
        ))}
      </section>
      )}

      {telaAtiva === 'perfil' && (
      <section className="md-card">
        <div className="md-card-head">
          <div>
            <h2>Perfil do montador</h2>
            <small className="md-card-sub">{profile?.role || 'montador'}</small>
          </div>
          <span>{vm.emServico ? 'Em serviço' : 'Disponível'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, border: `1px solid ${THEME.border}`, background: THEME.card, borderRadius: 15, padding: 13, marginBottom: 12 }}>
          <div style={{ width: 52, height: 52, borderRadius: 999, background: vm.emServico ? '#EAF5EE' : '#fff', border: `1px solid ${vm.emServico ? '#C8E1D0' : THEME.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: vm.emServico ? THEME.success : THEME.gold, fontSize: 20, fontWeight: 900, flexShrink: 0 }}>
            {(profile?.full_name || user?.email || '?')[0].toUpperCase()}
          </div>
          <div>
            <strong style={{ display: 'block', fontSize: 15, color: THEME.ink, marginBottom: 4 }}>{profile?.full_name || 'Montador'}</strong>
            <span style={{ display: 'block', fontSize: 12, color: THEME.muted, fontWeight: 800, lineHeight: 1.35, wordBreak: 'break-word' }}>{user?.email || profile?.email || 'E-mail não informado'}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 12 }}>
          <div style={{ border: `1px solid ${THEME.border}`, background: THEME.elevated, borderRadius: 13, padding: 11 }}><strong style={{ display: 'block', fontSize: 10, letterSpacing: 1.1, textTransform: 'uppercase', color: THEME.gold, fontWeight: 900, marginBottom: 5 }}>Obra ativa</strong><span style={{ display: 'block', fontSize: 12.5, color: THEME.ink, fontWeight: 800, lineHeight: 1.35 }}>{obraAtiva.nome || 'Obra sem nome'}</span></div>
          <div style={{ border: `1px solid ${THEME.border}`, background: THEME.elevated, borderRadius: 13, padding: 11 }}><strong style={{ display: 'block', fontSize: 10, letterSpacing: 1.1, textTransform: 'uppercase', color: THEME.gold, fontWeight: 900, marginBottom: 5 }}>Status</strong><span style={{ display: 'block', fontSize: 12.5, color: THEME.ink, fontWeight: 800, lineHeight: 1.35 }}>{faseObraMontador(obraAtiva).label}</span></div>
          <div style={{ border: `1px solid ${THEME.border}`, background: THEME.elevated, borderRadius: 13, padding: 11 }}><strong style={{ display: 'block', fontSize: 10, letterSpacing: 1.1, textTransform: 'uppercase', color: THEME.gold, fontWeight: 900, marginBottom: 5 }}>Último registro</strong><span style={{ display: 'block', fontSize: 12.5, color: THEME.ink, fontWeight: 800, lineHeight: 1.35 }}>{vm.ultimoServico ? `${horaBR(vm.ultimoServico.entrada || vm.ultimoServico.created_at)}${vm.ultimoServico.saida ? ` - ${horaBR(vm.ultimoServico.saida)}` : ''}` : 'Sem check-in'}</span></div>
          <div style={{ border: `1px solid ${THEME.border}`, background: THEME.elevated, borderRadius: 13, padding: 11 }}><strong style={{ display: 'block', fontSize: 10, letterSpacing: 1.1, textTransform: 'uppercase', color: THEME.gold, fontWeight: 900, marginBottom: 5 }}>Checklist</strong><span style={{ display: 'block', fontSize: 12.5, color: THEME.ink, fontWeight: 800, lineHeight: 1.35 }}>{vm.checklistConcluidos.length}/{checklist.length} itens</span></div>
        </div>
        <button className="md-profile-logout" onClick={logout}>Sair da conta</button>
      </section>
      )}

      <nav className="md-bottom-nav" aria-label="Navegação do montador">
        <button className={telaAtiva === 'hoje' ? 'active' : ''} onClick={() => setTelaAtiva('hoje')}><IconHome />Hoje</button>
        <button className={telaAtiva === 'checklist' ? 'active' : ''} onClick={() => setTelaAtiva('checklist')}><IconCheck />Checklist</button>
        <button className={telaAtiva === 'fotos' ? 'active' : ''} onClick={() => setTelaAtiva('fotos')}><IconCamera />Fotos</button>
        <button className={telaAtiva === 'ocorrencias' ? 'active' : ''} onClick={() => setTelaAtiva('ocorrencias')}><IconAlert />Ocorrências</button>
        <button className={telaAtiva === 'perfil' ? 'active' : ''} onClick={() => setTelaAtiva('perfil')}><IconUser />Perfil</button>
      </nav>
    </div>
  )
}

function IconHome() {
  return <svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/><path d="M10 20v-5h4v5"/></svg>
}

function IconCheck() {
  return <svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/><path d="M5 20h14"/></svg>
}

function IconCamera() {
  return <svg viewBox="0 0 24 24"><path d="M4 8h4l2-3h4l2 3h4v11H4z"/><circle cx="12" cy="13.5" r="3.5"/></svg>
}

function IconAlert() {
  return <svg viewBox="0 0 24 24"><path d="M12 4 3 20h18z"/><path d="M12 9v5"/><path d="M12 17h.01"/></svg>
}

function IconUser() {
  return <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>
}

function Empty({ text }) {
  return <div className="md-empty">{text}</div>
}

const css = `
.md-page{min-height:100vh;background:${THEME.bg};color:${THEME.ink};font-family:var(--font-sans);box-sizing:border-box;padding:18px 14px calc(112px + env(safe-area-inset-bottom));max-width:520px;margin:0 auto}
.md-loading{min-height:70vh;display:flex;align-items:center;justify-content:center;color:${THEME.muted};font-size:14px}
.md-loading-inline{font-size:12px;color:${THEME.muted};text-align:center;margin:10px 0 14px}
.md-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}
.md-top span{display:block;font-size:10px;letter-spacing:2.4px;text-transform:uppercase;color:${THEME.gold};font-weight:800;margin-bottom:5px}
.md-top h1{font-family:var(--font-serif);font-size:27px;line-height:1.05;font-weight:500;margin:0;color:${THEME.ink}}
.md-top small{display:block;margin-top:5px;font-size:12px;color:${THEME.muted}}
.md-top-actions{display:flex;align-items:center;gap:8px}
.md-avatar{width:42px;height:42px;border-radius:999px;background:${THEME.elevated};border:1px solid ${THEME.border};display:flex;align-items:center;justify-content:center;color:${THEME.gold};font-weight:800;flex-shrink:0}
.md-avatar.active{background:#EAF5EE;border-color:#C8E1D0;color:${THEME.success};box-shadow:0 0 0 4px rgba(45,122,74,.08)}
.md-profile-logout{width:100%;min-height:44px;border:1px solid #F0C8C8;background:#FFF8F8;color:${THEME.danger};border-radius:13px;padding:13px;font-size:13px;font-weight:900;font-family:inherit;cursor:pointer;margin-top:4px}
.md-field{margin-bottom:12px}
.md-field label{display:block;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:${THEME.gold};font-weight:800;margin-bottom:8px}
.md-field select,.md-upload select,.md-upload input{width:100%;min-height:44px;box-sizing:border-box;border:1px solid ${THEME.inputBorder};background:${THEME.inputBackground};border-radius:8px;padding:10px 14px;font-family:inherit;font-size:14px;color:${THEME.inputText};outline:none}
.md-obra-card{background:${THEME.card};color:${THEME.ink};border:1px solid ${THEME.border};border-radius:12px;padding:20px;margin-bottom:12px;box-shadow:0 2px 12px rgba(0,0,0,.3)}
.md-obra-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
.md-obra-head>div{min-width:0}
.md-phase-badge{display:inline-flex;align-items:center;border:1px solid ${THEME.gold};border-radius:999px;padding:5px 9px;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;font-weight:900;margin-bottom:6px}
.md-obra-status{display:block!important;font-size:10px!important;letter-spacing:1.2px;text-transform:uppercase;color:#BDB0A0!important;font-weight:800!important;margin:0 0 7px!important}
.md-obra-head h2{font-family:var(--font-sans, system-ui, sans-serif);font-size:20px;line-height:1.12;margin:2px 0 0;font-weight:900;color:#FFFFFF!important;letter-spacing:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.md-obra-head strong{font-size:26px;color:${THEME.gold};line-height:1}
.md-obra-card p{font-size:12px;line-height:1.45;color:#D7CABA;margin:10px 0 12px}
.md-obra-card small{display:block;font-size:11px;color:#BDB0A0;margin-top:10px}
.md-obra-dates{display:grid;gap:4px;margin-top:12px}
.md-start-work{width:100%;min-height:44px;border:0;background:${THEME.gold};color:#141210;border-radius:13px;padding:13px 14px;font-size:14px;font-weight:600;margin-top:14px;cursor:pointer}
.md-start-work.secondary{background:#EEF5FF;color:#2563EB;border:1px solid rgba(37,99,235,.22)}
.md-work-day{margin-top:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.08);border-radius:13px;padding:11px 12px;color:#fff;font-size:13px;font-weight:900;text-align:center}
.md-work-day.gold{border-color:rgba(201,169,110,.32);background:rgba(201,169,110,.12);color:#F5D79D}
.md-work-day.muted{color:#D7CABA}
.md-progress{height:7px;background:rgba(255,255,255,.16);border-radius:999px;overflow:hidden}
.md-progress i{display:block;height:100%;background:${THEME.gold};border-radius:999px}
.md-progress.soft{background:${THEME.border};margin:10px 0 14px}
.md-check-card{background:${THEME.card};border:1px solid ${THEME.border};border-radius:12px;padding:20px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;box-shadow:0 2px 12px rgba(0,0,0,.3)}
.md-check-card.active{background:#F1FAF4;border-color:#C8E1D0}
.md-check-card span{display:block;font-size:15px;font-weight:800;color:${THEME.ink};margin-bottom:3px}
.md-check-card p{margin:0;font-size:11.5px;color:${THEME.muted};line-height:1.4}
.md-check-info{min-width:0}
.md-check-info>p:not(.md-check-primary){display:none}
.md-check-primary{font-size:12px!important;color:${THEME.ink}!important;font-weight:800!important;margin-bottom:5px!important}
.md-check-primary.done{color:${THEME.success}!important}
.md-check-info small{display:block;font-size:11px;color:${THEME.muted};line-height:1.35;margin-top:3px}
.md-check-feedback{display:inline-flex;margin-top:8px;background:#EAF5EE;color:${THEME.success};border:1px solid #C8E1D0;border-radius:999px;padding:6px 9px;font-size:11px;font-weight:900;line-height:1.1}
.md-check-card button{border:0;background:${THEME.gold};color:#141210;border-radius:14px;padding:15px 18px;min-width:118px;min-height:48px;font-size:15px;font-weight:600;cursor:pointer}
.md-check-card button.checkout{background:${THEME.danger}}
.md-check-card button.disabled{background:#D8D0C2;color:#7A746B;cursor:default}
.md-check-progress-card{padding-bottom:14px}
.md-open-checklist{width:100%;min-height:44px;border:1px solid ${THEME.gold};background:${THEME.elevated};color:${THEME.gold};border-radius:12px;padding:11px 13px;font-size:12px;font-weight:900;font-family:inherit;cursor:pointer}
.md-today-card{background:${THEME.card};border:1px solid ${THEME.border};border-radius:18px;padding:14px;margin-bottom:12px;box-shadow:0 10px 26px rgba(0,0,0,.16)}
.md-card-head.compact{margin-bottom:9px}
.md-today-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.md-today-row div{background:${THEME.elevated};border:1px solid ${THEME.border};border-radius:13px;padding:10px}
.md-today-row strong{display:block;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:${THEME.gold};font-weight:900;margin-bottom:5px}
.md-today-row span{display:block;font-size:15px;color:${THEME.ink};font-weight:900}
.md-today-row p{grid-column:1/-1;margin:0;color:${THEME.muted};font-size:12px;line-height:1.35}
.md-today-empty{color:${THEME.muted};font-size:12.5px;padding:2px 0}
.md-card{background:${THEME.card};border:1px solid ${THEME.border};border-radius:12px;padding:20px;margin-bottom:12px;box-shadow:0 2px 12px rgba(0,0,0,.3);scroll-margin-top:14px}
.md-card-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}
.md-card-head h2{font-size:15px;margin:0;font-weight:900;color:${THEME.ink}}
.md-card-head span{font-size:12px;color:${THEME.gold};font-weight:900}
.md-card-head button{min-height:44px;border:0;background:transparent;color:${THEME.gold};font-size:12px;font-weight:900;cursor:pointer}
.md-card-sub{display:block;font-size:11px;color:${THEME.muted};font-weight:800;margin-top:3px}
.md-card-note{margin:-3px 0 12px;color:${THEME.muted};font-size:12.5px;line-height:1.45}
.md-next-dates{border:1px solid ${THEME.border};background:${THEME.elevated};color:${THEME.ink};border-radius:15px;padding:13px;margin:12px 0 14px}
.md-next-dates .md-card-head{margin-bottom:10px}
.md-next-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:5px}
.md-next strong{display:block;font-size:16px;color:${THEME.ink};margin-bottom:0}
.md-next em{font-style:normal;border-radius:999px;padding:5px 8px;font-size:10.5px;font-weight:900;white-space:nowrap}
.md-next em.tone-success{background:#EAF5EE;color:${THEME.success}}
.md-next em.tone-info{background:#EEF5FB;color:#1E5A8A}
.md-next em.tone-warn{background:#FFF4E5;color:${THEME.warn}}
.md-next em.tone-danger{background:#FFF1F1;color:${THEME.danger}}
.md-next span{display:block;font-size:13px;color:${THEME.muted};line-height:1.4}
.md-next small{display:block;font-size:12px;color:${THEME.gold};font-weight:800;margin-top:8px}
.md-next.highlight{border:1px solid rgba(184,150,94,.45);background:#FFFAF0;border-radius:15px;padding:13px;margin-bottom:10px;box-shadow:0 10px 24px rgba(184,150,94,.12)}
.md-confirm-btn{border:0;background:${THEME.gold};color:#141210;border-radius:12px;padding:11px 13px;font-size:12px;font-weight:900;margin-top:10px;cursor:pointer;width:100%;min-height:44px}
.md-date-list{display:grid;gap:8px}
.md-date-list button{width:100%;min-height:56px;border:1px solid ${THEME.border};background:${THEME.elevated};color:${THEME.ink};border-radius:14px;padding:10px 11px;display:grid;grid-template-columns:minmax(50px,58px) minmax(0,1fr);align-items:center;gap:10px;font-family:inherit;text-align:left;cursor:pointer}
.md-date-list strong{font-size:13px;color:${THEME.gold};text-transform:lowercase;line-height:1.15}
.md-date-list span{min-width:0;display:flex;align-items:center;gap:7px;font-size:13px;color:${THEME.ink};font-weight:800;overflow:hidden}
.md-date-list span i{font-style:normal;border:1px solid ${THEME.border};border-radius:999px;padding:5px 8px;font-size:10px;line-height:1;font-weight:900;white-space:nowrap;flex-shrink:0}
.md-date-list span b{font-size:13px;color:${THEME.ink};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.md-date-list span small{font-size:12px;color:${THEME.muted};font-weight:900;flex-shrink:0}
.md-empty-compact{background:#F3F0EA;border:1px solid ${THEME.border};border-radius:14px;padding:13px;color:${THEME.muted};font-size:13px;text-align:center;font-weight:800}
.md-quick{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:12px}
.md-quick button{min-height:48px;border:1px solid ${THEME.border};background:${THEME.elevated};color:${THEME.ink};border-radius:14px;padding:14px 10px;font-size:13px;font-weight:900;cursor:pointer}
.md-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
.md-metric{background:${THEME.card};border:1px solid ${THEME.border};border-radius:14px;padding:12px 8px;text-align:center}
.md-metric.danger{border-color:#F0C8C8;background:#FFF8F8}
.md-metric strong{display:block;font-size:22px;line-height:1;color:${THEME.ink}}
.md-metric.danger strong{color:${THEME.danger}}
.md-metric span{display:block;font-size:10.5px;color:${THEME.muted};margin-top:5px}
.md-task{width:100%;box-sizing:border-box;border:1px solid ${THEME.border};border-left:4px solid ${THEME.gold};border-radius:15px;padding:14px;margin-bottom:10px;background:${THEME.card};font-family:inherit;text-align:left}
.md-task{cursor:pointer}
.md-task.compact{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px;min-height:56px}
.md-task.compact div{min-width:0}
.md-task.compact strong{display:block;font-size:13.5px;color:${THEME.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.md-task.compact small{display:block;font-size:11px;color:${THEME.muted};font-weight:800;margin-top:4px}
.md-task.compact>span{font-size:18px;color:${THEME.gold};font-weight:900}
.md-task-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.md-task-head strong{font-size:14px;color:${THEME.ink}}
.md-task-head span{font-size:10px;letter-spacing:.8px;text-transform:uppercase;font-weight:900}
.md-task p{font-size:12.5px;line-height:1.45;color:${THEME.muted};margin:8px 0}
.md-task small{display:block;font-size:11px;color:${THEME.muted};margin-top:7px}
.md-status-row,.md-two-actions{display:flex;gap:7px;margin-top:12px}
.md-status-row button,.md-two-actions button{flex:1;min-height:44px;border:0;border-radius:10px;padding:11px 6px;font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer;background:#F5F1EA;color:${THEME.muted}}
.md-status-row button.active{background:${THEME.ink};color:#fff}
.md-two-actions button{background:#FFF4E5;color:${THEME.warn}}
.md-two-actions button.ok{background:#EAF5EE;color:${THEME.success}}
.compact-card{padding-top:13px;padding-bottom:13px}
.md-done-task{width:100%;min-height:48px;border:1px solid #C8E1D0;background:#F7FCF8;border-radius:12px;padding:11px 12px;display:flex;align-items:center;justify-content:space-between;margin-top:8px;font-family:inherit;cursor:pointer}
.md-done-task strong{font-size:13px;color:${THEME.ink}}
.md-done-task span{color:${THEME.success};font-weight:900}
.md-env{border:1px solid ${THEME.border};border-radius:15px;padding:13px;margin-top:12px;background:${THEME.card}}
.md-env.progress{border-color:${THEME.gold}}
.md-env.done{border-color:${THEME.success};background:#F7FCF8}
.md-env-head{width:100%;min-height:44px;border:0;background:transparent;padding:0;display:flex;justify-content:space-between;gap:10px;text-align:left;font-family:inherit;cursor:pointer}
.md-env-head strong{font-size:14px;color:${THEME.ink}}
.md-env-head small{display:block;font-size:11px;color:${THEME.muted};margin-top:3px}
.md-env-head span{font-size:12px;color:${THEME.gold};font-weight:900}
.md-env.done .md-env-head span{color:${THEME.success}}
.md-env-chips{display:flex;gap:8px;overflow-x:auto;padding:2px 0 12px;margin-bottom:2px}
.md-env-chips button{min-height:44px;border:1px solid ${THEME.border};background:${THEME.elevated};color:${THEME.muted};border-radius:999px;padding:9px 12px;font-size:12px;font-weight:900;font-family:inherit;white-space:nowrap;cursor:pointer}
.md-env-chips button.active{border-color:${THEME.gold};background:${THEME.gold};color:#141210}
.md-env-chips button.done{border-color:${THEME.success}}
.md-add-check{border:1px dashed ${THEME.border};border-radius:14px;padding:10px;margin-top:10px;background:${THEME.card}}
.md-add-check input{width:100%;box-sizing:border-box;border:1px solid ${THEME.inputBorder};background:${THEME.inputBackground};border-radius:8px;padding:10px 14px;font-size:14px;font-family:inherit;color:${THEME.inputText};outline:none;margin-bottom:8px}
.md-add-check button{width:100%;min-height:44px;border:1px solid ${THEME.gold};background:${THEME.elevated};color:${THEME.gold};border-radius:12px;padding:12px;font-size:13px;font-weight:900;font-family:inherit;cursor:pointer}
.md-add-check button:disabled{opacity:.45;cursor:not-allowed}
.md-check-item{width:100%;min-height:48px;border:1px solid ${THEME.border};background:${THEME.card};color:${THEME.ink};border-radius:13px;padding:13px;display:flex;align-items:center;gap:11px;text-align:left;margin-top:8px;font-family:inherit;cursor:pointer}
.md-check-item.done{background:#F4FBF6;border-color:#C8E1D0;opacity:.5}
.md-check-item i{width:23px;height:23px;border-radius:7px;border:2px solid ${THEME.border};display:flex;align-items:center;justify-content:center;font-style:normal;font-size:13px;font-weight:900;flex-shrink:0}
.md-check-item.done i{background:${THEME.success};border-color:${THEME.success};color:#fff}
.md-check-item span{font-size:14px;color:${THEME.ink};line-height:1.35}
.md-check-item.done span{color:#9A938A;text-decoration:line-through}
.md-check-delete{margin-left:auto;min-height:44px;border:0;background:#FFF1F1;color:${THEME.danger};border-radius:10px;padding:8px 9px;font-size:11px;font-weight:900;cursor:pointer}
.md-upload{display:flex;flex-direction:column;gap:9px;margin-bottom:14px}
.md-file{display:block;min-height:48px;box-sizing:border-box;background:${THEME.ink};color:#fff;border-radius:14px;padding:15px;text-align:center;font-size:14px;font-weight:900;cursor:pointer}
.md-file.disabled{opacity:.52}
.md-file input{display:none}
.md-photo-group{margin-top:16px}
.md-photo-group h3{font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:${THEME.gold};font-weight:900;margin:0 0 9px}
.md-photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.md-photo-grid.compact{margin-top:4px}
.md-photo{position:relative;aspect-ratio:1;min-height:44px;border:0;border-radius:13px;overflow:hidden;background:#F0ECE6;padding:0;cursor:pointer}
.md-photo img{width:100%;height:100%;object-fit:cover;display:block}
.md-photo span{position:absolute;left:5px;right:5px;bottom:5px;background:rgba(29,28,25,.72);color:#fff;border-radius:8px;padding:4px 5px;font-size:9px;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.md-occ{border:1px solid ${THEME.border};border-radius:14px;padding:12px;margin-bottom:9px;background:${THEME.card}}
.md-occ strong{font-size:13.5px;color:${THEME.ink}}
.md-occ p{font-size:12px;color:${THEME.muted};line-height:1.4;margin:6px 0}
.md-occ small{font-size:11px;color:${THEME.gold};font-weight:800}
.md-history{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid ${THEME.border}}
.md-history:last-child{border-bottom:0}
.md-history i{width:8px;height:8px;border-radius:999px;background:${THEME.gold};margin-top:5px;flex-shrink:0}
.md-history strong{display:block;font-size:13px;color:${THEME.ink}}
.md-history span{display:block;font-size:11.5px;color:${THEME.muted};margin-top:2px;line-height:1.3}
.md-empty{padding:20px 0;text-align:center;color:#A79F93;font-size:13px}
.md-empty-card{background:${THEME.card};border:1px solid ${THEME.border};border-radius:12px;padding:28px 18px;text-align:center;margin-top:28px;box-shadow:0 2px 12px rgba(0,0,0,.3)}
.md-empty-card strong{display:block;font-size:18px;color:${THEME.ink};margin-bottom:8px}
.md-empty-card p{margin:0;color:${THEME.muted};font-size:13px;line-height:1.45}
.md-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:${THEME.ink};color:#fff;border-left:3px solid ${THEME.gold};border-radius:13px;padding:12px 18px;font-size:13px;font-weight:800;z-index:1000;white-space:nowrap;max-width:calc(100vw - 28px);box-sizing:border-box}
.md-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:800;display:flex;align-items:flex-end;justify-content:center;padding:14px}
.md-modal{width:100%;max-width:500px;background:${THEME.card};border:1px solid ${THEME.border};border-radius:12px;padding:20px;box-sizing:border-box;box-shadow:0 2px 12px rgba(0,0,0,.3)}
.md-modal.calendar{max-height:88vh;overflow:auto}
.md-modal h2{font-family:var(--font-serif);font-size:22px;font-weight:500;margin:0 0 5px;color:${THEME.ink}}
.md-modal p{font-size:13px;color:${THEME.muted};margin:0 0 14px}
.md-modal textarea{width:100%;box-sizing:border-box;border:1px solid ${THEME.inputBorder};background:${THEME.inputBackground};border-radius:8px;padding:10px 14px;font-family:inherit;font-size:14px;resize:none;color:${THEME.inputText};outline:none}
.md-modal-actions{display:flex;gap:9px;justify-content:flex-end;margin-top:12px}
.md-modal-actions.split{justify-content:stretch}
.md-modal-actions button{min-height:44px;border:1px solid ${THEME.border};background:${THEME.elevated};border-radius:12px;padding:11px 14px;font-weight:800;color:${THEME.ink};cursor:pointer}
.md-modal-actions button.danger{border-color:${THEME.danger};background:${THEME.danger};color:#fff}
.md-modal-actions button.gold{border-color:${THEME.gold};background:${THEME.gold};color:#141210;flex:1}
.md-modal-actions button.success{border-color:${THEME.success};background:${THEME.success};color:#fff;flex:1}
.md-task-detail-status{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid ${THEME.border};background:${THEME.card};border-radius:13px;padding:11px 12px;margin-bottom:12px}
.md-task-detail-status span{font-size:12px;text-transform:uppercase;letter-spacing:.8px;color:${THEME.gold};font-weight:900}
.md-task-detail-status small{font-size:12px;color:${THEME.muted};font-weight:800}
.md-task-checklist-preview{border:1px solid ${THEME.border};background:${THEME.card};border-radius:13px;padding:12px;margin-top:12px}
.md-task-checklist-preview strong{display:block;font-size:13px;color:${THEME.ink};margin-bottom:8px}
.md-task-checklist-preview span{display:block;font-size:12px;color:${THEME.muted};line-height:1.45;margin-top:5px}
.md-task-photo-actions button{width:100%;min-height:44px;border:0;background:${THEME.ink};color:#fff;border-radius:13px;padding:12px;margin:12px 0;font-weight:900;cursor:pointer}
.md-calendar-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
.md-calendar-head h2{text-align:center;margin:0!important}
.md-calendar-head button{width:44px;height:44px;border:1px solid ${THEME.border};background:${THEME.elevated};border-radius:12px;font-size:24px;line-height:1;cursor:pointer;color:${THEME.ink}}
.md-calendar-week{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:6px}
.md-calendar-week span{text-align:center;font-size:10px;font-weight:900;color:${THEME.muted}}
.md-calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}
.md-calendar-grid button{min-height:44px;border:1px solid ${THEME.border};background:${THEME.card};border-radius:11px;position:relative;font-weight:900;color:${THEME.ink};cursor:pointer}
.md-calendar-grid button.muted{opacity:.35}
.md-calendar-grid button.busy{border-color:${THEME.gold};background:#FFF8EA;color:${THEME.gold}}
.md-calendar-grid button i{position:absolute;left:50%;bottom:6px;transform:translateX(-50%);width:5px;height:5px;border-radius:999px;background:${THEME.gold}}
.md-calendar-day{border:1px solid ${THEME.border};background:${THEME.card};border-radius:14px;padding:12px;margin-top:14px}
.md-calendar-day>strong{font-size:13px;color:${THEME.ink}}
.md-calendar-day p{font-size:12px;color:${THEME.muted};margin:8px 0 0}
.md-calendar-event{border-top:1px solid ${THEME.border};border-left:4px solid ${THEME.gold};padding:9px 0 0 10px;margin-top:9px}
.md-calendar-event span{display:block;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:${THEME.gold};font-weight:900}
.md-calendar-event strong{display:block;font-size:13px;color:${THEME.ink};margin-top:3px}
.md-calendar-event small{display:block;font-size:11px;color:${THEME.muted};margin-top:3px}
.md-preview{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:900;display:flex;align-items:center;justify-content:center;padding:12px;cursor:pointer}
.md-preview img{max-width:100%;max-height:92vh;border-radius:12px;object-fit:contain}
.md-bottom-nav{position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:700;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;background:#1E1B18;border-top:1px solid #332F2A;border-left:1px solid #332F2A;border-right:1px solid #332F2A;border-bottom:1px solid #332F2A;border-radius:18px;padding:7px;box-shadow:0 18px 42px rgba(0,0,0,.32);backdrop-filter:blur(18px);max-width:500px;margin:0 auto}
.md-bottom-nav button{border:0;background:transparent;color:${THEME.textMuted};border-radius:13px;min-height:58px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:10px;font-weight:900;cursor:pointer}
.md-bottom-nav button.active{color:${THEME.gold};background:rgba(201,168,76,.12)}
.md-bottom-nav svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;color:currentColor}
@media (max-width:380px){.md-page{padding-left:10px;padding-right:10px}.md-card,.md-obra-card,.md-check-card{padding:16px}.md-check-card{align-items:stretch;flex-direction:column}.md-check-card button{width:100%}.md-bottom-nav{left:6px;right:6px;gap:2px;padding:6px}.md-bottom-nav button{font-size:9px}.md-date-list button{grid-template-columns:48px minmax(0,1fr)}}
@media (min-width:720px){.md-page{max-width:680px;padding:26px 20px calc(112px + env(safe-area-inset-bottom))}.md-summary{grid-template-columns:repeat(4,1fr)}.md-quick{grid-template-columns:repeat(4,1fr)}}
`
