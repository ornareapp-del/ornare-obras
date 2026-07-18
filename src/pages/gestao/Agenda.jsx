import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { theme } from '../../constants/theme'
import { criarNotificacoes } from '../../services/notificacoesService'

const TIPOS = ['Apresentação','Assistência Técnica','Compromisso','Entrega','Medição','Montagem','Período de execução','Tarefa','Vistoria','Reunião Interna']
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab']
const TIPO_COR = {
  'Montagem': '#2D7A4A',
  'Período de execução': '#C9A84C',
  'Entrega': '#E07B39',
  'Medicao': '#9070C0',
  'Medição': '#9070C0',
  'Assistência Técnica': '#C0392B',
  'Reunião Interna': '#6D675E',
  'Vistoria': '#2563EB',
  'Apresentacao': '#4A90D9',
  'Apresentação': '#4A90D9',
  'Compromisso': '#888',
  'Tarefa': '#B09A7A',
}

const TIPO_CORES = [
  { termos: ['vistoria'], cor: '#2563EB' },
  { termos: ['montagem'], cor: '#2D7A4A' },
  { termos: ['assistencia', 'tecnica'], cor: '#C0392B' },
  { termos: ['medicao'], cor: '#7A5AA6' },
  { termos: ['entrega'], cor: '#E07B39' },
  { termos: ['reuniao'], cor: '#6D675E' },
  { termos: ['intern'], cor: '#1D1C19' },
]

const VISTORIA_CHECKLIST = [
  'Conferir acesso à obra, elevador, carga e descarga.',
  'Validar se os ambientes estão limpos, liberados e desimpedidos.',
  'Conferir pontos elétricos, hidráulicos e interferências aparentes.',
  'Registrar fotos de vistoria por ambiente.',
  'Sinalizar pendências que podem impedir o início da montagem.',
  'Confirmar se a obra está apta para receber a equipe de montagem.',
]

function norm(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function corTipo(value) {
  const texto = norm(value)
  return TIPO_CORES.find(item => item.termos.some(termo => texto.includes(termo)))?.cor || TIPO_COR[value] || '#888'
}

function normalizarTitulo(value) {
  const siglas = new Set(['SC', 'SP', 'RJ', 'PR', 'RS', 'MG', 'CPF', 'CNPJ', 'LTDA', 'S/A', 'KM'])
  return String(value || '').trim().split(/\s+/).map(parte => {
    const limpa = parte.replace(/[^\p{L}\p{N}/.-]/gu, '')
    if (siglas.has(limpa.toUpperCase())) return parte.toUpperCase()
    if (parte.length <= 2 && parte === parte.toUpperCase()) return parte
    return parte.charAt(0).toLocaleUpperCase('pt-BR') + parte.slice(1).toLocaleLowerCase('pt-BR')
  }).join(' ')
}

function statusEvento(ev, hojeStr) {
  const status = ev.status || ev.situacao || ev.situacao_agenda
  if (status) {
    const n = norm(status)
    if (n.includes('conclu') || n.includes('realiz')) return { label: 'Realizada', tone: 'success' }
    if (n.includes('andamento')) return { label: 'Em andamento', tone: 'info' }
    if (n.includes('atras')) return { label: 'Atrasada', tone: 'danger' }
    return { label: status, tone: 'warn' }
  }
  if ((ev.data_fim || ev.data) < hojeStr) return { label: 'Atrasada', tone: 'danger' }
  if (ev.data === hojeStr) return { label: 'Hoje', tone: 'info' }
  return { label: 'Pendente', tone: 'warn' }
}

function ehFimDeSemana(data) {
  if (!data) return false
  const dia = new Date(`${data}T00:00:00`).getDay()
  return dia === 0 || dia === 6
}

function intervaloTemDiaNaoUtil(inicio, fim) {
  if (!inicio) return false
  const atual = new Date(`${inicio}T00:00:00`)
  const limite = new Date(`${fim || inicio}T00:00:00`)
  while (atual <= limite) {
    if (ehFimDeSemana(atual.toISOString().split('T')[0])) return true
    atual.setDate(atual.getDate() + 1)
  }
  return false
}

function visivelParaMontador(form) {
  return !form.reuniao_interna && Boolean(form.obra_id) && Boolean(form.visivel_montador) && !norm(form.tipo).includes('reuniao')
}

function anexarPerfisAosCheckins(checkins, profiles) {
  const perfilPorId = new Map((profiles || []).map(profile => [profile.id, profile]))
  return (checkins || []).map(checkin => ({
    ...checkin,
    profiles: perfilPorId.get(checkin.user_id) || null,
  }))
}

export default function Agenda() {
  const navigate = useNavigate()
  const location = useLocation()
  const [eventos, setEventos] = useState([])
  const [obras, setObras] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [filtro, setFiltro] = useState('proximos')
  const [filtrosAvancados, setFiltrosAvancados] = useState({
    inicio: '',
    fim: '',
    obra: '',
    responsavel: '',
    tipo: '',
    status: '',
    busca: '',
  })
  const [acaoStatus, setAcaoStatus] = useState('')
  const [vistoriaStats, setVistoriaStats] = useState({ checklist: 0, fotos: 0 })
  const [checkinsCompromisso, setCheckinsCompromisso] = useState([])
  const [checkinsLoading, setCheckinsLoading] = useState(false)
  const [campoSalvando, setCampoSalvando] = useState(false)
  const [erroModal, setErroModal] = useState('')
  const [erroPagina, setErroPagina] = useState('')
  const [toast, setToast] = useState('')
  const hoje = new Date()
  const [form, setForm] = useState({
    titulo: '', descricao: '', tipo: 'Compromisso', obra_id: '',
    responsavel_id: '', data: hoje.toISOString().split('T')[0],
    data_fim: '', hora_inicio: '08:00', hora_fim: '',
    descricao_cliente: '',
    reuniao_interna: false,
    status: 'pendente',
    visivel_montador: false,
    visivel_cliente: false,
    confirmado_cliente: false,
  })

  useEffect(() => { carregar() }, [])

  useEffect(() => {
    const id = new URLSearchParams(location.search).get('compromisso')
    if (!id) return

    async function abrirPorRota() {
      const { data, error } = await supabase
        .from('agenda')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        setErroPagina('Não foi possível abrir o compromisso indicado no link: ' + error.message)
        return
      }
      if (data) abrirEditar(data)
    }

    abrirPorRota()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  function formInicial() {
    return {
      titulo: '', descricao: '', tipo: 'Compromisso', obra_id: '',
      responsavel_id: '', data: hoje.toISOString().split('T')[0],
      data_fim: '', hora_inicio: '08:00', hora_fim: '',
      descricao_cliente: '',
      reuniao_interna: false,
      status: 'pendente',
      visivel_montador: false,
      visivel_cliente: false,
      confirmado_cliente: false,
    }
  }

  function abrirNovo() {
    setEditandoId(null)
    setForm(formInicial())
    setAcaoStatus('')
    setVistoriaStats({ checklist: 0, fotos: 0 })
    setCheckinsCompromisso([])
    setModal(true)
  }

  function preencherForm(ev) {
    setForm({
      titulo: ev.titulo || '',
      descricao: ev.observacao || ev.descricao || '',
      tipo: ev.tipo || 'Compromisso',
      obra_id: ev.obra_id || '',
      responsavel_id: ev.responsavel_id || '',
      data: ev.data || hoje.toISOString().split('T')[0],
      data_fim: ev.data_fim || ev.data || '',
      hora_inicio: ev.hora_inicio ? ev.hora_inicio.slice(0, 5) : '08:00',
      hora_fim: ev.hora_fim ? ev.hora_fim.slice(0, 5) : '',
      descricao_cliente: ev.descricao_cliente || ev.observacao_publica || '',
      reuniao_interna: Boolean(ev.reuniao_interna),
      status: ev.status || 'pendente',
      visivel_montador: !ev.reuniao_interna && Boolean(ev.obra_id) && ev.visivel_montador !== false,
      visivel_cliente: Boolean(ev.visivel_cliente),
      confirmado_cliente: Boolean(ev.confirmado_cliente),
    })
  }

  async function abrirEditar(ev) {
    setEditandoId(ev.id)
    setAcaoStatus('Carregando compromisso salvo...')
    setErroModal('')

    const { data, error } = await supabase
      .from('agenda')
      .select('*')
      .eq('id', ev.id)
      .single()

    if (error) {
      preencherForm(ev)
      setErroModal('Não foi possível carregar a versão mais recente deste compromisso.')
      setModal(true)
      carregarVistoriaStats(ev.id)
      carregarCheckinsCompromisso(ev.obra_id, ev.data, ev.id)
      return
    }

    const compromisso = data || ev
    preencherForm(compromisso)
    setAcaoStatus('')
    setModal(true)
    carregarVistoriaStats(compromisso.id)
    carregarCheckinsCompromisso(compromisso.obra_id, compromisso.data, compromisso.id)
  }

  async function carregarVistoriaStats(agendaId = editandoId) {
    if (!agendaId) {
      setVistoriaStats({ checklist: 0, fotos: 0 })
      return
    }
    const [checklistResult, fotosResult] = await Promise.all([
      supabase.from('checklist_items').select('id', { count: 'exact', head: true }).eq('agenda_id', agendaId),
      supabase.from('fotos').select('id', { count: 'exact', head: true }).eq('agenda_id', agendaId),
    ])
    const falha = [checklistResult, fotosResult].find(result => result.error)
    if (falha?.error) {
      setAcaoStatus('Não foi possível carregar os indicadores da vistoria: ' + falha.error.message)
    }
    setVistoriaStats({ checklist: checklistResult.count || 0, fotos: fotosResult.count || 0 })
  }

  async function carregarCheckinsCompromisso(obraId, dataCompromisso, agendaId = editandoId) {
    if (!obraId || !dataCompromisso) {
      setCheckinsCompromisso([])
      return
    }
    setCheckinsLoading(true)
    if (agendaId) {
      const { data, error } = await supabase
        .from('checkins')
        .select('id, user_id, obra_id, agenda_id, entrada, saida, latitude, longitude, entrada_latitude, entrada_longitude, saida_latitude, saida_longitude, created_at')
        .eq('agenda_id', agendaId)
        .order('entrada', { ascending: false })

      if (!error && data?.length) {
        setCheckinsCompromisso(anexarPerfisAosCheckins(data, profiles))
        setCheckinsLoading(false)
        return
      }
      if (error) setAcaoStatus('Não foi possível carregar os check-ins vinculados: ' + error.message)
    }

    const inicio = new Date(`${dataCompromisso}T00:00:00`)
    const fim = new Date(inicio)
    fim.setDate(fim.getDate() + 1)
    const { data, error } = await supabase
      .from('checkins')
      .select('id, user_id, obra_id, agenda_id, entrada, saida, latitude, longitude, entrada_latitude, entrada_longitude, saida_latitude, saida_longitude, created_at')
      .eq('obra_id', obraId)
      .gte('entrada', inicio.toISOString())
      .lt('entrada', fim.toISOString())
      .order('entrada', { ascending: false })

    if (error) {
      setAcaoStatus('Não foi possível carregar os check-ins desta data: ' + error.message)
      setCheckinsCompromisso([])
    } else {
      setCheckinsCompromisso(anexarPerfisAosCheckins(data, profiles))
    }
    setCheckinsLoading(false)
  }

  function horaCurta(value) {
    if (!value) return '-'
    return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  function obterLocalizacao() {
    return new Promise(resolve => {
      if (!navigator.geolocation) {
        resolve({ autorizado: false })
        return
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({
          autorizado: true,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
        () => resolve({ autorizado: false }),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
      )
    })
  }

  async function registrarCheckinCompromisso() {
    if (!editandoId || !form.obra_id) return
    setCampoSalvando(true)
    setAcaoStatus('Registrando check-in...')

    const { data: authData } = await supabase.auth.getUser()
    const userId = authData?.user?.id
    if (!userId) {
      setAcaoStatus('Não foi possível identificar o usuário logado.')
      setCampoSalvando(false)
      return
    }

    const local = await obterLocalizacao()
    const payload = {
      obra_id: form.obra_id,
      agenda_id: editandoId,
      user_id: userId,
      entrada: new Date().toISOString(),
      localizacao_autorizada: Boolean(local.autorizado),
      latitude: local.latitude || null,
      longitude: local.longitude || null,
      entrada_latitude: local.latitude || null,
      entrada_longitude: local.longitude || null,
    }

    const { error } = await supabase.from('checkins').insert([payload])
    if (error) {
      setAcaoStatus('Não foi possível registrar o check-in: ' + error.message)
      setCampoSalvando(false)
      return
    }

    const agendaResult = await supabase.from('agenda').update({ status: 'em andamento' }).eq('id', editandoId)
    if (agendaResult.error) {
      setAcaoStatus('Check-in registrado, mas não foi possível atualizar a agenda: ' + agendaResult.error.message)
      setCampoSalvando(false)
      return
    }
    setForm(p => ({ ...p, status: 'em andamento' }))
    await criarNotificacaoCompromisso({
      agendaId: editandoId,
      obraId: form.obra_id,
      responsavelId: form.responsavel_id,
      tipo: 'checkin_compromisso',
      titulo: 'Check-in realizado',
      descricao: form.titulo || 'Compromisso iniciado.',
      prioridade: 'alta',
    })
    await carregarCheckinsCompromisso(form.obra_id, form.data, editandoId)
    await carregar()
    setAcaoStatus(local.autorizado ? 'Check-in registrado com localização.' : 'Check-in registrado sem localização.')
    setCampoSalvando(false)
  }

  async function registrarCheckoutCompromisso() {
    const aberto = checkinsCompromisso.find(c => c.entrada && !c.saida)
    if (!aberto || !editandoId) return
    setCampoSalvando(true)
    setAcaoStatus('Registrando check-out...')

    const local = await obterLocalizacao()
    const { error } = await supabase
      .from('checkins')
      .update({
        saida: new Date().toISOString(),
        saida_latitude: local.latitude || null,
        saida_longitude: local.longitude || null,
      })
      .eq('id', aberto.id)

    if (error) {
      setAcaoStatus('Não foi possível registrar o check-out: ' + error.message)
      setCampoSalvando(false)
      return
    }

    const agendaResult = await supabase.from('agenda').update({ status: 'realizada' }).eq('id', editandoId)
    if (agendaResult.error) {
      setAcaoStatus('Check-out registrado, mas não foi possível atualizar a agenda: ' + agendaResult.error.message)
      setCampoSalvando(false)
      return
    }
    setForm(p => ({ ...p, status: 'realizada' }))
    await criarNotificacaoCompromisso({
      agendaId: editandoId,
      obraId: form.obra_id,
      responsavelId: form.responsavel_id,
      tipo: 'checkout_compromisso',
      titulo: 'Check-out realizado',
      descricao: form.titulo || 'Compromisso finalizado.',
      prioridade: 'normal',
    })
    await carregarCheckinsCompromisso(form.obra_id, form.data, editandoId)
    await carregar()
    setAcaoStatus(local.autorizado ? 'Check-out registrado com localização.' : 'Check-out registrado sem localização.')
    setCampoSalvando(false)
  }

  async function carregar() {
    setErroPagina('')
    setLoading(true)
    const [eventosResult, obrasResult, profilesResult] = await Promise.all([
      supabase.from('agenda').select('*, obras(nome), responsavel:profiles!agenda_responsavel_id_fkey(full_name)').order('data').order('hora_inicio'),
      supabase.from('obras').select('id, nome, supervisor_id, comercial_id').order('nome'),
      supabase.from('profiles').select('id, full_name, role').order('full_name'),
    ])
    const falhas = [
      ['agenda', eventosResult],
      ['obras', obrasResult],
      ['responsáveis', profilesResult],
    ].filter(([, result]) => result.error)
    if (falhas.length) {
      setErroPagina('Parte da agenda não foi carregada: ' + falhas.map(([nome, result]) => `${nome} (${result.error.message})`).join('; '))
    }
    setEventos(eventosResult.data || [])
    setObras(obrasResult.data || [])
    setProfiles(profilesResult.data || [])
    setLoading(false)
  }

  async function criarNotificacaoCompromisso({ agendaId, obraId, responsavelId, tipo, titulo, descricao, prioridade = 'normal' }) {
    if (!agendaId) return
    const obra = obras.find(o => o.id === obraId)
    const destinatarios = new Set([responsavelId, obra?.supervisor_id, obra?.comercial_id].filter(Boolean))
    profiles
      .filter(p => ['gestao', 'pos_venda', 'vendedor'].includes(p.role))
      .forEach(p => p.id && destinatarios.add(p.id))

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError) {
      setAcaoStatus('Compromisso salvo, mas não foi possível identificar o usuário para notificações: ' + authError.message)
      return
    }
    if (authData?.user?.id) destinatarios.delete(authData.user.id)

    const registros = [...destinatarios].map(usuario_id => ({
      usuario_id,
      obra_id: obraId || null,
      tipo,
      titulo,
      descricao,
      prioridade,
      status: 'nao_lida',
      rota: `/agenda?compromisso=${agendaId}`,
      entidade_tipo: 'agenda',
      entidade_id: agendaId,
    }))

    if (registros.length) {
      const { error } = await criarNotificacoes(registros)
      if (error) setAcaoStatus('Compromisso salvo, mas não foi possível notificar a equipe: ' + error.message)
    }
  }

  async function salvar() {
    if (!form.titulo.trim()) return
    if (intervaloTemDiaNaoUtil(form.data, form.data_fim || form.data)) {
      const confirmado = window.confirm('Este compromisso inclui sábado ou domingo. Deseja confirmar mesmo assim?')
      if (!confirmado) return
    }
    setSalvando(true)
    setErroModal('')

    const payload = {
      titulo: normalizarTitulo(form.titulo),
      observacao: form.descricao || null,
      tipo: form.tipo,
      obra_id: form.reuniao_interna ? null : (form.obra_id || null),
      responsavel_id: form.responsavel_id || null,
      data: form.data,
      data_fim: form.data_fim || form.data,
      hora_inicio: form.hora_inicio,
      hora_fim: form.hora_fim || null,
      descricao_cliente: form.visivel_cliente ? (form.descricao_cliente || form.descricao || null) : null,
      observacao_publica: form.visivel_cliente ? (form.descricao_cliente || form.descricao || null) : null,
      reuniao_interna: form.reuniao_interna,
      status: form.status || 'pendente',
      visivel_montador: visivelParaMontador(form),
      visivel_cliente: !form.reuniao_interna && Boolean(form.visivel_cliente),
      confirmado_cliente: Boolean(form.confirmado_cliente),
    }

    const result = editandoId
      ? await supabase.from('agenda').update(payload).eq('id', editandoId).select('*').single()
      : await supabase.from('agenda').insert([payload]).select('*').single()

    if (result.error) {
      console.error('Erro ao salvar compromisso:', result.error)
      setErroModal('Não foi possível salvar este compromisso: ' + result.error.message)
      setSalvando(false)
      return
    }

    if (result.data) {
      setEventos(prev => {
        const existe = prev.some(item => item.id === result.data.id)
        return existe
          ? prev.map(item => item.id === result.data.id ? { ...item, ...result.data } : item)
          : [...prev, result.data]
      })
      preencherForm(result.data)
    }
    await carregar()
    await criarNotificacaoCompromisso({
      agendaId: result.data?.id,
      obraId: result.data?.obra_id,
      responsavelId: result.data?.responsavel_id,
      tipo: editandoId ? 'compromisso_alterado' : 'compromisso_criado',
      titulo: editandoId ? 'Compromisso alterado' : 'Novo compromisso',
      descricao: result.data?.titulo || 'Compromisso operacional atualizado.',
      prioridade: result.data?.status === 'pendente' ? 'normal' : 'alta',
    })
    setToast(editandoId ? 'Alterações salvas com sucesso.' : 'Compromisso criado com sucesso.')
    window.setTimeout(() => setToast(''), 3200)
    setModal(false)
    setEditandoId(null)
    setAcaoStatus('')
    setVistoriaStats({ checklist: 0, fotos: 0 })
    setForm(formInicial())
    setSalvando(false)
  }

  async function excluir(id) {
    if (!window.confirm('Excluir este evento?')) return
    setAcaoStatus('Excluindo compromisso...')
    const { error } = await supabase.from('agenda').delete().eq('id', id)
    if (error) {
      console.error('Erro ao excluir compromisso:', error)
      setAcaoStatus('')
      setErroModal('Nao foi possivel excluir este compromisso: ' + error.message)
      return
    }
    if (editandoId === id) {
      setModal(false)
      setEditandoId(null)
    }
    setToast('Compromisso excluido.')
    window.setTimeout(() => setToast(''), 3200)
    setAcaoStatus('')
    await carregar()
  }

  async function atualizarStatusCompromisso(status) {
    if (!editandoId) return
    setAcaoStatus('Atualizando status...')
    const { error } = await supabase.from('agenda').update({ status }).eq('id', editandoId)
    if (error) {
      console.error('Erro ao atualizar status do compromisso:', error)
      setAcaoStatus('Não foi possível atualizar o status.')
      return
    }
    setForm(p => ({ ...p, status }))
    setAcaoStatus('Status atualizado.')
    await criarNotificacaoCompromisso({
      agendaId: editandoId,
      obraId: form.obra_id,
      responsavelId: form.responsavel_id,
      tipo: 'compromisso_status',
      titulo: status === 'realizada' || status === 'concluida' ? 'Compromisso finalizado' : 'Status do compromisso alterado',
      descricao: `${form.titulo || 'Compromisso'}: ${status}.`,
      prioridade: status === 'realizada' || status === 'concluida' ? 'normal' : 'alta',
    })
    await carregar()
  }

  async function gerarChecklistVistoria() {
    if (!editandoId || !form.obra_id) {
      setAcaoStatus('Vincule uma obra antes de gerar o checklist.')
      return
    }
    setAcaoStatus('Gerando checklist de vistoria...')

    const { data: existentes, error: consultaError } = await supabase
      .from('checklist_items')
      .select('id')
      .eq('agenda_id', editandoId)
      .limit(1)

    if (consultaError) {
      setAcaoStatus('Não foi possível consultar o checklist da vistoria.')
      return
    }

    if ((existentes || []).length > 0) {
      setAcaoStatus('Esta vistoria já possui checklist vinculado.')
      await carregarVistoriaStats(editandoId)
      return
    }

    const rows = VISTORIA_CHECKLIST.map(descricao => ({
      obra_id: form.obra_id,
      agenda_id: editandoId,
      descricao,
      concluido: false,
      fase: 'Pré-Montagem',
      responsavel_perfil: 'supervisor',
      status: 'pendente',
      criticidade: 'alta',
      exige_foto: norm(descricao).includes('foto'),
    }))

    const { error: insertError } = await supabase.from('checklist_items').insert(rows)

    if (insertError) {
      const fallbackRows = VISTORIA_CHECKLIST.map(descricao => ({
        obra_id: form.obra_id,
        agenda_id: editandoId,
        descricao,
        concluido: false,
      }))
      const { error: fallbackError } = await supabase.from('checklist_items').insert(fallbackRows)
      if (fallbackError) {
        setAcaoStatus('Não foi possível gerar o checklist da vistoria.')
        return
      }
    }

    const agendaResult = await supabase.from('agenda').update({
      checklist_gerado: true,
      checklist_gerado_em: new Date().toISOString(),
      status: form.status === 'pendente' ? 'em andamento' : form.status,
    }).eq('id', editandoId)
    if (agendaResult.error) {
      setAcaoStatus('Checklist gerado, mas não foi possível atualizar a agenda: ' + agendaResult.error.message)
      await carregarVistoriaStats(editandoId)
      return
    }

    setForm(p => ({ ...p, status: p.status === 'pendente' ? 'em andamento' : p.status }))
    setAcaoStatus('Checklist de vistoria gerado.')
    await carregarVistoriaStats(editandoId)
    await carregar()
  }

  const hoje_str = hoje.toISOString().split('T')[0]
  const eventosFiltrados = eventos.filter(ev => {
    const inicio = ev.data || ''
    const fim = ev.data_fim || ev.data || ''
    if (filtrosAvancados.inicio && fim < filtrosAvancados.inicio) return false
    if (filtrosAvancados.fim && inicio > filtrosAvancados.fim) return false
    if (filtrosAvancados.obra && ev.obra_id !== filtrosAvancados.obra) return false
    if (filtrosAvancados.responsavel && ev.responsavel_id !== filtrosAvancados.responsavel) return false
    if (filtrosAvancados.tipo && norm(ev.tipo) !== norm(filtrosAvancados.tipo)) return false
    if (filtrosAvancados.status && norm(ev.status || 'pendente') !== norm(filtrosAvancados.status)) return false
    const termo = norm(filtrosAvancados.busca)
    if (termo) {
      const texto = norm([ev.titulo, ev.tipo, ev.observacao, ev.descricao, ev.descricao_cliente, ev.obras?.nome, ev.responsavel?.full_name].filter(Boolean).join(' '))
      if (!texto.includes(termo)) return false
    }
    return true
  })
  const proximos = eventosFiltrados.filter(e => (e.data_fim || e.data) >= hoje_str)
  const passados = eventosFiltrados.filter(e => (e.data_fim || e.data) < hoje_str)
  const hojeEventos = eventosFiltrados.filter(e => e.data === hoje_str)
  const lista = filtro === 'proximos' ? proximos : passados
  const limparFiltros = () => setFiltrosAvancados({ inicio: '', fim: '', obra: '', responsavel: '', tipo: '', status: '', busca: '' })
  const kpis = [
    { label: 'Montagens', value: eventosFiltrados.filter(e => norm(e.tipo || e.titulo).includes('montagem')).length },
    { label: 'Assistências', value: eventosFiltrados.filter(e => norm(e.tipo || e.titulo).includes('assist')).length },
    { label: 'Entregas', value: eventosFiltrados.filter(e => norm(e.tipo || e.titulo).includes('entrega')).length },
    { label: 'Vistorias', value: eventosFiltrados.filter(e => norm(e.tipo || e.titulo).includes('vistoria') || norm(e.tipo || e.titulo).includes('medicao')).length },
  ]
  const corTipoForm = corTipo(form.tipo || form.titulo)
  const statusForm = statusEvento(form, hoje_str)

  return (
    <div className="ow-page" style={s.page}>
      <style>{css}</style>
      {toast && <div style={s.toast}>{toast}</div>}

      {modal && (
        <div style={s.modalBg} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>{editandoId ? 'Detalhe do compromisso' : 'Novo Evento'}</h2>
              <button style={s.btnClose} onClick={() => setModal(false)} aria-label="Fechar evento">X</button>
            </div>
            <div style={s.modalBody}>
              <div style={{ ...s.modalSummary, borderLeftColor: corTipoForm }}>
                <div>
                  <span style={{ ...s.tipoBadge, background: corTipoForm + '18', color: corTipoForm }}>{form.tipo}</span>
                  <strong style={s.modalSummaryTitle}>{form.titulo || 'Compromisso sem título'}</strong>
                  <span style={s.modalSummaryMeta}>
                    {form.data ? new Date(form.data + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem data'}
                    {form.hora_inicio ? ` · ${form.hora_inicio}` : ''}
                  </span>
                </div>
                <span className={`ag-status tone-${statusForm.tone}`}>{statusForm.label}</span>
              </div>
              <div style={s.grid}>
                <div style={s.full}>
                  <L>Título *</L>
                  <I value={form.titulo} onChange={v => setForm(p => ({ ...p, titulo: v }))} placeholder="Nome do evento" />
                </div>
                <div>
                  <L>Tipo</L>
                  <Sel value={form.tipo} onChange={v => setForm(p => ({ ...p, tipo: v }))}>
                    {TIPOS.map(t => <option key={t}>{t}</option>)}
                  </Sel>
                </div>
                <div>
                  <L>Responsável</L>
                  <Sel value={form.responsavel_id} onChange={v => setForm(p => ({ ...p, responsavel_id: v }))}>
                    <option value="">Sem responsável</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </Sel>
                </div>
                <div>
                  <L>Data início *</L>
                  <I type="date" value={form.data} onChange={v => setForm(p => ({ ...p, data: v }))} />
                </div>
                <div>
                  <L>Data fim</L>
                  <I type="date" value={form.data_fim} onChange={v => setForm(p => ({ ...p, data_fim: v }))} />
                </div>
                <div>
                  <L>Hora início</L>
                  <I type="time" value={form.hora_inicio} onChange={v => setForm(p => ({ ...p, hora_inicio: v }))} />
                </div>
                <div>
                  <L>Hora fim</L>
                  <I type="time" value={form.hora_fim} onChange={v => setForm(p => ({ ...p, hora_fim: v }))} />
                </div>
                <div>
                  <L>Status</L>
                  <Sel value={form.status} onChange={v => setForm(p => ({ ...p, status: v }))}>
                    <option value="pendente">Pendente</option>
                    <option value="em andamento">Em andamento</option>
                    <option value="realizada">Realizada</option>
                    <option value="concluida">Concluída</option>
                    <option value="remarcada">Remarcada</option>
                    <option value="cancelada">Cancelada</option>
                  </Sel>
                </div>
                <div style={s.full}>
                  <L>Obra vinculada</L>
                  <Sel value={form.obra_id} onChange={v => setForm(p => ({ ...p, obra_id: v, visivel_montador: v ? (p.obra_id ? p.visivel_montador : true) : false }))} disabled={form.reuniao_interna}>
                    <option value="">Sem obra vinculada</option>
                    {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </Sel>
                </div>
                <div style={s.full}>
                  <L>Descrição</L>
                  <textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} rows={2} placeholder="Detalhes do evento..." style={{ background: theme.inputBackground, border: '1px solid ' + theme.inputBorder, color: theme.inputText, borderRadius: 8, padding: '10px 14px', width: '100%', fontSize: 14, outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                <div style={s.full}>
                  <L>Descrição para o cliente</L>
                  <textarea value={form.descricao_cliente} onChange={e => setForm(p => ({ ...p, descricao_cliente: e.target.value }))} rows={2} placeholder="Texto exibido no Portal Cliente quando o evento estiver liberado..." disabled={!form.visivel_cliente || form.reuniao_interna} style={{ background: theme.inputBackground, border: '1px solid ' + theme.inputBorder, color: theme.inputText, borderRadius: 8, padding: '10px 14px', width: '100%', fontSize: 14, outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', opacity: (!form.visivel_cliente || form.reuniao_interna) ? 0.62 : 1 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="ri" checked={form.reuniao_interna} onChange={e => setForm(p => ({ ...p, reuniao_interna: e.target.checked, obra_id: e.target.checked ? '' : p.obra_id, visivel_montador: e.target.checked ? false : p.visivel_montador, visivel_cliente: e.target.checked ? false : p.visivel_cliente }))} />
                  <label htmlFor="ri" style={{ fontSize: 13, color: 'var(--color-ink-muted)', cursor: 'pointer' }}>Reunião Interna</label>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--color-ink-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.visivel_montador && !form.reuniao_interna && Boolean(form.obra_id)} disabled={form.reuniao_interna || !form.obra_id} onChange={e => setForm(p => ({ ...p, visivel_montador: e.target.checked }))} />
                  Visível para montador
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--color-ink-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.visivel_cliente && !form.reuniao_interna} disabled={form.reuniao_interna} onChange={e => setForm(p => ({ ...p, visivel_cliente: e.target.checked }))} />
                  Visível para cliente
                </label>
                {form.visivel_cliente && !form.reuniao_interna && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--color-ink-muted)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.confirmado_cliente} onChange={e => setForm(p => ({ ...p, confirmado_cliente: e.target.checked }))} />
                    Presença confirmada pelo cliente
                  </label>
                )}
              </div>

              {editandoId && norm(form.tipo).includes('vistoria') && (
                <div style={s.vistoriaBox}>
                  <div style={s.vistoriaHead}>
                    <div>
                      <div style={s.vistoriaEyebrow}>Vistoria operacional</div>
                      <strong style={s.vistoriaTitle}>Checklist, fotos e status da vistoria</strong>
                    </div>
                    <span style={s.vistoriaStatus}>{form.status || 'pendente'}</span>
                  </div>
                  <div style={s.vistoriaStats}>
                    <div style={s.vistoriaStat}><strong style={s.vistoriaStatValue}>{vistoriaStats.checklist}</strong><span style={s.vistoriaStatLabel}>itens vinculados</span></div>
                    <div style={s.vistoriaStat}><strong style={s.vistoriaStatValue}>{vistoriaStats.fotos}</strong><span style={s.vistoriaStatLabel}>fotos de vistoria</span></div>
                  </div>
                  <div style={s.vistoriaActions}>
                    <button type="button" style={s.vistoriaPrimary} onClick={gerarChecklistVistoria}>Gerar checklist</button>
                    <button type="button" style={s.vistoriaButton} onClick={() => atualizarStatusCompromisso('em andamento')}>Em andamento</button>
                    <button type="button" style={s.vistoriaButton} onClick={() => atualizarStatusCompromisso('realizada')}>Marcar realizada</button>
                    {form.obra_id && <button type="button" style={s.vistoriaButton} onClick={() => navigate(`/obras/${form.obra_id}?aba=Agenda&compromisso=${editandoId}`)}>Abrir obra</button>}
                  </div>
                  {acaoStatus && <div style={s.vistoriaMessage}>{acaoStatus}</div>}
                </div>
              )}
              {editandoId && form.obra_id && (
                <div style={s.campoBox}>
                  <div style={s.vistoriaHead}>
                    <div>
                      <div style={s.vistoriaEyebrow}>Registro de campo</div>
                      <strong style={s.vistoriaTitle}>Check-in e check-out do compromisso</strong>
                    </div>
                    <span style={s.campoStatus}>
                      {checkinsCompromisso.some(c => c.entrada && !c.saida) ? 'Em serviço' : checkinsCompromisso.length ? 'Registrado' : 'Pendente'}
                    </span>
                  </div>

                  <div style={s.campoActions}>
                    {checkinsCompromisso.some(c => c.entrada && !c.saida) ? (
                      <button type="button" style={{ ...s.campoAction, background: '#B84040' }} onClick={registrarCheckoutCompromisso} disabled={campoSalvando}>
                        {campoSalvando ? 'Registrando...' : 'Fazer check-out'}
                      </button>
                    ) : (
                      <button type="button" style={s.campoAction} onClick={registrarCheckinCompromisso} disabled={campoSalvando}>
                        {campoSalvando ? 'Registrando...' : 'Fazer check-in'}
                      </button>
                    )}
                    <span style={s.campoHint}>A localização será salva quando autorizada pelo navegador.</span>
                  </div>

                  {checkinsLoading ? (
                    <div style={s.campoEmpty}>Carregando registros...</div>
                  ) : checkinsCompromisso.length === 0 ? (
                    <div style={s.campoEmpty}>Nenhum check-in registrado para esta obra nesta data.</div>
                  ) : (
                    <div style={s.campoList}>
                      {checkinsCompromisso.map(registro => {
                        const latitude = registro.entrada_latitude || registro.latitude
                        const longitude = registro.entrada_longitude || registro.longitude
                        const temLocal = latitude && longitude
                        return (
                          <div key={registro.id} style={s.campoItem}>
                            <div style={s.campoPerson}>{registro.profiles?.full_name || 'Profissional'}</div>
                            <div className="ag-field-grid" style={s.campoGrid}>
                              <span style={s.campoInfo}><strong style={s.campoInfoLabel}>Entrada</strong>{horaCurta(registro.entrada || registro.created_at)}</span>
                              <span style={s.campoInfo}><strong style={s.campoInfoLabel}>Saída</strong>{registro.saida ? horaCurta(registro.saida) : 'Em serviço'}</span>
                              <span style={s.campoInfo}>
                                <strong style={s.campoInfoLabel}>Localização</strong>
                                {temLocal ? (
                                  <a href={`https://www.google.com/maps?q=${latitude},${longitude}`} target="_blank" rel="noreferrer" style={s.localLink}>
                                    Abrir mapa
                                  </a>
                                ) : 'Não autorizada'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
              {(erroModal || (!norm(form.tipo).includes('vistoria') && acaoStatus)) && (
                <div style={{
                  marginTop: 14,
                  border: `1px solid ${erroModal ? '#F0C8C8' : 'var(--color-border)'}`,
                  background: erroModal ? 'rgba(224,82,82,.12)' : theme.surfaceElevated,
                  color: erroModal ? theme.error : theme.textSecondary,
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 12,
                  fontWeight: 800,
                }}>
                  {erroModal || acaoStatus}
                </div>
              )}
            </div>
            <div style={s.modalFooter}>
          {editandoId && form.obra_id && (
            <button style={s.btnCancel} onClick={() => navigate(`/obras/${form.obra_id}?aba=Agenda&compromisso=${editandoId}`)}>Abrir obra</button>
          )}
          {editandoId && (
            <button style={{ ...s.btnCancel, color: '#B84040', borderColor: '#F0C8C8' }} onClick={() => excluir(editandoId)}>Excluir</button>
          )}
          <button style={s.btnCancel} onClick={() => { setModal(false); setEditandoId(null) }}>Cancelar</button>
          <button style={s.btnSave} onClick={salvar} disabled={salvando || !form.titulo.trim()}>
            {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Criar Evento'}
          </button>
            </div>
          </div>
        </div>
      )}

      <div className="ag-header" style={s.header}>
        <div>
          <div style={s.breadcrumb}>Gestão</div>
          <h1 style={s.title}>Central de Agenda</h1>
          <p style={s.sub}>Montagens, entregas, assistências e compromissos operacionais</p>
        </div>
        <button className="ag-new" style={s.btnNew} onClick={abrirNovo}>+ Novo Evento</button>
      </div>

      {erroPagina && <div style={s.alert}>{erroPagina}</div>}

      <div className="ag-kpis" style={s.kpiGrid}>
        {kpis.map(k => (
          <div key={k.label} style={s.kpi}>
            <span style={s.kpiLabel}>{k.label}</span>
            <strong style={s.kpiValue}>{loading ? '-' : k.value}</strong>
          </div>
        ))}
      </div>

      <section className="ag-mobile-home" aria-label="Resumo da agenda">
        <button onClick={() => setFiltro('proximos')}>
          <strong>{loading ? '-' : hojeEventos.length}</strong>
          <span>hoje</span>
        </button>
        <button onClick={() => setFiltro('proximos')}>
          <strong>{loading ? '-' : proximos.length}</strong>
          <span>próximos</span>
        </button>
        <button className={passados.length ? 'muted' : ''} onClick={() => setFiltro('passados')}>
          <strong>{loading ? '-' : passados.length}</strong>
          <span>anteriores</span>
        </button>
      </section>

      <div className="ag-filters" style={s.filtros}>
        {[
          { id: 'proximos', label: 'Próximos (' + proximos.length + ')' },
          { id: 'passados', label: 'Anteriores (' + passados.length + ')' },
        ].map(f => (
          <button key={f.id} onClick={() => setFiltro(f.id)} style={{
            ...s.filtroBtn,
            background: filtro === f.id ? theme.gold : theme.surface,
            color: filtro === f.id ? theme.background : theme.textSecondary,
            border: filtro === f.id ? 'none' : '1px solid var(--color-border)',
          }}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="ag-filter-grid" style={s.filterGrid}>
        <input style={s.filterInput} value={filtrosAvancados.busca} onChange={e => setFiltrosAvancados(p => ({ ...p, busca: e.target.value }))} placeholder="Buscar por título, obra ou responsável" />
        <input style={s.filterInput} type="date" value={filtrosAvancados.inicio} onChange={e => setFiltrosAvancados(p => ({ ...p, inicio: e.target.value }))} aria-label="Início do período" />
        <input style={s.filterInput} type="date" value={filtrosAvancados.fim} onChange={e => setFiltrosAvancados(p => ({ ...p, fim: e.target.value }))} aria-label="Fim do período" />
        <select style={s.filterInput} value={filtrosAvancados.obra} onChange={e => setFiltrosAvancados(p => ({ ...p, obra: e.target.value }))}>
          <option value="">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <select style={s.filterInput} value={filtrosAvancados.responsavel} onChange={e => setFiltrosAvancados(p => ({ ...p, responsavel: e.target.value }))}>
          <option value="">Todos os responsáveis</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
        <select style={s.filterInput} value={filtrosAvancados.tipo} onChange={e => setFiltrosAvancados(p => ({ ...p, tipo: e.target.value }))}>
          <option value="">Todos os tipos</option>
          {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select style={s.filterInput} value={filtrosAvancados.status} onChange={e => setFiltrosAvancados(p => ({ ...p, status: e.target.value }))}>
          <option value="">Todos os status</option>
          {['pendente', 'em andamento', 'realizada', 'concluida', 'remarcada', 'cancelada'].map(status => <option key={status} value={status}>{status}</option>)}
        </select>
        <button type="button" style={s.filterClear} onClick={limparFiltros}>Limpar</button>
      </div>

      {loading ? (
        <div style={s.empty}>Carregando...</div>
      ) : lista.length === 0 ? (
        <div style={s.emptyBox}>
          <div style={s.emptyIcon}>📅</div>
          <div style={s.emptyTitle}>
            {filtro === 'proximos' ? 'Nenhum evento agendado' : 'Nenhum evento anterior'}
          </div>
          <div style={s.emptySub}>
            {filtro === 'proximos' ? 'Agende vistorias, montagens e compromissos' : ''}
          </div>
          {filtro === 'proximos' && (
            <button style={s.btnNew} onClick={abrirNovo}>+ Criar Primeiro Evento</button>
          )}
        </div>
      ) : (
        <div>
          {lista.map(ev => {
            const d = new Date(ev.data + 'T00:00:00')
            const cor = corTipo(ev.tipo || ev.titulo)
            const isHoje = ev.data === hoje_str
            const status = statusEvento(ev, hoje_str)
            const fimSemana = ehFimDeSemana(ev.data)
            return (
              <div key={ev.id} className="ag-card" onClick={() => abrirEditar(ev)} style={{ ...s.card, borderLeft: '4px solid ' + cor, background: fimSemana ? theme.surfaceElevated : theme.surface, opacity: filtro === 'passados' ? 0.7 : 1, cursor: 'pointer' }}>
                <div className="ag-datebox" style={{ ...s.datebox, borderColor: isHoje ? cor : 'var(--color-border)', background: isHoje ? cor + '18' : theme.surfaceElevated }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: isHoje ? cor : 'var(--color-ink)', fontFamily: 'var(--font-serif)', lineHeight: 1 }}>{d.getDate()}</div>
                  <div style={{ fontSize: 9, color: cor, letterSpacing: 1, fontWeight: 600 }}>{MESES[d.getMonth()].slice(0, 3).toUpperCase()}</div>
                  <div style={{ fontSize: 9, color: 'var(--color-ink-muted)' }}>{DIAS[d.getDay()]}</div>
                </div>
                <div style={s.cardBody}>
                  <div style={s.cardTop}>
                    <span style={s.cardTitulo}>{normalizarTitulo(ev.titulo)}</span>
                    <span className={`ag-status tone-${status.tone}`}>{status.label}</span>
                    <span style={{ ...s.tipoBadge, background: cor + '18', color: cor }}>{ev.tipo}</span>
                    {ev.reuniao_interna && <span style={{ ...s.tipoBadge, background: '#eef2f8', color: '#3a5580' }}>Reunião Interna</span>}
                    {!ev.reuniao_interna && ev.visivel_cliente && <span style={{ ...s.tipoBadge, background: '#EAF5EE', color: '#2D7A4A' }}>Cliente</span>}
                    {!ev.reuniao_interna && ev.visivel_montador && <span style={{ ...s.tipoBadge, background: '#EEF5FB', color: '#1E5A8A' }}>Campo</span>}
                    {ev.confirmado_cliente && <span style={{ ...s.tipoBadge, background: '#18311F', color: '#CFF3DA' }}>Confirmado</span>}
                    {isHoje && <span style={{ ...s.tipoBadge, background: '#edf7f0', color: '#3a7d4f' }}>Hoje</span>}
                  </div>
                  {(ev.observacao || ev.descricao) && <div className="ag-card-desc" style={s.cardDesc}>{ev.observacao || ev.descricao}</div>}
                  <div className="ag-card-meta" style={s.cardMeta}>
                    {ev.hora_inicio && <span>{ev.hora_inicio.slice(0, 5)}{ev.hora_fim ? ' - ' + ev.hora_fim.slice(0, 5) : ''}</span>}
                    {ev.obras?.nome && <span>Obra: {ev.obras.nome}</span>}
                    {ev.responsavel?.full_name && <span>{ev.responsavel.full_name}</span>}
                    {ev.data_fim && ev.data_fim !== ev.data && <span>Até {new Date(ev.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); excluir(ev.id) }} style={s.btnExcluir} aria-label="Excluir evento">X</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function L({ children }) { return <div style={{ fontSize: 11, color: '#888', marginBottom: 5, fontWeight: 500 }}>{children}</div> }
function I({ onChange, ...props }) { return <input {...props} onChange={e => onChange(e.target.value)} style={{ background: theme.inputBackground, border: '1px solid ' + theme.inputBorder, color: theme.inputText, borderRadius: 8, padding: '10px 14px', width: '100%', minHeight: 44, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} /> }
function Sel({ onChange, children, ...props }) { return <select {...props} onChange={e => onChange(e.target.value)} style={{ background: theme.inputBackground, border: '1px solid ' + theme.inputBorder, color: theme.inputText, borderRadius: 8, padding: '10px 14px', width: '100%', minHeight: 44, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}>{children}</select> }

const css = `
.ag-mobile-home{display:none}
.ag-status{border-radius:999px;padding:3px 8px;font-size:10px;font-weight:900;line-height:1;white-space:nowrap}
.ag-status.tone-success{background:#EAF5EE;color:#2D7A4A}
.ag-status.tone-info{background:#EEF5FB;color:#1E5A8A}
.ag-status.tone-warn{background:rgba(224,168,82,.13);color:${theme.warning}}
.ag-status.tone-danger{background:rgba(224,82,82,.12);color:${theme.error}}
.ag-vistoria-placeholder{display:none}
@media (max-width:760px){
  .ag-header{display:grid !important;grid-template-columns:1fr auto;gap:10px;align-items:end !important;margin-bottom:13px !important;padding-right:0 !important}
  .ag-header h1{font-size:27px !important;line-height:1 !important}
  .ag-header p{display:none !important}
  .ag-new{padding:9px 12px !important;border-radius:12px !important;font-size:12px !important}
  .ag-kpis{display:flex !important;gap:8px !important;overflow-x:auto !important;margin-bottom:12px !important;padding-bottom:4px !important}
  .ag-kpis>div{flex:0 0 auto !important;min-width:auto !important;display:flex !important;align-items:center !important;gap:7px !important;border-radius:999px !important;padding:7px 10px !important;border-top:1px solid rgba(184,150,94,.22) !important;box-shadow:0 8px 20px rgba(29,28,25,.045) !important}
  .ag-kpis span{font-size:10.5px !important;line-height:1 !important;letter-spacing:0 !important;white-space:nowrap !important;margin:0 !important;color:var(--color-ink-muted) !important}
  .ag-kpis strong{font-size:15px !important;line-height:1 !important}
  .ag-mobile-home{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 12px}
  .ag-mobile-home button{border:1px solid var(--color-border);background:${theme.surface};border-radius:15px;padding:11px 9px;text-align:left;font-family:inherit;box-shadow:0 10px 26px rgba(0,0,0,.16)}
  .ag-mobile-home button.muted{background:${theme.surfaceElevated}}
  .ag-mobile-home strong{display:block;font-size:23px;line-height:1;color:var(--color-ink)}
  .ag-mobile-home span{display:block;font-size:10.5px;color:var(--color-ink-muted);font-weight:900;margin-top:5px}
  .ag-filters{margin-bottom:12px !important}
  .ag-filters button{padding:8px 13px !important}
  .ag-filter-grid{grid-template-columns:1fr !important;margin-bottom:12px !important}
  .ag-card{padding:12px 13px !important;gap:12px !important;border-radius:16px !important;align-items:flex-start !important;margin-bottom:9px !important}
  .ag-datebox{min-width:48px !important;padding:7px 0 !important}
  .ag-card-desc{display:none !important}
  .ag-card-meta{font-size:11.5px !important;gap:8px !important;line-height:1.35 !important;color:var(--color-ink-muted) !important}
  .ag-card-meta span:nth-child(n+3){display:none !important}
  .ag-card button:last-child{display:none !important}
  .ag-field-grid{grid-template-columns:1fr !important}
}
`

const s = {
  page: { width: '100%', padding: '32px 40px', maxWidth: 'none', margin: 0, background: theme.background, color: theme.textPrimary, fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', overflowX: 'hidden' },
  toast: { position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 1300, background: 'var(--color-ink)', color: '#fff', borderLeft: '3px solid var(--color-gold)', borderRadius: 13, padding: '12px 18px', fontSize: 13, fontWeight: 800, boxShadow: '0 14px 34px rgba(29,28,25,.18)' },
  alert: { marginBottom: 16, border: `1px solid ${theme.error}`, background: 'rgba(224,82,82,.12)', color: theme.error, borderRadius: 12, padding: '11px 14px', fontSize: 13, fontWeight: 800 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, marginBottom: 24, boxSizing: 'border-box' },
  breadcrumb: { fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 6 },
  title: { fontFamily: 'var(--font-serif)', fontSize: 36, fontWeight: 500, color: 'var(--color-ink)', margin: 0 },
  sub: { fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 4 },
  btnNew: { background: theme.gold, color: theme.background, border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 20 },
  kpi: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  kpiLabel: { display: 'block', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--color-gold)', fontWeight: 800, marginBottom: 8 },
  kpiValue: { display: 'block', fontSize: 30, lineHeight: 1, color: 'var(--color-ink)' },
  filtros: { display: 'flex', gap: 8, marginBottom: 20 },
  filtroBtn: { padding: '7px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  filterGrid: { display: 'grid', gridTemplateColumns: 'minmax(220px, 1.4fr) repeat(7, minmax(120px, 1fr))', gap: 8, marginBottom: 20 },
  filterInput: { background: theme.inputBackground, border: '1px solid ' + theme.inputBorder, color: theme.inputText, borderRadius: 8, padding: '10px 12px', minHeight: 44, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', minWidth: 0 },
  filterClear: { background: theme.surfaceElevated, border: '1px solid var(--color-border)', color: 'var(--color-ink)', borderRadius: 8, padding: '10px 12px', minHeight: 44, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  card: { display: 'flex', gap: 16, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 20, marginBottom: 10, alignItems: 'flex-start', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  datebox: { minWidth: 52, textAlign: 'center', border: '1px solid', borderRadius: 8, padding: '8px 0', flexShrink: 0 },
  cardBody: { flex: 1, minWidth: 0 },
  cardTop: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  cardTitulo: { fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' },
  tipoBadge: { fontSize: 10, padding: '2px 9px', borderRadius: 20, fontWeight: 500 },
  cardDesc: { fontSize: 12.5, color: 'var(--color-ink-muted)', marginBottom: 6 },
  cardMeta: { display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: '#aaa' },
  btnExcluir: { background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 14, padding: '4px 8px', flexShrink: 0, alignSelf: 'flex-start' },
  empty: { textAlign: 'center', padding: '40px 0', color: '#bbb' },
  emptyBox: { textAlign: 'center', padding: '60px 20px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#aaa', marginBottom: 20 },
  modalBg: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, width: '100%', maxWidth: 580, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 28px 0', flexShrink: 0 },
  modalTitle: { fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 500, margin: 0 },
  btnClose: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999' },
  modalBody: { overflowY: 'auto', padding: '20px 28px', flex: 1 },
  modalSummary: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-gold)', background: theme.surfaceElevated, borderRadius: 14, padding: '13px 14px', marginBottom: 16 },
  modalSummaryTitle: { display: 'block', marginTop: 8, fontSize: 15, color: 'var(--color-ink)' },
  modalSummaryMeta: { display: 'block', marginTop: 4, fontSize: 12, color: 'var(--color-ink-muted)', fontWeight: 700 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 28px', borderTop: '1px solid #f0ece6', flexShrink: 0 },
  btnCancel: { background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '9px 18px', minHeight: 44, fontSize: 13, cursor: 'pointer', color: '#888' },
  btnSave: { background: theme.gold, color: theme.background, border: 'none', borderRadius: 8, padding: '12px 24px', minHeight: 44, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  full: { gridColumn: '1/-1' },
  vistoriaBox: { marginTop: 18, border: '1px solid var(--color-border)', background: theme.surfaceElevated, borderRadius: 14, padding: 16 },
  vistoriaHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  vistoriaEyebrow: { fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--color-gold)', fontWeight: 900, marginBottom: 5 },
  vistoriaTitle: { display: 'block', fontSize: 15, color: 'var(--color-ink)' },
  vistoriaStatus: { borderRadius: 999, background: '#EAF5EE', color: '#2D7A4A', padding: '6px 10px', fontSize: 11, fontWeight: 900, textTransform: 'capitalize', whiteSpace: 'nowrap' },
  vistoriaStats: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 },
  vistoriaStat: { background: theme.surface, border: '1px solid var(--color-border)', borderRadius: 12, padding: '12px 13px' },
  vistoriaStatValue: { display: 'block', fontSize: 24, lineHeight: 1, color: 'var(--color-ink)', marginBottom: 5 },
  vistoriaStatLabel: { display: 'block', fontSize: 11, color: 'var(--color-ink-muted)', fontWeight: 800 },
  vistoriaActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  vistoriaPrimary: { background: 'var(--color-ink)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 12px', fontSize: 12, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' },
  vistoriaButton: { background: theme.surfaceElevated, color: 'var(--color-ink)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '9px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  vistoriaMessage: { marginTop: 12, borderRadius: 10, background: theme.surface, border: '1px solid var(--color-border)', padding: '9px 11px', fontSize: 12, color: 'var(--color-ink-muted)', fontWeight: 700 },
  campoBox: { marginTop: 14, border: '1px solid var(--color-border)', background: theme.surfaceElevated, borderRadius: 14, padding: 16 },
  campoStatus: { borderRadius: 999, background: '#EAF5EE', color: '#2D7A4A', padding: '6px 11px', fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap' },
  campoActions: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 },
  campoAction: { background: '#2D7A4A', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 13px', fontSize: 12, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' },
  campoHint: { fontSize: 11.5, color: 'var(--color-ink-muted)', fontWeight: 700 },
  campoEmpty: { border: '1px dashed var(--color-border)', background: theme.surface, borderRadius: 12, padding: 14, color: 'var(--color-ink-muted)', fontSize: 12.5, fontWeight: 700 },
  campoList: { display: 'grid', gap: 9 },
  campoItem: { border: '1px solid var(--color-border)', background: theme.surface, borderRadius: 12, padding: 12 },
  campoPerson: { fontSize: 13, color: 'var(--color-ink)', fontWeight: 900, marginBottom: 9 },
  campoGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 },
  campoInfo: { display: 'block', borderRadius: 10, background: theme.surface, padding: '9px 10px', fontSize: 12, color: 'var(--color-ink)', fontWeight: 800 },
  campoInfoLabel: { display: 'block', fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--color-ink-muted)', marginBottom: 4 },
  localLink: { color: '#2D7A4A', fontWeight: 900, textDecoration: 'none' },
}
