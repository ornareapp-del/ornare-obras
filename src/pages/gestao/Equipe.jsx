import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { theme } from '../../constants/theme'
import { logError } from '../../services/logService'

const ROLES = ['gestao', 'pos_venda', 'vendedor', 'supervisor', 'montador', 'cliente']
const ROLE_LABEL = { gestao: 'Gestão', pos_venda: 'Pós-venda', vendedor: 'Vendedor', supervisor: 'Supervisor', montador: 'Montador', cliente: 'Cliente' }
const ROLE_COLOR = {
  gestao: theme.status.info,
  pos_venda: theme.status.purple,
  vendedor: theme.status.purple,
  supervisor: theme.status.info,
  montador: theme.status.goldMuted,
  cliente: theme.app.muted,
}
const ROLE_DESC = {
  gestao: 'Obras, agenda, equipe e relatórios',
  pos_venda: 'Acompanhamento comercial das obras',
  vendedor: 'Atendimento comercial e acompanhamento das obras',
  supervisor: 'Obras sob sua responsabilidade',
  montador: 'Tarefas e check-in/check-out',
  cliente: 'Portal do cliente',
}

function detalheErro(error, fallback = 'Nao foi possivel concluir a operacao.') {
  return error?.message || error?.details || error?.hint || fallback
}

function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function normalizarBusca(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function redirectAcesso() {
  return `${window.location.origin}/login`
}

function gerarSenhaTemporaria() {
  const base = Math.random().toString(36).slice(2, 10)
  const extra = Date.now().toString(36).slice(-4)
  return `Ornare-${base}${extra}!`
}

async function enviarMagicLinkCliente(email) {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectAcesso(),
      shouldCreateUser: false,
    },
  })
}

export default function Equipe() {
  const { profile: perfilAtual } = useStore()
  const [profiles, setProfiles] = useState([])
  const [obras, setObras] = useState([])
  const [vinculos, setVinculos] = useState([])
  const [supervisores, setSupervisores] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [busca, setBusca] = useState('')
  const [visao, setVisao] = useState('cards')
  const [menuAberto, setMenuAberto] = useState(null)
  const [editando, setEditando] = useState(null)
  const [modal, setModal] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [toast, setToast] = useState({ msg: '', tipo: 'sucesso' })
  const roleAtual = perfilAtual?.role === 'vendedor' ? 'pos_venda' : perfilAtual?.role
  const supervisorAtual = roleAtual === 'supervisor'
  const rolesDisponiveis = supervisorAtual ? ['montador'] : ROLES

  const mostrarToast = useCallback((msg, tipo = 'sucesso') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast({ msg: '', tipo: 'sucesso' }), 3200)
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    const [profilesResult, obrasResult, vinculosResult] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('obras').select('id, nome, supervisor_id, comercial_id'),
      supabase.from('obra_montadores').select('obra_id, montador_id'),
    ])
    if (profilesResult.error || obrasResult.error || vinculosResult.error) {
      console.error('Erro ao carregar equipe:', {
        profiles: profilesResult.error,
        obras: obrasResult.error,
        vinculos: vinculosResult.error,
      })
      mostrarToast('Não foi possível carregar todos os dados da equipe.', 'erro')
    }

    setProfiles(profilesResult.data || [])
    setObras(obrasResult.data || [])
    setVinculos(vinculosResult.data || [])
    setSupervisores((profilesResult.data || []).filter(p => p.role === 'supervisor' || p.role === 'gestao'))
    setLoading(false)
  }, [mostrarToast])

  useEffect(() => {
    const timer = window.setTimeout(() => carregar(), 0)
    return () => window.clearTimeout(timer)
  }, [carregar])

  async function salvarEdicao() {
    if (!editando) return
    const nome = String(editando.full_name || '').trim()
    const role = supervisorAtual ? 'montador' : editando.role
    if (!nome) {
      mostrarToast('Informe o nome do usuario.', 'erro')
      return
    }
    if (!ROLES.includes(role)) {
      mostrarToast('Selecione um perfil valido.', 'erro')
      return
    }
    if (role === 'cliente' && !editando.obra_id) {
      mostrarToast('Selecione a obra vinculada ao cliente.', 'erro')
      return
    }
    setSalvando(true)
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: nome,
        role,
        cargo: editando.cargo || null,
        telefone: editando.telefone || null,
        supervisor_id: role === 'montador' ? (editando.supervisor_id || (supervisorAtual ? perfilAtual.id : null)) : null,
        obra_id: role === 'cliente' ? editando.obra_id : null,
        ativo: editando.ativo !== false,
      }).eq('id', editando.id)

      if (error) {
        mostrarToast(detalheErro(error, 'Erro ao salvar. Tente novamente.'), 'erro')
      } else {
        mostrarToast(`Perfil de ${nome} atualizado.`)
        setEditando(null)
        await carregar()
      }
    } catch (error) {
      mostrarToast(detalheErro(error, 'Erro inesperado ao salvar o perfil.'), 'erro')
    } finally {
      setSalvando(false)
    }
  }

  async function enviarResetSenha(profile) {
    if (!profile?.email) {
      mostrarToast('Este usuário não possui e-mail cadastrado.', 'erro')
      return
    }

    if (profile.role === 'cliente') {
      if (!profile.obra_id) {
        mostrarToast('Vincule uma obra antes de enviar acesso ao cliente.', 'erro')
        return
      }
      const { error } = await enviarMagicLinkCliente(profile.email)
      if (error) {
        logError('auth.cliente_magic_link_failed', error, { profileId: profile.id, obraId: profile.obra_id, email: profile.email })
        mostrarToast(detalheErro(error, 'Nao foi possivel enviar o link de acesso ao cliente.'), 'erro')
      } else {
        mostrarToast(`Link de acesso ao portal enviado para ${profile.email}.`)
      }
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: redirectAcesso(),
    })

    if (error) mostrarToast(detalheErro(error, 'Nao foi possivel enviar o link de senha.'), 'erro')
    else mostrarToast(`Link de redefinição enviado para ${profile.email}.`)
  }

  async function alterarAtivo(p) {
    const ativo = p.ativo !== false
    if (ativo && !window.confirm('Deseja desativar este usuário?')) return

    const { error } = await supabase.from('profiles').update({ ativo: !ativo }).eq('id', p.id)
    if (error) {
      mostrarToast(detalheErro(error, `Nao foi possivel ${ativo ? 'desativar' : 'ativar'} este usuario.`), 'erro')
      return
    }
    mostrarToast(`${p.full_name || 'Usuário'} ${ativo ? 'desativado' : 'ativado'}.`)
    await carregar()
  }

  const profilesVisiveis = supervisorAtual
    ? profiles.filter(p => p.role === 'montador' && (!p.supervisor_id || p.supervisor_id === perfilAtual?.id))
    : profiles
  const filtrosDisponiveis = supervisorAtual ? ['todos', 'montador'] : ['todos', ...ROLES]
  const listaFiltrada = filtro === 'todos' ? profilesVisiveis : profilesVisiveis.filter(p => p.role === filtro)
  const termoBusca = normalizarBusca(busca)
  const lista = listaFiltrada.filter(p => {
    if (!termoBusca) return true
    const obrasTexto = obrasVinculadas(p).map(o => o.nome).join(' ')
    return normalizarBusca([p.full_name, p.email, p.cargo, ROLE_LABEL[p.role], obrasTexto].join(' ')).includes(termoBusca)
  })
  const kpis = [
    { label: 'Gestão', value: profilesVisiveis.filter(p => p.role === 'gestao').length },
    { label: 'Supervisores', value: profilesVisiveis.filter(p => p.role === 'supervisor').length },
    { label: 'Montadores', value: profilesVisiveis.filter(p => p.role === 'montador').length },
    { label: 'Pós-venda', value: profilesVisiveis.filter(p => p.role === 'pos_venda').length },
    { label: 'Vendedores', value: profilesVisiveis.filter(p => p.role === 'vendedor').length },
  ].filter(k => !supervisorAtual || k.label === 'Montadores')

  function obrasVinculadas(profile) {
    if (profile.role === 'montador') {
      const ids = new Set(vinculos.filter(v => v.montador_id === profile.id).map(v => v.obra_id))
      return obras.filter(o => ids.has(o.id))
    }
    if (profile.role === 'supervisor') return obras.filter(o => o.supervisor_id === profile.id)
    if (['pos_venda', 'vendedor'].includes(profile.role)) return obras.filter(o => o.comercial_id === profile.id)
    if (profile.role === 'cliente') return obras.filter(o => o.id === profile.obra_id)
    return []
  }

  function cargaTrabalho(profile) {
    const total = obrasVinculadas(profile).length
    if (profile.role === 'cliente' || profile.role === 'gestao') {
      return { total, label: total ? `${total} obra${total === 1 ? '' : 's'}` : 'Sem carga direta', nivel: 'Neutra', color: '#8A8175' }
    }
    if (total >= 6) return { total, label: `${total} obras`, nivel: 'Alta', color: theme.error }
    if (total >= 3) return { total, label: `${total} obras`, nivel: 'Média', color: theme.gold }
    if (total > 0) return { total, label: `${total} obra${total === 1 ? '' : 's'}`, nivel: 'Controlada', color: '#2D7A4A' }
    return { total, label: 'Sem obras', nivel: 'Livre', color: '#8A8175' }
  }

  function abrirEdicao(profile) {
    setMenuAberto(null)
    setEditando({ ...profile })
  }

  function acaoAtivo(profile) {
    setMenuAberto(null)
    alterarAtivo(profile)
  }

  function acaoAcesso(profile) {
    setMenuAberto(null)
    enviarResetSenha(profile)
  }

  return (
    <div className="ow-page" style={s.page}>
      <style>{css}</style>
      {toast.msg && <Toast msg={toast.msg} tipo={toast.tipo} />}
      {modal && <ModalNovoUsuario obras={obras} supervisores={supervisores} rolesDisponiveis={rolesDisponiveis} supervisorAtual={supervisorAtual ? perfilAtual : null} onClose={() => setModal(false)} onSaved={(role) => { setModal(false); carregar(); mostrarToast(role === 'cliente' ? 'Cliente criado, vinculado a obra e convidado por e-mail.' : 'Novo usuario criado com sucesso. A senha inicial nao sera exibida novamente.') }} />}

      <div className="eq-header" style={s.header}>
        <div>
          <div style={s.breadcrumb}>Gestão</div>
          <h1 style={s.title}>Central de Equipe</h1>
          <p style={s.sub}>{profilesVisiveis.length} membro{profilesVisiveis.length !== 1 ? 's' : ''} · {profilesVisiveis.filter(p => p.ativo !== false).length} ativos</p>
        </div>
        <div style={s.headerActions}>
          <button type="button" style={s.btnGhost} onClick={() => setVisao(visao === 'cards' ? 'tabela' : 'cards')}>
            {visao === 'cards' ? 'Tabela compacta' : 'Cards'}
          </button>
          <button className="eq-new" style={s.btnNew} onClick={() => setModal(true)}>+ Novo Usuário</button>
        </div>
      </div>

      <div className="eq-mobile-summary" aria-label="Resumo da equipe">
        <button type="button" onClick={() => setFiltro('todos')}>
          <strong>{loading ? '-' : profilesVisiveis.length}</strong>
          <span>total</span>
        </button>
        <button type="button" onClick={() => setFiltro('todos')}>
          <strong>{loading ? '-' : profilesVisiveis.filter(p => p.ativo !== false).length}</strong>
          <span>ativos</span>
        </button>
        <button type="button" onClick={() => setFiltro('montador')}>
          <strong>{loading ? '-' : profilesVisiveis.filter(p => p.role === 'montador').length}</strong>
          <span>montadores</span>
        </button>
        <button type="button" onClick={() => setFiltro('vendedor')}>
          <strong>{loading ? '-' : profilesVisiveis.filter(p => p.role === 'vendedor').length}</strong>
          <span>vendedores</span>
        </button>
      </div>

      <div className="eq-kpis" style={s.kpiGrid}>
        {kpis.map(k => (
          <div key={k.label} style={s.kpi}>
            <span style={s.kpiLabel}>{k.label}</span>
            <strong style={s.kpiValue}>{loading ? '-' : k.value}</strong>
          </div>
        ))}
      </div>

      <div className="eq-filters" style={s.filters}>
        <input
          aria-label="Buscar membro da equipe"
          placeholder="Buscar por nome, e-mail, perfil ou obra"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={s.search}
        />
        {filtrosDisponiveis.map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            ...s.filterBtn,
            background: filtro === f ? theme.gold : theme.surface,
            color: filtro === f ? theme.background : theme.textSecondary,
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
      ) : visao === 'tabela' ? (
        <EquipeTabela
          lista={lista}
          menuAberto={menuAberto}
          setMenuAberto={setMenuAberto}
          obrasVinculadas={obrasVinculadas}
          cargaTrabalho={cargaTrabalho}
          onEditar={abrirEdicao}
          onAcesso={acaoAcesso}
          onAtivo={acaoAtivo}
        />
      ) : (
        <div className="eq-grid" style={s.gridList}>
          {lista.map(p => {
            const cor = ROLE_COLOR[p.role] || '#888'
            const ativo = p.ativo !== false
            const initials = (p.full_name || p.email || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
            const obrasPessoa = obrasVinculadas(p)
            const isEditando = editando?.id === p.id

            return (
              <section key={p.id} className="eq-card" style={{ ...s.card, opacity: ativo ? 1 : 0.62, borderTopColor: cor }}>
                {isEditando ? (
                    <EditForm
                      editando={editando}
                      setEditando={setEditando}
                      obras={obras}
                      supervisores={supervisores}
                      rolesDisponiveis={rolesDisponiveis}
                      salvando={salvando}
                      onSalvar={salvarEdicao}
                      onCancelar={() => setEditando(null)}
                      onResetSenha={() => enviarResetSenha(editando)}
                    />
                ) : (
                  <>
                    <div style={s.cardTop}>
                      <div className="eq-avatar" style={{ ...s.avatar, background: cor + '18', color: cor }}>{initials}</div>
                      <div style={s.personInfo}>
                        <strong style={s.personName}>{p.full_name || 'Sem nome'}</strong>
                        <span style={s.personMeta}>{p.cargo || ROLE_LABEL[p.role] || 'Sem cargo informado'}</span>
                        <span style={s.personEmail}>{p.email || 'E-mail não informado'}</span>
                      </div>
                      <ActionMenu
                        id={p.id}
                        profile={p}
                        menuAberto={menuAberto}
                        setMenuAberto={setMenuAberto}
                        onEditar={abrirEdicao}
                        onAcesso={acaoAcesso}
                        onAtivo={acaoAtivo}
                      />
                    </div>
                    <div style={s.badgeRow}>
                      <span style={{ ...s.badge, background: cor + '18', color: cor }}>{ROLE_LABEL[p.role] || p.role}</span>
                      <span style={{ ...s.badge, background: ativo ? '#EAF5EE' : '#F5F1EA', color: ativo ? '#2D7A4A' : '#8A8175' }}>{ativo ? 'Ativo' : 'Inativo'}</span>
                    </div>
                    <div className="eq-detail" style={s.detailLine}>{p.telefone || 'Telefone não informado'}</div>
                    <div className="eq-detail" style={s.detailLine}>{obrasPessoa.length ? `${obrasPessoa.length} obra${obrasPessoa.length === 1 ? '' : 's'} vinculada${obrasPessoa.length === 1 ? '' : 's'}` : 'Sem obras vinculadas'}</div>
                    <div className="eq-detail" style={s.detailLine}>
                      Carga: <strong style={{ color: cargaTrabalho(p).color }}>{cargaTrabalho(p).nivel}</strong> · {cargaTrabalho(p).label}
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

function ActionMenu({ id, profile, menuAberto, setMenuAberto, onEditar, onAcesso, onAtivo }) {
  const aberto = menuAberto === id
  const ativo = profile.ativo !== false
  return (
    <div style={s.menuWrap}>
      <button
        type="button"
        aria-label="Abrir ações"
        style={s.menuButton}
        onClick={() => setMenuAberto(aberto ? null : id)}
      >
        ...
      </button>
      {aberto && (
        <div style={s.menu}>
          <button type="button" style={s.menuItem} onClick={() => onEditar(profile)}>Editar</button>
          {profile.role === 'cliente' && <button type="button" style={s.menuItem} onClick={() => onAcesso(profile)}>Reenviar acesso</button>}
          <button type="button" style={s.menuItemDanger} onClick={() => onAtivo(profile)}>{ativo ? 'Desativar' : 'Ativar'}</button>
        </div>
      )}
    </div>
  )
}

function EquipeTabela({ lista, menuAberto, setMenuAberto, obrasVinculadas, cargaTrabalho, onEditar, onAcesso, onAtivo }) {
  return (
    <div className="eq-table-wrap" style={s.tableWrap}>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Nome</th>
            <th style={s.th}>Perfil</th>
            <th style={s.th}>Status</th>
            <th style={s.th}>Obras</th>
            <th style={s.th}>Carga</th>
            <th style={s.th}>Contato</th>
            <th style={{ ...s.th, textAlign: 'right' }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {lista.map(p => {
            const ativo = p.ativo !== false
            const obrasPessoa = obrasVinculadas(p)
            const carga = cargaTrabalho(p)
            return (
              <tr key={p.id} style={s.tr}>
                <td style={s.td}>
                  <strong style={s.tableName}>{p.full_name || 'Sem nome'}</strong>
                  <span style={s.tableSub}>{p.email || 'E-mail não informado'}</span>
                </td>
                <td style={s.td}>{ROLE_LABEL[p.role] || p.role}</td>
                <td style={s.td}>
                  <span style={{ ...s.badge, background: ativo ? '#EAF5EE' : '#F5F1EA', color: ativo ? '#2D7A4A' : '#8A8175' }}>{ativo ? 'Ativo' : 'Inativo'}</span>
                </td>
                <td style={s.td}>{obrasPessoa.length ? `${obrasPessoa.length} obra${obrasPessoa.length === 1 ? '' : 's'}` : 'Sem obras'}</td>
                <td style={s.td}><strong style={{ color: carga.color }}>{carga.nivel}</strong><span style={s.tableSub}>{carga.label}</span></td>
                <td style={s.td}>{p.telefone || 'Telefone não informado'}</td>
                <td style={{ ...s.td, textAlign: 'right' }}>
                  <ActionMenu id={`row-${p.id}`} profile={p} menuAberto={menuAberto} setMenuAberto={setMenuAberto} onEditar={onEditar} onAcesso={onAcesso} onAtivo={onAtivo} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Toast({ msg, tipo }) {
  return <div style={{ ...s.toast, background: tipo === 'erro' ? theme.surfaceElevated : 'var(--color-ink)', color: tipo === 'erro' ? theme.error : '#fff' }}>{msg}</div>
}

function EditForm({ editando, setEditando, obras, supervisores, rolesDisponiveis, salvando, onSalvar, onCancelar, onResetSenha }) {
  const set = (k, v) => setEditando(p => ({ ...p, [k]: v }))
  const setRole = (role) => setEditando(p => ({
    ...p,
    role,
    supervisor_id: role === 'montador' ? p.supervisor_id : null,
    obra_id: role === 'cliente' ? p.obra_id : null,
  }))
  return (
    <div>
      <div style={s.editGrid}>
        <Field label="Nome"><input style={s.input} value={editando.full_name || ''} onChange={e => set('full_name', e.target.value)} /></Field>
        <Field label="E-mail"><input style={s.input} value={editando.email || 'E-mail não informado'} readOnly /></Field>
        <Field label="Cargo"><input style={s.input} value={editando.cargo || ''} onChange={e => set('cargo', e.target.value)} /></Field>
        <Field label="Telefone"><input style={s.input} value={editando.telefone || ''} onChange={e => set('telefone', e.target.value)} /></Field>
        <Field label="Perfil">
          <select style={s.input} value={editando.role} onChange={e => setRole(e.target.value)}>
            {rolesDisponiveis.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
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
        {editando.role === 'cliente' && (
          <Field label="Obra vinculada">
            <select style={s.input} value={editando.obra_id || ''} onChange={e => set('obra_id', e.target.value)}>
              <option value="">Selecione a obra</option>
              {obras.map(obra => <option key={obra.id} value={obra.id}>{obra.nome || obra.id}</option>)}
            </select>
          </Field>
        )}
      </div>
      <label style={s.checkLine}>
        <input type="checkbox" checked={editando.ativo !== false} onChange={e => set('ativo', e.target.checked)} />
        Usuário ativo
      </label>
      <div style={s.passwordBox}>
        <strong>{editando.role === 'cliente' ? 'Acesso do cliente' : 'Senha'}</strong>
        <span>Por segurança, a senha atual não pode ser visualizada. Envie um link para o usuário criar uma nova senha.</span>
        <button type="button" style={s.btnEdit} onClick={onResetSenha}>Enviar redefinição de senha</button>
      </div>
      <div style={s.actions}>
        <button style={s.btnEdit} onClick={onCancelar}>Cancelar</button>
        <button style={{ ...s.btnEdit, background: 'var(--color-gold)', color: '#fff', borderColor: 'var(--color-gold)' }} onClick={onSalvar} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  )
}

function ModalNovoUsuario({ obras, supervisores, rolesDisponiveis, supervisorAtual, onClose, onSaved }) {
  const roleInicial = rolesDisponiveis.includes('montador') ? 'montador' : rolesDisponiveis[0]
  const [form, setForm] = useState({ full_name: '', email: '', senha: '', role: roleInicial, cargo: '', telefone: '', supervisor_id: supervisorAtual?.id || '', obra_id: '' })
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const setRole = (role) => setForm(p => ({
    ...p,
    role,
    supervisor_id: role === 'montador' ? p.supervisor_id : '',
    obra_id: role === 'cliente' ? p.obra_id : '',
  }))

  async function salvarSeguro() {
    const fullName = String(form.full_name || '').trim()
    const email = normalizarEmail(form.email)
    const senha = String(form.senha || '')
    const role = supervisorAtual ? 'montador' : form.role
    const supervisorId = role === 'montador' ? (form.supervisor_id || supervisorAtual?.id || null) : null
    const obraId = role === 'cliente' ? form.obra_id : null

    if (!fullName || !email || !role) { setErro('Preencha nome, e-mail e perfil.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErro('Informe um e-mail valido.'); return }
    if (!rolesDisponiveis.includes(role)) { setErro('Selecione um perfil permitido para seu acesso.'); return }
    if (role === 'cliente' && !obraId) { setErro('Selecione a obra vinculada ao cliente.'); return }
    if (role !== 'cliente' && senha.length < 6) { setErro('Senha minima de 6 caracteres.'); return }

    setSaving(true)
    setErro('')
    const { data: sessionData } = await supabase.auth.getSession()
    const sessaoAnterior = sessionData?.session

    try {
      const senhaAuth = role === 'cliente' && !senha ? gerarSenhaTemporaria() : senha
      const { data, error } = await supabase.auth.signUp({ email, password: senhaAuth, options: { data: { full_name: fullName } } })
      if (error) { setErro(detalheErro(error, 'Nao foi possivel criar o usuario.')); return }
      if (!data?.user?.id) { setErro('Usuario criado sem retorno de identificacao do Auth.'); return }

      await new Promise(r => setTimeout(r, 900))
      const payload = {
        id: data.user.id,
        email,
        full_name: fullName,
        role,
        cargo: form.cargo || null,
        telefone: form.telefone || null,
        supervisor_id: supervisorId,
        obra_id: obraId,
        ativo: true,
      }
      let { error: profileError } = await supabase.from('profiles').update(payload).eq('id', data.user.id)
      if (profileError) {
        const upsertResult = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
        profileError = upsertResult.error
      }
      if (profileError) {
        setErro('Usuario criado no Auth, mas nao foi possivel configurar o perfil: ' + detalheErro(profileError))
        return
      }

      if (role === 'cliente') {
        const convite = await enviarMagicLinkCliente(email)
        if (convite.error) {
          logError('auth.cliente_invite_failed', convite.error, { profileId: data.user.id, obraId, email })
          setErro('Cliente criado e vinculado a obra, mas nao foi possivel enviar o link de acesso: ' + detalheErro(convite.error))
          return
        }
      }

      setForm({ full_name: '', email: '', senha: '', role: roleInicial, cargo: '', telefone: '', supervisor_id: supervisorAtual?.id || '', obra_id: '' })
      onSaved(role)
    } catch (error) {
      setErro(detalheErro(error, 'Erro inesperado ao criar usuario.'))
    } finally {
      if (sessaoAnterior?.access_token && sessaoAnterior?.refresh_token) {
        await supabase.auth.setSession({
          access_token: sessaoAnterior.access_token,
          refresh_token: sessaoAnterior.refresh_token,
        })
      }
      setSaving(false)
    }
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
            <Field label={form.role === 'cliente' ? 'Senha inicial opcional' : 'Senha inicial'}><input style={s.input} type="password" autoComplete="new-password" value={form.senha} onChange={e => set('senha', e.target.value)} placeholder={form.role === 'cliente' ? 'Cliente recebera link de acesso' : ''} /></Field>
            <Field label="Cargo"><input style={s.input} value={form.cargo} onChange={e => set('cargo', e.target.value)} /></Field>
            <Field label="Telefone"><input style={s.input} value={form.telefone} onChange={e => set('telefone', e.target.value)} /></Field>
            <Field label="Perfil">
              <select style={s.input} value={form.role} onChange={e => setRole(e.target.value)}>
                {rolesDisponiveis.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </Field>
            {form.role === 'montador' && (
              <Field label="Supervisor responsável">
                <select style={s.input} value={form.supervisor_id} onChange={e => set('supervisor_id', e.target.value)} disabled={Boolean(supervisorAtual)}>
                  <option value="">Sem supervisor</option>
                  {supervisores.map(sv => <option key={sv.id} value={sv.id}>{sv.full_name}</option>)}
                </select>
              </Field>
            )}
            {form.role === 'cliente' && (
              <Field label="Obra vinculada">
                <select style={s.input} value={form.obra_id} onChange={e => set('obra_id', e.target.value)}>
                  <option value="">Selecione a obra</option>
                  {obras.map(obra => <option key={obra.id} value={obra.id}>{obra.nome || obra.id}</option>)}
                </select>
              </Field>
            )}
          </div>
          <div style={s.roleHint}>{form.role === 'cliente' ? 'Cliente precisa ter uma obra vinculada e recebera um link de acesso ao portal.' : ROLE_DESC[form.role]}</div>
        </div>
        <div style={s.modalFoot}>
          <button style={s.btnEdit} onClick={onClose}>Cancelar</button>
          <button style={{ ...s.btnEdit, background: 'var(--color-gold)', color: '#fff', borderColor: 'var(--color-gold)' }} onClick={salvarSeguro} disabled={saving}>
            {saving ? 'Criando...' : form.role === 'cliente' ? 'Criar e enviar convite' : 'Criar Usuario'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return <label style={s.field}><span>{label}</span>{children}</label>
}

const css = `
.eq-mobile-summary{display:none}
@media (max-width:760px){
  .ow-page{padding-bottom:112px !important}
  .eq-header{display:grid !important;grid-template-columns:1fr auto;gap:10px;align-items:end !important;margin-bottom:13px !important;padding-right:0 !important}
  .eq-header>div:last-child{display:flex !important;gap:8px !important;align-items:center !important}
  .eq-header h1{font-size:27px !important;line-height:1 !important}
  .eq-header p{font-size:12px !important;margin-top:4px !important}
  .eq-new{padding:9px 12px !important;border-radius:12px !important;font-size:12px !important}
  .eq-mobile-summary{display:grid !important;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 10px}
  .eq-mobile-summary button{appearance:none;border:1px solid rgba(231,224,213,.95);background:${theme.surface};border-radius:16px;padding:10px 8px;text-align:left;box-shadow:0 10px 24px rgba(29,28,25,.045);font-family:inherit}
  .eq-mobile-summary strong{display:block;font-size:22px;line-height:1;color:var(--color-ink)}
  .eq-mobile-summary span{display:block;margin-top:5px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--color-ink-muted)}
  .eq-kpis{display:none !important}
  .eq-kpis>div{flex:0 0 auto !important;min-width:auto !important;display:flex !important;align-items:center !important;gap:7px !important;border-radius:999px !important;padding:7px 10px !important;border-top:1px solid rgba(184,150,94,.22) !important;box-shadow:0 8px 20px rgba(29,28,25,.045) !important}
  .eq-kpis span{font-size:10.5px !important;line-height:1 !important;letter-spacing:0 !important;white-space:nowrap !important;margin:0 !important;color:var(--color-ink-muted) !important}
  .eq-kpis strong{font-size:15px !important;line-height:1 !important}
  .eq-filters{display:flex !important;overflow-x:auto !important;flex-wrap:nowrap !important;gap:8px !important;margin-bottom:12px !important;padding-bottom:3px !important}
  .eq-filters input{min-width:230px !important;flex:0 0 230px !important}
  .eq-filters button{flex:0 0 auto !important;white-space:nowrap !important}
  .eq-table-wrap{border-radius:18px !important}
  .eq-table-wrap table{min-width:820px !important}
  .eq-grid{display:flex !important;flex-direction:column !important;gap:10px !important}
  .eq-card{border-radius:18px !important;padding:14px !important;border-top-width:1px !important;box-shadow:0 14px 34px rgba(29,28,25,.05) !important}
  .eq-card>div:first-child{margin-bottom:10px !important}
  .eq-avatar{width:38px !important;height:38px !important;font-size:12px !important}
  .eq-card strong{font-size:14px !important;line-height:1.15 !important}
  .eq-card span{max-width:100%}
  .eq-detail{font-size:11.5px !important;padding:5px 0 !important;white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important}
  .eq-actions{display:none !important}
  .eq-card label{font-size:9px !important}
  .eq-card input,.eq-card select{font-size:13px !important}
  .eq-card [style*="grid-template-columns"]{grid-template-columns:1fr !important}
}
`

const s = {
  page: { width: '100%', padding: '32px 40px', maxWidth: 'none', margin: 0, background: theme.background, color: theme.textPrimary, fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', overflowX: 'hidden' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 18, boxSizing: 'border-box' },
  headerActions: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' },
  breadcrumb: { fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 6, fontWeight: 800 },
  title: { fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 500, color: 'var(--color-ink)', margin: 0, lineHeight: 1.05 },
  sub: { fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 6 },
  btnNew: { background: theme.gold, color: theme.background, border: 'none', borderRadius: 8, padding: '12px 24px', minHeight: 44, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  btnGhost: { background: theme.surface, color: 'var(--color-ink)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '12px 16px', minHeight: 44, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, marginBottom: 20 },
  kpi: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  kpiLabel: { display: 'block', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--color-gold)', fontWeight: 800, marginBottom: 8 },
  kpiValue: { display: 'block', fontSize: 30, lineHeight: 1, color: 'var(--color-ink)' },
  filters: { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  search: { flex: '1 1 260px', background: theme.inputBackground, border: '1px solid ' + theme.inputBorder, color: theme.inputText, borderRadius: 9, padding: '10px 14px', minHeight: 44, fontSize: 13, outline: 'none', fontFamily: 'inherit' },
  filterBtn: { padding: '9px 16px', minHeight: 44, borderRadius: 999, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 },
  gridList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 },
  card: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.3)', minWidth: 0 },
  cardTop: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 },
  personInfo: { minWidth: 0, flex: 1 },
  personName: { display: 'block', fontSize: 14.5, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  personMeta: { display: 'block', fontSize: 12, color: 'var(--color-ink-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  personEmail: { display: 'block', fontSize: 11.5, color: '#8A8175', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  badgeRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  badge: { fontSize: 10, padding: '3px 9px', borderRadius: 999, fontWeight: 800 },
  detailLine: { fontSize: 12, color: 'var(--color-ink-muted)', padding: '6px 0', borderTop: '1px solid var(--color-border)' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 },
  btnEdit: { background: theme.surface, border: '1px solid var(--color-border)', borderRadius: 9, padding: '10px 13px', minHeight: 44, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--color-ink-muted)' },
  menuWrap: { position: 'relative', flexShrink: 0 },
  menuButton: { width: 34, height: 34, borderRadius: 8, border: '1px solid var(--color-border)', background: theme.surfaceElevated, color: 'var(--color-ink)', cursor: 'pointer', fontWeight: 900, lineHeight: 1 },
  menu: { position: 'absolute', right: 0, top: 38, minWidth: 164, background: theme.surface, border: '1px solid var(--color-border)', borderRadius: 10, padding: 6, boxShadow: 'var(--shadow-md)', zIndex: 20 },
  menuItem: { display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderRadius: 7, padding: '10px 12px', color: 'var(--color-ink)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  menuItemDanger: { display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderRadius: 7, padding: '10px 12px', color: theme.error, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  tableWrap: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.3)', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 860 },
  th: { padding: '12px 14px', textAlign: 'left', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--color-gold)', borderBottom: '1px solid var(--color-border)' },
  tr: { borderBottom: '1px solid var(--color-border)' },
  td: { padding: '13px 14px', fontSize: 12.5, color: 'var(--color-ink-muted)', verticalAlign: 'middle' },
  tableName: { display: 'block', color: 'var(--color-ink)', fontSize: 13.5, marginBottom: 3 },
  tableSub: { display: 'block', color: '#8A8175', fontSize: 11.5 },
  empty: { textAlign: 'center', padding: '40px 0', color: '#aaa' },
  emptyBox: { textAlign: 'center', padding: '44px 18px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  emptyIcon: { fontSize: 13, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: 'var(--color-ink)', marginBottom: 18 },
  editGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10, letterSpacing: 1.3, textTransform: 'uppercase', color: 'var(--color-ink-muted)', fontWeight: 800 },
  input: { background: theme.inputBackground, border: '1px solid ' + theme.inputBorder, color: theme.inputText, borderRadius: 8, padding: '10px 14px', width: '100%', minHeight: 44, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  checkLine: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: 'var(--color-ink-muted)' },
  passwordBox: { marginTop: 14, background: theme.surfaceElevated, border: '1px solid var(--color-border)', borderRadius: 12, padding: 12, display: 'grid', gap: 7, color: 'var(--color-ink-muted)', fontSize: 12 },
  toast: { position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', padding: '12px 22px', borderRadius: 12, fontSize: 13, fontWeight: 800, borderLeft: '3px solid var(--color-gold)', zIndex: 2000, boxShadow: 'var(--shadow-md)', maxWidth: 'calc(100vw - 24px)' },
  modalBg: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.42)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, width: '100%', maxWidth: 620, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 24px 0' },
  modalBody: { overflowY: 'auto', padding: 24 },
  modalFoot: { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--color-border)' },
  error: { background: 'rgba(224,82,82,.12)', color: theme.error, borderLeft: '3px solid ' + theme.error, padding: '10px 12px', borderRadius: 8, fontSize: 12, marginBottom: 14 },
  roleHint: { marginTop: 14, color: 'var(--color-ink-muted)', fontSize: 12, background: theme.surfaceElevated, border: '1px solid var(--color-border)', borderRadius: 10, padding: 12 },
}
