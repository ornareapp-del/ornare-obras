import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import bgImage from '../../assets/ornare-milao-40-anos.jpg'

const THEME = {
  ink: '#171512',
  warm: '#F6F3EE',
  card: '#FFFEFC',
  border: '#E7E0D5',
  muted: '#6D675E',
  gold: '#B8965E',
  dark: '#0F0E0C',
}

const ABAS = [
  { id: 'andamento', label: 'Andamento' },
  { id: 'cronograma', label: 'Cronograma' },
  { id: 'fotos', label: 'Fotos' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'mensagens', label: 'Mensagens' },
  { id: 'contatos', label: 'Contatos' },
]

function safeArray(result) {
  return result?.data || []
}

function dataBR(value) {
  if (!value) return '-'
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR')
}

function nomePessoa(profile) {
  return profile?.full_name || profile?.nome || profile?.email || '-'
}

function limparTel(tel) {
  return String(tel || '').replace(/\D/g, '')
}

function fotoUrl(foto) {
  if (foto.url) return foto.url
  if (!foto.storage_path) return ''
  return supabase.storage.from('fotos-obras').getPublicUrl(foto.storage_path).data.publicUrl
}

function isAgendaCliente(item) {
  if (item.reuniao_interna) return false
  if (item.visivel_cliente === true || item.visibilidade === 'cliente' || item.visibilidade === 'publica') return true
  const tipo = String(item.tipo || item.titulo || '').toLowerCase()
  return ['visita', 'vistoria', 'montagem', 'entrega', 'assistência', 'assistencia', 'medição', 'medicao'].some(t => tipo.includes(t))
}

function isMensagemCliente(item) {
  if (item.visivel_cliente === true || item.visibilidade === 'cliente' || item.tipo === 'cliente') return true
  if (item.publico_cliente === true) return true
  return false
}

export default function PortalCliente() {
  const { id } = useParams()
  const [dados, setDados] = useState({
    obra: null,
    cronograma: null,
    fotos: [],
    ambientes: [],
    agenda: [],
    comunicados: [],
    mensagens: [],
    contatos: [],
    profiles: [],
  })
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [preview, setPreview] = useState(null)
  const [aba, setAba] = useState('andamento')
  const [filtrosFoto, setFiltrosFoto] = useState({ ambiente: '', categoria: '' })
  const [copiado, setCopiado] = useState('')

  async function carregar() {
    setLoading(true)
    setErro('')

    const [
      obra,
      cronograma,
      fotos,
      ambientes,
      agenda,
      comunicados,
      mensagens,
      contatos,
      profiles,
    ] = await Promise.all([
      supabase.from('obras').select('*').eq('id', id).single(),
      supabase.from('obra_cronograma').select('*').eq('obra_id', id).maybeSingle(),
      supabase.from('fotos').select('*').eq('obra_id', id).eq('aprovada', true).eq('visivel_cliente', true).order('created_at', { ascending: false }),
      supabase.from('obra_ambientes').select('id, nome').eq('obra_id', id),
      supabase.from('agenda').select('*').eq('obra_id', id).order('data', { ascending: true }),
      supabase.from('comunicados_cliente').select('*').eq('obra_id', id).order('created_at', { ascending: false }),
      supabase.from('mensagens_obra').select('*').eq('obra_id', id).order('created_at', { ascending: false }),
      supabase.from('contatos_cliente').select('*').eq('obra_id', id),
      supabase.from('profiles').select('id, full_name, email, role, telefone'),
    ])

    if (obra.error) {
      setErro(obra.error.message)
      setLoading(false)
      return
    }

    const falhasNaoCriticas = [cronograma, fotos, ambientes, agenda, comunicados, mensagens, contatos, profiles]
      .filter(r => r.error)
      .map(r => r.error.message)

    if (falhasNaoCriticas.length) setErro(falhasNaoCriticas[0])

    setDados({
      obra: obra.data,
      cronograma: cronograma.data || null,
      fotos: safeArray(fotos).map(foto => ({ ...foto, publicUrl: fotoUrl(foto), categoria: foto.categoria || foto.etapa || 'Geral' })),
      ambientes: safeArray(ambientes),
      agenda: safeArray(agenda).filter(isAgendaCliente),
      comunicados: safeArray(comunicados),
      mensagens: safeArray(mensagens).filter(isMensagemCliente),
      contatos: safeArray(contatos),
      profiles: safeArray(profiles),
    })
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { carregar() }, [id])

  const vm = useMemo(() => {
    const obra = dados.obra || {}
    const cronograma = dados.cronograma || {}
    const profilesPorId = new Map(dados.profiles.map(p => [p.id, p]))
    const ambientesPorId = new Map(dados.ambientes.map(a => [a.id, a]))
    const supervisor = profilesPorId.get(cronograma.supervisor_id || obra.supervisor_id)
    const posVenda = profilesPorId.get(cronograma.comercial_id || obra.comercial_id)
    const progresso = Number(cronograma.percentual_concluido ?? obra.progresso ?? 0)
    const faseAtual = cronograma.visivel_cliente === false ? (obra.status || '-') : (cronograma.fase || obra.status || '-')
    const proximaEtapa = cronograma.visivel_cliente === false ? 'Acompanhamento pela equipe Ornare' : (cronograma.acao_recomendada || cronograma.etapa_atual || 'Acompanhamento pela equipe Ornare')
    const fotos = dados.fotos.filter(f => {
      const porAmbiente = !filtrosFoto.ambiente || f.ambiente_id === filtrosFoto.ambiente
      const porCategoria = !filtrosFoto.categoria || f.categoria === filtrosFoto.categoria
      return porAmbiente && porCategoria
    })
    const categorias = [...new Set(dados.fotos.map(f => f.categoria).filter(Boolean))].sort()
    const documentos = [
      { titulo: 'Relatório do Cliente', descricao: 'PDFs liberados pela equipe aparecerão aqui.' },
      { titulo: 'Termos de Entrega', descricao: 'Documentos de aceite serão disponibilizados nesta área.' },
    ]

    return {
      obra,
      cronograma,
      supervisor,
      posVenda,
      progresso: Math.max(0, Math.min(100, progresso)),
      faseAtual,
      proximaEtapa,
      previsao: dataBR(cronograma.data_fim_prevista || obra.data_previsao),
      fotos,
      categorias,
      ambientesPorId,
      documentos,
      mensagens: [...dados.comunicados.map(c => ({ ...c, origem: 'Comunicado' })), ...dados.mensagens.map(m => ({ ...m, origem: 'Mensagem' }))],
    }
  }, [dados, filtrosFoto])

  async function copiar(texto, label) {
    if (!texto) return
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(label)
      setTimeout(() => setCopiado(''), 2200)
    } catch {
      setCopiado('')
    }
  }

  if (loading) return (
    <div className="pc-loading">
      <style>{css}</style>
      <img src="/logo-ornare.png" alt="Ornare" />
      <span>Preparando sua obra</span>
    </div>
  )

  if (!dados.obra) return (
    <div className="pc-loading">
      <style>{css}</style>
      <span>{erro || 'Obra não encontrada.'}</span>
    </div>
  )

  return (
    <main className="pc-page">
      <style>{css}</style>

      {preview && (
        <div className="pc-preview" onClick={() => setPreview(null)}>
          <img src={preview} alt="Foto ampliada" />
          <button onClick={() => setPreview(null)}>Fechar</button>
        </div>
      )}

      <section className="pc-hero">
        <img className="pc-hero-img" src={bgImage} alt="" />
        <div className="pc-hero-overlay" />
        <header className="pc-top">
          <div>
            <img src="/logo-ornare.png" alt="Ornare" />
            <span>Works</span>
          </div>
        </header>
        <div className="pc-hero-content">
          <span className="pc-eyebrow">Minha Obra</span>
          <h1>{vm.obra.nome || 'Projeto Ornare'}</h1>
          <p>{vm.obra.cliente_nome || 'Cliente'} · {[vm.obra.cidade, vm.obra.uf].filter(Boolean).join(' / ') || 'Florianópolis'}</p>
          <div className="pc-hero-meta">
            <InfoPill label="Supervisor" value={nomePessoa(vm.supervisor)} />
            <InfoPill label="Previsão" value={vm.previsao} />
          </div>
        </div>
      </section>

      <nav className="pc-tabs">
        {ABAS.map(item => (
          <button key={item.id} className={aba === item.id ? 'active' : ''} onClick={() => setAba(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>

      {erro && <div className="pc-alert">Algumas informações complementares não foram carregadas: {erro}</div>}
      {copiado && <div className="pc-toast">{copiado} copiado.</div>}

      <section className="pc-content">
        {aba === 'andamento' && (
          <div className="pc-stack">
            <Card destaque>
              <div className="pc-card-head">
                <span>Andamento Geral</span>
                <strong>{vm.progresso}%</strong>
              </div>
              <div className="pc-progress"><i style={{ width: `${vm.progresso}%` }} /></div>
              <div className="pc-status-grid">
                <Metric label="Fase atual" value={vm.faseAtual} />
                <Metric label="Próxima etapa" value={vm.proximaEtapa} />
              </div>
            </Card>

            <Card title="Resumo do projeto">
              <Detail label="Cliente" value={vm.obra.cliente_nome} />
              <Detail label="Obra" value={vm.obra.nome} />
              <Detail label="Cidade" value={[vm.obra.cidade, vm.obra.uf].filter(Boolean).join(' / ')} />
              <Detail label="Supervisor responsável" value={nomePessoa(vm.supervisor)} />
            </Card>
          </div>
        )}

        {aba === 'cronograma' && (
          <div className="pc-stack">
            <Card title="Cronograma liberado">
              <Detail label="Fase atual" value={vm.faseAtual} />
              <Detail label="Próximas etapas" value={vm.proximaEtapa} />
              <Detail label="Previsão de entrega" value={vm.previsao} />
            </Card>
            <div className="pc-timeline">
              {['Pré-Montagem', 'Montagem', 'Entrega', 'Pós-Venda'].map(fase => (
                <div key={fase} className={vm.faseAtual === fase ? 'active' : ''}>
                  <i />
                  <span>{fase}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {aba === 'fotos' && (
          <div className="pc-stack">
            <div className="pc-filter-card">
              <select value={filtrosFoto.ambiente} onChange={e => setFiltrosFoto(p => ({ ...p, ambiente: e.target.value }))}>
                <option value="">Todos os ambientes</option>
                {dados.ambientes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
              <select value={filtrosFoto.categoria} onChange={e => setFiltrosFoto(p => ({ ...p, categoria: e.target.value }))}>
                <option value="">Todas as categorias</option>
                {vm.categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {vm.fotos.length === 0 ? (
              <Empty title="Nenhuma foto disponível ainda" text="As fotos aprovadas pela equipe Ornare aparecerão aqui." />
            ) : (
              <div className="pc-gallery">
                {vm.fotos.map(foto => (
                  <button key={foto.id} onClick={() => foto.publicUrl && setPreview(foto.publicUrl)}>
                    {foto.publicUrl ? <img src={foto.publicUrl} alt={foto.observacao || foto.categoria} /> : <span>Foto</span>}
                    <div>
                      <strong>{foto.categoria}</strong>
                      <small>{vm.ambientesPorId.get(foto.ambiente_id)?.nome || 'Geral'}</small>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {aba === 'agenda' && (
          <div className="pc-stack">
            {dados.agenda.length === 0 ? (
              <Empty title="Nenhum evento liberado" text="Visitas, montagem, vistoria e entrega aparecerão aqui quando forem confirmadas." />
            ) : dados.agenda.map(item => (
              <Card key={item.id}>
                <div className="pc-agenda-row">
                  <div>
                    <span>{dataBR(item.data)}</span>
                    {item.hora_inicio && <small>{String(item.hora_inicio).slice(0, 5)}</small>}
                  </div>
                  <div>
                    <strong>{item.titulo || item.tipo || 'Compromisso'}</strong>
                    {item.observacao && <p>{item.observacao}</p>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {aba === 'documentos' && (
          <div className="pc-stack">
            {vm.documentos.map(doc => (
              <Card key={doc.titulo}>
                <div className="pc-doc">
                  <div>
                    <strong>{doc.titulo}</strong>
                    <p>{doc.descricao}</p>
                  </div>
                  <span>Em breve</span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {aba === 'mensagens' && (
          <div className="pc-stack">
            {vm.mensagens.length === 0 ? (
              <Empty title="Nenhum comunicado no momento" text="Atualizações importantes da sua obra serão centralizadas nesta área." />
            ) : vm.mensagens.map(item => (
              <Card key={`${item.origem}-${item.id}`}>
                <div className="pc-message">
                  <span>{item.origem} · {dataBR(item.created_at)}</span>
                  {item.titulo && <strong>{item.titulo}</strong>}
                  <p>{item.mensagem || item.texto || item.descricao}</p>
                </div>
              </Card>
            ))}
          </div>
        )}

        {aba === 'contatos' && (
          <div className="pc-stack">
            <Contato title="Supervisor" pessoa={vm.supervisor} onCopy={copiar} />
            <Contato title="Pós-venda" pessoa={vm.posVenda} onCopy={copiar} />
            {dados.contatos.map(contato => <Contato key={contato.id} title={contato.tipo || contato.nome || 'Contato'} pessoa={contato} onCopy={copiar} />)}
            <Contato title="Loja" pessoa={{ full_name: 'Ornare Florianópolis', email: 'florianopolis@ornare.com.br', telefone: '(48) 99999-9999' }} onCopy={copiar} />
          </div>
        )}
      </section>

      <footer className="pc-footer">ORNARE · Acompanhamento de Obra</footer>
    </main>
  )
}

function InfoPill({ label, value }) {
  return <div className="pc-pill"><span>{label}</span><strong>{value || '-'}</strong></div>
}

function Card({ title, destaque, children }) {
  return (
    <article className={destaque ? 'pc-card destaque' : 'pc-card'}>
      {title && <h2>{title}</h2>}
      {children}
    </article>
  )
}

function Metric({ label, value }) {
  return <div className="pc-metric"><span>{label}</span><strong>{value || '-'}</strong></div>
}

function Detail({ label, value }) {
  if (!value) return null
  return <div className="pc-detail"><span>{label}</span><strong>{value}</strong></div>
}

function Empty({ title, text }) {
  return <div className="pc-empty"><strong>{title}</strong>{text && <p>{text}</p>}</div>
}

function Contato({ title, pessoa, onCopy }) {
  if (!pessoa) return null
  const telefone = pessoa.telefone || pessoa.phone || pessoa.celular || ''
  const email = pessoa.email || ''
  return (
    <Card>
      <div className="pc-contact">
        <div className="pc-avatar">{nomePessoa(pessoa)[0]}</div>
        <div>
          <span>{title}</span>
          <strong>{nomePessoa(pessoa)}</strong>
          {telefone && <small>{telefone}</small>}
          {email && <small>{email}</small>}
        </div>
      </div>
      <div className="pc-contact-actions">
        {telefone && <button onClick={() => onCopy(telefone, 'Telefone')}>Copiar telefone</button>}
        {email && <a href={`mailto:${email}`}>Enviar e-mail</a>}
        {telefone && <a href={`https://wa.me/55${limparTel(telefone)}`} target="_blank" rel="noreferrer">WhatsApp</a>}
      </div>
    </Card>
  )
}

const css = `
.pc-page{min-height:100vh;background:${THEME.warm};color:${THEME.ink};font-family:var(--font-sans, Inter, system-ui, sans-serif);overflow-x:hidden}
.pc-loading{min-height:100vh;background:${THEME.dark};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;color:#fff;letter-spacing:2px;text-transform:uppercase;font-size:11px}
.pc-loading img{height:54px;filter:brightness(0) invert(1);opacity:.8}
.pc-hero{position:relative;min-height:420px;color:#fff;overflow:hidden}
.pc-hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;filter:brightness(.72) saturate(.9)}
.pc-hero-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,14,12,.52),rgba(15,14,12,.62) 48%,rgba(246,243,238,1) 100%)}
.pc-top{position:relative;z-index:2;padding:24px 22px;display:flex;justify-content:space-between;align-items:flex-start}
.pc-top img{height:48px;filter:brightness(0) invert(1)}
.pc-top span{display:block;margin-top:5px;color:${THEME.gold};font-size:9px;letter-spacing:3px;text-transform:uppercase}
.pc-hero-content{position:relative;z-index:2;max-width:920px;margin:0 auto;padding:58px 22px 92px}
.pc-eyebrow{display:block;color:${THEME.gold};font-size:10px;letter-spacing:3px;text-transform:uppercase;font-weight:900;margin-bottom:12px}
.pc-hero h1{font-family:var(--font-serif, Georgia, serif);font-size:54px;line-height:1.02;font-weight:500;margin:0;max-width:820px}
.pc-hero p{font-size:16px;color:rgba(255,255,255,.78);margin:14px 0 0}
.pc-hero-meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:28px}
.pc-pill{min-width:170px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:13px 15px;backdrop-filter:blur(10px)}
.pc-pill span{display:block;color:${THEME.gold};font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:900;margin-bottom:6px}
.pc-pill strong{display:block;color:#fff;font-size:14px;line-height:1.3}
.pc-tabs{position:sticky;top:0;z-index:10;margin:-48px auto 0;max-width:960px;display:flex;gap:6px;overflow-x:auto;padding:7px;background:rgba(255,254,252,.88);border:1px solid ${THEME.border};border-radius:16px;backdrop-filter:blur(16px);box-shadow:0 18px 40px rgba(29,28,25,.08)}
.pc-tabs button{border:0;background:transparent;color:${THEME.muted};border-radius:11px;padding:10px 13px;font-size:12px;font-weight:800;white-space:nowrap;cursor:pointer}
.pc-tabs button.active{background:${THEME.ink};color:#fff}
.pc-alert{max-width:960px;margin:14px auto 0;border:1px solid #F0C8C8;background:#FFF7F7;color:#A33E3E;border-radius:12px;padding:11px 14px;font-size:13px;font-weight:700}
.pc-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:50;background:${THEME.ink};color:#fff;border-left:3px solid ${THEME.gold};border-radius:12px;padding:11px 15px;font-size:13px;font-weight:800;box-shadow:0 12px 32px rgba(0,0,0,.18)}
.pc-content{max-width:960px;margin:0 auto;padding:24px 22px 64px}
.pc-stack{display:grid;gap:14px}
.pc-card{background:${THEME.card};border:1px solid ${THEME.border};border-radius:18px;padding:20px;box-shadow:0 18px 42px rgba(29,28,25,.055)}
.pc-card.destaque{border-top:3px solid ${THEME.gold}}
.pc-card h2{font-size:15px;margin:0 0 16px;color:${THEME.ink}}
.pc-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:16px}
.pc-card-head span{color:${THEME.muted};font-size:13px;font-weight:800}
.pc-card-head strong{font-size:42px;color:${THEME.gold};line-height:1}
.pc-progress{height:8px;background:#EEE7DC;border-radius:999px;overflow:hidden;margin-bottom:18px}
.pc-progress i{display:block;height:100%;background:linear-gradient(90deg,${THEME.gold},#D9BD80);border-radius:999px}
.pc-status-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pc-metric{border:1px solid ${THEME.border};background:#FFFBF5;border-radius:14px;padding:14px}
.pc-metric span,.pc-detail span{display:block;color:${THEME.muted};font-size:10px;letter-spacing:1.4px;text-transform:uppercase;font-weight:900;margin-bottom:6px}
.pc-metric strong{font-size:15px;color:${THEME.ink};line-height:1.35}
.pc-detail{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid ${THEME.border}}
.pc-detail:last-child{border-bottom:0}
.pc-detail strong{text-align:right;color:${THEME.ink};font-size:14px;line-height:1.35}
.pc-timeline{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.pc-timeline div{background:${THEME.card};border:1px solid ${THEME.border};border-radius:14px;padding:13px 10px;color:${THEME.muted};font-size:12px;font-weight:900;text-align:center}
.pc-timeline div.active{background:${THEME.ink};border-color:${THEME.ink};color:#fff}
.pc-timeline i{display:block;width:8px;height:8px;border-radius:50%;background:${THEME.gold};margin:0 auto 8px}
.pc-filter-card{display:grid;grid-template-columns:1fr 1fr;gap:10px;background:${THEME.card};border:1px solid ${THEME.border};border-radius:16px;padding:12px}
.pc-filter-card select{width:100%;border:1px solid ${THEME.border};background:#FFFEFC;border-radius:10px;padding:11px;font-family:inherit;color:${THEME.ink}}
.pc-gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.pc-gallery button{border:0;background:${THEME.card};border-radius:17px;overflow:hidden;padding:0;text-align:left;cursor:zoom-in;box-shadow:0 18px 42px rgba(29,28,25,.055)}
.pc-gallery img,.pc-gallery button>span{display:block;width:100%;height:240px;object-fit:cover;background:#E8E0D5}
.pc-gallery button>span{display:flex;align-items:center;justify-content:center;color:${THEME.muted}}
.pc-gallery div{padding:12px 14px}
.pc-gallery strong{display:block;font-size:13px;color:${THEME.ink}}
.pc-gallery small{display:block;color:${THEME.muted};font-size:12px;margin-top:3px}
.pc-agenda-row{display:grid;grid-template-columns:96px 1fr;gap:16px}
.pc-agenda-row span{display:block;color:${THEME.gold};font-size:13px;font-weight:900}
.pc-agenda-row small{display:block;color:${THEME.muted};margin-top:4px}
.pc-agenda-row strong,.pc-doc strong,.pc-message strong{display:block;color:${THEME.ink};font-size:15px}
.pc-agenda-row p,.pc-doc p,.pc-message p{margin:7px 0 0;color:${THEME.muted};font-size:13px;line-height:1.55}
.pc-doc{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
.pc-doc span{border:1px solid ${THEME.border};border-radius:999px;padding:6px 10px;font-size:11px;color:${THEME.muted};white-space:nowrap}
.pc-message>span{display:block;color:${THEME.gold};font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:900;margin-bottom:8px}
.pc-contact{display:flex;gap:14px;align-items:center}
.pc-avatar{width:48px;height:48px;border-radius:50%;background:#F1E6D3;color:${THEME.gold};display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;flex-shrink:0;text-transform:uppercase}
.pc-contact span{display:block;color:${THEME.gold};font-size:10px;letter-spacing:1.4px;text-transform:uppercase;font-weight:900;margin-bottom:4px}
.pc-contact strong{display:block;color:${THEME.ink};font-size:15px}
.pc-contact small{display:block;color:${THEME.muted};font-size:12px;margin-top:4px}
.pc-contact-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.pc-contact-actions button,.pc-contact-actions a{border:1px solid ${THEME.border};background:#FFFEFC;color:${THEME.ink};border-radius:10px;padding:9px 12px;font-size:12px;font-weight:800;text-decoration:none;cursor:pointer;font-family:inherit}
.pc-empty{text-align:center;background:${THEME.card};border:1px solid ${THEME.border};border-radius:18px;padding:52px 22px;color:${THEME.muted}}
.pc-empty strong{display:block;color:${THEME.ink};font-size:15px;margin-bottom:6px}
.pc-empty p{margin:0;font-size:13px;line-height:1.5}
.pc-preview{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.94);display:flex;align-items:center;justify-content:center;padding:16px;cursor:zoom-out}
.pc-preview img{max-width:96vw;max-height:92vh;border-radius:10px;object-fit:contain}
.pc-preview button{position:absolute;top:18px;right:18px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;border-radius:10px;padding:9px 12px;cursor:pointer}
.pc-footer{text-align:center;padding:8px 20px 38px;color:#A79F93;font-size:10px;letter-spacing:2px;text-transform:uppercase}
@media (max-width:640px){.pc-hero{min-height:385px}.pc-top{padding:18px 16px}.pc-top img{height:38px}.pc-hero-content{padding:50px 16px 82px}.pc-hero h1{font-size:35px}.pc-hero p{font-size:14px}.pc-pill{min-width:0;flex:1 1 140px}.pc-tabs{margin:-42px 12px 0;border-radius:14px}.pc-content{padding:18px 12px 48px}.pc-card{padding:16px;border-radius:16px}.pc-status-grid,.pc-filter-card,.pc-gallery{grid-template-columns:1fr}.pc-gallery img,.pc-gallery button>span{height:260px}.pc-timeline{grid-template-columns:1fr 1fr}.pc-agenda-row{grid-template-columns:1fr;gap:8px}.pc-detail{display:block}.pc-detail strong{text-align:left;display:block}.pc-card-head strong{font-size:36px}}
@media (max-width:360px){.pc-hero h1{font-size:30px}.pc-tabs button{padding:9px 10px}.pc-gallery img,.pc-gallery button>span{height:220px}}
`
