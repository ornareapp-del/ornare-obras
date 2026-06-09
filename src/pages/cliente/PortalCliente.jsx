import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import bgImage from '../../assets/ornare-milao-40-anos.jpg'

function limparTel(tel) {
  if (!tel) return ''
  var r = ''
  for (var i = 0; i < tel.length; i++) {
    if (tel[i] >= '0' && tel[i] <= '9') r += tel[i]
  }
  return r
}

export default function PortalCliente() {
  const { id } = useParams()
  const [obra, setObra] = useState(null)
  const [fotos, setFotos] = useState([])
  const [comunicados, setComunicados] = useState([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState(null)
  const [aba, setAba] = useState('status')

  useEffect(() => { carregar() }, [id])

  async function carregar() {
    const [{ data: o }, { data: f }, { data: c }] = await Promise.all([
      supabase.from('obras').select('*').eq('id', id).single(),
      supabase.from('fotos').select('*').eq('obra_id', id).eq('aprovada', true).order('created_at', { ascending: false }),
      supabase.from('comunicados_cliente').select('*').eq('obra_id', id).order('created_at', { ascending: false }),
    ])
    setObra(o)
    setFotos(f || [])
    setComunicados(c || [])
    setLoading(false)
  }

  if (loading) return (
    <div style={s.loadingScreen}>
      <img src="/logo-ornare.png" style={{ height: 48, filter: 'brightness(0) invert(1)', opacity: 0.6 }} alt="Ornare" />
    </div>
  )

  if (!obra) return (
    <div style={s.loadingScreen}>
      <div style={{ color: '#666', fontSize: 13, letterSpacing: 2 }}>OBRA NAO ENCONTRADA</div>
    </div>
  )

  const progresso = obra.progresso || 0
  const previsao = obra.data_previsao
    ? new Date(obra.data_previsao + 'T00:00:00').toLocaleDateString('pt-BR')
    : '-'

  const ABAS = [
    { id: 'status', label: 'Status' },
    { id: 'fotos', label: fotos.length > 0 ? 'Fotos (' + fotos.length + ')' : 'Fotos' },
    { id: 'comunicados', label: 'Comunicados' },
    { id: 'contato', label: 'Contato' },
  ]

  const waLink = 'https://wa.me/55' + limparTel(obra.cliente_telefone)
  const waFixed = 'https://wa.me/5548999999999'

  return (
    <div style={s.root}>

      {preview && (
        <div onClick={() => setPreview(null)} style={s.previewBg}>
          <img src={preview} style={s.previewImg} alt="Foto" />
          <button style={s.previewClose} onClick={() => setPreview(null)}>X</button>
        </div>
      )}

      <div style={s.bgWrap}>
        <img src={bgImage} style={s.bgImg} alt="" />
        <div style={s.bgOverlay} />
      </div>

      <div style={s.header}>
        <div>
          <img src="/logo-ornare.png" style={s.logoImg} alt="Ornare" />
          <div style={s.logoSub}>GESTAO DE OBRAS</div>
        </div>
        {obra.cliente_telefone && (
          <a href={waLink} target="_blank" rel="noreferrer" style={s.btnWhatsApp}>
            Falar conosco
          </a>
        )}
      </div>

      <div style={s.hero}>
        <div style={s.heroTag}>SUA OBRA</div>
        <h1 style={s.heroTitle}>{obra.nome.toUpperCase()}</h1>
        <div style={s.heroSub}>
          {obra.cliente_nome}
          {obra.cidade ? ' - ' + obra.cidade : ''}
        </div>

        <div style={s.metricsRow}>
          <div style={s.metricCard}>
            <div style={s.metricLabel}>Status</div>
            <div style={s.metricValue}>{obra.status || '-'}</div>
          </div>
          <div style={s.metricCard}>
            <div style={s.metricLabel}>Previsao</div>
            <div style={s.metricValue}>{previsao}</div>
          </div>
          <div style={s.metricCard}>
            <div style={s.metricLabel}>Conclusao</div>
            <div style={s.metricValueGold}>{progresso}%</div>
          </div>
        </div>

        <div style={s.progressWrap}>
          <div style={s.progressHeader}>
            <span style={s.progressLabel}>Progresso geral</span>
            <span style={s.progressPct}>{progresso}%</span>
          </div>
          <div style={s.progressTrack}>
            <div style={{ height: 4, background: 'linear-gradient(90deg, #B8963E, #D4AF6A)', borderRadius: 4, width: progresso + '%', transition: 'width 1.2s ease' }} />
          </div>
        </div>
      </div>

      <div style={s.tabsWrap}>
        <div style={s.tabs}>
          {ABAS.map(a => (
            <button key={a.id} onClick={() => setAba(a.id)} style={{
              ...s.tab,
              color: aba === a.id ? '#D4AF6A' : 'rgba(255,255,255,0.35)',
              borderBottom: aba === a.id ? '2px solid #D4AF6A' : '2px solid transparent',
              fontWeight: aba === a.id ? 600 : 400,
            }}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div style={s.content}>

        {aba === 'status' && (
          <div>
            <div style={{ ...s.glass, marginBottom: 16 }}>
              <div style={s.glassLabel}>Situacao atual</div>
              <div style={s.situacaoStatus}>{obra.status}</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
                {obra.data_inicio && (
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={s.glassLabel}>Inicio</div>
                    <div style={s.situacaoDetalhe}>{new Date(obra.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')}</div>
                  </div>
                )}
                {obra.data_previsao && (
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={s.glassLabel}>Previsao</div>
                    <div style={s.situacaoDetalhe}>{previsao}</div>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={s.glassLabel}>Progresso</div>
                  <div style={{ ...s.situacaoDetalhe, color: '#D4AF6A', fontWeight: 700 }}>{progresso}%</div>
                </div>
              </div>
              <div style={{ marginTop: 20 }}>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
                  <div style={{ height: 6, background: 'linear-gradient(90deg, #B8963E, #D4AF6A)', borderRadius: 4, width: progresso + '%', transition: 'width 1.2s ease' }} />
                </div>
              </div>
            </div>

            <div style={s.glass}>
              <div style={s.glassLabel}>Detalhes da obra</div>
              {[
                { label: 'Endereco', value: [obra.rua, obra.numero, obra.complemento].filter(Boolean).join(', ') || obra.endereco },
                { label: 'Bairro', value: obra.bairro },
                { label: 'Cidade', value: obra.cidade },
                { label: 'Contrato', value: obra.numero_contrato },
              ].filter(function(d) { return d.value }).map(d => (
                <div key={d.label} style={s.detailRow}>
                  <span style={s.detailLabel}>{d.label}</span>
                  <span style={s.detailValue}>{d.value}</span>
                </div>
              ))}
            </div>

            {comunicados.length > 0 && (
              <div style={{ ...s.glass, marginTop: 16 }}>
                <div style={s.glassLabel}>Ultimo comunicado</div>
                <div style={s.comunicadoText}>{comunicados[0].mensagem}</div>
                <div style={s.comunicadoData}>
                  {new Date(comunicados[0].created_at).toLocaleDateString('pt-BR')}
                </div>
              </div>
            )}
          </div>
        )}

        {aba === 'fotos' && (
          <div>
            {fotos.length === 0 ? (
              <div style={s.empty}>
                <div style={s.emptyText}>Nenhuma foto disponivel ainda</div>
                <div style={s.emptySubText}>As fotos aprovadas pela equipe aparecerao aqui</div>
              </div>
            ) : (
              <div style={s.fotoGrid}>
                {fotos.map(f => (
                  <div key={f.id} onClick={() => setPreview(f.url || f.storage_path)} style={s.fotoCard}>
                    {f.url ? (
                      <img src={f.url} style={s.fotoImg} alt={f.observacao || 'Foto'} />
                    ) : (
                      <div style={s.fotoPlaceholder}>foto</div>
                    )}
                    {f.observacao && (
                      <div style={s.fotoCaption}>{f.observacao}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {aba === 'comunicados' && (
          <div>
            {comunicados.length === 0 ? (
              <div style={s.empty}>
                <div style={s.emptyText}>Nenhum comunicado disponivel</div>
              </div>
            ) : comunicados.map(c => (
              <div key={c.id} style={{ ...s.glass, marginBottom: 12 }}>
                {c.titulo && <div style={s.comunicadoTitulo}>{c.titulo}</div>}
                <div style={s.comunicadoText}>{c.mensagem}</div>
                <div style={s.comunicadoData}>
                  {new Date(c.created_at).toLocaleDateString('pt-BR')}
                </div>
              </div>
            ))}
          </div>
        )}

        {aba === 'contato' && (
          <div>
            <div style={s.glass}>
              <div style={s.glassLabel}>Equipe responsavel</div>
              <div style={s.contatoRow}>
                <div style={s.contatoAvatar}>O</div>
                <div style={s.contatoInfo}>
                  <div style={s.contatoNome}>Ornare Florianopolis</div>
                  <div style={s.contatoCargo}>Equipe de montagem e pos-venda</div>
                </div>
              </div>
              {obra.comercial_nome && (
                <div style={{ ...s.contatoRow, marginTop: 12 }}>
                  <div style={s.contatoAvatar}>{obra.comercial_nome[0]}</div>
                  <div style={s.contatoInfo}>
                    <div style={s.contatoNome}>{obra.comercial_nome}</div>
                    <div style={s.contatoCargo}>Comercial</div>
                  </div>
                </div>
              )}
              <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a href={waFixed} target="_blank" rel="noreferrer" style={s.btnContato}>
                  WhatsApp
                </a>
                <a href="mailto:florianopolis@ornare.com.br" style={s.btnContatoOutline}>
                  E-mail
                </a>
              </div>
            </div>
          </div>
        )}

      </div>

      <div style={s.footer}>
        ORNARE - GESTAO PREMIUM DE OBRAS
      </div>

    </div>
  )
}

const s = {
  root: { minHeight: '100vh', background: '#0f0e0c', fontFamily: 'Georgia, serif', color: '#f5f2ee', position: 'relative', overflowX: 'hidden' },
  loadingScreen: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f0e0c', gap: 20 },
  bgWrap: { position: 'fixed', inset: 0, zIndex: 0 },
  bgImg: { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', opacity: 0.35, filter: 'sepia(20%) brightness(0.8)' },
  bgOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,14,12,0.55) 0%, rgba(15,14,12,0.75) 40%, rgba(15,14,12,0.92) 100%)' },
  header: { position: 'relative', zIndex: 10, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  logoImg: { height: 56, objectFit: 'contain', filter: 'brightness(0) invert(1)', display: 'block' },
  logoSub: { fontSize: 8, letterSpacing: 3, color: '#D4AF6A', marginTop: 4, textTransform: 'uppercase', fontFamily: 'Georgia, serif' },
  btnWhatsApp: { display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', color: '#D4AF6A', border: '1px solid #D4AF6A', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, textDecoration: 'none', fontFamily: 'Georgia, serif' },
  hero: { position: 'relative', zIndex: 10, padding: '48px 24px 32px', maxWidth: 680, margin: '0 auto' },
  heroTag: { fontSize: 9, letterSpacing: 4, color: '#D4AF6A', textTransform: 'uppercase', marginBottom: 12, fontFamily: 'Georgia, serif' },
  heroTitle: { fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 400, color: '#f5f2ee', margin: '0 0 8px', lineHeight: 1.25, textTransform: 'uppercase', letterSpacing: 3 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 32, fontFamily: 'Georgia, serif' },
  metricsRow: { display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' },
  metricCard: { flex: 1, minWidth: 90, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 18px' },
  metricLabel: { fontSize: 9, letterSpacing: 2, color: '#D4AF6A', textTransform: 'uppercase', marginBottom: 8, fontFamily: 'Georgia, serif' },
  metricValue: { fontSize: 14, fontWeight: 400, color: '#f5f2ee', lineHeight: 1.3, fontFamily: 'Georgia, serif' },
  metricValueGold: { fontSize: 22, fontWeight: 400, color: '#D4AF6A', fontFamily: 'Georgia, serif' },
  progressWrap: { marginTop: 4 },
  progressHeader: { display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 8, fontFamily: 'Georgia, serif' },
  progressLabel: { color: 'rgba(255,255,255,0.5)' },
  progressPct: { color: '#D4AF6A' },
  progressTrack: { height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4 },
  tabsWrap: { position: 'relative', zIndex: 10, borderBottom: '1px solid rgba(255,255,255,0.06)', maxWidth: 680, margin: '0 auto' },
  tabs: { display: 'flex', overflowX: 'auto', padding: '0 24px' },
  tab: { background: 'none', border: 'none', cursor: 'pointer', padding: '14px 18px', fontSize: 13, whiteSpace: 'nowrap', letterSpacing: 1, marginBottom: -1, transition: 'color .2s', fontFamily: 'Georgia, serif' },
  content: { position: 'relative', zIndex: 10, maxWidth: 680, margin: '0 auto', padding: '28px 24px 60px' },
  glass: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '22px 24px' },
  glassLabel: { fontSize: 9, letterSpacing: 2, color: '#D4AF6A', textTransform: 'uppercase', marginBottom: 10, fontFamily: 'Georgia, serif' },
  situacaoStatus: { fontSize: 20, fontWeight: 400, color: '#f5f2ee', fontFamily: 'Georgia, serif', marginBottom: 4 },
  situacaoDetalhe: { fontSize: 14, color: '#f5f2ee', fontFamily: 'Georgia, serif' },
  detailRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', gap: 12 },
  detailLabel: { fontSize: 12, color: 'rgba(255,255,255,0.45)', flexShrink: 0, fontFamily: 'Georgia, serif' },
  detailValue: { fontSize: 13, color: '#f5f2ee', textAlign: 'right', fontFamily: 'Georgia, serif' },
  comunicadoTitulo: { fontSize: 15, color: '#f5f2ee', marginBottom: 8, fontFamily: 'Georgia, serif' },
  comunicadoText: { fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, fontFamily: 'Georgia, serif' },
  comunicadoData: { fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 12, letterSpacing: 1, fontFamily: 'Georgia, serif' },
  fotoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 },
  fotoCard: { borderRadius: 10, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'zoom-in' },
  fotoImg: { width: '100%', height: 140, objectFit: 'cover', display: 'block' },
  fotoPlaceholder: { height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'rgba(255,255,255,0.2)', fontFamily: 'Georgia, serif' },
  fotoCaption: { padding: '8px 10px', fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Georgia, serif' },
  contatoRow: { display: 'flex', alignItems: 'center', gap: 14 },
  contatoAvatar: { width: 44, height: 44, borderRadius: '50%', background: 'rgba(212,175,106,0.15)', border: '1px solid rgba(212,175,106,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#D4AF6A', flexShrink: 0, fontFamily: 'Georgia, serif' },
  contatoInfo: { flex: 1 },
  contatoNome: { fontSize: 14, color: '#f5f2ee', fontFamily: 'Georgia, serif' },
  contatoCargo: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2, fontFamily: 'Georgia, serif' },
  btnContato: { display: 'inline-flex', alignItems: 'center', gap: 8, background: '#25D366', color: '#fff', borderRadius: 10, padding: '10px 18px', fontSize: 13, textDecoration: 'none', fontFamily: 'Georgia, serif' },
  btnContatoOutline: { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.06)', color: '#f5f2ee', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 18px', fontSize: 13, textDecoration: 'none', fontFamily: 'Georgia, serif' },
  empty: { textAlign: 'center', padding: '60px 20px' },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.25)', marginBottom: 6, fontFamily: 'Georgia, serif' },
  emptySubText: { fontSize: 12, color: 'rgba(255,255,255,0.15)', fontFamily: 'Georgia, serif' },
  previewBg: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' },
  previewImg: { maxWidth: '94vw', maxHeight: '94vh', borderRadius: 8, objectFit: 'contain' },
  previewClose: { position: 'absolute', top: 20, right: 24, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 24, cursor: 'pointer', fontFamily: 'Georgia, serif' },
  footer: { position: 'relative', zIndex: 10, textAlign: 'center', padding: '20px 0 40px', fontSize: 9, color: 'rgba(255,255,255,0.15)', letterSpacing: 3, fontFamily: 'Georgia, serif' },
}