import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const ROLES = ['gestao', 'pos_venda', 'supervisor', 'montador', 'cliente']
const ROLE_LABEL = { gestao: 'Gestão', pos_venda: 'Pós-venda', supervisor: 'Supervisor', montador: 'Montador', vendedor: 'Pós-venda', cliente: 'Cliente' }
const ROLE_COLOR = { gestao: '#365C7D', pos_venda: '#7A5AA6', vendedor: '#7A5AA6', supervisor: '#3B5F86', montador: '#B8965E', cliente: '#8A8175' }
const ROLE_DESC = {
  gestao: 'Obras, agenda, equipe e relatórios',
  pos_venda: 'Acompanhamento comercial das obras',
  supervisor: 'Obras sob sua responsabilidade',
  montador: 'Tarefas e check-in/check-out',
  cliente: 'Portal do cliente',
}

export default function Equipe() {
  const [profiles, setProfiles] = useState([])
  const [obras, setObras] = useState([])
  const [vinculos, setVinculos] = useState([])
  const [supervisores, setSupervisores] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [editando, setEditando] = useState(null)
  const [modal, setModal] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [toast, setToast] = useState({ msg: '', tipo: 'sucesso' })

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const [{ data: pr }, { data: ob }, { data: vm }] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('obras').select('id, nome, supervisor_id, comercial_id'),
      supabase.from('obra_montadores').select('obra_id, montador_id'),
    ])
    setProfiles(pr || [])
    setObras(ob || [])
    setVinculos(vm || [])
    setSupervisores((pr || []).filter(p => p.role === 'supervisor'))
    setLoading(false)
  }

  function mostrarToast(msg, tipo = 'sucesso') {
    setToast({ msg, tipo })
    setTimeout(() => setToast({ msg: '', tipo: 'sucesso' }), 3200)
  }

  async function salvarEdicao() {
    if (!editando) return
    setSalvando(true)
    const { error } = await supabase.from('profiles').update({
      full_name: editando.full_name,
      role: editando.role,
      cargo: editando.cargo || null,
      telefone: editando.telefone || null,
      supervisor_id: editando.role === 'montador' ? (editando.supervisor_id || null) : null,
      ativo: editando.ativo,
    }).eq('id', editando.id)

    if (error) mostrarToast('Erro ao salvar. Tente novamente.', 'erro')
    else {
      mostrarToast(`Perfil de ${editando.full_name} atualizado.`)
      setEditando(null)
      await carregar()
    }
    setSalvando(false)
  }

  async function toggleAtivo(p) {
    await supabase.from('profiles').update({ ativo: !p.ativo }).eq('id', p.id)
    mostrarToast(`${p.full_name || 'Usuário'} ${p.ativo ? 'desativado' : 'ativado'}.`)
    await carregar()
  }

  async function excluir(p) {
    if (!window.confirm('Excluir o usuário ' + (p.full_name || p.email) + '? Esta ação não pode ser desfeita.')) return
    await supabase.from('profiles').delete().eq('id', p.id)
    mostrarToast(`${p.full_name || 'Usuário'} removido da equipe.`)
    await carregar()
  }

  const lista = filtro === 'todos' ? profiles : profiles.filter(p => p.role === filtro)
  const kpis = [
    { label: 'Gestão', value: profiles.filter(p => p.role === 'gestao').length },
    { label: 'Supervisores', value: profiles.filter(p => p.role === 'supervisor').length },
    { label: 'Montadores', value: profiles.filter(p => p.role === 'montador').length },
    { label: 'Pós-venda', value: profiles.filter(p => ['pos_venda', 'vendedor'].includes(p.role)).length },
  ]

  function obrasVinculadas(profile) {
    if (profile.role === 'montador') {
      const ids = new Set(vinculos.filter(v => v.montador_id === profile.id).map(v => v.obra_id))
      return obras.filter(o => ids.has(o.id))
    }
    if (profile.role === 'supervisor') return obras.filter(o => o.supervisor_id === profile.id)
    if (['pos_venda', 'vendedor'].includes(profile.role)) return obras.filter(o => o.comercial_id === profile.id)
    return []
  }

  return (
    <div className="ow-page" style={s.page}>
      {toast.msg && <Toast msg={toast.msg} tipo={toast.tipo} />}
      {modal && <ModalNovoUsuario supervisores={supervisores} onClose={() => setModal(false)} onSaved={() => { setModal(false); carregar(); mostrarToast('Novo usuário criado com sucesso.') }} />}

      <div style={s.header}>
        <div>
          <div style={s.breadcrumb}>Gestão</div>
          <h1 style={s.title}>Central de Equipe</h1>
          <p style={s.sub}>{profiles.length} membro{profiles.length !== 1 ? 's' : ''} · {profiles.filter(p => p.ativo !== false).length} ativos</p>
        </div>
        <button style={s.btnNew} onClick={() => setModal(true)}>+ Novo Usuário</button>
      </div>

      <div style={s.kpiGrid}>
        {kpis.map(k => (
          <div key={k.label} style={s.kpi}>
            <span style={s.kpiLabel}>{k.label}</span>
            <strong style={s.kpiValue}>{loading ? '-' : k.value}</strong>
          </div>
        ))}
      </div>

      <div style={s.filters}>
        {['todos', ...ROLES].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            ...s.filterBtn,
            background: filtro === f ? 'var(--color-ink)' : '#fff',
            color: filtro === f ? '#f9f7f4' : 'var(--color-ink-muted)',
            border: filtro === f ? 'none' : '1px solid var(--color-border)',
          }}>
            {f === 'todos' ? 'Todos' : ROLE_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={s.empty}>Carregando...</div>
      ) : lista.length === 0 ? (
        <div style={s.emptyBox}>
          <div style={s.emptyIcon}>Equipe</div>
          <div style={s.emptyTitle}>Nenhum membro encontrado</div>
          <button style={s.btnNew} onClick={() => setModal(true)}>+ Criar Primeiro Usuário</button>
        </div>
      ) : (
        <div style={s.gridList}>
          {lista.map(p => {
            const cor = ROLE_COLOR[p.role] || '#888'
            const ativo = p.ativo !== false
            const initials = (p.full_name || p.email || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
            const obrasPessoa = obrasVinculadas(p)
            const isEditando = editando?.id === p.id

            return (
              <section key={p.id} style={{ ...s.card, opacity: ativo ? 1 : 0.62, borderTopColor: cor }}>
                {isEditando ? (
                  <EditForm
                    editando={editando}
                    setEditando={setEditando}
                    supervisores={supervisores}
                    salvando={salvando}
                    onSalvar={salvarEdicao}
                    onCancelar={() => setEditando(null)}
                  />
                ) : (
                  <>
                    <div style={s.cardTop}>
                      <div style={{ ...s.avatar, background: cor + '18', color: cor }}>{initials}</div>
                      <div style={s.personInfo}>
                        <strong style={s.personName}>{p.full_name || 'Sem nome'}</strong>
                        <span style={s.personMeta}>{p.cargo || p.email || 'Sem cargo informado'}</span>
                      </div>
                    </div>
                    <div style={s.badgeRow}>
                      <span style={{ ...s.badge, background: cor + '18', color: cor }}>{ROLE_LABEL[p.role] || p.role}</span>
                      <span style={{ ...s.badge, background: ativo ? '#EAF5EE' : '#F5F1EA', color: ativo ? '#2D7A4A' : '#8A8175' }}>{ativo ? 'Ativo' : 'Inativo'}</span>
                    </div>
                    <div style={s.detailLine}>{p.telefone || 'Telefone não informado'}</div>
                    <div style={s.detailLine}>{obrasPessoa.length ? `${obrasPessoa.length} obra${obrasPessoa.length === 1 ? '' : 's'} vinculada${obrasPessoa.length === 1 ? '' : 's'}` : 'Sem obras vinculadas'}</div>
                    <div style={s.actions}>
                      <button style={s.btnEdit} onClick={() => setEditando({ ...p })}>Editar</button>
                      <button style={s.btnEdit} onClick={() => toggleAtivo(p)}>{ativo ? 'Desativar' : 'Ativar'}</button>
                      <button style={{ ...s.btnEdit, color: '#B84040', borderColor: '#F0C8C8' }} onClick={() => excluir(p)}>Excluir</button>
                    </div>
                  </>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Toast({ msg, tipo }) {
  return <div style={{ ...s.toast, background: tipo === 'erro' ? '#fdecea' : 'var(--color-ink)', color: tipo === 'erro' ? '#B84040' : '#fff' }}>{msg}</div>
}

function EditForm({ editando, setEditando, supervisores, salvando, onSalvar, onCancelar }) {
  const set = (k, v) => setEditando(p => ({ ...p, [k]: v }))
  return (
    <div>
      <div style={s.editGrid}>
        <Field label="Nome"><input style={s.input} value={editando.full_name || ''} onChange={e => set('full_name', e.target.value)} /></Field>
        <Field label="Cargo"><input style={s.input} value={editando.cargo || ''} onChange={e => set('cargo', e.target.value)} /></Field>
        <Field label="Telefone"><input style={s.input} value={editando.telefone || ''} onChange={e => set('telefone', e.target.value)} /></Field>
        <Field label="Perfil">
          <select style={s.input} value={editando.role} onChange={e => set('role', e.target.value)}>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </Field>
        {editando.role === 'montador' && (
          <Field label="Supervisor">
            <select style={s.input} value={editando.supervisor_id || ''} onChange={e => set('supervisor_id', e.target.value)}>
              <option value="">Sem supervisor</option>
              {supervisores.map(sv => <option key={sv.id} value={sv.id}>{sv.full_name}</option>)}
            </select>
          </Field>
        )}
      </div>
      <label style={s.checkLine}>
        <input type="checkbox" checked={editando.ativo !== false} onChange={e => set('ativo', e.target.checked)} />
        Usuário ativo
      </label>
      <div style={s.actions}>
        <button style={s.btnEdit} onClick={onCancelar}>Cancelar</button>
        <button style={{ ...s.btnEdit, background: 'var(--color-gold)', color: '#fff', borderColor: 'var(--color-gold)' }} onClick={onSalvar} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  )
}

function ModalNovoUsuario({ supervisores, onClose, onSaved }) {
  const [form, setForm] = useState({ full_name: '', email: '', senha: '', role: 'montador', cargo: '', telefone: '', supervisor_id: '' })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function salvar() {
    if (!form.full_name || !form.email || !form.senha) { setErro('Preencha nome, e-mail e senha.'); return }
    if (form.senha.length < 6) { setErro('Senha mínima de 6 caracteres.'); return }
    setSaving(true)
    setErro('')
    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.senha, options: { data: { full_name: form.full_name } } })
    if (error) { setErro(error.message); setSaving(false); return }
    if (data?.user) {
      await new Promise(r => setTimeout(r, 1200))
      await supabase.from('profiles').update({
        full_name: form.full_name,
        role: form.role,
        cargo: form.cargo || null,
        telefone: form.telefone || null,
        supervisor_id: form.role === 'montador' ? (form.supervisor_id || null) : null,
        ativo: true,
      }).eq('id', data.user.id)
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div style={s.modalBg} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.modalHead}>
          <h2>Novo Usuário</h2>
          <button onClick={onClose}>X</button>
        </div>
        <div style={s.modalBody}>
          {erro && <div style={s.error}>{erro}</div>}
          <div style={s.editGrid}>
            <Field label="Nome completo"><input style={s.input} value={form.full_name} onChange={e => set('full_name', e.target.value)} /></Field>
            <Field label="E-mail"><input style={s.input} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
            <Field label="Senha inicial"><input style={s.input} value={form.senha} onChange={e => set('senha', e.target.value)} /></Field>
            <Field label="Cargo"><input style={s.input} value={form.cargo} onChange={e => set('cargo', e.target.value)} /></Field>
            <Field label="Telefone"><input style={s.input} value={form.telefone} onChange={e => set('telefone', e.target.value)} /></Field>
            <Field label="Perfil">
              <select style={s.input} value={form.role} onChange={e => set('role', e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </Field>
            {form.role === 'montador' && (
              <Field label="Supervisor responsável">
                <select style={s.input} value={form.supervisor_id} onChange={e => set('supervisor_id', e.target.value)}>
                  <option value="">Sem supervisor</option>
                  {supervisores.map(sv => <option key={sv.id} value={sv.id}>{sv.full_name}</option>)}
                </select>
              </Field>
            )}
          </div>
          <div style={s.roleHint}>{ROLE_DESC[form.role]}</div>
        </div>
        <div style={s.modalFoot}>
          <button style={s.btnEdit} onClick={onClose}>Cancelar</button>
          <button style={{ ...s.btnEdit, background: 'var(--color-gold)', color: '#fff', borderColor: 'var(--color-gold)' }} onClick={salvar} disabled={saving}>
            {saving ? 'Criando...' : 'Criar Usuário'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return <label style={s.field}><span>{label}</span>{children}</label>
}

const s = {
  page: { padding: '32px 40px', maxWidth: 1180, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, gap: 18 },
  breadcrumb: { fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 6, fontWeight: 800 },
  title: { fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 500, color: 'var(--color-ink)', margin: 0, lineHeight: 1.05 },
  sub: { fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 6 },
  btnNew: { background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 20 },
  kpi: { background: '#fff', border: '1px solid var(--color-border)', borderTop: '3px solid var(--color-gold)', borderRadius: 14, padding: '15px 16px', boxShadow: 'var(--shadow)' },
  kpiLabel: { display: 'block', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--color-gold)', fontWeight: 800, marginBottom: 8 },
  kpiValue: { display: 'block', fontSize: 30, lineHeight: 1, color: 'var(--color-ink)' },
  filters: { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  filterBtn: { padding: '7px 16px', borderRadius: 999, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 },
  gridList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 },
  card: { background: '#fff', border: '1px solid var(--color-border)', borderTop: '3px solid var(--color-gold)', borderRadius: 16, padding: 18, boxShadow: 'var(--shadow)', minWidth: 0 },
  cardTop: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 },
  personInfo: { minWidth: 0, flex: 1 },
  personName: { display: 'block', fontSize: 14.5, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  personMeta: { display: 'block', fontSize: 12, color: 'var(--color-ink-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  badgeRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  badge: { fontSize: 10, padding: '3px 9px', borderRadius: 999, fontWeight: 800 },
  detailLine: { fontSize: 12, color: 'var(--color-ink-muted)', padding: '6px 0', borderTop: '1px solid var(--color-border)' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 },
  btnEdit: { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 9, padding: '8px 13px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--color-ink-muted)' },
  empty: { textAlign: 'center', padding: '40px 0', color: '#aaa' },
  emptyBox: { textAlign: 'center', padding: '44px 18px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 16, boxShadow: 'var(--shadow)' },
  emptyIcon: { fontSize: 13, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: 'var(--color-ink)', marginBottom: 18 },
  editGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10, letterSpacing: 1.3, textTransform: 'uppercase', color: 'var(--color-ink-muted)', fontWeight: 800 },
  input: { width: '100%', border: '1px solid var(--color-border)', borderRadius: 9, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', color: 'var(--color-ink)', background: '#FFFEFC', outline: 'none', boxSizing: 'border-box' },
  checkLine: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: 'var(--color-ink-muted)' },
  toast: { position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', padding: '12px 22px', borderRadius: 12, fontSize: 13, fontWeight: 800, borderLeft: '3px solid var(--color-gold)', zIndex: 2000, boxShadow: 'var(--shadow-md)', maxWidth: 'calc(100vw - 24px)' },
  modalBg: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.42)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 24px 0' },
  modalBody: { overflowY: 'auto', padding: 24 },
  modalFoot: { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--color-border)' },
  error: { background: '#fdecea', color: '#B84040', borderLeft: '3px solid #B84040', padding: '10px 12px', borderRadius: 8, fontSize: 12, marginBottom: 14 },
  roleHint: { marginTop: 14, color: 'var(--color-ink-muted)', fontSize: 12, background: '#F9F6F0', border: '1px solid var(--color-border)', borderRadius: 10, padding: 12 },
}
