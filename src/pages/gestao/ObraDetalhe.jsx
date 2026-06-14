import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { tarefasService } from '../../services/tarefasService'
import { aplicarBibliotecaChecklist } from '../../services/checklistService'
import { exportarRelatorioObra } from '../../services/pdfService'

const ST = {
  'Em montagem':         { label: 'Em montagem',        bg: '#edf7f0', color: '#3a7d4f' },
  'Em andamento':        { label: 'Em andamento',        bg: '#edf7f0', color: '#3a7d4f' },
  'Concluida':           { label: 'Concluída',           bg: '#eef2f8', color: '#3a5580' },
  'Pausada':             { label: 'Pausada',             bg: '#fdf3e3', color: '#a0692a' },
  'Cancelada':           { label: 'Cancelada',           bg: '#fdecea', color: '#a03030' },
  'Planejamento':        { label: 'Planejamento',        bg: '#f5f0ff', color: '#6040a0' },
  'Aguardando inicio':   { label: 'Ag. inicio',          bg: '#f5f5f5', color: '#616161' },
  'Montagem agendada':   { label: 'Mont. agendada',      bg: '#E3F2FD', color: '#1565C0' },
  'Em producao':         { label: 'Em producao',         bg: '#EFF4FA', color: '#1E3A5F' },
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
  media: { label: 'Media', color: '#b09a7a' },
  alta:  { label: 'Alta',  color: '#d94a4a' },
}

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const STATUS_LIST = [
  'Aguardando inicio','Medicao agendada','Em medicao','Projeto em conferencia',
  'Em producao','Pronta para entrega','Aguardando montagem','Montagem agendada',
  'Em montagem','Pausada','Vistoria final','Concluida','Cancelada',
]
const FASES_CRONOGRAMA = ['Pré-Obra', 'Produção', 'Pré-Montagem', 'Montagem', 'Entrega', 'Pós-Venda']
const FASES_CRONOGRAMA_FORM = [...FASES_CRONOGRAMA, 'Assistência Técnica', 'Garantia']
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
  bg: '#F6F3EE',
  card: '#FFFFFF',
  border: '#E7E0D5',
  ink: '#1D1C19',
  muted: '#6D675E',
  gold: '#B8965E',
  softGold: '#F2E8D7',
  danger: '#B94A48',
}

const FOTO_CATEGORIAS = [
  'Antes da montagem',
  'Durante a montagem',
  'Finalizado',
  'Não conformidade',
  'Técnica',
  'Entrega',
  'Cliente',
  'Geral',
]

const FASES_BIBLIOTECA = ['Pré-Montagem', 'Montagem', 'Pós-Montagem', 'Assistência Técnica', 'Garantia']

function fotoUrl(foto) {
  if (foto.url) return foto.url
  if (!foto.storage_path) return ''
  return supabase.storage.from('fotos-obras').getPublicUrl(foto.storage_path).data.publicUrl
}

const textareaStyle = {
  width: '100%',
  padding: '11px 13px',
  borderRadius: 9,
  border: `1px solid ${THEME.border}`,
  fontSize: 13,
  fontFamily: 'inherit',
  resize: 'vertical',
  boxSizing: 'border-box',
  outline: 'none',
  background: '#FFFEFC',
  color: THEME.ink,
}

function acaoBtn(primary, active = false) {
  return {
    background: primary ? (active ? '#fdecea' : THEME.ink) : '#FFFEFC',
    color: primary ? (active ? THEME.danger : '#fff') : THEME.ink,
    border: primary ? 'none' : `1px solid ${THEME.border}`,
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

  const [obra,      setObra]      = useState(null)
  const [aba,       setAba]       = useState('Resumo')
  const [loading,   setLoading]   = useState(true)
  const [tarefas,   setTarefas]   = useState([])
  const [profiles,  setProfiles]  = useState([])
  const [resumo,    setResumo]    = useState({ gastos: 0, tarefasAbertas: 0, agenda: 0 })
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

  useEffect(() => { carregarObra(); carregarProfiles(); carregarResumo() }, [id])
  useEffect(() => { if (aba === 'Tarefas') carregarTarefas() }, [aba, id])
  useEffect(() => {
    function check() { setCompacto(window.innerWidth < 760) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  async function carregarObra() {
    const { data } = await supabase.from('obras').select('*').eq('id', id).single()
    setObra(data); setFormObra(data || {}); setLoading(false)
  }
  async function carregarProfiles() {
    const { data } = await supabase.from('profiles').select('id, full_name, email, role')
    setProfiles(data || [])
  }
  async function carregarTarefas() {
    const data = await tarefasService.listarPorObra(id)
    setTarefas(data || [])
    const p = await tarefasService.calcularProgresso(id)
    setProgresso(p)
  }

  async function carregarResumo() {
    const [{ data: gs }, { data: ts }, { data: ag }] = await Promise.all([
      supabase.from('gastos').select('valor').eq('obra_id', id),
      supabase.from('tarefas').select('id, status').eq('obra_id', id),
      supabase.from('agenda').select('id').eq('obra_id', id),
    ])
    const totalGastos = (gs || []).reduce((s, g) => s + (parseFloat(g.valor) || 0), 0)
    const abertas = (ts || []).filter(t => t.status !== 'concluida').length
    setResumo({ gastos: totalGastos, tarefasAbertas: abertas, agenda: (ag || []).length })
  }

  function mostrarToast(msg, tipo = 'ok') {
    setToast({ msg, tipo })
    setTimeout(() => setToast({ msg: '', tipo: 'ok' }), 3200)
  }

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
      gasto_meta:         formObra.gasto_meta         ? parseFloat(formObra.gasto_meta)    : null,
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

      <section style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 18, padding: compacto ? 18 : 26, marginBottom: 18, boxShadow: '0 20px 45px rgba(29,28,25,0.07)' }}>
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
            <span style={{ alignSelf: compacto ? 'flex-start' : 'flex-end', padding: '7px 14px', borderRadius: 999, background: st.bg, color: st.color, fontSize: 12, fontWeight: 700 }}>{st.label}</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: compacto ? 'flex-start' : 'flex-end' }}>
              <button onClick={() => { setAba('Tarefas'); carregarTarefas() }} style={acaoBtn(false)}>Tarefas</button>
              <button onClick={() => setAba('Fotos')} style={acaoBtn(false)}>Fotos</button>
              <button onClick={() => setAba('Chat')} style={acaoBtn(false)}>Chat</button>
              <select value={tipoPdf} onChange={e => setTipoPdf(e.target.value)} style={{ border: `1px solid ${THEME.border}`, borderRadius: 10, padding: '9px 10px', fontSize: 12.5, fontWeight: 700, color: THEME.ink, background: '#FFFEFC', fontFamily: 'inherit' }}>
                <option value="executivo">Executivo</option>
                <option value="operacional">Operacional</option>
                <option value="cliente">Cliente</option>
              </select>
              <button onClick={gerarPdf} disabled={exportandoPdf} style={acaoBtn(false)}>
                {exportandoPdf ? 'Gerando...' : 'Exportar PDF'}
              </button>
              <button onClick={() => { setEditando(!editando); setFormObra(obra) }} style={acaoBtn(true, editando)}>
                {editando ? 'Cancelar edicao' : 'Editar'}
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
            {editando ? 'Cancelar edicao' : 'Editar obra'}
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
              <CampoEdit label="Numero do contrato">
                <FInput value={formObra.numero_contrato || ''} onChange={v => setFormObra(p => ({ ...p, numero_contrato: v }))} placeholder="Ex: 078/2026" />
              </CampoEdit>
              <CampoEdit label="Pedido Ornare">
                <FInput value={formObra.pedido_ornare || ''} onChange={v => setFormObra(p => ({ ...p, pedido_ornare: v }))} placeholder="Ex: PED-2026-001" />
              </CampoEdit>
              <CampoEdit label="Data de inicio">
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

          <SecaoEdit titulo="Observacoes" last>
            <CampoEdit label="Observacoes internas" full>
              <textarea value={formObra.observacoes || ''} onChange={e => setFormObra(p => ({ ...p, observacoes: e.target.value }))} rows={4} style={textareaStyle} />
            </CampoEdit>
          </SecaoEdit>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setEditando(false)} style={{ background: 'none', border: `1px solid ${THEME.border}`, borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', color: THEME.muted }}>
              Cancelar
            </button>
            <button onClick={salvarEdicaoObra} disabled={salvando} style={{ background: THEME.gold, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {salvando ? 'Salvando...' : 'Salvar alteracoes'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: compacto ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: 12, margin: '18px 0 18px' }}>
        <KpiCard label="Progresso" value={`${progressoObra}%`} helper="andamento geral" />
        <KpiCard label="Previsão" value={previsao} helper="término previsto" />
        <KpiCard label="Gastos" value={`R$ ${resumo.gastos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} helper="registrados" />
        <KpiCard label="Pendencias" value={resumo.tarefasAbertas} helper="tarefas abertas" />
      </div>

      <nav style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', gap: 6, border: `1px solid ${THEME.border}`, background: 'rgba(246,243,238,0.94)', backdropFilter: 'blur(12px)', borderRadius: 14, marginBottom: 24, padding: 6, overflowX: 'auto' }}>
        {SECOES.map(s => (
          <button key={s.id} onClick={() => setAba(s.id)} style={{ background: aba === s.id ? THEME.ink : 'transparent', border: 'none', cursor: 'pointer', padding: '9px 14px', fontSize: 12.5, whiteSpace: 'nowrap', color: aba === s.id ? '#fff' : THEME.muted, fontWeight: aba === s.id ? 700 : 500, borderRadius: 10, fontFamily: 'inherit' }}>{s.label}</button>
        ))}
      </nav>

      {aba === 'Resumo' && (
        <div style={{ display: 'grid', gridTemplateColumns: compacto ? '1fr' : '1fr 1fr', gap: 16 }}>
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
          <Card titulo="Equipe responsavel">
            <Info label="Supervisor"   value={supervisorNome} />
            <Info label="Comercial"    value={comercialNome} />
            <Info label="Executivista" value={obra.executivista_nome} />
          </Card>
          <Card titulo="Contrato">
            <Info label="Numero" value={obra.numero_contrato} />
            <Info label="Pedido Ornare" value={obra.pedido_ornare} />
            <Info label="Valor" value={obra.valor_contrato ? `R$ ${Number(obra.valor_contrato).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
          </Card>
          {obra.observacoes && (
            <div style={{ gridColumn: '1/-1' }}>
              <Card titulo="Observacoes internas">
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
            <Info label="Numero do contrato" value={obra.numero_contrato} />
            <Info label="Pedido Ornare" value={obra.pedido_ornare} />
            <Info label="Valor do contrato" value={obra.valor_contrato ? `R$ ${Number(obra.valor_contrato).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
            <Info label="Gasto meta" value={obra.gasto_meta ? `R$ ${Number(obra.gasto_meta).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
          </Card>
          <Card titulo="Datas">
            <Info label="Inicio" value={obra.data_inicio ? new Date(obra.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR') : null} />
            <Info label="Previsão" value={previsao} />
            <Info label="Status" value={obra.status} />
            <Info label="Progresso" value={`${progressoObra}%`} />
          </Card>
        </div>
      )}

      {aba === 'Cronograma' && <AbaCronograma obraId={id} profiles={profiles} compacto={compacto} />}

      {aba === 'Equipe' && (
        <div style={{ display: 'grid', gridTemplateColumns: compacto ? '1fr' : '1fr 1fr', gap: 16 }}>
          <Card titulo="Responsaveis">
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

      {aba === 'Agenda' && <AbaAgenda obraId={id} />}

      {aba === 'Tarefas' && (
        <div>
          {tarefas.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-ink-muted)', marginBottom: 6 }}>
                <span>{tarefas.filter(t => t.status === 'concluida').length} de {tarefas.length} concluidas</span>
                <span style={{ color: 'var(--color-gold)', fontWeight: 600 }}>{progresso}%</span>
              </div>
              <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 2 }}>
                <div style={{ height: 4, background: 'var(--color-gold)', borderRadius: 2, width: progresso + '%', transition: 'width 0.4s' }} />
              </div>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={() => setShowForm(!showForm)} style={{ background: 'var(--color-ink)', color: '#f9f7f4', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
              {showForm ? 'Cancelar' : '+ Nova Tarefa'}
            </button>
          </div>
          {showForm && (
            <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 22, marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1/-1' }}><Label>Titulo *</Label><FInput value={nova.titulo} onChange={v => setNova(p => ({ ...p, titulo: v }))} placeholder="Titulo da tarefa" /></div>
                <div style={{ gridColumn: '1/-1' }}><Label>Descrição</Label><textarea value={nova.descricao} onChange={e => setNova(p => ({ ...p, descricao: e.target.value }))} rows={2} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} /></div>
                <div><Label>Prioridade</Label><FSelect value={nova.prioridade} onChange={v => setNova(p => ({ ...p, prioridade: v }))}><option value="baixa">Baixa</option><option value="media">Media</option><option value="alta">Alta</option></FSelect></div>
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

      {aba === 'Checklist'   && <AbaChecklist   obraId={id} />}
      {aba === 'Ocorrencias' && <AbaOcorrencias obraId={id} />}
      {aba === 'Gastos'      && <AbaGastos      obraId={id} obraInfo={obra} />}
      {aba === 'Fotos'       && <AbaFotos       obraId={id} />}
      {aba === 'Historico'   && <AbaHistorico   obraId={id} />}
      {aba === 'Chat'        && <AbaChat        obraId={id} />}
      </div>
    </div>
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

function AbaCronograma({ obraId, profiles, compacto }) {
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
      fase: 'Pré-Montagem',
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
      fase: form.fase || null,
      etapa_atual: form.etapa_atual || null,
      status_operacional: form.status_operacional || null,
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
    }
    setSalvando(false)
  }

  if (loading) return <div style={{ color: THEME.muted }}>Carregando cronograma...</div>
  if (!form) return <div style={{ color: THEME.danger }}>Cronograma indisponivel.</div>

  const responsaveis = profiles || []
  const supervisores = responsaveis.filter(p => ['gestao', 'supervisor'].includes(p.role))
  const posVenda = responsaveis.filter(p => ['gestao', 'pos_venda', 'vendedor'].includes(p.role))
  const faseAtual = form.fase || 'Pré-Montagem'
  const porcentagem = Math.max(0, Math.min(100, Number(form.percentual_concluido) || 0))

  return (
    <div style={{ display: 'grid', gap: 16 }}>
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
        <KpiCard label="Fase" value={faseAtual} helper="etapa operacional" />
        <KpiCard label="Status" value={form.status_operacional || '-'} helper="situacao atual" />
        <KpiCard label="Prioridade" value={form.prioridade || '-'} helper={`risco ${form.risco || '-'}`} />
        <KpiCard label="Percentual" value={`${porcentagem}%`} helper="concluido" />
      </div>

      <Card titulo="Linha do tempo operacional">
        <div style={{ display: 'grid', gridTemplateColumns: compacto ? '1fr' : `repeat(${FASES_CRONOGRAMA.length}, minmax(0, 1fr))`, gap: 10 }}>
          {FASES_CRONOGRAMA.map((fase, index) => {
            const ativa = fase === faseAtual
            const concluida = FASES_CRONOGRAMA.indexOf(faseAtual) > index
            return (
              <div key={fase} style={{ border: `1px solid ${ativa ? THEME.gold : THEME.border}`, background: ativa ? THEME.softGold : concluida ? '#F4FBF6' : '#FFFEFC', borderRadius: 12, padding: '12px 10px', minHeight: 74 }}>
                <div style={{ width: 22, height: 22, borderRadius: 999, background: ativa ? THEME.gold : concluida ? '#2D7A4A' : THEME.border, color: ativa || concluida ? '#fff' : THEME.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, marginBottom: 9 }}>
                  {concluida ? 'v' : index + 1}
                </div>
                <div style={{ fontSize: 12, color: ativa ? THEME.ink : THEME.muted, fontWeight: ativa ? 800 : 700 }}>{fase}</div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card titulo="Dados do cronograma">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
          <div><Label>Fase</Label><FSelect value={form.fase || ''} onChange={v => setCampo('fase', v)}>{FASES_CRONOGRAMA_FORM.map(f => <option key={f} value={f}>{f}</option>)}</FSelect></div>
          <div><Label>Status operacional</Label><FInput value={form.status_operacional || ''} onChange={v => setCampo('status_operacional', v)} /></div>
          <div><Label>Etapa atual</Label><FInput value={form.etapa_atual || ''} onChange={v => setCampo('etapa_atual', v)} /></div>
          <div><Label>Tipo de montagem</Label><FInput value={form.tipo_montagem || ''} onChange={v => setCampo('tipo_montagem', v)} /></div>
          <div><Label>Prioridade</Label><FSelect value={form.prioridade || 'media'} onChange={v => setCampo('prioridade', v)}>{PRIORIDADES_CRONOGRAMA.map(p => <option key={p} value={p}>{p}</option>)}</FSelect></div>
          <div><Label>Risco</Label><FSelect value={form.risco || 'medio'} onChange={v => setCampo('risco', v)}>{RISCOS_CRONOGRAMA.map(r => <option key={r} value={r}>{r}</option>)}</FSelect></div>
          <div><Label>Percentual concluido</Label><FInput type="number" min="0" max="100" value={form.percentual_concluido ?? 0} onChange={v => setCampo('percentual_concluido', v)} /></div>
          <div><Label>Dias previstos</Label><FInput type="number" min="0" value={form.dias_previstos || ''} onChange={v => setCampo('dias_previstos', v)} /></div>
          <div><Label>Data inicio prevista</Label><FInput type="date" value={form.data_inicio_prevista || ''} onChange={v => setCampo('data_inicio_prevista', v)} /></div>
          <div><Label>Data fim prevista</Label><FInput type="date" value={form.data_fim_prevista || ''} onChange={v => setCampo('data_fim_prevista', v)} /></div>
          <div><Label>Data inicio real</Label><FInput type="date" value={form.data_inicio_real || ''} onChange={v => setCampo('data_inicio_real', v)} /></div>
          <div><Label>Data fim real</Label><FInput type="date" value={form.data_fim_real || ''} onChange={v => setCampo('data_fim_real', v)} /></div>
          <div><Label>Responsável</Label><FSelect value={form.responsavel_id || ''} onChange={v => setCampo('responsavel_id', v)}><option value="">Sem responsável</option>{responsaveis.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</FSelect></div>
          <div><Label>Supervisor</Label><FSelect value={form.supervisor_id || ''} onChange={v => setCampo('supervisor_id', v)}><option value="">Sem supervisor</option>{supervisores.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</FSelect></div>
          <div><Label>Pós-venda</Label><FSelect value={form.pos_venda_id || ''} onChange={v => setCampo('pos_venda_id', v)}><option value="">Sem pós-venda</option>{posVenda.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</FSelect></div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: compacto ? '1fr' : '1fr 1fr', gap: 16 }}>
        <Card titulo="Aprovacoes">
          <div style={{ display: 'grid', gap: 12 }}>
            <div><Label>Aprovacao tecnica</Label><FSelect value={form.aprovacao_tecnica_status || 'pendente'} onChange={v => setCampo('aprovacao_tecnica_status', v)}>{APROVACOES_CRONOGRAMA.map(a => <option key={a} value={a}>{textoAprovacao(a)}</option>)}</FSelect></div>
            <div><Label>Aprovacao comercial</Label><FSelect value={form.aprovacao_comercial_status || 'pendente'} onChange={v => setCampo('aprovacao_comercial_status', v)}>{APROVACOES_CRONOGRAMA.map(a => <option key={a} value={a}>{textoAprovacao(a)}</option>)}</FSelect></div>
            <div><Label>Aprovacao financeira</Label><FSelect value={form.aprovacao_financeira_status || 'pendente'} onChange={v => setCampo('aprovacao_financeira_status', v)}>{APROVACOES_CRONOGRAMA.map(a => <option key={a} value={a}>{textoAprovacao(a)}</option>)}</FSelect></div>
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
              Visivel ao cliente
            </label>
            <div><Label>Motivo da trava</Label><textarea value={form.motivo_trava || ''} onChange={e => setCampo('motivo_trava', e.target.value)} rows={3} style={textareaStyle} /></div>
          </div>
        </Card>
      </div>

      <Card titulo="Alertas e acao recomendada">
        <div style={{ display: 'grid', gap: 12 }}>
          <div><Label>Alertas / observacoes</Label><textarea value={form.alertas_observacoes || ''} onChange={e => setCampo('alertas_observacoes', e.target.value)} rows={3} style={textareaStyle} /></div>
          <div><Label>Acao recomendada</Label><textarea value={form.acao_recomendada || ''} onChange={e => setCampo('acao_recomendada', e.target.value)} rows={3} style={textareaStyle} /></div>
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

function AbaAgenda({ obraId }) {
  const [agenda, setAgenda] = useState([])
  const [loading, setLoading] = useState(true)

  async function carregar() {
    const { data } = await supabase.from('agenda').select('*').eq('obra_id', obraId).order('data', { ascending: true })
    setAgenda(data || [])
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { carregar() }, [])

  if (loading) return <div style={{ color: THEME.muted }}>Carregando...</div>
  if (agenda.length === 0) return <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhum compromisso na agenda.</div>

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {agenda.map(item => (
        <div key={item.id} style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 92 }}>
            <div style={{ fontSize: 12, color: THEME.gold, fontWeight: 800 }}>{item.data ? new Date(item.data + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</div>
            {item.hora_inicio && <div style={{ fontSize: 12, color: THEME.muted, marginTop: 3 }}>{item.hora_inicio}</div>}
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 14, color: THEME.ink, fontWeight: 700 }}>{item.titulo || item.tipo || 'Compromisso'}</div>
            {item.descricao && <div style={{ fontSize: 13, color: THEME.muted, marginTop: 4, lineHeight: 1.5 }}>{item.descricao}</div>}
          </div>
          {item.tipo && <span style={{ fontSize: 11, color: THEME.muted, border: `1px solid ${THEME.border}`, borderRadius: 999, padding: '5px 10px' }}>{item.tipo}</span>}
        </div>
      ))}
    </div>
  )
}

function AbaChecklist({ obraId }) {
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
    const [{ data: amb }, { data: cl }] = await Promise.all([
      supabase.from('obra_ambientes').select('id, nome, status').eq('obra_id', obraId),
      supabase.from('checklist_items').select('id, obra_id, ambiente_id, descricao, concluido, concluido_por, concluido_em').eq('obra_id', obraId).order('descricao'),
    ])
    setAmbientes(amb || [])
    setItens(cl || [])
    setLoading(false)
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { carregar() }, [])

  async function adicionar() {
    if (!novoItem.trim()) return
    const temGrupoGeral = itens.some(i => !i.ambiente_id) || ambientes.length === 0
    const destinoId = ambienteSelecionado === 'geral' && !temGrupoGeral ? (ambientes[0]?.id || 'geral') : ambienteSelecionado
    setSalvando(true)
    await supabase.from('checklist_items').insert([{
      obra_id: obraId,
      ambiente_id: destinoId === 'geral' ? null : destinoId,
      descricao: novoItem.trim(),
      concluido: false,
    }])
    setNovoItem(''); await carregar(); setSalvando(false)
  }
  async function toggle(item) {
    const concluindo = !item.concluido
    await supabase.from('checklist_items').update({
      concluido: concluindo,
      concluido_por: concluindo ? user?.id : null,
      concluido_em: concluindo ? new Date().toISOString() : null,
    }).eq('id', item.id)
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
      setMensagemBiblioteca(`${count} itens aplicados. ${skipped} itens já existiam e foram ignorados.`)
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
          <div style={{ marginTop: 12, border: `1px solid ${mensagemBiblioteca.startsWith('Erro') ? '#F0C8C8' : THEME.border}`, background: mensagemBiblioteca.startsWith('Erro') ? '#FFF7F7' : '#FFFEFC', color: mensagemBiblioteca.startsWith('Erro') ? THEME.danger : THEME.muted, borderRadius: 10, padding: '10px 12px', fontSize: 12.5, fontWeight: 700 }}>
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
          <select value={ativo.id} onChange={e => setAmbienteSelecionado(e.target.value)} style={{ minWidth: 180, flex: '0 1 220px', padding: '10px 12px', borderRadius: 9, border: `1px solid ${THEME.border}`, fontSize: 13, fontFamily: 'inherit', background: '#FFFEFC', color: THEME.ink }}>
            {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
          <input value={novoItem} onChange={e => setNovoItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && adicionar()} placeholder="Novo item do checklist..." style={{ flex: '1 1 240px', padding: '10px 14px', borderRadius: 9, border: `1px solid ${THEME.border}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', minWidth: 0 }} />
          <button onClick={adicionar} disabled={salvando || !novoItem.trim()} style={{ background: THEME.ink, color: '#fff', border: 'none', borderRadius: 9, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Adicionar</button>
        </div>

        {loading ? <div style={{ color: '#bbb' }}>Carregando...</div>
          : itens.length === 0 ? <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhum item no checklist.</div>
          : ativo.itens.length === 0 ? <div style={{ textAlign: 'center', padding: '36px 0', color: '#bbb' }}>Nenhum item neste ambiente.</div>
          : ativo.itens.map(item => (
            <div key={item.id} onClick={() => toggle(item)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: `1px solid ${THEME.border}`, cursor: 'pointer' }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, border: '2px solid ' + (item.concluido ? '#5aab6e' : THEME.border), background: item.concluido ? '#5aab6e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {item.concluido && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>v</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: item.concluido ? '#aaa' : THEME.ink, textDecoration: item.concluido ? 'line-through' : 'none', fontWeight: 600 }}>{item.descricao}</div>
                {item.concluido_em && <div style={{ fontSize: 11, color: THEME.muted, marginTop: 3 }}>Concluido em {new Date(item.concluido_em).toLocaleString('pt-BR')}</div>}
              </div>
            </div>
          ))
        }
      </Card>
    </div>
  )
}
function AbaOcorrencias({ obraId }) {
  const [ocorrencias, setOcorrencias] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [nova, setNova] = useState({ titulo: '', descricao: '', categoria: 'geral', gravidade: 'baixa' })
  useEffect(() => { carregar() }, [])
  async function carregar() {
    const { data } = await supabase.from('ocorrencias').select('*, responsavel:profiles!ocorrencias_responsavel_id_fkey(full_name)').eq('obra_id', obraId).order('created_at', { ascending: false })
    setOcorrencias(data || []); setLoading(false)
  }
  async function salvar() {
    if (!nova.titulo.trim()) return
    setSalvando(true)
    await supabase.from('ocorrencias').insert([{ ...nova, obra_id: obraId }])
    setNova({ titulo: '', descricao: '', categoria: 'geral', gravidade: 'baixa' })
    setShowForm(false); await carregar(); setSalvando(false)
  }
  const gravCor = { baixa: '#5aab6e', media: '#b09a7a', alta: '#d94a4a' }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => setShowForm(!showForm)} style={{ background: 'var(--color-ink)', color: '#f9f7f4', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>{showForm ? 'Cancelar' : '+ Nova Ocorrência'}</button>
      </div>
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 22, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><Label>Titulo *</Label><FInput value={nova.titulo} onChange={v => setNova(p => ({ ...p, titulo: v }))} placeholder="Descreva a ocorrencia" /></div>
            <div style={{ gridColumn: '1/-1' }}><Label>Detalhes</Label><textarea value={nova.descricao} onChange={e => setNova(p => ({ ...p, descricao: e.target.value }))} rows={3} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} /></div>
            <div><Label>Categoria</Label><FSelect value={nova.categoria} onChange={v => setNova(p => ({ ...p, categoria: v }))}><option value="geral">Geral</option><option value="atraso">Atraso</option><option value="dano">Dano</option><option value="retrabalho">Retrabalho</option><option value="acesso">Acesso</option><option value="material">Material faltante</option></FSelect></div>
            <div><Label>Gravidade</Label><FSelect value={nova.gravidade} onChange={v => setNova(p => ({ ...p, gravidade: v }))}><option value="baixa">Baixa</option><option value="media">Media</option><option value="alta">Alta</option></FSelect></div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={salvar} disabled={salvando} style={{ background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{salvando ? 'Salvando...' : 'Registrar'}</button>
          </div>
        </div>
      )}
      {loading ? <div style={{ color: '#bbb' }}>Carregando...</div>
        : ocorrencias.length === 0 ? <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhuma ocorrencia registrada.</div>
        : ocorrencias.map(oc => (
          <div key={oc.id} style={{ background: '#fff', border: '1px solid var(--color-border)', borderLeft: '4px solid ' + (gravCor[oc.gravidade] || '#ccc'), borderRadius: 10, padding: '16px 18px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' }}>{oc.titulo}</span>
              <span style={{ fontSize: 10, padding: '2px 9px', borderRadius: 20, background: '#f0ece6', color: '#888', marginLeft: 'auto' }}>{oc.categoria}</span>
              <span style={{ fontSize: 10, padding: '2px 9px', borderRadius: 20, background: (gravCor[oc.gravidade] || '#ccc') + '22', color: gravCor[oc.gravidade] || '#888' }}>{oc.gravidade}</span>
            </div>
            {oc.descricao && <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink-muted)', lineHeight: 1.5 }}>{oc.descricao}</p>}
            <div style={{ fontSize: 11, color: '#bbb', marginTop: 8 }}>{new Date(oc.created_at).toLocaleDateString('pt-BR')}</div>
          </div>
        ))
      }
    </div>
  )
}

function AbaGastos({ obraId, obraInfo }) {
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [novo, setNovo] = useState({ descricao: '', valor: '', categoria: 'material', data: '' })
  useEffect(() => { carregar() }, [])
  async function carregar() {
    const { data } = await supabase.from('gastos').select('*').eq('obra_id', obraId).order('created_at', { ascending: false })
    setGastos(data || []); setLoading(false)
  }
  async function salvar() {
    if (!novo.descricao.trim() || !novo.valor) return
    setSalvando(true)
    await supabase.from('gastos').insert([{ ...novo, obra_id: obraId, valor: parseFloat(novo.valor) }])
    setNovo({ descricao: '', valor: '', categoria: 'material', data: '' }); setShowForm(false); await carregar(); setSalvando(false)
  }
  const total = gastos.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0)
  const meta = parseFloat(obraInfo?.gasto_meta) || 0
  const pctGasto = meta > 0 ? Math.min(Math.round(total / meta * 100), 100) : 0
  const corGasto = pctGasto >= 90 ? '#d94a4a' : pctGasto >= 70 ? '#b09a7a' : '#5aab6e'
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: meta > 0 ? '1fr 1fr 1fr' : '1fr auto', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 20px' }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 4 }}>Total gasto</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-ink)' }}>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
        {meta > 0 && (
          <>
            <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 20px' }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 4 }}>Meta / Limite</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-ink)' }}>R$ {meta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div style={{ background: pctGasto >= 90 ? '#fdecea' : '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 20px' }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: pctGasto >= 90 ? '#d94a4a' : 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 4 }}>Utilizado</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: corGasto }}>{pctGasto}%</div>
              <div style={{ height: 4, background: '#f0ece6', borderRadius: 2, marginTop: 8 }}><div style={{ height: 4, borderRadius: 2, background: corGasto, width: pctGasto + '%', transition: 'width .3s' }} /></div>
            </div>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setShowForm(!showForm)} style={{ background: 'var(--color-ink)', color: '#f9f7f4', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>{showForm ? 'Cancelar' : '+ Novo Gasto'}</button>
        </div>
      </div>
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 22, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><Label>Descrição *</Label><FInput value={novo.descricao} onChange={v => setNovo(p => ({ ...p, descricao: v }))} placeholder="Ex: Material de proteção" /></div>
            <div><Label>Valor (R$) *</Label><FInput type="number" value={novo.valor} onChange={v => setNovo(p => ({ ...p, valor: v }))} placeholder="0,00" /></div>
            <div><Label>Data</Label><FInput type="date" value={novo.data} onChange={v => setNovo(p => ({ ...p, data: v }))} /></div>
            <div style={{ gridColumn: '1/-1' }}><Label>Categoria</Label><FSelect value={novo.categoria} onChange={v => setNovo(p => ({ ...p, categoria: v }))}><option value="combustivel">Combustivel</option><option value="pedagio">Pedagio</option><option value="hospedagem">Hospedagem</option><option value="alimentacao">Alimentacao</option><option value="frete">Frete</option><option value="terceiros">Terceiros</option><option value="ferragens">Ferragens</option><option value="material">Material</option><option value="outro">Outro</option></FSelect></div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={salvar} disabled={salvando} style={{ background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{salvando ? 'Salvando...' : 'Registrar'}</button>
          </div>
        </div>
      )}
      {loading ? <div style={{ color: '#bbb' }}>Carregando...</div>
        : gastos.length === 0 ? <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhum gasto registrado.</div>
        : gastos.map(g => (
          <div key={g.id} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 18px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-ink)' }}>{g.descricao}</div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>{g.categoria}{g.data ? ' · ' + new Date(g.data + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-ink)' }}>R$ {parseFloat(g.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
        ))
      }
    </div>
  )
}

function AbaChat({ obraId }) {
  const { user } = useStore()
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  useEffect(() => { carregar() }, [])
  async function carregar() {
    const { data } = await supabase.from('mensagens_obra').select('*, autor:profiles(full_name, role)').eq('obra_id', obraId).order('created_at', { ascending: true })
    setMensagens(data || []); setLoading(false)
  }
  async function enviar() {
    if (!texto.trim()) return
    setEnviando(true)
    await supabase.from('mensagens_obra').insert([{ obra_id: obraId, user_id: user.id, mensagem: texto.trim() }])
    setTexto(''); await carregar(); setEnviando(false)
  }
  const ROLE_COR = { gestao: '#3a5580', supervisor: '#3a7d4f', montador: '#b09a7a', cliente: '#888', vendedor: '#9070c0' }
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 16 }}>Chat da obra — visivel para toda a equipe</div>
      <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, marginBottom: 16, minHeight: 200, maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                  <div style={{ fontSize: 10, color: '#aaa', marginBottom: 3, textAlign: isMe ? 'right' : 'left' }}>{m.autor?.full_name || 'Usuario'} · {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                  <div style={{ background: isMe ? 'var(--color-ink)' : '#f5f2ee', color: isMe ? '#f9f7f4' : 'var(--color-ink)', borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px', padding: '10px 14px', fontSize: 13, lineHeight: 1.5 }}>{m.mensagem}</div>
                </div>
              </div>
            )
          })}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <input value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()} placeholder="Escreva uma mensagem..." style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
        <button onClick={enviar} disabled={enviando || !texto.trim()} style={{ background: 'var(--color-ink)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{enviando ? '...' : 'Enviar'}</button>
      </div>
    </div>
  )
}

function AbaFotos({ obraId }) {
  const { user } = useStore()
  const [fotos, setFotos] = useState([])
  const [ambientes, setAmbientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroAmbiente, setFiltroAmbiente] = useState('')
  const [filtroAprovacao, setFiltroAprovacao] = useState('')
  const [formFoto, setFormFoto] = useState({ categoria: '', ambiente_id: '', observacao: '', visivel_cliente: false })
  async function carregar() {
    const [{ data }, { data: amb }] = await Promise.all([
      supabase.from('fotos').select('*').eq('obra_id', obraId).order('created_at', { ascending: false }),
      supabase.from('obra_ambientes').select('id, nome').eq('obra_id', obraId),
    ])
    setFotos((data || []).map(f => ({ ...f, categoria: f.categoria || 'Geral', publicUrl: fotoUrl(f) })))
    setAmbientes(amb || [])
    setLoading(false)
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { carregar() }, [])
  async function handleUpload(e) {
    const file = e.target.files[0]; if (!file) return
    if (!formFoto.categoria) {
      window.alert('Selecione uma categoria antes de enviar a foto.')
      e.target.value = ''
      return
    }
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = obraId + '/' + Date.now() + '.' + ext
    const { error: upErr } = await supabase.storage.from('fotos-obras').upload(path, file)
    if (!upErr) {
      await supabase.from('fotos').insert([{
        obra_id: obraId,
        enviada_por: user?.id || null,
        storage_path: path,
        categoria: formFoto.categoria,
        ambiente_id: formFoto.ambiente_id || null,
        observacao: formFoto.observacao || file.name,
        visivel_cliente: formFoto.visivel_cliente,
        aprovada: false,
        aprovada_gestao: false,
        visibilidade: formFoto.visivel_cliente ? 'cliente' : 'interna',
      }])
      setFormFoto({ categoria: '', ambiente_id: '', observacao: '', visivel_cliente: false })
      await carregar()
    }
    setUploading(false); e.target.value = ''
  }
  async function aprovar(foto) {
    const aprovado = !foto.aprovada
    await supabase.from('fotos').update({
      aprovada: aprovado,
      aprovada_gestao: aprovado,
      aprovada_por: aprovado ? user?.id : null,
    }).eq('id', foto.id)
    await carregar()
  }
  async function alternarCliente(foto) {
    await supabase.from('fotos').update({
      visivel_cliente: !foto.visivel_cliente,
      visibilidade: !foto.visivel_cliente ? 'cliente' : 'interna',
    }).eq('id', foto.id)
    await carregar()
  }
  async function deletar(foto) { await supabase.from('fotos').delete().eq('id', foto.id); await carregar() }
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
        <KpiCard label="Cliente" value={fotos.filter(f => f.visivel_cliente).length} helper="visiveis ao cliente" />
        <KpiCard label="Não conform." value={naoConformidades} helper="registros críticos" />
      </div>

      <Card titulo="Enviar foto">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div><Label>Categoria *</Label><FSelect value={formFoto.categoria} onChange={v => setFormFoto(p => ({ ...p, categoria: v }))}><option value="">Selecione</option>{FOTO_CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}</FSelect></div>
          <div><Label>Ambiente</Label><FSelect value={formFoto.ambiente_id} onChange={v => setFormFoto(p => ({ ...p, ambiente_id: v }))}><option value="">Sem ambiente</option>{ambientes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</FSelect></div>
          <div><Label>Observacao</Label><FInput value={formFoto.observacao} onChange={v => setFormFoto(p => ({ ...p, observacao: v }))} placeholder="Opcional" /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: THEME.muted }}>
            <input type="checkbox" checked={formFoto.visivel_cliente} onChange={e => setFormFoto(p => ({ ...p, visivel_cliente: e.target.checked }))} />
            Visivel ao cliente apos aprovacao
          </label>
          <label style={{ background: formFoto.categoria ? THEME.ink : '#bbb', color: '#fff', borderRadius: 9, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: formFoto.categoria ? 'pointer' : 'not-allowed' }}>
            {uploading ? 'Enviando...' : 'Selecionar e enviar'}
            <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading || !formFoto.categoria} />
          </label>
        </div>
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
              {grupo.fotos.map(foto => (
                <div key={foto.id} style={{ background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 14, overflow: 'hidden' }}>
                  <div onClick={() => foto.publicUrl && setPreview(foto.publicUrl)} style={{ cursor: 'zoom-in', height: 170, overflow: 'hidden', background: '#f5f5f5' }}>{foto.publicUrl && <img src={foto.publicUrl} alt={foto.observacao || foto.categoria} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 12, color: THEME.ink, fontWeight: 700, marginBottom: 4 }}>{ambienteNome(foto.ambiente_id)}</div>
                    <div style={{ fontSize: 11, color: THEME.muted, marginBottom: 8, minHeight: 16 }}>{foto.observacao || 'Sem observacao'}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => aprovar(foto)} style={{ flex: '1 1 90px', padding: '7px 0', borderRadius: 7, border: 'none', fontSize: 11, cursor: 'pointer', background: foto.aprovada ? '#edf7f0' : '#f5f5f5', color: foto.aprovada ? '#3a7d4f' : '#888', fontWeight: 700 }}>{foto.aprovada ? 'Aprovada' : 'Aprovar'}</button>
                      <button onClick={() => alternarCliente(foto)} style={{ flex: '1 1 90px', padding: '7px 0', borderRadius: 7, border: 'none', fontSize: 11, cursor: 'pointer', background: foto.visivel_cliente ? THEME.softGold : '#f5f5f5', color: foto.visivel_cliente ? THEME.gold : '#888', fontWeight: 700 }}>Cliente</button>
                      <button onClick={() => deletar(foto)} style={{ padding: '7px 10px', borderRadius: 7, border: 'none', fontSize: 11, cursor: 'pointer', background: '#fdecea', color: '#a03030' }}>X</button>
                    </div>
                  </div>
                </div>
              ))}
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

  async function carregar() {
    const { data } = await supabase.from('historico_obra').select('*, profiles(full_name)').eq('obra_id', obraId).order('created_at', { ascending: false })
    setHistorico(data || []); setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { carregar() }, [])

  if (loading) return <div style={{ color: '#bbb' }}>Carregando...</div>
  if (historico.length === 0) return <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhum registro no historico.</div>
  return (
    <div style={{ position: 'relative', paddingLeft: 24 }}>
      <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, background: 'var(--color-border)' }} />
      {historico.map(h => (
        <div key={h.id} style={{ position: 'relative', marginBottom: 20 }}>
          <div style={{ position: 'absolute', left: -21, top: 4, width: 10, height: 10, borderRadius: '50%', background: 'var(--color-gold)', border: '2px solid #fff' }} />
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 18px' }}>
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
  const [novoCom, setNovoCom] = useState({ titulo: '', mensagem: '' })
  const [novoCon, setNovoCon] = useState({ nome: '', cargo: '', telefone: '' })
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
    await supabase.from('comunicados_cliente').insert([{ ...novoCom, obra_id: obraId }])
    setNovoCom({ titulo: '', mensagem: '' }); setShowComForm(false); await carregar(); setSalvando(false)
  }
  async function salvarContato() {
    if (!novoCon.nome.trim()) return
    setSalvando(true)
    await supabase.from('contatos_cliente').insert([{ ...novoCon, obra_id: obraId }])
    setNovoCon({ nome: '', cargo: '', telefone: '' }); setShowConForm(false); await carregar(); setSalvando(false)
  }
  async function deletarComunicado(cid) { await supabase.from('comunicados_cliente').delete().eq('id', cid); await carregar() }
  const linkPortal = window.location.origin + '/cliente/' + obraId
  return (
    <div>
      <div style={{ background: '#f9f7f4', border: '1px solid var(--color-border)', borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--color-gold)', fontWeight: 600, marginBottom: 4 }}>Link do Portal do Cliente</div>
          <div style={{ fontSize: 12, color: 'var(--color-ink-muted)', wordBreak: 'break-all' }}>{linkPortal}</div>
        </div>
        <button onClick={() => navigator.clipboard.writeText(linkPortal)} style={{ background: 'var(--color-ink)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>Copiar link</button>
      </div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase' }}>Comunicados ao cliente</div>
          <button onClick={() => setShowComForm(!showComForm)} style={{ background: 'var(--color-ink)', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>{showComForm ? 'Cancelar' : '+ Comunicado'}</button>
        </div>
        {showComForm && (
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: 18, marginBottom: 14 }}>
            <div style={{ marginBottom: 10 }}><Label>Titulo</Label><FInput value={novoCom.titulo} onChange={v => setNovoCom(p => ({ ...p, titulo: v }))} placeholder="Titulo do comunicado" /></div>
            <div style={{ marginBottom: 12 }}><Label>Mensagem</Label><textarea value={novoCom.mensagem} onChange={e => setNovoCom(p => ({ ...p, mensagem: e.target.value }))} rows={3} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={salvarComunicado} disabled={salvando} style={{ background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{salvando ? 'Salvando...' : 'Publicar'}</button></div>
          </div>
        )}
        {loadingC ? <div style={{ color: '#bbb' }}>Carregando...</div>
          : comunicados.length === 0 ? <div style={{ color: '#bbb', fontSize: 13 }}>Nenhum comunicado enviado.</div>
          : comunicados.map(c => (
            <div key={c.id} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 16px', marginBottom: 8, display: 'flex', gap: 12 }}>
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
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase' }}>Contatos visiveis ao cliente</div>
          <button onClick={() => setShowConForm(!showConForm)} style={{ background: 'var(--color-ink)', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>{showConForm ? 'Cancelar' : '+ Contato'}</button>
        </div>
        {showConForm && (
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: 18, marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><Label>Nome</Label><FInput value={novoCon.nome} onChange={v => setNovoCon(p => ({ ...p, nome: v }))} placeholder="Nome" /></div>
              <div><Label>Cargo</Label><FInput value={novoCon.cargo} onChange={v => setNovoCon(p => ({ ...p, cargo: v }))} placeholder="Ex: Supervisor" /></div>
              <div style={{ gridColumn: '1/-1' }}><Label>Telefone (WhatsApp)</Label><FInput value={novoCon.telefone} onChange={v => setNovoCon(p => ({ ...p, telefone: v }))} placeholder="(48) 99999-9999" /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={salvarContato} disabled={salvando} style={{ background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{salvando ? 'Salvando...' : 'Adicionar'}</button></div>
          </div>
        )}
        {contatos.map(c => (
          <div key={c.id} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 14 }}>
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
  useEffect(() => { carregar() }, [])
  function avisar(tipo, texto) {
    setMensagem({ tipo, texto })
  }
  function erroTexto(error, fallback) {
    return error?.message || error?.details || fallback
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
          border: '1px solid ' + (mensagem.tipo === 'erro' ? '#f1c6c6' : mensagem.tipo === 'sucesso' ? '#c8e1d0' : '#e6d8bd'),
          background: mensagem.tipo === 'erro' ? '#fff6f6' : mensagem.tipo === 'sucesso' ? '#f4fbf6' : '#fff8ec',
          color: mensagem.tipo === 'erro' ? '#B84040' : mensagem.tipo === 'sucesso' ? '#2D7A4A' : '#9A6A22',
          borderRadius: 8,
          padding: '9px 11px',
          fontSize: 12.5,
          fontWeight: 600,
        }}>
          {mensagem.texto}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <select value={selecionado} onChange={e => setSelecionado(e.target.value)} style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
          <option value="">-- Selecione montador --</option>
          {naoAlocados.map(m => <option key={m.id} value={m.id}>{m.full_name}{m.cargo ? ' · ' + m.cargo : ''}</option>)}
        </select>
        <button onClick={alocar} disabled={!selecionado || adicionando} style={{ background: 'var(--color-ink)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{adicionando ? '...' : '+ Alocar'}</button>
      </div>
      {loading ? <div style={{ color: '#bbb', fontSize: 13 }}>Carregando...</div>
        : montadores.length === 0 ? <div style={{ color: '#bbb', fontSize: 13 }}>Nenhum montador alocado.</div>
        : montadores.map(m => (
          <div key={m.montador_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#b09a7a22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#b09a7a' }}>{(m.montador?.full_name || '?')[0].toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>{m.montador?.full_name || 'Montador não encontrado'}</div>
              {m.montador?.role && <div style={{ fontSize: 11, color: '#aaa' }}>{m.montador.role}</div>}
            </div>
            <button onClick={() => remover(m.montador_id)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 13, padding: '4px 8px' }}>Remover</button>
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
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 10 }}>
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
      <select value={tarefa.status} onChange={handleStatus} disabled={mudando} style={{ fontSize: 11.5, padding: '5px 9px', borderRadius: 7, border: '1px solid #ddd', background: '#fafaf8', color: st.color, fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>
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
function FInput({ onChange, ...props }) { return <input {...props} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: `1px solid ${THEME.border}`, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none', background: '#FFFEFC', color: THEME.ink }} /> }
function FSelect({ onChange, children, ...props }) { return <select {...props} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: `1px solid ${THEME.border}`, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', background: '#FFFEFC', color: THEME.ink }}>{children}</select> }
