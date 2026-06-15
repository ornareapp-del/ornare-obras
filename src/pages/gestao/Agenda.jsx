import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const TIPOS = ['Apresentação','Assistência Técnica','Compromisso','Entrega','Medição','Montagem','Tarefa','Reunião Interna']
const MESES = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab']
const TIPO_COR = {
  'Montagem': '#3a7d4f', 'Entrega': '#3a5580', 'Medicao': '#9070c0', 'Medição': '#9070c0',
  'Assistência Técnica': '#d94a4a', 'Reunião Interna': '#b09a7a',
  'Apresentacao': '#4a90d9', 'Compromisso': '#888', 'Tarefa': '#b09a7a',
}

function norm(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export default function Agenda() {
  const [eventos, setEventos] = useState([])
  const [obras, setObras] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [filtro, setFiltro] = useState('proximos')
  const hoje = new Date()
  const [form, setForm] = useState({
    titulo: '', descricao: '', tipo: 'Compromisso', obra_id: '',
    responsavel_id: '', data: hoje.toISOString().split('T')[0],
    data_fim: '', hora_inicio: '08:00', hora_fim: '',
    reuniao_interna: false,
  })

  useEffect(() => { carregar() }, [])

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
    await supabase.from('agenda').insert([{
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
    }])
    setForm({
      titulo: '', descricao: '', tipo: 'Compromisso', obra_id: '',
      responsavel_id: '', data: hoje.toISOString().split('T')[0],
      data_fim: '', hora_inicio: '08:00', hora_fim: '', reuniao_interna: false,
    })
    setModal(false)
    await carregar()
    setSalvando(false)
  }

  async function excluir(id) {
    if (!window.confirm('Excluir este evento?')) return
    await supabase.from('agenda').delete().eq('id', id)
    await carregar()
  }

  const hoje_str = hoje.toISOString().split('T')[0]
  const proximos = eventos.filter(e => (e.data_fim || e.data) >= hoje_str)
  const passados = eventos.filter(e => (e.data_fim || e.data) < hoje_str)
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
              <h2 style={s.modalTitle}>Novo Evento</h2>
              <button style={s.btnClose} onClick={() => setModal(false)}>X</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div style={s.full}>
                  <L>Titulo *</L>
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
                    <option value="">Sem responsavel</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </Sel>
                </div>
                <div>
                  <L>Data inicio *</L>
                  <I type="date" value={form.data} onChange={v => setForm(p => ({ ...p, data: v }))} />
                </div>
                <div>
                  <L>Data fim</L>
                  <I type="date" value={form.data_fim} onChange={v => setForm(p => ({ ...p, data_fim: v }))} />
                </div>
                <div>
                  <L>Hora inicio</L>
                  <I type="time" value={form.hora_inicio} onChange={v => setForm(p => ({ ...p, hora_inicio: v }))} />
                </div>
                <div>
                  <L>Hora fim</L>
                  <I type="time" value={form.hora_fim} onChange={v => setForm(p => ({ ...p, hora_fim: v }))} />
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
              </div>
            </div>
            <div style={s.modalFooter}>
              <button style={s.btnCancel} onClick={() => setModal(false)}>Cancelar</button>
              <button style={s.btnSave} onClick={salvar} disabled={salvando || !form.titulo.trim()}>
                {salvando ? 'Salvando...' : 'Criar Evento'}
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
        <button className="ag-new" style={s.btnNew} onClick={() => setModal(true)}>+ Novo Evento</button>
      </div>

      <div className="ag-kpis" style={s.kpiGrid}>
        {kpis.map(k => (
          <div key={k.label} style={s.kpi}>
            <span style={s.kpiLabel}>{k.label}</span>
            <strong style={s.kpiValue}>{loading ? '-' : k.value}</strong>
          </div>
        ))}
      </div>

      <div style={s.filtros}>
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
            <button style={s.btnNew} onClick={() => setModal(true)}>+ Criar Primeiro Evento</button>
          )}
        </div>
      ) : (
        <div>
          {lista.map(ev => {
            const d = new Date(ev.data + 'T00:00:00')
            const cor = TIPO_COR[ev.tipo] || '#888'
            const isHoje = ev.data === hoje_str
            return (
              <div key={ev.id} className="ag-card" style={{ ...s.card, borderLeft: '4px solid ' + cor, opacity: filtro === 'passados' ? 0.7 : 1 }}>
                <div className="ag-datebox" style={{ ...s.datebox, borderColor: isHoje ? cor : 'var(--color-border)', background: isHoje ? cor + '10' : '#fafaf8' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: isHoje ? cor : 'var(--color-ink)', fontFamily: 'var(--font-serif)', lineHeight: 1 }}>{d.getDate()}</div>
                  <div style={{ fontSize: 9, color: cor, letterSpacing: 1, fontWeight: 600 }}>{MESES[d.getMonth()].slice(0, 3).toUpperCase()}</div>
                  <div style={{ fontSize: 9, color: 'var(--color-ink-muted)' }}>{DIAS[d.getDay()]}</div>
                </div>
                <div style={s.cardBody}>
                  <div style={s.cardTop}>
                    <span style={s.cardTitulo}>{ev.titulo}</span>
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
                <button onClick={() => excluir(ev.id)} style={s.btnExcluir}>X</button>
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
@media (max-width:760px){
  .ag-header{display:grid !important;grid-template-columns:1fr auto;gap:10px;align-items:end !important;margin-bottom:13px !important}
  .ag-header h1{font-size:27px !important;line-height:1 !important}
  .ag-header p{display:none !important}
  .ag-new{padding:9px 12px !important;border-radius:12px !important;font-size:12px !important}
  .ag-kpis{display:flex !important;gap:8px !important;overflow-x:auto !important;margin-bottom:12px !important;padding-bottom:4px !important}
  .ag-kpis>div{flex:0 0 auto !important;min-width:auto !important;display:flex !important;align-items:center !important;gap:7px !important;border-radius:999px !important;padding:7px 10px !important;border-top:1px solid rgba(184,150,94,.22) !important;box-shadow:0 8px 20px rgba(29,28,25,.045) !important}
  .ag-kpis span{font-size:10.5px !important;line-height:1 !important;letter-spacing:0 !important;white-space:nowrap !important;margin:0 !important;color:var(--color-ink-muted) !important}
  .ag-kpis strong{font-size:15px !important;line-height:1 !important}
  .ag-card{padding:12px 13px !important;gap:12px !important;border-radius:16px !important;align-items:flex-start !important;margin-bottom:9px !important}
  .ag-datebox{min-width:48px !important;padding:7px 0 !important}
  .ag-card-desc{display:none !important}
  .ag-card-meta{font-size:11.5px !important;gap:8px !important;line-height:1.35 !important;color:var(--color-ink-muted) !important}
  .ag-card-meta span:nth-child(n+3){display:none !important}
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
}
