import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const GRAV_COR = { baixa: '#5aab6e', media: '#b09a7a', alta: '#d94a4a' }

export default function Ocorrencias() {
  const navigate = useNavigate()
  const [ocorrencias, setOcorrencias] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todas')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase.from('ocorrencias').select('*, obras(nome)').order('created_at', { ascending: false })
    setOcorrencias(data || [])
    setLoading(false)
  }

  const lista = filtro === 'todas' ? ocorrencias : ocorrencias.filter(o => o.gravidade === filtro)

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 8 }}>Gestão</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 500, color: 'var(--color-ink)', margin: 0 }}>Ocorrências</h1>
        <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 6 }}>{ocorrencias.length} ocorrência{ocorrencias.length !== 1 ? 's' : ''} registrada{ocorrencias.length !== 1 ? 's' : ''}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
        {[['alta','Alta','#fdecea','#a03030'],['media','Média','#fdf3e3','#a0692a'],['baixa','Baixa','#edf7f0','#3a7d4f']].map(([g, label, bg, color]) => (
          <div key={g} style={{ background: bg, border: `1px solid ${color}22`, borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color, textTransform: 'uppercase', marginBottom: 6 }}>Gravidade {label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color }}>{ocorrencias.filter(o => o.gravidade === g).length}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['todas','alta','media','baixa'].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding: '6px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
            background: filtro === f ? 'var(--color-ink)' : '#fff',
            color: filtro === f ? '#f9f7f4' : 'var(--color-ink-muted)',
            border: filtro === f ? 'none' : '1px solid var(--color-border)',
            fontWeight: filtro === f ? 500 : 400,
          }}>{f === 'todas' ? 'Todas' : f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
      </div>

      {loading ? <div style={{ color: '#bbb' }}>Carregando...</div>
        : lista.length === 0 ? <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb' }}>Nenhuma ocorrência encontrada.</div>
        : lista.map(oc => (
          <div key={oc.id} onClick={() => oc.obra_id && navigate(`/obras/${oc.obra_id}`)} style={{ background: '#fff', border: '1px solid var(--color-border)', borderLeft: `4px solid ${GRAV_COR[oc.gravidade] || '#ccc'}`, borderRadius: 10, padding: '16px 18px', marginBottom: 10, cursor: oc.obra_id ? 'pointer' : 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' }}>{oc.titulo}</span>
              <span style={{ fontSize: 10, padding: '2px 9px', borderRadius: 20, background: '#f0ece6', color: '#888' }}>{oc.categoria}</span>
              {oc.obras?.nome && <span style={{ fontSize: 11, color: 'var(--color-gold)', marginLeft: 'auto' }}>📍 {oc.obras.nome}</span>}
            </div>
            {oc.descricao && <p style={{ margin: 0, fontSize: 13, color: 'var(--color-ink-muted)', lineHeight: 1.5 }}>{oc.descricao}</p>}
            <div style={{ fontSize: 11, color: '#bbb', marginTop: 8 }}>{new Date(oc.created_at).toLocaleDateString('pt-BR')}</div>
          </div>
        ))
      }
    </div>
  )
}