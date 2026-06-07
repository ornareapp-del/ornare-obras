import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { tarefasService } from '../../services/tarefasService'
// já tem supabase importado, não precisa adicionar

const ST = {
  'Em montagem':  { label: 'Em montagem',  bg: '#edf7f0', color: '#3a7d4f' },
  'Em andamento': { label: 'Em andamento', bg: '#edf7f0', color: '#3a7d4f' },
  'Concluída':    { label: 'Concluída',    bg: '#eef2f8', color: '#3a5580' },
  'Pausada':      { label: 'Pausada',      bg: '#fdf3e3', color: '#a0692a' },
  'Cancelada':    { label: 'Cancelada',    bg: '#fdecea', color: '#a03030' },
  'Planejamento': { label: 'Planejamento', bg: '#f5f0ff', color: '#6040a0' },
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
const ABAS = ['Visão Geral', 'Tarefas', 'Checklist', 'Fotos', 'Ocorrências', 'Gastos', 'Cliente', 'Histórico']

export default function ObraDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [obra, setObra] = useState(null)
  const [aba, setAba] = useState('Visão Geral')
  const [loading, setLoading] = useState(true)
  const [tarefas, setTarefas] = useState([])
  const [profiles, setProfiles] = useState([])
  const [progresso, setProgresso] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [nova, setNova] = useState({ titulo: '', descricao: '', prioridade: 'media', prazo: '', responsavel_id: '', status: 'pendente' })

  useEffect(() => { carregarObra(); carregarProfiles() }, [id])
  useEffect(() => { if (aba === 'Tarefas') carregarTarefas() }, [aba, id])

  async function carregarObra() {
    const { data } = await supabase.from('obras').select('*').eq('id', id).single()
    setObra(data)
    setLoading(false)
  }
  async function carregarProfiles() {
    const { data } = await supabase.from('profiles').select('id, full_name, email')
    setProfiles(data || [])
  }
  async function carregarTarefas() {
    const data = await tarefasService.listarPorObra(id)
    setTarefas(data || [])
    const p = await tarefasService.calcularProgresso(id)
    setProgresso(p)
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

  if (loading) return <div style={{ padding: 60, color: '#bbb', textAlign: 'center' }}>Carregando...</div>
  if (!obra) return <div style={{ padding: 60, color: '#bbb' }}>Obra não encontrada.</div>

  const st = ST[obra.status] || { label: obra.status, bg: '#f0ece6', color: '#888' }

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100, margin: '0 auto' }}>
      <button onClick={() => navigate('/obras')} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--color-ink-muted)', cursor: 'pointer', padding: 0, marginBottom: 16 }}>
        ← Obras
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 6 }}>Detalhe da Obra</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 500, color: 'var(--color-ink)', margin: 0 }}>{obra.nome}</h1>
          <div style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 4 }}>{obra.cliente_nome}{obra.cidade ? ` · ${obra.cidade}` : ''}</div>
        </div>
        <span style={{ padding: '5px 14px', borderRadius: 20, background: st.bg, color: st.color, fontSize: 12, fontWeight: 500 }}>{st.label}</span>
      </div>

      <div style={{ display: 'flex', gap: 14, margin: '24px 0 32px', flexWrap: 'wrap' }}>
        {[
          { label: 'Início', value: obra.data_inicio ? new Date(obra.data_inicio).toLocaleDateString('pt-BR') : '—' },
          { label: 'Previsão', value: obra.data_previsao ? new Date(obra.data_previsao).toLocaleDateString('pt-BR') : '—' },
          { label: 'Progresso', value: `${obra.progresso || 0}%` },
          { label: 'Contrato', value: obra.valor_contrato ? `R$ ${Number(obra.valor_contrato).toLocaleString('pt-BR')}` : '—' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 20px', minWidth: 120 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--color-ink)' }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: 28, overflowX: 'auto' }}>
        {ABAS.map(a => (
          <button key={a} onClick={() => setAba(a)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 18px', fontSize: 12.5, whiteSpace: 'nowrap',
            color: aba === a ? 'var(--color-gold)' : 'var(--color-ink-muted)',
            fontWeight: aba === a ? 600 : 400,
            borderBottom: aba === a ? '2px solid var(--color-gold)' : '2px solid transparent',
            marginBottom: -1,
          }}>{a}</button>
        ))}
      </div>

      {aba === 'Visão Geral' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card titulo="Cliente">
            <Info label="Nome" value={obra.cliente_nome} />
            <Info label="E-mail" value={obra.cliente_email} />
            <Info label="Telefone" value={obra.cliente_telefone} />
          </Card>
          <Card titulo="Obra">
            <Info label="Endereço" value={obra.endereco} />
            <Info label="Cidade" value={obra.cidade} />
            <Info label="Comercial" value={obra.comercial_nome} />
          </Card>
          {obra.observacoes && (
            <Card titulo="Observações" style={{ gridColumn: '1/-1' }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink-mid)', lineHeight: 1.7 }}>{obra.observacoes}</p>
            </Card>
          )}
        </div>
      )}

      {aba === 'Tarefas' && (
        <div>
          {tarefas.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-ink-muted)', marginBottom: 6 }}>
                <span>{tarefas.filter(t => t.status === 'concluida').length} de {tarefas.length} concluídas</span>
                <span style={{ color: 'var(--color-gold)', fontWeight: 600 }}>{progresso}%</span>
              </div>
              <div style={{ height: 4, background: 'var(--color-border-light)', borderRadius: 2 }}>
                <div style={{ height: 4, background: 'var(--color-gold)', borderRadius: 2, width: `${progresso}%`, transition: 'width 0.4s' }} />
              </div>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={() => setShowForm(!showForm)} style={{ background: 'var(--color-ink)', color: '#f9f7f4', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
              {showForm ? '✕ Cancelar' : '+ Nova Tarefa'}
            </button>
          </div>
          {showForm && (
            <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 22, marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <Label>Título *</Label>
                  <FInput value={nova.titulo} onChange={v => setNova(p => ({ ...p, titulo: v }))} placeholder="Título da tarefa" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <Label>Descrição</Label>
                  <textarea value={nova.descricao} onChange={e => setNova(p => ({ ...p, descricao: e.target.value }))} rows={2} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <FSelect value={nova.prioridade} onChange={v => setNova(p => ({ ...p, prioridade: v }))}>
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </FSelect>
                </div>
                <div>
                  <Label>Prazo</Label>
                  <FInput type="date" value={nova.prazo} onChange={v => setNova(p => ({ ...p, prazo: v }))} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <Label>Responsável</Label>
                  <FSelect value={nova.responsavel_id} onChange={v => setNova(p => ({ ...p, responsavel_id: v }))}>
                    <option value="">Sem responsável</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
                  </FSelect>
                </div>
              </div>
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={salvarTarefa} disabled={salvando || !nova.titulo.trim()} style={{ background: salvando ? '#ccc' : 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {salvando ? 'Salvando...' : 'Criar Tarefa'}
                </button>
              </div>
            </div>
          )}
          {tarefas.length === 0
            ? <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhuma tarefa criada.</div>
            : tarefas.map(t => <CardTarefa key={t.id} tarefa={t} onMudarStatus={mudarStatus} />)
          }
        </div>
      )}

      {aba === 'Checklist' && <AbaChecklist obraId={id} />}
      {aba === 'Ocorrências' && <AbaOcorrencias obraId={id} />}
      {aba === 'Gastos' && <AbaGastos obraId={id} />}
      {aba === 'Fotos' && <AbaFotos obraId={id} />}
      {aba === 'Histórico' && <AbaHistorico obraId={id} />}
      {aba === 'Cliente' && <AbaCliente obraId={id} />}

      {!['Visão Geral','Tarefas','Checklist','Ocorrências','Gastos','Fotos','Histórico','Cliente'].includes(aba) && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb' }}>
          <strong style={{ color: 'var(--color-gold)' }}>{aba}</strong> — em desenvolvimento.
        </div>
      )}
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
    const { data } = await supabase.from('checklist_items').select('*').eq('obra_id', obraId)
    setItens(data || [])
    setLoading(false)
  }
  async function adicionar() {
    if (!novoItem.trim()) return
    setSalvando(true)
    await supabase.from('checklist_items').insert([{ obra_id: obraId, descricao: novoItem, concluido: false }])
    setNovoItem('')
    await carregar()
    setSalvando(false)
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
          <div style={{ height: 4, background: 'var(--color-border-light)', borderRadius: 2 }}>
            <div style={{ height: 4, background: 'var(--color-gold)', borderRadius: 2, width: `${pct}%`, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input value={novoItem} onChange={e => setNovoItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && adicionar()} placeholder="Novo item do checklist..." style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 13, fontFamily: 'inherit' }} />
        <button onClick={adicionar} disabled={salvando} style={{ background: 'var(--color-ink)', color: '#f9f7f4', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer' }}>
          + Adicionar
        </button>
      </div>
      {loading
        ? <div style={{ color: '#bbb' }}>Carregando...</div>
        : itens.length === 0
          ? <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhum item no checklist.</div>
          : itens.map(item => (
            <div key={item.id} onClick={() => toggle(item)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, marginBottom: 8, cursor: 'pointer' }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${item.concluido ? '#5aab6e' : '#ddd'}`, background: item.concluido ? '#5aab6e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                {item.concluido && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
              </div>
              <span style={{ fontSize: 13.5, color: item.concluido ? '#aaa' : 'var(--color-ink)', textDecoration: item.concluido ? 'line-through' : 'none' }}>
                {item.descricao}
              </span>
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
    const { data } = await supabase.from('ocorrencias').select('*').eq('obra_id', obraId).order('created_at', { ascending: false })
    setOcorrencias(data || [])
    setLoading(false)
  }
  async function salvar() {
    if (!nova.titulo.trim()) return
    setSalvando(true)
    await supabase.from('ocorrencias').insert([{ ...nova, obra_id: obraId }])
    setNova({ titulo: '', descricao: '', categoria: 'geral', gravidade: 'baixa' })
    setShowForm(false)
    await carregar()
    setSalvando(false)
  }

  const gravCor = { baixa: '#5aab6e', media: '#b09a7a', alta: '#d94a4a' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => setShowForm(!showForm)} style={{ background: 'var(--color-ink)', color: '#f9f7f4', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
          {showForm ? '✕ Cancelar' : '+ Nova Ocorrência'}
        </button>
      </div>
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 22, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <Label>Título *</Label>
              <FInput value={nova.titulo} onChange={v => setNova(p => ({ ...p, titulo: v }))} placeholder="Descreva a ocorrência" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <Label>Detalhes</Label>
              <textarea value={nova.descricao} onChange={e => setNova(p => ({ ...p, descricao: e.target.value }))} rows={3} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div>
              <Label>Categoria</Label>
              <FSelect value={nova.categoria} onChange={v => setNova(p => ({ ...p, categoria: v }))}>
                <option value="geral">Geral</option>
                <option value="atraso">Atraso</option>
                <option value="dano">Dano</option>
                <option value="retrabalho">Retrabalho</option>
                <option value="acesso">Acesso</option>
              </FSelect>
            </div>
            <div>
              <Label>Gravidade</Label>
              <FSelect value={nova.gravidade} onChange={v => setNova(p => ({ ...p, gravidade: v }))}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </FSelect>
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={salvar} disabled={salvando} style={{ background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {salvando ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </div>
      )}
      {loading
        ? <div style={{ color: '#bbb' }}>Carregando...</div>
        : ocorrencias.length === 0
          ? <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhuma ocorrência registrada.</div>
          : ocorrencias.map(oc => (
            <div key={oc.id} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '16px 18px', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: gravCor[oc.gravidade] || '#ccc', flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' }}>{oc.titulo}</span>
                <span style={{ fontSize: 10, padding: '2px 9px', borderRadius: 20, background: '#f0ece6', color: '#888', marginLeft: 'auto' }}>{oc.categoria}</span>
              </div>
              {oc.descricao && <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink-muted)', lineHeight: 1.5 }}>{oc.descricao}</p>}
              <div style={{ fontSize: 11, color: '#bbb', marginTop: 8 }}>{new Date(oc.created_at).toLocaleDateString('pt-BR')}</div>
            </div>
          ))
      }
    </div>
  )
}

function AbaGastos({ obraId }) {
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [novo, setNovo] = useState({ descricao: '', valor: '', categoria: 'material', data: '' })

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase.from('gastos').select('*').eq('obra_id', obraId).order('created_at', { ascending: false })
    setGastos(data || [])
    setLoading(false)
  }
  async function salvar() {
    if (!novo.descricao.trim() || !novo.valor) return
    setSalvando(true)
    await supabase.from('gastos').insert([{ ...novo, obra_id: obraId, valor: parseFloat(novo.valor) }])
    setNovo({ descricao: '', valor: '', categoria: 'material', data: '' })
    setShowForm(false)
    await carregar()
    setSalvando(false)
  }

  const total = gastos.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '12px 20px' }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 4 }}>Total</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-ink)' }}>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ background: 'var(--color-ink)', color: '#f9f7f4', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
          {showForm ? '✕ Cancelar' : '+ Novo Gasto'}
        </button>
      </div>
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 22, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <Label>Descrição *</Label>
              <FInput value={novo.descricao} onChange={v => setNovo(p => ({ ...p, descricao: v }))} placeholder="Ex: Material de proteção" />
            </div>
            <div>
              <Label>Valor (R$) *</Label>
              <FInput type="number" value={novo.valor} onChange={v => setNovo(p => ({ ...p, valor: v }))} placeholder="0,00" />
            </div>
            <div>
              <Label>Data</Label>
              <FInput type="date" value={novo.data} onChange={v => setNovo(p => ({ ...p, data: v }))} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <Label>Categoria</Label>
              <FSelect value={novo.categoria} onChange={v => setNovo(p => ({ ...p, categoria: v }))}>
                <option value="material">Material</option>
                <option value="mao_de_obra">Mão de obra</option>
                <option value="transporte">Transporte</option>
                <option value="ferramental">Ferramental</option>
                <option value="outro">Outro</option>
              </FSelect>
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={salvar} disabled={salvando} style={{ background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {salvando ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </div>
      )}
      {loading
        ? <div style={{ color: '#bbb' }}>Carregando...</div>
        : gastos.length === 0
          ? <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhum gasto registrado.</div>
          : gastos.map(g => (
            <div key={g.id} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 18px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-ink)' }}>{g.descricao}</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>{g.categoria}{g.data ? ` · ${new Date(g.data + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-ink)' }}>
                R$ {parseFloat(g.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          ))
      }
    </div>
  )
}

function CardTarefa({ tarefa, onMudarStatus }) {
  const st = STATUS_TAREFA[tarefa.status] || STATUS_TAREFA.pendente
  const pr = PRIORIDADE[tarefa.prioridade] || PRIORIDADE.media
  const [mudando, setMudando] = useState(false)

  async function handleStatus(e) {
    setMudando(true)
    await onMudarStatus(tarefa.id, e.target.value)
    setMudando(false)
  }

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
          {tarefa.prazo && <span style={{ fontSize: 11, color: '#aaa' }}>📅 {new Date(tarefa.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
          {tarefa.responsavel?.full_name && <span style={{ fontSize: 11, color: '#aaa' }}>👤 {tarefa.responsavel.full_name}</span>}
          <span style={{ fontSize: 11, color: pr.color }}>● {pr.label}</span>
        </div>
      </div>
      <select value={tarefa.status} onChange={handleStatus} disabled={mudando} style={{ fontSize: 11.5, padding: '5px 9px', borderRadius: 7, border: '1px solid #ddd', background: '#fafaf8', color: st.color, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
        {Object.entries(STATUS_TAREFA).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
      </select>
    </div>
  )
}

function Card({ titulo, children, style = {} }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: '20px 24px', ...style }}>
      <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 14 }}>{titulo}</div>
      {children}
    </div>
  )
}
function Info({ label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: '#aaa', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: 'var(--color-ink)', fontWeight: 500 }}>{value || '—'}</div>
    </div>
  )
}
function Label({ children }) {
  return <div style={{ fontSize: 11, color: '#888', marginBottom: 5, fontWeight: 500 }}>{children}</div>
}
function FInput({ onChange, ...props }) {
  return <input {...props} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
}
function FSelect({ onChange, children, ...props }) {
  return <select {...props} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }}>{children}</select>
}
function AbaFotos({ obraId }) {
  const [fotos, setFotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase.from('fotos').select('*').eq('obra_id', obraId).order('created_at', { ascending: false })
    setFotos(data || [])
    setLoading(false)
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${obraId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('fotos-obras').upload(path, file)
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('fotos-obras').getPublicUrl(path)
      await supabase.from('fotos').insert([{ obra_id: obraId, url: urlData.publicUrl, aprovada: false, legenda: file.name }])
      await carregar()
    }
    setUploading(false)
    e.target.value = ''
  }

  async function aprovar(foto) {
    await supabase.from('fotos').update({ aprovada: !foto.aprovada }).eq('id', foto.id)
    await carregar()
  }

  async function deletar(foto) {
    await supabase.from('fotos').delete().eq('id', foto.id)
    await carregar()
  }

  return (
    <div>
      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={preview} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--color-ink-muted)' }}>{fotos.length} foto{fotos.length !== 1 ? 's' : ''} · {fotos.filter(f => f.aprovada).length} aprovada{fotos.filter(f => f.aprovada).length !== 1 ? 's' : ''}</div>
        <label style={{ background: 'var(--color-ink)', color: '#f9f7f4', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
          {uploading ? 'Enviando...' : '+ Upload Foto'}
          <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
        </label>
      </div>

      {loading ? <div style={{ color: '#bbb' }}>Carregando...</div>
        : fotos.length === 0
          ? <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhuma foto enviada.</div>
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
              {fotos.map(foto => (
                <div key={foto.id} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
                  <div onClick={() => setPreview(foto.url)} style={{ cursor: 'zoom-in', height: 150, overflow: 'hidden' }}>
                    <img src={foto.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-ink-muted)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{foto.legenda}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => aprovar(foto)} style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', fontSize: 11, cursor: 'pointer', background: foto.aprovada ? '#edf7f0' : '#f5f5f5', color: foto.aprovada ? '#3a7d4f' : '#888', fontWeight: 500 }}>
                        {foto.aprovada ? '✓ Aprovada' : 'Aprovar'}
                      </button>
                      <button onClick={() => deletar(foto)} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', fontSize: 11, cursor: 'pointer', background: '#fdecea', color: '#a03030' }}>
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
      }
    </div>
  )
}function AbaHistorico({ obraId }) {
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase.from('historico_obra').select('*, profiles(full_name)').eq('obra_id', obraId).order('created_at', { ascending: false })
    setHistorico(data || [])
    setLoading(false)
  }

  if (loading) return <div style={{ color: '#bbb' }}>Carregando...</div>
  if (historico.length === 0) return <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhum registro no histórico.</div>

  return (
    <div style={{ position: 'relative', paddingLeft: 24 }}>
      <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, background: 'var(--color-border)' }} />
      {historico.map((h, i) => (
        <div key={h.id} style={{ position: 'relative', marginBottom: 20 }}>
          <div style={{ position: 'absolute', left: -21, top: 4, width: 10, height: 10, borderRadius: '50%', background: 'var(--color-gold)', border: '2px solid #fff' }} />
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 4 }}>{h.descricao || h.acao || 'Registro'}</div>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#aaa' }}>
              <span>{new Date(h.created_at).toLocaleDateString('pt-BR')} {new Date(h.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              {h.profiles?.full_name && <span>👤 {h.profiles.full_name}</span>}
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
    setComunicados(c || [])
    setContatos(ct || [])
    setLoadingC(false)
  }

  async function salvarComunicado() {
    if (!novoCom.titulo.trim()) return
    setSalvando(true)
    await supabase.from('comunicados_cliente').insert([{ ...novoCom, obra_id: obraId }])
    setNovoCom({ titulo: '', mensagem: '' })
    setShowComForm(false)
    await carregar()
    setSalvando(false)
  }

  async function salvarContato() {
    if (!novoCon.nome.trim()) return
    setSalvando(true)
    await supabase.from('contatos_cliente').insert([{ ...novoCon, obra_id: obraId }])
    setNovoCon({ nome: '', cargo: '', telefone: '' })
    setShowConForm(false)
    await carregar()
    setSalvando(false)
  }

  async function deletarComunicado(id) {
    await supabase.from('comunicados_cliente').delete().eq('id', id)
    await carregar()
  }

  const linkPortal = `${window.location.origin}/cliente/${obraId}`

  return (
    <div>
      {/* Link portal */}
      <div style={{ background: '#f9f7f4', border: '1px solid var(--color-border)', borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--color-gold)', fontWeight: 600, marginBottom: 4 }}>Link do Portal do Cliente</div>
          <div style={{ fontSize: 12, color: 'var(--color-ink-muted)', wordBreak: 'break-all' }}>{linkPortal}</div>
        </div>
        <button onClick={() => { navigator.clipboard.writeText(linkPortal) }} style={{ background: 'var(--color-ink)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
          Copiar link
        </button>
      </div>

      {/* Comunicados */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase' }}>Comunicados ao cliente</div>
          <button onClick={() => setShowComForm(!showComForm)} style={{ background: 'var(--color-ink)', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>
            {showComForm ? '✕' : '+ Comunicado'}
          </button>
        </div>
        {showComForm && (
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: 18, marginBottom: 14 }}>
            <div style={{ marginBottom: 10 }}>
              <Label>Título</Label>
              <FInput value={novoCom.titulo} onChange={v => setNovoCom(p => ({ ...p, titulo: v }))} placeholder="Título do comunicado" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <Label>Mensagem</Label>
              <textarea value={novoCom.mensagem} onChange={e => setNovoCom(p => ({ ...p, mensagem: e.target.value }))} rows={3} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={salvarComunicado} disabled={salvando} style={{ background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {salvando ? 'Salvando...' : 'Publicar'}
              </button>
            </div>
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
              <button onClick={() => deletarComunicado(c.id)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 16, padding: 4, alignSelf: 'flex-start' }}>✕</button>
            </div>
          ))
        }
      </div>

      {/* Contatos */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase' }}>Contatos visíveis ao cliente</div>
          <button onClick={() => setShowConForm(!showConForm)} style={{ background: 'var(--color-ink)', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>
            {showConForm ? '✕' : '+ Contato'}
          </button>
        </div>
        {showConForm && (
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: 18, marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><Label>Nome</Label><FInput value={novoCon.nome} onChange={v => setNovoCon(p => ({ ...p, nome: v }))} placeholder="Nome" /></div>
              <div><Label>Cargo</Label><FInput value={novoCon.cargo} onChange={v => setNovoCon(p => ({ ...p, cargo: v }))} placeholder="Ex: Supervisor" /></div>
              <div style={{ gridColumn: '1/-1' }}><Label>Telefone (WhatsApp)</Label><FInput value={novoCon.telefone} onChange={v => setNovoCon(p => ({ ...p, telefone: v }))} placeholder="(48) 99999-9999" /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={salvarContato} disabled={salvando} style={{ background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {salvando ? 'Salvando...' : 'Adicionar'}
              </button>
            </div>
          </div>
        )}
        {contatos.map(c => (
          <div key={c.id} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#b09a7a22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#b09a7a' }}>
              {(c.nome || '?')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-ink)' }}>{c.nome}</div>
              <div style={{ fontSize: 11.5, color: '#888' }}>{c.cargo}{c.telefone ? ` · ${c.telefone}` : ''}</div>
            </div>
            {c.telefone && (
              <a href={`https://wa.me/55${c.telefone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ background: '#25D366', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                WhatsApp
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}