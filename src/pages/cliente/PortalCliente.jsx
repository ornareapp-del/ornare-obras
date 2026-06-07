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
  const [abaAtiva, setAbaAtiva] = useState('status')

  useEffect(() => { carregar() }, [id])

  async function carregar() {
    const [{ data: o }, { data: f }, { data: c }, { data: ct }] = await Promise.all([
      supabase.from('obras').select('*').eq('id', id).single(),
      supabase.from('fotos').select('*').eq('obra_id', id).eq('aprovada', true).order('created_at', { ascending: false }),
      supabase.from('comunicados_cliente').select('*').eq('obra_id', id).order('created_at', { ascending: false }),
      supabase.from('contatos_cliente').select('*').eq('obra_id', id),
    ])
    setObra(o); setFotos(f || []); setComunicados(c || []); setContatos(ct || [])
    setLoading(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f0e0c', color: '#b09a7a', fontFamily: 'var(--font-sans)', fontSize: 13, letterSpacing: 2 }}>
      CARREGANDO...
    </div>
  )

  if (!obra) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f0e0c', color: '#666', fontFamily: 'var(--font-sans)' }}>
      Obra não encontrada.
    </div>
  )

  const progresso = obra.progresso || 0
  const supervisor = contatos[0]

  const ABAS = [
    { id: 'status', label: 'Status' },
    { id: 'fotos', label: `Fotos ${fotos.length > 0 ? `(${fotos.length})` : ''}` },
    { id: 'comunicados', label: 'Comunicados' },
    { id: 'contato', label: 'Contato' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0f0e0c', fontFamily: 'var(--font-sans)', color: '#f5f2ee' }}>
      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={preview} style={{ maxWidth: '94vw', maxHeight: '94vh', borderRadius: 8, objectFit: 'contain' }} />
          <div style={{ position: 'absolute', top: 20, right: 24, color: '#888', fontSize: 24, cursor: 'pointer' }}>✕</div>
        </div>
      )}

      {/* Header escuro premium */}
      <div style={{ background: '#1a1814', borderBottom: '1px solid #2a2520', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 600, letterSpacing: 5, color: '#f5f2ee' }}>ORNARE</div>
          <div style={{ fontSize: 8, letterSpacing: 3, color: '#b09a7a', marginTop: 1 }}>WORKS</div>
        </div>
        {supervisor?.telefone && (
          <a href={`https://wa.me/55${supervisor.telefone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#25D366', color: '#fff', borderRadius: 10,
            padding: '8px 14px', fontSize: 12, fontWeight: 600, textDecoration: 'none',
          }}>
            <span>💬</span> Falar com supervisor
          </a>
        )}
      </div>

      {/* Hero da obra */}
      <div style={{ background: 'linear-gradient(180deg, #1a1814 0%, #0f0e0c 100%)', padding: '40px 24px 32px', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ fontSize: 9, letterSpacing: 4, color: '#b09a7a', textTransform: 'uppercase', marginBottom: 10 }}>Sua Obra</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 500, color: '#f5f2ee', margin: '0 0 6px', lineHeight: 1.2 }}>{obra.nome}</h1>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 32 }}>{obra.cliente_nome} · {obra.cidade || obra.endereco}</div>

        {/* Progress ring simulado com barra */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
          {[
            { label: 'Status', value: obra.status || '—' },
            { label: 'Previsão', value: obra.data_previsao ? new Date(obra.data_previsao + 'T00:00:00').toLocaleDateString('pt-BR') : '—' },
            { label: 'Conclusão', value: `${progresso}%` },
          ].map(k => (
            <div key={k.label} style={{ background: '#1a1814', border: '1px solid #2a2520', borderRadius: 12, padding: '14px 20px', flex: 1, minWidth: 100 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: '#b09a7a', textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#f5f2ee' }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Barra de progresso */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#555', marginBottom: 8 }}>
            <span>Progresso geral</span>
            <span style={{ color: '#b09a7a', fontWeight: 600 }}>{progresso}%</span>
          </div>
          <div style={{ height: 3, background: '#2a2520', borderRadius: 2 }}>
            <div style={{ height: 3, background: 'linear-gradient(90deg, #b09a7a, #d4c4a0)', borderRadius: 2, width: `${progresso}%`, transition: 'width 1s ease' }} />
          </div>
        </div>
      </div>

      {/* Abas */}
      <div style={{ borderBottom: '1px solid #2a2520', display: 'flex', overflowX: 'auto', maxWidth: 720, margin: '0 auto' }}>
        {ABAS.map(a => (
          <button key={a.id} onClick={() => setAbaAtiva(a.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '14px 20px', fontSize: 12.5, whiteSpace: 'nowrap',
            color: abaAtiva === a.id ? '#b09a7a' : '#555',
            fontWeight: abaAtiva === a.id ? 600 : 400,
            borderBottom: abaAtiva === a.id ? '2px solid #b09a7a' : '2px solid transparent',
            marginBottom: -1, letterSpacing: 0.3,
          }}>{a.label}</button>
        ))}
      </div>

      {/* Conteúdo das abas */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 24px' }}>

        {abaAtiva === 'status' && (
          <div>
            {obra.observacoes && (
              <div style={{ background: '#1a1814', border: '1px solid #2a2520', borderRadius: 14, padding: '20px 24px', marginBottom: 16 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: '#b09a7a', textTransform: 'uppercase', marginBottom: 10 }}>Informações</div>
                <p style={{ fontSize: 14, color: '#aaa', lineHeight: 1.7, margin: 0 }}>{obra.observacoes}</p>
              </div>
            )}
            <div style={{ background: '#1a1814', border: '1px solid #2a2520', borderRadius: 14, padding: '20px 24px' }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: '#b09a7a', textTransform: 'uppercase', marginBottom: 16 }}>Detalhes</div>
              {[
                { label: 'Endereço', value: obra.endereco },
                { label: 'Cidade', value: obra.cidade },
                { label: 'Início', value: obra.data_inicio ? new Date(obra.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR') : '—' },
                { label: 'Previsão de entrega', value: obra.data_previsao ? new Date(obra.data_previsao + 'T00:00:00').toLocaleDateString('pt-BR') : '—' },
              ].map(d => (
                <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #2a2520' }}>
                  <span style={{ fontSize: 12, color: '#555' }}>{d.label}</span>
                  <span style={{ fontSize: 13, color: '#f5f2ee', fontWeight: 500 }}>{d.value || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {abaAtiva === 'fotos' && (
          <div>
            {fotos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#444' }}>Nenhuma foto disponível ainda.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                {fotos.map(f => (
                  <div key={f.id} onClick={() => setPreview(f.url)} style={{ cursor: 'zoom-in', borderRadius: 10, overflow: 'hidden', height: 140, background: '#1a1814' }}>
                    <img src={f.url} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                      onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
                      onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {abaAtiva === 'comunicados' && (
          <div>
            {comunicados.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#444' }}>Nenhum comunicado disponível.</div>
            ) : comunicados.map(c => (
              <div key={c.id} style={{ background: '#1a1814', border: '1px solid #2a2520', borderRadius: 12, padding: '18px 22px', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f5f2ee', marginBottom: 8 }}>{c.titulo}</div>
                <div style={{ fontSize: 13, color: '#888', lineHeight: 1.7 }}>{c.mensagem}</div>
                <div style={{ fontSize: 10, color: '#444', marginTop: 10, letterSpacing: 1 }}>{new Date(c.created_at).toLocaleDateString('pt-BR')}</div>
              </div>
            ))}
          </div>
        )}

        {abaAtiva === 'contato' && (
          <div>
            {contatos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#444' }}>Nenhum contato disponível.</div>
            ) : contatos.map(c => (
              <div key={c.id} style={{ background: '#1a1814', border: '1px solid #2a2520', borderRadius: 12, padding: '18px 22px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#b09a7a22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#b09a7a', flexShrink: 0 }}>
                  {(c.nome || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f5f2ee' }}>{c.nome}</div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{c.cargo}</div>
                </div>
                {c.telefone && (
                  <a href={`https://wa.me/55${c.telefone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{ background: '#25D366', color: '#fff', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                    💬 WhatsApp
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: '20px 0 40px', fontSize: 10, color: '#333', letterSpacing: 2 }}>
        ORNARE WORKS · GESTÃO PREMIUM DE OBRAS
      </div>
    </div>
  )
}