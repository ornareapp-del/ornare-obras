import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const CAT_COR = { material: '#b09a7a', mao_de_obra: '#4a90d9', transporte: '#5aab6e', ferramental: '#9070c0', outro: '#888' }
const CAT_LABEL = { material: 'Material', mao_de_obra: 'Mão de obra', transporte: 'Transporte', ferramental: 'Ferramental', outro: 'Outro' }

export default function Gastos() {
  const navigate = useNavigate()
  const [gastos, setGastos] = useState([])
  const [obras, setObras] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroObra, setFiltroObra] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const [{ data: g }, { data: o }] = await Promise.all([
      supabase.from('gastos').select('*, obras(nome)').order('created_at', { ascending: false }),
      supabase.from('obras').select('id, nome').order('nome'),
    ])
    setGastos(g || [])
    setObras(o || [])
    setLoading(false)
  }

  const lista = filtroObra ? gastos.filter(g => g.obra_id === filtroObra) : gastos
  const total = lista.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0)

  const porCategoria = Object.entries(
    lista.reduce((acc, g) => { acc[g.categoria] = (acc[g.categoria] || 0) + parseFloat(g.valor || 0); return acc }, {})
  ).sort((a, b) => b[1] - a[1])

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 8 }}>Gestão</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 500, color: 'var(--color-ink)', margin: 0 }}>Gastos</h1>
          <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 6 }}>Visão consolidada de todos os gastos operacionais</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 28 }}>
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '18px 22px' }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 8 }}>Total Geral</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-ink)' }}>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '18px 22px' }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 8 }}>Lançamentos</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-ink)' }}>{lista.length}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '18px 22px' }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 8 }}>Obras com gastos</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-ink)' }}>{new Set(lista.map(g => g.obra_id)).size}</div>
        </div>
      </div>

      {porCategoria.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: '18px 22px', marginBottom: 24 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 14 }}>Por categoria</div>
          {porCategoria.map(([cat, val]) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: CAT_COR[cat] || '#888', fontWeight: 500, minWidth: 100 }}>{CAT_LABEL[cat] || cat}</div>
              <div style={{ flex: 1, height: 6, background: '#f0ece6', borderRadius: 3 }}>
                <div style={{ height: 6, borderRadius: 3, background: CAT_COR[cat] || '#ccc', width: `${Math.round(val / total * 100)}%` }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-ink)', minWidth: 80, textAlign: 'right' }}>
                R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: '#888' }}>Filtrar por obra:</div>
        <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 12.5, fontFamily: 'inherit', background: '#fff' }}>
          <option value="">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      </div>

      {loading ? <div style={{ color: '#bbb' }}>Carregando...</div>
        : lista.length === 0 ? <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb' }}>Nenhum gasto encontrado.</div>
        : lista.map(g => (
          <div key={g.id} onClick={() => g.obra_id && navigate(`/obras/${g.obra_id}`)} style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 18px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 16, cursor: g.obra_id ? 'pointer' : 'default' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: CAT_COR[g.categoria] || '#ccc', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-ink)' }}>{g.descricao}</div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                {CAT_LABEL[g.categoria] || g.categoria}
                {g.obras?.nome ? ` · ${g.obras.nome}` : ''}
                {g.data ? ` · ${new Date(g.data + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
              </div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-ink)' }}>
              R$ {parseFloat(g.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
        ))
      }
    </div>
  )
}