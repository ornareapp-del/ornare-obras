import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'

export default function MontadorDashboard() {
  const { user } = useStore()
  const navigate = useNavigate()
  const [tarefas, setTarefas] = useState([])
  const [checkins, setCheckins] = useState([])
  const [loading, setLoading] = useState(true)
  const [checkando, setCheckando] = useState(false)

  useEffect(() => { if (user) carregar() }, [user])

  async function carregar() {
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from('tarefas').select('*, obras(nome, endereco)').eq('responsavel_id', user.id).neq('status', 'concluida').order('prazo'),
      supabase.from('checkins').select('*').eq('montador_id', user.id).order('created_at', { ascending: false }).limit(10),
    ])
    setTarefas(t || [])
    setCheckins(c || [])
    setLoading(false)
  }

  async function fazerCheckin(tarefa) {
    setCheckando(true)
    await supabase.from('checkins').insert([{
      montador_id: user.id,
      obra_id: tarefa.obra_id,
      tipo: 'checkin',
      observacao: `Check-in: ${tarefa.titulo}`,
    }])
    await carregar()
    setCheckando(false)
  }

  async function fazerCheckout(tarefa) {
    setCheckando(true)
    await supabase.from('checkins').insert([{
      montador_id: user.id,
      obra_id: tarefa.obra_id,
      tipo: 'checkout',
      observacao: `Check-out: ${tarefa.titulo}`,
    }])
    await carregar()
    setCheckando(false)
  }

  async function concluirTarefa(id) {
    await supabase.from('tarefas').update({ status: 'concluida' }).eq('id', id)
    await carregar()
  }

  const ultimoCheckin = checkins[0]
  const emServico = ultimoCheckin?.tipo === 'checkin'

  const PR_COR = { baixa: '#aaa', media: '#b09a7a', alta: '#d94a4a' }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#bbb', fontFamily: 'var(--font-sans)' }}>
      Carregando...
    </div>
  )

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', padding: '24px 16px', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase' }}>Ornare Works</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 500, color: 'var(--color-ink)', margin: '4px 0 0' }}>Minhas Tarefas</h1>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#b09a7a22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#b09a7a' }}>
          {(user?.email || '?')[0].toUpperCase()}
        </div>
      </div>

      {/* Status check-in */}
      <div style={{ background: emServico ? '#edf7f0' : '#fff', border: `1px solid ${emServico ? '#5aab6e44' : 'var(--color-border)'}`, borderRadius: 14, padding: '18px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: emServico ? '#3a7d4f' : '#aaa', fontWeight: 600, marginBottom: 2 }}>
            {emServico ? '● Em serviço' : '○ Fora de serviço'}
          </div>
          {ultimoCheckin && (
            <div style={{ fontSize: 11, color: '#aaa' }}>
              Último: {new Date(ultimoCheckin.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!emServico ? (
            <button
              onClick={() => tarefas[0] && fazerCheckin(tarefas[0])}
              disabled={checkando || tarefas.length === 0}
              style={{ background: '#1a1814', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Check-in
            </button>
          ) : (
            <button
              onClick={() => tarefas[0] && fazerCheckout(tarefas[0])}
              disabled={checkando}
              style={{ background: '#d94a4a', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Check-out
            </button>
          )}
        </div>
      </div>

      {/* Tarefas do dia */}
      <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 12 }}>
        Tarefas pendentes
      </div>

      {tarefas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 0', color: '#bbb' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
          <div>Nenhuma tarefa pendente.</div>
        </div>
      ) : tarefas.map(t => (
        <div key={t.id} style={{ background: '#fff', border: '1px solid var(--color-border)', borderLeft: `4px solid ${PR_COR[t.prioridade] || '#ccc'}`, borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 4 }}>{t.titulo}</div>
          {t.descricao && <div style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginBottom: 8, lineHeight: 1.5 }}>{t.descricao}</div>}
          {t.obras?.nome && <div style={{ fontSize: 12, color: 'var(--color-gold)', marginBottom: 4 }}>📍 {t.obras.nome}</div>}
          {t.obras?.endereco && <div style={{ fontSize: 11, color: '#aaa', marginBottom: 8 }}>{t.obras.endereco}</div>}
          {t.prazo && <div style={{ fontSize: 11, color: '#aaa', marginBottom: 12 }}>📅 {new Date(t.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => fazerCheckin(t)}
              disabled={checkando}
              style={{ flex: 1, background: 'var(--color-ink)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Check-in
            </button>
            <button
              onClick={() => concluirTarefa(t.id)}
              style={{ flex: 1, background: '#edf7f0', color: '#3a7d4f', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Concluir
            </button>
          </div>
        </div>
      ))}

      {/* Histórico check-ins */}
      {checkins.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 12 }}>Histórico hoje</div>
          {checkins.slice(0, 5).map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--color-border-light)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.tipo === 'checkin' ? '#5aab6e' : '#d94a4a', flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 13, color: 'var(--color-ink)' }}>{c.tipo === 'checkin' ? 'Check-in' : 'Check-out'}</div>
              <div style={{ fontSize: 11, color: '#aaa' }}>{new Date(c.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}