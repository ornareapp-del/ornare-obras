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
  const [dados, setDados] = useState({ entregas: [], obras: [], profiles: [], vinculos: [], equipes: [], equipeOperacional: [], obraEquipe: [], logisticaEquipe: [] })
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState(false)
  const [detalhe, setDetalhe] = useState(null)
  const [form, setForm] = useState(vazio)
  const [montadores, setMontadores] = useState([])
  const [ajudantes, setAjudantes] = useState([])
  const [salvando, setSalvando] = useState(false)
  const [filtros, setFiltros] = useState({ busca: '', status: '', mes: new Date().toISOString().slice(0,7) })
  const somenteLeitura = !['gestao','supervisor'].includes(profile?.role)

  async function carregar() {
    setLoading(true); setErro('')
    const [entregas, obras, profiles, vinculos, equipes, equipeOperacional, obraEquipe, logisticaEquipe] = await Promise.all([
      supabase.from('logistica_entregas').select('*').order('data_entrega').order('hora_inicio'),
      supabase.from('obras').select('id,nome,cliente_nome,endereco,cidade,uf,supervisor_id,status').order('nome'),
      supabase.from('profiles').select('id,full_name,email,role'),
      supabase.from('logistica_montadores').select('logistica_id,montador_id'),
      supabase.from('obra_montadores').select('obra_id,montador_id'),
      supabase.from('equipe_operacional').select('id,nome,funcao,ativo').eq('ativo',true),
      supabase.from('obra_equipe_operacional').select('obra_id,pessoa_id'),
      supabase.from('logistica_equipe').select('logistica_id,pessoa_id'),
    ])
    if (entregas.error) setErro(entregas.error.message?.includes('logistica_entregas') ? 'O banco ainda precisa receber a migração do módulo Logística (docs/supabase-logistica.sql).' : entregas.error.message)
    setDados({ entregas: safe(entregas), obras: safe(obras), profiles: safe(profiles), vinculos: safe(vinculos), equipes: safe(equipes), equipeOperacional:safe(equipeOperacional), obraEquipe:safe(obraEquipe), logisticaEquipe:safe(logisticaEquipe) })
    setLoading(false)
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [])

  useEffect(() => {
    const id = params.get('entrega')
    if (!id || !dados.entregas.length) return
    const item = dados.entregas.find(e => e.id === id)
    if (item) abrirDetalhe(item)
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

  function abrirEdicao(item = null) {
    if (item) {
      setForm({ ...vazio, ...item, hora_inicio: hora(item.hora_inicio), hora_fim: hora(item.hora_fim) })
      setMontadores(dados.vinculos.filter(v => v.logistica_id === item.id).map(v => v.montador_id))
      setAjudantes(dados.logisticaEquipe.filter(v=>v.logistica_id===item.id).map(v=>v.pessoa_id))
      setParams({ entrega: item.id })
    } else { setForm(vazio); setMontadores([]); setAjudantes([]); setParams({}) }
    setModal(true)
  }
  function abrirDetalhe(item) { setDetalhe(item); setParams({ entrega: item.id }) }
  function fecharDetalhe() { setDetalhe(null); setParams({}) }
  function editarDetalhe() { const item = detalhe; setDetalhe(null); abrirEdicao(item) }
  function fechar() { setModal(false); setParams({}) }
  function alterarObra(id) {
    const obra = obraPorId.get(id)
    setForm(f => ({ ...f, obra_id: id, endereco_destino: obra ? [obra.endereco, obra.cidade, obra.uf].filter(Boolean).join(' · ') : '' }))
    setMontadores(dados.equipes.filter(v => v.obra_id === id).map(v => v.montador_id))
    setAjudantes(dados.obraEquipe.filter(v=>v.obra_id===id).map(v=>v.pessoa_id))
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
    await supabase.from('logistica_equipe').delete().eq('logistica_id',id)
    if(ajudantes.length) await supabase.from('logistica_equipe').insert(ajudantes.map(pessoa_id=>({logistica_id:id,pessoa_id})))
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

  function imprimirEntrega(item) {
    const obra = obraPorId.get(item.obra_id) || {}
    const equipe = [...dados.vinculos.filter(v => v.logistica_id === item.id).map(v => pessoaPorId.get(v.montador_id)?.full_name).filter(Boolean),...dados.logisticaEquipe.filter(v=>v.logistica_id===item.id).map(v=>{const p=dados.equipeOperacional.find(x=>x.id===v.pessoa_id);return p?`${p.nome} (Ajudante)`:null}).filter(Boolean)]
    const responsavel = pessoaPorId.get(item.responsavel_recebimento_id)
    const esc = value => String(value || '—').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' })[char])
    const linha = (label, value) => `<div><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`
    const janela = window.open('', '_blank', 'width=980,height=760')
    if (!janela) { setToast('O navegador bloqueou a janela de impressão. Libere pop-ups e tente novamente.'); return }
    janela.document.write(`<!doctype html><html><head><title>Ordem logística · ${esc(obra.nome || obra.cliente_nome)}</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#211d19;margin:0}.top{border-bottom:4px solid #e47d3c;padding-bottom:18px;display:flex;justify-content:space-between}.brand{font-size:30px;letter-spacing:3px}.tag{font-size:10px;letter-spacing:2px;color:#a95b2c;font-weight:800}h1{font-family:Georgia,serif;font-size:30px;margin:8px 0 3px}.status{border:1px solid #e47d3c;border-radius:20px;padding:8px 12px;height:max-content;color:#a95b2c;font-weight:800}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:22px 0}.grid>div,.block{border:1px solid #ddd6cc;border-radius:9px;padding:11px}.grid small,.block small{display:block;text-transform:uppercase;letter-spacing:1px;color:#81786f;font-size:9px;font-weight:800;margin-bottom:5px}.grid strong{font-size:13px}.block{margin:10px 0;white-space:pre-wrap;font-size:13px}.route{display:grid;grid-template-columns:1fr 35px 1fr;align-items:center;gap:8px}.route b{text-align:center;color:#e47d3c}.foot{margin-top:35px;border-top:1px solid #ddd;padding-top:10px;color:#8a8178;font-size:9px;display:flex;justify-content:space-between}@media print{button{display:none}}</style></head><body><div class="top"><div><div class="brand">ORNARE</div><div class="tag">ORDEM DE TRANSPORTE LOGÍSTICO</div><h1>${esc(obra.nome || obra.cliente_nome || 'Obra')}</h1><div>${esc(obra.cliente_nome || '')}</div></div><div class="status">${esc(STATUS_LABEL[item.status] || item.status)}</div></div><div class="grid">${linha('Operação',item.tipo)}${linha('Data e janela',`${dataBR(item.data_entrega)} · ${hora(item.hora_inicio) || 'a confirmar'}${item.hora_fim ? `–${hora(item.hora_fim)}` : ''}`)}${linha('Transportadora',item.transportadora)}${linha('Motorista / telefone',[item.motorista_nome,item.motorista_telefone].filter(Boolean).join(' · '))}${linha('Veículo / placa',[item.veiculo,item.placa].filter(Boolean).join(' · '))}${linha('Responsável pelo recebimento',responsavel?.full_name || responsavel?.email)}${linha('Documentos',[item.nota_fiscal&&`NF ${item.nota_fiscal}`,item.romaneio&&`Romaneio ${item.romaneio}`,item.pedido&&`Pedido ${item.pedido}`].filter(Boolean).join(' · '))}${linha('Equipe envolvida',equipe.join(', '))}</div><div class="route"><div class="block"><small>Origem</small>${esc(item.endereco_origem)}</div><b>→</b><div class="block"><small>Destino</small>${esc(item.endereco_destino)}</div></div><div class="block"><small>Carga</small>${esc(item.descricao_carga)}</div><div class="block"><small>Instruções de acesso e descarga</small>${esc(item.instrucoes_acesso)}</div><div class="block"><small>Observações</small>${esc(item.observacao)}</div><div class="foot"><span>Ornare Works · Documento operacional</span><span>Emitido em ${new Date().toLocaleString('pt-BR')}</span></div><script>window.onload=()=>window.print()</script></body></html>`)
    janela.document.close()
  }

  async function baixarPdf(item) {
    const obra = obraPorId.get(item.obra_id) || {}
    const equipe = [...dados.vinculos.filter(v => v.logistica_id === item.id).map(v => pessoaPorId.get(v.montador_id)?.full_name).filter(Boolean),...dados.logisticaEquipe.filter(v=>v.logistica_id===item.id).map(v=>{const p=dados.equipeOperacional.find(x=>x.id===v.pessoa_id);return p?`${p.nome} (Ajudante)`:null}).filter(Boolean)]
    const responsavel = pessoaPorId.get(item.responsavel_recebimento_id)
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    doc.setFillColor(228,125,60); doc.rect(0,0,210,7,'F')
    doc.setTextColor(35,31,27); doc.setFont('helvetica','bold'); doc.setFontSize(22); doc.text('ORNARE',16,22)
    doc.setTextColor(228,125,60); doc.setFontSize(8); doc.text('ORDEM DE TRANSPORTE LOGÍSTICO',16,29)
    doc.setTextColor(35,31,27); doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.text(obra.nome || obra.cliente_nome || 'Obra',16,40)
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.text(`${STATUS_LABEL[item.status] || item.status} · ${dataBR(item.data_entrega)} · ${hora(item.hora_inicio) || 'horário a confirmar'}${item.hora_fim ? `–${hora(item.hora_fim)}` : ''}`,16,47)
    let y = 60
    const bloco = (titulo, valor) => { doc.setTextColor(130,118,105); doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.text(titulo.toUpperCase(),16,y); y+=5; doc.setTextColor(35,31,27); doc.setFont('helvetica','normal'); doc.setFontSize(10); const linhas=doc.splitTextToSize(String(valor||'—'),178); doc.text(linhas,16,y); y+=linhas.length*5+5 }
    bloco('Operação', item.tipo); bloco('Transportadora / motorista', [item.transportadora,item.motorista_nome,item.motorista_telefone,item.veiculo,item.placa].filter(Boolean).join(' · ')); bloco('Origem',item.endereco_origem); bloco('Destino',item.endereco_destino); bloco('Responsável pelo recebimento',responsavel?.full_name||responsavel?.email); bloco('Equipe envolvida',equipe.join(', ')); bloco('Carga',item.descricao_carga); bloco('Documentos',[item.nota_fiscal&&`NF ${item.nota_fiscal}`,item.romaneio&&`Romaneio ${item.romaneio}`,item.pedido&&`Pedido ${item.pedido}`].filter(Boolean).join(' · ')); bloco('Acesso e descarga',item.instrucoes_acesso); bloco('Observações',item.observacao)
    doc.setDrawColor(220,213,204); doc.line(16,282,194,282); doc.setFontSize(7); doc.setTextColor(140,130,120); doc.text(`Ornare Works · Emitido em ${new Date().toLocaleString('pt-BR')}`,16,288)
    doc.save(`ordem-logistica-${String(obra.nome || obra.cliente_nome || item.id).replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.pdf`)
  }

  const montadoresDisponiveis = dados.equipes.filter(v => v.obra_id === form.obra_id).map(v => pessoaPorId.get(v.montador_id)).filter(Boolean)
  const ajudantesDisponiveis = dados.obraEquipe.filter(v=>v.obra_id===form.obra_id).map(v=>dados.equipeOperacional.find(p=>p.id===v.pessoa_id)).filter(p=>p?.funcao==='ajudante')

  return <div className="log-page">
    <style>{css}</style>
    <header className="log-head"><div><div className="eyebrow">ORNARE WORKS · OPERAÇÃO</div><h1>Logística</h1><p>Entregas, retiradas e transportes conectados às obras.</p></div>{!somenteLeitura && <button className="primary" onClick={() => abrirEdicao()}>+ Criar transporte</button>}</header>
    {toast && <button className="toast" onClick={() => setToast('')}>{toast} ×</button>}
    {erro && <div className="alert"><strong>Módulo aguardando configuração</strong><span>{erro}</span></div>}
    <section className="kpis"><Kpi label="Entregas previstas" value={kpis.previstas}/><Kpi label="Em trânsito" value={kpis.transito}/><Kpi label="Exigem atenção" value={kpis.atencao} danger/><Kpi label="Concluídas" value={kpis.concluidas}/></section>
    <section className="panel"><div className="toolbar"><input placeholder="Buscar obra, transportadora, placa..." value={filtros.busca} onChange={e => setFiltros({...filtros,busca:e.target.value})}/><input type="month" value={filtros.mes} onChange={e => setFiltros({...filtros,mes:e.target.value})}/><select value={filtros.status} onChange={e => setFiltros({...filtros,status:e.target.value})}><option value="">Todos os status</option>{STATUS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      {loading ? <div className="empty">Carregando logística...</div> : !lista.length ? <div className="empty"><b>Nenhum transporte encontrado.</b><span>Crie a primeira entrega para ela aparecer aqui e no Planejamento.</span></div> : <div className="cards">{lista.map(item => { const obra=obraPorId.get(item.obra_id)||{}; const equipe=[...dados.vinculos.filter(v=>v.logistica_id===item.id).map(v=>pessoaPorId.get(v.montador_id)?.full_name).filter(Boolean),...dados.logisticaEquipe.filter(v=>v.logistica_id===item.id).map(v=>{const p=dados.equipeOperacional.find(x=>x.id===v.pessoa_id);return p?`${p.nome} (Ajudante)`:null}).filter(Boolean)]; return <article className="delivery" key={item.id} onClick={() => abrirDetalhe(item)}><div className="date"><strong>{dataBR(item.data_entrega)}</strong><span>{hora(item.hora_inicio)}{item.hora_fim ? `–${hora(item.hora_fim)}` : ''}</span></div><div className="delivery-main"><div className="line"><h3>{obra.nome || obra.cliente_nome || 'Obra'}</h3><span className={`badge ${classeStatus(item.status)}`}>{STATUS_LABEL[item.status] || item.status}</span></div><p><b>{item.tipo}</b> · {item.transportadora || 'Transportadora não definida'}{item.placa ? ` · ${item.placa}` : ''}</p><small>{item.endereco_destino || 'Destino não informado'}</small>{equipe.length > 0 && <small>Equipe envolvida: {equipe.join(', ')}</small>}</div><div className="quick" onClick={e=>e.stopPropagation()}>{item.status==='confirmado'&&<button onClick={()=>mudarStatus(item,'em_transito')}>Saiu para entrega</button>}{item.status==='em_transito'&&<button onClick={()=>mudarStatus(item,'chegou')}>Chegou</button>}{['chegou','conferencia'].includes(item.status)&&<button onClick={()=>mudarStatus(item,'concluida')}>Concluir</button>}</div></article>})}</div>}
    </section>
    {detalhe && <DetalheEntrega item={detalhe} obra={obraPorId.get(detalhe.obra_id)||{}} equipe={[...dados.vinculos.filter(v=>v.logistica_id===detalhe.id).map(v=>pessoaPorId.get(v.montador_id)?.full_name).filter(Boolean),...dados.logisticaEquipe.filter(v=>v.logistica_id===detalhe.id).map(v=>{const p=dados.equipeOperacional.find(x=>x.id===v.pessoa_id);return p?`${p.nome} (Ajudante)`:null}).filter(Boolean)]} responsavel={pessoaPorId.get(detalhe.responsavel_recebimento_id)} somenteLeitura={somenteLeitura} onClose={fecharDetalhe} onEdit={editarDetalhe} onPrint={()=>imprimirEntrega(detalhe)} onPdf={()=>baixarPdf(detalhe)}/>} 
    {modal && <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&fechar()}><form className="modal" onSubmit={salvar}><div className="modal-head"><div><span className="eyebrow">TRANSPORTE LOGÍSTICO</span><h2>{form.id ? 'Detalhes da entrega' : 'Nova entrega'}</h2></div><button type="button" className="close" onClick={fechar}>×</button></div><div className="form-grid">
      <Field label="Obra / cliente *" wide><select value={form.obra_id} onChange={e=>alterarObra(e.target.value)} disabled={somenteLeitura}><option value="">Selecione...</option>{dados.obras.map(o=><option key={o.id} value={o.id}>{o.nome || o.cliente_nome}</option>)}</select></Field>
      <Field label="Operação"><select value={form.tipo} onChange={e=>setCampo('tipo',e.target.value)} disabled={somenteLeitura}>{TIPOS.map(t=><option key={t}>{t}</option>)}</select></Field><Field label="Status"><select value={form.status} onChange={e=>setCampo('status',e.target.value)} disabled={somenteLeitura}>{STATUS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
      <Field label="Data *"><input type="date" value={form.data_entrega} onChange={e=>setCampo('data_entrega',e.target.value)} disabled={somenteLeitura}/></Field><Field label="Janela de horário"><div className="inline"><input type="time" value={form.hora_inicio} onChange={e=>setCampo('hora_inicio',e.target.value)} disabled={somenteLeitura}/><input type="time" value={form.hora_fim} onChange={e=>setCampo('hora_fim',e.target.value)} disabled={somenteLeitura}/></div></Field>
      <Field label="Transportadora"><input value={form.transportadora} onChange={e=>setCampo('transportadora',e.target.value)} disabled={somenteLeitura}/></Field><Field label="Motorista"><input value={form.motorista_nome} onChange={e=>setCampo('motorista_nome',e.target.value)} disabled={somenteLeitura}/></Field><Field label="Telefone"><input value={form.motorista_telefone} onChange={e=>setCampo('motorista_telefone',e.target.value)} disabled={somenteLeitura}/></Field><Field label="Veículo / placa"><div className="inline"><input value={form.veiculo} onChange={e=>setCampo('veiculo',e.target.value)} disabled={somenteLeitura}/><input value={form.placa} onChange={e=>setCampo('placa',e.target.value.toUpperCase())} disabled={somenteLeitura}/></div></Field>
      <Field label="Origem" wide><input value={form.endereco_origem} onChange={e=>setCampo('endereco_origem',e.target.value)} disabled={somenteLeitura}/></Field><Field label="Destino" wide><input value={form.endereco_destino} onChange={e=>setCampo('endereco_destino',e.target.value)} disabled={somenteLeitura}/></Field>
      <Field label="Responsável pelo recebimento"><select value={form.responsavel_recebimento_id} onChange={e=>setCampo('responsavel_recebimento_id',e.target.value)} disabled={somenteLeitura}><option value="">Não definido</option>{dados.profiles.filter(p=>['gestao','supervisor','montador'].includes(p.role)).map(p=><option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</select></Field><Field label="Documentos"><div className="inline"><input placeholder="NF" value={form.nota_fiscal} onChange={e=>setCampo('nota_fiscal',e.target.value)} disabled={somenteLeitura}/><input placeholder="Romaneio" value={form.romaneio} onChange={e=>setCampo('romaneio',e.target.value)} disabled={somenteLeitura}/><input placeholder="Pedido" value={form.pedido} onChange={e=>setCampo('pedido',e.target.value)} disabled={somenteLeitura}/></div></Field>
      <Field label="Carga" wide><textarea value={form.descricao_carga} onChange={e=>setCampo('descricao_carga',e.target.value)} disabled={somenteLeitura}/></Field><Field label="Acesso e descarga" wide><textarea value={form.instrucoes_acesso} onChange={e=>setCampo('instrucoes_acesso',e.target.value)} disabled={somenteLeitura}/></Field>
      <Field label="Montadores envolvidos" wide><div className="checks">{montadoresDisponiveis.length ? montadoresDisponiveis.map(p=><label key={p.id}><input type="checkbox" checked={montadores.includes(p.id)} onChange={e=>setMontadores(v=>e.target.checked?[...new Set([...v,p.id])]:v.filter(id=>id!==p.id))} disabled={somenteLeitura}/>{p.full_name || p.email}</label>) : <span>Selecione uma obra com equipe alocada.</span>}</div></Field>
      <Field label="Ajudantes envolvidos" wide><div className="checks">{ajudantesDisponiveis.length?ajudantesDisponiveis.map(p=><label key={p.id}><input type="checkbox" checked={ajudantes.includes(p.id)} onChange={e=>setAjudantes(v=>e.target.checked?[...new Set([...v,p.id])]:v.filter(id=>id!==p.id))} disabled={somenteLeitura}/>{p.nome} · Ajudante</label>):<span>Nenhum ajudante vinculado à obra.</span>}</div></Field>
      <Field label="Visibilidade" wide><div className="checks"><label><input type="checkbox" checked={form.visivel_montador} onChange={e=>setCampo('visivel_montador',e.target.checked)} disabled={somenteLeitura}/>Montadores podem ver</label><label><input type="checkbox" checked={form.visivel_cliente} onChange={e=>setCampo('visivel_cliente',e.target.checked)} disabled={somenteLeitura}/>Cliente pode ver</label></div></Field>
    </div><div className="modal-actions"><button type="button" onClick={fechar}>Fechar</button>{!somenteLeitura&&<button className="primary" disabled={salvando}>{salvando?'Salvando...':'Salvar e avisar envolvidos'}</button>}</div></form></div>}
  </div>
}

function DetalheEntrega({ item, obra, equipe, responsavel, somenteLeitura, onClose, onEdit, onPrint, onPdf }) {
  const documentos = [item.nota_fiscal && `NF ${item.nota_fiscal}`, item.romaneio && `Romaneio ${item.romaneio}`, item.pedido && `Pedido ${item.pedido}`].filter(Boolean)
  return <div className="overlay sheet-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><article className="delivery-sheet">
    <header className="sheet-head"><div><div className="sheet-brand">ORNARE</div><span className="eyebrow">ORDEM DE TRANSPORTE LOGÍSTICO</span><h2>{obra.nome || obra.cliente_nome || 'Obra'}</h2><p>{obra.cliente_nome || [obra.cidade,obra.uf].filter(Boolean).join(' / ')}</p></div><div className="sheet-head-actions"><span className={`badge ${classeStatus(item.status)}`}>{STATUS_LABEL[item.status] || item.status}</span><button className="close" onClick={onClose}>×</button></div></header>
    <section className="sheet-highlight"><div><small>Operação</small><strong>{item.tipo}</strong></div><div><small>Data</small><strong>{dataBR(item.data_entrega)}</strong></div><div><small>Janela prevista</small><strong>{hora(item.hora_inicio)||'A confirmar'}{item.hora_fim?`–${hora(item.hora_fim)}`:''}</strong></div></section>
    <section className="sheet-route"><Info label="Origem" value={item.endereco_origem}/><b>→</b><Info label="Destino" value={item.endereco_destino}/></section>
    <section className="sheet-grid"><Info label="Transportadora" value={item.transportadora}/><Info label="Motorista" value={[item.motorista_nome,item.motorista_telefone].filter(Boolean).join(' · ')}/><Info label="Veículo / placa" value={[item.veiculo,item.placa].filter(Boolean).join(' · ')}/><Info label="Responsável pelo recebimento" value={responsavel?.full_name||responsavel?.email}/><Info label="Equipe envolvida" value={equipe.join(', ')}/><Info label="Documentos" value={documentos.join(' · ')}/></section>
    <section className="sheet-blocks"><Info label="Descrição da carga" value={item.descricao_carga}/><Info label="Instruções de acesso e descarga" value={item.instrucoes_acesso}/>{item.observacao&&<Info label="Observações" value={item.observacao}/>}</section>
    <footer className="sheet-foot"><div><small>Documento operacional Ornare Works</small><span>Atualizado em {item.updated_at ? new Date(item.updated_at).toLocaleString('pt-BR') : '—'}</span></div><div className="sheet-buttons"><button onClick={onPrint}>Imprimir</button><button onClick={onPdf}>Baixar PDF</button>{!somenteLeitura&&<button className="primary" onClick={onEdit}>Editar entrega</button>}</div></footer>
  </article></div>
}

function Info({label,value}) { return <div className="sheet-info"><small>{label}</small><strong>{value || 'Não informado'}</strong></div> }
function Kpi({label,value,danger}) { return <div className={`kpi ${danger&&value?'danger':''}`}><span>{label}</span><b>{value}</b></div> }
function Field({label,wide,children}) { return <label className={wide?'field wide':'field'}><span>{label}</span>{children}</label> }

const css = `
.log-page{padding:28px 34px 70px;color:var(--color-ink);max-width:1500px;margin:auto}.log-head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:24px}.eyebrow{font-size:10px;letter-spacing:2px;font-weight:900;color:#d8aa50}.log-head h1{font-family:var(--font-serif);font-size:46px;font-weight:500;margin:5px 0}.log-head p{margin:0;color:var(--color-ink-muted)}button{cursor:pointer}.primary{border:0;background:${LARANJA};color:#fff;border-radius:9px;padding:13px 18px;font-weight:900}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}.kpi,.panel{background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px}.kpi{padding:18px}.kpi span{display:block;color:var(--color-ink-muted);font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:800}.kpi b{font-size:30px}.kpi.danger{border-color:#b74b42}.panel{padding:18px}.toolbar{display:grid;grid-template-columns:1fr 180px 240px;gap:10px;margin-bottom:16px}input,select,textarea{width:100%;box-sizing:border-box;background:var(--color-surface-soft,#24211e);border:1px solid var(--color-border);color:var(--color-ink);border-radius:8px;padding:11px 12px;min-height:42px}textarea{min-height:74px;resize:vertical}.cards{display:grid;gap:9px}.delivery{display:grid;grid-template-columns:130px 1fr auto;gap:18px;align-items:center;padding:15px;border:1px solid var(--color-border);border-left:5px solid ${LARANJA};border-radius:11px;background:color-mix(in srgb, ${LARANJA} 7%, var(--color-surface));cursor:pointer}.date{display:grid;gap:3px}.date strong{font-size:15px}.date span,.delivery small{color:var(--color-ink-muted)}.delivery-main{display:grid;gap:5px}.line{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.line h3,.delivery p{margin:0}.delivery small{display:block}.badge{font-size:10px;padding:5px 8px;border-radius:999px;font-weight:900}.badge.orange{background:#e47d3c25;color:#ff9a5c}.badge.success{background:#3c976525;color:#67cf91}.badge.danger{background:#b74b4225;color:#ef7770}.badge.muted{background:#8882;color:#aaa}.quick button,.modal-actions>button:not(.primary){background:transparent;color:var(--color-ink);border:1px solid var(--color-border);padding:9px 11px;border-radius:8px;font-weight:800}.empty{padding:55px;text-align:center;color:var(--color-ink-muted);display:grid;gap:7px}.alert,.toast{margin-bottom:14px;border-radius:10px;padding:13px 15px}.alert{display:grid;gap:4px;background:#b74b421b;border:1px solid #b74b4266}.toast{position:fixed;z-index:100;right:24px;top:80px;background:#29251f;color:#fff;border:1px solid #d8aa50;box-shadow:0 12px 35px #0008}.overlay{position:fixed;z-index:120;inset:0;background:#000b;display:flex;justify-content:flex-end}.modal{width:min(840px,95vw);height:100%;overflow:auto;background:var(--color-bg);padding:24px;box-sizing:border-box}.modal-head,.modal-actions{display:flex;justify-content:space-between;align-items:center}.modal-head h2{font-family:var(--font-serif);font-size:32px;margin:5px 0 18px}.close{border:0;background:transparent;color:var(--color-ink);font-size:30px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.field{display:grid;gap:6px}.field>span{font-size:11px;color:var(--color-ink-muted);font-weight:800}.field.wide{grid-column:1/-1}.inline{display:flex;gap:7px}.checks{display:flex;flex-wrap:wrap;gap:8px 18px;border:1px solid var(--color-border);border-radius:8px;padding:12px}.checks label{display:flex;align-items:center;gap:7px}.checks input{width:auto;min-height:auto}.modal-actions{margin-top:20px;border-top:1px solid var(--color-border);padding-top:18px}.modal-actions{justify-content:flex-end;gap:9px}@media(max-width:800px){.log-page{padding:18px 14px 90px}.log-head{align-items:flex-start;flex-direction:column}.log-head h1{font-size:38px}.kpis{grid-template-columns:1fr 1fr}.toolbar{grid-template-columns:1fr}.delivery{grid-template-columns:1fr}.form-grid{grid-template-columns:1fr}.field.wide{grid-column:auto}.quick{display:flex}.modal{width:100%}}
.sheet-overlay{justify-content:center;align-items:flex-start;padding:22px;overflow:auto}.delivery-sheet{width:min(920px,100%);background:#f8f5ef;color:#28231e!important;border-radius:4px;box-shadow:0 24px 80px #000b;padding:34px 38px;margin:auto}.delivery-sheet h2,.delivery-sheet strong,.delivery-sheet .sheet-brand{color:#28231e!important}.delivery-sheet .eyebrow{color:#c87835!important}.sheet-head{display:flex;justify-content:space-between;gap:25px;border-bottom:4px solid ${LARANJA};padding-bottom:20px}.sheet-brand{font-size:31px;letter-spacing:4px;font-weight:300}.sheet-head h2{font-family:var(--font-serif);font-size:34px;margin:10px 0 3px}.sheet-head p{color:#766d64!important;margin:0}.sheet-head-actions{display:flex;align-items:flex-start;gap:12px}.sheet-head .close{color:#28231e!important}.sheet-highlight{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:10px;margin:22px 0}.sheet-highlight>div,.sheet-info{border:1px solid #ddd5ca;background:#fff;border-radius:9px;padding:12px}.sheet-highlight small,.sheet-info small{display:block;color:#81766b!important;font-size:9px;letter-spacing:1.1px;text-transform:uppercase;font-weight:900;margin-bottom:5px}.sheet-highlight strong,.sheet-info strong{display:block;font-size:13px;line-height:1.45}.sheet-route{display:grid;grid-template-columns:1fr 35px 1fr;gap:8px;align-items:center;margin-bottom:10px}.sheet-route>b{text-align:center;color:${LARANJA};font-size:22px}.sheet-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.sheet-blocks{display:grid;gap:10px;margin-top:10px}.sheet-foot{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;border-top:1px solid #ddd5ca;margin-top:24px;padding-top:18px}.sheet-foot>div:first-child{display:grid;color:#81766b!important;font-size:10px;gap:3px}.sheet-buttons{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.sheet-buttons>button:not(.primary){border:1px solid #cfc5b8;background:#fff;color:#302a24;border-radius:8px;padding:11px 14px;font-weight:900}@media(max-width:800px){.sheet-overlay{padding:0}.delivery-sheet{min-height:100%;padding:22px 16px}.sheet-head{gap:8px}.sheet-head h2{font-size:27px}.sheet-brand{font-size:24px}.sheet-highlight,.sheet-grid{grid-template-columns:1fr}.sheet-route{grid-template-columns:1fr}.sheet-route>b{transform:rotate(90deg)}.sheet-foot{align-items:stretch;flex-direction:column}.sheet-buttons button{flex:1}.sheet-head-actions .badge{display:none}}
`
