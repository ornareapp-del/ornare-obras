import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const ST = {
  'Em montagem':  { label: 'Em montagem',  bg: '#edf7f0', color: '#3a7d4f', dot: '#5aab6e' },
  'Em andamento': { label: 'Em andamento', bg: '#edf7f0', color: '#3a7d4f', dot: '#5aab6e' },
  'Concluída':    { label: 'Concluída',    bg: '#eef2f8', color: '#3a5580', dot: '#7090c0' },
  'Pausada':      { label: 'Pausada',      bg: '#fdf3e3', color: '#a0692a', dot: '#d4a055' },
  'Cancelada':    { label: 'Cancelada',    bg: '#fdecea', color: '#a03030', dot: '#d45555' },
  'Planejamento': { label: 'Planejamento', bg: '#f5f0ff', color: '#6040a0', dot: '#9070c0' },
}
function getStatus(s) {
  return ST[s] || { label: s || '—', bg: '#f0ece6', color: '#888', dot: '#ccc' }
}

export default function Obras() {
  const navigate = useNavigate()
  const [obras, setObras] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('Todas')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase.from('obras').select('*').order('created_at', { ascending: false })
    setObras(data || [])
    setLoading(false)
  }

  const statusFiltros = ['Todas', 'Em montagem', 'Em andamento', 'Pausada', 'Concluída']
  const obrasFiltradas = filtro === 'Todas' ? obras : obras.filter(o => o.status === filtro)

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1200, margin: '0 auto' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 8 }}>
            Gestão
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 500, color: 'var(--color-ink)', lineHeight: 1.1, margin: 0 }}>
            Obras
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 6 }}>
            {obras.length} obra{obras.length !== 1 ? 's' : ''} cadastrada{obras.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => navigate('/obras/nova')}
          style={{
            background: 'var(--color-ink)', color: '#f9f7f4', border: 'none',
            borderRadius: 8, padding: '10px 22px', fontSize: 12.5, fontWeight: 500, letterSpacing: 0.5,
          }}
        >
          + Nova Obra
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {statusFiltros.map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 12, border: 'none', cursor: 'pointer',
              background: filtro === f ? 'var(--color-ink)' : '#fff',
              color: filtro === f ? '#f9f7f4' : 'var(--color-ink-muted)',
              border: filtro === f ? 'none' : '1px solid var(--color-border)',
              fontWeight: filtro === f ? 500 : 400,
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ color: '#bbb', fontSize: 13, padding: 40 }}>Carregando...</div>
      ) : obrasFiltradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏗️</div>
          <div>Nenhuma obra encontrada.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {obrasFiltradas.map(obra => {
            const st = getStatus(obra.status)
            return (
              <div
                key={obra.id}
                onClick={() => navigate(`/obras/${obra.id}`)}
                style={{
                  background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12,
                  padding: '20px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 20,
                  transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' }}>{obra.nome}</span>
                    <span style={{ fontSize: 10, padding: '2px 10px', borderRadius: 20, background: st.bg, color: st.color, fontWeight: 500 }}>
                      {st.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-ink-muted)' }}>
                    {obra.cliente_nome}{obra.cidade ? ` · ${obra.cidade}` : ''}
                    {obra.data_previsao ? ` · Previsão: ${new Date(obra.data_previsao).toLocaleDateString('pt-BR')}` : ''}
                  </div>
                </div>

                {obra.progresso > 0 && (
                  <div style={{ minWidth: 120, textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-gold)', marginBottom: 4 }}>{obra.progresso}%</div>
                    <div style={{ height: 4, background: 'var(--color-border-light)', borderRadius: 2, width: 120 }}>
                      <div style={{ height: 4, background: 'var(--color-gold)', borderRadius: 2, width: `${obra.progresso}%` }} />
                    </div>
                  </div>
                )}

                <div style={{ fontSize: 18, color: 'var(--color-ink-faint)' }}>›</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}