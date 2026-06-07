import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const ST = { pendente: { label: 'Pendente', color: '#b09a7a' }, em_andamento: { label: 'Em andamento', color: '#4a90d9' }, concluida: { label: 'Concluída', color: '#5aab6e' }, bloqueada: { label: 'Bloqueada', color: '#d94a4a' } }
const PR = { baixa: { label: 'Baixa', color: '#aaa' }, media: { label: 'Média', color: '#b09a7a' }, alta: { label: 'Alta', color: '#d94a4a' } }

export default function Tarefas() {
  const navigate = useNavigate()
  const [tarefas, setTarefas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todas')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase.from('tarefas').select('*, obras(nome), responsavel:profiles(full_name)').order('created_at', { ascending: false })
    setTarefas(data || [])
    setLoading(false)
  }

  async function mudarStatus(id, status) {
    await supabase.from('tarefas').update({ status }).eq('id', id)
    await carregar()
  }

  const lista = filtro === 'todas' ? tarefas : tarefas.filter(t => t.status === filtro)

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 8 }}>Gestão</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 500, color: 'var(--color-ink)', margin: 0 }}>Tarefas</h1>
        <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 6 }}>{tarefas.length} tarefa{tarefas.length !== 1 ? 's' : ''} no total</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
        {Object.entries(ST).map(([k, { label, color }]) => (
          <div key={k} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-ink)' }}>{tarefas.filter(t => t.status === k).length}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {['todas', ...Object.keys(ST)].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{ padding: '6px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer', background: filtro === f ? 'var(--color-ink)' : '#fff', color: filtro === f ? '#f9f7f4' : 'var(--color-ink-muted)', border: filtro === f ? 'none' : '1px solid var(--color-border)', fontWeight: filtro === f ? 500 : 400 }}>
            {f === 'todas' ? 'Todas' : ST[f].label}
          </button>
        ))}
      </div>

      {loading ? <div style={{ color: '#bbb' }}>Carregando...</div>
        : lista.length === 0 ? <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb' }}>Nenhuma tarefa encontrada.</div>
        : lista.map(t => {
          const st = ST[t.status] || ST.pendente
          const pr = PR[t.prioridade] || PR.media
          return (
            <div key={t.id} style={{ background: '#fff', border: '1px solid var(--color-border)', borderLeft: `4px solid ${pr.color}`, borderRadius: 10, padding: '14px 18px', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-ink)' }}>{t.titulo}</span>
                  <span style={{ fontSize: 10, padding: '2px 9px', borderRadius: 20, background: st.color + '18', color: st.color, fontWeight: 600 }}>{st.label}</span>
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
                  {t.obras?.nome && <span onClick={() => navigate(`/obras/${t.obra_id}`)} style={{ fontSize: 11, color: 'var(--color-gold)', cursor: 'pointer' }}>📍 {t.obras.nome}</span>}
                  {t.responsavel?.full_name && <span style={{ fontSize: 11, color: '#aaa' }}>👤 {t.responsavel.full_name}</span>}
                  {t.prazo && <span style={{ fontSize: 11, color: '#aaa' }}>📅 {new Date(t.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                </div>
              </div>
              <select value={t.status} onChange={e => mudarStatus(t.id, e.target.value)} style={{ fontSize: 11.5, padding: '5px 9px', borderRadius: 7, border: '1px solid #ddd', background: '#fafaf8', color: st.color, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                {Object.entries(ST).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
          )
        })
      }
    </div>
  )
}