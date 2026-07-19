import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { criarNotificacoes } from '../../services/notificacoesService'

const LARANJA = '#E47D3C'
const STATUS = [
  ['rascunho', 'Rascunho'], ['aguardando_transportadora', 'Aguardando transportadora'],
  ['confirmado', 'Confirmado'], ['em_transito', 'Em trânsito'], ['chegou', 'Chegou ao local'],
  ['conferencia', 'Em conferência'], ['concluida', 'Concluída'], ['reagendada', 'Reagendada'],
  ['atrasada', 'Atrasada'], ['parcial', 'Entrega parcial'], ['recusada', 'Recusada'],
  ['cancelada', 'Cancelada'], ['avaria', 'Com avaria'],
]
const STATUS_LABEL = Object.fromEntries(STATUS)
const TIPOS = ['Entrega de móveis', 'Retirada', 'Devolução', 'Transferência entre obras']
const vazio = { obra_id: '', tipo: 'Entrega de móveis', status: 'rascunho', transportadora: '', motorista_nome: '', motorista_telefone: '', veiculo: '', placa: '', data_entrega: '', hora_inicio: '', hora_fim: '', endereco_origem: '', endereco_destino: '', responsavel_recebimento_id: '', descricao_carga: '', nota_fiscal: '', romaneio: '', pedido: '', instrucoes_acesso: '', observacao: '', visivel_montador: true, visivel_cliente: false }

function safe(result) { return result?.data || [] }
function dataBR(value) { if (!value) return 'Sem data'; const [a,m,d] = String(value).slice(0,10).split('-'); return `${d}/${m}/${a}` }
function hora(value) { return value ? String(value).slice(0,5) : '' }
function classeStatus(status) { return ['atrasada','recusada','avaria'].includes(status) ? 'danger' : ['concluida'].includes(status) ? 'success' : ['cancelada','rascunho'].includes(status) ? 'muted' : 'orange' }

export default function Logistica() {
  const { user, profile } = useStore()
  const [params, setParams] = useSearchParams()
  const [dados, setDados] = useState({ entregas: [], obras: [], profiles: [], vinculos: [], equipes: [] })
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(vazio)
  const [montadores, setMontadores] = useState([])
  const [salvando, setSalvando] = useState(false)
  const [filtros, setFiltros] = useState({ busca: '', status: '', mes: new Date().toISOString().slice(0,7) })
  const somenteLeitura = !['gestao','supervisor'].includes(profile?.role)

  async function carregar() {
    setLoading(true); setErro('')
    const [entregas, obras, profiles, vinculos, equipes] = await Promise.all([
      supabase.from('logistica_entregas').select('*').order('data_entrega').order('hora_inicio'),
      supabase.from('obras').select('id,nome,cliente_nome,endereco,cidade,uf,supervisor_id,status').order('nome'),
      supabase.from('profiles').select('id,full_name,email,role'),
      supabase.from('logistica_montadores').select('logistica_id,montador_id'),
      supabase.from('obra_montadores').select('obra_id,montador_id'),
    ])
    if (entregas.error) setErro(entregas.error.message?.includes('logistica_entregas') ? 'O banco ainda precisa receber a migração do módulo Logística (docs/supabase-logistica.sql).' : entregas.error.message)
    setDados({ entregas: safe(entregas), obras: safe(obras), profiles: safe(profiles), vinculos: safe(vinculos), equipes: safe(equipes) })
    setLoading(false)
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [])

  useEffect(() => {
    const id = params.get('entrega')
    if (!id || !dados.entregas.length) return
    const item = dados.entregas.find(e => e.id === id)
    if (item) abrir(item)
  }, [dados.entregas, params]) // eslint-disable-line react-hooks/exhaustive-deps

  const obraPorId = useMemo(() => new Map(dados.obras.map(o => [o.id,o])), [dados.obras])
  const pessoaPorId = useMemo(() => new Map(dados.profiles.map(p => [p.id,p])), [dados.profiles])
  const lista = useMemo(() => dados.entregas.filter(e => {
    const obra = obraPorId.get(e.obra_id) || {}
    const texto = `${obra.nome || ''} ${obra.cliente_nome || ''} ${e.transportadora || ''} ${e.motorista_nome || ''} ${e.placa || ''}`.toLowerCase()
    return (!filtros.busca || texto.includes(filtros.busca.toLowerCase())) && (!filtros.status || e.status === filtros.status) && (!filtros.mes || String(e.data_entrega || '').startsWith(filtros.mes))
  }), [dados.entregas, filtros, obraPorId])
  const kpis = useMemo(() => ({
    previstas: lista.filter(e => !['cancelada','concluida'].includes(e.status)).length,
    transito: lista.filter(e => e.status === 'em_transito').length,
    atencao: lista.filter(e => ['atrasada','parcial','recusada','avaria'].includes(e.status)).length,
    concluidas: lista.filter(e => e.status === 'concluida').length,
  }), [lista])

  function abrir(item = null) {
    if (item) {
      setForm({ ...vazio, ...item, hora_inicio: hora(item.hora_inicio), hora_fim: hora(item.hora_fim) })
      setMontadores(dados.vinculos.filter(v => v.logistica_id === item.id).map(v => v.montador_id))
      setParams({ entrega: item.id })
    } else { setForm(vazio); setMontadores([]); setParams({}) }
    setModal(true)
  }
  function fechar() { setModal(false); setParams({}) }
  function alterarObra(id) {
    const obra = obraPorId.get(id)
    setForm(f => ({ ...f, obra_id: id, endereco_destino: obra ? [obra.endereco, obra.cidade, obra.uf].filter(Boolean).join(' · ') : '' }))
    setMontadores(dados.equipes.filter(v => v.obra_id === id).map(v => v.montador_id))
  }
  function setCampo(campo, valor) { setForm(f => ({ ...f, [campo]: valor })) }

  async function salvar(e) {
    e.preventDefault()
    if (!form.obra_id || !form.data_entrega) { setToast('Selecione a obra e informe a data da entrega.'); return }
    setSalvando(true)
    const payload = { ...form, responsavel_recebimento_id: form.responsavel_recebimento_id || null, hora_inicio: form.hora_inicio || null, hora_fim: form.hora_fim || null, criado_por: form.criado_por || user?.id }
    delete payload.id; delete payload.created_at; delete payload.updated_at
    const result = form.id ? await supabase.from('logistica_entregas').update(payload).eq('id', form.id).select().single() : await supabase.from('logistica_entregas').insert(payload).select().single()
    if (result.error) { setToast(`Não foi possível salvar: ${result.error.message}`); setSalvando(false); return }
    const id = result.data.id
    await supabase.from('logistica_montadores').delete().eq('logistica_id', id)
    if (montadores.length) await supabase.from('logistica_montadores').insert(montadores.map(montador_id => ({ logistica_id: id, montador_id })))
    const obra = obraPorId.get(form.obra_id) || {}
    const destinatarios = new Set([obra.supervisor_id, form.responsavel_recebimento_id, ...montadores].filter(Boolean))
    await criarNotificacoes([...destinatarios].map(usuario_id => ({ usuario_id, obra_id: form.obra_id, tipo: 'logistica_entrega', titulo: form.id ? 'Entrega logística atualizada' : 'Nova entrega programada', descricao: `${form.tipo} em ${dataBR(form.data_entrega)}${form.hora_inicio ? ` às ${form.hora_inicio}` : ''} · ${obra.nome || obra.cliente_nome || 'Obra'}`, prioridade: 'alta', entidade_tipo: 'logistica', entidade_id: id, rota: `/logistica?entrega=${id}` })))
    setToast('Transporte salvo e envolvidos avisados.'); fechar(); await carregar(); setSalvando(false)
  }

  async function mudarStatus(item, status) {
    const extras = status === 'em_transito' ? { saiu_em: new Date().toISOString() } : status === 'chegou' ? { chegou_em: new Date().toISOString() } : status === 'concluida' ? { recebido_em: new Date().toISOString(), recebido_por: user?.id } : {}
    const { error } = await supabase.from('logistica_entregas').update({ status, ...extras }).eq('id', item.id)
    if (error) return setToast(error.message)
    setToast(`Status alterado para ${STATUS_LABEL[status]}.`); await carregar()
  }

  const montadoresDisponiveis = dados.equipes.filter(v => v.obra_id === form.obra_id).map(v => pessoaPorId.get(v.montador_id)).filter(Boolean)

  return <div className="log-page">
    <style>{css}</style>
    <header className="log-head"><div><div className="eyebrow">ORNARE WORKS · OPERAÇÃO</div><h1>Logística</h1><p>Entregas, retiradas e transportes conectados às obras.</p></div>{!somenteLeitura && <button className="primary" onClick={() => abrir()}>+ Criar transporte</button>}</header>
    {toast && <button className="toast" onClick={() => setToast('')}>{toast} ×</button>}
    {erro && <div className="alert"><strong>Módulo aguardando configuração</strong><span>{erro}</span></div>}
    <section className="kpis"><Kpi label="Entregas previstas" value={kpis.previstas}/><Kpi label="Em trânsito" value={kpis.transito}/><Kpi label="Exigem atenção" value={kpis.atencao} danger/><Kpi label="Concluídas" value={kpis.concluidas}/></section>
    <section className="panel"><div className="toolbar"><input placeholder="Buscar obra, transportadora, placa..." value={filtros.busca} onChange={e => setFiltros({...filtros,busca:e.target.value})}/><input type="month" value={filtros.mes} onChange={e => setFiltros({...filtros,mes:e.target.value})}/><select value={filtros.status} onChange={e => setFiltros({...filtros,status:e.target.value})}><option value="">Todos os status</option>{STATUS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      {loading ? <div className="empty">Carregando logística...</div> : !lista.length ? <div className="empty"><b>Nenhum transporte encontrado.</b><span>Crie a primeira entrega para ela aparecer aqui e no Planejamento.</span></div> : <div className="cards">{lista.map(item => { const obra=obraPorId.get(item.obra_id)||{}; const equipe=dados.vinculos.filter(v=>v.logistica_id===item.id).map(v=>pessoaPorId.get(v.montador_id)?.full_name).filter(Boolean); return <article className="delivery" key={item.id} onClick={() => abrir(item)}><div className="date"><strong>{dataBR(item.data_entrega)}</strong><span>{hora(item.hora_inicio)}{item.hora_fim ? `–${hora(item.hora_fim)}` : ''}</span></div><div className="delivery-main"><div className="line"><h3>{obra.nome || obra.cliente_nome || 'Obra'}</h3><span className={`badge ${classeStatus(item.status)}`}>{STATUS_LABEL[item.status] || item.status}</span></div><p><b>{item.tipo}</b> · {item.transportadora || 'Transportadora não definida'}{item.placa ? ` · ${item.placa}` : ''}</p><small>{item.endereco_destino || 'Destino não informado'}</small>{equipe.length > 0 && <small>Equipe avisada: {equipe.join(', ')}</small>}</div><div className="quick" onClick={e=>e.stopPropagation()}>{item.status==='confirmado'&&<button onClick={()=>mudarStatus(item,'em_transito')}>Saiu para entrega</button>}{item.status==='em_transito'&&<button onClick={()=>mudarStatus(item,'chegou')}>Chegou</button>}{['chegou','conferencia'].includes(item.status)&&<button onClick={()=>mudarStatus(item,'concluida')}>Concluir</button>}</div></article>})}</div>}
    </section>
    {modal && <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&fechar()}><form className="modal" onSubmit={salvar}><div className="modal-head"><div><span className="eyebrow">TRANSPORTE LOGÍSTICO</span><h2>{form.id ? 'Detalhes da entrega' : 'Nova entrega'}</h2></div><button type="button" className="close" onClick={fechar}>×</button></div><div className="form-grid">
      <Field label="Obra / cliente *" wide><select value={form.obra_id} onChange={e=>alterarObra(e.target.value)} disabled={somenteLeitura}><option value="">Selecione...</option>{dados.obras.map(o=><option key={o.id} value={o.id}>{o.nome || o.cliente_nome}</option>)}</select></Field>
      <Field label="Operação"><select value={form.tipo} onChange={e=>setCampo('tipo',e.target.value)} disabled={somenteLeitura}>{TIPOS.map(t=><option key={t}>{t}</option>)}</select></Field><Field label="Status"><select value={form.status} onChange={e=>setCampo('status',e.target.value)} disabled={somenteLeitura}>{STATUS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
      <Field label="Data *"><input type="date" value={form.data_entrega} onChange={e=>setCampo('data_entrega',e.target.value)} disabled={somenteLeitura}/></Field><Field label="Janela de horário"><div className="inline"><input type="time" value={form.hora_inicio} onChange={e=>setCampo('hora_inicio',e.target.value)} disabled={somenteLeitura}/><input type="time" value={form.hora_fim} onChange={e=>setCampo('hora_fim',e.target.value)} disabled={somenteLeitura}/></div></Field>
      <Field label="Transportadora"><input value={form.transportadora} onChange={e=>setCampo('transportadora',e.target.value)} disabled={somenteLeitura}/></Field><Field label="Motorista"><input value={form.motorista_nome} onChange={e=>setCampo('motorista_nome',e.target.value)} disabled={somenteLeitura}/></Field><Field label="Telefone"><input value={form.motorista_telefone} onChange={e=>setCampo('motorista_telefone',e.target.value)} disabled={somenteLeitura}/></Field><Field label="Veículo / placa"><div className="inline"><input value={form.veiculo} onChange={e=>setCampo('veiculo',e.target.value)} disabled={somenteLeitura}/><input value={form.placa} onChange={e=>setCampo('placa',e.target.value.toUpperCase())} disabled={somenteLeitura}/></div></Field>
      <Field label="Origem" wide><input value={form.endereco_origem} onChange={e=>setCampo('endereco_origem',e.target.value)} disabled={somenteLeitura}/></Field><Field label="Destino" wide><input value={form.endereco_destino} onChange={e=>setCampo('endereco_destino',e.target.value)} disabled={somenteLeitura}/></Field>
      <Field label="Responsável pelo recebimento"><select value={form.responsavel_recebimento_id} onChange={e=>setCampo('responsavel_recebimento_id',e.target.value)} disabled={somenteLeitura}><option value="">Não definido</option>{dados.profiles.filter(p=>['gestao','supervisor','montador'].includes(p.role)).map(p=><option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</select></Field><Field label="Documentos"><div className="inline"><input placeholder="NF" value={form.nota_fiscal} onChange={e=>setCampo('nota_fiscal',e.target.value)} disabled={somenteLeitura}/><input placeholder="Romaneio" value={form.romaneio} onChange={e=>setCampo('romaneio',e.target.value)} disabled={somenteLeitura}/><input placeholder="Pedido" value={form.pedido} onChange={e=>setCampo('pedido',e.target.value)} disabled={somenteLeitura}/></div></Field>
      <Field label="Carga" wide><textarea value={form.descricao_carga} onChange={e=>setCampo('descricao_carga',e.target.value)} disabled={somenteLeitura}/></Field><Field label="Acesso e descarga" wide><textarea value={form.instrucoes_acesso} onChange={e=>setCampo('instrucoes_acesso',e.target.value)} disabled={somenteLeitura}/></Field>
      <Field label="Montadores envolvidos" wide><div className="checks">{montadoresDisponiveis.length ? montadoresDisponiveis.map(p=><label key={p.id}><input type="checkbox" checked={montadores.includes(p.id)} onChange={e=>setMontadores(v=>e.target.checked?[...new Set([...v,p.id])]:v.filter(id=>id!==p.id))} disabled={somenteLeitura}/>{p.full_name || p.email}</label>) : <span>Selecione uma obra com equipe alocada.</span>}</div></Field>
      <Field label="Visibilidade" wide><div className="checks"><label><input type="checkbox" checked={form.visivel_montador} onChange={e=>setCampo('visivel_montador',e.target.checked)} disabled={somenteLeitura}/>Montadores podem ver</label><label><input type="checkbox" checked={form.visivel_cliente} onChange={e=>setCampo('visivel_cliente',e.target.checked)} disabled={somenteLeitura}/>Cliente pode ver</label></div></Field>
    </div><div className="modal-actions"><button type="button" onClick={fechar}>Fechar</button>{!somenteLeitura&&<button className="primary" disabled={salvando}>{salvando?'Salvando...':'Salvar e avisar envolvidos'}</button>}</div></form></div>}
  </div>
}

function Kpi({label,value,danger}) { return <div className={`kpi ${danger&&value?'danger':''}`}><span>{label}</span><b>{value}</b></div> }
function Field({label,wide,children}) { return <label className={wide?'field wide':'field'}><span>{label}</span>{children}</label> }

const css = `
.log-page{padding:28px 34px 70px;color:var(--color-ink);max-width:1500px;margin:auto}.log-head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:24px}.eyebrow{font-size:10px;letter-spacing:2px;font-weight:900;color:#d8aa50}.log-head h1{font-family:var(--font-serif);font-size:46px;font-weight:500;margin:5px 0}.log-head p{margin:0;color:var(--color-ink-muted)}button{cursor:pointer}.primary{border:0;background:${LARANJA};color:#fff;border-radius:9px;padding:13px 18px;font-weight:900}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}.kpi,.panel{background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px}.kpi{padding:18px}.kpi span{display:block;color:var(--color-ink-muted);font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:800}.kpi b{font-size:30px}.kpi.danger{border-color:#b74b42}.panel{padding:18px}.toolbar{display:grid;grid-template-columns:1fr 180px 240px;gap:10px;margin-bottom:16px}input,select,textarea{width:100%;box-sizing:border-box;background:var(--color-surface-soft,#24211e);border:1px solid var(--color-border);color:var(--color-ink);border-radius:8px;padding:11px 12px;min-height:42px}textarea{min-height:74px;resize:vertical}.cards{display:grid;gap:9px}.delivery{display:grid;grid-template-columns:130px 1fr auto;gap:18px;align-items:center;padding:15px;border:1px solid var(--color-border);border-left:5px solid ${LARANJA};border-radius:11px;background:color-mix(in srgb, ${LARANJA} 7%, var(--color-surface));cursor:pointer}.date{display:grid;gap:3px}.date strong{font-size:15px}.date span,.delivery small{color:var(--color-ink-muted)}.delivery-main{display:grid;gap:5px}.line{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.line h3,.delivery p{margin:0}.delivery small{display:block}.badge{font-size:10px;padding:5px 8px;border-radius:999px;font-weight:900}.badge.orange{background:#e47d3c25;color:#ff9a5c}.badge.success{background:#3c976525;color:#67cf91}.badge.danger{background:#b74b4225;color:#ef7770}.badge.muted{background:#8882;color:#aaa}.quick button,.modal-actions>button:not(.primary){background:transparent;color:var(--color-ink);border:1px solid var(--color-border);padding:9px 11px;border-radius:8px;font-weight:800}.empty{padding:55px;text-align:center;color:var(--color-ink-muted);display:grid;gap:7px}.alert,.toast{margin-bottom:14px;border-radius:10px;padding:13px 15px}.alert{display:grid;gap:4px;background:#b74b421b;border:1px solid #b74b4266}.toast{position:fixed;z-index:100;right:24px;top:80px;background:#29251f;color:#fff;border:1px solid #d8aa50;box-shadow:0 12px 35px #0008}.overlay{position:fixed;z-index:120;inset:0;background:#000b;display:flex;justify-content:flex-end}.modal{width:min(840px,95vw);height:100%;overflow:auto;background:var(--color-bg);padding:24px;box-sizing:border-box}.modal-head,.modal-actions{display:flex;justify-content:space-between;align-items:center}.modal-head h2{font-family:var(--font-serif);font-size:32px;margin:5px 0 18px}.close{border:0;background:transparent;color:var(--color-ink);font-size:30px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.field{display:grid;gap:6px}.field>span{font-size:11px;color:var(--color-ink-muted);font-weight:800}.field.wide{grid-column:1/-1}.inline{display:flex;gap:7px}.checks{display:flex;flex-wrap:wrap;gap:8px 18px;border:1px solid var(--color-border);border-radius:8px;padding:12px}.checks label{display:flex;align-items:center;gap:7px}.checks input{width:auto;min-height:auto}.modal-actions{margin-top:20px;border-top:1px solid var(--color-border);padding-top:18px}.modal-actions{justify-content:flex-end;gap:9px}@media(max-width:800px){.log-page{padding:18px 14px 90px}.log-head{align-items:flex-start;flex-direction:column}.log-head h1{font-size:38px}.kpis{grid-template-columns:1fr 1fr}.toolbar{grid-template-columns:1fr}.delivery{grid-template-columns:1fr}.form-grid{grid-template-columns:1fr}.field.wide{grid-column:auto}.quick{display:flex}.modal{width:100%}}
`
