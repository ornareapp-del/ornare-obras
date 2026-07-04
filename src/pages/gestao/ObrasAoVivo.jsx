import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState, PremiumCard } from '../../components/DesignSystem'
import { faseOrnarePorKey, faseOrnarePorTexto } from '../../constants/fasesOrnare'
import { theme } from '../../constants/theme'
import { supabase } from '../../lib/supabase'
import { obraColor } from '../../utils/obraColor'
import { limparNome } from '../../utils/ui'

const THEME = {
  bg: theme.background,
  card: theme.surface,
  border: theme.border,
  ink: theme.textPrimary,
  muted: theme.textSecondary,
  gold: theme.gold,
  danger: theme.error,
  success: theme.success,
  warn: theme.warning,
  blue: '#3B5F86',
  elevated: theme.surfaceElevated,
}

const STATUS = {
  producao: ['Em produção', 'Em producao'],
  montagem: ['Em montagem', 'Montagem agendada'],
  concluidas: ['Concluída', 'Concluida'],
  canceladas: ['Cancelada'],
  travadas: ['Pausada', 'Cancelada'],
}

function normalizar(v) {
  return (v || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function inStatus(obra, lista) {
  const atual = normalizar(obra.status)
  return lista.some(s => normalizar(s) === atual)
}

function isConcluido(status) {
  return ['concluido', 'concluida', 'finalizado', 'finalizada', 'realizado', 'realizada'].includes(normalizar(status))
}

function isAberto(status) {
  return !isConcluido(status) && !['cancelado', 'cancelada', 'resolvido', 'resolvida'].includes(normalizar(status))
}

function dataBR(data) {
  if (!data) return '-'
  return new Date(`${String(data).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function diasDesde(value) {
  if (!value) return 999
  const data = new Date(value)
  if (Number.isNaN(data.getTime())) return 999
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  data.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((hoje - data) / 86400000))
}

function diasAte(value) {
  if (!value) return null
  const data = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(data.getTime())) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.ceil((data - hoje) / 86400000)
}

function prazoTexto(value) {
  const dias = diasAte(value)
  if (dias === null) return 'Sem data'
  if (dias < 0) return `${Math.abs(dias)}d atrasada`
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Amanhã'
  return `em ${dias}d`
}

function inicioObra(obra) {
  return obra?.data_inicio_real || obra?.data_inicio_prevista || obra?.data_previsao_inicio || obra?.data_inicio || null
}

function fimObra(obra) {
  return obra?.data_fim_prevista || obra?.data_previsao || obra?.data_previsao_entrega || obra?.data_previsao_fim || null
}

function faseObra(obra) {
  const fase = faseOrnarePorKey(obra?.fase)
    || faseOrnarePorKey(obra?.fase_atual)
    || faseOrnarePorTexto(obra?.fase || obra?.fase_atual || obra?.status)
  return fase?.label || obra?.fase || obra?.fase_atual || obra?.status || 'Sem fase'
}

function statusBadge(status) {
  if (normalizar(status).includes('montagem')) return { bg: '#EFF4FA', color: '#1E3A5F', label: status || '-' }
  if (normalizar(status).includes('producao') || normalizar(status).includes('produção')) return { bg: '#F0F3EA', color: '#415B34', label: status || '-' }
  if (['pausada', 'cancelada'].includes(normalizar(status))) return { bg: '#FDECEA', color: '#9E2F2F', label: status || '-' }
  if (normalizar(status).includes('conclu')) return { bg: '#E8F5E9', color: '#2E7D32', label: status || '-' }
  return { bg: '#F5F1EA', color: '#5C5448', label: status || '-' }
}

function fotoPendenteAprovacao(foto) {
  const status = normalizar(foto.status_aprovacao || foto.status)
  return ['pendente', 'em analise', 'em análise', 'aguardando'].includes(status)
    || foto.aprovada === false
    || foto.aprovado === false
}

function safeArray(result) {
  return result?.data || []
}

function erroConsulta(label, result) {
  if (!result?.error) return null
  return `${label}: ${result.error.message || 'falha ao carregar'}`
}

function mapearCheckinsComPerfis(checkins, profiles) {
  const perfilPorId = new Map((profiles || []).map(profile => [profile.id, profile]))
  return (checkins || []).map(checkin => ({
    ...checkin,
    profiles: perfilPorId.get(checkin.user_id) || null,
  }))
}

function criarDadosVazios() {
  return {
    obras: [],
    agenda: [],
    ocorrencias: [],
    checkins: [],
    fotos: [],
    profiles: [],
    montadores: [],
    checklist: [],
  }
}

export default function ObrasAoVivo() {
  const navigate = useNavigate()
  const [dados, setDados] = useState(criarDadosVazios)
  const [loading, setLoading] = useState(true)
  const [erroDados, setErroDados] = useState('')
  const [filtro, setFiltro] = useState('todas')

  async function carregar() {
    setLoading(true)
    setErroDados('')
    try {
      const [
        obrasResult,
        agendaResult,
        ocorrenciasResult,
        checkinsResult,
        fotosResult,
        profilesResult,
        montadoresResult,
        checklistResult,
      ] = await Promise.all([
        supabase.from('obras').select('*').order('created_at', { ascending: false }),
        supabase.from('agenda').select('*').order('data', { ascending: true }).limit(240),
        supabase.from('ocorrencias').select('*').order('created_at', { ascending: false }).limit(240),
        supabase.from('checkins').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('fotos').select('*').order('created_at', { ascending: false }).limit(240),
        supabase.from('profiles').select('id, full_name, email, role'),
        supabase.from('obra_montadores').select('obra_id, montador_id, montador:profiles!obra_montadores_montador_id_fkey(full_name)'),
        supabase.from('checklist_items').select('id, obra_id, descricao, concluido').limit(900),
      ])

      const falhas = [
        erroConsulta('Obras', obrasResult),
        erroConsulta('Agenda', agendaResult),
        erroConsulta('Ocorrências', ocorrenciasResult),
        erroConsulta('Check-ins', checkinsResult),
        erroConsulta('Fotos', fotosResult),
        erroConsulta('Perfis', profilesResult),
        erroConsulta('Montadores alocados', montadoresResult),
        erroConsulta('Checklist', checklistResult),
      ].filter(Boolean)

      if (falhas.length > 0) console.error('Falhas ao carregar ObrasAoVivo:', falhas)

      setDados({
        obras: safeArray(obrasResult),
        agenda: safeArray(agendaResult),
        ocorrencias: safeArray(ocorrenciasResult),
        checkins: mapearCheckinsComPerfis(safeArray(checkinsResult), safeArray(profilesResult)),
        fotos: safeArray(fotosResult),
        profiles: safeArray(profilesResult),
        montadores: safeArray(montadoresResult),
        checklist: safeArray(checklistResult),
      })
      setErroDados(falhas.join(' / '))
    } catch (error) {
      console.error('Falha inesperada ao carregar ObrasAoVivo:', error)
      setDados(criarDadosVazios())
      setErroDados(error?.message || 'falha inesperada ao carregar obras ao vivo')
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [])

  const vm = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const hojeStr = hoje.toISOString().split('T')[0]
    const amanha = new Date(hoje)
    amanha.setDate(amanha.getDate() + 1)
    const ativos = dados.obras.filter(o => !inStatus(o, STATUS.concluidas) && !inStatus(o, STATUS.canceladas))

    const ocorrPorObra = new Map()
    dados.ocorrencias.filter(o => isAberto(o.status)).forEach(o => {
      if (!o.obra_id) return
      ocorrPorObra.set(o.obra_id, [...(ocorrPorObra.get(o.obra_id) || []), o])
    })

    const checklistPorObra = new Map()
    dados.checklist.forEach(item => {
      if (!item.obra_id) return
      checklistPorObra.set(item.obra_id, [...(checklistPorObra.get(item.obra_id) || []), item])
    })

    const fotosPorObra = new Map()
    dados.fotos.forEach(foto => {
      if (!foto.obra_id) return
      fotosPorObra.set(foto.obra_id, [...(fotosPorObra.get(foto.obra_id) || []), foto])
    })

    const checkinsHoje = dados.checkins.filter(c => {
      const base = c.entrada || c.created_at
      if (!base) return false
      const data = new Date(base)
      return data >= hoje && data < amanha
    })
    const checkinsAbertosHoje = checkinsHoje.filter(c => !c.saida)

    const ultimoCheckinPorObra = new Map()
    dados.checkins.forEach(checkin => {
      if (!checkin.obra_id) return
      const data = new Date(checkin.entrada || checkin.created_at || 0)
      const atual = ultimoCheckinPorObra.get(checkin.obra_id)
      const atualData = atual ? new Date(atual.entrada || atual.created_at || 0) : null
      if (!atualData || data > atualData) ultimoCheckinPorObra.set(checkin.obra_id, checkin)
    })

    const checkinsAbertosPorObra = new Map()
    checkinsAbertosHoje.forEach(checkin => {
      if (!checkin.obra_id) return
      checkinsAbertosPorObra.set(checkin.obra_id, [...(checkinsAbertosPorObra.get(checkin.obra_id) || []), checkin])
    })

    const montadoresPorObra = new Map()
    dados.montadores.forEach(vinculo => {
      if (!vinculo.obra_id) return
      const nome = limparNome(vinculo.montador?.full_name) || 'Montador'
      montadoresPorObra.set(vinculo.obra_id, [...(montadoresPorObra.get(vinculo.obra_id) || []), nome])
    })

    const agendaPorObra = new Map()
    dados.agenda
      .filter(item => item.obra_id && item.data >= hojeStr && !isConcluido(item.status))
      .forEach(item => {
        agendaPorObra.set(item.obra_id, [...(agendaPorObra.get(item.obra_id) || []), item])
      })

    const obrasAoVivo = ativos.map(obra => {
      const abertos = checkinsAbertosPorObra.get(obra.id) || []
      const ultimoCheckin = ultimoCheckinPorObra.get(obra.id)
      const pendencias = [
        (ocorrPorObra.get(obra.id) || []).length ? 'Ocorrência' : null,
        (checklistPorObra.get(obra.id) || []).some(item => !item.concluido) ? 'Checklist' : null,
        (fotosPorObra.get(obra.id) || []).some(fotoPendenteAprovacao) ? 'Fotos' : null,
      ].filter(Boolean)
      const fim = fimObra(obra)
      const inicio = inicioObra(obra)
      const diasFim = diasAte(fim)
      const travada = inStatus(obra, STATUS.travadas) || (ocorrPorObra.get(obra.id) || []).some(oc => ['alta', 'critica', 'crítica'].includes(normalizar(oc.gravidade)))
      const semCheckin = !ultimoCheckin || diasDesde(ultimoCheckin.entrada || ultimoCheckin.created_at) > 2
      const proximo = (agendaPorObra.get(obra.id) || [])[0]
      const emCampo = abertos.map(c => limparNome(c.profiles?.full_name) || 'Montador')
      let situacao = 'ok'
      if (travada || (diasFim !== null && diasFim < 0)) situacao = 'danger'
      else if (semCheckin || pendencias.length > 0 || (diasFim !== null && diasFim <= 3)) situacao = 'warn'
      return {
        obra,
        situacao,
        inicio,
        fim,
        proximo,
        montadores: montadoresPorObra.get(obra.id) || [],
        emCampo,
        ultimoCheckin,
        pendencias,
        travada,
        semCheckin,
      }
    }).sort((a, b) => {
      const peso = { danger: 0, warn: 1, ok: 2 }
      return peso[a.situacao] - peso[b.situacao]
    })

    return {
      obrasAoVivo,
      resumo: {
        total: obrasAoVivo.length,
        emCampo: obrasAoVivo.filter(item => item.emCampo.length > 0).length,
        atencao: obrasAoVivo.filter(item => item.situacao === 'warn').length,
        criticas: obrasAoVivo.filter(item => item.situacao === 'danger').length,
        semCheckin: obrasAoVivo.filter(item => item.semCheckin).length,
      },
    }
  }, [dados])

  const obrasFiltradas = vm.obrasAoVivo.filter(item => {
    if (filtro === 'campo') return item.emCampo.length > 0
    if (filtro === 'atencao') return item.situacao === 'warn'
    if (filtro === 'criticas') return item.situacao === 'danger'
    if (filtro === 'sem-checkin') return item.semCheckin
    return true
  })

  const filtros = [
    { id: 'todas', label: 'Todas', value: vm.resumo.total },
    { id: 'campo', label: 'Em campo', value: vm.resumo.emCampo },
    { id: 'atencao', label: 'Atenção', value: vm.resumo.atencao },
    { id: 'criticas', label: 'Críticas', value: vm.resumo.criticas },
    { id: 'sem-checkin', label: 'Sem check-in', value: vm.resumo.semCheckin },
  ]

  return (
    <div className="oa-page">
      <style>{css}</style>

      <header className="oa-header">
        <div>
          <div className="oa-eyebrow">Gestão Ornare</div>
          <h1>Obras ao vivo</h1>
          <p>Leitura rápida de campo: obra parada, montador em campo, datas, prazo, progresso e próximo compromisso.</p>
        </div>
        <div className="oa-actions">
          <button onClick={() => carregar()} disabled={loading}>{loading ? 'Atualizando...' : 'Atualizar'}</button>
          <button onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button className="primary" onClick={() => navigate('/obras')}>Obras</button>
        </div>
      </header>

      {erroDados && <div className="oa-load-alert">{erroDados}</div>}

      <section className="oa-summary" aria-label="Resumo das obras ao vivo">
        {filtros.map(item => (
          <button key={item.id} className={filtro === item.id ? 'active' : ''} onClick={() => setFiltro(item.id)}>
            <strong>{loading ? '-' : item.value}</strong>
            <span>{item.label}</span>
          </button>
        ))}
      </section>

      <PremiumCard
        title="Mapa operacional"
        subtitle="Cada card resume o que o gestor precisa decidir agora."
        action={<button className="ow-action-button secondary" onClick={() => navigate('/obras')}>Ver lista completa</button>}
      >
        {obrasFiltradas.length === 0 ? (
          <EmptyState title={loading ? 'Carregando obras...' : 'Nenhuma obra neste filtro.'} />
        ) : (
          <div className="oa-live-grid">
            {obrasFiltradas.map(item => (
              <LiveCard
                key={item.obra.id}
                item={item}
                onOpen={() => navigate(`/obras/${item.obra.id}`)}
                onRoute={rota => navigate(rota)}
              />
            ))}
          </div>
        )}
      </PremiumCard>
    </div>
  )
}

function LiveCard({ item, onOpen, onRoute }) {
  const obra = item.obra
  const status = statusBadge(obra.status)
  const cor = obraColor(obra)
  const ultimo = item.ultimoCheckin?.entrada || item.ultimoCheckin?.created_at
  const progresso = Math.min(100, Math.max(0, obra.progresso || 0))
  const alerta = item.emCampo.length
    ? 'Montador em campo'
    : item.travada
      ? 'Obra travada'
      : item.semCheckin
        ? 'Sem check-in recente'
        : item.pendencias.length
          ? 'Atenção pendente'
          : 'Sem alerta crítico'
  const rotaObra = aba => `/obras/${obra.id}?aba=${aba}`
  const irPara = (event, rota) => {
    event.stopPropagation()
    onRoute(rota)
  }
  const keyOpen = event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen()
    }
  }

  return (
    <article
      role="button"
      tabIndex={0}
      className={`oa-live-card ${item.situacao}`}
      onClick={onOpen}
      onKeyDown={keyOpen}
      style={{
        '--obra-accent': cor.accent,
        '--obra-soft': cor.soft,
        '--obra-border': cor.border,
        '--obra-ink': cor.ink,
      }}
    >
      <div className="oa-live-head">
        <div>
          <strong>{obra.nome}</strong>
          <span>{obra.cliente_nome || obra.cidade || 'Cliente não informado'}</span>
        </div>
        <em style={{ background: status.bg, color: status.color }}>{status.label}</em>
      </div>

      <button className="oa-live-status oa-live-action" onClick={event => irPara(event, rotaObra(item.emCampo.length || item.semCheckin ? 'Equipe' : item.travada ? 'Ocorrencias' : item.pendencias.length ? abaPendencia(item.pendencias[0]) : 'Resumo'))}>
        <b>{alerta}</b>
        <small>{item.emCampo[0] || item.montadores[0] || 'Sem montador alocado'}</small>
      </button>

      <div className="oa-live-metrics">
        <button onClick={event => irPara(event, rotaObra('Cronograma'))}><small>Início</small><b>{item.inicio ? dataBR(item.inicio) : '-'}</b></button>
        <button onClick={event => irPara(event, rotaObra('Cronograma'))}><small>Término</small><b>{item.fim ? dataBR(item.fim) : '-'}</b></button>
        <button onClick={event => irPara(event, rotaObra('Cronograma'))}><small>Prazo</small><b>{prazoTexto(item.fim)}</b></button>
        <button onClick={event => irPara(event, rotaObra('Equipe'))}><small>Check-in</small><b>{ultimo ? `${diasDesde(ultimo)}d` : 'Nunca'}</b></button>
        <button onClick={event => irPara(event, rotaObra('Cronograma'))}><small>Progresso</small><b>{progresso}%</b></button>
        <button onClick={event => irPara(event, item.proximo?.id ? `${rotaObra('Agenda')}&compromisso=${item.proximo.id}` : rotaObra('Agenda'))}><small>Próximo</small><b>{item.proximo?.data ? dataBR(item.proximo.data) : '-'}</b></button>
      </div>

      <div className="oa-live-flow">
        <button onClick={event => irPara(event, rotaObra('Cronograma'))}>
          <small><i />Fase atual</small>
          <b>{faseObra(obra)}</b>
        </button>
        <div className="oa-live-progress"><i style={{ width: `${progresso}%` }} /></div>
      </div>

      <div className="oa-live-foot">
        {item.pendencias.length ? item.pendencias.map(p => (
          <button key={p} onClick={event => irPara(event, rotaObra(abaPendencia(p)))}>{p}</button>
        )) : <button className="ok" onClick={event => irPara(event, `/obras/${obra.id}`)}>OK</button>}
      </div>
    </article>
  )
}

function abaPendencia(pendencia) {
  const texto = normalizar(pendencia)
  if (texto.includes('ocorrencia')) return 'Ocorrencias'
  if (texto.includes('foto')) return 'Fotos'
  if (texto.includes('checklist')) return 'Checklist'
  return 'Resumo'
}

const css = `
.oa-page{min-height:100vh;background:${THEME.bg};padding:30px 34px 52px;color:${THEME.ink};font-family:var(--font-sans);box-sizing:border-box}
.oa-header{width:100%;max-width:none;margin:0 0 20px;display:flex;justify-content:space-between;gap:18px;align-items:flex-start;box-sizing:border-box}
.oa-eyebrow{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${THEME.gold};font-weight:800;margin-bottom:7px}
.oa-header h1{font-family:var(--font-serif);font-size:38px;line-height:1.05;font-weight:500;margin:0;color:${THEME.ink}}
.oa-header p{margin:8px 0 0;font-size:13px;color:${THEME.muted};max-width:640px;line-height:1.45}
.oa-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.oa-actions button{border:1px solid ${THEME.border};background:${THEME.elevated};color:${THEME.ink};border-radius:8px;padding:12px 18px;min-height:44px;font-size:13px;font-weight:800;cursor:pointer}
.oa-actions button:disabled{opacity:.6;cursor:not-allowed}
.oa-actions .primary{background:${THEME.gold};border-color:${THEME.gold};color:${THEME.bg}}
.oa-load-alert{width:100%;margin:0 0 12px;border:1px solid rgba(224,82,82,.34);background:rgba(224,82,82,.12);color:${THEME.danger};border-radius:12px;padding:11px 14px;font-size:13px;font-weight:800}
.oa-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:0 0 16px}
.oa-summary button{border:1px solid ${THEME.border};background:${THEME.card};border-radius:12px;padding:14px 16px;min-height:82px;text-align:left;color:${THEME.ink};font-family:inherit;cursor:pointer}
.oa-summary button.active{border-color:${THEME.gold};background:#322714;box-shadow:inset 0 0 0 1px rgba(184,150,94,.18)}
.oa-summary strong{display:block;font-size:28px;line-height:1;color:${THEME.ink}}
.oa-summary span{display:block;font-size:11.5px;color:${THEME.muted};font-weight:900;margin-top:8px}
.oa-live-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.oa-live-card{border:1px solid var(--obra-border);border-left:7px solid var(--obra-accent);background:linear-gradient(135deg,var(--obra-soft),${THEME.elevated} 38%);border-radius:13px;padding:14px;min-height:250px;text-align:left;font-family:inherit;color:${THEME.ink};cursor:pointer;display:flex;flex-direction:column;gap:12px;box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}
.oa-live-card.warn{background:linear-gradient(135deg,var(--obra-soft),#211B14 42%)}
.oa-live-card.danger{background:linear-gradient(135deg,var(--obra-soft),#251717 42%)}
.oa-live-card button{font-family:inherit}
.oa-live-card:focus-visible,.oa-live-card button:focus-visible{outline:2px solid var(--obra-accent);outline-offset:2px}
.oa-live-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.oa-live-head strong{display:block;font-size:15px;line-height:1.16;color:${THEME.ink};font-weight:950;overflow:hidden;text-overflow:ellipsis}
.oa-live-head span{display:block;font-size:11.5px;color:${THEME.muted};margin-top:5px;line-height:1.35}
.oa-live-head em{font-style:normal;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:900;white-space:nowrap}
.oa-live-status{width:100%;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.035);border-radius:11px;padding:10px 11px;text-align:left;color:inherit;cursor:pointer}
.oa-live-status:hover{border-color:var(--obra-border);background:rgba(255,255,255,.06)}
.oa-live-status b{display:block;font-size:13.5px;color:${THEME.ink};line-height:1.2}
.oa-live-status small{display:block;font-size:11.5px;color:${THEME.muted};margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.oa-live-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.oa-live-metrics button{border:1px solid ${THEME.border};background:${THEME.card};border-radius:10px;padding:8px;min-width:0;text-align:left;color:inherit;cursor:pointer}
.oa-live-metrics button:hover{border-color:var(--obra-border);background:var(--obra-soft)}
.oa-live-metrics small,.oa-live-flow small{display:block;font-size:9px;letter-spacing:.8px;text-transform:uppercase;color:${THEME.muted};font-weight:900;margin-bottom:4px}
.oa-live-metrics b,.oa-live-flow b{display:block;font-size:12px;color:${THEME.ink};line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.oa-live-flow{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;margin-top:auto}
.oa-live-flow button{border:0;background:transparent;padding:0;text-align:left;color:inherit;cursor:pointer}
.oa-live-flow small{display:flex;align-items:center;gap:6px}
.oa-live-flow small i{width:8px;height:8px;border-radius:999px;background:var(--obra-accent);box-shadow:0 0 0 3px var(--obra-soft)}
.oa-live-progress{height:7px;background:#E8E4DE;border-radius:999px;overflow:hidden}
.oa-live-progress i{display:block;height:100%;background:var(--obra-accent);border-radius:999px}
.oa-live-foot{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-start}
.oa-live-foot button{background:#3A2B16;color:#FFE7B0;border:1px solid #B98226;border-radius:999px;padding:4px 7px;font-size:9.5px;font-weight:900;cursor:pointer}
.oa-live-foot button:hover{border-color:var(--obra-border);background:var(--obra-soft);color:var(--obra-ink)}
.oa-live-foot button.ok{background:#18311F;color:#CFF3DA;border-color:#2D7A4A}
@media (max-width:980px){.oa-summary{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:760px){.oa-page{padding:22px 14px calc(112px + env(safe-area-inset-bottom))}.oa-header{display:block;margin-bottom:14px}.oa-eyebrow{font-size:9px;letter-spacing:2px;margin-bottom:4px}.oa-header h1{font-size:30px}.oa-header p{font-size:12.5px}.oa-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;justify-content:flex-start;margin-top:12px}.oa-actions button{padding:10px 9px;font-size:12px}.oa-summary{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.oa-summary button{min-height:72px;padding:12px}.oa-live-grid{grid-template-columns:1fr}.oa-live-card{min-height:0}.oa-live-head{display:block}.oa-live-head em{display:inline-flex;margin-top:9px}.oa-live-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
`
