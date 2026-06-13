import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { tarefasService } from '../../services/tarefasService'

const ST = {
  'Em montagem':         { label: 'Em montagem',        bg: '#edf7f0', color: '#3a7d4f' },
  'Em andamento':        { label: 'Em andamento',        bg: '#edf7f0', color: '#3a7d4f' },
  'Concluida':           { label: 'Concluida',           bg: '#eef2f8', color: '#3a5580' },
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
  concluida:    { label: 'Concluida',    color: '#5aab6e' },
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
const ABAS = ['Visao Geral','Tarefas','Checklist','Fotos','Ocorrencias','Gastos','Chat','Cliente','Historico']

export default function ObraDetalhe() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const { profile } = useStore()

  const [obra,      setObra]      = useState(null)
  const [aba,       setAba]       = useState('Visao Geral')
  const [loading,   setLoading]   = useState(true)
  const [tarefas,   setTarefas]   = useState([])
  const [profiles,  setProfiles]  = useState([])
  const [progresso, setProgresso] = useState(0)
  const [showForm,  setShowForm]  = useState(false)
  const [salvando,  setSalvando]  = useState(false)
  const [editando,  setEditando]  = useState(false)
  const [formObra,  setFormObra]  = useState({})
  const [toast,     setToast]     = useState({ msg: '', tipo: 'ok' })
  const [nova, setNova] = useState({ titulo: '', descricao: '', prioridade: 'media', prazo: '', responsavel_id: '', status: 'pendente' })

  useEffect(() => { carregarObra(); carregarProfiles() }, [id])
  useEffect(() => { if (aba === 'Tarefas') carregarTarefas() }, [aba, id])

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
      setEditando(false)
      mostrarToast('Obra atualizada com sucesso.')
    }
    setSalvando(false)
  }

  if (loading) return <div style={{ padding: 60, color: '#bbb', textAlign: 'center' }}>Carregando...</div>
  if (!obra)   return <div style={{ padding: 60, color: '#bbb' }}>Obra nao encontrada.</div>

  const st = ST[obra.status] || { label: obra.status, bg: '#f0ece6', color: '#888' }
  const supervisores = profiles.filter(p => ['gestao','supervisor'].includes(p.role))

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Toast */}
      {toast.msg && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: toast.tipo === 'erro' ? '#fdecea' : '#1A1A18', color: toast.tipo === 'erro' ? '#a03030' : '#fff', padding: '12px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, borderLeft: '3px solid ' + (toast.tipo === 'erro' ? '#d94a4a' : '#C8A86A'), zIndex: 2000, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.18)' }}>
          {toast.msg}
        </div>
      )}

      {/* Breadcrumb */}
      <button onClick={() => navigate('/obras')} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--color-ink-muted)', cursor: 'pointer', padding: 0, marginBottom: 16 }}>
        ← Obras
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
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
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderLeft: '3px solid var(--color-gold)', borderRadius: 14, padding: '24px 28px', marginBottom: 24, marginTop: 16 }}>

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
              <CampoEdit label="Previsao de termino">
                <FInput type="date" value={formObra.data_previsao || ''} onChange={v => setFormObra(p => ({ ...p, data_previsao: v }))} />
              </CampoEdit>
              <CampoEdit label="Valor do contrato (R$)">
                <FInput type="number" value={formObra.valor_contrato || ''} onChange={v => setFormObra(p => ({ ...p, valor_contrato: v }))} placeholder="0,00" />
              </CampoEdit>
              <CampoEdit label="Gasto meta (R$)">
                <FInput type="number" value={formObra.gasto_meta || ''} onChange={v => setFormObra(p => ({ ...p, gasto_meta: v }))} placeholder="0,00" />
              </CampoEdit>
              <CampoEdit label="Observacoes internas" full>
                <textarea value={formObra.observacoes || ''} onChange={e => setFormObra(p => ({ ...p, observacoes: e.target.value }))} rows={3} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
              </CampoEdit>
            </GridEdit>
          </SecaoEdit>

          <SecaoEdit titulo="Dados do Cliente">
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

          <SecaoEdit titulo="Endereco da Obra">
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

          <SecaoEdit titulo="Equipe Responsavel">
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

          <SecaoEdit titulo="Arquiteto Responsavel" last>
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button onClick={() => setEditando(false)} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '9px 20px', fontSize: 13, cursor: 'pointer', color: '#888' }}>
              Cancelar
            </button>
            <button onClick={salvarEdicaoObra} disabled={salvando} style={{ background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {salvando ? 'Salvando...' : 'Salvar alteracoes'}
            </button>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 14, margin: '24px 0 32px', flexWrap: 'wrap' }}>
        {[
          { label: 'Inicio',    value: obra.data_inicio   ? new Date(obra.data_inicio   + 'T00:00:00').toLocaleDateString('pt-BR') : '-' },
          { label: 'Previsao',  value: obra.data_previsao ? new Date(obra.data_previsao + 'T00:00:00').toLocaleDateString('pt-BR') : '-' },
          { label: 'Progresso', value: (obra.progresso || 0) + '%' },
          { label: 'Contrato',  value: obra.valor_contrato ? 'R$ ' + Number(obra.valor_contrato).toLocaleString('pt-BR') : '-' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 20px', minWidth: 120 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--color-ink)' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: 28, overflowX: 'auto' }}>
        {ABAS.map(a => (
          <button key={a} onClick={() => setAba(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px 18px', fontSize: 12.5, whiteSpace: 'nowrap', color: aba === a ? 'var(--color-gold)' : 'var(--color-ink-muted)', fontWeight: aba === a ? 600 : 400, borderBottom: aba === a ? '2px solid var(--color-gold)' : '2px solid transparent', marginBottom: -1, fontFamily: 'inherit' }}>{a}</button>
        ))}
      </div>

      {aba === 'Visao Geral' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card titulo="Cliente">
            <Info label="Nome"     value={obra.cliente_nome}     />
            <Info label="E-mail"   value={obra.cliente_email}    />
            <Info label="Telefone" value={obra.cliente_telefone} />
          </Card>
          <Card titulo="Obra">
            <Info label="Endereco"       value={[obra.rua, obra.numero, obra.complemento].filter(Boolean).join(', ') || obra.endereco} />
            <Info label="Bairro / Cidade" value={[obra.bairro, obra.cidade, obra.uf].filter(Boolean).join(', ')} />
            <Info label="CEP"            value={obra.cep} />
          </Card>
          <Card titulo="Equipe responsavel">
            <Info label="Supervisor"   value={profiles.find(p => p.id === obra.supervisor_id)?.full_name} />
            <Info label="Comercial"    value={profiles.find(p => p.id === obra.comercial_id)?.full_name || obra.comercial_nome} />
            <Info label="Executivista" value={obra.executivista_nome} />
          </Card>
          <Card titulo="Arquiteto responsavel">
            <Info label="Nome"     value={obra.arquiteto_nome}      />
            <Info label="E-mail"   value={obra.arquiteto_email}     />
            <Info label="Telefone" value={obra.arquiteto_telefone}  />
          </Card>
          <div style={{ gridColumn: '1/-1' }}>
            <AbaEquipeObra obraId={id} />
          </div>
          {obra.observacoes && (
            <div style={{ gridColumn: '1/-1' }}>
              <Card titulo="Observacoes internas">
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink-muted)', lineHeight: 1.7 }}>{obra.observacoes}</p>
              </Card>
            </div>
          )}
        </div>
      )}

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
                <div style={{ gridColumn: '1/-1' }}><Label>Descricao</Label><textarea value={nova.descricao} onChange={e => setNova(p => ({ ...p, descricao: e.target.value }))} rows={2} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} /></div>
                <div><Label>Prioridade</Label><FSelect value={nova.prioridade} onChange={v => setNova(p => ({ ...p, prioridade: v }))}><option value="baixa">Baixa</option><option value="media">Media</option><option value="alta">Alta</option></FSelect></div>
                <div><Label>Prazo</Label><FInput type="date" value={nova.prazo} onChange={v => setNova(p => ({ ...p, prazo: v }))} /></div>
                <div style={{ gridColumn: '1/-1' }}><Label>Responsavel</Label><FSelect value={nova.responsavel_id} onChange={v => setNova(p => ({ ...p, responsavel_id: v }))}><option value="">Sem responsavel</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</FSelect></div>
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
      {aba === 'Cliente'     && <AbaCliente     obraId={id} />}
    </div>
  )
}

function SecaoEdit({ titulo, children, last }) {
  return (
    <div style={{ marginBottom: last ? 8 : 24 }}>
      <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>{titulo}</div>
      {children}
      {!last && <div style={{ borderBottom: '1px solid var(--color-border)', marginTop: 20 }} />}
    </div>
  )
}
function GridEdit({ children }) { return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div> }
function CampoEdit({ label, children, full }) {
  return (
    <div style={{ gridColumn: full ? '1/-1' : undefined }}>
      <div style={{ fontSize: 10, color: '#888', marginBottom: 5, fontWeight: 500 }}>{label}</div>
      {children}
    </div>
  )
}

function AbaChecklist({ obraId }) {
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [novoItem, setNovoItem] = useState('')
  const [salvando, setSalvando] = useState(false)
  useEffect(() => { carregar() }, [])
  async function carregar() {
    const { data } = await supabase.from('checklist_items').select('*').eq('obra_id', obraId).order('created_at')
    setItens(data || []); setLoading(false)
  }
  async function adicionar() {
    if (!novoItem.trim()) return
    setSalvando(true)
    await supabase.from('checklist_items').insert([{ obra_id: obraId, descricao: novoItem, concluido: false }])
    setNovoItem(''); await carregar(); setSalvando(false)
  }
  async function toggle(item) {
    await supabase.from('checklist_items').update({ concluido: !item.concluido }).eq('id', item.id)
    await carregar()
  }
  const concluidos = itens.filter(i => i.concluido).length
  const pct = itens.length > 0 ? Math.round(concluidos / itens.length * 100) : 0
  return (
    <div>
      {itens.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-ink-muted)', marginBottom: 6 }}>
            <span>{concluidos} de {itens.length} itens</span>
            <span style={{ color: 'var(--color-gold)', fontWeight: 600 }}>{pct}%</span>
          </div>
          <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 2 }}>
            <div style={{ height: 4, background: 'var(--color-gold)', borderRadius: 2, width: pct + '%', transition: 'width 0.3s' }} />
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input value={novoItem} onChange={e => setNovoItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && adicionar()} placeholder="Novo item do checklist..." style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
        <button onClick={adicionar} disabled={salvando} style={{ background: 'var(--color-ink)', color: '#f9f7f4', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer' }}>+ Adicionar</button>
      </div>
      {loading ? <div style={{ color: '#bbb' }}>Carregando...</div>
        : itens.length === 0 ? <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhum item no checklist.</div>
        : itens.map(item => (
          <div key={item.id} onClick={() => toggle(item)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 8, cursor: 'pointer' }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, border: '2px solid ' + (item.concluido ? '#5aab6e' : '#ddd'), background: item.concluido ? '#5aab6e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {item.concluido && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>v</span>}
            </div>
            <span style={{ fontSize: 13.5, color: item.concluido ? '#aaa' : 'var(--color-ink)', textDecoration: item.concluido ? 'line-through' : 'none' }}>{item.descricao}</span>
          </div>
        ))
      }
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
        <button onClick={() => setShowForm(!showForm)} style={{ background: 'var(--color-ink)', color: '#f9f7f4', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>{showForm ? 'Cancelar' : '+ Nova Ocorrencia'}</button>
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
            <div style={{ gridColumn: '1/-1' }}><Label>Descricao *</Label><FInput value={novo.descricao} onChange={v => setNovo(p => ({ ...p, descricao: v }))} placeholder="Ex: Material de protecao" /></div>
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
  const [fotos, setFotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  useEffect(() => { carregar() }, [])
  async function carregar() {
    const { data } = await supabase.from('fotos').select('*').eq('obra_id', obraId).order('created_at', { ascending: false })
    setFotos(data || []); setLoading(false)
  }
  async function handleUpload(e) {
    const file = e.target.files[0]; if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = obraId + '/' + Date.now() + '.' + ext
    const { error: upErr } = await supabase.storage.from('fotos-obras').upload(path, file)
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('fotos-obras').getPublicUrl(path)
      await supabase.from('fotos').insert([{ obra_id: obraId, url: urlData.publicUrl, aprovada: false, observacao: file.name, storage_path: path }])
      await carregar()
    }
    setUploading(false); e.target.value = ''
  }
  async function aprovar(foto) { await supabase.from('fotos').update({ aprovada: !foto.aprovada }).eq('id', foto.id); await carregar() }
  async function deletar(foto) { await supabase.from('fotos').delete().eq('id', foto.id); await carregar() }
  return (
    <div>
      {preview && <div onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}><img src={preview} alt="preview" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} /></div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--color-ink-muted)' }}>{fotos.length} foto{fotos.length !== 1 ? 's' : ''} · {fotos.filter(f => f.aprovada).length} aprovada{fotos.filter(f => f.aprovada).length !== 1 ? 's' : ''}</div>
        <label style={{ background: 'var(--color-ink)', color: '#f9f7f4', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
          {uploading ? 'Enviando...' : '+ Upload Foto'}
          <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
        </label>
      </div>
      {loading ? <div style={{ color: '#bbb' }}>Carregando...</div>
        : fotos.length === 0 ? <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhuma foto enviada.</div>
        : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            {fotos.map(foto => (
              <div key={foto.id} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
                <div onClick={() => setPreview(foto.url)} style={{ cursor: 'zoom-in', height: 150, overflow: 'hidden', background: '#f5f5f5' }}>{foto.url && <img src={foto.url} alt={foto.observacao} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-ink-muted)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{foto.observacao}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => aprovar(foto)} style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', fontSize: 11, cursor: 'pointer', background: foto.aprovada ? '#edf7f0' : '#f5f5f5', color: foto.aprovada ? '#3a7d4f' : '#888', fontWeight: 500 }}>{foto.aprovada ? 'Aprovada' : 'Aprovar'}</button>
                    <button onClick={() => deletar(foto)} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', fontSize: 11, cursor: 'pointer', background: '#fdecea', color: '#a03030' }}>X</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

function AbaHistorico({ obraId }) {
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { carregar() }, [])
  async function carregar() {
    const { data } = await supabase.from('historico_obra').select('*, profiles(full_name)').eq('obra_id', obraId).order('created_at', { ascending: false })
    setHistorico(data || []); setLoading(false)
  }
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
  useEffect(() => { carregar() }, [])
  async function carregar() {
    const [{ data: m }, { data: t }] = await Promise.all([
      supabase.from('obra_montadores').select('*, montador:profiles!obra_montadores_montador_id_fkey(id, full_name, cargo)').eq('obra_id', obraId),
      supabase.from('profiles').select('id, full_name, cargo').eq('role', 'montador').order('full_name'),
    ])
    setMontadores(m || []); setTodos(t || []); setLoading(false)
  }
  async function alocar() {
    if (!selecionado) return
    setAdicionando(true)
    await supabase.from('obra_montadores').upsert({ obra_id: obraId, montador_id: selecionado })
    setSelecionado(''); await carregar(); setAdicionando(false)
  }
  async function remover(montadorId) {
    await supabase.from('obra_montadores').delete().eq('obra_id', obraId).eq('montador_id', montadorId)
    await carregar()
  }
  const naoAlocados = todos.filter(t => !montadores.find(m => m.montador_id === t.id))
  return (
    <Card titulo="Montadores alocados nesta obra">
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
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>{m.montador?.full_name}</div>
              {m.montador?.cargo && <div style={{ fontSize: 11, color: '#aaa' }}>{m.montador.cargo}</div>}
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
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: '20px 24px' }}>
      <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 14 }}>{titulo}</div>
      {children}
    </div>
  )
}
function Info({ label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: '#aaa', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: 'var(--color-ink)', fontWeight: 500 }}>{value || '-'}</div>
    </div>
  )
}
function Label({ children }) { return <div style={{ fontSize: 11, color: '#888', marginBottom: 5, fontWeight: 500 }}>{children}</div> }
function FInput({ onChange, ...props }) { return <input {...props} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none', background: '#fafaf8' }} /> }
function FSelect({ onChange, children, ...props }) { return <select {...props} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', background: '#fafaf8' }}>{children}</select> }