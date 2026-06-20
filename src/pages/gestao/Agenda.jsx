import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const TIPOS = ['Apresentação','Assistência Técnica','Compromisso','Entrega','Medição','Montagem','Tarefa','Vistoria','Reunião Interna']
const MESES = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab']
const TIPO_COR = {
  'Montagem': '#3a7d4f', 'Entrega': '#3a5580', 'Medicao': '#9070c0', 'Medição': '#9070c0',
  'Assistência Técnica': '#d94a4a', 'Reunião Interna': '#b09a7a', 'Vistoria': '#2D7A4A',
  'Apresentacao': '#4a90d9', 'Compromisso': '#888', 'Tarefa': '#b09a7a',
}

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

function statusEvento(ev, hojeStr) {
  const status = ev.status || ev.situacao || ev.situacao_agenda
  if (status) {
    const n = norm(status)
    if (n.includes('conclu') || n.includes('realiz')) return { label: 'Realizada', tone: 'success' }
    if (n.includes('andamento')) return { label: 'Em andamento', tone: 'info' }
    if (n.includes('atras')) return { label: 'Atrasada', tone: 'danger' }
    return { label: status, tone: 'warn' }
  }
  if ((ev.data_fim || ev.data) < hojeStr) return { label: 'Realizada', tone: 'success' }
  if (ev.data === hojeStr) return { label: 'Hoje', tone: 'info' }
  return { label: 'Pendente', tone: 'warn' }
}

export default function Agenda() {
  const navigate = useNavigate()
  const [eventos, setEventos] = useState([])
  const [obras, setObras] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [filtro, setFiltro] = useState('proximos')
  const [acaoStatus, setAcaoStatus] = useState('')
  const [vistoriaStats, setVistoriaStats] = useState({ checklist: 0, fotos: 0 })
  const hoje = new Date()
  const [form, setForm] = useState({
    titulo: '', descricao: '', tipo: 'Compromisso', obra_id: '',
    responsavel_id: '', data: hoje.toISOString().split('T')[0],
    data_fim: '', hora_inicio: '08:00', hora_fim: '',
    reuniao_interna: false,
    status: 'pendente',
    visivel_montador: true,
    visivel_cliente: false,
  })

  useEffect(() => { carregar() }, [])

  function formInicial() {
    return {
      titulo: '', descricao: '', tipo: 'Compromisso', obra_id: '',
      responsavel_id: '', data: hoje.toISOString().split('T')[0],
      data_fim: '', hora_inicio: '08:00', hora_fim: '',
      reuniao_interna: false,
      status: 'pendente',
      visivel_montador: true,
      visivel_cliente: false,
    }
  }

  function abrirNovo() {
    setEditandoId(null)
    setForm(formInicial())
    setAcaoStatus('')
    setVistoriaStats({ checklist: 0, fotos: 0 })
    setModal(true)
  }

  function abrirEditar(ev) {
    setEditandoId(ev.id)
    setForm({
      titulo: ev.titulo || '',
      descricao: ev.descricao || '',
      tipo: ev.tipo || 'Compromisso',
      obra_id: ev.obra_id || '',
      responsavel_id: ev.responsavel_id || '',
      data: ev.data || hoje.toISOString().split('T')[0],
      data_fim: ev.data_fim || ev.data || '',
      hora_inicio: ev.hora_inicio ? ev.hora_inicio.slice(0, 5) : '08:00',
      hora_fim: ev.hora_fim ? ev.hora_fim.slice(0, 5) : '',
      reuniao_interna: Boolean(ev.reuniao_interna),
      status: ev.status || 'pendente',
      visivel_montador: ev.visivel_montador !== false,
      visivel_cliente: Boolean(ev.visivel_cliente),
    })
    setAcaoStatus('')
    carregarVistoriaStats(ev.id)
    setModal(true)
  }

  async function carregarVistoriaStats(agendaId = editandoId) {
    if (!agendaId) {
      setVistoriaStats({ checklist: 0, fotos: 0 })
      return
    }
    const [{ count: checklistCount }, { count: fotosCount }] = await Promise.all([
      supabase.from('checklist_items').select('id', { count: 'exact', head: true }).eq('agenda_id', agendaId),
      supabase.from('fotos').select('id', { count: 'exact', head: true }).eq('agenda_id', agendaId),
    ])
    setVistoriaStats({ checklist: checklistCount || 0, fotos: fotosCount || 0 })
  }

  async function carregar() {
    const [{ data: ev }, { data: ob }, { data: pr }] = await Promise.all([
      supabase.from('agenda').select('*, obras(nome), responsavel:profiles!agenda_responsavel_id_fkey(full_name)').order('data').order('hora_inicio'),
      supabase.from('obras').select('id, nome').order('nome'),
      supabase.from('profiles').select('id, full_name, role').order('full_name'),
    ])
    setEventos(ev || [])
    setObras(ob || [])
    setProfiles(pr || [])
    setLoading(false)
  }

  async function salvar() {
    if (!form.titulo.trim()) return
    setSalvando(true)

    const payload = {
      titulo: form.titulo,
      descricao: form.descricao || null,
      tipo: form.tipo,
      obra_id: form.reuniao_interna ? null : (form.obra_id || null),
      responsavel_id: form.responsavel_id || null,
      data: form.data,
      data_fim: form.data_fim || form.data,
      hora_inicio: form.hora_inicio,
      hora_fim: form.hora_fim || null,
      reuniao_interna: form.reuniao_interna,
      status: form.status || 'pendente',
      visivel_montador: Boolean(form.visivel_montador),
      visivel_cliente: Boolean(form.visivel_cliente),
    }

    if (editandoId) await supabase.from('agenda').update(payload).eq('id', editandoId)
    else await supabase.from('agenda').insert([payload])

    setForm(formInicial())
    setEditandoId(null)
    setAcaoStatus('')
    setVistoriaStats({ checklist: 0, fotos: 0 })
    setModal(false)
    await carregar()
    setSalvando(false)
  }

  async function excluir(id) {
    if (!window.confirm('Excluir este evento?')) return
    await supabase.from('agenda').delete().eq('id', id)
    if (editandoId === id) {
      setModal(false)
      setEditandoId(null)
    }
    await carregar()
  }

  async function atualizarStatusCompromisso(status) {
    if (!editandoId) return
    setAcaoStatus('Atualizando status...')
    const { error } = await supabase.from('agenda').update({ status }).eq('id', editandoId)
    if (error) {
      setAcaoStatus('Não foi possível atualizar o status.')
      return
    }
    setForm(p => ({ ...p, status }))
    setAcaoStatus('Status atualizado.')
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

    await supabase.from('agenda').update({
      checklist_gerado: true,
      checklist_gerado_em: new Date().toISOString(),
      status: form.status === 'pendente' ? 'em andamento' : form.status,
    }).eq('id', editandoId)

    setForm(p => ({ ...p, status: p.status === 'pendente' ? 'em andamento' : p.status }))
    setAcaoStatus('Checklist de vistoria gerado.')
    await carregarVistoriaStats(editandoId)
    await carregar()
  }

  const hoje_str = hoje.toISOString().split('T')[0]
  const proximos = eventos.filter(e => (e.data_fim || e.data) >= hoje_str)
  const passados = eventos.filter(e => (e.data_fim || e.data) < hoje_str)
  const hojeEventos = eventos.filter(e => e.data === hoje_str)
  const lista = filtro === 'proximos' ? proximos : passados
  const kpis = [
    { label: 'Montagens', value: eventos.filter(e => norm(e.tipo || e.titulo).includes('montagem')).length },
    { label: 'Assistências', value: eventos.filter(e => norm(e.tipo || e.titulo).includes('assist')).length },
    { label: 'Entregas', value: eventos.filter(e => norm(e.tipo || e.titulo).includes('entrega')).length },
    { label: 'Vistorias', value: eventos.filter(e => norm(e.tipo || e.titulo).includes('vistoria') || norm(e.tipo || e.titulo).includes('medicao')).length },
  ]

  return (
    <div className="ow-page" style={s.page}>
      <style>{css}</style>

      {modal && (
        <div style={s.modalBg} onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>{editandoId ? 'Detalhe do compromisso' : 'Novo Evento'}</h2>
              <button style={s.btnClose} onClick={() => setModal(false)}>X</button>
            </div>
            <div style={s.modalBody}>
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
                  <Sel value={form.obra_id} onChange={v => setForm(p => ({ ...p, obra_id: v }))} disabled={form.reuniao_interna}>
                    <option value="">Sem obra vinculada</option>
                    {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </Sel>
                </div>
                <div style={s.full}>
                  <L>Descrição</L>
                  <textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} rows={2} placeholder="Detalhes do evento..." style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="ri" checked={form.reuniao_interna} onChange={e => setForm(p => ({ ...p, reuniao_interna: e.target.checked, obra_id: '' }))} />
                  <label htmlFor="ri" style={{ fontSize: 13, color: 'var(--color-ink-muted)', cursor: 'pointer' }}>Reunião Interna</label>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--color-ink-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.visivel_montador} onChange={e => setForm(p => ({ ...p, visivel_montador: e.target.checked }))} />
                  Visível para montador
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--color-ink-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.visivel_cliente} onChange={e => setForm(p => ({ ...p, visivel_cliente: e.target.checked }))} />
                  Visível para cliente
                </label>
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
                    {form.obra_id && <button type="button" style={s.vistoriaButton} onClick={() => navigate('/obras/' + form.obra_id)}>Abrir obra</button>}
                  </div>
                  {acaoStatus && <div style={s.vistoriaMessage}>{acaoStatus}</div>}
                </div>
              )}
            </div>
            <div style={s.modalFooter}>
          {editandoId && form.obra_id && (
            <button style={s.btnCancel} onClick={() => navigate('/obras/' + form.obra_id)}>Abrir obra</button>
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
            background: filtro === f.id ? 'var(--color-ink)' : '#fff',
            color: filtro === f.id ? '#f9f7f4' : 'var(--color-ink-muted)',
            border: filtro === f.id ? 'none' : '1px solid var(--color-border)',
          }}>
            {f.label}
          </button>
        ))}
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
            const cor = TIPO_COR[ev.tipo] || '#888'
            const isHoje = ev.data === hoje_str
            const status = statusEvento(ev, hoje_str)
            return (
              <div key={ev.id} className="ag-card" onClick={() => abrirEditar(ev)} style={{ ...s.card, borderLeft: '4px solid ' + cor, opacity: filtro === 'passados' ? 0.7 : 1, cursor: 'pointer' }}>
                <div className="ag-datebox" style={{ ...s.datebox, borderColor: isHoje ? cor : 'var(--color-border)', background: isHoje ? cor + '10' : '#fafaf8' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: isHoje ? cor : 'var(--color-ink)', fontFamily: 'var(--font-serif)', lineHeight: 1 }}>{d.getDate()}</div>
                  <div style={{ fontSize: 9, color: cor, letterSpacing: 1, fontWeight: 600 }}>{MESES[d.getMonth()].slice(0, 3).toUpperCase()}</div>
                  <div style={{ fontSize: 9, color: 'var(--color-ink-muted)' }}>{DIAS[d.getDay()]}</div>
                </div>
                <div style={s.cardBody}>
                  <div style={s.cardTop}>
                    <span style={s.cardTitulo}>{ev.titulo}</span>
                    <span className={`ag-status tone-${status.tone}`}>{status.label}</span>
                    <span style={{ ...s.tipoBadge, background: cor + '18', color: cor }}>{ev.tipo}</span>
                    {ev.reuniao_interna && <span style={{ ...s.tipoBadge, background: '#eef2f8', color: '#3a5580' }}>Reunião Interna</span>}
                    {isHoje && <span style={{ ...s.tipoBadge, background: '#edf7f0', color: '#3a7d4f' }}>Hoje</span>}
                  </div>
                  {ev.descricao && <div className="ag-card-desc" style={s.cardDesc}>{ev.descricao}</div>}
                  <div className="ag-card-meta" style={s.cardMeta}>
                    {ev.hora_inicio && <span>{ev.hora_inicio.slice(0, 5)}{ev.hora_fim ? ' - ' + ev.hora_fim.slice(0, 5) : ''}</span>}
                    {ev.obras?.nome && <span>Obra: {ev.obras.nome}</span>}
                    {ev.responsavel?.full_name && <span>{ev.responsavel.full_name}</span>}
                    {ev.data_fim && ev.data_fim !== ev.data && <span>Até {new Date(ev.data_fim + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); excluir(ev.id) }} style={s.btnExcluir}>X</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function L({ children }) { return <div style={{ fontSize: 11, color: '#888', marginBottom: 5, fontWeight: 500 }}>{children}</div> }
function I({ onChange, ...props }) { return <input {...props} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }} /> }
function Sel({ onChange, children, ...props }) { return <select {...props} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }}>{children}</select> }

const css = `
.ag-mobile-home{display:none}
.ag-status{border-radius:999px;padding:3px 8px;font-size:10px;font-weight:900;line-height:1;white-space:nowrap}
.ag-status.tone-success{background:#EAF5EE;color:#2D7A4A}
.ag-status.tone-info{background:#EEF5FB;color:#1E5A8A}
.ag-status.tone-warn{background:#FFF4E5;color:#9A6A22}
.ag-status.tone-danger{background:#FFF1F1;color:#B84040}
.ag-vistoria-placeholder{display:none}
@media (max-width:760px){
  .ag-header{display:grid !important;grid-template-columns:1fr auto;gap:10px;align-items:end !important;margin-bottom:13px !important}
  .ag-header h1{font-size:27px !important;line-height:1 !important}
  .ag-header p{display:none !important}
  .ag-new{padding:9px 12px !important;border-radius:12px !important;font-size:12px !important}
  .ag-kpis{display:flex !important;gap:8px !important;overflow-x:auto !important;margin-bottom:12px !important;padding-bottom:4px !important}
  .ag-kpis>div{flex:0 0 auto !important;min-width:auto !important;display:flex !important;align-items:center !important;gap:7px !important;border-radius:999px !important;padding:7px 10px !important;border-top:1px solid rgba(184,150,94,.22) !important;box-shadow:0 8px 20px rgba(29,28,25,.045) !important}
  .ag-kpis span{font-size:10.5px !important;line-height:1 !important;letter-spacing:0 !important;white-space:nowrap !important;margin:0 !important;color:var(--color-ink-muted) !important}
  .ag-kpis strong{font-size:15px !important;line-height:1 !important}
  .ag-mobile-home{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 12px}
  .ag-mobile-home button{border:1px solid var(--color-border);background:#fff;border-radius:15px;padding:11px 9px;text-align:left;font-family:inherit;box-shadow:0 10px 26px rgba(29,28,25,.04)}
  .ag-mobile-home button.muted{background:#FFFEFC}
  .ag-mobile-home strong{display:block;font-size:23px;line-height:1;color:var(--color-ink)}
  .ag-mobile-home span{display:block;font-size:10.5px;color:var(--color-ink-muted);font-weight:900;margin-top:5px}
  .ag-filters{margin-bottom:12px !important}
  .ag-filters button{padding:8px 13px !important}
  .ag-card{padding:12px 13px !important;gap:12px !important;border-radius:16px !important;align-items:flex-start !important;margin-bottom:9px !important}
  .ag-datebox{min-width:48px !important;padding:7px 0 !important}
  .ag-card-desc{display:none !important}
  .ag-card-meta{font-size:11.5px !important;gap:8px !important;line-height:1.35 !important;color:var(--color-ink-muted) !important}
  .ag-card-meta span:nth-child(n+3){display:none !important}
  .ag-card button:last-child{display:none !important}
}
`

const s = {
  page: { padding: '32px 40px', maxWidth: 900, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  breadcrumb: { fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 6 },
  title: { fontFamily: 'var(--font-serif)', fontSize: 36, fontWeight: 500, color: 'var(--color-ink)', margin: 0 },
  sub: { fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 4 },
  btnNew: { background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 20 },
  kpi: { background: '#fff', border: '1px solid var(--color-border)', borderTop: '3px solid var(--color-gold)', borderRadius: 14, padding: '15px 16px', boxShadow: 'var(--shadow)' },
  kpiLabel: { display: 'block', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--color-gold)', fontWeight: 800, marginBottom: 8 },
  kpiValue: { display: 'block', fontSize: 30, lineHeight: 1, color: 'var(--color-ink)' },
  filtros: { display: 'flex', gap: 8, marginBottom: 20 },
  filtroBtn: { padding: '7px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  card: { display: 'flex', gap: 16, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, padding: '14px 18px', marginBottom: 10, alignItems: 'flex-start', boxShadow: 'var(--shadow)' },
  datebox: { minWidth: 52, textAlign: 'center', border: '1px solid', borderRadius: 8, padding: '8px 0', flexShrink: 0 },
  cardBody: { flex: 1, minWidth: 0 },
  cardTop: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  cardTitulo: { fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' },
  tipoBadge: { fontSize: 10, padding: '2px 9px', borderRadius: 20, fontWeight: 500 },
  cardDesc: { fontSize: 12.5, color: 'var(--color-ink-muted)', marginBottom: 6 },
  cardMeta: { display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: '#aaa' },
  btnExcluir: { background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 14, padding: '4px 8px', flexShrink: 0, alignSelf: 'flex-start' },
  empty: { textAlign: 'center', padding: '40px 0', color: '#bbb' },
  emptyBox: { textAlign: 'center', padding: '60px 20px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#aaa', marginBottom: 20 },
  modalBg: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: '#fff', borderRadius: 14, width: '100%', maxWidth: 580, maxHeight: '90vh', display: 'flex', flexDirection: 'column' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 28px 0', flexShrink: 0 },
  modalTitle: { fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 500, margin: 0 },
  btnClose: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999' },
  modalBody: { overflowY: 'auto', padding: '20px 28px', flex: 1 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 28px', borderTop: '1px solid #f0ece6', flexShrink: 0 },
  btnCancel: { background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', color: '#888' },
  btnSave: { background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  full: { gridColumn: '1/-1' },
  vistoriaBox: { marginTop: 18, border: '1px solid #E4D7C0', background: '#FFFCF7', borderRadius: 14, padding: 16 },
  vistoriaHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  vistoriaEyebrow: { fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--color-gold)', fontWeight: 900, marginBottom: 5 },
  vistoriaTitle: { display: 'block', fontSize: 15, color: 'var(--color-ink)' },
  vistoriaStatus: { borderRadius: 999, background: '#EAF5EE', color: '#2D7A4A', padding: '6px 10px', fontSize: 11, fontWeight: 900, textTransform: 'capitalize', whiteSpace: 'nowrap' },
  vistoriaStats: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 },
  vistoriaStat: { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: '12px 13px' },
  vistoriaStatValue: { display: 'block', fontSize: 24, lineHeight: 1, color: 'var(--color-ink)', marginBottom: 5 },
  vistoriaStatLabel: { display: 'block', fontSize: 11, color: 'var(--color-ink-muted)', fontWeight: 800 },
  vistoriaActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  vistoriaPrimary: { background: 'var(--color-ink)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 12px', fontSize: 12, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit' },
  vistoriaButton: { background: '#fff', color: 'var(--color-ink)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '9px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  vistoriaMessage: { marginTop: 12, borderRadius: 10, background: '#fff', border: '1px solid var(--color-border)', padding: '9px 11px', fontSize: 12, color: 'var(--color-ink-muted)', fontWeight: 700 },
}
