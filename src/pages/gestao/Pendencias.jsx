import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { theme } from '../../constants/theme'

const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const hoje = () => new Date().toISOString().slice(0, 10)

export default function Pendencias() {
  const navigate = useNavigate()
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const [resolvendo, setResolvendo] = useState('')

  useEffect(() => {
    let ativo = true
    async function carregar() {
      setLoading(true)
      setErro('')
      const [obras, cronogramas, agenda, fotos, gastos, checklist, ocorrencias] = await Promise.all([
        supabase.from('obras').select('id, nome, supervisor_id, status'),
        supabase.from('obra_cronograma').select('id, obra_id, fase, data_fim_prevista, percentual_concluido, risco, travado, motivo_trava'),
        supabase.from('agenda').select('id, obra_id, titulo, tipo, data, data_fim, status, responsavel_id, solicitacao_reagendamento_cliente'),
        supabase.from('fotos').select('id, obra_id, observacao, categoria, created_at, aprovada_gestao').eq('aprovada_gestao', false).limit(150),
        supabase.from('gastos').select('id, obra_id, descricao, valor, status, created_at').eq('status', 'pendente').limit(150),
        supabase.from('checklist_items').select('id, obra_id, descricao, concluido').eq('concluido', false).limit(200),
        supabase.from('ocorrencias').select('id, obra_id, titulo, descricao, status, gravidade, created_at').limit(200),
      ])
      const falha = [obras, cronogramas, agenda, fotos, gastos, checklist, ocorrencias].find(result => result.error)
      if (!ativo) return
      if (falha?.error) setErro(falha.error.message || 'Não foi possível carregar todas as pendências.')

      const obraPorId = new Map((obras.data || []).map(obra => [obra.id, obra]))
      const nomeObra = obraId => obraPorId.get(obraId)?.nome || 'Obra'
      const novas = []
      const dataHoje = hoje()

      for (const cronograma of cronogramas.data || []) {
        if (!obraPorId.has(cronograma.obra_id)) continue
        if (cronograma.travado) novas.push(item('trava', 'critica', cronograma.obra_id, nomeObra(cronograma.obra_id), 'Obra travada', cronograma.motivo_trava || 'Cronograma bloqueado', 'Cronograma'))
        if (cronograma.data_fim_prevista && cronograma.data_fim_prevista < dataHoje && Number(cronograma.percentual_concluido || 0) < 100) {
          novas.push(item('prazo', 'alta', cronograma.obra_id, nomeObra(cronograma.obra_id), 'Prazo vencido', `Previsão ${dataBR(cronograma.data_fim_prevista)} · ${Number(cronograma.percentual_concluido || 0)}% concluído`, 'Cronograma'))
        }
      }

      for (const evento of agenda.data || []) {
        if (!obraPorId.has(evento.obra_id)) continue
        const status = norm(evento.status)
        if (status.includes('reagendamento solicitado') || evento.solicitacao_reagendamento_cliente) {
          novas.push(item('reagendamento', 'alta', evento.obra_id, nomeObra(evento.obra_id), 'Reagendamento solicitado', evento.titulo || evento.tipo || 'Compromisso', 'Agenda', evento.id))
        } else if ((evento.data_fim || evento.data) < dataHoje && !['realizada', 'concluida', 'cancelada'].some(valor => status.includes(valor))) {
          novas.push(item('agenda', 'media', evento.obra_id, nomeObra(evento.obra_id), 'Compromisso vencido', `${evento.titulo || evento.tipo || 'Compromisso'} · ${dataBR(evento.data_fim || evento.data)}`, 'Agenda', evento.id))
        }
      }

      for (const foto of fotos.data || []) novas.push(item('foto', 'media', foto.obra_id, nomeObra(foto.obra_id), 'Foto aguardando aprovação', foto.observacao || foto.categoria || 'Foto de obra', 'Fotos', foto.id))
      for (const gasto of gastos.data || []) novas.push(item('gasto', 'alta', gasto.obra_id, nomeObra(gasto.obra_id), 'Gasto aguardando decisão', `${gasto.descricao || 'Gasto'} · ${moeda(gasto.valor)}`, 'Gastos', gasto.id))
      for (const check of checklist.data || []) novas.push(item('checklist', 'baixa', check.obra_id, nomeObra(check.obra_id), 'Checklist pendente', check.descricao || 'Item sem descrição', 'Checklist', check.id))
      for (const ocorrencia of ocorrencias.data || []) {
        if (['resolvida', 'concluida', 'cancelada', 'fechada'].some(valor => norm(ocorrencia.status).includes(valor))) continue
        const prioridade = ['critica', 'grave', 'alta'].some(valor => norm(ocorrencia.gravidade).includes(valor)) ? 'critica' : 'media'
        novas.push(item('ocorrencia', prioridade, ocorrencia.obra_id, nomeObra(ocorrencia.obra_id), 'Ocorrência aberta', ocorrencia.titulo || ocorrencia.descricao || 'Ocorrência', 'Ocorrências', ocorrencia.id))
      }

      const ordem = { critica: 0, alta: 1, media: 2, baixa: 3 }
      setItens(novas.sort((a, b) => ordem[a.prioridade] - ordem[b.prioridade]))
      setLoading(false)
    }
    carregar()
    return () => { ativo = false }
  }, [])

  const visiveis = useMemo(() => filtro === 'todas' ? itens : itens.filter(itemAtual => itemAtual.tipo === filtro), [filtro, itens])
  const tipos = [...new Set(itens.map(itemAtual => itemAtual.tipo))]
  const criticas = itens.filter(itemAtual => itemAtual.prioridade === 'critica').length
  const altas = itens.filter(itemAtual => itemAtual.prioridade === 'alta').length

  async function concluirOcorrencia(event, pendencia) {
    event.stopPropagation()
    if (!pendencia.entidadeId || !window.confirm(`Concluir a ocorrência "${pendencia.detalhe}"?`)) return
    setResolvendo(pendencia.entidadeId)
    setErro('')
    const { error } = await supabase.from('ocorrencias').update({ status: 'Resolvida' }).eq('id', pendencia.entidadeId)
    if (error) {
      setErro(error.message || 'Não foi possível concluir a ocorrência.')
      setResolvendo('')
      return
    }
    setItens(atuais => atuais.filter(itemAtual => itemAtual.key !== pendencia.key))
    setResolvendo('')
  }

  return (
    <div className="ow-page" style={{ minHeight: '100%', padding: '30px clamp(16px, 3vw, 42px)', background: theme.background, color: theme.textPrimary }}>
      <div style={{ marginBottom: 22 }}>
        <small style={label}>CONTROLE OPERACIONAL</small>
        <h1 style={{ margin: '7px 0 5px', fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 500 }}>Central de Pendências</h1>
        <p style={{ margin: 0, color: theme.textSecondary, fontSize: 13 }}>Tudo o que exige decisão ou ação da equipe em um único lugar.</p>
      </div>

      <div style={kpiGrid}>
        <Kpi titulo="Total" valor={itens.length} />
        <Kpi titulo="Críticas" valor={criticas} cor={theme.error} />
        <Kpi titulo="Alta prioridade" valor={altas} cor={theme.warning} />
      </div>

      {erro && <div role="alert" aria-live="assertive" style={{ padding: 12, border: `1px solid ${theme.error}`, color: theme.error, borderRadius: 10, marginBottom: 14 }}>{erro}</div>}

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
        {['todas', ...tipos].map(tipo => <button key={tipo} onClick={() => setFiltro(tipo)} style={chip(filtro === tipo)}>{rotuloTipo(tipo)}{tipo !== 'todas' ? ` (${itens.filter(i => i.tipo === tipo).length})` : ''}</button>)}
      </div>

      {loading ? <div style={empty}>Carregando pendências...</div> : visiveis.length === 0 ? <div style={empty}>Nenhuma pendência neste filtro.</div> : (
        <div style={{ display: 'grid', gap: 9 }} aria-live="polite">
          {visiveis.map(pendencia => (
            <div key={pendencia.key} role="button" tabIndex={0} onClick={() => navigate(pendencia.rota)} onKeyDown={event => { if (event.key === 'Enter') navigate(pendencia.rota) }} style={card}>
              <span style={badge(pendencia.prioridade)}>{pendencia.prioridade}</span>
              <span style={{ minWidth: 0, textAlign: 'left', flex: 1 }}>
                <strong style={{ display: 'block', color: theme.textPrimary, fontSize: 13.5 }}>{pendencia.titulo}</strong>
                <span style={{ display: 'block', color: theme.textSecondary, fontSize: 12, marginTop: 3 }}>{pendencia.obra} · {pendencia.detalhe}</span>
              </span>
              {pendencia.tipo === 'ocorrencia' && (
                <button type="button" onClick={event => concluirOcorrencia(event, pendencia)} onKeyDown={event => event.stopPropagation()} disabled={Boolean(resolvendo)} style={{ border: `1px solid ${theme.success}`, background: theme.statusBg.success, color: theme.success, borderRadius: 8, minHeight: 36, padding: '8px 10px', fontSize: 10.5, fontWeight: 900, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                  {resolvendo === pendencia.entidadeId ? 'Salvando...' : 'Concluir ocorrência'}
                </button>
              )}
              <span style={{ color: theme.gold, fontWeight: 900 }}>›</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function item(tipo, prioridade, obraId, obra, titulo, detalhe, aba, entidadeId = '') {
  return { key: `${tipo}-${entidadeId || obraId}-${titulo}`, tipo, prioridade, obra, titulo, detalhe, entidadeId, rota: `/obras/${obraId}?aba=${encodeURIComponent(aba)}${entidadeId ? `&${tipo}=${entidadeId}` : ''}` }
}
function dataBR(data) { return data ? new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR') : '-' }
function moeda(valor) { return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function rotuloTipo(tipo) { return ({ todas: 'Todas', trava: 'Travas', prazo: 'Prazos', reagendamento: 'Reagendamentos', agenda: 'Agenda', foto: 'Fotos', gasto: 'Gastos', checklist: 'Checklist', ocorrencia: 'Ocorrências' })[tipo] || tipo }
function Kpi({ titulo, valor, cor = theme.gold }) { return <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 16 }}><small style={{ color: theme.textSecondary }}>{titulo}</small><strong style={{ display: 'block', color: cor, fontSize: 25, marginTop: 4 }}>{valor}</strong></div> }
const label = { color: theme.gold, letterSpacing: 2.2, fontSize: 9, fontWeight: 900 }
const kpiGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(110px, 1fr))', gap: 10, marginBottom: 18 }
const empty = { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 28, color: theme.textSecondary, textAlign: 'center' }
const card = { width: '100%', display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${theme.border}`, background: theme.surface, borderRadius: 12, padding: '13px 15px', cursor: 'pointer', fontFamily: 'inherit' }
const chip = ativo => ({ border: `1px solid ${ativo ? theme.gold : theme.border}`, background: ativo ? theme.gold : theme.surface, color: ativo ? '#15120e' : theme.textSecondary, borderRadius: 999, padding: '7px 11px', fontSize: 11, fontWeight: 800, cursor: 'pointer' })
const badge = prioridade => ({ minWidth: 57, textAlign: 'center', padding: '5px 7px', borderRadius: 999, fontSize: 9, textTransform: 'uppercase', fontWeight: 900, color: prioridade === 'critica' ? theme.error : prioridade === 'alta' ? theme.warning : theme.textSecondary, background: prioridade === 'critica' ? theme.statusBg.danger : prioridade === 'alta' ? theme.statusBg.warning : theme.surfaceElevated })
