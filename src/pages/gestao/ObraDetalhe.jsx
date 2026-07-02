import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { tarefasService } from '../../services/tarefasService'
import { aplicarBibliotecaChecklist } from '../../services/checklistService'
import { exportarRelatorioObra } from '../../services/pdfService'
import { progressBarStyle, progressFillStyle, statusBadgeBaseStyle } from '../../utils/ui'
import { FASES_ORNARE, faseOrnarePorKey, faseOrnarePorTexto, indiceFaseOrnare } from '../../constants/fasesOrnare'
import { theme } from '../../constants/theme'

const ST = {
  'Em montagem':         { label: 'Em montagem',        bg: '#edf7f0', color: '#3a7d4f' },
  'Em andamento':        { label: 'Em andamento',        bg: '#edf7f0', color: '#3a7d4f' },
  'Concluida':           { label: 'Concluída',           bg: '#eef2f8', color: '#3a5580' },
  'Concluída':           { label: 'Concluída',           bg: '#eef2f8', color: '#3a5580' },
  'Pausada':             { label: 'Pausada',             bg: '#fdf3e3', color: '#a0692a' },
  'Cancelada':           { label: 'Cancelada',           bg: '#fdecea', color: '#a03030' },
  'Planejamento':        { label: 'Planejamento',        bg: '#f5f0ff', color: '#6040a0' },
  'Aguardando inicio':   { label: 'Ag. início',          bg: '#f5f5f5', color: '#616161' },
  'Aguardando início':   { label: 'Ag. início',          bg: '#f5f5f5', color: '#616161' },
  'Montagem agendada':   { label: 'Mont. agendada',      bg: '#E3F2FD', color: '#1565C0' },
  'Em producao':         { label: 'Em produção',         bg: '#EFF4FA', color: '#1E3A5F' },
  'Em produção':         { label: 'Em produção',         bg: '#EFF4FA', color: '#1E3A5F' },
  'Aguardando montagem': { label: 'Ag. montagem',        bg: '#FFF3E0', color: '#E65100' },
  'Vistoria final':      { label: 'Vistoria final',      bg: '#F3E5F5', color: '#6A1B9A' },
  'Pronta para entrega': { label: 'Pronta p/ entrega',   bg: '#E8F5E9', color: '#2E7D32' },
}

const STATUS_TAREFA = {
  pendente:     { label: 'Pendente',     color: '#b09a7a' },
  em_andamento: { label: 'Em andamento', color: '#4a90d9' },
  concluida:    { label: 'Concluída',    color: '#5aab6e' },
  bloqueada:    { label: 'Bloqueada',    color: '#d94a4a' },
}
const PRIORIDADE = {
  baixa: { label: 'Baixa', color: '#aaa' },
  media: { label: 'Média', color: '#b09a7a' },
  alta:  { label: 'Alta',  color: '#d94a4a' },
}

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const STATUS_LIST = [
  'Aguardando início','Medição agendada','Em medição','Projeto em conferência',
  'Em produção','Pronta para entrega','Aguardando montagem','Montagem agendada',
  'Em montagem','Pausada','Vistoria final','Concluída','Cancelada',
]
const APROVACOES_CRONOGRAMA = ['pendente', 'aprovado', 'reprovado', 'nao_se_aplica']
const PRIORIDADES_CRONOGRAMA = ['baixa', 'media', 'alta']
const RISCOS_CRONOGRAMA = ['baixo', 'medio', 'alto']
const SECOES = [
  { id: 'Resumo', label: 'Resumo' },
  { id: 'Cliente', label: 'Cliente' },
  { id: 'Endereco', label: 'Endereço' },
  { id: 'Contrato', label: 'Contrato' },
  { id: 'Cronograma', label: 'Cronograma' },
  { id: 'Equipe', label: 'Equipe' },
  { id: 'Agenda', label: 'Agenda' },
  { id: 'Fotos', label: 'Fotos' },
  { id: 'Checklist', label: 'Checklist' },
  { id: 'Gastos', label: 'Gastos' },
  { id: 'Ocorrencias', label: 'Ocorrências' },
  { id: 'Historico', label: 'Histórico' },
]

const THEME = {
  bg: theme.background,
  card: theme.surface,
  border: theme.border,
  ink: theme.textPrimary,
  muted: theme.textSecondary,
  gold: theme.gold,
  softGold: 'rgba(201,168,76,.16)',
  danger: theme.error,
  success: theme.success,
  warning: theme.warning,
  successBg: theme.statusBg.success,
  warningBg: theme.statusBg.warning,
  dangerBg: theme.statusBg.danger,
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

const FASES_BIBLIOTECA = ['Pré-Montagem', 'Montagem', 'Pós-Montagem', 'Supervisor', 'Entrega', 'Pós-Venda', 'Assistência Técnica', 'Garantia']

function fotoUrl(foto) {
  if (foto.url) return foto.url
  if (!foto.storage_path) return ''
  return supabase.storage.from('fotos-obras').getPublicUrl(foto.storage_path).data.publicUrl
}

function mensagemErro(error, fallback = 'Não foi possível concluir a operação.') {
  return error?.message || error?.details || fallback
}

function rolarParaDestaque(id) {
  if (!id) return
  window.setTimeout(() => {
    document.querySelector(`[data-destaque-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 120)
}

function fotoAprovadaParaCliente(foto) {
  return Boolean(foto?.aprovada && foto?.aprovada_gestao)
}

async function criarNotificacoesObra({ obraId, tipo, titulo, descricao, prioridade = 'normal', entidadeTipo, entidadeId, rota, excluirUsuarioId }) {
  if (!obraId || !titulo) return
  try {
    const [{ data: obra }, { data: profiles }] = await Promise.all([
      supabase.from('obras').select('id, supervisor_id, comercial_id').eq('id', obraId).maybeSingle(),
      supabase.from('profiles').select('id, role').in('role', ['gestao', 'pos_venda', 'vendedor', 'supervisor']),
    ])
    const destinatarios = new Set([obra?.supervisor_id, obra?.comercial_id].filter(Boolean))
    ;(profiles || []).forEach(profile => {
      if (profile?.id && ['gestao', 'pos_venda', 'vendedor'].includes(profile.role)) destinatarios.add(profile.id)
    })
    if (excluirUsuarioId) destinatarios.delete(excluirUsuarioId)

    const registros = [...destinatarios].map(usuario_id => ({
      usuario_id,
      obra_id: obraId,
      tipo,
      titulo,
      descricao,
      prioridade,
      status: 'nao_lida',
      rota,
      entidade_tipo: entidadeTipo,
      entidade_id: entidadeId || null,
    }))

    if (registros.length) {
      const { error } = await supabase.from('notificacoes').insert(registros)
      if (error) console.error('Erro ao criar notificações da obra:', error)
    }
  } catch (error) {
    console.error('Erro ao preparar notificações da obra:', error)
  }
}

const textareaStyle = {
  background: THEME.inputBackground,
  border: '1px solid ' + THEME.inputBorder,
  color: THEME.inputText,
  borderRadius: 8,
  padding: '10px 14px',
  width: '100%',
  fontSize: 14,
  resize: 'vertical',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  outline: 'none',
}

function acaoBtn(primary, active = false) {
  return {
    background: primary ? (active ? '#fdecea' : THEME.elevated) : THEME.elevated,
    color: primary ? (active ? THEME.danger : THEME.ink) : THEME.ink,
    border: `1px solid ${THEME.border}`,
    borderRadius: 10,
    padding: '9px 14px',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  }
}

export default function ObraDetalhe() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const location    = useLocation()

  const [obra,      setObra]      = useState(null)
  const [aba,       setAba]       = useState('Resumo')
  const [loading,   setLoading]   = useState(true)
  const [tarefas,   setTarefas]   = useState([])
  const [profiles,  setProfiles]  = useState([])
  const [resumo,    setResumo]    = useState({ gastos: 0, tarefasAbertas: 0, agenda: 0, fotos: 0, ocorrencias: 0, equipe: 0, checklistPendentes: 0 })
  const [progresso, setProgresso] = useState(0)
  const [showForm,  setShowForm]  = useState(false)
  const [salvando,  setSalvando]  = useState(false)
  const [editando,  setEditando]  = useState(false)
  const [tipoPdf,   setTipoPdf]   = useState('executivo')
  const [exportandoPdf, setExportandoPdf] = useState(false)
  const [formObra,  setFormObra]  = useState({})
  const [toast,     setToast]     = useState({ msg: '', tipo: 'ok' })
  const [nova, setNova] = useState({ titulo: '', descricao: '', prioridade: 'media', prazo: '', responsavel_id: '', status: 'pendente' })

  const [compacto, setCompacto] = useState(false)
  const paramsUrl = new URLSearchParams(location.search)
  const fotoDestaque = paramsUrl.get('foto')
  const ocorrenciaDestaque = paramsUrl.get('ocorrencia')
  const checklistDestaque = paramsUrl.get('checklist')
  const gastoDestaque = paramsUrl.get('gasto')
  const cronogramaDestaque = paramsUrl.get('cronograma')
  const agendaDestaque = paramsUrl.get('compromisso')

  const mostrarToast = useCallback((msg, tipo = 'ok') => {
    setToast({ msg, tipo })
    window.setTimeout(() => setToast({ msg: '', tipo: 'ok' }), 3200)
  }, [])

  useEffect(() => {
    const abaUrl = new URLSearchParams(location.search).get('aba')
    if (!abaUrl || !SECOES.some(secao => secao.id === abaUrl)) return undefined
    const timer = setTimeout(() => setAba(abaUrl), 0)
    return () => clearTimeout(timer)
  }, [location.search])

  const carregarObra = useCallback(async () => {
    const { data, error } = await supabase.from('obras').select('*').eq('id', id).single()
    if (error) {
      mostrarToast(mensagemErro(error, 'Nao foi possivel carregar os dados da obra.'), 'erro')
      setObra(null)
      setLoading(false)
      return
    }
    setObra(data); setFormObra(data || {}); setLoading(false)
  }, [id, mostrarToast])

  const carregarProfiles = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('id, full_name, email, role')
    if (error) {
      mostrarToast(mensagemErro(error, 'Nao foi possivel carregar a equipe.'), 'erro')
      setProfiles([])
      return
    }
    setProfiles(data || [])
  }, [mostrarToast])

  const carregarTarefas = useCallback(async () => {
    const data = await tarefasService.listarPorObra(id)
    setTarefas(data || [])
    const p = await tarefasService.calcularProgresso(id)
    setProgresso(p)
  }, [id])

  const carregarResumo = useCallback(async () => {
    const [gastosResult, tarefasResult, agendaResult, fotosResult, ocorrenciasResult, equipeResult, checklistResult] = await Promise.all([
      supabase.from('gastos').select('valor').eq('obra_id', id),
      supabase.from('tarefas').select('id, status').eq('obra_id', id),
      supabase.from('agenda').select('id').eq('obra_id', id),
      supabase.from('fotos').select('id').eq('obra_id', id),
      supabase.from('ocorrencias').select('id').eq('obra_id', id),
      supabase.from('obra_montadores').select('montador_id').eq('obra_id', id),
      supabase.from('checklist_items').select('id, concluido').eq('obra_id', id),
    ])
    const falhaResumo = [gastosResult, tarefasResult, agendaResult, fotosResult, ocorrenciasResult, equipeResult, checklistResult].find(result => result.error)
    if (falhaResumo?.error) {
      mostrarToast(mensagemErro(falhaResumo.error, 'Parte do resumo operacional nao foi carregada.'), 'erro')
    }
    const gs = gastosResult.data || []
    const ts = tarefasResult.data || []
    const ag = agendaResult.data || []
    const fotos = fotosResult.data || []
    const ocorrencias = ocorrenciasResult.data || []
    const equipe = equipeResult.data || []
    const checklist = checklistResult.data || []
    const totalGastos = (gs || []).reduce((s, g) => s + (parseFloat(g.valor) || 0), 0)
    const abertas = (ts || []).filter(t => t.status !== 'concluida').length
    const checklistPendentes = (checklist || []).filter(i => !i.concluido).length
    setResumo({
      gastos: totalGastos,
      tarefasAbertas: abertas,
      agenda: (ag || []).length,
      fotos: (fotos || []).length,
      ocorrencias: (ocorrencias || []).length,
      equipe: (equipe || []).length,
      checklistPendentes,
    })
  }, [id, mostrarToast])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregarObra(); carregarProfiles(); carregarResumo() }, [carregarObra, carregarProfiles, carregarResumo])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (aba === 'Tarefas') carregarTarefas() }, [aba, carregarTarefas])
  useEffect(() => {
    function check() { setCompacto(window.innerWidth < 760) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  async function salvarTarefa() {
    if (!nova.titulo.trim()) return
    setSalvando(true)
    await tarefasService.criar({ ...nova, obra_id: id, responsavel_id: nova.responsavel_id || null, prazo: nova.prazo || null })
    setNova({ titulo: '', descricao: '', prioridade: 'media', prazo: '', responsavel_id: '', status: 'pendente' })
    setShowForm(false)
    await carregarTarefas()
    setSalvando(false)
  }
  async function mudarStatus(tarefaId, status) {
    await tarefasService.atualizarStatus(tarefaId, status)
    await carregarTarefas()
  }

  async function salvarEdicaoObra() {
    setSalvando(true)
    const { error } = await supabase.from('obras').update({
      nome:               formObra.nome,
      numero_contrato:    formObra.numero_contrato    || null,
      pedido_ornare:      formObra.pedido_ornare      || null,
      status:             formObra.status,
      progresso:          parseInt(formObra.progresso) || 0,
      data_inicio:        formObra.data_inicio        || null,
      data_previsao:      formObra.data_previsao      || null,
      observacoes:        formObra.observacoes        || null,
      gasto_meta:         (formObra.gasto_meta !== '' && formObra.gasto_meta !== null && formObra.gasto_meta !== undefined) ? parseFloat(String(formObra.gasto_meta).replace(',','.')) : null,
      valor_contrato:     formObra.valor_contrato     ? parseFloat(formObra.valor_contrato): null,
      cliente_nome:       formObra.cliente_nome       || null,
      cliente_email:      formObra.cliente_email      || null,
      cliente_telefone:   formObra.cliente_telefone   || null,
      rua:                formObra.rua                || null,
      numero:             formObra.numero             || null,
      complemento:        formObra.complemento        || null,
      bairro:             formObra.bairro             || null,
      cidade:             formObra.cidade             || null,
      uf:                 formObra.uf                 || null,
      cep:                formObra.cep                || null,
      supervisor_id:      formObra.supervisor_id      || null,
      comercial_id:       formObra.comercial_id       || null,
      executivista_nome:  formObra.executivista_nome  || null,
      comercial_nome:     formObra.comercial_nome     || null,
      arquiteto_nome:     formObra.arquiteto_nome     || null,
      arquiteto_email:    formObra.arquiteto_email    || null,
      arquiteto_telefone: formObra.arquiteto_telefone || null,
    }).eq('id', id)

    if (error) {
      mostrarToast('Erro ao salvar: ' + error.message, 'erro')
    } else {
      await carregarObra()
      await carregarResumo()
      setEditando(false)
      mostrarToast('Obra atualizada com sucesso.')
    }
    setSalvando(false)
  }

  async function gerarPdf() {
    setExportandoPdf(true)
    try {
      await exportarRelatorioObra(id, tipoPdf)
      mostrarToast('PDF gerado com sucesso.')
    } catch (error) {
      mostrarToast('Erro ao gerar PDF: ' + (error.message || 'falha inesperada'), 'erro')
    }
    setExportandoPdf(false)
  }

  if (loading) return <div style={{ minHeight: '100vh', padding: 60, color: THEME.muted, textAlign: 'center', background: THEME.bg }}>Carregando...</div>
  if (!obra)   return <div style={{ minHeight: '100vh', padding: 60, color: THEME.muted, background: THEME.bg }}>Obra nao encontrada.</div>

  const st = ST[obra.status] || { label: obra.status, bg: '#f0ece6', color: '#888' }
  const supervisores = profiles.filter(p => ['gestao','supervisor'].includes(p.role))
  const progressoObra = obra.progresso || progresso || 0
  const localizacao = [obra.cidade, obra.uf].filter(Boolean).join(' / ')
  const contrato = obra.numero_contrato || obra.pedido_ornare || '-'
  const previsao = obra.data_previsao ? new Date(obra.data_previsao + 'T00:00:00').toLocaleDateString('pt-BR') : '-'
  const supervisorNome = profiles.find(p => p.id === obra.supervisor_id)?.full_name
  const comercialNome = profiles.find(p => p.id === obra.comercial_id)?.full_name || obra.comercial_nome

  return (
    <div style={{ minHeight: '100vh', background: THEME.bg, padding: compacto ? '18px 14px 40px' : '32px 40px 56px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>

      {/* Toast */}
      {toast.msg && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: toast.tipo === 'erro' ? '#fdecea' : THEME.ink, color: toast.tipo === 'erro' ? '#a03030' : '#fff', padding: '12px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, borderLeft: '3px solid ' + (toast.tipo === 'erro' ? '#d94a4a' : THEME.gold), zIndex: 2000, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.18)' }}>
          {toast.msg}
        </div>
      )}

      <button onClick={() => navigate('/obras')} style={{ background: 'none', border: 'none', fontSize: 13, color: THEME.muted, cursor: 'pointer', padding: 0, marginBottom: 16, fontFamily: 'inherit' }}>
        Voltar para obras
      </button>

      <section style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 18, padding: compacto ? 18 : 26, marginBottom: 18, boxShadow: '0 20px 45px rgba(29,28,25,0.07)', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: compacto ? 'stretch' : 'flex-start', gap: 18, flexDirection: compacto ? 'column' : 'row' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: THEME.gold, textTransform: 'uppercase', marginBottom: 8, fontWeight: 700 }}>Detalhe da obra</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: compacto ? 28 : 40, lineHeight: 1.05, fontWeight: 500, color: THEME.ink, margin: 0, wordBreak: 'break-word' }}>{obra.nome}</h1>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12, fontSize: 13, color: THEME.muted }}>
              <span>{obra.cliente_nome || 'Cliente nao informado'}</span>
              {localizacao && <span>{localizacao}</span>}
              <span>Contrato {contrato}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: compacto ? 'stretch' : 'flex-end', gap: 12 }}>
            <span style={{ ...statusBadgeBaseStyle, alignSelf: compacto ? 'flex-start' : 'flex-end', background: st.bg, color: st.color, fontSize: 12, padding: '7px 14px' }}>{st.label}</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: compacto ? 'flex-start' : 'flex-end' }}>
              <button onClick={() => { setAba('Tarefas'); carregarTarefas() }} style={acaoBtn(false)}>Tarefas</button>
              <button onClick={() => setAba('Fotos')} style={acaoBtn(false)}>Fotos</button>
              <button onClick={() => setAba('Chat')} style={acaoBtn(false)}>Chat</button>
              <select value={tipoPdf} onChange={e => setTipoPdf(e.target.value)} style={{ background: THEME.inputBackground, border: '1px solid ' + THEME.inputBorder, color: THEME.inputText, borderRadius: 8, padding: '10px 14px', width: '100%', fontSize: 14, outline: 'none', fontWeight: 700, fontFamily: 'inherit' }}>
                <option value="executivo">Executivo</option>
                <option value="operacional">Operacional</option>
                <option value="cliente">Cliente</option>
              </select>
              <button onClick={gerarPdf} disabled={exportandoPdf} style={acaoBtn(false)}>
                {exportandoPdf ? 'Gerando...' : 'Exportar PDF'}
              </button>
              <button onClick={() => { setEditando(!editando); setFormObra(obra) }} style={acaoBtn(true, editando)}>
                {editando ? 'Cancelar edição' : 'Editar'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Breadcrumb */}
      <button onClick={() => navigate('/obras')} style={{ display: 'none', background: 'none', border: 'none', fontSize: 12, color: 'var(--color-ink-muted)', cursor: 'pointer', padding: 0, marginBottom: 16 }}>
        ← Obras
      </button>

      {/* Header */}
      <div style={{ display: 'none', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 6 }}>Detalhe da Obra</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 500, color: 'var(--color-ink)', margin: 0 }}>{obra.nome}</h1>
          <div style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 4 }}>
            {obra.cliente_nome}
            {obra.cidade          ? ' · ' + obra.cidade               : ''}
            {obra.numero_contrato ? ' · Contrato ' + obra.numero_contrato : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ padding: '5px 14px', borderRadius: 20, background: st.bg, color: st.color, fontSize: 12, fontWeight: 500 }}>{st.label}</span>
          <button onClick={() => { setEditando(!editando); setFormObra(obra) }} style={{ background: editando ? '#fdecea' : 'var(--color-ink)', color: editando ? '#a03030' : '#f9f7f4', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}>
            {editando ? 'Cancelar edição' : 'Editar obra'}
          </button>
        </div>
      </div>

      {/* ── FORM EDICAO COMPLETO ── */}
      {editando && (
        <div style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderLeft: `4px solid ${THEME.gold}`, borderRadius: 16, padding: compacto ? 18 : 26, marginBottom: 24, marginTop: 16, boxShadow: '0 16px 36px rgba(29,28,25,0.05)' }}>

          <SecaoEdit titulo="Identificacao">
            <GridEdit>
              <CampoEdit label="Nome da obra" full>
                <FInput value={formObra.nome || ''} onChange={v => setFormObra(p => ({ ...p, nome: v }))} />
              </CampoEdit>
              <CampoEdit label="Status">
                <FSelect value={formObra.status || ''} onChange={v => setFormObra(p => ({ ...p, status: v }))}>
                  {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                </FSelect>
              </CampoEdit>
              <CampoEdit label="Progresso (%)">
                <FInput type="number" min="0" max="100" value={formObra.progresso || 0} onChange={v => setFormObra(p => ({ ...p, progresso: v }))} />
              </CampoEdit>
              <CampoEdit label="Número do contrato">
                <FInput value={formObra.numero_contrato || ''} onChange={v => setFormObra(p => ({ ...p, numero_contrato: v }))} placeholder="Ex: 078/2026" />
              </CampoEdit>
              <CampoEdit label="Pedido Ornare">
                <FInput value={formObra.pedido_ornare || ''} onChange={v => setFormObra(p => ({ ...p, pedido_ornare: v }))} placeholder="Ex: PED-2026-001" />
              </CampoEdit>
              <CampoEdit label="Data de início">
                <FInput type="date" value={formObra.data_inicio || ''} onChange={v => setFormObra(p => ({ ...p, data_inicio: v }))} />
              </CampoEdit>
              <CampoEdit label="Previsão de término">
                <FInput type="date" value={formObra.data_previsao || ''} onChange={v => setFormObra(p => ({ ...p, data_previsao: v }))} />
              </CampoEdit>
              <CampoEdit label="Valor do contrato (R$)">
                <FInput type="number" value={formObra.valor_contrato || ''} onChange={v => setFormObra(p => ({ ...p, valor_contrato: v }))} placeholder="0,00" />
              </CampoEdit>
              <CampoEdit label="Gasto meta (R$)">
                <FInput type="number" value={formObra.gasto_meta || ''} onChange={v => setFormObra(p => ({ ...p, gasto_meta: v }))} placeholder="0,00" />
              </CampoEdit>
            </GridEdit>
          </SecaoEdit>

          <SecaoEdit titulo="Cliente">
            <GridEdit>
              <CampoEdit label="Nome do cliente" full>
                <FInput value={formObra.cliente_nome || ''} onChange={v => setFormObra(p => ({ ...p, cliente_nome: v }))} />
              </CampoEdit>
              <CampoEdit label="E-mail">
                <FInput type="email" value={formObra.cliente_email || ''} onChange={v => setFormObra(p => ({ ...p, cliente_email: v }))} placeholder="email@exemplo.com" />
              </CampoEdit>
              <CampoEdit label="Telefone">
                <FInput value={formObra.cliente_telefone || ''} onChange={v => setFormObra(p => ({ ...p, cliente_telefone: v }))} placeholder="(48) 99999-9999" />
              </CampoEdit>
            </GridEdit>
          </SecaoEdit>

          <SecaoEdit titulo="Endereço">
            <GridEdit>
              <CampoEdit label="CEP">
                <FInput value={formObra.cep || ''} onChange={v => setFormObra(p => ({ ...p, cep: v }))} placeholder="00000-000" />
              </CampoEdit>
              <CampoEdit label="Rua / Logradouro">
                <FInput value={formObra.rua || ''} onChange={v => setFormObra(p => ({ ...p, rua: v }))} />
              </CampoEdit>
              <CampoEdit label="Numero">
                <FInput value={formObra.numero || ''} onChange={v => setFormObra(p => ({ ...p, numero: v }))} />
              </CampoEdit>
              <CampoEdit label="Complemento">
                <FInput value={formObra.complemento || ''} onChange={v => setFormObra(p => ({ ...p, complemento: v }))} placeholder="Apto, Bloco..." />
              </CampoEdit>
              <CampoEdit label="Bairro">
                <FInput value={formObra.bairro || ''} onChange={v => setFormObra(p => ({ ...p, bairro: v }))} />
              </CampoEdit>
              <CampoEdit label="Cidade">
                <FInput value={formObra.cidade || ''} onChange={v => setFormObra(p => ({ ...p, cidade: v }))} />
              </CampoEdit>
              <CampoEdit label="UF">
                <FSelect value={formObra.uf || ''} onChange={v => setFormObra(p => ({ ...p, uf: v }))}>
                  <option value="">—</option>
                  {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                </FSelect>
              </CampoEdit>
            </GridEdit>
          </SecaoEdit>

          <SecaoEdit titulo="Equipe">
            <GridEdit>
              <CampoEdit label="Supervisor">
                <FSelect value={formObra.supervisor_id || ''} onChange={v => setFormObra(p => ({ ...p, supervisor_id: v }))}>
                  <option value="">— Selecione —</option>
                  {supervisores.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </FSelect>
              </CampoEdit>
              <CampoEdit label="Comercial responsavel">
                <FSelect value={formObra.comercial_id || ''} onChange={v => setFormObra(p => ({ ...p, comercial_id: v }))}>
                  <option value="">— Selecione —</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </FSelect>
              </CampoEdit>
              <CampoEdit label="Executivista">
                <FInput value={formObra.executivista_nome || ''} onChange={v => setFormObra(p => ({ ...p, executivista_nome: v }))} />
              </CampoEdit>
            </GridEdit>
          </SecaoEdit>

          <SecaoEdit titulo="Contrato">
            <GridEdit>
              <CampoEdit label="Valor do contrato (R$)">
                <FInput type="number" value={formObra.valor_contrato || ''} onChange={v => setFormObra(p => ({ ...p, valor_contrato: v }))} placeholder="0,00" />
              </CampoEdit>
              <CampoEdit label="Gasto meta (R$)">
                <FInput type="number" value={formObra.gasto_meta || ''} onChange={v => setFormObra(p => ({ ...p, gasto_meta: v }))} placeholder="0,00" />
              </CampoEdit>
            </GridEdit>
          </SecaoEdit>

          <SecaoEdit titulo="Arquiteto responsavel">
            <GridEdit>
              <CampoEdit label="Nome">
                <FInput value={formObra.arquiteto_nome || ''} onChange={v => setFormObra(p => ({ ...p, arquiteto_nome: v }))} />
              </CampoEdit>
              <CampoEdit label="E-mail">
                <FInput type="email" value={formObra.arquiteto_email || ''} onChange={v => setFormObra(p => ({ ...p, arquiteto_email: v }))} placeholder="email@exemplo.com" />
              </CampoEdit>
              <CampoEdit label="Telefone">
                <FInput value={formObra.arquiteto_telefone || ''} onChange={v => setFormObra(p => ({ ...p, arquiteto_telefone: v }))} placeholder="(48) 99999-9999" />
              </CampoEdit>
            </GridEdit>
          </SecaoEdit>

          <SecaoEdit titulo="Observações" last>
            <CampoEdit label="Observações internas" full>
              <textarea value={formObra.observacoes || ''} onChange={e => setFormObra(p => ({ ...p, observacoes: e.target.value }))} rows={4} style={textareaStyle} />
            </CampoEdit>
          </SecaoEdit>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setEditando(false)} style={{ background: 'none', border: `1px solid ${THEME.border}`, borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', color: THEME.muted }}>
              Cancelar
            </button>
            <button onClick={salvarEdicaoObra} disabled={salvando} style={{ background: THEME.gold, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: compacto ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: 12, margin: '18px 0 18px' }}>
        <KpiCard label="Progresso" value={`${progressoObra}%`} helper="andamento geral" />
        <KpiCard label="Previsão" value={previsao} helper="término previsto" />
        <KpiCard label="Gastos" value={`R$ ${resumo.gastos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} helper="registrados" />
        <KpiCard label="Pendências" value={resumo.tarefasAbertas} helper="tarefas abertas" />
      </div>

      <div style={{ position: 'sticky', top: 0, zIndex: 20, marginBottom: 24 }}>
        <nav style={{ position: 'relative', display: 'flex', gap: 6, border: `1px solid ${THEME.border}`, background: THEME.card, backdropFilter: 'blur(12px)', borderRadius: 14, padding: 6, overflowX: 'auto', boxShadow: compacto ? '0 10px 24px rgba(0,0,0,0.18)' : 'none' }}>
          {SECOES.map(s => (
            <button key={s.id} onClick={() => setAba(s.id)} style={{ background: aba === s.id ? THEME.gold : THEME.elevated, border: 'none', cursor: 'pointer', padding: compacto ? '10px 13px' : '9px 14px', fontSize: 12.5, whiteSpace: 'nowrap', color: aba === s.id ? '#141210' : THEME.muted, fontWeight: aba === s.id ? 700 : 500, borderRadius: 10, fontFamily: 'inherit', flex: '0 0 auto' }}>{s.label}</button>
          ))}
        </nav>
        {compacto && <div style={{ position: 'absolute', right: 0, top: 2, bottom: 2, width: 32, pointerEvents: 'none', borderRadius: '0 14px 14px 0', background: 'linear-gradient(90deg, rgba(30,27,24,0), rgba(30,27,24,0.96))' }} />}
      </div>

      {aba === 'Resumo' && (
        <div style={{ display: 'grid', gridTemplateColumns: compacto ? '1fr' : '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: compacto ? '1fr 1fr' : 'repeat(6, minmax(0, 1fr))', gap: 10 }}>
            <ResumoAtalho titulo="Equipe" valor={resumo.equipe} detalhe="montadores" onClick={() => setAba('Equipe')} />
            <ResumoAtalho titulo="Agenda" valor={resumo.agenda} detalhe="eventos" onClick={() => setAba('Agenda')} />
            <ResumoAtalho titulo="Fotos" valor={resumo.fotos} detalhe="registros" onClick={() => setAba('Fotos')} />
            <ResumoAtalho titulo="Checklist" valor={resumo.checklistPendentes} detalhe="pendentes" onClick={() => setAba('Checklist')} />
            <ResumoAtalho titulo="Gastos" valor={`R$ ${resumo.gastos.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`} detalhe="total" onClick={() => setAba('Gastos')} />
            <ResumoAtalho titulo="Ocorrências" valor={resumo.ocorrencias} detalhe="registros" onClick={() => setAba('Ocorrencias')} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <CalendarioObra obraId={id} compacto={compacto} />
          </div>
          <Card titulo="Cliente">
            <Info label="Nome"     value={obra.cliente_nome}     />
            <Info label="E-mail"   value={obra.cliente_email}    />
            <Info label="Telefone" value={obra.cliente_telefone} />
          </Card>
          <Card titulo="Obra">
            <Info label="Endereço"       value={[obra.rua, obra.numero, obra.complemento].filter(Boolean).join(', ') || obra.endereco} />
            <Info label="Bairro / Cidade" value={[obra.bairro, obra.cidade, obra.uf].filter(Boolean).join(', ')} />
            <Info label="CEP"            value={obra.cep} />
          </Card>
          <Card titulo="Equipe responsável">
            <Info label="Supervisor"   value={supervisorNome} />
            <Info label="Comercial"    value={comercialNome} />
            <Info label="Executivista" value={obra.executivista_nome} />
          </Card>
          <Card titulo="Contrato">
            <Info label="Número" value={obra.numero_contrato} />
            <Info label="Pedido Ornare" value={obra.pedido_ornare} />
            <Info label="Valor" value={obra.valor_contrato ? `R$ ${Number(obra.valor_contrato).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
          </Card>
          {obra.observacoes && (
            <div style={{ gridColumn: '1/-1' }}>
              <Card titulo="Observações internas">
                <p style={{ margin: 0, fontSize: 13, color: THEME.muted, lineHeight: 1.7 }}>{obra.observacoes}</p>
              </Card>
            </div>
          )}
        </div>
      )}

      {aba === 'Cliente' && (
        <div style={{ display: 'grid', gridTemplateColumns: compacto ? '1fr' : 'minmax(260px, 0.8fr) minmax(0, 1.2fr)', gap: 16 }}>
          <Card titulo="Dados do cliente">
            <Info label="Nome" value={obra.cliente_nome} />
            <Info label="E-mail" value={obra.cliente_email} />
            <Info label="Telefone" value={obra.cliente_telefone} />
          </Card>
          <AbaCliente obraId={id} />
        </div>
      )}

      {aba === 'Endereco' && (
        <Card titulo="Endereço da obra">
          <Info label="Logradouro" value={[obra.rua, obra.numero, obra.complemento].filter(Boolean).join(', ') || obra.endereco} />
          <Info label="Bairro" value={obra.bairro} />
          <Info label="Cidade / UF" value={[obra.cidade, obra.uf].filter(Boolean).join(' / ')} />
          <Info label="CEP" value={obra.cep} />
        </Card>
      )}

      {aba === 'Contrato' && (
        <div style={{ display: 'grid', gridTemplateColumns: compacto ? '1fr' : '1fr 1fr', gap: 16 }}>
          <Card titulo="Contrato">
            <Info label="Número do contrato" value={obra.numero_contrato} />
            <Info label="Pedido Ornare" value={obra.pedido_ornare} />
            <Info label="Valor do contrato" value={obra.valor_contrato ? `R$ ${Number(obra.valor_contrato).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
            <Info label="Gasto meta" value={obra.gasto_meta ? `R$ ${Number(obra.gasto_meta).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
          </Card>
          <Card titulo="Datas">
            <Info label="Início" value={obra.data_inicio ? new Date(obra.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR') : null} />
            <Info label="Previsão" value={previsao} />
            <Info label="Status" value={obra.status} />
            <Info label="Progresso" value={`${progressoObra}%`} />
          </Card>
        </div>
      )}

      {aba === 'Cronograma' && <AbaCronograma obraId={id} profiles={profiles} compacto={compacto} cronogramaDestaque={cronogramaDestaque} />}

      {aba === 'Equipe' && (
        <div style={{ display: 'grid', gridTemplateColumns: compacto ? '1fr' : '1fr 1fr', gap: 16 }}>
          <Card titulo="Responsáveis">
            <Info label="Supervisor" value={supervisorNome} />
            <Info label="Comercial" value={comercialNome} />
            <Info label="Executivista" value={obra.executivista_nome} />
            <Info label="Arquiteto" value={obra.arquiteto_nome} />
          </Card>
          <Card titulo="Contato do arquiteto">
            <Info label="E-mail" value={obra.arquiteto_email} />
            <Info label="Telefone" value={obra.arquiteto_telefone} />
          </Card>
          <div style={{ gridColumn: '1/-1' }}>
            <AbaEquipeObra obraId={id} />
          </div>
        </div>
      )}

      {aba === 'Agenda' && <AbaAgenda obraId={id} agendaDestaque={agendaDestaque} />}

      {aba === 'Tarefas' && (
        <div>
          {tarefas.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-ink-muted)', marginBottom: 6 }}>
                <span>{tarefas.filter(t => t.status === 'concluida').length} de {tarefas.length} concluídas</span>
                <span style={{ color: 'var(--color-gold)', fontWeight: 600 }}>{progresso}%</span>
              </div>
              <div style={progressBarStyle}>
                <div style={{ ...progressFillStyle, width: progresso + '%', transition: 'width 0.4s' }} />
              </div>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={() => setShowForm(!showForm)} style={{ background: 'var(--color-ink)', color: '#f9f7f4', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
              {showForm ? 'Cancelar' : '+ Nova Tarefa'}
            </button>
          </div>
          {showForm && (
            <div style={{ background: THEME.card, border: '1px solid ' + THEME.border, borderRadius: 12, padding: 22, marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1/-1' }}><Label>Título *</Label><FInput value={nova.titulo} onChange={v => setNova(p => ({ ...p, titulo: v }))} placeholder="Título da tarefa" /></div>
                <div style={{ gridColumn: '1/-1' }}><Label>Descrição</Label><textarea value={nova.descricao} onChange={e => setNova(p => ({ ...p, descricao: e.target.value }))} rows={2} style={textareaStyle} /></div>
                <div><Label>Prioridade</Label><FSelect value={nova.prioridade} onChange={v => setNova(p => ({ ...p, prioridade: v }))}><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option></FSelect></div>
                <div><Label>Prazo</Label><FInput type="date" value={nova.prazo} onChange={v => setNova(p => ({ ...p, prazo: v }))} /></div>
                <div style={{ gridColumn: '1/-1' }}><Label>Responsável</Label><FSelect value={nova.responsavel_id} onChange={v => setNova(p => ({ ...p, responsavel_id: v }))}><option value="">Sem responsável</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</FSelect></div>
              </div>
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={salvarTarefa} disabled={salvando || !nova.titulo.trim()} style={{ background: salvando ? '#ccc' : 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{salvando ? 'Salvando...' : 'Criar Tarefa'}</button>
              </div>
            </div>
          )}
          {tarefas.length === 0 ? <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhuma tarefa criada.</div> : tarefas.map(t => <CardTarefa key={t.id} tarefa={t} onMudarStatus={mudarStatus} />)}
        </div>
      )}

      {aba === 'Checklist'   && <AbaChecklist   obraId={id} checklistDestaque={checklistDestaque} />}
      {aba === 'Ocorrencias' && <AbaOcorrencias obraId={id} ocorrenciaDestaque={ocorrenciaDestaque} />}
      {aba === 'Gastos'      && <AbaGastos      obraId={id} obraInfo={obra} gastoDestaque={gastoDestaque} />}
      {aba === 'Fotos'       && <AbaFotos       obraId={id} fotoDestaque={fotoDestaque} />}
      {aba === 'Historico'   && <AbaHistorico   obraId={id} />}
      {aba === 'Chat'        && <AbaChat        obraId={id} />}
      </div>
    </div>
  )
}

function isoLocal(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function dataDeEvento(valor) {
  if (!valor) return ''
  return String(valor).slice(0, 10)
}

function CalendarioObra({ obraId, compacto }) {
  const hoje = new Date()
  const [mes, setMes] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [diaSelecionado, setDiaSelecionado] = useState(isoLocal(hoje))

  const inicioMes = new Date(mes.getFullYear(), mes.getMonth(), 1)
  const fimMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0)
  const inicioBusca = isoLocal(new Date(mes.getFullYear(), mes.getMonth(), 1))
  const fimBusca = isoLocal(new Date(mes.getFullYear(), mes.getMonth() + 1, 0))

  useEffect(() => {
    let ativo = true

    async function carregarCalendario() {
      setLoading(true)
      const [
        { data: agenda },
        { data: fotos },
        { data: ocorrencias },
        { data: checkins },
        { data: historico },
        { data: checklist },
      ] = await Promise.all([
        supabase.from('agenda').select('id, titulo, tipo, data, hora_inicio, status').eq('obra_id', obraId).gte('data', inicioBusca).lte('data', fimBusca),
        supabase.from('fotos').select('id, categoria, observacao, created_at').eq('obra_id', obraId).gte('created_at', `${inicioBusca}T00:00:00`).lte('created_at', `${fimBusca}T23:59:59`),
        supabase.from('ocorrencias').select('id, titulo, descricao, status, created_at').eq('obra_id', obraId).gte('created_at', `${inicioBusca}T00:00:00`).lte('created_at', `${fimBusca}T23:59:59`),
        supabase.from('checkins').select('id, entrada, saida').eq('obra_id', obraId).gte('entrada', `${inicioBusca}T00:00:00`).lte('entrada', `${fimBusca}T23:59:59`),
        supabase.from('historico_obra').select('id, descricao, acao, created_at').eq('obra_id', obraId).gte('created_at', `${inicioBusca}T00:00:00`).lte('created_at', `${fimBusca}T23:59:59`),
        supabase.from('checklist_items').select('id, descricao, concluido_em').eq('obra_id', obraId).gte('concluido_em', `${inicioBusca}T00:00:00`).lte('concluido_em', `${fimBusca}T23:59:59`),
      ])

      if (!ativo) return

      const linhas = [
        ...(agenda || []).map(item => ({
          id: `agenda-${item.id}`,
          data: dataDeEvento(item.data),
          tipo: item.tipo || 'Agenda',
          titulo: item.titulo || item.tipo || 'Compromisso',
          detalhe: [item.hora_inicio, item.status].filter(Boolean).join(' · '),
          cor: '#2E6F95',
        })),
        ...(fotos || []).map(item => ({
          id: `foto-${item.id}`,
          data: dataDeEvento(item.created_at),
          tipo: 'Foto',
          titulo: item.categoria || 'Foto da obra',
          detalhe: item.observacao || 'Registro fotográfico',
          cor: '#8A7D6B',
        })),
        ...(ocorrencias || []).map(item => ({
          id: `ocorrencia-${item.id}`,
          data: dataDeEvento(item.created_at),
          tipo: 'Ocorrência',
          titulo: item.titulo || item.descricao || 'Ocorrência registrada',
          detalhe: item.status || '',
          cor: '#B94A48',
        })),
        ...(checkins || []).map(item => ({
          id: `checkin-${item.id}`,
          data: dataDeEvento(item.entrada),
          tipo: 'Check-in',
          titulo: item.saida ? 'Entrada e saída registradas' : 'Entrada registrada',
          detalhe: item.entrada ? new Date(item.entrada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
          cor: '#2D7A4A',
        })),
        ...(historico || []).map(item => ({
          id: `historico-${item.id}`,
          data: dataDeEvento(item.created_at),
          tipo: 'Histórico',
          titulo: item.descricao || item.acao || 'Atualização da obra',
          detalhe: '',
          cor: THEME.gold,
        })),
        ...(checklist || []).filter(item => item.concluido_em).map(item => ({
          id: `checklist-${item.id}`,
          data: dataDeEvento(item.concluido_em),
          tipo: 'Checklist',
          titulo: item.descricao || 'Item concluído',
          detalhe: 'Concluído',
          cor: '#2D7A4A',
        })),
      ].filter(item => item.data)

      setEventos(linhas)
      setLoading(false)
    }

    carregarCalendario()
    return () => { ativo = false }
  }, [obraId, inicioBusca, fimBusca])

  const eventosPorDia = eventos.reduce((acc, evento) => {
    acc[evento.data] = acc[evento.data] || []
    acc[evento.data].push(evento)
    return acc
  }, {})

  const offset = (inicioMes.getDay() + 6) % 7
  const dias = []
  for (let i = 0; i < offset; i += 1) dias.push(null)
  for (let dia = 1; dia <= fimMes.getDate(); dia += 1) {
    dias.push(new Date(mes.getFullYear(), mes.getMonth(), dia))
  }

  const itensDia = eventosPorDia[diaSelecionado] || []
  const mesLabel = mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  function mudarMes(delta) {
    const novo = new Date(mes.getFullYear(), mes.getMonth() + delta, 1)
    setMes(novo)
    setDiaSelecionado(isoLocal(novo))
  }

  return (
    <Card titulo="Calendário interno da obra">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, color: THEME.ink, fontWeight: 800, textTransform: 'capitalize' }}>{mesLabel}</div>
          <div style={{ fontSize: 12, color: THEME.muted, marginTop: 3 }}>Eventos, fotos, check-ins, ocorrências e atualizações por dia.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => mudarMes(-1)} style={acaoBtn(false)}>Anterior</button>
          <button onClick={() => mudarMes(1)} style={acaoBtn(false)}>Próximo</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: compacto ? 5 : 8 }}>
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(dia => (
          <div key={dia} style={{ fontSize: 10, color: THEME.muted, fontWeight: 900, textAlign: 'center', padding: '4px 0' }}>{dia}</div>
        ))}
        {dias.map((dia, index) => {
          if (!dia) return <div key={`blank-${index}`} />
          const iso = isoLocal(dia)
          const marcadores = eventosPorDia[iso] || []
          const selecionado = iso === diaSelecionado
          const fimSemana = dia.getDay() === 0 || dia.getDay() === 6
          return (
            <button
              key={iso}
              onClick={() => setDiaSelecionado(iso)}
              style={{
                minHeight: compacto ? 46 : 66,
                borderRadius: 12,
                border: selecionado ? `2px solid ${THEME.gold}` : `1px solid ${THEME.border}`,
                background: selecionado ? THEME.elevated : fimSemana ? THEME.card : THEME.card,
                color: THEME.ink,
                cursor: 'pointer',
                fontFamily: 'inherit',
                padding: compacto ? 5 : 8,
                textAlign: 'left',
              }}
            >
              <span style={{ display: 'block', fontSize: 12, fontWeight: 900, color: selecionado ? THEME.gold : THEME.muted }}>{dia.getDate()}</span>
              <span style={{ display: 'flex', gap: 3, marginTop: 8, flexWrap: 'wrap' }}>
                {marcadores.slice(0, 4).map(item => (
                  <i key={item.id} style={{ width: 7, height: 7, borderRadius: '50%', background: item.cor, display: 'block' }} />
                ))}
              </span>
            </button>
          )
        })}
      </div>
      <div style={{ marginTop: 14, border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 14, background: THEME.card }}>
        <div style={{ fontSize: 12, color: THEME.gold, fontWeight: 900, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
          {new Date(`${diaSelecionado}T00:00:00`).toLocaleDateString('pt-BR')}
        </div>
        {loading ? (
          <div style={{ fontSize: 13, color: THEME.muted }}>Carregando movimentações...</div>
        ) : itensDia.length === 0 ? (
          <div style={{ fontSize: 13, color: THEME.muted }}>Nenhuma movimentação registrada neste dia.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {itensDia.map(item => (
              <div key={item.id} style={{ borderLeft: `4px solid ${item.cor}`, padding: '8px 10px', background: THEME.elevated, borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: item.cor, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>{item.tipo}</div>
                <div style={{ fontSize: 13, color: THEME.ink, fontWeight: 800, marginTop: 3 }}>{item.titulo}</div>
                {item.detalhe && <div style={{ fontSize: 12, color: THEME.muted, marginTop: 2 }}>{item.detalhe}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

function KpiCard({ label, value, helper }) {
  return (
    <div style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 14, padding: '16px 18px', minWidth: 0 }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: THEME.gold, textTransform: 'uppercase', marginBottom: 8, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: THEME.ink, lineHeight: 1.1, wordBreak: 'break-word' }}>{value}</div>
      {helper && <div style={{ fontSize: 12, color: THEME.muted, marginTop: 6 }}>{helper}</div>}
    </div>
  )
}

function ResumoAtalho({ titulo, valor, detalhe, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${THEME.border}`,
        background: THEME.card,
        borderRadius: 14,
        padding: '14px 13px',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
        minWidth: 0,
        boxShadow: '0 12px 26px rgba(29,28,25,0.035)',
      }}
    >
      <span style={{ display: 'block', fontSize: 10, letterSpacing: 1.7, textTransform: 'uppercase', color: THEME.gold, fontWeight: 800, marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titulo}</span>
      <strong style={{ display: 'block', fontSize: 22, lineHeight: 1, color: THEME.ink, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis' }}>{valor ?? 0}</strong>
      <small style={{ display: 'block', marginTop: 6, color: THEME.muted, fontSize: 11.5, fontWeight: 700 }}>{detalhe}</small>
    </button>
  )
}

function AbaCronograma({ obraId, profiles, compacto, cronogramaDestaque }) {
  const [cronograma, setCronograma] = useState(null)
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState(null)

  function setCampo(campo, valor) {
    setForm(p => ({ ...p, [campo]: valor }))
  }

  function textoAprovacao(valor) {
    const mapa = {
      pendente: 'Pendente',
      aprovado: 'Aprovado',
      reprovado: 'Reprovado',
      nao_se_aplica: 'Não se aplica',
    }
    return mapa[valor] || valor || 'Pendente'
  }

  async function carregar() {
    setLoading(true)
    setMensagem(null)
    const { data, error } = await supabase
      .from('obra_cronograma')
      .select('*')
      .eq('obra_id', obraId)
      .maybeSingle()

    if (error) {
      setMensagem({ tipo: 'erro', texto: 'Não foi possível carregar o cronograma: ' + error.message })
      setLoading(false)
      return
    }

    if (data) {
      setCronograma(data)
      setForm(data)
      setLoading(false)
      return
    }

    const inicial = {
      obra_id: obraId,
      fase: 'vistoria_medida',
      etapa_atual: 'Aguardando planejamento',
      status_operacional: 'Aguardando planejamento',
      percentual_concluido: 0,
      prioridade: 'media',
      risco: 'medio',
      aprovacao_tecnica_status: 'pendente',
      aprovacao_comercial_status: 'pendente',
      aprovacao_financeira_status: 'pendente',
      travado: false,
      visivel_cliente: false,
      acao_recomendada: 'Atualizar cronograma operacional da obra.',
    }

    const { data: criado, error: criarError } = await supabase
      .from('obra_cronograma')
      .insert([inicial])
      .select()
      .single()

    if (criarError) {
      setMensagem({ tipo: 'erro', texto: 'Cronograma ainda nao foi criado para esta obra.' })
      setCronograma(inicial)
      setForm(inicial)
    } else {
      setCronograma(criado)
      setForm(criado)
    }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { carregar() }, [])

  async function salvar() {
    if (!form) return
    setSalvando(true)
    setMensagem(null)

    const payload = {
      fase: (faseOrnarePorKey(form.fase) || faseOrnarePorTexto(form.fase))?.key || form.fase || null,
      etapa_atual: form.etapa_atual || null,
      status_operacional: (faseOrnarePorKey(form.fase) || faseOrnarePorTexto(form.fase))?.label || form.status_operacional || null,
      tipo_montagem: form.tipo_montagem || null,
      data_inicio_prevista: form.data_inicio_prevista || null,
      data_fim_prevista: form.data_fim_prevista || null,
      data_inicio_real: form.data_inicio_real || null,
      data_fim_real: form.data_fim_real || null,
      dias_previstos: form.dias_previstos ? parseInt(form.dias_previstos, 10) : null,
      percentual_concluido: form.percentual_concluido === '' || form.percentual_concluido === null ? 0 : Number(form.percentual_concluido),
      prioridade: form.prioridade || 'media',
      risco: form.risco || 'medio',
      alertas_observacoes: form.alertas_observacoes || null,
      responsavel_id: form.responsavel_id || null,
      supervisor_id: form.supervisor_id || null,
      pos_venda_id: form.pos_venda_id || null,
      aprovacao_tecnica_status: form.aprovacao_tecnica_status || 'pendente',
      aprovacao_comercial_status: form.aprovacao_comercial_status || 'pendente',
      aprovacao_financeira_status: form.aprovacao_financeira_status || 'pendente',
      travado: Boolean(form.travado),
      motivo_trava: form.motivo_trava || null,
      acao_recomendada: form.acao_recomendada || null,
      visivel_cliente: Boolean(form.visivel_cliente),
    }

    const query = cronograma?.id
      ? supabase.from('obra_cronograma').update(payload).eq('id', cronograma.id).select().single()
      : supabase.from('obra_cronograma').insert([{ ...payload, obra_id: obraId }]).select().single()

    const { data, error } = await query
    if (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar cronograma: ' + error.message })
    } else {
      setCronograma(data)
      setForm(data)
      setMensagem({ tipo: 'sucesso', texto: 'Cronograma atualizado com sucesso.' })
      await criarNotificacoesObra({
        obraId,
        tipo: 'cronograma',
        titulo: 'Cronograma alterado',
        descricao: `${faseOrnarePorKey(data.fase)?.label || data.status_operacional || 'Cronograma'} · ${data.percentual_concluido || 0}% concluído`,
        prioridade: data.travado || data.risco === 'alto' ? 'alta' : 'normal',
        entidadeTipo: 'cronograma',
        entidadeId: data.id,
        rota: `/obras/${obraId}?aba=Cronograma&cronograma=${data.id}`,
      })
    }
    setSalvando(false)
  }

  if (loading) return <div style={{ color: THEME.muted }}>Carregando cronograma...</div>
  if (!form) return <div style={{ color: THEME.danger }}>Cronograma indisponível.</div>

  const responsaveis = profiles || []
  const supervisores = responsaveis.filter(p => ['gestao', 'supervisor'].includes(p.role))
  const posVenda = responsaveis.filter(p => ['gestao', 'pos_venda', 'vendedor'].includes(p.role))
  const faseAtualObj = faseOrnarePorKey(form.fase) || faseOrnarePorTexto(form.fase) || FASES_ORNARE[0]
  const faseAtual = faseAtualObj.key
  const faseAtualIndex = Math.max(0, indiceFaseOrnare(faseAtual))
  const porcentagem = Math.max(0, Math.min(100, Number(form.percentual_concluido) || 0))
  const destaqueCronograma = Boolean(cronogramaDestaque && cronograma?.id === cronogramaDestaque)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {destaqueCronograma && (
        <div style={{ border: `1px solid ${THEME.gold}`, background: '#FFFBF0', color: THEME.ink, borderRadius: 12, padding: '12px 14px', fontSize: 13, fontWeight: 800 }}>
          Cronograma aberto pela central de ações.
        </div>
      )}
      {mensagem && (
        <div style={{
          border: '1px solid ' + (mensagem.tipo === 'erro' ? '#f1c6c6' : '#c8e1d0'),
          background: mensagem.tipo === 'erro' ? '#fff6f6' : '#f4fbf6',
          color: mensagem.tipo === 'erro' ? THEME.danger : '#2D7A4A',
          borderRadius: 10,
          padding: '10px 12px',
          fontSize: 13,
          fontWeight: 700,
        }}>
          {mensagem.texto}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: compacto ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <KpiCard label="Fase" value={faseAtualObj.label} helper={faseAtualObj.descricao} />
        <KpiCard label="Etapa" value={form.etapa_atual || '-'} helper="detalhe interno" />
        <KpiCard label="Prioridade" value={form.prioridade || '-'} helper={`risco ${form.risco || '-'}`} />
        <KpiCard label="Percentual" value={`${porcentagem}%`} helper="concluido" />
      </div>

      <Card titulo="Linha do tempo operacional">
        <div style={{ display: compacto ? 'flex' : 'grid', gridTemplateColumns: compacto ? undefined : `repeat(${FASES_ORNARE.length}, minmax(0, 1fr))`, gap: 10, overflowX: compacto ? 'auto' : 'visible', paddingBottom: compacto ? 6 : 0 }}>
          {FASES_ORNARE.map((fase, index) => {
            const ativa = fase.key === faseAtual
            const concluida = faseAtualIndex > index
            return (
              <div key={fase.key} style={{ flex: compacto ? '0 0 120px' : undefined, border: `1px solid ${ativa ? THEME.gold : THEME.border}`, borderTop: ativa ? `4px solid ${fase.cor}` : `1px solid ${concluida ? '#B8DCC4' : THEME.border}`, background: ativa ? `${fase.cor}18` : concluida ? 'rgba(76,175,125,.14)' : THEME.card, borderRadius: 12, padding: '12px 10px', minHeight: 92 }}>
                <div style={{ width: 24, height: 24, borderRadius: 999, background: ativa ? fase.cor : concluida ? '#2D7A4A' : THEME.border, color: ativa || concluida ? '#fff' : THEME.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, marginBottom: 9 }}>
                  {concluida ? '✓' : fase.id}
                </div>
                <div style={{ fontSize: 12, color: ativa ? THEME.ink : THEME.muted, fontWeight: ativa ? 900 : 700, lineHeight: 1.25 }}>{fase.label}</div>
                <div style={{ fontSize: 10.5, color: THEME.muted, lineHeight: 1.25, marginTop: 5 }}>{fase.descricao}</div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card titulo="Dados do cronograma">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
          <div><Label>Fase / status operacional</Label><FSelect value={faseAtual} onChange={v => setCampo('fase', v)}>{FASES_ORNARE.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</FSelect></div>
          <div><Label>Etapa atual</Label><FInput value={form.etapa_atual || ''} onChange={v => setCampo('etapa_atual', v)} /></div>
          <div><Label>Tipo de montagem</Label><FInput value={form.tipo_montagem || ''} onChange={v => setCampo('tipo_montagem', v)} /></div>
          <div><Label>Prioridade</Label><FSelect value={form.prioridade || 'media'} onChange={v => setCampo('prioridade', v)}>{PRIORIDADES_CRONOGRAMA.map(p => <option key={p} value={p}>{p}</option>)}</FSelect></div>
          <div><Label>Risco</Label><FSelect value={form.risco || 'medio'} onChange={v => setCampo('risco', v)}>{RISCOS_CRONOGRAMA.map(r => <option key={r} value={r}>{r}</option>)}</FSelect></div>
          <div><Label>Percentual concluído</Label><FInput type="number" min="0" max="100" value={form.percentual_concluido ?? 0} onChange={v => setCampo('percentual_concluido', v)} /></div>
          <div><Label>Dias previstos</Label><FInput type="number" min="0" value={form.dias_previstos || ''} onChange={v => setCampo('dias_previstos', v)} /></div>
          <div><Label>Data início prevista</Label><FInput type="date" value={form.data_inicio_prevista || ''} onChange={v => setCampo('data_inicio_prevista', v)} /></div>
          <div><Label>Data fim prevista</Label><FInput type="date" value={form.data_fim_prevista || ''} onChange={v => setCampo('data_fim_prevista', v)} /></div>
          <div><Label>Data início real</Label><FInput type="date" value={form.data_inicio_real || ''} onChange={v => setCampo('data_inicio_real', v)} /></div>
          <div><Label>Data fim real</Label><FInput type="date" value={form.data_fim_real || ''} onChange={v => setCampo('data_fim_real', v)} /></div>
          <div><Label>Responsável</Label><FSelect value={form.responsavel_id || ''} onChange={v => setCampo('responsavel_id', v)}><option value="">Sem responsável</option>{responsaveis.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</FSelect></div>
          <div><Label>Supervisor</Label><FSelect value={form.supervisor_id || ''} onChange={v => setCampo('supervisor_id', v)}><option value="">Sem supervisor</option>{supervisores.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</FSelect></div>
          <div><Label>Pós-venda</Label><FSelect value={form.pos_venda_id || ''} onChange={v => setCampo('pos_venda_id', v)}><option value="">Sem pós-venda</option>{posVenda.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</FSelect></div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: compacto ? '1fr' : '1fr 1fr', gap: 16 }}>
        <Card titulo="Aprovações">
          <div style={{ display: 'grid', gap: 12 }}>
            <div><Label>Aprovação técnica</Label><FSelect value={form.aprovacao_tecnica_status || 'pendente'} onChange={v => setCampo('aprovacao_tecnica_status', v)}>{APROVACOES_CRONOGRAMA.map(a => <option key={a} value={a}>{textoAprovacao(a)}</option>)}</FSelect></div>
            <div><Label>Aprovação comercial</Label><FSelect value={form.aprovacao_comercial_status || 'pendente'} onChange={v => setCampo('aprovacao_comercial_status', v)}>{APROVACOES_CRONOGRAMA.map(a => <option key={a} value={a}>{textoAprovacao(a)}</option>)}</FSelect></div>
            <div><Label>Aprovação financeira</Label><FSelect value={form.aprovacao_financeira_status || 'pendente'} onChange={v => setCampo('aprovacao_financeira_status', v)}>{APROVACOES_CRONOGRAMA.map(a => <option key={a} value={a}>{textoAprovacao(a)}</option>)}</FSelect></div>
          </div>
        </Card>

        <Card titulo="Risco e visibilidade">
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: THEME.ink, fontWeight: 700 }}>
              <input type="checkbox" checked={Boolean(form.travado)} onChange={e => setCampo('travado', e.target.checked)} />
              Travado
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: THEME.ink, fontWeight: 700 }}>
              <input type="checkbox" checked={Boolean(form.visivel_cliente)} onChange={e => setCampo('visivel_cliente', e.target.checked)} />
              Visível ao cliente
            </label>
            <div><Label>Motivo da trava</Label><textarea value={form.motivo_trava || ''} onChange={e => setCampo('motivo_trava', e.target.value)} rows={3} style={textareaStyle} /></div>
          </div>
        </Card>
      </div>

      <Card titulo="Alertas e ação recomendada">
        <div style={{ display: 'grid', gap: 12 }}>
          <div><Label>Alertas / observações</Label><textarea value={form.alertas_observacoes || ''} onChange={e => setCampo('alertas_observacoes', e.target.value)} rows={3} style={textareaStyle} /></div>
          <div><Label>Ação recomendada</Label><textarea value={form.acao_recomendada || ''} onChange={e => setCampo('acao_recomendada', e.target.value)} rows={3} style={textareaStyle} /></div>
        </div>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={salvar} disabled={salvando} style={{ background: salvando ? '#ccc' : THEME.gold, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
          {salvando ? 'Salvando...' : 'Salvar cronograma'}
        </button>
      </div>
    </div>
  )
}

function SecaoEdit({ titulo, children, last }) {
  return (
    <div style={{ marginBottom: last ? 8 : 24 }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: THEME.gold, textTransform: 'uppercase', fontWeight: 700, marginBottom: 12 }}>{titulo}</div>
      {children}
      {!last && <div style={{ borderBottom: `1px solid ${THEME.border}`, marginTop: 20 }} />}
    </div>
  )
}
function GridEdit({ children }) { return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>{children}</div> }
function CampoEdit({ label, children, full }) {
  return (
    <div style={{ gridColumn: full ? '1/-1' : undefined }}>
      <div style={{ fontSize: 11, color: THEME.muted, marginBottom: 6, fontWeight: 700 }}>{label}</div>
      {children}
    </div>
  )
}

function AbaAgenda({ obraId, agendaDestaque }) {
  const [agenda, setAgenda] = useState([])
  const [checklistVistoria, setChecklistVistoria] = useState([])
  const [fotosVistoria, setFotosVistoria] = useState([])
  const [fotosDia, setFotosDia] = useState([])
  const [ocorrenciasDia, setOcorrenciasDia] = useState([])
  const [checkinsDia, setCheckinsDia] = useState([])
  const [historicoDia, setHistoricoDia] = useState([])
  const [mesCalendario, setMesCalendario] = useState(() => {
    const hoje = new Date()
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  })
  const [diaSelecionado, setDiaSelecionado] = useState('')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const normalizarAgenda = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  async function carregar() {
    setErro('')
    const [
      agendaResult,
      checklistResult,
      fotosResult,
      ocorrenciasResult,
      checkinsResult,
      historicoResult,
    ] = await Promise.all([
      supabase.from('agenda').select('*').eq('obra_id', obraId).order('data', { ascending: true }),
      supabase.from('checklist_items').select('id, agenda_id, concluido').eq('obra_id', obraId).not('agenda_id', 'is', null),
      supabase.from('fotos').select('id, agenda_id, categoria, created_at, observacao').eq('obra_id', obraId).order('created_at', { ascending: false }),
      supabase.from('ocorrencias').select('id, titulo, status, gravidade, created_at').eq('obra_id', obraId).order('created_at', { ascending: false }),
      supabase.from('checkins').select('id, user_id, entrada, saida, created_at').eq('obra_id', obraId).order('created_at', { ascending: false }),
      supabase.from('historico_obra').select('id, acao, descricao, created_at').eq('obra_id', obraId).order('created_at', { ascending: false }),
    ])
    const falha = [agendaResult, checklistResult, fotosResult, ocorrenciasResult, checkinsResult, historicoResult].find(result => result.error)
    if (falha?.error) setErro(mensagemErro(falha.error, 'Parte da agenda operacional nao foi carregada.'))
    const agendaDados = agendaResult.data || []
    const checklist = checklistResult.data || []
    const fotos = fotosResult.data || []
    setAgenda(agendaDados)
    setChecklistVistoria(checklist)
    setFotosVistoria(fotos.filter(f => f.agenda_id))
    setFotosDia(fotos)
    setOcorrenciasDia(ocorrenciasResult.data || [])
    setCheckinsDia(checkinsResult.data || [])
    setHistoricoDia(historicoResult.data || [])
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { carregar() }, [])

  useEffect(() => {
    if (!agendaDestaque || agenda.length === 0) return
    const item = agenda.find(compromisso => String(compromisso.id) === String(agendaDestaque))
    if (!item) return
    const timer = window.setTimeout(() => {
      if (item.data) {
        const data = new Date(`${item.data}T00:00:00`)
        if (!Number.isNaN(data.getTime())) {
          setMesCalendario(new Date(data.getFullYear(), data.getMonth(), 1))
          setDiaSelecionado(item.data)
        }
      }
      rolarParaDestaque(`agenda-${agendaDestaque}`)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [agenda, agendaDestaque])
  function isoLocal(date) {
    const ano = date.getFullYear()
    const mes = String(date.getMonth() + 1).padStart(2, '0')
    const dia = String(date.getDate()).padStart(2, '0')
    return `${ano}-${mes}-${dia}`
  }

  function dataItem(value) {
    if (!value) return ''
    const data = new Date(value)
    if (Number.isNaN(data.getTime())) return String(value).slice(0, 10)
    return isoLocal(data)
  }

  function tituloMes(date) {
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }

  function mudarMes(delta) {
    setMesCalendario(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
    setDiaSelecionado('')
  }

  function diasCalendario() {
    const inicioMes = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth(), 1)
    const fimMes = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 0)
    const inicio = new Date(inicioMes)
    inicio.setDate(inicio.getDate() - inicio.getDay())
    const total = Math.ceil((fimMes.getDate() + inicioMes.getDay()) / 7) * 7
    return Array.from({ length: total }, (_, index) => {
      const dia = new Date(inicio)
      dia.setDate(inicio.getDate() + index)
      return {
        data: dia,
        key: isoLocal(dia),
        noMes: dia.getMonth() === mesCalendario.getMonth(),
      }
    })
  }

  function eventosDoDia(key) {
    return [
      ...agenda.filter(item => item.data === key).map(item => ({
        id: `agenda-${item.id}`,
        tipo: item.tipo || 'Agenda',
        titulo: item.titulo || 'Compromisso',
        detalhe: [item.hora_inicio, item.status].filter(Boolean).join(' · '),
        cor: THEME.gold,
      })),
      ...fotosDia.filter(item => dataItem(item.created_at) === key).map(item => ({
        id: `foto-${item.id}`,
        tipo: 'Foto',
        titulo: item.categoria || 'Foto enviada',
        detalhe: item.observacao || 'Registro fotográfico da obra',
        cor: '#365C7D',
      })),
      ...ocorrenciasDia.filter(item => dataItem(item.created_at) === key).map(item => ({
        id: `ocorrencia-${item.id}`,
        tipo: 'Ocorrência',
        titulo: item.titulo || 'Ocorrência registrada',
        detalhe: [item.gravidade, item.status].filter(Boolean).join(' · '),
        cor: '#C0392B',
      })),
      ...checkinsDia.filter(item => dataItem(item.entrada || item.created_at) === key).map(item => ({
        id: `checkin-${item.id}`,
        tipo: 'Check-in',
        titulo: item.saida ? 'Entrada e saída registradas' : 'Entrada registrada',
        detalhe: item.entrada ? new Date(item.entrada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
        cor: '#2D7A4A',
      })),
      ...historicoDia.filter(item => dataItem(item.created_at) === key).map(item => ({
        id: `historico-${item.id}`,
        tipo: 'Histórico',
        titulo: item.acao || 'Atualização da obra',
        detalhe: item.descricao || '',
        cor: THEME.muted,
      })),
    ]
  }

  if (loading) return <div style={{ color: THEME.muted }}>Carregando...</div>
  const dias = diasCalendario()
  const selecionados = diaSelecionado ? eventosDoDia(diaSelecionado) : []

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {erro && <div style={{ background: '#FFF7F7', color: THEME.danger, border: `1px solid ${THEME.danger}`, borderRadius: 10, padding: '10px 12px', fontSize: 12.5, fontWeight: 800 }}>{erro}</div>}
      <div style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: THEME.gold, textTransform: 'uppercase', fontWeight: 800 }}>Calendário interno da obra</div>
            <div style={{ fontSize: 20, color: THEME.ink, fontWeight: 800, textTransform: 'capitalize', marginTop: 4 }}>{tituloMes(mesCalendario)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => mudarMes(-1)} style={{ border: `1px solid ${THEME.border}`, background: THEME.elevated, color: THEME.ink, borderRadius: 999, padding: '8px 12px', cursor: 'pointer', fontWeight: 800 }}>Anterior</button>
            <button type="button" onClick={() => mudarMes(1)} style={{ border: `1px solid ${THEME.border}`, background: THEME.elevated, color: THEME.ink, borderRadius: 999, padding: '8px 12px', cursor: 'pointer', fontWeight: 800 }}>Próximo</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, marginBottom: 6 }}>
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
            <div key={dia} style={{ fontSize: 10, color: THEME.muted, fontWeight: 900, textAlign: 'center' }}>{dia}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
          {dias.map(dia => {
            const eventos = eventosDoDia(dia.key)
            const ativo = diaSelecionado === dia.key
            return (
              <button
                type="button"
                key={dia.key}
                onClick={() => setDiaSelecionado(dia.key)}
                style={{
                  minHeight: 52,
                  border: `1px solid ${ativo ? THEME.gold : eventos.length ? '#D8C8AF' : THEME.border}`,
                  background: ativo ? THEME.softGold : dia.noMes ? THEME.card : THEME.elevated,
                  color: dia.noMes ? THEME.ink : THEME.muted,
                  borderRadius: 12,
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  position: 'relative',
                  fontWeight: 900,
                  opacity: dia.noMes ? 1 : 0.55,
                }}
              >
                <span>{dia.data.getDate()}</span>
                {eventos.length > 0 && (
                  <span style={{ position: 'absolute', bottom: 7, display: 'flex', gap: 3 }}>
                    {eventos.slice(0, 3).map(evento => <i key={evento.id} style={{ width: 5, height: 5, borderRadius: 999, background: evento.cor }} />)}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {diaSelecionado && (
          <div style={{ marginTop: 14, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 14, background: THEME.card }}>
            <div style={{ fontSize: 12, color: THEME.gold, fontWeight: 900, marginBottom: 10 }}>
              {new Date(`${diaSelecionado}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </div>
            {selecionados.length === 0 ? (
              <div style={{ fontSize: 13, color: THEME.muted }}>Nenhum registro encontrado neste dia.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {selecionados.map(evento => (
                  <div key={evento.id} style={{ borderLeft: `4px solid ${evento.cor}`, padding: '8px 10px', borderRadius: 8, background: THEME.elevated }}>
                    <div style={{ fontSize: 10, color: evento.cor, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 900 }}>{evento.tipo}</div>
                    <div style={{ fontSize: 13.5, color: THEME.ink, fontWeight: 800, marginTop: 3 }}>{evento.titulo}</div>
                    {evento.detalhe && <div style={{ fontSize: 12.5, color: THEME.muted, marginTop: 3 }}>{evento.detalhe}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {agenda.length === 0 && <div style={{ textAlign: 'center', padding: '34px 0', color: '#bbb' }}>Nenhum compromisso na agenda.</div>}
      {agenda.map(item => (
        <div key={item.id} data-destaque-id={`agenda-${item.id}`} style={{ background: String(item.id) === String(agendaDestaque) ? THEME.softGold : THEME.card, border: `1px solid ${String(item.id) === String(agendaDestaque) ? THEME.gold : THEME.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 92 }}>
            <div style={{ fontSize: 12, color: THEME.gold, fontWeight: 800 }}>{item.data ? new Date(item.data + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</div>
            {item.hora_inicio && <div style={{ fontSize: 12, color: THEME.muted, marginTop: 3 }}>{item.hora_inicio}</div>}
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 14, color: THEME.ink, fontWeight: 700 }}>{item.titulo || item.tipo || 'Compromisso'}</div>
            {(item.observacao || item.descricao) && <div style={{ fontSize: 13, color: THEME.muted, marginTop: 4, lineHeight: 1.5 }}>{item.observacao || item.descricao}</div>}
            {normalizarAgenda(item.tipo || item.titulo).includes('vistoria') && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <span style={{ fontSize: 11, color: THEME.success, background: '#EAF5EE', borderRadius: 999, padding: '5px 9px', fontWeight: 800 }}>{item.status || 'pendente'}</span>
                <span style={{ fontSize: 11, color: THEME.muted, background: '#F7F4EF', borderRadius: 999, padding: '5px 9px', fontWeight: 800 }}>
                  {checklistVistoria.filter(i => i.agenda_id === item.id).filter(i => i.concluido).length}/{checklistVistoria.filter(i => i.agenda_id === item.id).length} checklist
                </span>
                <span style={{ fontSize: 11, color: THEME.muted, background: '#F7F4EF', borderRadius: 999, padding: '5px 9px', fontWeight: 800 }}>
                  {fotosVistoria.filter(f => f.agenda_id === item.id).length} fotos
                </span>
              </div>
            )}
          </div>
          {item.tipo && <span style={{ fontSize: 11, color: THEME.muted, border: `1px solid ${THEME.border}`, borderRadius: 999, padding: '5px 10px' }}>{item.tipo}</span>}
        </div>
      ))}
    </div>
  )
}

function AbaChecklist({ obraId, checklistDestaque }) {
  const { user } = useStore()
  const [itens, setItens] = useState([])
  const [ambientes, setAmbientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [novoItem, setNovoItem] = useState('')
  const [ambienteSelecionado, setAmbienteSelecionado] = useState('geral')
  const [salvando, setSalvando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [filtroBiblioteca, setFiltroBiblioteca] = useState({ fase: '', ambiente: '' })
  const [mensagemBiblioteca, setMensagemBiblioteca] = useState('')
  async function carregar() {
    const [ambientesResult, checklistResult] = await Promise.all([
      supabase.from('obra_ambientes').select('id, nome, status').eq('obra_id', obraId),
      supabase.from('checklist_items').select('id, obra_id, ambiente_id, descricao, concluido, concluido_por, concluido_em').eq('obra_id', obraId).order('descricao'),
    ])
    const falha = [ambientesResult, checklistResult].find(result => result.error)
    if (falha?.error) setMensagemBiblioteca(mensagemErro(falha.error, 'Nao foi possivel carregar o checklist.'))
    setAmbientes(ambientesResult.data || [])
    setItens(checklistResult.data || [])
    setLoading(false)
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { carregar() }, [])
  useEffect(() => {
    if (!loading && checklistDestaque) rolarParaDestaque(checklistDestaque)
  }, [checklistDestaque, loading])

  async function adicionar() {
    if (!novoItem.trim()) return
    const temGrupoGeral = itens.some(i => !i.ambiente_id) || ambientes.length === 0
    const destinoId = ambienteSelecionado === 'geral' && !temGrupoGeral ? (ambientes[0]?.id || 'geral') : ambienteSelecionado
    setSalvando(true)
    setMensagemBiblioteca('')
    const { error } = await supabase.from('checklist_items').insert([{
      obra_id: obraId,
      ambiente_id: destinoId === 'geral' ? null : destinoId,
      descricao: novoItem.trim(),
      concluido: false,
    }])
    if (error) {
      setMensagemBiblioteca('Erro ao adicionar checklist: ' + mensagemErro(error))
      setSalvando(false)
      return
    }
    setNovoItem(''); await carregar(); setSalvando(false)
  }
  async function toggle(item) {
    const concluindo = !item.concluido
    setMensagemBiblioteca('')
    const { error } = await supabase.from('checklist_items').update({
      concluido: concluindo,
      concluido_por: concluindo ? user?.id : null,
      concluido_em: concluindo ? new Date().toISOString() : null,
    }).eq('id', item.id)
    if (error) {
      setMensagemBiblioteca('Erro ao atualizar checklist: ' + mensagemErro(error))
      return
    }
    if (concluindo) {
      await criarNotificacoesObra({
        obraId,
        tipo: 'checklist',
        titulo: 'Item de checklist concluído',
        descricao: item.descricao || 'Checklist atualizado na obra.',
        prioridade: 'normal',
        entidadeTipo: 'checklist_items',
        entidadeId: item.id,
        rota: `/obras/${obraId}?aba=Checklist&checklist=${item.id}`,
        excluirUsuarioId: user?.id,
      })
    }
    await carregar()
  }
  async function aplicarBiblioteca() {
    setAplicando(true)
    setMensagemBiblioteca('')
    const { count, skipped, error } = await aplicarBibliotecaChecklist(obraId, {
      fase: filtroBiblioteca.fase || undefined,
      ambiente: filtroBiblioteca.ambiente || undefined,
    })
    if (error) {
      setMensagemBiblioteca('Erro ao aplicar biblioteca: ' + error.message)
    } else {
      setMensagemBiblioteca(
        count > 0
          ? `${count} itens aplicados. ${skipped} itens já existiam e foram ignorados.`
          : skipped > 0
            ? `Nenhum item novo aplicado. ${skipped} itens já existiam nesta obra.`
            : 'Nenhum modelo encontrado para os filtros selecionados.',
      )
      await carregar()
    }
    setAplicando(false)
  }
  const concluidos = itens.filter(i => i.concluido).length
  const pct = itens.length > 0 ? Math.round(concluidos / itens.length * 100) : 0
  const gruposAmbientes = ambientes.map(a => ({
    id: a.id,
    nome: a.nome || 'Ambiente',
    itens: itens.filter(i => i.ambiente_id === a.id),
  }))
  const geral = { id: 'geral', nome: 'Geral', itens: itens.filter(i => !i.ambiente_id) }
  const grupos = [...gruposAmbientes, geral].filter(g => g.id !== 'geral' || g.itens.length > 0 || ambientes.length === 0)
  const ativo = grupos.find(g => g.id === ambienteSelecionado) || grupos[0] || geral
  return (
    <div>
      <Card titulo="Biblioteca Mestre">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, alignItems: 'end' }}>
          <div>
            <Label>Aplicar por fase</Label>
            <FSelect value={filtroBiblioteca.fase} onChange={v => setFiltroBiblioteca(p => ({ ...p, fase: v }))}>
              <option value="">Todas as fases</option>
              {FASES_BIBLIOTECA.map(fase => <option key={fase} value={fase}>{fase}</option>)}
            </FSelect>
          </div>
          <div>
            <Label>Aplicar por ambiente</Label>
            <FSelect value={filtroBiblioteca.ambiente} onChange={v => setFiltroBiblioteca(p => ({ ...p, ambiente: v }))}>
              <option value="">Todos os ambientes</option>
              <option value="Geral">Geral</option>
              {ambientes.map(ambiente => <option key={ambiente.id} value={ambiente.nome}>{ambiente.nome}</option>)}
            </FSelect>
          </div>
          <button onClick={aplicarBiblioteca} disabled={aplicando} style={{ background: THEME.ink, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
            {aplicando ? 'Aplicando...' : 'Aplicar Biblioteca'}
          </button>
        </div>
        {mensagemBiblioteca && (
          <div style={{ marginTop: 12, border: `1px solid ${mensagemBiblioteca.startsWith('Erro') ? '#F0C8C8' : THEME.border}`, background: mensagemBiblioteca.startsWith('Erro') ? '#FFF7F7' : THEME.card, color: mensagemBiblioteca.startsWith('Erro') ? THEME.danger : THEME.muted, borderRadius: 10, padding: '10px 12px', fontSize: 12.5, fontWeight: 700 }}>
            {mensagemBiblioteca}
          </div>
        )}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
        <KpiCard label="Progresso" value={`${pct}%`} helper={`${concluidos} de ${itens.length} itens`} />
        <KpiCard label="Ambientes" value={ambientes.length || 1} helper={ambientes.length ? 'ambientes da obra' : 'grupo geral'} />
        <KpiCard label="Pendentes" value={itens.length - concluidos} helper="itens abertos" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 18 }}>
        {grupos.map(grupo => {
          const feitos = grupo.itens.filter(i => i.concluido).length
          const gpct = grupo.itens.length ? Math.round(feitos / grupo.itens.length * 100) : 0
          return (
            <button key={grupo.id} onClick={() => setAmbienteSelecionado(grupo.id)} style={{ textAlign: 'left', background: ativo.id === grupo.id ? THEME.ink : THEME.card, color: ativo.id === grupo.id ? '#fff' : THEME.ink, border: `1px solid ${ativo.id === grupo.id ? THEME.ink : THEME.border}`, borderRadius: 14, padding: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{grupo.nome}</div>
              <div style={{ fontSize: 12, color: ativo.id === grupo.id ? '#e8e0d5' : THEME.muted, marginBottom: 8 }}>{feitos} de {grupo.itens.length} itens</div>
              <div style={{ height: 5, background: ativo.id === grupo.id ? 'rgba(255,255,255,.22)' : THEME.border, borderRadius: 99 }}>
                <div style={{ height: 5, width: `${gpct}%`, background: THEME.gold, borderRadius: 99 }} />
              </div>
            </button>
          )
        })}
      </div>

      <Card titulo={`Checklist - ${ativo.nome}`}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          <select value={ativo.id} onChange={e => setAmbienteSelecionado(e.target.value)} style={{ background: THEME.inputBackground, border: '1px solid ' + THEME.inputBorder, color: THEME.inputText, borderRadius: 8, padding: '10px 14px', width: '100%', fontSize: 14, outline: 'none', minWidth: 180, flex: '0 1 220px', fontFamily: 'inherit' }}>
            {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
          <input value={novoItem} onChange={e => setNovoItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && adicionar()} placeholder="Novo item do checklist..." style={{ background: THEME.inputBackground, border: '1px solid ' + THEME.inputBorder, color: THEME.inputText, borderRadius: 8, padding: '10px 14px', width: '100%', fontSize: 14, outline: 'none', flex: '1 1 240px', fontFamily: 'inherit', minWidth: 0 }} />
          <button onClick={adicionar} disabled={salvando || !novoItem.trim()} style={{ background: THEME.ink, color: '#fff', border: 'none', borderRadius: 9, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Adicionar</button>
        </div>

        {loading ? <div style={{ color: '#bbb' }}>Carregando...</div>
          : itens.length === 0 ? <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhum item no checklist.</div>
          : ativo.itens.length === 0 ? <div style={{ textAlign: 'center', padding: '36px 0', color: '#bbb' }}>Nenhum item neste ambiente.</div>
          : ativo.itens.map(item => {
            const destaque = checklistDestaque && item.id === checklistDestaque
            return (
            <div key={item.id} data-destaque-id={item.id} onClick={() => toggle(item)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 12px', border: destaque ? `2px solid ${THEME.gold}` : 'none', borderBottom: destaque ? `2px solid ${THEME.gold}` : `1px solid ${THEME.border}`, borderRadius: destaque ? 12 : 0, background: destaque ? '#FFFBF2' : 'transparent', cursor: 'pointer' }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, border: '2px solid ' + (item.concluido ? '#5aab6e' : THEME.border), background: item.concluido ? '#5aab6e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {item.concluido && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>v</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: item.concluido ? '#aaa' : THEME.ink, textDecoration: item.concluido ? 'line-through' : 'none', fontWeight: 600 }}>{item.descricao}</div>
                {item.concluido_em && <div style={{ fontSize: 11, color: THEME.muted, marginTop: 3 }}>Concluído em {new Date(item.concluido_em).toLocaleString('pt-BR')}</div>}
              </div>
            </div>
          )})
        }
      </Card>
    </div>
  )
}
function AbaOcorrencias({ obraId, ocorrenciaDestaque }) {
  const { user } = useStore()
  const [ocorrencias, setOcorrencias] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [nova, setNova] = useState({ titulo: '', descricao: '', categoria: 'geral', gravidade: 'baixa' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar() }, [])
  useEffect(() => {
    if (!loading && ocorrenciaDestaque) rolarParaDestaque(ocorrenciaDestaque)
  }, [loading, ocorrenciaDestaque])
  async function carregar() {
    setErro('')
    const { data, error } = await supabase.from('ocorrencias').select('*, responsavel:profiles!ocorrencias_responsavel_id_fkey(full_name)').eq('obra_id', obraId).order('created_at', { ascending: false })
    if (error) setErro(mensagemErro(error, 'Nao foi possivel carregar as ocorrencias da obra.'))
    setOcorrencias(data || []); setLoading(false)
  }
  async function salvar() {
    if (!nova.titulo.trim()) return
    setSalvando(true)
    setErro('')
    const { data: criada, error } = await supabase.from('ocorrencias').insert([{ ...nova, obra_id: obraId }]).select().single()
    if (error) {
      setErro(mensagemErro(error, 'Não foi possível registrar a ocorrência.'))
      setSalvando(false)
      return
    }
    await criarNotificacoesObra({
      obraId,
      tipo: 'ocorrencia',
      titulo: nova.gravidade === 'alta' ? 'Ocorrência crítica criada' : 'Ocorrência criada',
      descricao: nova.titulo,
      prioridade: nova.gravidade === 'alta' ? 'alta' : 'normal',
      entidadeTipo: 'ocorrencias',
      entidadeId: criada?.id,
      rota: `/obras/${obraId}?aba=Ocorrencias${criada?.id ? `&ocorrencia=${criada.id}` : ''}`,
      excluirUsuarioId: user?.id,
    })
    setNova({ titulo: '', descricao: '', categoria: 'geral', gravidade: 'baixa' })
    setShowForm(false); await carregar(); setSalvando(false)
  }
  const gravCor = { baixa: '#5aab6e', media: '#b09a7a', alta: '#d94a4a' }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: THEME.gold, textTransform: 'uppercase', fontWeight: 800 }}>Ocorrências</div>
          <div style={{ fontSize: 20, color: THEME.ink, fontWeight: 800, marginTop: 4 }}>Registro da obra</div>
        </div>
        <button onClick={() => { setErro(''); setShowForm(!showForm) }} style={{ background: 'var(--color-ink)', color: '#f9f7f4', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>{showForm ? 'Cancelar' : '+ Nova Ocorrência'}</button>
      </div>
      {erro && <div style={{ background: '#fdecea', color: '#a03030', borderLeft: '3px solid #d94a4a', borderRadius: 8, padding: '10px 12px', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>{erro}</div>}
      {showForm && (
        <div style={{ background: THEME.card, border: '1px solid ' + THEME.border, borderRadius: 12, padding: 22, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><Label>Título *</Label><FInput value={nova.titulo} onChange={v => setNova(p => ({ ...p, titulo: v }))} placeholder="Descreva a ocorrência" /></div>
            <div style={{ gridColumn: '1/-1' }}><Label>Detalhes</Label><textarea value={nova.descricao} onChange={e => setNova(p => ({ ...p, descricao: e.target.value }))} rows={3} style={textareaStyle} /></div>
            <div><Label>Categoria</Label><FSelect value={nova.categoria} onChange={v => setNova(p => ({ ...p, categoria: v }))}><option value="geral">Geral</option><option value="atraso">Atraso</option><option value="dano">Dano</option><option value="retrabalho">Retrabalho</option><option value="acesso">Acesso</option><option value="material">Material faltante</option></FSelect></div>
            <div><Label>Gravidade</Label><FSelect value={nova.gravidade} onChange={v => setNova(p => ({ ...p, gravidade: v }))}><option value="baixa">Baixa</option><option value="media">Media</option><option value="alta">Alta</option></FSelect></div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={salvar} disabled={salvando} style={{ background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{salvando ? 'Salvando...' : 'Registrar'}</button>
          </div>
        </div>
      )}
      {loading ? <div style={{ color: '#bbb' }}>Carregando...</div>
        : ocorrencias.length === 0 ? <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhuma ocorrência registrada.</div>
        : ocorrencias.map(oc => {
          const destaque = ocorrenciaDestaque && oc.id === ocorrenciaDestaque
          return (
          <div key={oc.id} data-destaque-id={oc.id} style={{ background: destaque ? THEME.elevated : THEME.card, border: destaque ? `2px solid ${THEME.gold}` : '1px solid ' + THEME.border, borderLeft: '4px solid ' + (gravCor[oc.gravidade] || '#ccc'), borderRadius: 10, padding: '16px 18px', marginBottom: 10, boxShadow: destaque ? '0 12px 30px rgba(184,150,94,.16)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' }}>{oc.titulo}</span>
              <span style={{ fontSize: 10, padding: '2px 9px', borderRadius: 20, background: '#f0ece6', color: '#888', marginLeft: 'auto' }}>{oc.categoria}</span>
              <span style={{ fontSize: 10, padding: '2px 9px', borderRadius: 20, background: (gravCor[oc.gravidade] || '#ccc') + '22', color: gravCor[oc.gravidade] || '#888' }}>{oc.gravidade}</span>
            </div>
            {oc.descricao && <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink-muted)', lineHeight: 1.5 }}>{oc.descricao}</p>}
            <div style={{ fontSize: 11, color: '#bbb', marginTop: 8 }}>{new Date(oc.created_at).toLocaleDateString('pt-BR')}</div>
          </div>
        )})
      }
    </div>
  )
}

function AbaGastos({ obraId, obraInfo, gastoDestaque }) {
  const CATS_G = [
    { value: 'combustivel', label: 'Combustível', emoji: '⛽', cor: '#E8A020' },
    { value: 'pedagio',     label: 'Pedágio',     emoji: '🛣️', cor: '#9070C0' },
    { value: 'hospedagem',  label: 'Hospedagem',  emoji: '🏨', cor: '#4A90D9' },
    { value: 'alimentacao', label: 'Alimentação', emoji: '🍽️', cor: '#5AAB6E' },
    { value: 'frete',       label: 'Frete',       emoji: '🚚', cor: '#D9704A' },
    { value: 'terceiros',   label: 'Terceiros',   emoji: '👷', cor: '#B09A7A' },
    { value: 'ferragens',   label: 'Ferragens',   emoji: '🔧', cor: '#888'    },
    { value: 'material',    label: 'Material',    emoji: '📦', cor: '#6A8A6A' },
    { value: 'outro',       label: 'Outros',      emoji: '📋', cor: '#AAA'    },
  ]
  const CAT_G = Object.fromEntries(CATS_G.map(c => [c.value, c]))
  const msG = {
    bg:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    box:     { background: THEME.card, border: '1px solid ' + THEME.border, borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
    header:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 26px 0', flexShrink: 0 },
    title:   { fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500, margin: 0, color: 'var(--color-ink)' },
    close:   { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999', padding: 4 },
    body:    { overflowY: 'auto', padding: '18px 26px', flex: 1 },
    label:   { display: 'block', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: '#888', marginBottom: 6, fontWeight: 700 },
    input:   { background: THEME.inputBackground, border: '1px solid ' + THEME.inputBorder, color: THEME.inputText, borderRadius: 8, padding: '10px 14px', width: '100%', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
    upload:  { display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px dashed ' + THEME.inputBorder, borderRadius: 8, padding: 16, cursor: 'pointer', background: THEME.inputBackground, width: '100%', boxSizing: 'border-box' },
    footer:  { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 26px', borderTop: '1px solid ' + THEME.border, flexShrink: 0 },
    btnCan:  { background: THEME.elevated, border: '1px solid ' + THEME.border, borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', color: THEME.ink, fontFamily: 'inherit' },
    btnSave: { background: THEME.gold, color: '#141210', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
    btnDel:  { background: '#fdecea', color: '#a03030', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginRight: 'auto' },
  }

  const hoje = new Date().toISOString().split('T')[0]
  const [gastos,      setGastos]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [gastoEdit,   setGastoEdit]   = useState(null)
  const [form,        setForm]        = useState({ descricao: '', valor: '', categoria: 'combustivel', data: hoje, observacao: '' })
  const [arquivo,     setArquivo]     = useState(null)
  const [salvando,    setSalvando]    = useState(false)
  const [erro,        setErro]        = useState('')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar() }, [])
  useEffect(() => {
    if (!loading && gastoDestaque) rolarParaDestaque(gastoDestaque)
  }, [gastoDestaque, loading])

  async function carregar() {
    const { data } = await supabase.from('gastos').select('*').eq('obra_id', obraId).order('created_at', { ascending: false })
    setGastos(data || []); setLoading(false)
  }

  function abrirNovo() {
    setGastoEdit(null)
    setForm({ descricao: '', valor: '', categoria: 'combustivel', data: hoje, observacao: '' })
    setArquivo(null); setErro(''); setModalAberto(true)
  }

  function abrirEditar(g) {
    setGastoEdit(g)
    setForm({ descricao: g.descricao || '', valor: String(g.valor || ''), categoria: g.categoria || 'combustivel', data: g.data || hoje, observacao: g.observacao || '' })
    setArquivo(null); setErro(''); setModalAberto(true)
  }

  function fechar() { setModalAberto(false); setGastoEdit(null); setErro('') }

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function salvar() {
    if (!form.descricao.trim() || !form.valor || !form.data) { setErro('Preencha descricao, valor e data.'); return }
    const vNum = parseFloat(String(form.valor).replace(',', '.'))
    if (isNaN(vNum) || vNum <= 0) { setErro('Valor invalido.'); return }
    setSalvando(true)
    setErro('')
    try {
      if (gastoEdit) {
        const { error } = await supabase.from('gastos').update({ descricao: form.descricao.trim(), valor: vNum, categoria: form.categoria, data: form.data || null, observacao: form.observacao || null }).eq('id', gastoEdit.id)
        if (error) throw error
      } else {
        const { data: ins, error } = await supabase.from('gastos').insert([{ obra_id: obraId, descricao: form.descricao.trim(), valor: vNum, categoria: form.categoria, data: form.data, observacao: form.observacao || null, status: 'aprovado' }]).select().single()
        if (error) throw error
        if (!ins?.id) throw new Error('Gasto registrado sem identificador para anexar comprovante.')
        if (arquivo) {
          const ext = arquivo.name.split('.').pop()
          const { error: uploadError } = await supabase.storage.from('fotos-obras').upload('gastos/' + ins.id + '.' + ext, arquivo)
          if (uploadError) {
            setErro('Gasto registrado, mas não foi possível anexar o comprovante: ' + mensagemErro(uploadError))
            setSalvando(false)
            await carregar()
            return
          }
        }
      }
      setSalvando(false); fechar(); carregar()
    } catch (error) {
      setErro(mensagemErro(error, 'Não foi possível salvar o gasto.'))
      setSalvando(false)
    }
  }

  async function deletar(g) {
    if (!window.confirm('Excluir este gasto?')) return
    setSalvando(true)
    setErro('')
    const { error } = await supabase.from('gastos').delete().eq('id', g.id)
    setSalvando(false)
    if (error) {
      setErro(mensagemErro(error, 'Não foi possível excluir o gasto.'))
      return
    }
    fechar(); carregar()
  }

  const total    = gastos.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0)
  const meta     = parseFloat(obraInfo?.gasto_meta) || 0
  const pctGasto = meta > 0 ? Math.min(Math.round(total / meta * 100), 100) : 0
  const corGasto = pctGasto >= 90 ? '#d94a4a' : pctGasto >= 70 ? '#b09a7a' : '#5aab6e'

  return (
    <>
      {modalAberto && (
        <div style={msG.bg} onClick={e => e.target === e.currentTarget && fechar()}>
          <div style={msG.box}>
            <div style={msG.header}>
              <h2 style={msG.title}>{gastoEdit ? 'Editar Gasto' : 'Novo Gasto'}</h2>
              <button style={msG.close} onClick={fechar}>✕</button>
            </div>
            <div style={msG.body}>
              {erro && <div style={{ background: '#fceee9', borderLeft: '3px solid #c4421e', color: '#5c2010', padding: '10px 14px', borderRadius: 6, fontSize: 12, marginBottom: 16 }}>{erro}</div>}
              {obraInfo && (
                <div style={{ background: '#f9f7f4', border: '1px solid #e8d9b8', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: 'var(--color-gold)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Obra vinculada</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-ink)' }}>{obraInfo.nome || obraInfo.cliente_nome}</div>
                  {obraInfo.gasto_meta && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>Meta: R$ {parseFloat(obraInfo.gasto_meta).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={msG.label}>Descrição *</label>
                  <input style={msG.input} value={form.descricao} onChange={e => setF('descricao', e.target.value)} placeholder="Ex: combustível ida à obra..." />
                </div>
                <div>
                  <label style={msG.label}>Categoria *</label>
                  <select style={msG.input} value={form.categoria} onChange={e => setF('categoria', e.target.value)}>
                    {CATS_G.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={msG.label}>Valor (R$) *</label>
                  <input style={msG.input} value={form.valor} onChange={e => setF('valor', e.target.value)} placeholder="0,00" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={msG.label}>Data *</label>
                  <input style={msG.input} type="date" value={form.data} onChange={e => setF('data', e.target.value)} />
                </div>
                {!gastoEdit && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={msG.label}>Comprovante (foto ou PDF)</label>
                    <label style={msG.upload}>
                      <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => setArquivo(e.target.files[0])} />
                      {arquivo ? <span style={{ color: 'var(--color-ink)', fontSize: 13 }}>📎 {arquivo.name}</span> : <span style={{ color: '#aaa', fontSize: 13 }}>📎 Toque para anexar comprovante</span>}
                    </label>
                  </div>
                )}
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={msG.label}>Observação</label>
                  <textarea style={{ ...msG.input, height: 64, resize: 'vertical' }} value={form.observacao} onChange={e => setF('observacao', e.target.value)} placeholder="Informações adicionais..." />
                </div>
              </div>
            </div>
            <div style={msG.footer}>
              {gastoEdit && <button style={msG.btnDel} onClick={() => deletar(gastoEdit)}>Excluir</button>}
              <button style={msG.btnCan} onClick={fechar}>Cancelar</button>
              <button style={msG.btnSave} onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : gastoEdit ? 'Salvar alteracoes' : 'Registrar Gasto'}</button>
            </div>
          </div>
        </div>
      )}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: THEME.gold, textTransform: 'uppercase', fontWeight: 800 }}>Gastos</div>
            <div style={{ fontSize: 20, color: THEME.ink, fontWeight: 800, marginTop: 4 }}>Controle financeiro da obra</div>
          </div>
          <button onClick={abrirNovo} style={{ background: THEME.gold, color: '#141210', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Lançar Gasto</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: meta > 0 ? '1fr 1fr 1fr' : '1fr', gap: 12, marginBottom: 20, alignItems: 'center' }}>
          <div style={{ background: THEME.card, border: '1px solid ' + THEME.border, borderRadius: 10, padding: '14px 20px' }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 4 }}>Total gasto</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-ink)' }}>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
          {meta > 0 && (
            <>
              <div style={{ background: THEME.card, border: '1px solid ' + THEME.border, borderRadius: 10, padding: '14px 20px' }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 4 }}>Meta / Limite</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-ink)' }}>R$ {meta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </div>
              <div style={{ background: pctGasto >= 90 ? '#fdecea' : THEME.card, border: '1px solid ' + THEME.border, borderRadius: 10, padding: '14px 20px' }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: pctGasto >= 90 ? '#d94a4a' : 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 4 }}>Utilizado</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: corGasto }}>{pctGasto}%</div>
                <div style={{ height: 4, background: '#f0ece6', borderRadius: 2, marginTop: 8 }}><div style={{ height: 4, borderRadius: 2, background: corGasto, width: pctGasto + '%', transition: 'width .3s' }} /></div>
              </div>
            </>
          )}
        </div>
        {loading ? <div style={{ color: '#bbb' }}>Carregando...</div>
          : gastos.length === 0 ? <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhum gasto registrado.</div>
          : gastos.map(g => {
            const destaque = gastoDestaque && g.id === gastoDestaque
            return (
            <div id={`gasto-${g.id}`} data-destaque-id={g.id} key={g.id} onClick={() => abrirEditar(g)} style={{ background: destaque ? THEME.elevated : THEME.card, border: destaque ? `2px solid ${THEME.gold}` : '1px solid ' + THEME.border, borderRadius: 10, padding: '14px 18px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', boxShadow: destaque ? '0 16px 34px rgba(184,150,94,0.22)' : 'none' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: CAT_G[g.categoria]?.cor || '#ccc', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-ink)' }}>{g.descricao}</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>{CAT_G[g.categoria]?.emoji} {CAT_G[g.categoria]?.label || g.categoria}{g.data ? ' · ' + new Date(g.data + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</div>
                {g.observacao && <div style={{ fontSize: 11, color: '#bbb', marginTop: 2, fontStyle: 'italic' }}>{g.observacao}</div>}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-ink)' }}>R$ {parseFloat(g.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <span style={{ fontSize: 12, color: '#aaa' }}>✏️</span>
            </div>
            )
          })
        }
      </div>
    </>
  )
}
function AbaChat({ obraId }) {
  const { user } = useStore()
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar() }, [])
  async function carregar() {
    const { data } = await supabase.from('mensagens_obra').select('*, autor:profiles(full_name, role)').eq('obra_id', obraId).order('created_at', { ascending: true })
    setMensagens(data || []); setLoading(false)
  }
  async function enviar() {
    if (!texto.trim()) return
    setEnviando(true)
    setErro('')
    const { error } = await supabase.from('mensagens_obra').insert([{ obra_id: obraId, user_id: user.id, mensagem: texto.trim() }])
    if (error) {
      setErro(mensagemErro(error, 'Não foi possível enviar a mensagem.'))
      setEnviando(false)
      return
    }
    setTexto(''); await carregar(); setEnviando(false)
  }
  const ROLE_COR = { gestao: '#3a5580', supervisor: '#3a7d4f', montador: '#b09a7a', cliente: '#888', vendedor: '#9070c0' }
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 16 }}>Chat da obra — visível para toda a equipe</div>
      <div style={{ background: THEME.card, border: '1px solid ' + THEME.border, borderRadius: 12, padding: 16, marginBottom: 16, minHeight: 200, maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? <div style={{ color: '#bbb', fontSize: 13 }}>Carregando...</div>
          : mensagens.length === 0 ? <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb', fontSize: 13 }}>Nenhuma mensagem ainda.</div>
          : mensagens.map(m => {
            const isMe = m.user_id === user?.id
            const cor = ROLE_COR[m.autor?.role] || '#888'
            const ini = (m.autor?.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
            return (
              <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: cor + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: cor, flexShrink: 0 }}>{ini}</div>
                <div style={{ maxWidth: '70%' }}>
                  <div style={{ fontSize: 10, color: '#aaa', marginBottom: 3, textAlign: isMe ? 'right' : 'left' }}>{m.autor?.full_name || 'Usuário'} · {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                  <div style={{ background: isMe ? 'var(--color-ink)' : '#f5f2ee', color: isMe ? '#f9f7f4' : 'var(--color-ink)', borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px', padding: '10px 14px', fontSize: 13, lineHeight: 1.5 }}>{m.mensagem}</div>
                </div>
              </div>
            )
          })}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <input value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()} placeholder="Escreva uma mensagem..." style={{ background: THEME.inputBackground, border: '1px solid ' + THEME.inputBorder, color: THEME.inputText, borderRadius: 8, padding: '10px 14px', width: '100%', fontSize: 14, outline: 'none', flex: 1, fontFamily: 'inherit' }} />
        <button onClick={enviar} disabled={enviando || !texto.trim()} style={{ background: 'var(--color-ink)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{enviando ? '...' : 'Enviar'}</button>
      </div>
      {erro && <div style={{ color: THEME.danger, fontSize: 12, fontWeight: 700, marginTop: 8 }}>{erro}</div>}
    </div>
  )
}

function AbaFotos({ obraId, fotoDestaque }) {
  const { user } = useStore()
  const [fotos, setFotos] = useState([])
  const [ambientes, setAmbientes] = useState([])
  const [agendaVistorias, setAgendaVistorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState({ texto: '', tipo: 'ok' })
  const [preview, setPreview] = useState(null)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroAmbiente, setFiltroAmbiente] = useState('')
  const [filtroAprovacao, setFiltroAprovacao] = useState('')
  const [formFoto, setFormFoto] = useState({ categoria: '', ambiente_id: '', agenda_id: '', observacao: '', visivel_cliente: false })
  const mostrarMensagem = (texto, tipo = 'ok') => {
    setMensagem({ texto, tipo })
    if (tipo === 'erro') setErro(texto)
    else setErro('')
  }
  async function carregar() {
    setErro('')
    const [fotosResult, ambientesResult, vistoriasResult] = await Promise.all([
      supabase.from('fotos').select('*').eq('obra_id', obraId).order('created_at', { ascending: false }),
      supabase.from('obra_ambientes').select('id, nome').eq('obra_id', obraId),
      supabase.from('agenda').select('id, titulo, tipo, data, hora_inicio, status').eq('obra_id', obraId).ilike('tipo', '%vistoria%').order('data', { ascending: false }),
    ])
    const falha = [fotosResult, ambientesResult, vistoriasResult].find(result => result.error)
    if (falha?.error) setErro(mensagemErro(falha.error, 'Nao foi possivel carregar as fotos da obra.'))
    setFotos((fotosResult.data || []).map(f => ({ ...f, categoria: f.categoria || 'Geral', publicUrl: fotoUrl(f) })))
    setAmbientes(ambientesResult.data || [])
    setAgendaVistorias(vistoriasResult.data || [])
    setLoading(false)
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { carregar() }, [])
  useEffect(() => {
    if (!loading && fotoDestaque) rolarParaDestaque(fotoDestaque)
  }, [fotoDestaque, loading])
  async function handleUpload(e) {
    const file = e.target.files[0]; if (!file) return
    if (!formFoto.categoria) {
      mostrarMensagem('Selecione uma categoria antes de enviar a foto.', 'erro')
      e.target.value = ''
      return
    }
    setUploading(true)
    setErro('')
    setMensagem({ texto: 'Enviando foto...', tipo: 'info' })
    const ext = file.name.split('.').pop()
    const path = obraId + '/' + Date.now() + '.' + ext
    const { error: upErr } = await supabase.storage.from('fotos-obras').upload(path, file)
    if (upErr) {
      setErro(mensagemErro(upErr, 'Não foi possível enviar a foto.'))
    } else {
      const { error: insertError } = await supabase.from('fotos').insert([{
          obra_id: obraId,
          enviada_por: user?.id || null,
          storage_path: path,
          categoria: formFoto.categoria,
          ambiente_id: formFoto.ambiente_id || null,
          agenda_id: formFoto.agenda_id || null,
          observacao: formFoto.observacao || file.name,
          visivel_cliente: false,
          aprovada: false,
          aprovada_gestao: false,
          visibilidade: 'interna',
        }])
      if (insertError) {
        setErro(mensagemErro(insertError, 'A foto foi enviada, mas não foi vinculada à obra.'))
        setUploading(false); e.target.value = ''
        return
      }
      setFormFoto({ categoria: '', ambiente_id: '', agenda_id: '', observacao: '', visivel_cliente: false })
      await carregar()
      mostrarMensagem('Foto enviada e aguardando aprovacao antes de liberar ao cliente.', 'ok')
    }
    setUploading(false); e.target.value = ''
  }
  async function aprovar(foto) {
    const aprovado = !foto.aprovada
    setErro('')
    setMensagem({ texto: aprovado ? 'Aprovando foto...' : 'Movendo foto para revisao...', tipo: 'info' })
    const { error } = await supabase.from('fotos').update({
      aprovada: aprovado,
      aprovada_gestao: aprovado,
      aprovada_por: aprovado ? user?.id : null,
      aprovada_em: aprovado ? new Date().toISOString() : null,
      ...(!aprovado ? { visivel_cliente: false, visibilidade: 'interna' } : {}),
    }).eq('id', foto.id)
    if (error) {
      setErro(mensagemErro(error, 'Não foi possível atualizar a aprovação da foto.'))
      return
    }
    await criarNotificacoesObra({
      obraId,
      tipo: 'foto',
      titulo: aprovado ? 'Foto aprovada' : 'Foto voltou para revisão',
      descricao: [foto.categoria || 'Foto', foto.observacao].filter(Boolean).join(' · '),
      prioridade: aprovado ? 'normal' : 'media',
      entidadeTipo: 'fotos',
      entidadeId: foto.id,
      rota: `/obras/${obraId}?aba=Fotos&foto=${foto.id}`,
      excluirUsuarioId: user?.id,
    })
    await carregar()
    mostrarMensagem(aprovado ? 'Foto aprovada. Agora ela pode ser liberada ao cliente.' : 'Foto voltou para revisao e foi ocultada do cliente.', 'ok')
  }
  async function alternarCliente(foto) {
    setErro('')
    if (!foto.visivel_cliente && !fotoAprovadaParaCliente(foto)) {
      mostrarMensagem('Aprove a foto antes de liberar a visibilidade para o cliente.', 'erro')
      return
    }
    setMensagem({ texto: foto.visivel_cliente ? 'Ocultando foto do cliente...' : 'Liberando foto para o cliente...', tipo: 'info' })
    const { error } = await supabase.from('fotos').update({
      visivel_cliente: !foto.visivel_cliente,
      visibilidade: !foto.visivel_cliente ? 'cliente' : 'interna',
    }).eq('id', foto.id)
    if (error) {
      setErro(mensagemErro(error, 'Não foi possível atualizar a visibilidade da foto.'))
      return
    }
    await carregar()
    mostrarMensagem(foto.visivel_cliente ? 'Foto ocultada do cliente.' : 'Foto liberada no portal do cliente.', 'ok')
  }
  async function deletar(foto) {
    setErro('')
    setMensagem({ texto: 'Excluindo foto...', tipo: 'info' })
    const { error } = await supabase.from('fotos').delete().eq('id', foto.id)
    if (error) {
      setErro(mensagemErro(error, 'Não foi possível excluir a foto.'))
      return
    }
    await carregar()
    mostrarMensagem('Foto excluida da obra.', 'ok')
  }
  const ambienteNome = ambienteId => ambientes.find(a => a.id === ambienteId)?.nome || 'Sem ambiente'
  const filtradas = fotos.filter(f => {
    if (filtroCategoria && (f.categoria || 'Geral') !== filtroCategoria) return false
    if (filtroAmbiente === 'sem' && f.ambiente_id) return false
    if (filtroAmbiente && filtroAmbiente !== 'sem' && f.ambiente_id !== filtroAmbiente) return false
    if (filtroAprovacao === 'aprovadas' && !f.aprovada) return false
    if (filtroAprovacao === 'pendentes' && f.aprovada) return false
    return true
  })
  const gruposFotos = FOTO_CATEGORIAS.map(categoria => ({
    categoria,
    fotos: filtradas.filter(f => (f.categoria || 'Geral') === categoria),
  })).filter(g => g.fotos.length > 0)
  const naoConformidades = fotos.filter(f => (f.categoria || 'Geral') === 'Não conformidade').length
  return (
    <div>
      {preview && <div onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}><img src={preview} alt="preview" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} /></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 18 }}>
        <KpiCard label="Total" value={fotos.length} helper="fotos da obra" />
        <KpiCard label="Aprovadas" value={fotos.filter(f => f.aprovada).length} helper="liberadas" />
        <KpiCard label="Cliente" value={fotos.filter(f => f.visivel_cliente).length} helper="visíveis ao cliente" />
        <KpiCard label="Não conform." value={naoConformidades} helper="registros críticos" />
      </div>

      <Card titulo="Enviar foto">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div><Label>Categoria *</Label><FSelect value={formFoto.categoria} onChange={v => setFormFoto(p => ({ ...p, categoria: v }))}><option value="">Selecione</option>{FOTO_CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}</FSelect></div>
          <div><Label>Ambiente</Label><FSelect value={formFoto.ambiente_id} onChange={v => setFormFoto(p => ({ ...p, ambiente_id: v }))}><option value="">Sem ambiente</option>{ambientes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</FSelect></div>
          {formFoto.categoria === 'Vistoria' && (
            <div><Label>Vistoria vinculada</Label><FSelect value={formFoto.agenda_id} onChange={v => setFormFoto(p => ({ ...p, agenda_id: v }))}><option value="">Sem vínculo</option>{agendaVistorias.map(v => <option key={v.id} value={v.id}>{v.titulo || 'Vistoria'}{v.data ? ` - ${new Date(v.data + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}</option>)}</FSelect></div>
          )}
          <div><Label>Observação</Label><FInput value={formFoto.observacao} onChange={v => setFormFoto(p => ({ ...p, observacao: v }))} placeholder="Opcional" /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: THEME.muted }}>
            <input type="checkbox" checked={formFoto.visivel_cliente} onChange={e => setFormFoto(p => ({ ...p, visivel_cliente: e.target.checked }))} />
            Visível ao cliente após aprovação
          </label>
          <label style={{ background: formFoto.categoria ? THEME.ink : THEME.muted, color: theme.textOnAccent, borderRadius: 9, padding: '10px 18px', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', fontSize: 13, fontWeight: 700, cursor: formFoto.categoria ? 'pointer' : 'not-allowed' }}>
            {uploading ? 'Enviando...' : 'Selecionar e enviar'}
            <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading || !formFoto.categoria} />
          </label>
        </div>
        {(mensagem.texto || erro) && <div style={{ color: (mensagem.tipo === 'erro' || erro) ? THEME.danger : mensagem.tipo === 'info' ? THEME.warning : THEME.success, background: (mensagem.tipo === 'erro' || erro) ? THEME.dangerBg : mensagem.tipo === 'info' ? THEME.warningBg : THEME.successBg, border: `1px solid ${(mensagem.tipo === 'erro' || erro) ? THEME.danger : mensagem.tipo === 'info' ? THEME.warning : THEME.success}`, borderRadius: 10, padding: '10px 12px', fontSize: 12, fontWeight: 800, marginTop: 10 }}>{erro || mensagem.texto}</div>}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, margin: '18px 0' }}>
        <FSelect value={filtroCategoria} onChange={setFiltroCategoria}><option value="">Todas as categorias</option>{FOTO_CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}</FSelect>
        <FSelect value={filtroAmbiente} onChange={setFiltroAmbiente}><option value="">Todos os ambientes</option><option value="sem">Sem ambiente</option>{ambientes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</FSelect>
        <FSelect value={filtroAprovacao} onChange={setFiltroAprovacao}><option value="">Todas</option><option value="aprovadas">Aprovadas</option><option value="pendentes">Pendentes</option></FSelect>
      </div>

      {loading ? <div style={{ color: '#bbb' }}>Carregando...</div>
        : fotos.length === 0 ? <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhuma foto enviada.</div>
        : gruposFotos.length === 0 ? <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb' }}>Nenhuma foto encontrada com estes filtros.</div>
        : gruposFotos.map(grupo => (
          <div key={grupo.categoria} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: THEME.gold, textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>{grupo.categoria}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {grupo.fotos.map(foto => {
                const destaque = fotoDestaque && foto.id === fotoDestaque
                const liberavelCliente = fotoAprovadaParaCliente(foto)
                return (
                <div key={foto.id} data-destaque-id={foto.id} style={{ background: destaque ? theme.app.surfaceWarm : THEME.card, border: destaque ? `2px solid ${THEME.gold}` : `1px solid ${THEME.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: destaque ? '0 14px 34px rgba(184,150,94,.18)' : 'none' }}>
                  <div onClick={() => foto.publicUrl && setPreview(foto.publicUrl)} style={{ cursor: 'zoom-in', height: 170, overflow: 'hidden', background: THEME.elevated }}>{foto.publicUrl && <img src={foto.publicUrl} alt={foto.observacao || foto.categoria} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 12, color: THEME.ink, fontWeight: 700, marginBottom: 4 }}>{ambienteNome(foto.ambiente_id)}</div>
                    <div style={{ fontSize: 11, color: THEME.muted, marginBottom: 8, minHeight: 16 }}>{foto.observacao || 'Sem observação'}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => aprovar(foto)} style={{ flex: '1 1 90px', minHeight: 44, padding: '8px 10px', borderRadius: 7, border: 'none', fontSize: 11, cursor: 'pointer', background: foto.aprovada ? THEME.successBg : THEME.elevated, color: foto.aprovada ? THEME.success : THEME.muted, fontWeight: 700 }}>{foto.aprovada ? 'Aprovada' : 'Aprovar'}</button>
                      <button onClick={() => alternarCliente(foto)} style={{ flex: '1 1 90px', minHeight: 44, padding: '8px 10px', borderRadius: 7, border: 'none', fontSize: 11, cursor: liberavelCliente || foto.visivel_cliente ? 'pointer' : 'not-allowed', background: foto.visivel_cliente ? THEME.softGold : THEME.elevated, color: foto.visivel_cliente ? THEME.gold : THEME.muted, fontWeight: 700 }}>Cliente</button>
                      <button onClick={() => deletar(foto)} style={{ padding: '8px 12px', minHeight: 44, borderRadius: 7, border: 'none', fontSize: 11, cursor: 'pointer', background: THEME.dangerBg, color: THEME.danger, fontWeight: 900 }}>X</button>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          </div>
        ))
      }
    </div>
  )
}

function AbaHistorico({ obraId }) {
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  async function carregar() {
    setErro('')
    const [historicoResult, checkinsResult] = await Promise.all([
      supabase.from('historico_obra').select('*, profiles(full_name)').eq('obra_id', obraId).order('created_at', { ascending: false }),
      supabase.from('checkins').select('id, user_id, entrada, saida, created_at').eq('obra_id', obraId).order('created_at', { ascending: false }),
    ])
    const falha = [historicoResult, checkinsResult].find(result => result.error)
    if (falha?.error) setErro(mensagemErro(falha.error, 'Nao foi possivel carregar todo o historico da obra.'))
    const historicoLinhas = (historicoResult.data || []).map(item => ({
      ...item,
      tipoLinha: 'Historico',
      dataLinha: item.created_at,
      tituloLinha: item.descricao || item.acao || 'Registro',
      detalheLinha: item.profiles?.full_name || '',
    }))
    const checkinLinhas = (checkinsResult.data || []).map(item => ({
      id: `checkin-${item.id}`,
      created_at: item.entrada || item.created_at,
      descricao: item.saida ? 'Check-in e check-out registrados' : 'Check-in em aberto',
      profiles: {
        full_name: [
          item.entrada ? `Entrada ${new Date(item.entrada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '',
          item.saida ? `Saida ${new Date(item.saida).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '',
        ].filter(Boolean).join(' - '),
      },
      tipoLinha: 'Check-in',
      dataLinha: item.entrada || item.created_at,
      tituloLinha: item.saida ? 'Check-in e check-out registrados' : 'Check-in em aberto',
      detalheLinha: [
        item.entrada ? `Entrada ${new Date(item.entrada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '',
        item.saida ? `Saida ${new Date(item.saida).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '',
      ].filter(Boolean).join(' - '),
    }))
    setHistorico([...historicoLinhas, ...checkinLinhas].sort((a, b) => new Date(b.dataLinha || 0) - new Date(a.dataLinha || 0)))
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { carregar() }, [])

  if (loading) return <div style={{ color: '#bbb' }}>Carregando...</div>
  if (historico.length === 0) return <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhum registro no histórico.</div>
  return (
    <div style={{ position: 'relative', paddingLeft: 24 }}>
      {erro && <div style={{ background: '#FFF7F7', color: THEME.danger, border: `1px solid ${THEME.danger}`, borderRadius: 10, padding: '10px 12px', fontSize: 12.5, fontWeight: 800, marginBottom: 12 }}>{erro}</div>}
      <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, background: 'var(--color-border)' }} />
      {historico.map(h => (
        <div key={h.id} style={{ position: 'relative', marginBottom: 20 }}>
          <div style={{ position: 'absolute', left: -21, top: 4, width: 10, height: 10, borderRadius: '50%', background: 'var(--color-gold)', border: '2px solid #fff' }} />
          <div style={{ background: THEME.card, border: '1px solid ' + THEME.border, borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 4 }}>{h.descricao || h.acao || 'Registro'}</div>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#aaa' }}>
              <span>{new Date(h.created_at).toLocaleDateString('pt-BR')} {new Date(h.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              {h.profiles?.full_name && <span>{h.profiles.full_name}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function AbaCliente({ obraId }) {
  const [comunicados, setComunicados] = useState([])
  const [contatos, setContatos] = useState([])
  const [loadingC, setLoadingC] = useState(true)
  const [showComForm, setShowComForm] = useState(false)
  const [showConForm, setShowConForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [novoCom, setNovoCom] = useState({ titulo: '', mensagem: '' })
  const [novoCon, setNovoCon] = useState({ nome: '', cargo: '', telefone: '' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar() }, [])
  async function carregar() {
    const [{ data: c }, { data: ct }] = await Promise.all([
      supabase.from('comunicados_cliente').select('*').eq('obra_id', obraId).order('created_at', { ascending: false }),
      supabase.from('contatos_cliente').select('*').eq('obra_id', obraId),
    ])
    setComunicados(c || []); setContatos(ct || []); setLoadingC(false)
  }
  async function salvarComunicado() {
    if (!novoCom.titulo.trim()) return
    setSalvando(true)
    setErro('')
    const { error } = await supabase.from('comunicados_cliente').insert([{ ...novoCom, obra_id: obraId }])
    if (error) {
      setErro(mensagemErro(error, 'Não foi possível publicar o comunicado.'))
      setSalvando(false)
      return
    }
    setNovoCom({ titulo: '', mensagem: '' }); setShowComForm(false); await carregar(); setSalvando(false)
  }
  async function salvarContato() {
    if (!novoCon.nome.trim()) return
    setSalvando(true)
    setErro('')
    const { error } = await supabase.from('contatos_cliente').insert([{ ...novoCon, obra_id: obraId }])
    if (error) {
      setErro(mensagemErro(error, 'Não foi possível adicionar o contato.'))
      setSalvando(false)
      return
    }
    setNovoCon({ nome: '', cargo: '', telefone: '' }); setShowConForm(false); await carregar(); setSalvando(false)
  }
  async function deletarComunicado(cid) {
    setErro('')
    const { error } = await supabase.from('comunicados_cliente').delete().eq('id', cid)
    if (error) {
      setErro(mensagemErro(error, 'Não foi possível excluir o comunicado.'))
      return
    }
    await carregar()
  }
  const linkPortal = window.location.origin + '/cliente/' + obraId
  return (
    <div>
      <div style={{ background: THEME.card, border: '1px solid ' + THEME.border, borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--color-gold)', fontWeight: 600, marginBottom: 4 }}>Link do Portal do Cliente</div>
          <div style={{ fontSize: 12, color: 'var(--color-ink-muted)', wordBreak: 'break-all' }}>{linkPortal}</div>
        </div>
        <button onClick={() => navigator.clipboard.writeText(linkPortal)} style={{ background: 'var(--color-ink)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>Copiar link</button>
      </div>
      {erro && <div style={{ background: '#fdecea', color: '#a03030', borderLeft: '3px solid #d94a4a', borderRadius: 8, padding: '10px 12px', fontSize: 12, fontWeight: 700, marginBottom: 14 }}>{erro}</div>}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase' }}>Comunicados ao cliente</div>
          <button onClick={() => setShowComForm(!showComForm)} style={{ background: 'var(--color-ink)', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>{showComForm ? 'Cancelar' : '+ Comunicado'}</button>
        </div>
        {showComForm && (
          <div style={{ background: THEME.card, border: '1px solid ' + THEME.border, borderRadius: 10, padding: 18, marginBottom: 14 }}>
            <div style={{ marginBottom: 10 }}><Label>Título</Label><FInput value={novoCom.titulo} onChange={v => setNovoCom(p => ({ ...p, titulo: v }))} placeholder="Título do comunicado" /></div>
            <div style={{ marginBottom: 12 }}><Label>Mensagem</Label><textarea value={novoCom.mensagem} onChange={e => setNovoCom(p => ({ ...p, mensagem: e.target.value }))} rows={3} style={textareaStyle} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={salvarComunicado} disabled={salvando} style={{ background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{salvando ? 'Salvando...' : 'Publicar'}</button></div>
          </div>
        )}
        {loadingC ? <div style={{ color: '#bbb' }}>Carregando...</div>
          : comunicados.length === 0 ? <div style={{ color: '#bbb', fontSize: 13 }}>Nenhum comunicado enviado.</div>
          : comunicados.map(c => (
            <div key={c.id} style={{ background: THEME.card, border: '1px solid ' + THEME.border, borderRadius: 10, padding: '14px 16px', marginBottom: 8, display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 4 }}>{c.titulo}</div>
                <div style={{ fontSize: 13, color: 'var(--color-ink-muted)', lineHeight: 1.5 }}>{c.mensagem}</div>
                <div style={{ fontSize: 11, color: '#bbb', marginTop: 6 }}>{new Date(c.created_at).toLocaleDateString('pt-BR')}</div>
              </div>
              <button onClick={() => deletarComunicado(c.id)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 16, padding: 4, alignSelf: 'flex-start' }}>X</button>
            </div>
          ))
        }
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase' }}>Contatos visíveis ao cliente</div>
          <button onClick={() => setShowConForm(!showConForm)} style={{ background: 'var(--color-ink)', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>{showConForm ? 'Cancelar' : '+ Contato'}</button>
        </div>
        {showConForm && (
          <div style={{ background: THEME.card, border: '1px solid ' + THEME.border, borderRadius: 10, padding: 18, marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><Label>Nome</Label><FInput value={novoCon.nome} onChange={v => setNovoCon(p => ({ ...p, nome: v }))} placeholder="Nome" /></div>
              <div><Label>Cargo</Label><FInput value={novoCon.cargo} onChange={v => setNovoCon(p => ({ ...p, cargo: v }))} placeholder="Ex: Supervisor" /></div>
              <div style={{ gridColumn: '1/-1' }}><Label>Telefone (WhatsApp)</Label><FInput value={novoCon.telefone} onChange={v => setNovoCon(p => ({ ...p, telefone: v }))} placeholder="(48) 99999-9999" /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={salvarContato} disabled={salvando} style={{ background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{salvando ? 'Salvando...' : 'Adicionar'}</button></div>
          </div>
        )}
        {contatos.map(c => (
          <div key={c.id} style={{ background: THEME.card, border: '1px solid ' + THEME.border, borderRadius: 10, padding: '14px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#b09a7a22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#b09a7a' }}>{(c.nome || '?')[0].toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-ink)' }}>{c.nome}</div>
              <div style={{ fontSize: 11.5, color: '#888' }}>{c.cargo}{c.telefone ? ' · ' + c.telefone : ''}</div>
            </div>
            {c.telefone && <a href={'https://wa.me/55' + c.telefone.replace(/[^0-9]/g, '')} target="_blank" rel="noreferrer" style={{ background: '#25D366', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>WhatsApp</a>}
          </div>
        ))}
      </div>
    </div>
  )
}

function AbaEquipeObra({ obraId }) {
  const [montadores, setMontadores] = useState([])
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [adicionando, setAdicionando] = useState(false)
  const [selecionado, setSelecionado] = useState('')
  const [mensagem, setMensagem] = useState(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar() }, [])
  function avisar(tipo, texto) {
    setMensagem({ tipo, texto })
  }
  function erroTexto(error, fallback) {
    return error?.message || error?.details || fallback
  }
  async function notificarMontadorAlocado(montadorId) {
    const { error } = await supabase.from('notificacoes').insert([{
      usuario_id: montadorId,
      obra_id: obraId,
      tipo: 'obra_alocada',
      titulo: 'Você foi alocado em uma obra',
      descricao: 'A obra já aparece no seu painel de montador para check-in, checklist e fotos.',
      prioridade: 'normal',
      status: 'nao_lida',
      rota: '/montador',
      entidade_tipo: 'obra_montadores',
      entidade_id: obraId,
    }])
    if (error) console.error('Erro ao notificar montador alocado:', error)
  }
  async function carregar() {
    setLoading(true)
    let listaMontadores = []

    const { data: vinculadosJoin, error: joinError } = await supabase
      .from('obra_montadores')
      .select('obra_id, montador_id, montador:profiles!obra_montadores_montador_id_fkey(id, full_name, role)')
      .eq('obra_id', obraId)

    if (!joinError) {
      listaMontadores = vinculadosJoin || []
    } else {
      const { data: vinculados, error: vinculadosError } = await supabase
        .from('obra_montadores')
        .select('obra_id, montador_id')
        .eq('obra_id', obraId)

      if (vinculadosError) {
        avisar('erro', erroTexto(vinculadosError, 'Não foi possível carregar os montadores alocados.'))
      } else {
        const ids = [...new Set((vinculados || []).map(v => v.montador_id).filter(Boolean))]
        if (ids.length) {
          const { data: perfis, error: perfisError } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .in('id', ids)

          if (perfisError) {
            avisar('erro', erroTexto(perfisError, 'Não foi possível carregar os dados dos montadores alocados.'))
            listaMontadores = vinculados || []
          } else {
            listaMontadores = (vinculados || []).map(v => ({
              ...v,
              montador: (perfis || []).find(p => p.id === v.montador_id) || null,
            }))
          }
        }
      }
    }

    const { data: t, error: todosError } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('role', 'montador')
      .order('full_name')

    if (todosError) {
      avisar('erro', erroTexto(todosError, 'Não foi possível carregar a lista de montadores.'))
      setTodos([])
    } else {
      setTodos(t || [])
    }

    setMontadores(listaMontadores)
    setLoading(false)
  }
  async function alocar() {
    if (!selecionado) return
    setMensagem(null)
    setAdicionando(true)
    const { data: existente, error: existeError } = await supabase
      .from('obra_montadores')
      .select('obra_id, montador_id')
      .eq('obra_id', obraId)
      .eq('montador_id', selecionado)
      .maybeSingle()

    if (existeError) {
      avisar('erro', erroTexto(existeError, 'Não foi possível verificar se o montador já está alocado.'))
      setAdicionando(false)
      return
    }

    if (existente) {
      avisar('info', 'Este montador já está alocado nesta obra.')
      setAdicionando(false)
      return
    }

    const { error: insertError } = await supabase
      .from('obra_montadores')
      .insert([{ obra_id: obraId, montador_id: selecionado }])

    if (insertError) {
      avisar('erro', erroTexto(insertError, 'Não foi possível alocar o montador.'))
      setAdicionando(false)
      return
    }

    await notificarMontadorAlocado(selecionado)
    setSelecionado('')
    avisar('sucesso', 'Montador alocado com sucesso.')
    await carregar()
    setAdicionando(false)
  }
  async function remover(montadorId) {
    setMensagem(null)
    const { error } = await supabase
      .from('obra_montadores')
      .delete()
      .eq('obra_id', obraId)
      .eq('montador_id', montadorId)

    if (error) {
      avisar('erro', erroTexto(error, 'Não foi possível remover o montador.'))
      return
    }

    avisar('sucesso', 'Montador removido da obra.')
    await carregar()
  }
  const naoAlocados = todos.filter(t => !montadores.find(m => m.montador_id === t.id))
  return (
    <Card titulo="Montadores alocados nesta obra">
      {mensagem && (
        <div style={{
          marginBottom: 12,
          border: '1px solid ' + (mensagem.tipo === 'erro' ? theme.status.danger : mensagem.tipo === 'sucesso' ? theme.status.successDeep : theme.status.goldMuted),
          background: mensagem.tipo === 'erro' ? theme.statusBg.danger : mensagem.tipo === 'sucesso' ? theme.statusBg.success : theme.statusBg.gold,
          color: mensagem.tipo === 'erro' ? theme.status.dangerDeep : mensagem.tipo === 'sucesso' ? theme.status.successDeep : theme.status.finance,
          borderRadius: 8,
          padding: '9px 11px',
          fontSize: 12.5,
          fontWeight: 600,
        }}>
          {mensagem.texto}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={selecionado} onChange={e => setSelecionado(e.target.value)} style={{ background: THEME.inputBackground, border: '1px solid ' + THEME.inputBorder, color: THEME.inputText, borderRadius: 8, padding: '10px 14px', width: '100%', minHeight: 44, fontSize: 14, outline: 'none', flex: '1 1 240px', fontFamily: 'inherit' }}>
          <option value="">-- Selecione montador --</option>
          {naoAlocados.map(m => <option key={m.id} value={m.id}>{m.full_name}{m.cargo ? ' · ' + m.cargo : ''}</option>)}
        </select>
        <button onClick={alocar} disabled={!selecionado || adicionando} style={{ background: THEME.ink, color: theme.textOnAccent, border: 'none', borderRadius: 8, padding: '10px 16px', minHeight: 44, fontSize: 13, fontWeight: 700, cursor: !selecionado || adicionando ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: !selecionado || adicionando ? 0.55 : 1, flex: '0 0 auto' }}>{adicionando ? '...' : '+ Alocar'}</button>
      </div>
      {loading ? <div style={{ color: THEME.muted, fontSize: 13 }}>Carregando...</div>
        : montadores.length === 0 ? <div style={{ color: THEME.muted, fontSize: 13 }}>Nenhum montador alocado.</div>
        : montadores.map(m => (
          <div key={m.montador_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid ' + THEME.border }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: theme.statusBg.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: theme.status.goldMuted, flexShrink: 0 }}>{(m.montador?.full_name || '?')[0].toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: THEME.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.montador?.full_name || 'Montador não encontrado'}</div>
              {m.montador?.role && <div style={{ fontSize: 11.5, color: THEME.muted }}>{m.montador.role}</div>}
            </div>
            <button onClick={() => remover(m.montador_id)} style={{ background: theme.statusBg.danger, border: '1px solid ' + theme.status.danger, borderRadius: 8, color: theme.status.dangerDeep, cursor: 'pointer', fontSize: 12.5, fontWeight: 800, padding: '9px 10px', minHeight: 44, flexShrink: 0 }}>Remover</button>
          </div>
        ))
      }
    </Card>
  )
}

function CardTarefa({ tarefa, onMudarStatus }) {
  const st = STATUS_TAREFA[tarefa.status] || STATUS_TAREFA.pendente
  const pr = PRIORIDADE[tarefa.prioridade] || PRIORIDADE.media
  const [mudando, setMudando] = useState(false)
  async function handleStatus(e) { setMudando(true); await onMudarStatus(tarefa.id, e.target.value); setMudando(false) }
  return (
    <div style={{ background: THEME.card, border: '1px solid ' + THEME.border, borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 10 }}>
      <div style={{ width: 3, borderRadius: 2, alignSelf: 'stretch', background: pr.color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-ink)' }}>{tarefa.titulo}</span>
          <span style={{ fontSize: 10, padding: '2px 9px', borderRadius: 20, background: st.color + '18', color: st.color, fontWeight: 600 }}>{st.label}</span>
        </div>
        {tarefa.descricao && <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--color-ink-muted)', lineHeight: 1.5 }}>{tarefa.descricao}</p>}
        <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
          {tarefa.prazo && <span style={{ fontSize: 11, color: '#aaa' }}>Prazo: {new Date(tarefa.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
          {tarefa.responsavel?.full_name && <span style={{ fontSize: 11, color: '#aaa' }}>{tarefa.responsavel.full_name}</span>}
          <span style={{ fontSize: 11, color: pr.color }}>{pr.label}</span>
        </div>
      </div>
      <select value={tarefa.status} onChange={handleStatus} disabled={mudando} style={{ background: THEME.inputBackground, border: '1px solid ' + THEME.inputBorder, color: THEME.inputText, borderRadius: 8, padding: '10px 14px', width: '100%', fontSize: 14, outline: 'none', fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>
        {Object.entries(STATUS_TAREFA).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
      </select>
    </div>
  )
}

function Card({ titulo, children }) {
  return (
    <div style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 14, padding: '20px 22px', minWidth: 0 }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: THEME.gold, textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>{titulo}</div>
      {children}
    </div>
  )
}
function Info({ label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: THEME.muted, marginBottom: 3, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: THEME.ink, fontWeight: 600, wordBreak: 'break-word' }}>{value || '-'}</div>
    </div>
  )
}
function Label({ children }) { return <div style={{ fontSize: 11, color: THEME.muted, marginBottom: 6, fontWeight: 700 }}>{children}</div> }
function FInput({ onChange, ...props }) { return <input {...props} onChange={e => onChange(e.target.value)} style={{ background: THEME.inputBackground, border: '1px solid ' + THEME.inputBorder, color: THEME.inputText, borderRadius: 8, padding: '10px 14px', width: '100%', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} /> }
function FSelect({ onChange, children, ...props }) { return <select {...props} onChange={e => onChange(e.target.value)} style={{ background: THEME.inputBackground, border: '1px solid ' + THEME.inputBorder, color: THEME.inputText, borderRadius: 8, padding: '10px 14px', width: '100%', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}>{children}</select> }






