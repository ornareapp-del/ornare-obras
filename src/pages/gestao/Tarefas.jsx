import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { EmptyState, KpiCard, PageHeader, StatusBadge } from '../../components/DesignSystem'
import { theme } from '../../constants/theme'

const ST = {
  pendente: { label: 'Pendente', tone: 'warning', color: 'var(--status-warning)' },
  em_andamento: { label: 'Em andamento', tone: 'info', color: 'var(--status-info)' },
  concluida: { label: 'Concluída', tone: 'success', color: 'var(--status-success)' },
  bloqueada: { label: 'Bloqueada', tone: 'danger', color: 'var(--status-danger)' },
}

const PR = {
  baixa: { label: 'Baixa', color: 'var(--graphite-light)' },
  media: { label: 'Média', color: 'var(--status-warning)' },
  alta: { label: 'Alta', color: 'var(--status-danger)' },
}

export default function Tarefas() {
  const navigate = useNavigate()
  const location = useLocation()
  const [tarefas, setTarefas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todas')
  const tarefaDestaque = new URLSearchParams(location.search).get('tarefa')

  async function carregar() {
    const { data } = await supabase.from('tarefas').select('*, obras(nome), responsavel:profiles(full_name)').order('created_at', { ascending: false })
    setTarefas(data || [])
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [])

  useEffect(() => {
    if (!tarefaDestaque || loading) return
    const timer = window.setTimeout(() => {
      document.getElementById(`tarefa-${tarefaDestaque}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [tarefaDestaque, loading])

  async function mudarStatus(id, status) {
    await supabase.from('tarefas').update({ status }).eq('id', id)
    await carregar()
  }

  const lista = tarefaDestaque || filtro === 'todas' ? tarefas : tarefas.filter(t => t.status === filtro)

  return (
    <div className="ow-page" style={{ width: '100%', padding: '40px 48px', maxWidth: 'none', margin: 0, background: theme.background, color: theme.textPrimary, fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', overflowX: 'hidden' }}>
      <PageHeader
        eyebrow="Gestão"
        title="Tarefas"
        subtitle={`${tarefas.length} tarefa${tarefas.length !== 1 ? 's' : ''} no total`}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
        {Object.entries(ST).map(([key, status]) => (
          <KpiCard key={key} label={status.label} value={tarefas.filter(t => t.status === key).length} tone={status.tone} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {['todas', ...Object.keys(ST)].map(item => (
          <button
            key={item}
            onClick={() => setFiltro(item)}
            style={{
              padding: '7px 16px',
              borderRadius: 20,
              fontSize: 12,
              cursor: 'pointer',
              background: filtro === item ? theme.gold : theme.surface,
              color: filtro === item ? theme.background : theme.textSecondary,
              border: filtro === item ? 'none' : `1px solid ${theme.border}`,
              fontWeight: filtro === item ? 800 : 600,
            }}
          >
            {item === 'todas' ? 'Todas' : ST[item].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--graphite-light)' }}>Carregando...</div>
      ) : lista.length === 0 ? (
        <EmptyState title="Nenhuma tarefa encontrada" text="As tarefas da operação aparecerão aqui." />
      ) : lista.map(tarefa => {
        const status = ST[tarefa.status] || ST.pendente
        const prioridade = PR[tarefa.prioridade] || PR.media
        const destaque = tarefaDestaque && tarefa.id === tarefaDestaque
        return (
          <div
            id={`tarefa-${tarefa.id}`}
            key={tarefa.id}
            style={{
              background: destaque ? theme.surfaceElevated : theme.surface,
              border: destaque ? `2px solid ${theme.gold}` : `1px solid ${theme.border}`,
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: theme.textPrimary, lineHeight: 1.35 }}>{tarefa.titulo}</span>
                <div style={{ marginTop: 6 }}>
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </div>
              </div>
              <select value={tarefa.status} onChange={e => mudarStatus(tarefa.id, e.target.value)} style={{ background: theme.inputBackground, color: theme.inputText, border: '1px solid ' + theme.inputBorder, borderRadius: 6, padding: '6px 10px', width: 160, fontSize: 13, outline: 'none', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                {Object.entries(ST).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: theme.textSecondary }}>
              {tarefa.obras?.nome && (
                <button onClick={() => navigate(`/obras/${tarefa.obra_id}`)} style={{ border: 0, background: 'transparent', padding: 0, fontSize: 13, color: 'var(--color-gold)', cursor: 'pointer' }}>
                  Obra: {tarefa.obras.nome}
                </button>
              )}
              {tarefa.responsavel?.full_name && <span style={{ color: theme.textSecondary }}>Responsável: {tarefa.responsavel.full_name}</span>}
              {tarefa.prazo && <span style={{ color: theme.textSecondary }}>Prazo: {new Date(tarefa.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
              {prioridade.label && <span style={{ color: prioridade.color }}>Prioridade: {prioridade.label}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
