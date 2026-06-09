import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'

const PR_COR = { baixa: '#aaa', media: '#b09a7a', alta: '#d94a4a' }
const PR_LABEL = { baixa: 'Baixa', media: 'Media', alta: 'Alta' }

export default function MontadorDashboard() {
  const { user, profile } = useStore()
  const [tarefas, setTarefas] = useState([])
  const [checkins, setCheckins] = useState([])
  const [loading, setLoading] = useState(true)
  const [checkando, setCheckando] = useState(false)
  const [modalProblema, setModalProblema] = useState(null)
  const [problema, setProblema] = useState('')
  const [salvandoProblema, setSalvandoProblema] = useState(false)
  const [sucesso, setSucesso] = useState('')

  useEffect(() => { if (user) carregar() }, [user])

  async function carregar() {
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from('tarefas')
        .select('*, obras(nome, endereco, cidade)')
        .eq('responsavel_id', user.id)
        .neq('status', 'concluida')
        .order('prazo'),
      supabase.from('checkins')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ])
    setTarefas(t || [])
    setCheckins(c || [])
    setLoading(false)
  }

  async function fazerCheckin(obraId) {
    setCheckando(true)
    await supabase.from('checkins').insert([{
      user_id: user.id,
      obra_id: obraId,
      entrada: new Date().toISOString(),
    }])
    mostrarSucesso('Check-in registrado!')
    await carregar()
    setCheckando(false)
  }

  async function fazerCheckout() {
    setCheckando(true)
    const ultimo = checkins.find(c => !c.saida)
    if (ultimo) {
      await supabase.from('checkins').update({ saida: new Date().toISOString() }).eq('id', ultimo.id)
    }
    mostrarSucesso('Check-out registrado!')
    await carregar()
    setCheckando(false)
  }

  async function mudarStatus(id, status) {
    await supabase.from('tarefas').update({ status }).eq('id', id)
    await carregar()
  }

  async function salvarProblema() {
    if (!problema.trim()) return
    setSalvandoProblema(true)
    await supabase.from('ocorrencias').insert([{
      obra_id: modalProblema.obra_id,
      criado_por: user.id,
      tipo: 'Problema tecnico',
      descricao: problema,
      gravidade: 'media',
      status: 'Aberta',
    }])
    setModalProblema(null)
    setProblema('')
    setSalvandoProblema(false)
    mostrarSucesso('Problema registrado!')
  }

  function mostrarSucesso(msg) {
    setSucesso(msg)
    setTimeout(() => setSucesso(''), 3000)
  }

  const emServico = checkins.some(c => !c.saida)
  const ultimoCheckin = checkins[0]

  if (loading) return (
    <div style={s.loading}>Carregando...</div>
  )

  return (
    <div style={s.root}>

      {/* Modal problema */}
      {modalProblema && (
        <div style={s.modalBg} onClick={e => e.target === e.currentTarget && setModalProblema(null)}>
          <div style={s.modal}>
            <div style={s.modalTitle}>Registrar Problema</div>
            <div style={s.modalSub}>{modalProblema.titulo}</div>
            <textarea
              style={s.textarea}
              value={problema}
              onChange={e => setProblema(e.target.value)}
              placeholder="Descreva o problema encontrado..."
              rows={4} />
            <div style={s.modalBtns}>
              <button style={s.btnCancel} onClick={() => setModalProblema(null)}>Cancelar</button>
              <button style={s.btnDanger} onClick={salvarProblema} disabled={salvandoProblema}>
                {salvandoProblema ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast sucesso */}
      {sucesso && (
        <div style={s.toast}>{sucesso}</div>
      )}

      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.breadcrumb}>Ornare Works</div>
          <h1 style={s.title}>Ola, {profile?.full_name?.split(' ')[0] || 'Montador'}</h1>
          <div style={s.date}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
        <div style={s.avatar}>
          {(profile?.full_name || user?.email || '?')[0].toUpperCase()}
        </div>
      </div>

      {/* Card check-in */}
      <div style={{ ...s.checkinCard, background: emServico ? '#edf7f0' : '#fff', borderColor: emServico ? '#5aab6e44' : 'var(--color-border)' }}>
        <div>
          <div style={{ ...s.checkinStatus, color: emServico ? '#3a7d4f' : '#aaa' }}>
            {emServico ? 'Em servico' : 'Fora de servico'}
          </div>
          {ultimoCheckin && (
            <div style={s.checkinHora}>
              {emServico ? 'Desde' : 'Ultimo'}: {new Date(ultimoCheckin.entrada || ultimoCheckin.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
        {emServico ? (
          <button style={s.btnCheckout} onClick={fazerCheckout} disabled={checkando}>
            {checkando ? '...' : 'Check-out'}
          </button>
        ) : (
          <button
            style={{ ...s.btnCheckin, opacity: tarefas.length === 0 ? 0.5 : 1 }}
            onClick={() => tarefas[0] && fazerCheckin(tarefas[0].obra_id)}
            disabled={checkando || tarefas.length === 0}>
            {checkando ? '...' : 'Check-in'}
          </button>
        )}
      </div>

      {/* Tarefas */}
      <div style={s.sectionLabel}>
        Tarefas pendentes ({tarefas.length})
      </div>

      {tarefas.length === 0 ? (
        <div style={s.emptyBox}>
          <div style={s.emptyIcon}>✓</div>
          <div style={s.emptyText}>Nenhuma tarefa pendente</div>
          <div style={s.emptySub}>Bom trabalho!</div>
        </div>
      ) : tarefas.map(t => (
        <div key={t.id} style={{ ...s.tarefaCard, borderLeftColor: PR_COR[t.prioridade] || '#ccc' }}>
          <div style={s.tarefaHeader}>
            <div style={s.tarefaTitulo}>{t.titulo}</div>
            <span style={{ ...s.prioridade, color: PR_COR[t.prioridade] || '#aaa' }}>
              {PR_LABEL[t.prioridade] || ''}
            </span>
          </div>

          {t.descricao && (
            <div style={s.tarefaDesc}>{t.descricao}</div>
          )}

          <div style={s.tarefaMeta}>
            {t.obras?.nome && <span>Obra: {t.obras.nome}</span>}
            {t.obras?.cidade && <span>{t.obras.cidade}</span>}
            {t.prazo && <span>Prazo: {new Date(t.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
          </div>

          {/* Status selector */}
          <div style={s.statusRow}>
            {['pendente', 'em_andamento', 'concluida'].map(st => (
              <button key={st} onClick={() => mudarStatus(t.id, st)} style={{
                ...s.statusBtn,
                background: t.status === st ? 'var(--color-ink)' : '#f5f5f5',
                color: t.status === st ? '#fff' : '#888',
              }}>
                {st === 'pendente' ? 'Pendente' : st === 'em_andamento' ? 'Em andamento' : 'Concluida'}
              </button>
            ))}
          </div>

          {/* Acoes */}
          <div style={s.acoesRow}>
            <button style={s.btnCheckinSmall} onClick={() => fazerCheckin(t.obra_id)} disabled={checkando}>
              Check-in
            </button>
            <button style={s.btnProblema} onClick={() => setModalProblema(t)}>
              Problema
            </button>
            <button style={s.btnConcluir} onClick={() => mudarStatus(t.id, 'concluida')}>
              Concluir
            </button>
          </div>
        </div>
      ))}

      {/* Historico */}
      {checkins.length > 0 && (
        <div style={{ marginTop: 28, marginBottom: 40 }}>
          <div style={s.sectionLabel}>Historico de hoje</div>
          {checkins.slice(0, 5).map(c => (
            <div key={c.id} style={s.historicoItem}>
              <div style={{ ...s.historicoDot, background: c.saida ? '#d94a4a' : '#5aab6e' }} />
              <div style={s.historicoTexto}>
                {c.saida ? 'Check-out' : 'Check-in'}
              </div>
              <div style={s.historicoHora}>
                {new Date(c.entrada || c.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}

const s = {
  root: { maxWidth: 480, margin: '0 auto', padding: '24px 16px', fontFamily: 'var(--font-sans)', background: 'var(--sand)', minHeight: '100vh' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#bbb' },

  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  breadcrumb: { fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 4 },
  title: { fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 500, color: 'var(--color-ink)', margin: '0 0 2px' },
  date: { fontSize: 12, color: 'var(--color-ink-muted)' },
  avatar: { width: 42, height: 42, borderRadius: '50%', background: '#b09a7a22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#b09a7a', flexShrink: 0 },

  checkinCard: { border: '1px solid', borderRadius: 14, padding: '18px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  checkinStatus: { fontSize: 13, fontWeight: 600, marginBottom: 4 },
  checkinHora: { fontSize: 11, color: '#aaa' },
  btnCheckin: { background: 'var(--color-ink)', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnCheckout: { background: '#d94a4a', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },

  sectionLabel: { fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 12 },

  tarefaCard: { background: '#fff', border: '1px solid var(--color-border)', borderLeft: '4px solid', borderRadius: 12, padding: '16px 18px', marginBottom: 12 },
  tarefaHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  tarefaTitulo: { fontSize: 15, fontWeight: 600, color: 'var(--color-ink)', flex: 1, marginRight: 8 },
  prioridade: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 },
  tarefaDesc: { fontSize: 13, color: 'var(--color-ink-muted)', marginBottom: 8, lineHeight: 1.5 },
  tarefaMeta: { display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, color: '#aaa', marginBottom: 12 },

  statusRow: { display: 'flex', gap: 6, marginBottom: 12 },
  statusBtn: { flex: 1, border: 'none', borderRadius: 6, padding: '7px 4px', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },

  acoesRow: { display: 'flex', gap: 8 },
  btnCheckinSmall: { flex: 1, background: 'var(--color-ink)', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnProblema: { flex: 1, background: '#fff3e0', color: '#e65100', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnConcluir: { flex: 1, background: '#edf7f0', color: '#3a7d4f', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' },

  historicoItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--color-border)' },
  historicoDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  historicoTexto: { flex: 1, fontSize: 13, color: 'var(--color-ink)' },
  historicoHora: { fontSize: 11, color: '#aaa' },

  emptyBox: { textAlign: 'center', padding: '50px 0', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12 },
  emptyIcon: { fontSize: 36, color: '#5aab6e', marginBottom: 10 },
  emptyText: { fontSize: 15, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 4 },
  emptySub: { fontSize: 13, color: '#aaa' },

  toast: { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--color-ink)', color: '#fff', padding: '12px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 1000, borderLeft: '3px solid var(--color-gold)' },

  modalBg: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 },
  modal: { background: '#fff', borderRadius: 14, padding: '24px 20px', width: '100%', maxWidth: 480 },
  modalTitle: { fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500, marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#888', marginBottom: 16 },
  textarea: { width: '100%', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', outline: 'none' },
  modalBtns: { display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' },
  btnCancel: { background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', color: '#888' },
  btnDanger: { background: '#d94a4a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
}