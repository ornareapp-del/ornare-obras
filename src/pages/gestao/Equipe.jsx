import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const ROLES = ['gestao', 'pos_venda', 'supervisor', 'montador', 'cliente']
const ROLE_LABEL = { gestao: 'Gestao', pos_venda: 'Pos-venda', supervisor: 'Supervisor', montador: 'Montador', vendedor: 'Pos-venda', cliente: 'Cliente' }
const ROLE_COLOR = { gestao: '#3a5580', pos_venda: '#9070c0', supervisor: '#3a7d4f', montador: '#b09a7a', vendedor: '#9070c0', cliente: '#888' }
const ROLE_DESC  = {
  gestao:     'Obras, agenda, equipe e relatorios',
  pos_venda:  'Acompanhamento comercial das obras',
  supervisor: 'Obras sob sua responsabilidade',
  montador:   'Tarefas e check-in/check-out',
  cliente:    'Portal do cliente (acesso externo)',
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ msg, tipo = 'sucesso' }) {
  if (!msg) return null
  const bg = tipo === 'erro' ? '#fdecea' : '#1A1A18'
  const cor = tipo === 'erro' ? '#a03030' : '#fff'
  const borda = tipo === 'erro' ? '#d94a4a' : '#C8A86A'
  return (
    <div style={{
      position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      background: bg, color: cor,
      padding: '12px 24px', borderRadius: 10,
      fontSize: 13, fontWeight: 600,
      borderLeft: '3px solid ' + borda,
      boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
      zIndex: 2000, whiteSpace: 'nowrap',
      animation: 'fadeInUp 0.2s ease',
    }}>
      {msg}
    </div>
  )
}

// ─── MODAL NOVO USUARIO ───────────────────────────────────────────────────────
function ModalNovoUsuario({ onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: '', email: '', senha: '', role: 'montador',
    cargo: '', telefone: '', supervisor_id: '',
  })
  const [supervisores, setSupervisores] = useState([])
  const [saving,  setSaving]  = useState(false)
  const [erro,    setErro]    = useState('')
  const [ok,      setOk]      = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').eq('role', 'supervisor')
      .then(({ data }) => setSupervisores(data || []))
  }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function salvar() {
    if (!form.full_name || !form.email || !form.senha) { setErro('Preencha nome, e-mail e senha.'); return }
    if (form.senha.length < 6) { setErro('Senha minima de 6 caracteres.'); return }
    setSaving(true); setErro('')

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.senha,
      options: { data: { full_name: form.full_name } },
    })
    if (error) { setErro(error.message); setSaving(false); return }

    if (data?.user) {
      await new Promise(r => setTimeout(r, 1500))
      await supabase.from('profiles').update({
        full_name:   form.full_name,
        role:        form.role,
        cargo:       form.cargo || null,
        telefone:    form.telefone || null,
        supervisor_id: form.role === 'montador' ? (form.supervisor_id || null) : null,
        ativo:       true,
      }).eq('id', data.user.id)
    }
    setOk(true); setSaving(false)
  }

  if (ok) return (
    <div style={ms.bg}>
      <div style={{ ...ms.box, textAlign: 'center', padding: '48px 32px' }}>
        <div style={{ fontSize: 44, color: '#C8A86A', marginBottom: 12 }}>✓</div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, marginBottom: 8, color: 'var(--color-ink)' }}>Usuario criado!</h2>
        <div style={{ background: '#f9f7f4', border: '1px solid var(--color-border)', borderRadius: 8, padding: '12px 16px', fontSize: 13, marginBottom: 24, textAlign: 'left' }}>
          <div style={{ marginBottom: 4 }}><strong>E-mail:</strong> {form.email}</div>
          <div style={{ marginBottom: 4 }}><strong>Senha:</strong> {form.senha}</div>
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
          <h2 style={ms.title}>Novo Usuario</h2>
          <button style={ms.close} onClick={onClose}>✕</button>
        </div>
        <div style={ms.body}>
          {erro && <div style={ms.erro}>{erro}</div>}
          <div style={ms.grid}>
            <div style={ms.full}>
              <label style={ms.label}>Nome completo *</label>
              <input style={ms.input} value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Nome do usuario" />
            </div>
            <div>
              <label style={ms.label}>E-mail *</label>
              <input style={ms.input} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div>
              <label style={ms.label}>Senha inicial *</label>
              <input style={ms.input} type="text" value={form.senha} onChange={e => set('senha', e.target.value)} placeholder="Minimo 6 caracteres" />
            </div>
            <div>
              <label style={ms.label}>Cargo</label>
              <input style={ms.input} value={form.cargo} onChange={e => set('cargo', e.target.value)} placeholder="Ex: Montador Senior" />
            </div>
            <div>
              <label style={ms.label}>Telefone</label>
              <input style={ms.input} value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="(48) 99999-9999" />
            </div>
            <div style={ms.full}>
              <label style={ms.label}>Perfil de acesso *</label>
              <div style={ms.roleGrid}>
                {ROLES.map(r => (
                  <div key={r} onClick={() => set('role', r)} style={{
                    ...ms.roleCard,
                    border: form.role === r ? '2px solid ' + ROLE_COLOR[r] : '1px solid var(--color-border)',
                    background: form.role === r ? ROLE_COLOR[r] + '12' : '#fafaf8',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: form.role === r ? ROLE_COLOR[r] : 'var(--color-ink)', marginBottom: 3 }}>{ROLE_LABEL[r]}</div>
                    <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.4 }}>{ROLE_DESC[r]}</div>
                  </div>
                ))}
              </div>
            </div>
            {form.role === 'montador' && supervisores.length > 0 && (
              <div style={ms.full}>
                <label style={ms.label}>Supervisor responsavel</label>
                <select style={ms.input} value={form.supervisor_id} onChange={e => set('supervisor_id', e.target.value)}>
                  <option value="">-- Selecione --</option>
                  {supervisores.map(sv => <option key={sv.id} value={sv.id}>{sv.full_name}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
        <div style={ms.footer}>
          <button style={ms.btnCancel} onClick={onClose}>Cancelar</button>
          <button style={ms.btnSave} onClick={salvar} disabled={saving}>
            {saving ? 'Criando...' : 'Criar Usuario'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── DIALOG DE DESCARTE ───────────────────────────────────────────────────────
function DialogDescarte({ onDescartar, onContinuar }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '28px 28px 22px', maxWidth: 360, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 8 }}>Descartar alteracoes?</div>
        <div style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginBottom: 24, lineHeight: 1.6 }}>
          Voce fez alteracoes que ainda nao foram salvas. Deseja descartar e fechar?
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button style={s.btnCancel} onClick={onContinuar}>Continuar editando</button>
          <button style={{ ...s.btnSaveSmall, background: '#d94a4a' }} onClick={onDescartar}>Descartar</button>
        </div>
      </div>
    </div>
  )
}

// ─── LINHA DE EDICAO INLINE ───────────────────────────────────────────────────
function ItemEditando({ editando, setEditando, supervisores, onSalvar, onCancelar, salvando }) {
  const [original] = useState(() => JSON.stringify(editando))
  const [showDialog, setShowDialog] = useState(false)

  // dirty state: verifica se ha mudancas em relacao ao original
  const isDirty = JSON.stringify(editando) !== original

  function tentarCancelar() {
    if (isDirty) { setShowDialog(true) } else { onCancelar() }
  }

  return (
    <>
      {showDialog && (
        <DialogDescarte
          onDescartar={onCancelar}
          onContinuar={() => setShowDialog(false)}
        />
      )}
      <div>
        {/* indicador de edicao nao salva */}
        {isDirty && (
          <div style={s.dirtyBanner}>
            <span style={s.dirtyDot} />
            Alteracoes nao salvas
          </div>
        )}
        <div style={s.editGrid}>
          <div>
            <label style={s.label}>Nome</label>
            <input style={s.input} value={editando.full_name || ''} onChange={e => setEditando(ed => ({ ...ed, full_name: e.target.value }))} />
          </div>
          <div>
            <label style={s.label}>Cargo</label>
            <input style={s.input} value={editando.cargo || ''} onChange={e => setEditando(ed => ({ ...ed, cargo: e.target.value }))} placeholder="Ex: Montador Senior" />
          </div>
          <div>
            <label style={s.label}>Telefone</label>
            <input style={s.input} value={editando.telefone || ''} onChange={e => setEditando(ed => ({ ...ed, telefone: e.target.value }))} />
          </div>
          <div>
            <label style={s.label}>Perfil de acesso</label>
            <select style={s.input} value={editando.role} onChange={e => setEditando(ed => ({ ...ed, role: e.target.value }))}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          {editando.role === 'montador' && (
            <div style={{ gridColumn: '1/-1' }}>
              <label style={s.label}>Supervisor responsavel</label>
              <select style={s.input} value={editando.supervisor_id || ''} onChange={e => setEditando(ed => ({ ...ed, supervisor_id: e.target.value }))}>
                <option value="">-- Selecione --</option>
                {supervisores.map(sv => <option key={sv.id} value={sv.id}>{sv.full_name}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={editando.ativo !== false}
              onChange={e => setEditando(ed => ({ ...ed, ativo: e.target.checked }))}
              id={'ativo-' + editando.id}
              style={{ accentColor: 'var(--color-gold)', width: 15, height: 15 }}
            />
            <label htmlFor={'ativo-' + editando.id} style={{ fontSize: 13, color: '#666', cursor: 'pointer' }}>
              Usuario ativo
            </label>
          </div>
        </div>
        <div style={s.editActions}>
          <button style={s.btnCancel} onClick={tentarCancelar}>Cancelar</button>
          <button
            style={{ ...s.btnSaveSmall, opacity: isDirty ? 1 : 0.5, cursor: isDirty ? 'pointer' : 'default' }}
            onClick={onSalvar}
            disabled={salvando || !isDirty}
          >
            {salvando ? 'Salvando...' : 'Salvar alteracoes'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── PAGINA EQUIPE ────────────────────────────────────────────────────────────
export default function Equipe() {
  const [profiles,    setProfiles]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [filtro,      setFiltro]      = useState('todos')
  const [editando,    setEditando]    = useState(null)
  const [salvando,    setSalvando]    = useState(false)
  const [modal,       setModal]       = useState(false)
  const [supervisores,setSupervisores]= useState([])
  const [toast,       setToast]       = useState({ msg: '', tipo: 'sucesso' })

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setProfiles(data || [])
    setSupervisores((data || []).filter(p => p.role === 'supervisor'))
    setLoading(false)
  }

  function mostrarToast(msg, tipo = 'sucesso') {
    setToast({ msg, tipo })
    setTimeout(() => setToast({ msg: '', tipo: 'sucesso' }), 3500)
  }

  async function salvarEdicao(id) {
    setSalvando(true)
    const { error } = await supabase.from('profiles').update({
      full_name:    editando.full_name,
      role:         editando.role,
      cargo:        editando.cargo       || null,
      telefone:     editando.telefone    || null,
      supervisor_id: editando.role === 'montador' ? (editando.supervisor_id || null) : null,
      ativo:        editando.ativo,
    }).eq('id', id)

    if (error) {
      mostrarToast('Erro ao salvar. Tente novamente.', 'erro')
    } else {
      mostrarToast(`Perfil de ${editando.full_name} atualizado com sucesso.`)
      setEditando(null)
      await carregar()
    }
    setSalvando(false)
  }

  async function toggleAtivo(p) {
    await supabase.from('profiles').update({ ativo: !p.ativo }).eq('id', p.id)
    mostrarToast(`${p.full_name} ${p.ativo ? 'desativado' : 'ativado'}.`)
    await carregar()
  }

  async function excluir(p) {
    if (!window.confirm('Excluir o usuario ' + p.full_name + '? Esta acao nao pode ser desfeita.')) return
    await supabase.from('profiles').delete().eq('id', p.id)
    mostrarToast(`${p.full_name} removido da equipe.`)
    await carregar()
  }

  const lista = filtro === 'todos' ? profiles : profiles.filter(p => p.role === filtro)

  return (
    <div style={s.page}>
      <Toast msg={toast.msg} tipo={toast.tipo} />

      {modal && (
        <ModalNovoUsuario
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); carregar(); mostrarToast('Novo usuario criado com sucesso.') }}
        />
      )}

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div style={s.header}>
        <div>
          <div style={s.breadcrumb}>Gestao</div>
          <h1 style={s.title}>Equipe</h1>
          <p style={s.sub}>
            {profiles.length} membro{profiles.length !== 1 ? 's' : ''} · {profiles.filter(p => p.ativo !== false).length} ativos
          </p>
        </div>
        <button style={s.btnNew} onClick={() => setModal(true)}>+ Novo Usuario</button>
      </div>

      {/* ── FILTROS ─────────────────────────────────────────────────────────── */}
      <div style={s.filters}>
        {['todos', ...ROLES].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            ...s.filterBtn,
            background: filtro === f ? 'var(--color-ink)' : '#fff',
            color:      filtro === f ? '#f9f7f4' : 'var(--color-ink-muted)',
            border:     filtro === f ? 'none' : '1px solid var(--color-border)',
          }}>
            {f === 'todos' ? 'Todos' : ROLE_LABEL[f]}
          </button>
        ))}
      </div>

      {/* ── LISTA ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={s.empty}>Carregando...</div>
      ) : lista.length === 0 ? (
        <div style={s.emptyBox}>
          <div style={s.emptyIcon}>👥</div>
          <div style={s.emptyTitle}>Nenhum membro encontrado</div>
          <button style={s.btnNew} onClick={() => setModal(true)}>+ Criar Primeiro Usuario</button>
        </div>
      ) : (
        <div style={s.list}>
          {lista.map(p => {
            const cor      = ROLE_COLOR[p.role] || '#888'
            const ativo    = p.ativo !== false
            const initials = (p.full_name || p.email || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
            const isEditando = editando?.id === p.id
            const supNome  = supervisores.find(sv => sv.id === p.supervisor_id)?.full_name

            return (
              <div key={p.id} style={{ ...s.item, opacity: ativo ? 1 : 0.6, borderLeft: isEditando ? '3px solid var(--color-gold)' : '1px solid var(--color-border)' }}>
                {isEditando ? (
                  <ItemEditando
                    editando={editando}
                    setEditando={setEditando}
                    supervisores={supervisores}
                    onSalvar={() => salvarEdicao(p.id)}
                    onCancelar={() => setEditando(null)}
                    salvando={salvando}
                  />
                ) : (
                  <div style={s.itemRow}>
                    {/* avatar */}
                    <div style={{ ...s.avatar, background: cor + '18', color: cor }}>{initials}</div>

                    {/* info */}
                    <div style={s.itemInfo}>
                      <div style={s.itemName}>{p.full_name || '-'}</div>
                      {p.cargo    && <div style={s.itemCargo}>{p.cargo}</div>}
                      <div style={s.itemEmail}>{p.email}</div>
                      {p.telefone && <div style={s.itemEmail}>{p.telefone}</div>}
                      {supNome    && <div style={{ ...s.itemEmail, color: '#3a7d4f' }}>Supervisor: {supNome}</div>}
                      <div style={s.itemBadges}>
                        <span style={{ ...s.badge, background: cor + '18', color: cor }}>{ROLE_LABEL[p.role] || p.role}</span>
                        <span style={{ ...s.badge, background: ativo ? '#edf7f0' : '#f5f5f5', color: ativo ? '#3a7d4f' : '#aaa' }}>
                          {ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>

                    {/* acoes */}
                    <div style={s.itemActions}>
                      <button style={s.btnEdit} onClick={() => setEditando({ ...p })}>Editar</button>
                      <button style={{ ...s.btnEdit, color: ativo ? '#d94a4a' : '#3a7d4f' }} onClick={() => toggleAtivo(p)}>
                        {ativo ? 'Desativar' : 'Ativar'}
                      </button>
                      <button style={{ ...s.btnEdit, color: '#d94a4a', borderColor: '#fdecea' }} onClick={() => excluir(p)}>
                        Excluir
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

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const s = {
  page:       { padding: '32px 40px', maxWidth: 1000, margin: '0 auto' },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  breadcrumb: { fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 6 },
  title:      { fontFamily: 'var(--font-serif)', fontSize: 36, fontWeight: 500, color: 'var(--color-ink)', margin: 0 },
  sub:        { fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 4 },
  btnNew:     { background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  filters:    { display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  filterBtn:  { padding: '6px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  list:       { display: 'flex', flexDirection: 'column', gap: 10 },

  item:       { background: '#fff', borderRadius: 12, padding: '18px 22px', transition: 'border-color 0.2s' },
  itemRow:    { display: 'flex', alignItems: 'center', gap: 14 },
  avatar:     { width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 },
  itemInfo:   { flex: 1, minWidth: 0 },
  itemName:   { fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' },
  itemCargo:  { fontSize: 11, color: '#aaa', marginTop: 1 },
  itemEmail:  { fontSize: 12, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemBadges: { display: 'flex', gap: 6, marginTop: 6 },
  badge:      { fontSize: 10, padding: '2px 10px', borderRadius: 20, fontWeight: 600 },
  itemActions:{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' },
  btnEdit:    { background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--color-ink-muted)', fontFamily: 'inherit' },

  // edicao inline
  dirtyBanner:{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#b09a7a', background: '#fdf8f0', border: '1px solid #e8d9b8', borderRadius: 7, padding: '6px 12px', marginBottom: 14 },
  dirtyDot:   { width: 7, height: 7, borderRadius: '50%', background: '#C8A86A', flexShrink: 0 },
  editGrid:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 },
  editActions:{ display: 'flex', gap: 10, justifyContent: 'flex-end' },
  label:      { display: 'block', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: '#888', marginBottom: 5 },
  input:      { width: '100%', border: '1px solid #e0dbd4', borderRadius: 7, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', background: '#fafaf8', outline: 'none', boxSizing: 'border-box' },
  btnCancel:  { background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', color: '#888', fontFamily: 'inherit' },
  btnSaveSmall:{ background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },

  empty:      { textAlign: 'center', padding: '40px 0', color: '#bbb' },
  emptyBox:   { textAlign: 'center', padding: '60px 20px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12 },
  emptyIcon:  { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 20 },
}

const ms = {
  bg:       { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  box:      { background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' },
  header:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 28px 0', flexShrink: 0 },
  title:    { fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 500, margin: 0 },
  close:    { background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#999', padding: 4 },
  body:     { overflowY: 'auto', padding: '20px 28px', flex: 1 },
  grid:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  full:     { gridColumn: '1/-1' },
  label:    { display: 'block', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: '#888', marginBottom: 6 },
  input:    { width: '100%', border: '1px solid #e0dbd4', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', color: 'var(--color-ink)', background: '#fafaf8', outline: 'none', boxSizing: 'border-box' },
  roleGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 },
  roleCard: { padding: '12px 14px', borderRadius: 10, cursor: 'pointer', transition: 'all .15s' },
  erro:     { background: '#fceee9', borderLeft: '3px solid #c4421e', color: '#5c2010', padding: '10px 14px', borderRadius: 6, fontSize: 12, marginBottom: 16 },
  footer:   { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 28px', borderTop: '1px solid #f0ece6', flexShrink: 0 },
  btnCancel:{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', color: '#888', fontFamily: 'inherit' },
  btnSave:  { background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
}
