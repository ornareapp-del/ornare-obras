import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const ROLES = ['gestao','supervisor','montador','cliente']
const ROLE_LABEL = { gestao:'Gestão', supervisor:'Supervisor', montador:'Montador', cliente:'Cliente' }
const ROLE_COLOR = { gestao:'#3a5580', supervisor:'#3a7d4f', montador:'#b09a7a', cliente:'#888' }
const ROLE_DESC = {
  gestao: 'Obras, agenda, equipe e relatórios',
  supervisor: 'Obras sob sua responsabilidade',
  montador: 'Tarefas e check-in/check-out',
  cliente: 'Portal do cliente (acesso externo)',
}

function ModalNovoUsuario({ onClose, onSaved }) {
  const [form, setForm] = useState({ full_name: '', email: '', senha: '', role: 'montador', cargo: '', telefone: '' })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function salvar() {
    if (!form.full_name || !form.email || !form.senha) {
      setErro('Preencha nome, e-mail e senha.'); return
    }
    if (form.senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.'); return
    }
    setSaving(true)
    setErro('')

    // Cria via signup normal — funciona sem admin API
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.senha,
      options: {
        data: { full_name: form.full_name }
      }
    })

    if (error) { setErro(error.message); setSaving(false); return }

    // Cria o profile
    if (data?.user) {
      const { error: pe } = await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: form.full_name,
        email: form.email,
        role: form.role,
        cargo: form.cargo || null,
        telefone: form.telefone || null,
        ativo: true,
      })
      if (pe) { setErro(pe.message); setSaving(false); return }
    }

    setOk(true)
    setSaving(false)
  }

  if (ok) return (
    <div style={ms.bg}>
      <div style={{ ...ms.box, textAlign: 'center', padding: '48px 32px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, marginBottom: 8 }}>Usuário criado!</h2>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 8 }}>
          <strong>{form.full_name}</strong> já pode acessar o sistema.
        </p>
        <div style={{ background: '#f0f7ff', borderRadius: 8, padding: '12px 16px', fontSize: 13, marginBottom: 24, textAlign: 'left' }}>
          <div><strong>E-mail:</strong> {form.email}</div>
          <div><strong>Senha:</strong> {form.senha}</div>
          <div><strong>Perfil:</strong> {ROLE_LABEL[form.role]}</div>
        </div>
        <button style={ms.btnSave} onClick={onSaved}>Fechar</button>
      </div>
    </div>
  )

  return (
    <div style={ms.bg} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={ms.box}>
        <div style={ms.header}>
          <h2 style={ms.title}>Novo Usuário</h2>
          <button style={ms.close} onClick={onClose}>✕</button>
        </div>
        <div style={ms.body}>
          {erro && <div style={ms.erro}>{erro}</div>}
          <div style={ms.grid}>
            <div style={ms.full}>
              <label style={ms.label}>Nome completo *</label>
              <input style={ms.input} value={form.full_name}
                onChange={e => set('full_name', e.target.value)}
                placeholder="Nome do usuário" />
            </div>
            <div>
              <label style={ms.label}>E-mail *</label>
              <input style={ms.input} type="email" value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="email@exemplo.com" />
            </div>
            <div>
              <label style={ms.label}>Senha inicial *</label>
              <input style={ms.input} type="text" value={form.senha}
                onChange={e => set('senha', e.target.value)}
                placeholder="Mínimo 6 caracteres" />
            </div>
            <div>
              <label style={ms.label}>Cargo</label>
              <input style={ms.input} value={form.cargo}
                onChange={e => set('cargo', e.target.value)}
                placeholder="Ex: Montador Sênior" />
            </div>
            <div>
              <label style={ms.label}>Telefone</label>
              <input style={ms.input} value={form.telefone}
                onChange={e => set('telefone', e.target.value)}
                placeholder="(48) 99999-9999" />
            </div>
            <div style={ms.full}>
              <label style={ms.label}>Perfil de acesso *</label>
              <div style={ms.roleGrid}>
                {ROLES.map(r => (
                  <div key={r} onClick={() => set('role', r)} style={{
                    ...ms.roleCard,
                    border: form.role === r ? `2px solid ${ROLE_COLOR[r]}` : '1px solid #e0dbd4',
                    background: form.role === r ? ROLE_COLOR[r] + '12' : '#fafaf8',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: form.role === r ? ROLE_COLOR[r] : 'var(--color-ink)', marginBottom: 3 }}>
                      {ROLE_LABEL[r]}
                    </div>
                    <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.4 }}>{ROLE_DESC[r]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div style={ms.footer}>
          <button style={ms.btnCancel} onClick={onClose}>Cancelar</button>
          <button style={ms.btnSave} onClick={salvar} disabled={saving}>
            {saving ? 'Criando...' : 'Criar Usuário'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Equipe() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [editando, setEditando] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [modal, setModal] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setProfiles(data || [])
    setLoading(false)
  }

  async function salvarEdicao(id) {
    setSalvando(true)
    await supabase.from('profiles').update({
      full_name: editando.full_name,
      role: editando.role,
      cargo: editando.cargo,
      telefone: editando.telefone,
      ativo: editando.ativo,
    }).eq('id', id)
    setEditando(null)
    await carregar()
    setSalvando(false)
  }

  async function toggleAtivo(p) {
    await supabase.from('profiles').update({ ativo: !p.ativo }).eq('id', p.id)
    await carregar()
  }

  const lista = filtro === 'todos' ? profiles : profiles.filter(p => p.role === filtro)

  return (
    <div style={s.page}>
      {modal && (
        <ModalNovoUsuario
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); carregar() }} />
      )}

      <div style={s.header}>
        <div>
          <div style={s.breadcrumb}>Gestão</div>
          <h1 style={s.title}>Equipe</h1>
          <p style={s.sub}>
            {profiles.length} membro{profiles.length !== 1 ? 's' : ''} · {profiles.filter(p => p.ativo !== false).length} ativos
          </p>
        </div>
        <button style={s.btnNew} onClick={() => setModal(true)}>
          + Novo Usuário
        </button>
      </div>

      <div style={s.filters}>
        {['todos', ...ROLES].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            ...s.filterBtn,
            background: filtro === f ? 'var(--color-ink)' : '#fff',
            color: filtro === f ? '#f9f7f4' : 'var(--color-ink-muted)',
            border: filtro === f ? 'none' : '1px solid var(--color-border)',
            fontWeight: filtro === f ? 500 : 400,
          }}>
            {f === 'todos' ? 'Todos' : ROLE_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={s.empty}>Carregando...</div>
      ) : lista.length === 0 ? (
        <div style={s.emptyBox}>
          <div style={s.emptyIcon}>👥</div>
          <div style={s.emptyTitle}>Nenhum membro encontrado</div>
          <div style={s.emptySub}>Adicione membros à equipe para começar</div>
          <button style={s.btnNew} onClick={() => setModal(true)}>+ Criar Primeiro Usuário</button>
        </div>
      ) : (
        <div style={s.list}>
          {lista.map(p => {
            const cor = ROLE_COLOR[p.role] || '#888'
            const ativo = p.ativo !== false
            const initials = (p.full_name || p.email || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
            const isEditando = editando?.id === p.id

            return (
              <div key={p.id} style={{ ...s.item, opacity: ativo ? 1 : 0.6 }}>
                {isEditando ? (
                  <div>
                    <div style={s.editGrid}>
                      <div>
                        <label style={s.label}>Nome</label>
                        <input style={s.input} value={editando.full_name || ''}
                          onChange={e => setEditando(ed => ({ ...ed, full_name: e.target.value }))} />
                      </div>
                      <div>
                        <label style={s.label}>Cargo</label>
                        <input style={s.input} value={editando.cargo || ''}
                          onChange={e => setEditando(ed => ({ ...ed, cargo: e.target.value }))}
                          placeholder="Ex: Montador Sênior" />
                      </div>
                      <div>
                        <label style={s.label}>Telefone</label>
                        <input style={s.input} value={editando.telefone || ''}
                          onChange={e => setEditando(ed => ({ ...ed, telefone: e.target.value }))} />
                      </div>
                      <div>
                        <label style={s.label}>Perfil</label>
                        <select style={s.input} value={editando.role}
                          onChange={e => setEditando(ed => ({ ...ed, role: e.target.value }))}>
                          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={editando.ativo !== false}
                          onChange={e => setEditando(ed => ({ ...ed, ativo: e.target.checked }))}
                          id={`ativo-${p.id}`} />
                        <label htmlFor={`ativo-${p.id}`} style={{ fontSize: 13, color: '#666', cursor: 'pointer' }}>
                          Usuário ativo
                        </label>
                      </div>
                    </div>
                    <div style={s.editActions}>
                      <button style={s.btnCancel} onClick={() => setEditando(null)}>Cancelar</button>
                      <button style={s.btnSaveSmall} onClick={() => salvarEdicao(p.id)} disabled={salvando}>
                        {salvando ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={s.itemRow}>
                    <div style={{ ...s.avatar, background: cor + '18', color: cor }}>{initials}</div>
                    <div style={s.itemInfo}>
                      <div style={s.itemName}>{p.full_name || '—'}</div>
                      {p.cargo && <div style={s.itemCargo}>{p.cargo}</div>}
                      <div style={s.itemEmail}>{p.email}</div>
                      {p.telefone && <div style={s.itemEmail}>{p.telefone}</div>}
                      <div style={s.itemBadges}>
                        <span style={{ ...s.badge, background: cor + '18', color: cor }}>{ROLE_LABEL[p.role] || p.role}</span>
                        <span style={{ ...s.badge, background: ativo ? '#edf7f0' : '#f5f5f5', color: ativo ? '#3a7d4f' : '#aaa' }}>
                          {ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>
                    <div style={s.itemActions}>
                      <button style={s.btnEdit} onClick={() => setEditando({ ...p })}>Editar</button>
                      <button style={{ ...s.btnEdit, color: ativo ? '#d94a4a' : '#3a7d4f' }}
                        onClick={() => toggleAtivo(p)}>
                        {ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
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
  filters: { display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  filterBtn: { padding: '6px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer' },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  item: { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: '18px 22px' },
  itemRow: { display: 'flex', alignItems: 'center', gap: 14 },
  avatar: { width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 },
  itemInfo: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' },
  itemCargo: { fontSize: 11, color: '#aaa', marginTop: 1 },
  itemEmail: { fontSize: 12, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemBadges: { display: 'flex', gap: 6, marginTop: 6 },
  badge: { fontSize: 10, padding: '2px 10px', borderRadius: 20, fontWeight: 600 },
  itemActions: { display: 'flex', gap: 8, flexShrink: 0 },
  btnEdit: { background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--color-ink-muted)' },
  editGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 },
  editActions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  label: { display: 'block', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: '#888', marginBottom: 5 },
  input: { width: '100%', border: '1px solid #e0dbd4', borderRadius: 7, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', background: '#fafaf8', outline: 'none', boxSizing: 'border-box' },
  btnCancel: { background: 'none', border: '1px solid #e0dbd4', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', color: '#888' },
  btnSaveSmall: { background: 'var(--color-blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  empty: { textAlign: 'center', padding: '40px 0', color: '#bbb' },
  emptyBox: { textAlign: 'center', padding: '60px 20px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#aaa', marginBottom: 20 },
}

const ms = {
  bg: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  box: { background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 28px 0', flexShrink: 0 },
  title: { fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 500, margin: 0 },
  close: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999' },
  body: { overflowY: 'auto', padding: '20px 28px', flex: 1 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  full: { gridColumn: '1/-1' },
  label: { display: 'block', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: '#888', marginBottom: 6 },
  input: { width: '100%', border: '1px solid #e0dbd4', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', color: 'var(--color-ink)', background: '#fafaf8', outline: 'none', boxSizing: 'border-box' },
  roleGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 },
  roleCard: { padding: '12px 14px', borderRadius: 10, cursor: 'pointer', transition: 'all .15s' },
  erro: { background: '#fceee9', borderLeft: '3px solid #c4421e', color: '#5c2010', padding: '10px 14px', borderRadius: 6, fontSize: 12, marginBottom: 16 },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 28px', borderTop: '1px solid #f0ece6', flexShrink: 0 },
  btnCancel: { background: 'none', border: '1px solid #e0dbd4', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', color: '#888' },
  btnSave: { background: 'var(--color-blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
}