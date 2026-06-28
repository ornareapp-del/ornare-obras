import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { theme } from '../../constants/theme'

const GRAVIDADES = [
  { value: 'baixa', label: 'Baixa', cor: '#5aab6e', bg: '#edf7f0' },
  { value: 'media', label: 'Média', cor: '#b09a7a', bg: '#fdf3e3' },
  { value: 'alta', label: 'Alta', cor: '#d94a4a', bg: '#fdecea' },
]
const TIPOS = ['Material faltante','Retrabalho','Problema técnico','Acesso bloqueado','Atraso','Outro']
const STATUS_OC = ['Aberta','Em andamento','Resolvida']
const GRAV = Object.fromEntries(GRAVIDADES.map(g => [g.value, g]))
const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function Modal({ obras, profiles, onClose, onSaved }) {
  const { profile } = useStore()
  const [form, setForm] = useState({
    titulo: '', tipo: 'Material faltante', descricao: '',
    gravidade: 'media', obra_id: '', responsavel_id: '',
    prazo: '', status: 'Aberta'
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function salvar() {
    if (!form.titulo) { setErro('Preencha o título.'); return }
    setSaving(true)
    const { error } = await supabase.from('ocorrencias').insert({
      titulo: form.titulo,
      tipo: form.tipo,
      descricao: form.descricao || null,
      gravidade: form.gravidade,
      obra_id: form.obra_id || null,
      responsavel_id: form.responsavel_id || null,
      prazo: form.prazo || null,
      status: form.status,
      criado_por: profile?.id,
    })
    if (error) { setErro(error.message); setSaving(false); return }
    onSaved()
  }

  return (
    <div style={ms.bg} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={ms.box}>
        <div style={ms.header}>
          <h2 style={ms.title}>Nova Ocorrência</h2>
          <button style={ms.close} onClick={onClose}>✕</button>
        </div>
        <div style={ms.body}>
          {erro && <div style={ms.erro}>{erro}</div>}
          <div style={ms.grid}>
            <div style={ms.full}>
              <label style={ms.label}>Título *</label>
              <input style={ms.input} value={form.titulo}
                onChange={e => set('titulo', e.target.value)}
                placeholder="Descreva resumidamente..." />
            </div>
            <div>
              <label style={ms.label}>Tipo</label>
              <select style={ms.input} value={form.tipo}
                onChange={e => set('tipo', e.target.value)}>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={ms.label}>Gravidade</label>
              <select style={ms.input} value={form.gravidade}
                onChange={e => set('gravidade', e.target.value)}>
                {GRAVIDADES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label style={ms.label}>Obra</label>
              <select style={ms.input} value={form.obra_id}
                onChange={e => set('obra_id', e.target.value)}>
                <option value="">— Selecione —</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={ms.label}>Responsável</label>
              <select style={ms.input} value={form.responsavel_id}
                onChange={e => set('responsavel_id', e.target.value)}>
                <option value="">— Selecione —</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
            <div>
              <label style={ms.label}>Prazo</label>
              <input style={ms.input} type="date" value={form.prazo}
                onChange={e => set('prazo', e.target.value)} />
            </div>
            <div>
              <label style={ms.label}>Status</label>
              <select style={ms.input} value={form.status}
                onChange={e => set('status', e.target.value)}>
                {STATUS_OC.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={ms.full}>
              <label style={ms.label}>Descrição detalhada</label>
              <textarea style={{ ...ms.input, height: 80, resize: 'vertical' }}
                value={form.descricao}
                onChange={e => set('descricao', e.target.value)}
                placeholder="Detalhe o problema encontrado..." />
            </div>
          </div>
        </div>
        <div style={ms.footer}>
          <button style={ms.btnCancel} onClick={onClose}>Cancelar</button>
          <button style={ms.btnSave} onClick={salvar} disabled={saving}>
            {saving ? 'Salvando...' : 'Registrar Ocorrência'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Ocorrencias() {
  const navigate = useNavigate()
  const [ocorrencias, setOcorrencias] = useState([])
  const [obras, setObras] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroGrav, setFiltroGrav] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [modal, setModal] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const [{ data: oc }, { data: ob }, { data: pr }] = await Promise.all([
      supabase.from('ocorrencias')
        .select('*, obras(nome), responsavel:profiles!ocorrencias_responsavel_id_fkey(full_name)')
        .order('created_at', { ascending: false }),
      supabase.from('obras').select('id, nome').order('nome'),
      supabase.from('profiles').select('id, full_name').in('role', ['gestao','supervisor','montador']),
    ])
    setOcorrencias(oc || [])
    setObras(ob || [])
    setProfiles(pr || [])
    setLoading(false)
  }

  async function atualizarStatus(id, status) {
    await supabase.from('ocorrencias').update({ status }).eq('id', id)
    carregar()
  }

  const lista = ocorrencias
    .filter(o => !filtroGrav || o.gravidade === filtroGrav)
    .filter(o => !filtroStatus || o.status === filtroStatus)
  const kpis = [
    { label: 'Críticas', value: ocorrencias.filter(o => ['alta', 'critica'].includes(norm(o.gravidade))).length, color: '#B84040' },
    { label: 'Em andamento', value: ocorrencias.filter(o => norm(o.status).includes('andamento')).length, color: '#365C7D' },
    { label: 'Resolvidas', value: ocorrencias.filter(o => norm(o.status).includes('resolvida')).length, color: '#2D7A4A' },
    { label: 'Não conformidades', value: ocorrencias.filter(o => norm(o.tipo).includes('conformidade') || norm(o.titulo).includes('conformidade')).length, color: '#9A6A22' },
  ]

  return (
    <div className="ow-page" style={s.page}>
      <style>{css}</style>
      {modal && (
        <Modal obras={obras} profiles={profiles}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); carregar() }} />
      )}

      <div className="oc-header" style={s.header}>
        <div>
          <div style={s.breadcrumb}>Gestão</div>
          <h1 style={s.title}>Central de Ocorrências</h1>
          <p style={s.sub}>Pendências, problemas de obra e não conformidades operacionais</p>
        </div>
        <button style={s.btnNew} onClick={() => setModal(true)}>
          + Nova Ocorrência
        </button>
      </div>

      <div className="oc-mobile-summary" aria-label="Resumo de ocorrências">
        <button type="button" onClick={() => { setFiltroGrav('alta'); setFiltroStatus('') }}>
          <strong>{loading ? '-' : kpis[0].value}</strong>
          <span>críticas</span>
        </button>
        <button type="button" onClick={() => { setFiltroStatus('Aberta'); setFiltroGrav('') }}>
          <strong>{loading ? '-' : ocorrencias.filter(o => norm(o.status).includes('aberta')).length}</strong>
          <span>abertas</span>
        </button>
        <button type="button" onClick={() => { setFiltroStatus('Em andamento'); setFiltroGrav('') }}>
          <strong>{loading ? '-' : kpis[1].value}</strong>
          <span>andamento</span>
        </button>
      </div>

      <div className="oc-stats" style={s.statsGrid}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...s.stat, borderTop: '3px solid ' + k.color }}>
            <div style={{ ...s.statLabel, color: k.color }}>{k.label}</div>
            <div style={{ ...s.statValue, color: k.color }}>{loading ? '-' : k.value}</div>
          </div>
        ))}
      </div>

      <div className="oc-filters" style={s.filters}>
        <select style={s.select} value={filtroGrav}
          onChange={e => setFiltroGrav(e.target.value)}>
          <option value="">Todas as gravidades</option>
          {GRAVIDADES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
        <select style={s.select} value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {STATUS_OC.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={s.empty}>Carregando...</div>
      ) : lista.length === 0 ? (
        <div style={s.emptyBox}>
          <div style={s.emptyIcon}>⚠️</div>
          <div style={s.emptyTitle}>Nenhuma ocorrência registrada</div>
          <div style={s.emptySub}>Registre problemas, pendências e retrabalhos das obras</div>
          <button style={s.btnNew} onClick={() => setModal(true)}>+ Registrar Ocorrência</button>
        </div>
      ) : (
        <div className="oc-list" style={s.list}>
          {lista.map(oc => (
            <div
              key={oc.id}
              className="oc-card"
              style={{ ...s.item, borderLeftColor: GRAV[oc.gravidade]?.cor || '#ccc' }}
              onClick={() => oc.obra_id && navigate(`/obras/${oc.obra_id}`)}
            >
              <div style={s.itemTop}>
                <div style={s.itemTitle}>{oc.titulo}</div>
                <div style={s.itemBadges}>
                  {oc.status && (
                    <select
                      value={oc.status}
                      onChange={e => { e.stopPropagation(); atualizarStatus(oc.id, e.target.value) }}
                      onClick={e => e.stopPropagation()}
                      style={{
                        ...s.statusSelect,
                        background: oc.status === 'Resolvida' ? '#edf7f0' : oc.status === 'Em andamento' ? '#fdf3e3' : '#fdecea',
                        color: oc.status === 'Resolvida' ? '#3a7d4f' : oc.status === 'Em andamento' ? '#a0692a' : '#a03030',
                      }}>
                      {STATUS_OC.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                  )}
                  <span style={{ ...s.badge, background: GRAV[oc.gravidade]?.bg, color: GRAV[oc.gravidade]?.cor }}>
                    {GRAV[oc.gravidade]?.label || oc.gravidade}
                  </span>
                </div>
              </div>
              {oc.descricao && <p style={s.itemDesc}>{oc.descricao}</p>}
              <div style={s.itemMeta}>
                {oc.tipo && <span>{oc.tipo}</span>}
                {oc.obras?.nome && <span>Obra: {oc.obras.nome}</span>}
                {oc.responsavel?.full_name && <span>Responsável: {oc.responsavel.full_name}</span>}
                {oc.prazo && <span>Prazo: {new Date(oc.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                <span>{new Date(oc.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              {oc.obra_id && (
                <button style={s.btnObra} onClick={e => { e.stopPropagation(); navigate(`/obras/${oc.obra_id}`) }}>
                  Ver obra →
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const css = `
.oc-mobile-summary{display:none}
@media (max-width:760px){
  .ow-page{padding-bottom:112px !important}
  .oc-header{display:grid !important;grid-template-columns:1fr;gap:10px;margin-bottom:14px !important}
  .oc-header h1{font-size:27px !important;line-height:1.02 !important}
  .oc-header p{font-size:12px !important;line-height:1.35 !important;max-width:29ch}
  .oc-header button{width:100% !important;border-radius:14px !important;padding:11px 14px !important}
  .oc-mobile-summary{display:grid !important;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 10px}
  .oc-mobile-summary button{appearance:none;border:1px solid ${theme.border};background:${theme.surface};border-radius:16px;padding:10px 8px;text-align:left;box-shadow:0 10px 24px rgba(0,0,0,.16);font-family:inherit}
  .oc-mobile-summary strong{display:block;font-size:22px;line-height:1;color:var(--color-ink)}
  .oc-mobile-summary span{display:block;margin-top:5px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.55px;color:var(--color-ink-muted);white-space:nowrap}
  .oc-stats{display:none !important}
  .oc-filters{display:grid !important;grid-template-columns:1fr 1fr;gap:8px !important;margin-bottom:12px !important}
  .oc-filters select{width:100% !important;min-width:0 !important;border-radius:14px !important;padding:10px 9px !important;font-size:12px !important}
  .oc-list{gap:10px !important}
  .oc-card{border-radius:18px !important;padding:14px !important;box-shadow:0 14px 34px rgba(29,28,25,.052) !important;cursor:pointer}
  .oc-card [style*="justify-content: space-between"]{display:grid !important;grid-template-columns:1fr;gap:8px !important}
  .oc-card [style*="font-size: 14"]{font-size:14.5px !important;line-height:1.2 !important}
  .oc-card select{max-width:145px !important}
  .oc-card p{font-size:12px !important;line-height:1.4 !important;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .oc-card div[style*="flex-wrap: wrap"]{gap:5px 8px !important;font-size:10.5px !important;color:var(--color-ink-muted) !important}
  .oc-card button{display:none !important}
}
`

const s = {
  page: { padding: '32px 40px', maxWidth: 1000, margin: '0 auto', background: theme.background, color: theme.textPrimary, fontFamily: 'Inter, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  breadcrumb: { fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 6 },
  title: { fontFamily: 'var(--font-serif)', fontSize: 36, fontWeight: 500, color: 'var(--color-ink)', margin: 0 },
  sub: { fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 4 },
  btnNew: { background: theme.gold, color: theme.background, border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 14, marginBottom: 24 },
  stat: { border: `1px solid ${theme.border}`, background: theme.surface, borderRadius: 12, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  statLabel: { fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  statValue: { fontSize: 28, fontWeight: 700 },
  filters: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  select: { background: theme.inputBackground, border: '1px solid ' + theme.inputBorder, color: theme.inputText, borderRadius: 8, padding: '10px 14px', width: '100%', fontSize: 14, outline: 'none', fontFamily: 'inherit' },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  item: { background: theme.surface, border: `1px solid ${theme.border}`, borderLeft: '4px solid', borderRadius: 12, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  itemTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 },
  itemTitle: { fontSize: 14, fontWeight: 600, color: 'var(--color-ink)', flex: 1 },
  itemBadges: { display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 },
  itemDesc: { margin: '4px 0 8px', fontSize: 13, color: 'var(--color-ink-muted)', lineHeight: 1.5 },
  itemMeta: { display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: '#aaa', marginTop: 6 },
  badge: { fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500 },
  statusSelect: { fontSize: 11, padding: '3px 8px', borderRadius: 20, border: 'none', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  btnObra: { marginTop: 10, background: 'none', border: 'none', color: 'var(--color-blue)', fontSize: 12, cursor: 'pointer', padding: 0 },
  empty: { textAlign: 'center', padding: '40px 0', color: '#bbb' },
  emptyBox: { textAlign: 'center', padding: '60px 20px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#aaa', marginBottom: 20 },
}

const ms = {
  bg: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  box: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 28px 0', flexShrink: 0 },
  title: { fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 500, margin: 0 },
  close: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999' },
  body: { overflowY: 'auto', padding: '20px 28px', flex: 1 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  full: { gridColumn: '1/-1' },
  label: { display: 'block', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: '#888', marginBottom: 6 },
  input: { background: theme.inputBackground, border: '1px solid ' + theme.inputBorder, color: theme.inputText, borderRadius: 8, padding: '10px 14px', width: '100%', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  erro: { background: '#fceee9', borderLeft: '3px solid #c4421e', color: '#5c2010', padding: '10px 14px', borderRadius: 6, fontSize: 12, marginBottom: 16 },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 28px', borderTop: '1px solid #f0ece6', flexShrink: 0 },
  btnCancel: { background: 'none', border: '1px solid #e0dbd4', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', color: '#888' },
  btnSave: { background: theme.gold, color: theme.background, border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
}
