import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const ROLES = ['admin','gestao','supervisor','montador','cliente']
const ROLE_LABEL = { admin:'Admin', gestao:'Gestão/Pós-venda', supervisor:'Supervisor', montador:'Montador', cliente:'Cliente' }
const ROLE_COLOR = { admin:'#6040a0', gestao:'#3a5580', supervisor:'#3a7d4f', montador:'#b09a7a', cliente:'#888' }
const ROLE_DESC = {
  admin: 'Acesso total ao sistema',
  gestao: 'Obras, agenda, equipe e relatórios',
  supervisor: 'Obras sob sua responsabilidade',
  montador: 'Tarefas e check-in/check-out',
  cliente: 'Portal do cliente (acesso externo)',
}

export default function Equipe() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState('equipe') // equipe | convidar
  const [filtro, setFiltro] = useState('todos')
  const [editando, setEditando] = useState(null)
  const [salvando, setSalvando] = useState(false)

  // Form convite
  const [convite, setConvite] = useState({ email: '', role: 'montador', full_name: '' })
  const [enviando, setEnviando] = useState(false)
  const [conviteOk, setConviteOk] = useState(false)
  const [conviteErro, setConviteErro] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setProfiles(data || [])
    setLoading(false)
  }

  async function enviarConvite() {
    if (!convite.email.trim()) return
    setEnviando(true)
    setConviteErro('')

    // Cria usuário via Supabase Admin (via função edge) ou direto
    const { data, error } = await supabase.auth.admin?.inviteUserByEmail
      ? supabase.auth.admin.inviteUserByEmail(convite.email)
      : { error: { message: 'Use o painel Supabase para convidar' } }

    if (error) {
      // Fallback: salva na tabela profiles como pendente
      // O usuário precisará ser convidado manualmente pelo Supabase
      setConviteErro(`Para convidar: vá em Supabase → Authentication → Users → Invite User → digite ${convite.email}. Depois edite o role aqui.`)
    } else {
      setConviteOk(true)
    }
    setEnviando(false)
  }

  async function salvarEdicao(p) {
    setSalvando(true)
    await supabase.from('profiles').update({
      full_name: editando.full_name,
      role: editando.role,
      cargo: editando.cargo,
      telefone: editando.telefone,
      ativo: editando.ativo,
    }).eq('id', p.id)
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
    <div style={{ padding: '40px 48px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 8 }}>Gestão</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 500, color: 'var(--color-ink)', margin: 0 }}>Equipe</h1>
          <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 6 }}>
            {profiles.length} membro{profiles.length !== 1 ? 's' : ''} · {profiles.filter(p => p.ativo !== false).length} ativos
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setAba('equipe')} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', fontSize: 12.5, cursor: 'pointer', background: aba === 'equipe' ? 'var(--color-ink)' : '#fff', color: aba === 'equipe' ? '#f9f7f4' : 'var(--color-ink-muted)', border: aba === 'equipe' ? 'none' : '1px solid var(--color-border)' }}>
            Ver equipe
          </button>
          <button onClick={() => { setAba('convidar'); setConviteOk(false); setConviteErro('') }} style={{ padding: '9px 18px', borderRadius: 8, fontSize: 12.5, cursor: 'pointer', background: aba === 'convidar' ? 'var(--color-ink)' : '#fff', color: aba === 'convidar' ? '#f9f7f4' : 'var(--color-ink-muted)', border: aba === 'convidar' ? 'none' : '1px solid var(--color-border)' }}>
            + Convidar usuário
          </button>
        </div>
      </div>

      {/* Aba Convidar */}
      {aba === 'convidar' && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14, padding: '28px 32px', marginBottom: 24 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 20 }}>Convidar novo usuário</div>

            {conviteOk ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>✉️</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Convite enviado!</div>
                <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>O usuário receberá um e-mail para definir sua senha.</div>
                <button onClick={() => { setConviteOk(false); setConvite({ email: '', role: 'montador', full_name: '' }) }} style={{ background: 'var(--color-ink)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, cursor: 'pointer' }}>
                  Convidar outro
                </button>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <L>Nome completo</L>
                  <I value={convite.full_name} onChange={v => setConvite(p => ({ ...p, full_name: v }))} placeholder="Nome do usuário" />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <L>E-mail *</L>
                  <I type="email" value={convite.email} onChange={v => setConvite(p => ({ ...p, email: v }))} placeholder="email@exemplo.com" />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <L>Perfil de acesso *</L>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                    {ROLES.filter(r => r !== 'cliente').map(r => (
                      <div key={r} onClick={() => setConvite(p => ({ ...p, role: r }))} style={{
                        padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                        border: convite.role === r ? `2px solid ${ROLE_COLOR[r]}` : '1px solid var(--color-border)',
                        background: convite.role === r ? ROLE_COLOR[r] + '10' : '#fafaf8',
                        transition: 'all 0.15s',
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: convite.role === r ? ROLE_COLOR[r] : 'var(--color-ink)', marginBottom: 3 }}>{ROLE_LABEL[r]}</div>
                        <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.4 }}>{ROLE_DESC[r]}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {conviteErro && (
                  <div style={{ background: '#fdf3e3', border: '1px solid #f0d5a0', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12.5, color: '#a0692a', lineHeight: 1.6 }}>
                    ⚠️ {conviteErro}
                  </div>
                )}

                <div style={{ background: '#f0f7ff', border: '1px solid #c0d8f0', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: '#3a5580', lineHeight: 1.6 }}>
                  <strong>Como funciona:</strong> O usuário receberá um e-mail com link de acesso. Ele define a própria senha no primeiro acesso. Você pode editar o perfil dele a qualquer momento.
                </div>

                <button onClick={enviarConvite} disabled={enviando || !convite.email.trim()} style={{ width: '100%', background: enviando ? '#ccc' : 'var(--color-ink)', color: '#f9f7f4', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {enviando ? 'Enviando...' : 'Enviar convite'}
                </button>
              </div>
            )}
          </div>

          {/* Instrução manual Supabase */}
          <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 12 }}>Convidar manualmente (alternativa)</div>
            {[
              'Acesse supabase.com → seu projeto',
              'Vá em Authentication → Users',
              'Clique em "Invite User"',
              'Digite o e-mail do usuário',
              'Volte aqui → Equipe → edite o perfil/role',
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 12.5, color: '#666' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--color-gold)', flexShrink: 0 }}>{i + 1}</div>
                {step}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aba Equipe */}
      {aba === 'equipe' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
            {['todos', ...ROLES].map(f => (
              <button key={f} onClick={() => setFiltro(f)} style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                background: filtro === f ? 'var(--color-ink)' : '#fff',
                color: filtro === f ? '#f9f7f4' : 'var(--color-ink-muted)',
                border: filtro === f ? 'none' : '1px solid var(--color-border)',
                fontWeight: filtro === f ? 500 : 400,
              }}>{f === 'todos' ? 'Todos' : ROLE_LABEL[f]}</button>
            ))}
          </div>

          {loading ? <div style={{ color: '#bbb' }}>Carregando...</div>
            : lista.length === 0 ? <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>Nenhum membro encontrado.</div>
            : lista.map(p => {
              const cor = ROLE_COLOR[p.role] || '#888'
              const ativo = p.ativo !== false
              const initials = (p.full_name || p.email || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
              const isEditando = editando?.id === p.id

              return (
                <div key={p.id} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: '18px 22px', marginBottom: 12, opacity: ativo ? 1 : 0.6 }}>
                  {isEditando ? (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                        <div><L>Nome</L><I value={editando.full_name || ''} onChange={v => setEditando(e => ({ ...e, full_name: v }))} /></div>
                        <div><L>Cargo</L><I value={editando.cargo || ''} onChange={v => setEditando(e => ({ ...e, cargo: v }))} placeholder="Ex: Montador Sênior" /></div>
                        <div><L>Telefone</L><I value={editando.telefone || ''} onChange={v => setEditando(e => ({ ...e, telefone: v }))} /></div>
                        <div>
                          <L>Perfil de acesso</L>
                          <select value={editando.role} onChange={ev => setEditando(e => ({ ...e, role: ev.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="checkbox" checked={editando.ativo !== false} onChange={ev => setEditando(e => ({ ...e, ativo: ev.target.checked }))} id={`ativo-${p.id}`} />
                          <label htmlFor={`ativo-${p.id}`} style={{ fontSize: 13, color: '#666', cursor: 'pointer' }}>Usuário ativo</label>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditando(null)} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', color: '#888' }}>Cancelar</button>
                        <button onClick={() => salvarEdicao(p)} disabled={salvando} style={{ background: 'var(--color-gold)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          {salvando ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: cor + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: cor, flexShrink: 0 }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' }}>{p.full_name || '—'}</div>
                        {p.cargo && <div style={{ fontSize: 11, color: '#aaa' }}>{p.cargo}</div>}
                        <div style={{ fontSize: 12, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          <span style={{ fontSize: 10, padding: '2px 10px', borderRadius: 20, background: cor + '18', color: cor, fontWeight: 600 }}>{ROLE_LABEL[p.role] || p.role}</span>
                          <span style={{ fontSize: 10, padding: '2px 10px', borderRadius: 20, background: ativo ? '#edf7f0' : '#f5f5f5', color: ativo ? '#3a7d4f' : '#aaa', fontWeight: 500 }}>{ativo ? 'Ativo' : 'Inativo'}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button onClick={() => setEditando({ ...p })} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--color-ink-muted)' }}>
                          Editar
                        </button>
                        <button onClick={() => toggleAtivo(p)} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: ativo ? '#d94a4a' : '#3a7d4f' }}>
                          {ativo ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          }
        </div>
      )}
    </div>
  )
}

function L({ children }) { return <div style={{ fontSize: 11, color: '#888', marginBottom: 5, fontWeight: 500 }}>{children}</div> }
function I({ onChange, ...props }) { return <input {...props} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} /> }