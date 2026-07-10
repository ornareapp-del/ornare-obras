import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { obraColor } from '../../utils/obraColor'
import { mapearCronogramasPorObra, resolverOperacaoObra } from '../../utils/obraOperacional'
import { progressBarStyle, progressFillStyle, statusBadgeBaseStyle } from '../../utils/ui'
import { theme } from '../../constants/theme'

const ST = {
  'Em produção':       { label: 'Em produção',       bg: '#edf7f0', color: '#2D7A4A', dot: '#2D7A4A' },
  'Em producao':       { label: 'Em produção',       bg: '#edf7f0', color: '#2D7A4A', dot: '#2D7A4A' },
  'Em montagem':       { label: 'Em montagem',       bg: '#edf7f0', color: '#3a7d4f', dot: '#5aab6e' },
  'Em andamento':      { label: 'Em andamento',      bg: '#edf7f0', color: '#3a7d4f', dot: '#5aab6e' },
  'Concluida':         { label: 'Concluída',         bg: '#eef2f8', color: '#3a5580', dot: '#7090c0' },
  'Concluída':         { label: 'Concluída',         bg: '#eef2f8', color: '#3a5580', dot: '#7090c0' },
  'Pausada':           { label: 'Pausada',           bg: '#fdf3e3', color: '#a0692a', dot: '#d4a055' },
  'Cancelada':         { label: 'Cancelada',         bg: '#fdecea', color: '#a03030', dot: '#d45555' },
  'Aguardando inicio': { label: 'Ag. início',        bg: '#f5f5f5', color: '#616161', dot: '#9E9E9E' },
  'Aguardando início': { label: 'Ag. início',        bg: '#f5f5f5', color: '#616161', dot: '#9E9E9E' },
  'Montagem agendada': { label: 'Mont. agendada',    bg: '#E3F2FD', color: '#1565C0', dot: '#1565C0' },
  'Planejamento':      { label: 'Planejamento',      bg: '#f5f0ff', color: '#6040a0', dot: '#9070c0' },
}
const STATUS_LISTA = ['Em produção', 'Em montagem', 'Em andamento', 'Concluída', 'Pausada', 'Cancelada', 'Aguardando início', 'Montagem agendada', 'Planejamento']

function normalizar(v) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function getStatus(s) {
  const key = Object.keys(ST).find(k => normalizar(k) === normalizar(s))
  return ST[key] || { label: s || '-', bg: '#f0ece6', color: '#888', dot: '#ccc' }
}

function titleCase(nome) {
  if (!nome) return ''
  return String(nome)
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function dataCurta(data) {
  if (!data) return 'Sem previsão'
  return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function Obras() {
  const navigate = useNavigate()
  const [obras, setObras] = useState([])
  const [cronogramas, setCronogramas] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('Todas')
  const [editModal, setEditModal] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setErro('')
    const [obrasResult, cronogramasResult, profilesResult] = await Promise.all([
      supabase.from('obras').select('*').order('created_at', { ascending: false }),
      supabase.from('obra_cronograma').select('*').limit(300),
      supabase.from('profiles').select('id, full_name, role'),
    ])
    if (obrasResult.error || cronogramasResult.error || profilesResult.error) {
      const error = obrasResult.error || cronogramasResult.error || profilesResult.error
      console.error('Erro ao carregar obras:', { obras: obrasResult.error, cronogramas: cronogramasResult.error, profiles: profilesResult.error })
      setErro(error?.message || 'Não foi possível carregar as obras.')
    }
    setObras(obrasResult.data || [])
    setCronogramas(cronogramasResult.data || [])
    setProfiles(profilesResult.data || [])
    setLoading(false)
  }

  async function excluir(obra, e) {
    e.stopPropagation()
    if (!window.confirm('Excluir a obra "' + obra.nome + '"? Esta ação não pode ser desfeita.')) return
    setErro('')
    const { error } = await supabase.from('obras').delete().eq('id', obra.id)
    if (error) {
      console.error('Erro ao excluir obra:', error)
      setErro(error.message || 'Não foi possível excluir a obra.')
      return
    }
    await carregar()
  }

  async function salvarEdicao() {
    setSalvando(true)
    setErro('')
    try {
      const { error } = await supabase.from('obras').update({
        nome: editModal.nome,
        status: editModal.status,
        progresso: parseInt(editModal.progresso) || 0,
        data_previsao: editModal.data_previsao || null,
        cliente_nome: editModal.cliente_nome,
        observacoes: editModal.observacoes,
      }).eq('id', editModal.id)
      if (error) throw error
      setEditModal(null)
      await carregar()
    } catch (error) {
      console.error('Erro ao salvar obra:', error)
      setErro(error.message || 'Não foi possível salvar a obra.')
    } finally {
      setSalvando(false)
    }
  }

  const obrasFiltradas = filtro === 'Todas' ? obras : obras.filter(o => normalizar(o.status) === normalizar(filtro))
  const profilePorId = new Map(profiles.map(p => [p.id, p]))
  const cronogramasPorObra = mapearCronogramasPorObra(cronogramas)
  const operacaoDaObra = obra => resolverOperacaoObra(obra, cronogramasPorObra.get(obra.id))
  const isStatus = (obra, termos) => termos.some(t => normalizar(obra.status).includes(t))
  const kpis = [
    { label: 'Obras Ativas', value: obras.filter(o => !isStatus(o, ['concluida', 'cancelada'])).length },
    { label: 'Em Produção', value: obras.filter(o => operacaoDaObra(o).faseKey === 'producao').length },
    { label: 'Em Montagem', value: obras.filter(o => ['montagem', 'montagem_finalizada'].includes(operacaoDaObra(o).faseKey)).length },
    { label: 'Aguard. Produção', value: obras.filter(o => ['vistoria_medida', 'executivo', 'vistoria_tecnica', 'entrega_moveis'].includes(operacaoDaObra(o).faseKey)).length },
    { label: 'Travadas', value: obras.filter(o => {
      const operacao = operacaoDaObra(o)
      return isStatus(o, ['pausada', 'cancelada']) || operacao.travado || ['alto', 'critico', 'critica'].includes(normalizar(operacao.risco))
    }).length },
    { label: 'Concluídas', value: obras.filter(o => isStatus(o, ['concluida'])).length },
  ]

  return (
    <div className="ow-page" style={s.page}>
      <style>{css}</style>

      {editModal && (
        <div style={s.modalBg} onClick={e => e.target === e.currentTarget && setEditModal(null)}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Editar Obra</h2>
              <button style={s.btnClose} onClick={() => setEditModal(null)} aria-label="Fechar edicao da obra">X</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div style={s.full}>
                  <L>Nome da obra</L>
                  <I value={editModal.nome} onChange={v => setEditModal(p => ({ ...p, nome: v }))} />
                </div>
                <div style={s.full}>
                  <L>Cliente</L>
                  <I value={editModal.cliente_nome} onChange={v => setEditModal(p => ({ ...p, cliente_nome: v }))} />
                </div>
                <div>
                  <L>Status</L>
                  <Sel value={editModal.status} onChange={v => setEditModal(p => ({ ...p, status: v }))}>
                    {STATUS_LISTA.map(st => <option key={st} value={st}>{ST[st].label}</option>)}
                  </Sel>
                </div>
                <div>
                  <L>Progresso (%)</L>
                  <I type="number" min="0" max="100" value={editModal.progresso || 0} onChange={v => setEditModal(p => ({ ...p, progresso: v }))} />
                </div>
                <div>
                  <L>Previsão de término</L>
                  <I type="date" value={editModal.data_previsao || ''} onChange={v => setEditModal(p => ({ ...p, data_previsao: v }))} />
                </div>
                <div style={s.full}>
                  <L>Observações</L>
                  <textarea value={editModal.observacoes || ''} onChange={e => setEditModal(p => ({ ...p, observacoes: e.target.value }))} rows={3} style={{ background: theme.inputBackground, border: '1px solid ' + theme.inputBorder, color: theme.inputText, borderRadius: 8, padding: '10px 14px', width: '100%', fontSize: 14, outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>
            <div style={s.modalFooter}>
              <button style={s.btnCancel} onClick={() => setEditModal(null)}>Cancelar</button>
              <button style={s.btnSave} onClick={salvarEdicao} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="ob-header" style={s.header}>
        <div>
          <div style={s.breadcrumb}>Gestão</div>
          <h1 style={s.title}>Central de Obras</h1>
          <p style={s.sub}>Operação, status e andamento das obras Ornare</p>
        </div>
        <button className="ob-new" style={s.btnNew} onClick={() => navigate('/obras/nova')}>+ Nova Obra</button>
      </div>

      {erro && <div style={s.errorBox}>{erro}</div>}

      <div className="ob-kpis ob-kpis-desktop" style={s.kpiGrid}>
        {kpis.map(k => (
          <div key={k.label} style={s.kpi}>
            <span style={s.kpiLabel}>{k.label}</span>
            <strong style={s.kpiValue}>{loading ? '-' : k.value}</strong>
          </div>
        ))}
      </div>

      <div className="ob-mobile-kpis" aria-label="Resumo das obras">
        {kpis.map(k => (
          <div key={k.label}>
            <strong>{loading ? '-' : k.value}</strong>
            <span>{k.label}</span>
          </div>
        ))}
      </div>

      <div className="ob-filters" style={s.filtros}>
        {['Todas', ...STATUS_LISTA].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            ...s.filtroBtn,
            background: filtro === f ? theme.gold : theme.surfaceElevated,
            color: filtro === f ? '#141210' : theme.textSecondary,
            border: filtro === f ? '1px solid ' + theme.gold : '1px solid ' + theme.border,
          }}>
            {f === 'Todas' ? 'Todas' : getStatus(f).label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={s.empty}>Carregando...</div>
      ) : obrasFiltradas.length === 0 ? (
        <div style={s.emptyBox}>
          <div style={s.emptyIcon}>🏗️</div>
          <div style={s.emptyTitle}>Nenhuma obra encontrada</div>
          <button style={s.btnNew} onClick={() => navigate('/obras/nova')}>+ Criar Nova Obra</button>
        </div>
      ) : (
        <div className="ob-list" style={s.list}>
          {obrasFiltradas.map(obra => {
            const st = getStatus(obra.status)
            const cor = obraColor(obra)
            const cidadeUf = [obra.cidade, obra.uf].filter(Boolean).join(' • ') || 'Sem cidade'
            const operacao = operacaoDaObra(obra)
            const progresso = operacao.progresso
            const previsao = operacao.fimPrevisto
            return (
              <div
                key={obra.id}
                className="ob-card"
                style={{
                  ...s.card,
                  '--obra-accent': cor.accent,
                  '--obra-soft': cor.soft,
                  '--obra-border': cor.border,
                  '--obra-ink': cor.ink,
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.3)'}
              >
                <button className="ob-app-card" onClick={() => navigate('/obras/' + obra.id)}>
                  <div className="ob-app-head">
                    <div>
                      <strong>{titleCase(obra.nome) || 'Obra sem nome'}</strong>
                      <span>{cidadeUf}</span>
                    </div>
                    <small>{progresso}%</small>
                  </div>
                  <div className="ob-app-progress">
                    <i style={{ width: `${Math.min(100, Math.max(0, progresso))}%` }} />
                  </div>
                  <div className="ob-app-foot">
                      <span style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    <em>Previsão {dataCurta(previsao)}</em>
                  </div>
                </button>
                <div className="ob-card-main" onClick={() => navigate('/obras/' + obra.id)} style={s.cardMain}>
                  <div style={{ ...s.dot, background: cor.accent }} />
                  <div style={s.cardInfo}>
                    <div style={s.cardTop}>
                      <span style={s.cardNome}>{titleCase(obra.nome)}</span>
                      <span style={{ ...s.badge, background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <div className="ob-card-meta" style={s.cardMeta}>
                      {[obra.cliente_nome, obra.cidade, obra.uf].filter(Boolean).join(' · ') || 'Cliente não informado'}
                    </div>
                    <div className="ob-card-details" style={s.cardDetails}>
                      <span>Supervisor: {profilePorId.get(obra.supervisor_id)?.full_name || 'Não definido'}</span>
                      <span>Fase: {operacao.faseLabel}</span>
                      <span>Próxima: {operacao.proximaFaseLabel}</span>
                      <span>{previsao ? 'Previsão: ' + new Date(previsao + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem previsão'}</span>
                      {obra.numero_contrato && <span>Contrato {obra.numero_contrato}</span>}
                    </div>
                    <div className="ob-mobile-summary">
                      <span>{previsao ? new Date(previsao + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem previsão'}</span>
                      <strong>{progresso}%</strong>
                    </div>
                  </div>
                  {progresso > 0 && (
                    <div className="ob-progress" style={s.progressWrap}>
                      <div style={s.progressPct}>{progresso}%</div>
                      <div style={s.progressBar}>
                        <div style={{ ...s.progressFill, background: cor.accent, width: progresso + '%' }} />
                      </div>
                    </div>
                  )}
                  <div style={s.arrow}>›</div>
                </div>
                <div className="ob-card-actions" style={s.cardActions}>
                  <button style={s.btnAcao} onClick={e => { e.stopPropagation(); setEditModal({ ...obra }) }}>
                    Editar
                  </button>
                  <button style={{ ...s.btnAcao, color: '#d94a4a', borderColor: '#fdecea' }} onClick={e => excluir(obra, e)}>
                    Excluir
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function L({ children }) { return <div style={{ fontSize: 11, color: '#888', marginBottom: 5, fontWeight: 500 }}>{children}</div> }
function I({ onChange, ...props }) { return <input {...props} onChange={e => onChange(e.target.value)} style={{ background: theme.inputBackground, border: '1px solid ' + theme.inputBorder, color: theme.inputText, borderRadius: 8, padding: '10px 14px', width: '100%', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} /> }
function Sel({ onChange, children, ...props }) { return <select {...props} onChange={e => onChange(e.target.value)} style={{ background: theme.inputBackground, border: '1px solid ' + theme.inputBorder, color: theme.inputText, borderRadius: 8, padding: '10px 14px', width: '100%', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}>{children}</select> }

const css = `
.ob-mobile-summary{display:none}
.ob-mobile-kpis,.ob-app-card{display:none}
@media (max-width:760px){
  .ow-page{padding-bottom:112px !important}
  .ob-header{display:grid !important;grid-template-columns:1fr;gap:10px;align-items:start !important;margin-bottom:13px !important;padding-right:0 !important}
  .ob-header h1{font-size:27px !important;line-height:1 !important}
  .ob-header p{display:none !important}
  .ob-new{padding:9px 12px !important;border-radius:12px !important;font-size:12px !important}
  .ob-kpis-desktop{display:none !important}
  .ob-mobile-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0 0 12px;padding:0}
  .ob-mobile-kpis>div{min-width:0;display:flex;align-items:center;justify-content:space-between;gap:7px;background:${theme.surface};border:1px solid ${theme.border};border-radius:16px;padding:10px 11px;box-shadow:0 8px 20px rgba(0,0,0,.16)}
  .ob-mobile-kpis strong{font-size:19px;line-height:1;color:var(--color-ink)}
  .ob-mobile-kpis span{font-size:10.5px;line-height:1.05;color:var(--color-ink-muted);font-weight:800;white-space:normal;text-align:right}
  .ob-filters{display:flex !important;overflow-x:auto !important;gap:8px !important;flex-wrap:nowrap !important;margin-bottom:14px !important;padding-bottom:3px}
  .ob-filters button{flex:0 0 auto !important;white-space:nowrap !important}
  .ob-list{gap:10px !important}
  .ob-card{border-radius:18px !important;box-shadow:0 14px 34px rgba(0,0,0,.18) !important;border:1px solid var(--obra-border) !important;background:linear-gradient(135deg,var(--obra-soft),${theme.surface} 42%) !important}
  .ob-card-main{display:none !important}
  .ob-card-actions{display:none !important}
  .ob-app-card{display:block;width:100%;border:0;background:transparent;text-align:left;font-family:inherit;padding:15px 15px 14px;cursor:pointer}
  .ob-app-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
  .ob-app-head strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:16px;line-height:1.18;color:var(--color-ink);font-weight:900;word-break:normal;overflow-wrap:normal}
  .ob-app-head span{display:block;margin-top:4px;font-size:12.5px;line-height:1.25;color:var(--color-ink-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:230px}
  .ob-app-head small{flex:0 0 auto;color:var(--color-gold);font-size:20px;line-height:1;font-weight:900}
  .ob-app-progress{height:5px;background:#EEE8DE;border-radius:999px;overflow:hidden;margin:13px 0 10px}
  .ob-app-progress i{display:block;height:100%;background:var(--obra-accent);border-radius:999px}
  .ob-app-foot{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .ob-app-foot span{border-radius:999px;padding:5px 10px;font-size:11px;line-height:1;font-weight:900;white-space:nowrap}
  .ob-app-foot em{font-style:normal;font-size:12px;color:var(--color-ink-muted);white-space:nowrap}
}
`

const s = {
  page: { width: '100%', padding: '32px 40px', maxWidth: 'none', margin: 0, background: theme.background, color: theme.textPrimary, fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', overflowX: 'hidden' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, marginBottom: 24, boxSizing: 'border-box' },
  breadcrumb: { fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 6 },
  title: { fontFamily: 'var(--font-serif)', fontSize: 36, fontWeight: 500, color: 'var(--color-ink)', margin: 0 },
  sub: { fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 4 },
  btnNew: { background: '#C9A84C', color: '#141210', fontWeight: 600, fontSize: 14, borderRadius: 8, padding: '10px 20px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 12, marginBottom: 20 },
  kpi: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  kpiLabel: { display: 'block', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--color-gold)', fontWeight: 800, marginBottom: 8 },
  kpiValue: { display: 'block', fontSize: 30, lineHeight: 1, color: 'var(--color-ink)' },
  filtros: { display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  filtroBtn: { padding: '6px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { background: 'linear-gradient(135deg,var(--obra-soft),var(--color-surface) 42%)', border: '1px solid var(--obra-border)', borderLeft: '7px solid var(--obra-accent)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  cardMain: { display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', cursor: 'pointer' },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  cardInfo: { flex: 1, minWidth: 0 },
  cardTop: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' },
  cardNome: { fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' },
  badge: statusBadgeBaseStyle,
  cardMeta: { fontSize: 12, color: 'var(--color-ink-muted)' },
  cardDetails: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, fontSize: 11, color: 'var(--color-ink-muted)' },
  progressWrap: { minWidth: 100, textAlign: 'right', flexShrink: 0 },
  progressPct: { fontSize: 11, color: 'var(--color-gold)', marginBottom: 4 },
  progressBar: { ...progressBarStyle, width: 100 },
  progressFill: progressFillStyle,
  arrow: { fontSize: 18, color: '#ccc', flexShrink: 0 },
  cardActions: { display: 'flex', gap: 8, padding: '8px 20px 12px', borderTop: '1px solid var(--color-border)' },
  btnAcao: { background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--color-ink-muted)', fontFamily: 'inherit' },
  empty: { textAlign: 'center', padding: '40px 0', color: '#bbb' },
  emptyBox: { textAlign: 'center', padding: '60px 20px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 20 },
  errorBox: { background: theme.statusBg.danger, border: `1px solid ${theme.error}`, color: theme.error, borderRadius: 10, padding: '10px 12px', fontSize: 12.5, fontWeight: 800, marginBottom: 14 },
  modalBg: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 28px 0', flexShrink: 0 },
  modalTitle: { fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 500, margin: 0 },
  btnClose: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999' },
  modalBody: { overflowY: 'auto', padding: '20px 28px', flex: 1 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 28px', borderTop: '1px solid #f0ece6', flexShrink: 0 },
  btnCancel: { background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', color: '#888', fontFamily: 'inherit' },
  btnSave: { background: theme.gold, color: theme.background, border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  full: { gridColumn: '1/-1' },
}
