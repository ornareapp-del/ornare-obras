import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'

const PR_COR   = { baixa: '#aaa', media: '#b09a7a', alta: '#d94a4a' }
const PR_LABEL = { baixa: 'Baixa', media: 'Media', alta: 'Alta' }

export default function MontadorDashboard() {
  const { user, profile } = useStore()

  // dados principais
  const [obras,     setObras]     = useState([])   // obras onde esta alocado
  const [obraAtiva, setObraAtiva] = useState(null) // obra selecionada
  const [tarefas,   setTarefas]   = useState([])
  const [checkins,  setCheckins]  = useState([])
  const [checklist, setChecklist] = useState([])
  const [fotos,     setFotos]     = useState([])

  // ui states
  const [loading,          setLoading]          = useState(true)
  const [checkando,        setCheckando]        = useState(false)
  const [uploading,        setUploading]        = useState(false)
  const [salvandoProblema, setSalvandoProblema] = useState(false)
  const [modalProblema,    setModalProblema]    = useState(null)
  const [problema,         setProblema]         = useState('')
  const [sucesso,          setSucesso]          = useState('')
  const [abaAtiva,         setAbaAtiva]         = useState('tarefas') // tarefas | checklist | fotos
  const [preview,          setPreview]          = useState(null)

  useEffect(() => { if (user) carregarObras() }, [user])
  useEffect(() => { if (obraAtiva) carregarDadosObra() }, [obraAtiva])

  // ─── CARREGAR OBRAS ALOCADAS ───────────────────────────────────────────────
  async function carregarObras() {
    const { data } = await supabase
      .from('obra_montadores')
      .select('obra_id, obras(id, nome, status, endereco, rua, numero, complemento, bairro, cidade, uf, data_inicio, data_previsao, progresso)')
      .eq('montador_id', user.id)

    const lista = (data || []).map(d => d.obras).filter(Boolean)
    setObras(lista)

    // seleciona automaticamente a primeira obra ativa
    const ativa = lista.find(o => ['Em montagem', 'Em andamento', 'Montagem agendada'].includes(o.status)) || lista[0]
    setObraAtiva(ativa || null)
    setLoading(false)
  }

  // ─── CARREGAR DADOS DA OBRA ATIVA ─────────────────────────────────────────
  async function carregarDadosObra() {
    if (!obraAtiva) return
    const [
      { data: t },
      { data: c },
      { data: cl },
      { data: f },
    ] = await Promise.all([
      supabase.from('tarefas')
        .select('*')
        .eq('obra_id', obraAtiva.id)
        .eq('responsavel_id', user.id)
        .neq('status', 'concluida')
        .order('prazo'),
      supabase.from('checkins')
        .select('*')
        .eq('user_id', user.id)
        .eq('obra_id', obraAtiva.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase.from('checklist_items')
        .select('*')
        .eq('obra_id', obraAtiva.id)
        .order('created_at'),
      supabase.from('fotos')
        .select('*')
        .eq('obra_id', obraAtiva.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    setTarefas(t   || [])
    setCheckins(c  || [])
    setChecklist(cl || [])
    setFotos(f     || [])
  }

  // ─── CHECK-IN COM GEO ─────────────────────────────────────────────────────
  async function fazerCheckin() {
    if (!obraAtiva) return
    setCheckando(true)

    let lat = null
    let lng = null

    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      )
      lat = pos.coords.latitude
      lng = pos.coords.longitude
    } catch {
      // geolocalizacao negada ou indisponivel — registra sem coordenadas
    }

    await supabase.from('checkins').insert([{
      user_id:  user.id,
      obra_id:  obraAtiva.id,
      entrada:  new Date().toISOString(),
      latitude:  lat,
      longitude: lng,
    }])

    mostrarSucesso(lat ? 'Check-in registrado com localizacao!' : 'Check-in registrado!')
    await carregarDadosObra()
    setCheckando(false)
  }

  // ─── CHECK-OUT ────────────────────────────────────────────────────────────
  async function fazerCheckout() {
    setCheckando(true)
    const ultimo = checkins.find(c => !c.saida)
    if (ultimo) {
      await supabase.from('checkins').update({ saida: new Date().toISOString() }).eq('id', ultimo.id)
    }
    mostrarSucesso('Check-out registrado!')
    await carregarDadosObra()
    setCheckando(false)
  }

  // ─── STATUS TAREFA ────────────────────────────────────────────────────────
  async function mudarStatus(id, status) {
    await supabase.from('tarefas').update({ status }).eq('id', id)
    await carregarDadosObra()
  }

  // ─── TOGGLE CHECKLIST ─────────────────────────────────────────────────────
  async function toggleChecklist(item) {
    await supabase.from('checklist_items').update({ concluido: !item.concluido }).eq('id', item.id)
    await carregarDadosObra()
  }

  // ─── UPLOAD FOTO ──────────────────────────────────────────────────────────
  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file || !obraAtiva) return
    setUploading(true)

    const ext  = file.name.split('.').pop()
    const path = obraAtiva.id + '/' + Date.now() + '.' + ext

    const { error: upErr } = await supabase.storage.from('fotos-obras').upload(path, file)
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('fotos-obras').getPublicUrl(path)
      await supabase.from('fotos').insert([{
        obra_id:      obraAtiva.id,
        enviado_por:  user.id,
        url:          urlData.publicUrl,
        aprovada:     false,
        observacao:   file.name,
        storage_path: path,
      }])
      mostrarSucesso('Foto enviada!')
      await carregarDadosObra()
    } else {
      mostrarSucesso('Erro ao enviar foto.')
    }

    setUploading(false)
    e.target.value = ''
  }

  // ─── REGISTRAR PROBLEMA ───────────────────────────────────────────────────
  async function salvarProblema() {
    if (!problema.trim() || !obraAtiva) return
    setSalvandoProblema(true)
    await supabase.from('ocorrencias').insert([{
      obra_id:    obraAtiva.id,
      criado_por: user.id,
      tipo:       'Problema tecnico',
      titulo:     modalProblema?.titulo || 'Problema reportado pelo montador',
      descricao:  problema,
      gravidade:  'media',
      status:     'Aberta',
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

  const emServico   = checkins.some(c => !c.saida)
  const ultimoCI    = checkins[0]
  const clConcluidos = checklist.filter(i => i.concluido).length
  const clPct       = checklist.length > 0 ? Math.round(clConcluidos / checklist.length * 100) : 0

  // ── helpers de endereco
  function enderecoObra(o) {
    if (!o) return ''
    const partes = [o.rua, o.numero, o.complemento].filter(Boolean).join(', ')
    const cidade  = [o.bairro, o.cidade, o.uf].filter(Boolean).join(' - ')
    return [partes || o.endereco, cidade].filter(Boolean).join(' · ')
  }

  // ─── LOADING ──────────────────────────────────────────────────────────────
  if (loading) return <div style={s.loading}>Carregando...</div>

  // ─── SEM OBRA ALOCADA ─────────────────────────────────────────────────────
  if (!obraAtiva) return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <div style={s.breadcrumb}>Ornare Works</div>
          <h1 style={s.title}>Ola, {profile?.full_name?.split(' ')[0] || 'Montador'}</h1>
        </div>
        <div style={s.avatar}>{(profile?.full_name || user?.email || '?')[0].toUpperCase()}</div>
      </div>
      <div style={s.emptyBox}>
        <div style={s.emptyIcon}>🔧</div>
        <div style={s.emptyText}>Nenhuma obra alocada</div>
        <div style={s.emptySub}>Aguarde seu supervisor alocar voce em uma obra.</div>
      </div>
    </div>
  )

  // ─── RENDER PRINCIPAL ─────────────────────────────────────────────────────
  return (
    <div style={s.root}>

      {/* Modal preview foto */}
      {preview && (
        <div onClick={() => setPreview(null)} style={s.previewBg}>
          <img src={preview} alt="preview" style={s.previewImg} />
        </div>
      )}

      {/* Modal problema */}
      {modalProblema && (
        <div style={s.modalBg} onClick={e => e.target === e.currentTarget && setModalProblema(null)}>
          <div style={s.modal}>
            <div style={s.modalTitle}>Registrar Problema</div>
            <div style={s.modalSub}>{typeof modalProblema === 'string' ? modalProblema : modalProblema.titulo || 'Ocorrencia geral'}</div>
            <textarea style={s.textarea} value={problema} onChange={e => setProblema(e.target.value)} placeholder="Descreva o problema..." rows={4} />
            <div style={s.modalBtns}>
              <button style={s.btnCancel} onClick={() => { setModalProblema(null); setProblema('') }}>Cancelar</button>
              <button style={s.btnDanger} onClick={salvarProblema} disabled={salvandoProblema}>
                {salvandoProblema ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {sucesso && <div style={s.toast}>{sucesso}</div>}

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={s.header}>
        <div>
          <div style={s.breadcrumb}>Ornare Works</div>
          <h1 style={s.title}>Ola, {profile?.full_name?.split(' ')[0] || 'Montador'}</h1>
          <div style={s.date}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
        <div style={s.avatar}>{(profile?.full_name || user?.email || '?')[0].toUpperCase()}</div>
      </div>

      {/* ── SELETOR DE OBRA (se alocado em mais de uma) ─────────────────────── */}
      {obras.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <div style={s.sectionLabel}>Obra ativa</div>
          <select
            value={obraAtiva?.id || ''}
            onChange={e => {
              const ob = obras.find(o => o.id === e.target.value)
              setObraAtiva(ob)
            }}
            style={s.obraSelect}>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
      )}

      {/* ── CARD DA OBRA ───────────────────────────────────────────────────── */}
      <div style={s.obraCard}>
        <div style={s.obraCardTop}>
          <div style={{ flex: 1 }}>
            <div style={s.obraNome}>{obraAtiva.nome}</div>
            <div style={s.obraEndereco}>{enderecoObra(obraAtiva)}</div>
          </div>
          {obraAtiva.progresso > 0 && (
            <div style={s.obraProgresso}>
              <div style={s.obraProgressoNum}>{obraAtiva.progresso}%</div>
              <div style={s.obraProgressoLabel}>progresso</div>
            </div>
          )}
        </div>
        {obraAtiva.data_previsao && (
          <div style={s.obraPrevisao}>
            Previsao de termino: {new Date(obraAtiva.data_previsao + 'T00:00:00').toLocaleDateString('pt-BR')}
          </div>
        )}
      </div>

      {/* ── CHECK-IN ───────────────────────────────────────────────────────── */}
      <div style={{ ...s.checkinCard, background: emServico ? '#edf7f0' : '#fff', borderColor: emServico ? '#5aab6e44' : 'var(--color-border)' }}>
        <div>
          <div style={{ ...s.checkinStatus, color: emServico ? '#3a7d4f' : '#aaa' }}>
            {emServico ? 'Em servico' : 'Fora de servico'}
          </div>
          {ultimoCI && (
            <div style={s.checkinHora}>
              {emServico ? 'Entrada' : 'Ultimo'}: {new Date(ultimoCI.entrada || ultimoCI.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              {ultimoCI.latitude && <span style={{ marginLeft: 6, color: '#5aab6e' }}>📍</span>}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {emServico ? (
            <button style={s.btnCheckout} onClick={fazerCheckout} disabled={checkando}>
              {checkando ? '...' : 'Check-out'}
            </button>
          ) : (
            <button style={s.btnCheckin} onClick={fazerCheckin} disabled={checkando}>
              {checkando ? '...' : 'Check-in'}
            </button>
          )}
          <button style={s.btnProblemaFloat} onClick={() => setModalProblema('Ocorrencia geral')}>
            !
          </button>
        </div>
      </div>

      {/* ── ABAS ────────────────────────────────────────────────────────────── */}
      <div style={s.abas}>
        {[
          { id: 'tarefas',   label: 'Tarefas',   badge: tarefas.length   },
          { id: 'checklist', label: 'Checklist', badge: clPct + '%'      },
          { id: 'fotos',     label: 'Fotos',     badge: fotos.length     },
        ].map(a => (
          <button key={a.id} onClick={() => setAbaAtiva(a.id)} style={{
            ...s.abaBtn,
            borderBottom: abaAtiva === a.id ? '2px solid var(--color-gold)' : '2px solid transparent',
            color: abaAtiva === a.id ? 'var(--color-gold)' : 'var(--color-ink-muted)',
            fontWeight: abaAtiva === a.id ? 600 : 400,
          }}>
            {a.label}
            {a.badge !== undefined && a.badge !== 0 && (
              <span style={s.abaBadge}>{a.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── ABA TAREFAS ─────────────────────────────────────────────────────── */}
      {abaAtiva === 'tarefas' && (
        <div>
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
              {t.descricao && <div style={s.tarefaDesc}>{t.descricao}</div>}
              {t.prazo && (
                <div style={s.tarefaMeta}>
                  <span>Prazo: {new Date(t.prazo + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                </div>
              )}
              <div style={s.statusRow}>
                {['pendente', 'em_andamento', 'concluida'].map(st => (
                  <button key={st} onClick={() => mudarStatus(t.id, st)} style={{
                    ...s.statusBtn,
                    background: t.status === st ? 'var(--color-ink)' : '#f5f5f5',
                    color:      t.status === st ? '#fff' : '#888',
                  }}>
                    {st === 'pendente' ? 'Pendente' : st === 'em_andamento' ? 'Em andamento' : 'Concluida'}
                  </button>
                ))}
              </div>
              <div style={s.acoesRow}>
                <button style={s.btnProblema} onClick={() => setModalProblema(t)}>
                  Relatar problema
                </button>
                <button style={s.btnConcluir} onClick={() => mudarStatus(t.id, 'concluida')}>
                  Concluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ABA CHECKLIST ───────────────────────────────────────────────────── */}
      {abaAtiva === 'checklist' && (
        <div>
          {checklist.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-ink-muted)', marginBottom: 6 }}>
                <span>{clConcluidos} de {checklist.length} itens concluidos</span>
                <span style={{ color: 'var(--color-gold)', fontWeight: 600 }}>{clPct}%</span>
              </div>
              <div style={s.progressBg}>
                <div style={{ ...s.progressBar, width: clPct + '%' }} />
              </div>
            </div>
          )}
          {checklist.length === 0 ? (
            <div style={s.emptyBox}>
              <div style={s.emptyIcon}>📋</div>
              <div style={s.emptyText}>Checklist vazio</div>
              <div style={s.emptySub}>Nenhum item nesta obra ainda.</div>
            </div>
          ) : checklist.map(item => (
            <div key={item.id} onClick={() => toggleChecklist(item)} style={{ ...s.checkItem, borderColor: item.concluido ? '#5aab6e44' : 'var(--color-border)', background: item.concluido ? '#f6fcf8' : '#fff' }}>
              <div style={{ ...s.checkBox, borderColor: item.concluido ? '#5aab6e' : '#ddd', background: item.concluido ? '#5aab6e' : 'transparent' }}>
                {item.concluido && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>v</span>}
              </div>
              <span style={{ fontSize: 14, color: item.concluido ? '#aaa' : 'var(--color-ink)', textDecoration: item.concluido ? 'line-through' : 'none', flex: 1 }}>
                {item.descricao}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── ABA FOTOS ───────────────────────────────────────────────────────── */}
      {abaAtiva === 'fotos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--color-ink-muted)' }}>
              {fotos.length} foto{fotos.length !== 1 ? 's' : ''} enviada{fotos.length !== 1 ? 's' : ''}
            </div>
            <label style={s.btnUpload}>
              {uploading ? 'Enviando...' : '📷 Enviar foto'}
              <input type="file" accept="image/*" capture="environment" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
            </label>
          </div>
          {fotos.length === 0 ? (
            <div style={s.emptyBox}>
              <div style={s.emptyIcon}>📷</div>
              <div style={s.emptyText}>Nenhuma foto enviada</div>
              <div style={s.emptySub}>Registre o andamento da obra com fotos.</div>
            </div>
          ) : (
            <div style={s.fotoGrid}>
              {fotos.map(f => (
                <div key={f.id} style={s.fotoItem} onClick={() => setPreview(f.url)}>
                  <img src={f.url} alt={f.observacao} style={s.fotoThumb} />
                  {f.aprovada && (
                    <div style={s.fotoAprovada}>✓</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── HISTORICO DE CHECKINS ───────────────────────────────────────────── */}
      {checkins.length > 0 && (
        <div style={{ marginTop: 28, marginBottom: 40 }}>
          <div style={s.sectionLabel}>Historico de hoje</div>
          {checkins.slice(0, 5).map(c => (
            <div key={c.id} style={s.historicoItem}>
              <div style={{ ...s.historicoDot, background: c.saida ? '#d94a4a' : '#5aab6e' }} />
              <div style={s.historicoTexto}>{c.saida ? 'Check-out' : 'Check-in'}</div>
              <div style={s.historicoHora}>
                {new Date(c.entrada || c.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                {c.latitude && <span style={{ marginLeft: 4, color: '#5aab6e', fontSize: 10 }}>📍</span>}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const s = {
  root:    { maxWidth: 480, margin: '0 auto', padding: '24px 16px', fontFamily: 'var(--font-sans)', background: 'var(--sand, #f9f7f4)', minHeight: '100vh' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#bbb' },

  // header
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  breadcrumb:{ fontSize: 9, letterSpacing: 3, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 4 },
  title:     { fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 500, color: 'var(--color-ink)', margin: '0 0 2px' },
  date:      { fontSize: 12, color: 'var(--color-ink-muted)' },
  avatar:    { width: 42, height: 42, borderRadius: '50%', background: '#b09a7a22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#b09a7a', flexShrink: 0 },

  // seletor de obra
  obraSelect: { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--color-border)', fontSize: 13, fontFamily: 'inherit', background: '#fff', color: 'var(--color-ink)' },

  // card obra
  obraCard:        { background: 'var(--color-ink)', borderRadius: 14, padding: '18px 20px', marginBottom: 16 },
  obraCardTop:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  obraNome:        { fontSize: 17, fontWeight: 600, color: '#f9f7f4', marginBottom: 4, fontFamily: 'var(--font-serif)' },
  obraEndereco:    { fontSize: 12, color: '#b09a7a', lineHeight: 1.5 },
  obraProgresso:   { textAlign: 'right', flexShrink: 0 },
  obraProgressoNum:{ fontSize: 22, fontWeight: 700, color: 'var(--color-gold)' },
  obraProgressoLabel: { fontSize: 9, color: '#b09a7a', textTransform: 'uppercase', letterSpacing: 1 },
  obraPrevisao:    { fontSize: 11, color: '#888', borderTop: '1px solid #ffffff18', paddingTop: 8, marginTop: 4 },

  // checkin
  checkinCard:   { border: '1px solid', borderRadius: 14, padding: '16px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  checkinStatus: { fontSize: 13, fontWeight: 600, marginBottom: 4 },
  checkinHora:   { fontSize: 11, color: '#aaa' },
  btnCheckin:    { background: 'var(--color-ink)', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnCheckout:   { background: '#d94a4a', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnProblemaFloat: { background: '#fff3e0', color: '#e65100', border: 'none', borderRadius: 10, padding: '13px 16px', fontSize: 16, fontWeight: 700, cursor: 'pointer' },

  // abas
  abas:    { display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: 20 },
  abaBtn:  { flex: 1, background: 'none', border: 'none', padding: '10px 4px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: -1 },
  abaBadge:{ background: 'var(--color-gold)', color: '#fff', borderRadius: 20, fontSize: 10, fontWeight: 700, padding: '1px 7px', minWidth: 18, textAlign: 'center' },

  sectionLabel: { fontSize: 9, letterSpacing: 2, color: 'var(--color-gold)', textTransform: 'uppercase', marginBottom: 12 },

  // tarefas
  tarefaCard:   { background: '#fff', border: '1px solid var(--color-border)', borderLeft: '4px solid', borderRadius: 12, padding: '16px 18px', marginBottom: 12 },
  tarefaHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  tarefaTitulo: { fontSize: 15, fontWeight: 600, color: 'var(--color-ink)', flex: 1, marginRight: 8 },
  prioridade:   { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 },
  tarefaDesc:   { fontSize: 13, color: 'var(--color-ink-muted)', marginBottom: 8, lineHeight: 1.5 },
  tarefaMeta:   { display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, color: '#aaa', marginBottom: 12 },
  statusRow:    { display: 'flex', gap: 6, marginBottom: 12 },
  statusBtn:    { flex: 1, border: 'none', borderRadius: 6, padding: '7px 4px', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  acoesRow:     { display: 'flex', gap: 8 },
  btnProblema:  { flex: 1, background: '#fff3e0', color: '#e65100', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnConcluir:  { flex: 1, background: '#edf7f0', color: '#3a7d4f', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' },

  // checklist
  progressBg:  { height: 6, background: 'var(--color-border, #e8e4de)', borderRadius: 3 },
  progressBar: { height: 6, background: 'var(--color-gold)', borderRadius: 3, transition: 'width .3s' },
  checkItem:   { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1px solid', borderRadius: 12, marginBottom: 8, cursor: 'pointer', transition: 'background .15s' },
  checkBox:    { width: 22, height: 22, borderRadius: 6, border: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  // fotos
  btnUpload: { background: 'var(--color-ink)', color: '#f9f7f4', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  fotoGrid:  { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  fotoItem:  { position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '1', cursor: 'zoom-in', background: '#f0ece6' },
  fotoThumb: { width: '100%', height: '100%', objectFit: 'cover' },
  fotoAprovada: { position: 'absolute', bottom: 4, right: 4, background: '#5aab6e', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 },

  // historico
  historicoItem:  { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--color-border)' },
  historicoDot:   { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  historicoTexto: { flex: 1, fontSize: 13, color: 'var(--color-ink)' },
  historicoHora:  { fontSize: 11, color: '#aaa' },

  // empty
  emptyBox:  { textAlign: 'center', padding: '50px 20px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12 },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyText: { fontSize: 15, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 4 },
  emptySub:  { fontSize: 13, color: '#aaa' },

  // toast
  toast: { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--color-ink)', color: '#fff', padding: '12px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 1000, borderLeft: '3px solid var(--color-gold)', whiteSpace: 'nowrap' },

  // modal
  modalBg:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 },
  modal:      { background: '#fff', borderRadius: 14, padding: '24px 20px', width: '100%', maxWidth: 480 },
  modalTitle: { fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500, marginBottom: 4 },
  modalSub:   { fontSize: 13, color: '#888', marginBottom: 16 },
  textarea:   { width: '100%', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', outline: 'none' },
  modalBtns:  { display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' },
  btnCancel:  { background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', color: '#888' },
  btnDanger:  { background: '#d94a4a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },

  // preview foto
  previewBg:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' },
  previewImg: { maxWidth: '95vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' },
}
