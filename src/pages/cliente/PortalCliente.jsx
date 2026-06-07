import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function PortalCliente() {
  const { id } = useParams()
  const [obra, setObra] = useState(null)
  const [fotos, setFotos] = useState([])
  const [comunicados, setComunicados] = useState([])
  const [contatos, setContatos] = useState([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState(null)

  useEffect(() => { carregar() }, [id])

  async function carregar() {
    const [{ data: o }, { data: f }, { data: c }, { data: ct }] = await Promise.all([
      supabase.from('obras').select('*').eq('id', id).single(),
      supabase.from('fotos').select('*').eq('obra_id', id).eq('aprovada', true).order('created_at', { ascending: false }),
      supabase.from('comunicados_cliente').select('*').eq('obra_id', id).order('created_at', { ascending: false }),
      supabase.from('contatos_cliente').select('*').eq('obra_id', id),
    ])
    setObra(o)
    setFotos(f || [])
    setComunicados(c || [])
    setContatos(ct || [])
    setLoading(false)
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'var(--font-sans)', color: '#bbb' }}>Carregando...</div>
  if (!obra) return <div style={{ padding: 40, fontFamily: 'var(--font-sans)', color: '#888' }}>Obra não encontrada.</div>

  return (
    <div style={{ minHeight: '100vh', background: '#f5f2ee', fontFamily: 'var(--font-sans)' }}>
      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={preview} style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 8, objectFit: 'contain' }} />
        </div>
      )}

      {/* Header */}
      <div style={{ background: '#1a1814', padding: '28px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, letterSpacing: 4, color: '#f5f2ee' }}>ORNARE</div>
          <div style={{ fontSize: 8, letterSpacing: 3, color: '#b09a7a', marginTop: 2 }}>WORKS</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#b09a7a', letterSpacing: 1 }}>Acompanhamento de Obra</div>
          <div style={{ fontSize: 14, color: '#f5f2ee', fontWeight: 500, marginTop: 2 }}>{obra.cliente_nome}</div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>

        {/* Status da obra */}
        <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 14, padding: '24px 28px', marginBottom: 24 }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: '#b09a7a', textTransform: 'uppercase', marginBottom: 8 }}>Sua Obra</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 500, color: '#1a1814', margin: '0 0 6px' }}>{obra.nome}</h1>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>{obra.endereco}{obra.cidade ? ` · ${obra.cidade}` : ''}</div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Status', value: obra.status },
              { label: 'Progresso', value: `${obra.progresso || 0}%` },
              { label: 'Previsão', value: obra.data_previsao ? new Date(obra.data_previsao).toLocaleDateString('pt-BR') : '—' },
            ].map(k => (
              <div key={k.label} style={{ background: '#f9f7f4', borderRadius: 10, padding: '12px 18px', minWidth: 100 }}>
                <div style={{ fontSize: 9, color: '#b09a7a', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1814' }}>{k.value}</div>
              </div>
            ))}
          </div>

          {obra.progresso > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ height: 6, background: '#f0ece6', borderRadius: 3 }}>
                <div style={{ height: 6, background: '#b09a7a', borderRadius: 3, width: `${obra.progresso}%`, transition: 'width 0.5s' }} />
              </div>
            </div>
          )}
        </div>

        {/* Comunicados */}
        {comunicados.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 14, padding: '22px 28px', marginBottom: 24 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: '#b09a7a', textTransform: 'uppercase', marginBottom: 16 }}>Comunicados</div>
            {comunicados.map(c => (
              <div key={c.id} style={{ padding: '14px 0', borderBottom: '1px solid #f0ece6' }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1a1814', marginBottom: 4 }}>{c.titulo}</div>
                <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>{c.mensagem}</div>
                <div style={{ fontSize: 11, color: '#bbb', marginTop: 6 }}>{new Date(c.created_at).toLocaleDateString('pt-BR')}</div>
              </div>
            ))}
          </div>
        )}

        {/* Fotos aprovadas */}
        {fotos.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 14, padding: '22px 28px', marginBottom: 24 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: '#b09a7a', textTransform: 'uppercase', marginBottom: 16 }}>Fotos da Obra</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {fotos.map(f => (
                <div key={f.id} onClick={() => setPreview(f.url)} style={{ cursor: 'zoom-in', borderRadius: 8, overflow: 'hidden', height: 140 }}>
                  <img src={f.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contatos */}
        {contatos.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #e8e2d9', borderRadius: 14, padding: '22px 28px' }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: '#b09a7a', textTransform: 'uppercase', marginBottom: 16 }}>Equipe de Contato</div>
            {contatos.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: '1px solid #f0ece6' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#f0ece6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#b09a7a', flexShrink: 0 }}>
                  {(c.nome || '?')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1a1814' }}>{c.nome}</div>
                  <div style={{ fontSize: 11.5, color: '#888' }}>{c.cargo}{c.telefone ? ` · ${c.telefone}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 40, fontSize: 11, color: '#ccc', letterSpacing: 1 }}>
          ORNARE WORKS · Gestão Premium de Obras
        </div>
      </div>
    </div>
  )
}