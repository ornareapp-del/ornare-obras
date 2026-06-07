import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const ROLES = ['admin','gestao','supervisor','montador','cliente']
const ROLE_LABEL = { admin:'Admin', gestao:'Gestão', supervisor:'Supervisor', montador:'Montador', cliente:'Cliente' }
const ROLE_COLOR = { admin:'#6040a0', gestao:'#3a5580', supervisor:'#3a7d4f', montador:'#b09a7a', cliente:'#888' }

export default function Equipe() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [filtro, setFiltro] = useState('todos')
  const [form, setForm] = useState({ full_name:'', email:'', role:'montador', telefone:'', cargo:'', ativo:true })

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setProfiles(data || [])
    setLoading(false)
  }

  async function salvar() {
    if (!form.full_name.trim() || !form.email.trim()) return
    setSalvando(true)
    await supabase.from('profiles').insert([form])
    setForm({ full_name:'', email:'', role:'montador', telefone:'', cargo:'', ativo:true })
    setShowForm(false)
    await carregar()
    setSalvando(false)
  }

  async function toggleAtivo(p) {
    await supabase.from('profiles').update({ ativo: !p.ativo }).eq('id', p.id)
    await carregar()
  }

  const lista = filtro === 'todos' ? profiles : profiles.filter(p => p.role === filtro)

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 8 }}>Gestão</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 500, color: 'var(--color-ink)', margin: 0 }}>Equipe</h1>
          <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 6 }}>{profiles.length} membro{profiles.length !== 1 ? 's' : ''} · {profiles.filter(p => p.ativo !== false).length} ativos</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ background: 'var(--color-ink)', color: '#f9f7f4', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
          {showForm ? '✕ Cancelar' : '+ Novo Membro'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><L>Nome *</L><I value={form.full_name} onChange={v => setForm(p => ({ ...p, full_name: v }))} placeholder="Nome completo" /></div>
            <div><L>E-mail *</L><I type="email" value={form.email} onChange={v => setForm(p => ({ ...p, email: v }))} placeholder="email@exemplo.com" /></div>
            <div><L>Telefone</L><I value={form.telefone} onChange={v => setForm(p => ({ ...p, telefone: v }))} placeholder="(48) 99999-9999" /></div>
            <div><L>Cargo</L><I value={form.cargo} onChange={v => setForm(p => ({ ...p, cargo: v }))} placeholder="Ex: Montador Sênior" /></div>
            <div><L>Perfil / Permissão</L>
              <S value={form.role} onChange={v => setForm(p => ({ ...p, role: v }))}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </S>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20 }}>
              <input type="checkbox" id="ativo" checked={form.ativo} onChange={e => setForm(p => ({ ...p, ativo: e.target.checked }))} />
              <label htmlFor="ativo" style={{ fontSize: 13, color: 'var(--color-ink-muted)', cursor: 'pointer' }}>Ativo</label>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={salvar} disabled={salvando} style={{ background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {salvando ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {['todos', ...ROLES].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{ padding: '6px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer', background: filtro === f ? 'var(--color-ink)' : '#fff', color: filtro === f ? '#f9f7f4' : 'var(--color-ink-muted)', border: filtro === f ? 'none' : '1px solid var(--color-border)', fontWeight: filtro === f ? 500 : 400 }}>
            {f === 'todos' ? 'Todos' : ROLE_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? <div style={{ color: '#bbb' }}>Carregando...</div>
        : lista.length === 0 ? <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhum membro encontrado.</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {lista.map(p => {
              const initials = (p.full_name || p.email || '?').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()
              const cor = ROLE_COLOR[p.role] || '#888'
              const ativo = p.ativo !== false
              return (
                <div key={p.id} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, opacity: ativo ? 1 : 0.55 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: cor + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: cor }}>{initials}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 1 }}>{p.full_name || '—'}</div>
                    {p.cargo && <div style={{ fontSize: 11, color: '#aaa', marginBottom: 3 }}>{p.cargo}</div>}
                    <div style={{ fontSize: 11.5, color: 'var(--color-ink-muted)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, padding: '2px 10px', borderRadius: 20, background: cor + '18', color: cor, fontWeight: 600 }}>{ROLE_LABEL[p.role] || p.role}</span>
                      <span style={{ fontSize: 10, padding: '2px 10px', borderRadius: 20, background: ativo ? '#edf7f0' : '#f5f5f5', color: ativo ? '#3a7d4f' : '#aaa', fontWeight: 500 }}>{ativo ? 'Ativo' : 'Inativo'}</span>
                    </div>
                  </div>
                  <button onClick={() => toggleAtivo(p)} title={ativo ? 'Desativar' : 'Ativar'} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 10px', fontSize: 11, cursor: 'pointer', color: 'var(--color-ink-muted)', flexShrink: 0 }}>
                    {ativo ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              )
            })}
          </div>
        )
      }
    </div>
  )
}

function L({ children }) { return <div style={{ fontSize: 11, color: '#888', marginBottom: 5, fontWeight: 500 }}>{children}</div> }
function I({ onChange, ...props }) { return <input {...props} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} /> }
function S({ onChange, children, ...props }) { return <select {...props} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }}>{children}</select> }