import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import bgImage from '../../assets/ornare-milao-40-anos.jpg'
import { FASES_ORNARE, faseOrnarePorKey, faseOrnarePorTexto, indiceFaseOrnare } from '../../constants/fasesOrnare'

const THEME = {
  ink: '#1A1A1A',
  warm: '#F5F0EB',
  card: '#FFFFFF',
  border: '#E7E0D5',
  muted: '#6D675E',
  soft: '#9E9E9E',
  gold: '#C9A96E',
  dark: '#0F0E0C',
  success: '#1F6B43',
  danger: '#B44747',
  inputBackground: '#272320',
  inputBorder: '#3D3830',
  inputText: '#F5F0E8',
}

const DESKTOP_NAV = [
  { id: 'obra', label: 'Obra' },
  { id: 'cronograma', label: 'Cronograma' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'fotos', label: 'Fotos' },
  { id: 'mensagens', label: 'Mensagens' },
  { id: 'contatos', label: 'Contatos' },
  { id: 'docs', label: 'Docs' },
]

const MOBILE_NAV = [
  { id: 'obra', label: 'Obra', icon: '⌂' },
  { id: 'agenda', label: 'Agenda', icon: '◷' },
  { id: 'fotos', label: 'Fotos', icon: '▣' },
  { id: 'mensagens', label: 'Mensagens', icon: '◇' },
  { id: 'contatos', label: 'Contatos', icon: '☎' },
  { id: 'docs', label: 'Docs', icon: '▤' },
]

const MARCOS_CLIENTE = [
  { label: 'Pedido confirmado', fases: ['vistoria_medida', 'executivo'] },
  { label: 'Em produção', fases: ['producao'] },
  { label: 'Pronto para montagem', fases: ['vistoria_tecnica', 'entrega_moveis'] },
  { label: 'Em montagem', fases: ['montagem', 'montagem_finalizada'] },
  { label: 'Entregue', fases: ['vistoria_final', 'obra_concluida'] },
]

function safeArray(result) {
  return result?.data || []
}

function dataBR(value) {
  if (!value) return '-'
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR')
}

function normalizar(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
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
  const tipo = normalizar(item.tipo || item.titulo)
  return ['visita', 'vistoria', 'montagem', 'entrega', 'assistencia', 'medicao'].some(t => tipo.includes(t))
}

function isMensagemCliente(item) {
  if (item.visivel_cliente === true || item.visibilidade === 'cliente' || item.tipo === 'cliente') return true
  if (item.publico_cliente === true) return true
  return false
}

function tabelaNaoEncontrada(error) {
  if (!error) return false
  const msg = `${error.code || ''} ${error.message || ''}`.toLowerCase()
  return msg.includes('pgrst205') || msg.includes('could not find the table') || msg.includes('schema cache')
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
    mensagensCliente: [],
    contatos: [],
    profiles: [],
    documentos: [],
  })
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState('obra')
  const [preview, setPreview] = useState(null)
  const [touchStart, setTouchStart] = useState(null)
  const [filtrosFoto, setFiltrosFoto] = useState({ ambiente: '', categoria: '' })
  const [copiado, setCopiado] = useState('')
  const [usuario, setUsuario] = useState(null)
  const [textoMensagem, setTextoMensagem] = useState('')
  const [enviandoMensagem, setEnviandoMensagem] = useState(false)
  const [mensagemStatus, setMensagemStatus] = useState('')
  const [agendaStatus, setAgendaStatus] = useState('')
  const [modalReagendamento, setModalReagendamento] = useState(null)
  const [badgesLidos, setBadgesLidos] = useState({ agenda: false, mensagens: false })

  async function carregar() {
    setLoading(true)
    setErro('')
    const { data: authData } = await supabase.auth.getUser()
    setUsuario(authData?.user || null)

    const [
      obra,
      cronograma,
      fotos,
      ambientes,
      agenda,
      comunicados,
      mensagens,
      mensagensCliente,
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
      supabase.from('mensagens').select('*').eq('obra_id', id).order('created_at', { ascending: false }),
      supabase.from('contatos_cliente').select('*').eq('obra_id', id),
      supabase.from('profiles').select('id, full_name, email, role, telefone'),
    ])

    const documentos = await supabase
      .from('documentos')
      .select('id, obra_id, nome_arquivo, tipo, url_arquivo, created_at')
      .eq('obra_id', id)
      .order('created_at', { ascending: false })

    if (obra.error) {
      console.error('Erro ao carregar obra no portal cliente:', obra.error)
      setErro('Não foi possível abrir esta obra no momento.')
      setLoading(false)
      return
    }

    const falha = [cronograma, fotos, ambientes, agenda, comunicados, mensagens, mensagensCliente, contatos, profiles].find(r => r.error)
    if (falha?.error) {
      console.error('Erro em dados complementares do portal cliente:', falha.error)
    }
    if (documentos.error && !tabelaNaoEncontrada(documentos.error)) {
      console.error('Erro ao carregar documentos do portal cliente:', documentos.error)
    }

    setDados({
      obra: obra.data,
      cronograma: cronograma.data || null,
      fotos: safeArray(fotos).map(foto => ({ ...foto, publicUrl: fotoUrl(foto), categoria: foto.categoria || foto.etapa || 'Geral' })),
      ambientes: safeArray(ambientes),
      agenda: safeArray(agenda).filter(isAgendaCliente),
      comunicados: safeArray(comunicados),
      mensagens: safeArray(mensagens).filter(isMensagemCliente),
      mensagensCliente: safeArray(mensagensCliente),
      contatos: safeArray(contatos),
      profiles: safeArray(profiles),
      documentos: documentos.error ? [] : safeArray(documentos),
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
    const progresso = Math.max(0, Math.min(100, Number(cronograma.percentual_concluido ?? obra.progresso ?? 0)))
    const faseInterna = cronograma.fase || obra.fase_atual || obra.status || ''
    const faseAtualObj = faseOrnarePorKey(faseInterna) || faseOrnarePorTexto(faseInterna) || FASES_ORNARE[0]
    const faseIndex = Math.max(0, indiceFaseOrnare(faseAtualObj.key))
    const proximaFaseObj = FASES_ORNARE[Math.min(faseIndex + 1, FASES_ORNARE.length - 1)]
    const faseAtual = faseAtualObj.label_cliente
    const proximaEtapa = proximaFaseObj?.key === faseAtualObj.key ? 'Obra entregue' : proximaFaseObj.label_cliente
    const fotos = dados.fotos.filter(f => {
      const porAmbiente = !filtrosFoto.ambiente || f.ambiente_id === filtrosFoto.ambiente
      const porCategoria = !filtrosFoto.categoria || f.categoria === filtrosFoto.categoria
      return porAmbiente && porCategoria
    })
    const atualizacoes = [
      cronograma.updated_at,
      cronograma.created_at,
      obra.updated_at,
      obra.created_at,
      dados.comunicados[0]?.created_at,
      dados.fotos[0]?.created_at,
    ].filter(Boolean).sort().reverse()

    return {
      obra,
      cronograma,
      supervisor,
      posVenda,
      progresso,
      faseAtual,
      faseAtualKey: faseAtualObj.key,
      faseAtualIndex: faseIndex,
      proximaEtapa,
      previsao: dataBR(cronograma.data_fim_prevista || obra.data_previsao),
      ultimaAtualizacao: dataBR(atualizacoes[0]),
      fotos,
      categorias: [...new Set(dados.fotos.map(f => f.categoria).filter(Boolean))].sort(),
      ambientesPorId,
      documentos: dados.documentos,
      mensagens: [
        ...dados.comunicados.map(c => ({ ...c, origem: 'Comunicado' })),
        ...dados.mensagens.map(m => ({ ...m, origem: 'Mensagem' })),
        ...dados.mensagensCliente.map(m => ({ ...m, origem: m.tipo === 'reagendamento' ? 'Reagendamento' : 'Mensagem' })),
      ],
    }
  }, [dados, filtrosFoto])

  const agendaComBadge = useMemo(() => {
    const hoje = new Date()
    const limite = new Date()
    limite.setDate(hoje.getDate() + 7)
    return dados.agenda.some(item => {
      if (!item.data) return false
      const data = new Date(`${String(item.data).slice(0, 10)}T00:00:00`)
      return data >= hoje && data <= limite
    })
  }, [dados.agenda])

  const mensagensComBadge = useMemo(
    () => dados.mensagensCliente.some(item => item.lido_cliente === false),
    [dados.mensagensCliente],
  )

  function temBadge(tab) {
    if (tab === 'agenda') return agendaComBadge && !badgesLidos.agenda
    if (tab === 'mensagens') return mensagensComBadge && !badgesLidos.mensagens
    return false
  }

  function trocarAba(tab) {
    setAba(tab)
    if (tab === 'agenda' || tab === 'mensagens') {
      setBadgesLidos(prev => ({ ...prev, [tab]: true }))
    }
  }

  async function enviarMensagemCliente() {
    const conteudo = textoMensagem.trim()
    if (!conteudo) return
    setEnviandoMensagem(true)
    setMensagemStatus('')

    const { error } = await supabase.from('mensagens').insert({
      obra_id: id,
      remetente_id: usuario?.id || null,
      conteudo,
      tipo: 'cliente',
    })

    setEnviandoMensagem(false)
    if (error) {
      console.error('Erro ao enviar mensagem do cliente:', error)
      setMensagemStatus('Não foi possível enviar agora. Tente novamente em instantes.')
      return
    }

    setTextoMensagem('')
    setMensagemStatus('Dúvida enviada para a equipe Ornare.')
    await carregar()
  }

  async function confirmarPresencaAgenda(item) {
    setAgendaStatus('')
    const { error } = await supabase.from('agenda').update({ confirmado_cliente: true }).eq('id', item.id)
    if (error) {
      console.error('Erro ao confirmar presença do cliente:', error)
      setAgendaStatus('Não foi possível confirmar presença agora. Tente novamente em instantes.')
      return
    }
    setAgendaStatus('Presença confirmada.')
    await carregar()
  }

  async function enviarReagendamento() {
    const texto = modalReagendamento?.texto?.trim()
    if (!texto) return
    const evento = modalReagendamento.evento
    const conteudo = `Solicitação de reagendamento: ${evento?.titulo || evento?.tipo || 'Compromisso'} (${dataBR(evento?.data)}). Motivo/sugestão: ${texto}`
    const { error } = await supabase.from('mensagens').insert({
      obra_id: id,
      remetente_id: usuario?.id || null,
      conteudo,
      tipo: 'reagendamento',
    })
    if (error) {
      console.error('Erro ao solicitar reagendamento pelo cliente:', error)
      setAgendaStatus('Não foi possível enviar a solicitação agora. Tente novamente em instantes.')
      return
    }
    setModalReagendamento(null)
    setAgendaStatus('Solicitação enviada para a equipe Ornare.')
    await carregar()
  }

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

  function navegarFoto(delta) {
    if (preview === null || vm.fotos.length === 0) return
    setPreview((preview + delta + vm.fotos.length) % vm.fotos.length)
  }

  function finalizarSwipe(x) {
    if (touchStart === null) return
    const diff = touchStart - x
    if (Math.abs(diff) > 42) navegarFoto(diff > 0 ? 1 : -1)
    setTouchStart(null)
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

      {preview !== null && vm.fotos[preview] && (
        <div
          className="pc-preview"
          onClick={() => setPreview(null)}
          onTouchStart={e => setTouchStart(e.touches[0].clientX)}
          onTouchEnd={e => finalizarSwipe(e.changedTouches[0].clientX)}
        >
          <img src={vm.fotos[preview].publicUrl} alt={vm.fotos[preview].observacao || vm.fotos[preview].categoria || 'Foto ampliada'} />
          <button className="pc-preview-close" onClick={() => setPreview(null)}>Fechar</button>
          {vm.fotos.length > 1 && (
            <>
              <button className="pc-preview-prev" onClick={e => { e.stopPropagation(); navegarFoto(-1) }}>Anterior</button>
              <button className="pc-preview-next" onClick={e => { e.stopPropagation(); navegarFoto(1) }}>Próxima</button>
            </>
          )}
        </div>
      )}

      {modalReagendamento && (
        <div className="pc-modal" role="dialog" aria-modal="true">
          <div className="pc-modal-card">
            <button className="pc-modal-close" onClick={() => setModalReagendamento(null)}>Fechar</button>
            <span>Agenda</span>
            <h2>Solicitar reagendamento</h2>
            <p>{modalReagendamento.evento?.titulo || modalReagendamento.evento?.tipo || 'Compromisso'} · {dataBR(modalReagendamento.evento?.data)}</p>
            <textarea
              value={modalReagendamento.texto}
              onChange={e => setModalReagendamento(prev => ({ ...prev, texto: e.target.value }))}
              placeholder="Motivo ou sugestão de data"
              rows={5}
            />
            <button className="pc-primary-action" onClick={enviarReagendamento}>Enviar solicitação</button>
          </div>
        </div>
      )}

      <section className="pc-hero">
        <img className="pc-hero-img" src={bgImage} alt="" />
        <div className="pc-hero-overlay" />
        <div className="pc-hero-content">
          <div className="pc-hero-copy">
            <h1>{vm.obra.nome || 'Projeto Ornare'}</h1>
            <p>{vm.obra.cliente_nome || 'Cliente'} · {[vm.obra.cidade, vm.obra.uf].filter(Boolean).join(' / ') || 'Florianópolis'}</p>
          </div>
          <div className="pc-brand-lockup">
            <span className="pc-logo-frame"><img src="/logo-ornare.png" alt="Ornare" /></span>
            <strong>Minha Obra</strong>
          </div>
        </div>
      </section>

      <nav className="pc-tabs">
        {DESKTOP_NAV.map(item => (
          <button key={item.id} className={aba === item.id ? 'active' : ''} onClick={() => trocarAba(item.id)}>
            {item.label}
            {temBadge(item.id) && <i className="pc-tab-badge" />}
          </button>
        ))}
      </nav>

      {erro && <div className="pc-alert">{erro}</div>}
      {copiado && <div className="pc-toast">{copiado} copiado.</div>}

      <section className="pc-content">
        {aba === 'obra' && <HomeObra vm={vm} />}
        {aba === 'cronograma' && <Cronograma vm={vm} />}
        {aba === 'agenda' && <AgendaCliente agenda={dados.agenda} status={agendaStatus} onConfirmar={confirmarPresencaAgenda} onReagendar={item => setModalReagendamento({ evento: item, texto: '' })} />}
        {aba === 'fotos' && (
          <FotosCliente
            vm={vm}
            ambientes={dados.ambientes}
            filtros={filtrosFoto}
            setFiltros={setFiltrosFoto}
            abrirFoto={setPreview}
          />
        )}
        {aba === 'mensagens' && <MensagensCliente mensagens={vm.mensagens} texto={textoMensagem} setTexto={setTextoMensagem} enviando={enviandoMensagem} status={mensagemStatus} onEnviar={enviarMensagemCliente} />}
        {aba === 'contatos' && <ContatosCliente vm={vm} contatos={dados.contatos} copiar={copiar} />}
        {aba === 'docs' && <DocumentosCliente documentos={vm.documentos} />}
      </section>

      <nav className="pc-bottom-nav">
        {MOBILE_NAV.map(item => (
          <button key={item.id} className={aba === item.id ? 'active' : ''} onClick={() => trocarAba(item.id)}>
            <span>{item.icon}</span>
            {item.label}
            {temBadge(item.id) && <i className="pc-tab-badge" />}
          </button>
        ))}
      </nav>

      <footer className="pc-footer">ORNARE · Acompanhamento de Obra</footer>
    </main>
  )
}

function HomeObra({ vm }) {
  return (
    <div className="pc-stack">
      <Card destaque>
        <div className="pc-card-head">
          <span>Progresso Geral</span>
          <strong>{vm.progresso}%</strong>
        </div>
        <div className="pc-progress"><i style={{ width: `${vm.progresso}%` }} /></div>
        <div className="pc-dashboard-grid">
          <Metric label="Fase atual" value={vm.faseAtual} />
          <Metric label="Próxima etapa" value={vm.proximaEtapa} />
          <Metric label="Data prevista" value={vm.previsao} />
          <Metric label="Supervisor" value={nomePessoa(vm.supervisor)} />
          <Metric label="Última atualização" value={vm.ultimaAtualizacao} />
        </div>
      </Card>
      <Timeline faseAtualKey={vm.faseAtualKey} />
      <Card title="Documentos">
        {vm.documentos.length === 0 ? (
          <Empty icon="document" title="Nenhum documento disponível ainda." />
        ) : (
          <div className="pc-doc-list">
            {vm.documentos.map(doc => <Documento key={doc.id || doc.url_arquivo || doc.nome_arquivo} doc={doc} />)}
          </div>
        )}
      </Card>
    </div>
  )
}

function Cronograma({ vm }) {
  return (
    <div className="pc-stack">
      <Card title="Cronograma liberado">
        <Detail label="Fase atual" value={vm.faseAtual} />
        <Detail label="Próximas etapas" value={vm.proximaEtapa} />
        <Detail label="Previsão de entrega" value={vm.previsao} />
      </Card>
      <Timeline faseAtualKey={vm.faseAtualKey} />
    </div>
  )
}

function statusAgenda(item) {
  if (item.confirmado_cliente) return { label: 'Confirmado', tone: 'success' }
  const hoje = new Date()
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const data = new Date(`${String(item.data || '').slice(0, 10)}T00:00:00`)
  if (Number.isNaN(data.getTime())) return { label: 'Pendente', tone: 'neutral' }
  if (data < inicioHoje) return { label: 'Realizada', tone: 'neutral' }
  if (data.toDateString() === inicioHoje.toDateString()) return { label: 'Hoje', tone: 'gold' }
  return { label: 'Pendente', tone: 'gold' }
}

function AgendaCliente({ agenda, status, onConfirmar, onReagendar }) {
  if (agenda.length === 0) {
    return <Empty title="Nenhum evento liberado" text="Visitas, montagem, vistoria e entrega aparecerão aqui quando forem confirmadas." />
  }
  return (
    <div className="pc-stack">
      {status && <div className="pc-inline-status">{status}</div>}
      {agenda.map(item => {
        const agendaStatus = statusAgenda(item)
        return (
          <Card key={item.id}>
            <div className="pc-agenda-row">
              <div>
                <span>{dataBR(item.data)}</span>
                {item.hora_inicio && <small>{String(item.hora_inicio).slice(0, 5)}</small>}
              </div>
              <div>
                <div className="pc-agenda-title">
                  <strong>{item.titulo || item.tipo || 'Compromisso'}</strong>
                  <em className={`pc-agenda-status ${agendaStatus.tone}`}>{agendaStatus.label}</em>
                </div>
                {item.observacao && <p>{item.observacao}</p>}
                <div className="pc-agenda-actions">
                  <button className="confirm" onClick={() => onConfirmar(item)} disabled={item.confirmado_cliente}>Confirmar presença</button>
                  <button className="reschedule" onClick={() => onReagendar(item)}>Solicitar reagendamento</button>
                </div>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function FotosCliente({ vm, ambientes, filtros, setFiltros, abrirFoto }) {
  return (
    <div className="pc-stack">
      <div className="pc-filter-card">
        <select value={filtros.ambiente} onChange={e => setFiltros(p => ({ ...p, ambiente: e.target.value }))}>
          <option value="">Todos os ambientes</option>
          {ambientes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
        <select value={filtros.categoria} onChange={e => setFiltros(p => ({ ...p, categoria: e.target.value }))}>
          <option value="">Todas as categorias</option>
          {vm.categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {vm.fotos.length === 0 ? (
        <Empty icon="camera" title="Nenhuma foto ainda" text="As fotos da sua obra aparecerão aqui conforme o andamento." />
      ) : (
        <div className="pc-gallery">
          {vm.fotos.map((foto, index) => (
            <button key={foto.id} onClick={() => foto.publicUrl && abrirFoto(index)}>
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
  )
}

function MensagensCliente({ mensagens, texto, setTexto, enviando, status, onEnviar }) {
  return (
    <div className="pc-feed">
      {mensagens.length === 0 ? (
        <Empty icon="bell" title="Nenhum comunicado ainda" text="Atualizações importantes da sua obra serão publicadas aqui." />
      ) : (
        mensagens.map(item => (
          <Card key={`${item.origem}-${item.id}`}>
            <div className="pc-message">
              <span>{item.origem} · {dataBR(item.created_at)}</span>
              {item.titulo && <strong>{item.titulo}</strong>}
              <p>{item.conteudo || item.mensagem || item.texto || item.descricao}</p>
            </div>
          </Card>
        ))
      )}
      <div className="pc-message-composer">
        <textarea value={texto} onChange={e => setTexto(e.target.value)} placeholder="Envie uma dúvida ou comentário..." rows={3} />
        <button onClick={onEnviar} disabled={enviando || !texto.trim()}>{enviando ? 'Enviando...' : 'Enviar dúvida'}</button>
        {status && <span>{status}</span>}
      </div>
    </div>
  )
}

function ContatosCliente({ vm, contatos, copiar }) {
  return (
    <div className="pc-stack">
      <Contato title="Supervisor" pessoa={vm.supervisor} onCopy={copiar} />
      <Contato title="Pós-venda" pessoa={vm.posVenda} onCopy={copiar} />
      {contatos.map(contato => <Contato key={contato.id} title={contato.tipo || contato.nome || 'Contato'} pessoa={contato} onCopy={copiar} />)}
      <Contato title="Loja" pessoa={{ full_name: 'Ornare Florianópolis', email: 'florianopolis@ornare.com.br', telefone: '(48) 99999-9999' }} onCopy={copiar} />
    </div>
  )
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

function Timeline({ faseAtualKey }) {
  const etapaAtual = Math.max(0, MARCOS_CLIENTE.findIndex(marco => marco.fases.includes(faseAtualKey)))
  return (
    <div className="pc-timeline">
      {MARCOS_CLIENTE.map((marco, index) => (
        <div key={marco.label} className={index < etapaAtual ? 'done' : index === etapaAtual ? 'active' : 'future'}>
          <i>{index < etapaAtual ? '✓' : index + 1}</i>
          <span>{marco.label}</span>
        </div>
      ))}
    </div>
  )
}

function Documento({ doc }) {
  return (
    <div className="pc-doc">
      <div>
        <strong>{doc.nome_arquivo || doc.titulo || 'Documento'}</strong>
        <p>{doc.created_at ? `Publicado em ${dataBR(doc.created_at)}` : (doc.descricao || 'Arquivo liberado pela equipe Ornare.')}</p>
      </div>
      <div className="pc-doc-actions">
        <span>{doc.tipo || 'documento'}</span>
        {doc.url_arquivo ? <a href={doc.url_arquivo} target="_blank" rel="noreferrer">Abrir</a> : <span>Em breve</span>}
      </div>
    </div>
  )
}

function DocumentosCliente({ documentos }) {
  if (documentos.length === 0) {
    return <Empty icon="document" title="Nenhum documento disponível ainda." />
  }
  return (
    <Card title="Documentos">
      <div className="pc-doc-list">
        {documentos.map(doc => <Documento key={doc.id || doc.url_arquivo || doc.nome_arquivo} doc={doc} />)}
      </div>
    </Card>
  )
}

function EmptyIcon({ type }) {
  if (type === 'camera') {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M20 22l4-6h16l4 6h6a6 6 0 016 6v20a6 6 0 01-6 6H14a6 6 0 01-6-6V28a6 6 0 016-6h6z" />
        <circle cx="32" cy="38" r="10" />
      </svg>
    )
  }
  if (type === 'bell') {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 56a7 7 0 007-7H25a7 7 0 007 7z" />
        <path d="M50 44H14l4-6V27a14 14 0 0128 0v11l4 6z" />
      </svg>
    )
  }
  if (type === 'document') {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M18 8h20l12 12v36H18V8z" />
        <path d="M38 8v14h12" />
        <path d="M26 34h16M26 42h16" />
      </svg>
    )
  }
  return null
}

function Empty({ title, text, icon }) {
  return (
    <div className="pc-empty">
      {icon && <EmptyIcon type={icon} />}
      <strong>{title}</strong>
      {text && <p>{text}</p>}
    </div>
  )
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
.pc-hero{position:relative;min-height:174px;color:#fff;overflow:hidden}
.pc-hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;filter:grayscale(1) brightness(.66) contrast(1.08)}
.pc-hero-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,14,12,.78),rgba(15,14,12,.58) 46%,rgba(15,14,12,.14) 74%,rgba(245,240,235,1) 100%)}
.pc-top{position:relative;z-index:2;padding:22px;display:flex;justify-content:space-between;align-items:flex-start}
.pc-top img{height:44px;filter:brightness(0) invert(1)}
.pc-top span{display:block;margin-top:5px;color:${THEME.gold};font-size:9px;letter-spacing:3px;text-transform:uppercase}
.pc-hero-content{position:relative;z-index:2;max-width:980px;margin:0 auto;padding:22px 22px 14px;display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:42px;align-items:start}
.pc-hero-copy{min-width:0;padding-top:0}
.pc-brand-lockup{display:flex;flex-direction:column;align-items:center;justify-self:end;padding-top:0;width:238px;transform:translateY(-10px)}
.pc-logo-frame{display:block;width:238px;height:64px;position:relative;overflow:hidden}
.pc-logo-frame img{position:absolute;left:50%;top:50%;width:238px;height:238px;max-width:none;filter:brightness(0) invert(1);opacity:.96;transform:translate(-50%,-50%)}
.pc-brand-lockup strong{display:block;margin-top:5px;color:${THEME.gold};font-size:10px;letter-spacing:3.5px;text-transform:uppercase;font-weight:900;text-align:center;width:238px}
.pc-eyebrow{display:block;color:${THEME.gold};font-size:10px;letter-spacing:3px;text-transform:uppercase;font-weight:900;margin-bottom:10px}
.pc-hero h1{font-family:var(--font-sans, Inter, system-ui, sans-serif);font-size:36px;line-height:1.04;font-weight:850;letter-spacing:-.01em;margin:0;max-width:720px;color:#fff;text-shadow:0 18px 42px rgba(0,0,0,.48)}
.pc-hero p{font-size:14px;color:rgba(255,255,255,.88);margin:10px 0 0;font-weight:750;text-shadow:0 10px 28px rgba(0,0,0,.42)}
.pc-hero-dashboard{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:24px}
.pc-pill{background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:12px 13px;backdrop-filter:blur(10px);min-width:0}
.pc-pill span{display:block;color:${THEME.gold};font-size:8.5px;letter-spacing:1.7px;text-transform:uppercase;font-weight:900;margin-bottom:6px}
.pc-pill strong{display:block;color:#fff;font-size:13px;line-height:1.25;overflow:hidden;text-overflow:ellipsis}
.pc-tabs{position:sticky;top:0;z-index:10;margin:-2px auto 0;max-width:960px;display:grid;grid-template-columns:repeat(7,1fr);gap:6px;overflow:hidden;padding:7px;background:rgba(255,255,255,.92);border:1px solid ${THEME.border};border-radius:16px;backdrop-filter:blur(16px);box-shadow:0 16px 34px rgba(29,28,25,.07)}
.pc-tabs button{position:relative;border:0;background:transparent;color:${THEME.muted};border-radius:11px;padding:10px 13px;font-size:12px;font-weight:800;white-space:nowrap;cursor:pointer}
.pc-tabs button.active{background:${THEME.ink};color:#fff}
.pc-tab-badge{position:absolute;right:9px;top:8px;width:8px;height:8px;border-radius:50%;background:${THEME.danger};box-shadow:0 0 0 2px #fff}
.pc-bottom-nav{display:none}
.pc-alert{max-width:960px;margin:14px auto 0;border:1px solid #F0C8C8;background:#FFF7F7;color:#A33E3E;border-radius:12px;padding:11px 14px;font-size:13px;font-weight:700}
.pc-toast{position:fixed;left:50%;bottom:86px;transform:translateX(-50%);z-index:50;background:${THEME.ink};color:#fff;border-left:3px solid ${THEME.gold};border-radius:12px;padding:11px 15px;font-size:13px;font-weight:800;box-shadow:0 12px 32px rgba(0,0,0,.18)}
.pc-content{max-width:960px;margin:0 auto;padding:12px 22px 64px}
.pc-stack,.pc-feed{display:grid;gap:14px}
.pc-card{background:${THEME.card};border:1px solid ${THEME.border};border-radius:18px;padding:18px;box-shadow:0 16px 36px rgba(29,28,25,.05)}
.pc-card.destaque{border-top:3px solid ${THEME.gold}}
.pc-card h2{font-size:15px;margin:0 0 16px;color:${THEME.ink}}
.pc-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:16px}
.pc-card-head span{color:${THEME.muted};font-size:13px;font-weight:800}
.pc-card-head strong{font-size:38px;color:${THEME.gold};line-height:1}
.pc-progress{height:8px;background:#EEE7DC;border-radius:999px;overflow:hidden;margin-bottom:18px}
.pc-progress i{display:block;height:100%;background:linear-gradient(90deg,${THEME.gold},#D9BD80);border-radius:999px}
.pc-dashboard-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
.pc-metric{border:1px solid ${THEME.border};background:#FFFBF5;border-radius:14px;padding:13px;min-width:0}
.pc-metric span,.pc-detail span{display:block;color:${THEME.muted};font-size:10px;letter-spacing:1.4px;text-transform:uppercase;font-weight:900;margin-bottom:6px}
.pc-metric strong{font-size:15px;color:${THEME.ink};line-height:1.35}
.pc-detail{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid ${THEME.border}}
.pc-detail:last-child{border-bottom:0}
.pc-detail strong{text-align:right;color:${THEME.ink};font-size:14px;line-height:1.35}
.pc-timeline{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
.pc-timeline div{background:${THEME.card};border:1px solid ${THEME.border};border-radius:14px;padding:13px 10px;color:${THEME.soft};font-size:12px;font-weight:900;text-align:center}
.pc-timeline div.done{color:${THEME.ink};border-color:#D8D0C6;background:#FAF7F1}
.pc-timeline div.active{background:${THEME.gold};border-color:${THEME.gold};color:#fff;box-shadow:0 12px 30px rgba(201,169,110,.22)}
.pc-timeline i{display:flex;width:22px;height:22px;border-radius:50%;background:#E8E0D5;color:${THEME.soft};margin:0 auto 8px;align-items:center;justify-content:center;font-style:normal;font-size:10px;font-weight:950}
.pc-timeline div.done i{background:${THEME.ink};color:#fff}
.pc-timeline div.active i{background:#fff;color:${THEME.gold}}
.pc-filter-card{display:grid;grid-template-columns:1fr 1fr;gap:10px;background:${THEME.card};border:1px solid ${THEME.border};border-radius:16px;padding:12px}
.pc-filter-card select{background:${THEME.inputBackground};border:1px solid ${THEME.inputBorder};color:${THEME.inputText};border-radius:8px;padding:10px 14px;width:100%;font-size:14px;outline:none;font-family:inherit}
.pc-gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.pc-gallery button{border:0;background:${THEME.card};border-radius:17px;overflow:hidden;padding:0;text-align:left;cursor:zoom-in;box-shadow:0 18px 42px rgba(29,28,25,.055)}
.pc-gallery img,.pc-gallery button>span{display:block;width:100%;height:250px;object-fit:cover;background:#E8E0D5}
.pc-gallery button>span{display:flex;align-items:center;justify-content:center;color:${THEME.muted}}
.pc-gallery div{padding:12px 14px}
.pc-gallery strong{display:block;font-size:13px;color:${THEME.ink}}
.pc-gallery small{display:block;color:${THEME.muted};font-size:12px;margin-top:3px}
.pc-agenda-row{display:grid;grid-template-columns:96px 1fr;gap:16px}
.pc-agenda-row span{display:block;color:${THEME.gold};font-size:13px;font-weight:900}
.pc-agenda-row small{display:block;color:${THEME.muted};margin-top:4px}
.pc-agenda-row strong,.pc-doc strong,.pc-message strong{display:block;color:${THEME.ink};font-size:15px}
.pc-agenda-row p,.pc-doc p,.pc-message p{margin:7px 0 0;color:${THEME.muted};font-size:13px;line-height:1.55}
.pc-inline-status{background:#F5FBF7;border:1px solid #C8E1D0;color:${THEME.success};border-radius:14px;padding:11px 13px;font-size:13px;font-weight:900}
.pc-agenda-title{display:flex;align-items:center;justify-content:space-between;gap:12px}
.pc-agenda-status{border-radius:999px;padding:5px 9px;font-size:10px;font-style:normal;font-weight:950;white-space:nowrap}
.pc-agenda-status.success{background:#E8F3EC;color:${THEME.success}}
.pc-agenda-status.gold{background:#FBF3E2;color:#9C7838}
.pc-agenda-status.neutral{background:#F0EDEA;color:${THEME.muted}}
.pc-agenda-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.pc-agenda-actions button{border-radius:10px;padding:9px 11px;font-size:12px;font-weight:900;font-family:inherit;cursor:pointer}
.pc-agenda-actions .confirm{border:1px solid ${THEME.success};background:${THEME.success};color:#fff}
.pc-agenda-actions .confirm:disabled{opacity:.55;cursor:default}
.pc-agenda-actions .reschedule{border:1px solid ${THEME.gold};background:#fff;color:${THEME.gold}}
.pc-doc-list{display:grid;gap:10px}
.pc-doc{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;border:1px solid ${THEME.border};border-radius:14px;padding:14px;background:#FFFBF5}
.pc-doc-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.pc-doc span,.pc-doc a{border:1px solid ${THEME.border};border-radius:999px;padding:6px 10px;font-size:11px;color:${THEME.muted};white-space:nowrap;text-decoration:none;font-weight:900}
.pc-doc a{background:${THEME.ink};border-color:${THEME.ink};color:#fff}
.pc-message>span{display:block;color:${THEME.gold};font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:900;margin-bottom:8px}
.pc-message p{white-space:pre-wrap}
.pc-message-composer{position:sticky;bottom:calc(92px + env(safe-area-inset-bottom));background:${THEME.card};border:1px solid ${THEME.border};border-radius:18px;padding:13px;box-shadow:0 18px 42px rgba(29,28,25,.08)}
.pc-message-composer textarea{background:${THEME.inputBackground};border:1px solid ${THEME.inputBorder};color:${THEME.inputText};border-radius:8px;padding:10px 14px;width:100%;font-size:14px;outline:none;font-family:inherit;resize:vertical;min-height:82px;box-sizing:border-box}
.pc-message-composer button{margin-top:10px;width:100%;border:0;border-radius:12px;background:${THEME.gold};color:#fff;padding:12px;font-weight:950;font-family:inherit;cursor:pointer}
.pc-message-composer button:disabled{opacity:.55;cursor:default}
.pc-message-composer span{display:block;margin-top:8px;color:${THEME.muted};font-size:12px;font-weight:800}
.pc-contact{display:flex;gap:14px;align-items:center}
.pc-avatar{width:48px;height:48px;border-radius:50%;background:#F1E6D3;color:${THEME.gold};display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;flex-shrink:0;text-transform:uppercase}
.pc-contact span{display:block;color:${THEME.gold};font-size:10px;letter-spacing:1.4px;text-transform:uppercase;font-weight:900;margin-bottom:4px}
.pc-contact strong{display:block;color:${THEME.ink};font-size:15px}
.pc-contact small{display:block;color:${THEME.muted};font-size:12px;margin-top:4px}
.pc-contact-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.pc-contact-actions button,.pc-contact-actions a{border:1px solid ${THEME.border};background:#FFFEFC;color:${THEME.ink};border-radius:10px;padding:9px 12px;font-size:12px;font-weight:800;text-decoration:none;cursor:pointer;font-family:inherit}
.pc-empty{text-align:center;background:${THEME.card};border:1px solid ${THEME.border};border-radius:18px;padding:52px 22px;color:${THEME.muted}}
.pc-empty svg{width:54px;height:54px;margin:0 auto 16px;stroke:${THEME.gold};fill:none;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
.pc-empty strong{display:block;color:${THEME.ink};font-size:15px;margin-bottom:6px}
.pc-empty p{margin:0;font-size:13px;line-height:1.5}
.pc-modal{position:fixed;inset:0;z-index:120;background:rgba(15,14,12,.58);display:flex;align-items:center;justify-content:center;padding:18px}
.pc-modal-card{width:min(460px,100%);background:${THEME.card};border:1px solid ${THEME.border};border-radius:20px;padding:20px;box-shadow:0 28px 70px rgba(0,0,0,.28);position:relative}
.pc-modal-close{position:absolute;right:14px;top:14px;border:1px solid ${THEME.border};background:#fff;border-radius:999px;padding:7px 10px;font-family:inherit;font-weight:900;cursor:pointer}
.pc-modal-card>span{display:block;color:${THEME.gold};font-size:10px;letter-spacing:1.7px;text-transform:uppercase;font-weight:950;margin-bottom:7px}
.pc-modal-card h2{margin:0;color:${THEME.ink};font-size:22px}
.pc-modal-card p{margin:8px 0 14px;color:${THEME.muted};font-size:13px}
.pc-modal-card textarea{background:${THEME.inputBackground};border:1px solid ${THEME.inputBorder};color:${THEME.inputText};border-radius:8px;padding:10px 14px;width:100%;font-size:14px;outline:none;font-family:inherit;resize:vertical;box-sizing:border-box}
.pc-primary-action{margin-top:12px;width:100%;border:0;border-radius:12px;background:${THEME.gold};color:#fff;padding:12px;font-family:inherit;font-weight:950;cursor:pointer}
.pc-preview{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.94);display:flex;align-items:center;justify-content:center;padding:16px;cursor:zoom-out}
.pc-preview img{max-width:96vw;max-height:92vh;border-radius:10px;object-fit:contain}
.pc-preview button{position:absolute;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;border-radius:10px;padding:9px 12px;cursor:pointer}
.pc-preview-close{top:18px;right:18px}
.pc-preview-prev{left:18px;top:50%}
.pc-preview-next{right:18px;top:50%}
.pc-footer{text-align:center;padding:8px 20px 38px;color:#A79F93;font-size:10px;letter-spacing:2px;text-transform:uppercase}
@media (max-width:760px){
  .pc-page{padding-bottom:calc(102px + env(safe-area-inset-bottom))}
  .pc-hero{min-height:230px}
  .pc-hero-img{filter:grayscale(1) brightness(.48) contrast(1.18);object-position:center 18%}
  .pc-hero-overlay{background:linear-gradient(180deg,rgba(15,14,12,.82),rgba(15,14,12,.58) 48%,rgba(15,14,12,.18) 76%,rgba(246,243,238,1) 100%)}
  .pc-top{padding:20px 20px 0}
  .pc-top img{height:26px}
  .pc-top span{font-size:8px;letter-spacing:3px;margin-top:4px}
  .pc-hero-content{padding:24px 20px 54px;display:flex;flex-direction:column}
  .pc-brand-lockup{order:1;align-items:flex-start;width:auto;margin:0 0 5px;padding-top:0;transform:none}
  .pc-logo-frame{width:138px;height:34px}
  .pc-logo-frame img{width:138px;height:138px}
  .pc-brand-lockup strong{font-size:9px;letter-spacing:3px;margin-top:4px;text-align:center;width:150px}
  .pc-hero-copy{order:2}
  .pc-eyebrow{display:none}
  .pc-hero h1{font-size:28px;line-height:1.05;font-weight:850;max-width:350px;text-shadow:0 14px 34px rgba(0,0,0,.55);letter-spacing:-.01em}
  .pc-hero p{display:block;font-size:12px;color:rgba(255,255,255,.9);margin-top:9px;white-space:normal;overflow:visible;text-overflow:clip;max-width:330px;line-height:1.3;font-weight:700}
  .pc-hero-dashboard{display:none}
  .pc-tabs{display:none}
  .pc-bottom-nav{position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:40;display:grid;grid-template-columns:repeat(6,1fr);gap:4px;background:rgba(255,254,252,.96);border:1px solid ${THEME.border};border-radius:18px;padding:7px;box-shadow:0 18px 42px rgba(29,28,25,.18);backdrop-filter:blur(18px)}
  .pc-bottom-nav button{position:relative;border:0;background:transparent;color:${THEME.muted};border-radius:13px;min-height:54px;padding:7px 4px 6px;font-size:9px;font-weight:900;cursor:pointer}
  .pc-bottom-nav button span{display:block;font-size:0;line-height:1;margin-bottom:3px;color:${THEME.gold}}
  .pc-bottom-nav button span::before{font-size:16px}
  .pc-bottom-nav button:nth-child(1) span::before{content:"\\2302"}
  .pc-bottom-nav button:nth-child(2) span::before{content:"\\25F7"}
  .pc-bottom-nav button:nth-child(3) span::before{content:"\\25A1"}
  .pc-bottom-nav button:nth-child(4) span::before{content:"\\25C7"}
  .pc-bottom-nav button:nth-child(5) span::before{content:"\\260E"}
  .pc-bottom-nav button:nth-child(6) span::before{content:"\\25A4"}
  .pc-bottom-nav button.active{background:${THEME.ink};color:#fff}
  .pc-bottom-nav button.active span{color:#fff}
  .pc-alert{margin:12px 12px 0}
  .pc-content{padding:10px 12px calc(34px + env(safe-area-inset-bottom));margin-top:0}
  .pc-card{padding:14px;border-radius:16px}
  .pc-card-head{margin-bottom:12px}
  .pc-card-head span{font-size:12px}
  .pc-card-head strong{font-size:30px}
  .pc-progress{height:7px;margin-bottom:14px}
  .pc-dashboard-grid{gap:8px}
  .pc-metric{padding:12px;border-radius:13px}
  .pc-metric span{font-size:9px;letter-spacing:1.2px}
  .pc-metric strong{font-size:14px;line-height:1.28}
  .pc-dashboard-grid,.pc-filter-card,.pc-gallery{grid-template-columns:1fr}
  .pc-card.destaque .pc-dashboard-grid{grid-template-columns:1fr 1fr}
  .pc-card.destaque .pc-metric:nth-child(2){grid-column:1/-1}
  .pc-card.destaque .pc-metric:nth-child(4){grid-column:1/-1}
  .pc-timeline{grid-template-columns:1fr}
  .pc-timeline div{display:flex;align-items:center;gap:10px;text-align:left;padding:12px}
  .pc-timeline i{margin:0}
  .pc-gallery img,.pc-gallery button>span{height:260px}
  .pc-agenda-row{grid-template-columns:1fr;gap:8px}
  .pc-detail{display:block}
  .pc-detail strong{text-align:left;display:block}
  .pc-doc{display:block}
  .pc-doc-actions{justify-content:flex-start;margin-top:10px}
  .pc-doc span,.pc-doc a{display:inline-flex}
  .pc-preview-prev,.pc-preview-next{display:none}
}
@media (max-width:360px){
  .pc-hero{min-height:218px}
  .pc-hero h1{font-size:24px}
  .pc-pill{padding:8px}
  .pc-gallery img,.pc-gallery button>span{height:220px}
  .pc-bottom-nav{left:6px;right:6px;bottom:calc(6px + env(safe-area-inset-bottom))}
  .pc-bottom-nav button{font-size:8.8px}
}
`
