import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const ST = {
  'Em montagem':       { label: 'Em montagem',       bg: '#edf7f0', color: '#3a7d4f', dot: '#5aab6e' },
  'Em andamento':      { label: 'Em andamento',      bg: '#edf7f0', color: '#3a7d4f', dot: '#5aab6e' },
  'Concluida':         { label: 'Concluida',         bg: '#eef2f8', color: '#3a5580', dot: '#7090c0' },
  'Pausada':           { label: 'Pausada',           bg: '#fdf3e3', color: '#a0692a', dot: '#d4a055' },
  'Cancelada':         { label: 'Cancelada',         bg: '#fdecea', color: '#a03030', dot: '#d45555' },
  'Aguardando inicio': { label: 'Ag. inicio',        bg: '#f5f5f5', color: '#616161', dot: '#9E9E9E' },
  'Montagem agendada': { label: 'Mont. agendada',    bg: '#E3F2FD', color: '#1565C0', dot: '#1565C0' },
  'Planejamento':      { label: 'Planejamento',      bg: '#f5f0ff', color: '#6040a0', dot: '#9070c0' },
}
const STATUS_LISTA = Object.keys(ST)

function getStatus(s) {
  return ST[s] || { label: s || '-', bg: '#f0ece6', color: '#888', dot: '#ccc' }
}

export default function Obras() {
  const navigate = useNavigate()
  const [obras, setObras] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('Todas')
  const [editModal, setEditModal] = useState(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase.from('obras').select('*').order('created_at', { ascending: false })
    setObras(data || [])
    setLoading(false)
  }

  async function excluir(obra, e) {
    e.stopPropagation()
    if (!window.confirm('Excluir a obra "' + obra.nome + '"? Esta acao nao pode ser desfeita.')) return
    await supabase.from('obras').delete().eq('id', obra.id)
    await carregar()
  }

  async function salvarEdicao() {
    setSalvando(true)
    await supabase.from('obras').update({
      nome: editModal.nome,
      status: editModal.status,
      progresso: parseInt(editModal.progresso) || 0,
      data_previsao: editModal.data_previsao || null,
      cliente_nome: editModal.cliente_nome,
      observacoes: editModal.observacoes,
    }).eq('id', editModal.id)
    setEditModal(null)
    await carregar()
    setSalvando(false)
  }

  const obrasFiltradas = filtro === 'Todas' ? obras : obras.filter(o => o.status === filtro)

  return (
    <div style={s.page}>

      {editModal && (
        <div style={s.modalBg} onClick={e => e.target === e.currentTarget && setEditModal(null)}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Editar Obra</h2>
              <button style={s.btnClose} onClick={() => setEditModal(null)}>X</button>
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
                  <L>Previsao de termino</L>
                  <I type="date" value={editModal.data_previsao || ''} onChange={v => setEditModal(p => ({ ...p, data_previsao: v }))} />
                </div>
                <div style={s.full}>
                  <L>Observacoes</L>
                  <textarea value={editModal.observacoes || ''} onChange={e => setEditModal(p => ({ ...p, observacoes: e.target.value }))} rows={3} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }} />
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

      <div style={s.header}>
        <div>
          <div style={s.breadcrumb}>Gestao</div>
          <h1 style={s.title}>Obras</h1>
          <p style={s.sub}>{obras.length} obra{obras.length !== 1 ? 's' : ''} cadastrada{obras.length !== 1 ? 's' : ''}</p>
        </div>
        <button style={s.btnNew} onClick={() => navigate('/obras/nova')}>+ Nova Obra</button>
      </div>

      <div style={s.filtros}>
        {['Todas', ...STATUS_LISTA].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            ...s.filtroBtn,
            background: filtro === f ? 'var(--color-ink)' : '#fff',
            color: filtro === f ? '#f9f7f4' : 'var(--color-ink-muted)',
            border: filtro === f ? 'none' : '1px solid var(--color-border)',
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
        <div style={s.list}>
          {obrasFiltradas.map(obra => {
            const st = getStatus(obra.status)
            return (
              <div key={obra.id} style={s.card}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                <div onClick={() => navigate('/obras/' + obra.id)} style={s.cardMain}>
                  <div style={{ ...s.dot, background: st.dot }} />
                  <div style={s.cardInfo}>
                    <div style={s.cardTop}>
                      <span style={s.cardNome}>{obra.nome}</span>
                      <span style={{ ...s.badge, background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <div style={s.cardMeta}>
                      {obra.cliente_nome}
                      {obra.cidade ? ' · ' + obra.cidade : ''}
                      {obra.data_previsao ? ' · Prev: ' + new Date(obra.data_previsao + 'T00:00:00').toLocaleDateString('pt-BR') : ''}
                      {obra.numero_contrato ? ' · Contrato ' + obra.numero_contrato : ''}
                    </div>
                  </div>
                  {obra.progresso > 0 && (
                    <div style={s.progressWrap}>
                      <div style={s.progressPct}>{obra.progresso}%</div>
                      <div style={s.progressBar}>
                        <div style={{ ...s.progressFill, width: obra.progresso + '%' }} />
                      </div>
                    </div>
                  )}
                  <div style={s.arrow}>›</div>
                </div>
                <div style={s.cardActions}>
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
function I({ onChange, ...props }) { return <input {...props} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }} /> }
function Sel({ onChange, children, ...props }) { return <select {...props} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }}>{children}</select> }

const s = {
  page: { padding: '32px 40px', maxWidth: 1100, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  breadcrumb: { fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 6 },
  title: { fontFamily: 'var(--font-serif)', fontSize: 36, fontWeight: 500, color: 'var(--color-ink)', margin: 0 },
  sub: { fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 4 },
  btnNew: { background: 'var(--color-blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  filtros: { display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  filtroBtn: { padding: '6px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' },
  cardMain: { display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', cursor: 'pointer' },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  cardInfo: { flex: 1, minWidth: 0 },
  cardTop: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' },
  cardNome: { fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' },
  badge: { fontSize: 10, padding: '2px 10px', borderRadius: 20, fontWeight: 500 },
  cardMeta: { fontSize: 12, color: 'var(--color-ink-muted)' },
  progressWrap: { minWidth: 100, textAlign: 'right', flexShrink: 0 },
  progressPct: { fontSize: 11, color: 'var(--color-gold)', marginBottom: 4 },
  progressBar: { height: 4, background: 'var(--color-border)', borderRadius: 2, width: 100 },
  progressFill: { height: 4, background: 'var(--color-gold)', borderRadius: 2 },
  arrow: { fontSize: 18, color: '#ccc', flexShrink: 0 },
  cardActions: { display: 'flex', gap: 8, padding: '8px 20px 12px', borderTop: '1px solid var(--color-border)' },
  btnAcao: { background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--color-ink-muted)', fontFamily: 'inherit' },
  empty: { textAlign: 'center', padding: '40px 0', color: '#bbb' },
  emptyBox: { textAlign: 'center', padding: '60px 20px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 20 },
  modalBg: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 28px 0', flexShrink: 0 },
  modalTitle: { fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 500, margin: 0 },
  btnClose: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999' },
  modalBody: { overflowY: 'auto', padding: '20px 28px', flex: 1 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 28px', borderTop: '1px solid #f0ece6', flexShrink: 0 },
  btnCancel: { background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', color: '#888', fontFamily: 'inherit' },
  btnSave: { background: 'var(--color-blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  full: { gridColumn: '1/-1' },
}