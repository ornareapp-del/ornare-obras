import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'

const CATEGORIAS = [
  { value: 'combustivel', label: '⛽ Combustível', cor: '#E8A020' },
  { value: 'pedagio', label: '🛣️ Pedágio', cor: '#9070C0' },
  { value: 'hospedagem', label: '🏨 Hospedagem', cor: '#4A90D9' },
  { value: 'alimentacao', label: '🍽️ Alimentação', cor: '#5AAB6E' },
  { value: 'frete', label: '🚚 Frete', cor: '#D9704A' },
  { value: 'terceiros', label: '👷 Terceiros', cor: '#B09A7A' },
  { value: 'ferragens', label: '🔧 Ferragens', cor: '#888' },
  { value: 'outro', label: '📦 Outros', cor: '#AAA' },
]

const CAT = Object.fromEntries(CATEGORIAS.map(c => [c.value, c]))

function Modal({ obras, profiles, onClose, onSaved }) {
  const { profile } = useStore()
  const [form, setForm] = useState({
    obra_id: '', categoria: 'combustivel', descricao: '',
    valor: '', data: new Date().toISOString().split('T')[0],
    responsavel_id: profile?.id || '', observacao: ''
  })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function salvar() {
    if (!form.descricao || !form.valor || !form.data) {
      setErro('Preencha descrição, valor e data.'); return
    }
    setSaving(true)
    const { error } = await supabase.from('gastos').insert({
      ...form,
      valor: parseFloat(form.valor.replace(',', '.')),
      criado_por: profile?.id
    })
    if (error) { setErro(error.message); setSaving(false); return }
    onSaved()
  }

  return (
    <div style={ms.bg} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={ms.box}>
        <div style={ms.header}>
          <h2 style={ms.title}>Novo Gasto</h2>
          <button style={ms.close} onClick={onClose}>✕</button>
        </div>

        {erro && <div style={ms.erro}>{erro}</div>}

        <div style={ms.grid}>
          <div style={ms.full}>
            <label style={ms.label}>Descrição *</label>
            <input style={ms.input} value={form.descricao}
              onChange={e => set('descricao', e.target.value)}
              placeholder="Ex: Combustível ida à obra..." />
          </div>

          <div>
            <label style={ms.label}>Categoria *</label>
            <select style={ms.input} value={form.categoria}
              onChange={e => set('categoria', e.target.value)}>
              {CATEGORIAS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={ms.label}>Valor (R$) *</label>
            <input style={ms.input} value={form.valor}
              onChange={e => set('valor', e.target.value)}
              placeholder="0,00" />
          </div>

          <div>
            <label style={ms.label}>Data *</label>
            <input style={ms.input} type="date" value={form.data}
              onChange={e => set('data', e.target.value)} />
          </div>

          <div>
            <label style={ms.label}>Obra</label>
            <select style={ms.input} value={form.obra_id}
              onChange={e => set('obra_id', e.target.value)}>
              <option value="">— Sem obra vinculada —</option>
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

          <div style={ms.full}>
            <label style={ms.label}>Observação</label>
            <textarea style={{ ...ms.input, height: 72, resize: 'vertical' }}
              value={form.observacao}
              onChange={e => set('observacao', e.target.value)}
              placeholder="Informações adicionais..." />
          </div>
        </div>

        <div style={ms.footer}>
          <button style={ms.btnCancel} onClick={onClose}>Cancelar</button>
          <button style={ms.btnSave} onClick={salvar} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Gasto'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Gastos() {
  const navigate = useNavigate()
  const [gastos, setGastos] = useState([])
  const [obras, setObras] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroObra, setFiltroObra] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [modal, setModal] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const [{ data: g }, { data: o }, { data: p }] = await Promise.all([
      supabase.from('gastos').select('*, obras(nome), responsavel:profiles!gastos_responsavel_id_fkey(full_name)').order('data', { ascending: false }),
      supabase.from('obras').select('id, nome').order('nome'),
      supabase.from('profiles').select('id, full_name').in('role', ['gestao', 'supervisor', 'montador']),
    ])
    setGastos(g || [])
    setObras(o || [])
    setProfiles(p || [])
    setLoading(false)
  }

  const lista = gastos
    .filter(g => !filtroObra || g.obra_id === filtroObra)
    .filter(g => !filtroCategoria || g.categoria === filtroCategoria)

  const total = lista.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0)

  const porCategoria = Object.entries(
    lista.reduce((acc, g) => {
      acc[g.categoria] = (acc[g.categoria] || 0) + parseFloat(g.valor || 0)
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  return (
    <div style={s.page}>
      {modal && (
        <Modal obras={obras} profiles={profiles}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); carregar() }} />
      )}

      <div style={s.header}>
        <div>
          <div style={s.breadcrumb}>Gestão</div>
          <h1 style={s.title}>Gastos</h1>
          <p style={s.sub}>Controle financeiro de todas as obras</p>
        </div>
        <button style={s.btnNew} onClick={() => setModal(true)}>
          + Lançar Gasto
        </button>
      </div>

      <div style={s.statsGrid}>
        <div style={s.stat}>
          <div style={s.statLabel}>Total Geral</div>
          <div style={s.statValue}>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
        <div style={s.stat}>
          <div style={s.statLabel}>Lançamentos</div>
          <div style={s.statValue}>{lista.length}</div>
        </div>
        <div style={s.stat}>
          <div style={s.statLabel}>Obras com gastos</div>
          <div style={s.statValue}>{new Set(lista.map(g => g.obra_id).filter(Boolean)).size}</div>
        </div>
      </div>

      {porCategoria.length > 0 && (
        <div style={s.card}>
          <div style={s.cardLabel}>Por categoria</div>
          {porCategoria.map(([cat, val]) => (
            <div key={cat} style={s.catRow}>
              <div style={{ ...s.catDot, background: CAT[cat]?.cor || '#ccc' }} />
              <div style={s.catName}>{CAT[cat]?.label || cat}</div>
              <div style={s.catBar}>
                <div style={{ ...s.catFill, width: `${Math.round(val / total * 100)}%`, background: CAT[cat]?.cor || '#ccc' }} />
              </div>
              <div style={s.catVal}>R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div style={s.catPct}>{Math.round(val / total * 100)}%</div>
            </div>
          ))}
        </div>
      )}

      <div style={s.filters}>
        <select style={s.select} value={filtroObra} onChange={e => setFiltroObra(e.target.value)}>
          <option value="">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <select style={s.select} value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={s.empty}>Carregando...</div>
      ) : lista.length === 0 ? (
        <div style={s.emptyBox}>
          <div style={s.emptyIcon}>💰</div>
          <div style={s.emptyTitle}>Nenhum gasto lançado</div>
          <div style={s.emptySub}>Registre os gastos operacionais das obras</div>
          <button style={s.btnNew} onClick={() => setModal(true)}>+ Lançar Primeiro Gasto</button>
        </div>
      ) : (
        <div style={s.list}>
          {lista.map(g => (
            <div key={g.id} style={s.item}
              onClick={() => g.obra_id && navigate(`/obras/${g.obra_id}`)}>
              <div style={{ ...s.itemDot, background: CAT[g.categoria]?.cor || '#ccc' }} />
              <div style={s.itemBody}>
                <div style={s.itemTitle}>{g.descricao}</div>
                <div style={s.itemMeta}>
                  {CAT[g.categoria]?.label || g.categoria}
                  {g.obras?.nome ? ` · ${g.obras.nome}` : ''}
                  {g.responsavel?.full_name ? ` · ${g.responsavel.full_name}` : ''}
                  {g.data ? ` · ${new Date(g.data + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
                </div>
                {g.observacao && <div style={s.itemObs}>{g.observacao}</div>}
              </div>
              <div style={s.itemValor}>
                R$ {parseFloat(g.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const s = {
  page: { padding: '32px 40px', maxWidth: 1000, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  breadcrumb: { fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 6 },
  title: { fontFamily: 'var(--font-serif)', fontSize: 36, fontWeight: 500, color: 'var(--color-ink)', margin: 0 },
  sub: { fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 4 },
  btnNew: { background: 'var(--color-blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 },
  stat: { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '18px 22px' },
  statLabel: { fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 8 },
  statValue: { fontSize: 28, fontWeight: 700, color: 'var(--color-ink)' },
  card: { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: '18px 22px', marginBottom: 20 },
  cardLabel: { fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 14 },
  catRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  catDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  catName: { fontSize: 12, fontWeight: 500, minWidth: 120, color: 'var(--color-ink)' },
  catBar: { flex: 1, height: 6, background: '#f0ece6', borderRadius: 3 },
  catFill: { height: 6, borderRadius: 3 },
  catVal: { fontSize: 12, fontWeight: 600, color: 'var(--color-ink)', minWidth: 90, textAlign: 'right' },
  catPct: { fontSize: 11, color: '#aaa', minWidth: 36, textAlign: 'right' },
  filters: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  select: { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 13, fontFamily: 'inherit', background: '#fff', color: 'var(--color-ink)' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  item: { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'border-color .15s' },
  itemDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  itemBody: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' },
  itemMeta: { fontSize: 11, color: '#aaa', marginTop: 2 },
  itemObs: { fontSize: 11, color: '#bbb', marginTop: 3, fontStyle: 'italic' },
  itemValor: { fontSize: 15, fontWeight: 700, color: 'var(--color-ink)', whiteSpace: 'nowrap' },
  empty: { textAlign: 'center', padding: '40px 0', color: '#bbb' },
  emptyBox: { textAlign: 'center', padding: '60px 20px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#aaa', marginBottom: 20 },
}

const ms = {
  bg: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  box: { background: '#fff', borderRadius: 14, padding: '28px 32px', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 500, margin: 0 },
  close: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  full: { gridColumn: '1/-1' },
  label: { display: 'block', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: '#888', marginBottom: 6 },
  input: { width: '100%', border: '1px solid #e0dbd4', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', color: 'var(--color-ink)', background: '#fafaf8', outline: 'none', boxSizing: 'border-box' },
  erro: { background: '#fceee9', borderLeft: '3px solid #c4421e', color: '#5c2010', padding: '10px 14px', borderRadius: 6, fontSize: 12, marginBottom: 16 },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 20, borderTop: '1px solid #f0ece6' },
  btnCancel: { background: 'none', border: '1px solid #e0dbd4', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', color: '#888' },
  btnSave: { background: 'var(--color-blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
}