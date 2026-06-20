import { useEffect, useMemo, useRef, useState } from 'react'
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
  success: '#2D7A4A',
  danger: '#B84040',
  warn: '#9A6A22',
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

const PRIORIDADE = {
  baixa: { label: 'Baixa', color: '#8A8175' },
  media: { label: 'Média', color: THEME.warn },
  alta: { label: 'Alta', color: THEME.danger },
}

const safeArray = result => result?.data || []
const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const isConcluido = status => ['concluida', 'concluido', 'finalizada', 'finalizado'].includes(norm(status))
const isAberta = status => !isConcluido(status) && !['fechada', 'resolvida', 'cancelada'].includes(norm(status))

function fotoUrl(foto) {
  if (foto.url) return foto.url
  if (!foto.storage_path) return ''
  return supabase.storage.from('fotos-obras').getPublicUrl(foto.storage_path).data.publicUrl
}

function dataBR(value) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR') : '-'
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

function enderecoObra(obra) {
  if (!obra) return ''
  const rua = [obra.rua, obra.numero, obra.complemento].filter(Boolean).join(', ')
  const cidade = [obra.bairro, obra.cidade, obra.uf].filter(Boolean).join(' - ')
  return [rua || obra.endereco, cidade].filter(Boolean).join(' · ')
}

function tipoAgenda(item) {
  const tipo = norm(item.tipo || item.titulo || item.observacao || item.descricao)
  if (tipo.includes('vistoria')) return 'Vistoria'
  if (tipo.includes('assist')) return 'Assistência técnica'
  if (tipo.includes('reuniao') || tipo.includes('reuni')) return 'Reunião'
  return 'Montagem'
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

  const [loading, setLoading] = useState(true)
  const [loadingObra, setLoadingObra] = useState(false)
  const [checkando, setCheckando] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [salvandoProblema, setSalvandoProblema] = useState(false)
  const [modalProblema, setModalProblema] = useState(null)
  const [problema, setProblema] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [servicoFeedback, setServicoFeedback] = useState('')
  const [preview, setPreview] = useState(null)
  const [formFoto, setFormFoto] = useState({ categoria: '', ambiente_id: '', agenda_id: '', observacao: '' })

  const tarefasRef = useRef(null)
  const checklistRef = useRef(null)
  const fotosRef = useRef(null)
  const ocorrenciasRef = useRef(null)
  const perfilRef = useRef(null)

  function mostrarSucesso(msg) {
    setSucesso(msg)
    window.setTimeout(() => setSucesso(''), 3200)
  }

  async function carregarDadosObra(obra = obraAtiva) {
    if (!obra?.id || !user?.id) return

    const [
      tarefasResult,
      checkinsResult,
      checklistResult,
      ambientesResult,
      fotosResult,
      ocorrenciasResult,
      agendaResult,
    ] = await Promise.all([
      supabase.from('tarefas').select('*').eq('obra_id', obra.id).eq('responsavel_id', user.id).order('prazo'),
      supabase.from('checkins').select('*').eq('user_id', user.id).eq('obra_id', obra.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('checklist_items').select('id, obra_id, ambiente_id, descricao, concluido, concluido_por, concluido_em').eq('obra_id', obra.id).order('descricao'),
      supabase.from('obra_ambientes').select('id, nome, status').eq('obra_id', obra.id).order('nome'),
      supabase.from('fotos').select('*').eq('obra_id', obra.id).order('created_at', { ascending: false }).limit(60),
      supabase.from('ocorrencias').select('*').eq('obra_id', obra.id).order('created_at', { ascending: false }).limit(40),
      supabase.from('agenda').select('*').eq('obra_id', obra.id).order('data').order('hora_inicio'),
    ])

    setTarefas(safeArray(tarefasResult))
    setCheckins(safeArray(checkinsResult))
    setChecklist(safeArray(checklistResult))
    setAmbientes(safeArray(ambientesResult))
    setFotos(safeArray(fotosResult).map(foto => ({ ...foto, categoria: foto.categoria || 'Geral', publicUrl: fotoUrl(foto) })))
    setOcorrencias(safeArray(ocorrenciasResult))
    setAgenda(safeArray(agendaResult))
    setLoadingObra(false)
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

      if (!ativo) return

      const lista = safeArray(obrasResult)
      setObras(lista)
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
      const [
        tarefasResult,
        checkinsResult,
        checklistResult,
        ambientesResult,
        fotosResult,
        ocorrenciasResult,
        agendaResult,
      ] = await Promise.all([
        supabase.from('tarefas').select('*').eq('obra_id', obraAtiva.id).eq('responsavel_id', user.id).order('prazo'),
        supabase.from('checkins').select('*').eq('user_id', user.id).eq('obra_id', obraAtiva.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('checklist_items').select('id, obra_id, ambiente_id, descricao, concluido, concluido_por, concluido_em').eq('obra_id', obraAtiva.id).order('descricao'),
        supabase.from('obra_ambientes').select('id, nome, status').eq('obra_id', obraAtiva.id).order('nome'),
        supabase.from('fotos').select('*').eq('obra_id', obraAtiva.id).order('created_at', { ascending: false }).limit(60),
        supabase.from('ocorrencias').select('*').eq('obra_id', obraAtiva.id).order('created_at', { ascending: false }).limit(40),
        supabase.from('agenda').select('*').eq('obra_id', obraAtiva.id).order('data').order('hora_inicio'),
      ])

      if (!ativo) return

      setTarefas(safeArray(tarefasResult))
      setCheckins(safeArray(checkinsResult))
      setChecklist(safeArray(checklistResult))
      setAmbientes(safeArray(ambientesResult))
      setFotos(safeArray(fotosResult).map(foto => ({ ...foto, categoria: foto.categoria || 'Geral', publicUrl: fotoUrl(foto) })))
      setOcorrencias(safeArray(ocorrenciasResult))
      setAgenda(safeArray(agendaResult))
      setLoadingObra(false)
    }

    carregar()

    return () => { ativo = false }
  }, [obraAtiva?.id, user?.id])

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
    const { data: gestores } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['gestao', 'pos_venda', 'vendedor'])

    ;(gestores || []).forEach(p => p.id && destinatarios.add(p.id))
    destinatarios.delete(user.id)

    let rota = `/obras/${obraAtiva.id}`
    if (entidadeTipo === 'fotos') rota = `/obras/${obraAtiva.id}?aba=Fotos&foto=${entidadeId || ''}`
    else if (entidadeTipo === 'ocorrencias') rota = `/obras/${obraAtiva.id}?aba=Ocorrencias&ocorrencia=${entidadeId || ''}`
    else if (entidadeTipo === 'checklist_items') rota = `/obras/${obraAtiva.id}?aba=Checklist&checklist=${entidadeId || ''}`
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

    if (registros.length) await supabase.from('notificacoes').insert(registros)
  }

  async function fazerCheckin() {
    if (!obraAtiva || !user) return
    setCheckando(true)

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
    } catch {
      // O check-in continua mesmo se a localização não estiver disponível.
    }

    const compromisso = compromissoAtual()
    const { data, error } = await supabase.from('checkins').insert([{
      user_id: user.id,
      obra_id: obraAtiva.id,
      agenda_id: compromisso?.id || null,
      entrada: new Date().toISOString(),
      localizacao_autorizada: localizacaoAutorizada,
      entrada_latitude: lat,
      entrada_longitude: lng,
      latitude: lat,
      longitude: lng,
    }]).select('*').single()
    if (error) {
      mostrarSucesso('Nao foi possivel registrar o check-in.')
      setCheckando(false)
      return
    }

    const mensagem = lat ? 'Check-in registrado com localização.' : 'Check-in registrado.'
    setServicoFeedback(mensagem)
    mostrarSucesso(mensagem)
    await criarNotificacoesOperacionais({
      tipo: 'checkin',
      titulo: 'Montador fez check-in',
      descricao: `${profile?.full_name || 'Montador'} iniciou serviço em ${obraAtiva.nome || 'obra'}.`,
      entidadeTipo: 'checkin',
      entidadeId: data?.id,
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
      } catch {
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

  async function mudarStatus(id, status) {
    await supabase.from('tarefas').update({ status }).eq('id', id)
    await carregarDadosObra()
  }

  async function toggleChecklist(item) {
    if (!user) return
    const concluindo = !item.concluido
    await supabase.from('checklist_items').update({
      concluido: concluindo,
      concluido_por: concluindo ? user.id : null,
      concluido_em: concluindo ? new Date().toISOString() : null,
    }).eq('id', item.id)
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
    } catch {
      mostrarSucesso('Não foi possível enviar a foto.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function salvarProblema() {
    if (!problema.trim() || !obraAtiva || !user) return
    setSalvandoProblema(true)

    const { data: ocorrenciaCriada } = await supabase.from('ocorrencias').insert([{
      obra_id: obraAtiva.id,
      criado_por: user.id,
      tipo: 'Problema técnico',
      titulo: modalProblema?.titulo || 'Problema reportado pelo montador',
      descricao: problema.trim(),
      gravidade: 'media',
      status: 'Aberta',
    }]).select('id, titulo').single()

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

  function scrollTo(ref) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const vm = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const amanha = new Date(hoje)
    amanha.setDate(hoje.getDate() + 1)

    const tarefasAbertas = tarefas.filter(t => !isConcluido(t.status))
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
    const agendaPassada = agenda
      .filter(item => item.data && new Date(`${item.data}T00:00:00`) < hoje)
      .sort((a, b) => `${b.data || ''}${b.hora_inicio || ''}`.localeCompare(`${a.data || ''}${a.hora_inicio || ''}`))
    const proximaAgenda = agendaFutura[0] || agendaPassada[0] || null
    const proximaAgendaStatus = proximaAgenda ? statusAgenda(proximaAgenda) : null

    const emServico = checkins.some(c => !c.saida)
    const ultimoCheckin = checkins[0] || null
    const registrosHoje = checkins.filter(c => mesmoDia(c.entrada || c.created_at, hoje))
    const registroHoje = registrosHoje.find(c => !c.saida) || registrosHoje[0] || null
    const ultimoServico = checkins.find(c => c.saida) || ultimoCheckin
    const pctChecklist = checklist.length ? Math.round((checklistConcluidos.length / checklist.length) * 100) : 0

    const checklistGrupos = [
      ...ambientes.map(ambiente => ({
        id: ambiente.id,
        nome: ambiente.nome || 'Ambiente',
        itens: checklist.filter(item => item.ambiente_id === ambiente.id),
      })),
      { id: 'geral', nome: 'Geral', itens: checklist.filter(item => !item.ambiente_id) },
    ].filter(grupo => grupo.id !== 'geral' || grupo.itens.length > 0 || ambientes.length === 0)

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
      checklistPendentes,
      checklistConcluidos,
      ocorrenciasAbertas,
      fotosHoje,
      proximaAgenda,
      proximaAgendaStatus,
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
  }, [agenda, ambientes, checkins, checklist, fotos, ocorrencias, tarefas])

  const ambienteNome = ambienteId => ambientes.find(a => a.id === ambienteId)?.nome || 'Sem ambiente'
  const vistoriasAgenda = agenda.filter(item => norm(item.tipo || item.titulo).includes('vistoria'))

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
          <button className="md-logout" onClick={logout}>Sair</button>
        </header>
        <section className="md-empty-card">
          <strong>Nenhuma obra alocada</strong>
          <p>Aguarde seu supervisor vincular você a uma obra.</p>
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
          <button className="md-logout" onClick={logout}>Sair</button>
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

      <section className="md-obra-card">
        <div className="md-obra-head">
          <div>
            <span>{obraAtiva.status || 'Status não informado'}</span>
            <h2>{obraAtiva.nome || 'Obra sem nome'}</h2>
          </div>
          <strong>{obraAtiva.progresso || 0}%</strong>
        </div>
        <p>{[obraAtiva.cliente_nome, enderecoObra(obraAtiva)].filter(Boolean).join(' · ') || 'Endereço não informado'}</p>
        <div className="md-progress"><i style={{ width: `${obraAtiva.progresso || 0}%` }} /></div>
        <small>Previsão: {previsao ? dataBR(previsao) : 'não informada'}</small>
      </section>

      <section className={vm.emServico ? 'md-check-card active' : 'md-check-card'}>
        <div className="md-check-info">
          <span>{vm.emServico ? 'Em serviço' : 'Fora de serviço'}</span>
          <p>
            {vm.ultimoCheckin ? `${vm.emServico ? 'Entrada' : 'Último registro'} às ${horaBR(vm.ultimoCheckin.entrada || vm.ultimoCheckin.created_at)}` : 'Nenhum registro hoje'}
            {vm.ultimoCheckin?.latitude ? ' · localização registrada' : ''}
          </p>
          <p className="md-check-primary">
            {vm.emServico && vm.ultimoCheckin
              ? `Entrada registrada às ${horaBR(vm.ultimoCheckin.entrada || vm.ultimoCheckin.created_at)}`
              : vm.ultimoServico?.saida
                ? `Último serviço: ${horaBR(vm.ultimoServico.entrada || vm.ultimoServico.created_at)} às ${horaBR(vm.ultimoServico.saida)}`
                : 'Nenhum registro hoje'}
          </p>
          {vm.ultimoCheckin && <small>{localizacaoCheckin(vm.ultimoCheckin)}</small>}
          <small>Obra: {obraAtiva.nome || 'Obra ativa'}</small>
          {(servicoFeedback || vm.emServico) && (
            <div className="md-check-feedback">
              {servicoFeedback || 'Check-in registrado com localização.'}
            </div>
          )}
        </div>
        {vm.emServico ? (
          <button className="checkout" onClick={fazerCheckout} disabled={checkando}>{checkando ? '...' : 'Check-out'}</button>
        ) : (
          <button onClick={fazerCheckin} disabled={checkando}>{checkando ? '...' : 'Check-in'}</button>
        )}
      </section>

      <section className="md-today-card">
        <div className="md-card-head compact">
          <h2>Registro de hoje</h2>
        </div>
        {vm.registroHoje ? (
          <div className="md-today-row">
            <div>
              <strong>Entrada</strong>
              <span>{horaBR(vm.registroHoje.entrada || vm.registroHoje.created_at)}</span>
            </div>
            <div>
              <strong>Saída</strong>
              <span>{vm.registroHoje.saida ? horaBR(vm.registroHoje.saida) : 'Em serviço'}</span>
            </div>
            <p>{obraAtiva.nome || 'Obra ativa'} · {localizacaoCheckin(vm.registroHoje)}</p>
          </div>
        ) : (
          <div className="md-today-empty">Nenhum registro hoje.</div>
        )}
      </section>

      <section className="md-card">
        <div className="md-card-head">
          <h2>Próxima agenda</h2>
        </div>
        {vm.proximaAgenda ? (
          <div className="md-next">
            <div className="md-next-head">
              <strong>{tipoAgenda(vm.proximaAgenda)}</strong>
              <em className={`tone-${vm.proximaAgendaStatus?.tone || 'warn'}`}>{vm.proximaAgendaStatus?.label || 'Pendente'}</em>
            </div>
            <span>{vm.proximaAgenda.titulo || vm.proximaAgenda.observacao || vm.proximaAgenda.descricao || 'Compromisso da obra'}</span>
            <small>{dataBR(vm.proximaAgenda.data)}{vm.proximaAgenda.hora_inicio ? ` · ${vm.proximaAgenda.hora_inicio}` : ''}</small>
          </div>
        ) : (
          <Empty text="Nenhum compromisso futuro para esta obra." />
        )}
      </section>

      <section className="md-card">
        <div className="md-card-head">
          <h2>Fotos de vistoria</h2>
          <span>{vm.fotosVistoria.length}</span>
        </div>
        {vm.fotosVistoria.length === 0 ? (
          <Empty text="Nenhuma foto de vistoria vinculada ainda." />
        ) : (
          <>
            <p className="md-card-note">Referência visual para conferir acessos, ambientes e pontos de atenção antes da montagem.</p>
            <div className="md-photo-grid compact">
              {vm.fotosVistoria.slice(0, 6).map(foto => (
                <button key={foto.id} className="md-photo" onClick={() => foto.publicUrl && setPreview(foto.publicUrl)}>
                  {foto.publicUrl && <img src={foto.publicUrl} alt={foto.observacao || 'Foto de vistoria'} />}
                  <span>{ambienteNome(foto.ambiente_id)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="md-quick">
        <button onClick={() => scrollTo(fotosRef)}>Enviar foto</button>
        <button onClick={() => setModalProblema('Ocorrência geral')}>Relatar problema</button>
        <button onClick={() => scrollTo(checklistRef)}>Abrir checklist</button>
        <button onClick={() => scrollTo(tarefasRef)}>Ver tarefas</button>
      </section>

      <section className="md-summary">
        <Metric label="Tarefas" value={vm.tarefasAbertas.length} />
        <Metric label="Checklist" value={vm.checklistPendentes.length} />
        <Metric label="Fotos hoje" value={vm.fotosHoje.length} />
        <Metric label="Ocorrências" value={vm.ocorrenciasAbertas.length} danger={vm.ocorrenciasAbertas.length > 0} />
      </section>

      {loadingObra && <div className="md-loading-inline">Atualizando dados da obra...</div>}

      <section className="md-card" ref={tarefasRef}>
        <div className="md-card-head">
          <h2>Tarefas</h2>
          <span>{vm.tarefasAbertas.length}</span>
        </div>
        {vm.tarefasAbertas.length === 0 ? <Empty text="Nenhuma tarefa pendente." /> : vm.tarefasAbertas.map(tarefa => {
          const pr = PRIORIDADE[norm(tarefa.prioridade)] || { label: tarefa.prioridade || '', color: '#A79F93' }
          return (
            <article className="md-task" key={tarefa.id} style={{ borderLeftColor: pr.color }}>
              <div className="md-task-head">
                <strong>{tarefa.titulo || 'Tarefa sem título'}</strong>
                {pr.label && <span style={{ color: pr.color }}>{pr.label}</span>}
              </div>
              {tarefa.descricao && <p>{tarefa.descricao}</p>}
              {tarefa.prazo && <small>Prazo: {dataBR(tarefa.prazo)}</small>}
              <div className="md-status-row">
                {['pendente', 'em_andamento', 'concluida'].map(status => (
                  <button key={status} className={tarefa.status === status ? 'active' : ''} onClick={() => mudarStatus(tarefa.id, status)}>
                    {status === 'pendente' ? 'Pendente' : status === 'em_andamento' ? 'Em andamento' : 'Concluir'}
                  </button>
                ))}
              </div>
              <div className="md-two-actions">
                <button onClick={() => setModalProblema(tarefa)}>Relatar problema</button>
                <button className="ok" onClick={() => mudarStatus(tarefa.id, 'concluida')}>Concluir</button>
              </div>
            </article>
          )
        })}
      </section>

      <section className="md-card" ref={checklistRef}>
        <div className="md-card-head">
          <h2>Checklist por ambiente</h2>
          <span>{vm.pctChecklist}%</span>
        </div>
        <div className="md-progress soft"><i style={{ width: `${vm.pctChecklist}%` }} /></div>
        {checklist.length === 0 ? <Empty text="Nenhum item de checklist nesta obra." /> : vm.checklistGrupos.map(grupo => {
          const feitos = grupo.itens.filter(i => i.concluido).length
          const pct = grupo.itens.length ? Math.round((feitos / grupo.itens.length) * 100) : 0
          return (
            <article className="md-env" key={grupo.id}>
              <div className="md-env-head">
                <div>
                  <strong>{grupo.nome}</strong>
                  <small>{feitos} de {grupo.itens.length} itens</small>
                </div>
                <span>{pct}%</span>
              </div>
              <div className="md-progress soft"><i style={{ width: `${pct}%` }} /></div>
              {grupo.itens.length === 0 ? <Empty text="Nenhum item neste ambiente." /> : grupo.itens.map(item => (
                <button className={item.concluido ? 'md-check-item done' : 'md-check-item'} key={item.id} onClick={() => toggleChecklist(item)}>
                  <i>{item.concluido ? '✓' : ''}</i>
                  <span>{item.descricao}</span>
                </button>
              ))}
            </article>
          )
        })}
      </section>

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

      <section className="md-card">
        <div className="md-card-head">
          <h2>Histórico simples</h2>
        </div>
        {vm.historico.length === 0 ? <Empty text="Nenhuma movimentação recente." /> : vm.historico.map(item => (
          <div className="md-history" key={item.id}>
            <i />
            <div>
              <strong>{item.tipo}</strong>
              <span>{item.detalhe}</span>
            </div>
          </div>
        ))}
      </section>

      <nav className="md-bottom-nav" aria-label="Navegação do montador">
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><IconHome />Hoje</button>
        <button onClick={() => scrollTo(checklistRef)}><IconCheck />Checklist</button>
        <button onClick={() => scrollTo(fotosRef)}><IconCamera />Fotos</button>
        <button onClick={() => scrollTo(ocorrenciasRef)}><IconAlert />Ocorrências</button>
        <button onClick={() => scrollTo(perfilRef)}><IconUser />Perfil</button>
      </nav>
    </div>
  )
}

function Metric({ label, value, danger }) {
  return (
    <div className={danger ? 'md-metric danger' : 'md-metric'}>
      <strong>{value}</strong>
      <span>{label}</span>
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
.md-avatar{width:42px;height:42px;border-radius:999px;background:#fff;border:1px solid ${THEME.border};display:flex;align-items:center;justify-content:center;color:${THEME.gold};font-weight:800;flex-shrink:0}
.md-avatar.active{background:#EAF5EE;border-color:#C8E1D0;color:${THEME.success};box-shadow:0 0 0 4px rgba(45,122,74,.08)}
.md-logout{border:1px solid ${THEME.border};background:#fff;color:${THEME.muted};border-radius:10px;padding:10px 12px;font-size:12px;font-weight:800;cursor:pointer}
.md-field{margin-bottom:12px}
.md-field label{display:block;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:${THEME.gold};font-weight:800;margin-bottom:8px}
.md-field select,.md-upload select,.md-upload input{width:100%;box-sizing:border-box;border:1px solid ${THEME.border};background:#fff;border-radius:12px;padding:12px 13px;font-family:inherit;font-size:14px;color:${THEME.ink}}
.md-obra-card{background:${THEME.ink};color:#fff;border-radius:18px;padding:18px;margin-bottom:12px;box-shadow:0 16px 34px rgba(29,28,25,.12)}
.md-obra-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
.md-obra-head span{display:inline-block;font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:${THEME.gold};font-weight:800;margin-bottom:7px}
.md-obra-head h2{font-family:var(--font-serif);font-size:22px;line-height:1.12;margin:0;font-weight:500}
.md-obra-head strong{font-size:26px;color:${THEME.gold};line-height:1}
.md-obra-card p{font-size:12px;line-height:1.45;color:#D7CABA;margin:10px 0 12px}
.md-obra-card small{display:block;font-size:11px;color:#BDB0A0;margin-top:10px}
.md-progress{height:7px;background:rgba(255,255,255,.16);border-radius:999px;overflow:hidden}
.md-progress i{display:block;height:100%;background:${THEME.gold};border-radius:999px}
.md-progress.soft{background:${THEME.border};margin:10px 0 14px}
.md-check-card{background:#fff;border:1px solid ${THEME.border};border-radius:18px;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.md-check-card.active{background:#F1FAF4;border-color:#C8E1D0}
.md-check-card span{display:block;font-size:15px;font-weight:800;color:${THEME.ink};margin-bottom:3px}
.md-check-card p{margin:0;font-size:11.5px;color:${THEME.muted};line-height:1.4}
.md-check-info{min-width:0}
.md-check-info>p:not(.md-check-primary){display:none}
.md-check-primary{font-size:12px!important;color:${THEME.ink}!important;font-weight:800!important;margin-bottom:5px!important}
.md-check-info small{display:block;font-size:11px;color:${THEME.muted};line-height:1.35;margin-top:3px}
.md-check-feedback{display:inline-flex;margin-top:8px;background:#EAF5EE;color:${THEME.success};border:1px solid #C8E1D0;border-radius:999px;padding:6px 9px;font-size:11px;font-weight:900;line-height:1.1}
.md-check-card button{border:0;background:${THEME.ink};color:#fff;border-radius:14px;padding:15px 18px;min-width:118px;font-size:15px;font-weight:900;cursor:pointer}
.md-check-card button.checkout{background:${THEME.danger}}
.md-today-card{background:#fff;border:1px solid ${THEME.border};border-radius:18px;padding:14px;margin-bottom:12px;box-shadow:0 10px 26px rgba(29,28,25,.04)}
.md-card-head.compact{margin-bottom:9px}
.md-today-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.md-today-row div{background:#FFFEFC;border:1px solid ${THEME.border};border-radius:13px;padding:10px}
.md-today-row strong{display:block;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:${THEME.gold};font-weight:900;margin-bottom:5px}
.md-today-row span{display:block;font-size:15px;color:${THEME.ink};font-weight:900}
.md-today-row p{grid-column:1/-1;margin:0;color:${THEME.muted};font-size:12px;line-height:1.35}
.md-today-empty{color:${THEME.muted};font-size:12.5px;padding:2px 0}
.md-card{background:#fff;border:1px solid ${THEME.border};border-radius:18px;padding:16px 15px;margin-bottom:12px;box-shadow:0 10px 26px rgba(29,28,25,.04);scroll-margin-top:14px}
.md-card-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}
.md-card-head h2{font-size:15px;margin:0;font-weight:900;color:${THEME.ink}}
.md-card-head span{font-size:12px;color:${THEME.gold};font-weight:900}
.md-card-head button{border:0;background:transparent;color:${THEME.gold};font-size:12px;font-weight:900;cursor:pointer}
.md-card-note{margin:-3px 0 12px;color:${THEME.muted};font-size:12.5px;line-height:1.45}
.md-next-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:5px}
.md-next strong{display:block;font-size:16px;color:${THEME.ink};margin-bottom:0}
.md-next em{font-style:normal;border-radius:999px;padding:5px 8px;font-size:10.5px;font-weight:900;white-space:nowrap}
.md-next em.tone-success{background:#EAF5EE;color:${THEME.success}}
.md-next em.tone-info{background:#EEF5FB;color:#1E5A8A}
.md-next em.tone-warn{background:#FFF4E5;color:${THEME.warn}}
.md-next em.tone-danger{background:#FFF1F1;color:${THEME.danger}}
.md-next span{display:block;font-size:13px;color:${THEME.muted};line-height:1.4}
.md-next small{display:block;font-size:12px;color:${THEME.gold};font-weight:800;margin-top:8px}
.md-quick{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:12px}
.md-quick button{border:1px solid ${THEME.border};background:#fff;color:${THEME.ink};border-radius:14px;padding:14px 10px;font-size:13px;font-weight:900;cursor:pointer}
.md-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
.md-metric{background:#fff;border:1px solid ${THEME.border};border-radius:14px;padding:12px 8px;text-align:center}
.md-metric.danger{border-color:#F0C8C8;background:#FFF8F8}
.md-metric strong{display:block;font-size:22px;line-height:1;color:${THEME.ink}}
.md-metric.danger strong{color:${THEME.danger}}
.md-metric span{display:block;font-size:10.5px;color:${THEME.muted};margin-top:5px}
.md-task{border:1px solid ${THEME.border};border-left:4px solid ${THEME.gold};border-radius:15px;padding:14px;margin-bottom:10px;background:#FFFEFC}
.md-task-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.md-task-head strong{font-size:14px;color:${THEME.ink}}
.md-task-head span{font-size:10px;letter-spacing:.8px;text-transform:uppercase;font-weight:900}
.md-task p{font-size:12.5px;line-height:1.45;color:${THEME.muted};margin:8px 0}
.md-task small{display:block;font-size:11px;color:${THEME.muted};margin-top:7px}
.md-status-row,.md-two-actions{display:flex;gap:7px;margin-top:12px}
.md-status-row button,.md-two-actions button{flex:1;border:0;border-radius:10px;padding:11px 6px;font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer;background:#F5F1EA;color:${THEME.muted}}
.md-status-row button.active{background:${THEME.ink};color:#fff}
.md-two-actions button{background:#FFF4E5;color:${THEME.warn}}
.md-two-actions button.ok{background:#EAF5EE;color:${THEME.success}}
.md-env{border:1px solid ${THEME.border};border-radius:15px;padding:13px;margin-top:12px;background:#FFFEFC}
.md-env-head{display:flex;justify-content:space-between;gap:10px}
.md-env-head strong{font-size:14px;color:${THEME.ink}}
.md-env-head small{display:block;font-size:11px;color:${THEME.muted};margin-top:3px}
.md-env-head span{font-size:12px;color:${THEME.gold};font-weight:900}
.md-check-item{width:100%;border:1px solid ${THEME.border};background:#fff;border-radius:13px;padding:13px;display:flex;align-items:center;gap:11px;text-align:left;margin-top:8px;font-family:inherit;cursor:pointer}
.md-check-item.done{background:#F4FBF6;border-color:#C8E1D0}
.md-check-item i{width:23px;height:23px;border-radius:7px;border:2px solid ${THEME.border};display:flex;align-items:center;justify-content:center;font-style:normal;font-size:13px;font-weight:900;flex-shrink:0}
.md-check-item.done i{background:${THEME.success};border-color:${THEME.success};color:#fff}
.md-check-item span{font-size:14px;color:${THEME.ink};line-height:1.35}
.md-check-item.done span{color:#9A938A;text-decoration:line-through}
.md-upload{display:flex;flex-direction:column;gap:9px;margin-bottom:14px}
.md-file{display:block;background:${THEME.ink};color:#fff;border-radius:14px;padding:15px;text-align:center;font-size:14px;font-weight:900;cursor:pointer}
.md-file.disabled{opacity:.52}
.md-file input{display:none}
.md-photo-group{margin-top:16px}
.md-photo-group h3{font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:${THEME.gold};font-weight:900;margin:0 0 9px}
.md-photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.md-photo-grid.compact{margin-top:4px}
.md-photo{position:relative;aspect-ratio:1;border:0;border-radius:13px;overflow:hidden;background:#F0ECE6;padding:0;cursor:pointer}
.md-photo img{width:100%;height:100%;object-fit:cover;display:block}
.md-photo span{position:absolute;left:5px;right:5px;bottom:5px;background:rgba(29,28,25,.72);color:#fff;border-radius:8px;padding:4px 5px;font-size:9px;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.md-occ{border:1px solid ${THEME.border};border-radius:14px;padding:12px;margin-bottom:9px;background:#FFFEFC}
.md-occ strong{font-size:13.5px;color:${THEME.ink}}
.md-occ p{font-size:12px;color:${THEME.muted};line-height:1.4;margin:6px 0}
.md-occ small{font-size:11px;color:${THEME.gold};font-weight:800}
.md-history{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid ${THEME.border}}
.md-history:last-child{border-bottom:0}
.md-history i{width:8px;height:8px;border-radius:999px;background:${THEME.gold};margin-top:5px;flex-shrink:0}
.md-history strong{display:block;font-size:13px;color:${THEME.ink}}
.md-history span{display:block;font-size:11.5px;color:${THEME.muted};margin-top:2px;line-height:1.3}
.md-empty{padding:20px 0;text-align:center;color:#A79F93;font-size:13px}
.md-empty-card{background:#fff;border:1px solid ${THEME.border};border-radius:18px;padding:28px 18px;text-align:center;margin-top:28px}
.md-empty-card strong{display:block;font-size:18px;color:${THEME.ink};margin-bottom:8px}
.md-empty-card p{margin:0;color:${THEME.muted};font-size:13px;line-height:1.45}
.md-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:${THEME.ink};color:#fff;border-left:3px solid ${THEME.gold};border-radius:13px;padding:12px 18px;font-size:13px;font-weight:800;z-index:1000;white-space:nowrap;max-width:calc(100vw - 28px);box-sizing:border-box}
.md-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:800;display:flex;align-items:flex-end;justify-content:center;padding:14px}
.md-modal{width:100%;max-width:500px;background:#fff;border-radius:18px;padding:20px;box-sizing:border-box}
.md-modal h2{font-family:var(--font-serif);font-size:22px;font-weight:500;margin:0 0 5px;color:${THEME.ink}}
.md-modal p{font-size:13px;color:${THEME.muted};margin:0 0 14px}
.md-modal textarea{width:100%;box-sizing:border-box;border:1px solid ${THEME.border};border-radius:13px;padding:12px;font-family:inherit;font-size:14px;resize:none;color:${THEME.ink}}
.md-modal-actions{display:flex;gap:9px;justify-content:flex-end;margin-top:12px}
.md-modal-actions button{border:1px solid ${THEME.border};background:#fff;border-radius:12px;padding:11px 14px;font-weight:800;color:${THEME.muted};cursor:pointer}
.md-modal-actions button.danger{border-color:${THEME.danger};background:${THEME.danger};color:#fff}
.md-preview{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:900;display:flex;align-items:center;justify-content:center;padding:12px;cursor:pointer}
.md-preview img{max-width:100%;max-height:92vh;border-radius:12px;object-fit:contain}
.md-bottom-nav{position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:700;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;background:rgba(255,254,252,.96);border:1px solid ${THEME.border};border-radius:18px;padding:7px;box-shadow:0 18px 42px rgba(29,28,25,.18);backdrop-filter:blur(18px);max-width:500px;margin:0 auto}
.md-bottom-nav button{border:0;background:transparent;color:${THEME.muted};border-radius:13px;min-height:54px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:9.5px;font-weight:900;cursor:pointer}
.md-bottom-nav button:first-child{background:${THEME.ink};color:#fff}
.md-bottom-nav svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;color:${THEME.gold}}
.md-bottom-nav button:first-child svg{color:#fff}
@media (min-width:720px){.md-page{max-width:680px;padding:26px 20px calc(112px + env(safe-area-inset-bottom))}.md-summary{grid-template-columns:repeat(4,1fr)}.md-quick{grid-template-columns:repeat(4,1fr)}}
`
