import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KpiCard as DesignKpiCard, StatusBadge } from '../../components/DesignSystem'
import { supabase } from '../../lib/supabase'
import { exportarPlanejamentoPdf } from '../../services/pdfService'

const THEME = {
  bg: '#F6F3EE',
  card: '#FFFFFF',
  border: '#E7E0D5',
  ink: '#1D1C19',
  muted: '#6D675E',
  gold: '#B8965E',
  success: '#2D7A4A',
  danger: '#B84040',
  warn: '#A36F22',
  blue: '#365C7D',
}

const FASE_CORES = {
  producao: '#B8965E',
  premontagem: '#365C7D',
  montagem: '#2D7A4A',
  entrega: '#7A5AA6',
  posvenda: '#A36F22',
  preobra: '#6D675E',
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']
const TIPOS_COMPROMISSO = ['Montagem', 'Assistência Técnica', 'Vistoria', 'Medição', 'Entrega', 'Reunião']

function norm(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function corFase(fase) {
  const key = norm(fase).replace(/[^a-z0-9]/g, '')
  return FASE_CORES[key] || THEME.gold
}

function safeArray(result) {
  return result?.data || []
}

function dateOnly(value) {
  if (!value) return null
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function dataBR(value) {
  if (!value) return '-'
  const d = dateOnly(value)
  return d ? d.toLocaleDateString('pt-BR') : '-'
}

function overlapsRange(start, end, rangeStart, rangeEnd) {
  if (!start && !end) return false
  const s = start || end
  const e = end || start
  return s <= rangeEnd && e >= rangeStart
}

function startOfCalendar(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const day = first.getDay() || 7
  first.setDate(first.getDate() - (day - 1))
  return first
}

function endOfCalendar(monthDate) {
  const last = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
  const day = last.getDay() || 7
  last.setDate(last.getDate() + (7 - day))
  return last
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function nomePessoa(profile) {
  return profile?.full_name || profile?.email || '-'
}

export default function Planejamento() {
  const navigate = useNavigate()
  const [dados, setDados] = useState({ cronogramas: [], obras: [], profiles: [], montadores: [], agenda: [] })
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [exportandoPdf, setExportandoPdf] = useState(false)
  const [toast, setToast] = useState('')
  const [modalCompromisso, setModalCompromisso] = useState(null)
  const [mesAtual, setMesAtual] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [visao, setVisao] = useState('calendario')
  const [filtros, setFiltros] = useState({ mes: monthKey(new Date()), supervisor: '', montador: '', status: '', cidade: '' })

  async function carregarDados() {
    setLoading(true)
    setErro('')

    const [cronogramas, obras, profiles, montadores, agenda] = await Promise.all([
      supabase.from('obra_cronograma').select('*').order('data_inicio_prevista', { ascending: true }),
      supabase.from('obras').select('id, nome, cliente_nome, cidade, uf, status, supervisor_id, comercial_id, data_previsao').order('nome'),
      supabase.from('profiles').select('id, full_name, email, role'),
      supabase.from('obra_montadores').select('obra_id, montador_id'),
      supabase.from('agenda').select('id, obra_id, tipo, titulo, data, data_fim, hora_inicio, hora_fim, responsavel_id, observacao').order('data'),
    ])

    const falha = [cronogramas, obras, profiles, montadores, agenda].find(r => r.error)
    if (falha?.error) setErro(falha.error.message)

    setDados({
      cronogramas: safeArray(cronogramas),
      obras: safeArray(obras),
      profiles: safeArray(profiles),
      montadores: safeArray(montadores),
      agenda: safeArray(agenda),
    })
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregarDados() }, [])

  const vm = useMemo(() => {
    const obraPorId = new Map(dados.obras.map(o => [o.id, o]))
    const profilePorId = new Map(dados.profiles.map(p => [p.id, p]))
    const montadoresPorObra = new Map()

    dados.montadores.forEach(v => {
      const lista = montadoresPorObra.get(v.obra_id) || []
      lista.push(v.montador_id)
      montadoresPorObra.set(v.obra_id, lista)
    })

    const registros = dados.cronogramas.map(c => {
      const obra = obraPorId.get(c.obra_id) || {}
      const supervisor = profilePorId.get(c.supervisor_id || obra.supervisor_id)
      const montadorIds = montadoresPorObra.get(c.obra_id) || []
      const montadores = montadorIds.map(id => profilePorId.get(id)).filter(Boolean)
      const inicio = dateOnly(c.data_inicio_prevista)
      const fim = dateOnly(c.data_fim_prevista) || inicio
      return {
        ...c,
        obra,
        supervisor,
        montadores,
        inicio,
        fim,
        faseCor: corFase(c.fase),
      }
    })

    const compromissosAgenda = dados.agenda.map(a => {
      const obra = obraPorId.get(a.obra_id) || {}
      const supervisor = profilePorId.get(a.responsavel_id || obra.supervisor_id)
      const montadorIds = montadoresPorObra.get(a.obra_id) || []
      const montadores = montadorIds.map(id => profilePorId.get(id)).filter(Boolean)
      const inicio = dateOnly(a.data)
      const fim = dateOnly(a.data_fim) || inicio
      return {
        ...a,
        origem: 'agenda',
        obra,
        supervisor,
        montadores,
        inicio,
        fim,
        faseCor: corFase(a.tipo),
        compromissoTipo: a.tipo || a.titulo || 'Compromisso',
      }
    })

    const mesInicio = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1)
    const mesFim = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0)
    const dias = []
    const calInicio = startOfCalendar(mesAtual)
    const calFim = endOfCalendar(mesAtual)
    for (const d = new Date(calInicio); d <= calFim; d.setDate(d.getDate() + 1)) {
      const atual = new Date(d)
      const obrasCronograma = registros
        .filter(r => r.inicio && r.fim && atual >= r.inicio && atual <= r.fim)
        .map(r => ({ ...r, origem: 'cronograma', compromissoTipo: r.fase || 'Cronograma' }))
      const agendaDia = compromissosAgenda.filter(r => r.inicio && r.fim && atual >= r.inicio && atual <= r.fim)
      dias.push({
        data: atual,
        key: isoDate(atual),
        noMes: atual.getMonth() === mesAtual.getMonth(),
        obras: [...agendaDia, ...obrasCronograma],
      })
    }

    const filtroMesDate = filtros.mes ? dateOnly(`${filtros.mes}-01`) : mesInicio
    const filtroInicio = filtroMesDate ? new Date(filtroMesDate.getFullYear(), filtroMesDate.getMonth(), 1) : mesInicio
    const filtroFim = filtroMesDate ? new Date(filtroMesDate.getFullYear(), filtroMesDate.getMonth() + 1, 0) : mesFim

    const filtrados = registros.filter(r => {
      const porMes = overlapsRange(r.inicio, r.fim, filtroInicio, filtroFim)
      const porSupervisor = !filtros.supervisor || (r.supervisor_id || r.obra.supervisor_id) === filtros.supervisor
      const porMontador = !filtros.montador || r.montadores.some(m => m.id === filtros.montador)
      const porStatus = !filtros.status || norm(r.status_operacional).includes(norm(filtros.status))
      const porCidade = !filtros.cidade || r.obra.cidade === filtros.cidade
      return porMes && porSupervisor && porMontador && porStatus && porCidade
    })

    const mesesGantt = []
    const datas = registros.flatMap(r => [r.inicio, r.fim]).filter(Boolean)
    const inicioBase = datas.length ? new Date(Math.min(...datas.map(d => d.getTime()))) : mesInicio
    const fimBase = datas.length ? new Date(Math.max(...datas.map(d => d.getTime()))) : addMonths(mesInicio, 5)
    const primeiroMes = new Date(inicioBase.getFullYear(), inicioBase.getMonth(), 1)
    const ultimoMes = new Date(fimBase.getFullYear(), fimBase.getMonth(), 1)
    for (const d = new Date(primeiroMes); d <= ultimoMes; d.setMonth(d.getMonth() + 1)) {
      mesesGantt.push(new Date(d))
    }

    const agendaMes = compromissosAgenda.filter(a => a.inicio && overlapsRange(a.inicio, a.fim, mesInicio, mesFim))
    const obrasProgramadasIds = new Set([
      ...registros.filter(r => overlapsRange(r.inicio, r.fim, mesInicio, mesFim)).map(r => r.obra_id),
      ...agendaMes.map(a => a.obra_id),
    ].filter(Boolean))
    const obrasComEquipeIds = new Set(dados.montadores.map(m => m.obra_id).filter(Boolean))
    const obrasComCronogramaIds = new Set(dados.cronogramas.map(c => c.obra_id).filter(Boolean))
    const obrasSemEquipe = dados.obras.filter(o => !obrasComEquipeIds.has(o.id))
    const obrasSemCronograma = dados.obras.filter(o => !obrasComCronogramaIds.has(o.id))
    const obrasRisco = registros.filter(r => r.travado || norm(r.risco).includes('alto') || norm(r.status_operacional).includes('risco') || norm(r.status_operacional).includes('trav'))
    const kpis = {
      montagensMes: agendaMes.filter(a => norm(a.compromissoTipo).includes('montagem')).length,
      obrasProgramadas: obrasProgramadasIds.size,
      obrasSemEquipe: obrasSemEquipe.length,
      obrasSemCronograma: obrasSemCronograma.length,
      obrasRisco: obrasRisco.length,
      entregasPrevistas: agendaMes.filter(a => norm(a.compromissoTipo).includes('entrega')).length + registros.filter(r => norm(r.fase).includes('entrega') && r.fim && r.fim >= mesInicio && r.fim <= mesFim).length,
    }

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const em7 = new Date(hoje)
    em7.setDate(em7.getDate() + 7)
    const alertas = [
      ...obrasSemEquipe.slice(0, 8).map(obra => ({ tipo: 'Sem montador', obra, detalhe: 'Nenhum montador vinculado à obra', cor: THEME.warn })),
      ...obrasSemCronograma.slice(0, 8).map(obra => ({ tipo: 'Sem cronograma', obra, detalhe: 'Obra ainda não possui cronograma operacional', cor: THEME.blue })),
      ...dados.obras.filter(o => !o.data_previsao).slice(0, 8).map(obra => ({ tipo: 'Sem data prevista', obra, detalhe: 'Previsão de entrega não informada', cor: THEME.muted })),
      ...agendaMes.filter(a => norm(a.compromissoTipo).includes('montagem') && a.inicio >= hoje && a.inicio <= em7).slice(0, 8).map(a => ({ tipo: 'Inicia em breve', obra: a.obra, detalhe: `${a.compromissoTipo} em ${dataBR(a.data)}`, cor: THEME.gold })),
      ...registros.filter(r => r.travado).slice(0, 8).map(r => ({ tipo: 'Obra travada', obra: r.obra, detalhe: r.motivo_trava || 'Cronograma marcado como travado', cor: THEME.danger })),
    ].slice(0, 12)

    return {
      registros,
      compromissosAgenda,
      dias,
      filtrados,
      mesesGantt,
      kpis,
      alertas,
      supervisores: dados.profiles.filter(p => ['gestao', 'supervisor'].includes(p.role)),
      montadores: dados.profiles.filter(p => p.role === 'montador'),
      cidades: [...new Set(dados.obras.map(o => o.cidade).filter(Boolean))].sort(),
      statuses: [...new Set(dados.cronogramas.map(c => c.status_operacional).filter(Boolean))].sort(),
      agendaMes,
    }
  }, [dados, filtros, mesAtual])

  function abrirObra(id) {
    if (id) navigate(`/obras/${id}`)
  }

  function abrirModalDia(data) {
    setModalCompromisso({
      tipo: 'Montagem',
      obra_id: '',
      supervisor_id: '',
      montadores: [],
      data: isoDate(data),
      data_fim: isoDate(data),
      observacao: '',
      anexos: [],
    })
  }

  async function salvarCompromisso() {
    if (!modalCompromisso?.tipo || !modalCompromisso?.data) return
    setSalvando(true)
    setErro('')

    const obra = dados.obras.find(o => o.id === modalCompromisso.obra_id)
    const supervisorId = modalCompromisso.supervisor_id || obra?.supervisor_id || null
    const montadoresSelecionados = modalCompromisso.montadores
      .map(id => dados.profiles.find(p => p.id === id))
      .filter(Boolean)
      .map(nomePessoa)
    const anexos = Array.from(modalCompromisso.anexos || []).map(a => a.name)
    const blocosObservacao = [
      modalCompromisso.observacao,
      montadoresSelecionados.length ? `Montadores: ${montadoresSelecionados.join(', ')}` : '',
      anexos.length ? `Anexos informados: ${anexos.join(', ')}` : '',
    ].filter(Boolean)

    const { error } = await supabase.from('agenda').insert([{
      titulo: `${modalCompromisso.tipo}${obra?.nome ? ' - ' + obra.nome : ''}`,
      tipo: modalCompromisso.tipo,
      obra_id: modalCompromisso.obra_id || null,
      responsavel_id: supervisorId,
      data: modalCompromisso.data,
      data_fim: modalCompromisso.data_fim || modalCompromisso.data,
      hora_inicio: '08:00',
      hora_fim: null,
      observacao: blocosObservacao.join('\n'),
      reuniao_interna: modalCompromisso.tipo === 'Reunião' && !modalCompromisso.obra_id,
    }])

    if (error) {
      setErro(error.message)
    } else {
      setToast('Compromisso criado na agenda.')
      setTimeout(() => setToast(''), 3200)
      setModalCompromisso(null)
      await carregarDados()
    }
    setSalvando(false)
  }

  async function gerarPdfPlanejamento() {
    setExportandoPdf(true)
    try {
      await exportarPlanejamentoPdf({ registros: vm.filtrados, agenda: vm.agendaMes, mesAtual })
      setToast('PDF de planejamento gerado.')
      setTimeout(() => setToast(''), 3200)
    } catch (error) {
      setErro(error.message || 'Erro ao gerar PDF de planejamento.')
    }
    setExportandoPdf(false)
  }

  return (
    <div className="pl-page">
      <style>{css}</style>
      {toast && <div className="pl-toast">{toast}</div>}
      {modalCompromisso && (
        <CompromissoModal
          form={modalCompromisso}
          setForm={setModalCompromisso}
          obras={dados.obras}
          supervisores={vm.supervisores}
          montadores={vm.montadores}
          vinculos={dados.montadores}
          salvando={salvando}
          onClose={() => setModalCompromisso(null)}
          onSave={salvarCompromisso}
        />
      )}

      <header className="pl-header">
        <div>
          <div className="pl-eyebrow">Ornare Works</div>
          <h1>Planejamento</h1>
          <p>Central de Planejamento Operacional da Ornare</p>
        </div>
        <div className="pl-month-nav">
          <button onClick={gerarPdfPlanejamento} disabled={exportandoPdf}>{exportandoPdf ? 'Gerando...' : 'Exportar PDF'}</button>
          <button onClick={() => setMesAtual(m => addMonths(m, -1))}>Anterior</button>
          <strong>{MESES[mesAtual.getMonth()]} {mesAtual.getFullYear()}</strong>
          <button onClick={() => setMesAtual(m => addMonths(m, 1))}>Próximo</button>
        </div>
      </header>

      {erro && <div className="pl-alert">Alguns dados não foram carregados: {erro}</div>}

      <section className="pl-kpis">
        <Kpi label="Montagens no mês" value={vm.kpis.montagensMes} />
        <Kpi label="Obras programadas" value={vm.kpis.obrasProgramadas} />
        <Kpi label="Obras sem equipe" value={vm.kpis.obrasSemEquipe} danger={vm.kpis.obrasSemEquipe > 0} />
        <Kpi label="Sem cronograma" value={vm.kpis.obrasSemCronograma} danger={vm.kpis.obrasSemCronograma > 0} />
        <Kpi label="Obras em risco" value={vm.kpis.obrasRisco} danger={vm.kpis.obrasRisco > 0} />
        <Kpi label="Entregas previstas" value={vm.kpis.entregasPrevistas} />
      </section>

      <AtencaoPanel alertas={vm.alertas} abrirObra={abrirObra} />

      <nav className="pl-tabs">
        {[
          ['calendario', 'Calendário Mensal'],
          ['tabela', 'Cronograma Operacional'],
          ['gantt', 'Gantt Executivo'],
        ].map(([id, label]) => (
          <button key={id} className={visao === id ? 'active' : ''} onClick={() => setVisao(id)}>{label}</button>
        ))}
      </nav>

      {loading ? (
        <div className="pl-empty">Carregando planejamento...</div>
      ) : (
        <>
          {visao === 'calendario' && <Calendario dias={vm.dias} mesAtual={mesAtual} abrirObra={abrirObra} abrirModalDia={abrirModalDia} />}
          {visao === 'tabela' && (
            <CronogramaTabela
              registros={vm.filtrados}
              filtros={filtros}
              setFiltros={setFiltros}
              supervisores={vm.supervisores}
              montadores={vm.montadores}
              statuses={vm.statuses}
              cidades={vm.cidades}
              abrirObra={abrirObra}
            />
          )}
          {visao === 'gantt' && <Gantt registros={vm.filtrados} meses={vm.mesesGantt} abrirObra={abrirObra} />}
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, danger }) {
  return <DesignKpiCard label={label} value={value} danger={danger} />
}

function AtencaoPanel({ alertas, abrirObra }) {
  return (
    <section className="pl-attention">
      <div className="pl-card-head">
        <h2>Exigem Atenção</h2>
        <span>{alertas.length} itens</span>
      </div>
      {alertas.length === 0 ? (
        <div className="pl-attention-empty">Nenhum alerta operacional relevante para o mês.</div>
      ) : (
        <div className="pl-attention-list">
          {alertas.map((alerta, index) => (
            <button key={`${alerta.tipo}-${alerta.obra?.id || index}-${index}`} onClick={() => abrirObra(alerta.obra?.id)}>
              <i style={{ background: alerta.cor }} />
              <div>
                <strong>{alerta.tipo}</strong>
                <span>{alerta.obra?.nome || 'Obra'} · {alerta.detalhe}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function Calendario({ dias, mesAtual, abrirObra, abrirModalDia }) {
  return (
    <section className="pl-card">
      <div className="pl-card-head">
        <h2>Calendário mensal</h2>
        <span>{MESES[mesAtual.getMonth()]} {mesAtual.getFullYear()}</span>
      </div>
      <div className="pl-weekdays">
        {DIAS.map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="pl-calendar">
        {dias.map(dia => (
          <div key={dia.key} className={dia.noMes ? 'pl-day' : 'pl-day outside'} onClick={() => abrirModalDia(dia.data)}>
            <div className="pl-day-num">{dia.data.getDate()}</div>
            <div className="pl-day-items">
              {dia.obras.slice(0, 4).map(item => (
                <button key={`${dia.key}-${item.origem}-${item.id}`} onClick={e => { e.stopPropagation(); abrirObra(item.obra_id) }}>
                  <strong>{item.obra.nome || 'Obra'}</strong>
                  <span>{item.montadores[0] ? nomePessoa(item.montadores[0]) : nomePessoa(item.supervisor)}</span>
                  <em>{item.compromissoTipo}</em>
                </button>
              ))}
              {dia.obras.length > 4 && <small>+{dia.obras.length - 4} obras</small>}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function CompromissoModal({ form, setForm, obras, supervisores, montadores, vinculos, salvando, onClose, onSave }) {
  const obraSelecionada = obras.find(o => o.id === form.obra_id)
  const montadoresDaObra = form.obra_id
    ? montadores.filter(m => vinculos.some(v => v.obra_id === form.obra_id && v.montador_id === m.id))
    : montadores
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const toggleMontador = id => set('montadores', form.montadores.includes(id) ? form.montadores.filter(m => m !== id) : [...form.montadores, id])

  return (
    <div className="pl-modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="pl-modal">
        <div className="pl-modal-head">
          <div>
            <span>Novo compromisso</span>
            <h2>Planejar dia operacional</h2>
          </div>
          <button onClick={onClose}>X</button>
        </div>

        <div className="pl-modal-body">
          <div className="pl-form-grid">
            <label>
              <span>Tipo de compromisso</span>
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                {TIPOS_COMPROMISSO.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
              </select>
            </label>
            <label>
              <span>Obra</span>
              <select value={form.obra_id} onChange={e => {
                const obra = obras.find(o => o.id === e.target.value)
                setForm(f => ({ ...f, obra_id: e.target.value, supervisor_id: obra?.supervisor_id || f.supervisor_id, montadores: [] }))
              }}>
                <option value="">Sem obra vinculada</option>
                {obras.map(obra => <option key={obra.id} value={obra.id}>{obra.nome}</option>)}
              </select>
            </label>
            <label>
              <span>Supervisor</span>
              <select value={form.supervisor_id || obraSelecionada?.supervisor_id || ''} onChange={e => set('supervisor_id', e.target.value)}>
                <option value="">Sem supervisor</option>
                {supervisores.map(p => <option key={p.id} value={p.id}>{nomePessoa(p)}</option>)}
              </select>
            </label>
            <label>
              <span>Data início</span>
              <input type="date" value={form.data} onChange={e => set('data', e.target.value)} />
            </label>
            <label>
              <span>Data fim</span>
              <input type="date" value={form.data_fim} onChange={e => set('data_fim', e.target.value)} />
            </label>
            <label>
              <span>Anexos</span>
              <input type="file" multiple onChange={e => set('anexos', e.target.files)} />
            </label>
          </div>

          <div className="pl-montadores">
            <span>Montadores</span>
            {montadoresDaObra.length === 0 ? (
              <small>Nenhum montador vinculado a esta obra.</small>
            ) : (
              <div>
                {montadoresDaObra.map(m => (
                  <button key={m.id} className={form.montadores.includes(m.id) ? 'active' : ''} onClick={() => toggleMontador(m.id)}>
                    {nomePessoa(m)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="pl-observacao">
            <span>Observação</span>
            <textarea rows={4} value={form.observacao} onChange={e => set('observacao', e.target.value)} placeholder="Detalhes para equipe, restrições de acesso, materiais, horários..." />
          </label>
        </div>

        <div className="pl-modal-foot">
          <button onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={onSave} disabled={salvando || !form.tipo || !form.data}>{salvando ? 'Salvando...' : 'Salvar na agenda'}</button>
        </div>
      </div>
    </div>
  )
}

function CronogramaTabela({ registros, filtros, setFiltros, supervisores, montadores, statuses, cidades, abrirObra }) {
  return (
    <section className="pl-card">
      <div className="pl-card-head">
        <h2>Cronograma operacional</h2>
        <span>{registros.length} obras</span>
      </div>

      <div className="pl-filters">
        <input type="month" value={filtros.mes} onChange={e => setFiltros(f => ({ ...f, mes: e.target.value }))} />
        <select value={filtros.supervisor} onChange={e => setFiltros(f => ({ ...f, supervisor: e.target.value }))}>
          <option value="">Supervisor</option>
          {supervisores.map(p => <option key={p.id} value={p.id}>{nomePessoa(p)}</option>)}
        </select>
        <select value={filtros.montador} onChange={e => setFiltros(f => ({ ...f, montador: e.target.value }))}>
          <option value="">Montador</option>
          {montadores.map(p => <option key={p.id} value={p.id}>{nomePessoa(p)}</option>)}
        </select>
        <select value={filtros.status} onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))}>
          <option value="">Status</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filtros.cidade} onChange={e => setFiltros(f => ({ ...f, cidade: e.target.value }))}>
          <option value="">Cidade</option>
          {cidades.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="pl-table-wrap">
        <table className="pl-table">
          <thead>
            <tr>
              <th>Obra</th>
              <th>Cliente</th>
              <th>Supervisor</th>
              <th>Montadores</th>
              <th>Fase</th>
              <th>Status</th>
              <th>Prioridade</th>
              <th>Risco</th>
              <th>Inicio</th>
              <th>Fim</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {registros.map(r => (
              <tr key={r.id} onClick={() => abrirObra(r.obra_id)}>
                <td><strong>{r.obra.nome || '-'}</strong><small>{[r.obra.cidade, r.obra.uf].filter(Boolean).join(' / ')}</small></td>
                <td>{r.obra.cliente_nome || '-'}</td>
                <td>{nomePessoa(r.supervisor)}</td>
                <td>{r.montadores.map(nomePessoa).join(', ') || '-'}</td>
                <td><Badge color={r.faseCor}>{r.fase || '-'}</Badge></td>
                <td>{r.status_operacional || '-'}</td>
                <td>{r.prioridade || '-'}</td>
                <td>{r.risco || '-'}</td>
                <td>{dataBR(r.data_inicio_prevista)}</td>
                <td>{dataBR(r.data_fim_prevista)}</td>
                <td>{Number(r.percentual_concluido || 0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Gantt({ registros, meses, abrirObra }) {
  return (
    <section className="pl-card">
      <div className="pl-card-head">
        <h2>Gantt executivo</h2>
        <span>{meses.length} meses</span>
      </div>
      <div className="pl-gantt" style={{ '--cols': meses.length }}>
        <div className="pl-gantt-head">
          <div>Obra</div>
          {meses.map(m => <div key={monthKey(m)}>{MESES[m.getMonth()].slice(0, 3)} {String(m.getFullYear()).slice(2)}</div>)}
        </div>
        {registros.map(r => {
          const startIdx = Math.max(0, meses.findIndex(m => r.inicio && m.getFullYear() === r.inicio.getFullYear() && m.getMonth() === r.inicio.getMonth()))
          const endIdxRaw = meses.findIndex(m => r.fim && m.getFullYear() === r.fim.getFullYear() && m.getMonth() === r.fim.getMonth())
          const endIdx = endIdxRaw >= 0 ? endIdxRaw : startIdx
          return (
            <button className="pl-gantt-row" key={r.id} onClick={() => abrirObra(r.obra_id)}>
              <div className="pl-gantt-name">
                <strong>{r.obra.nome || 'Obra'}</strong>
                <span>{r.status_operacional || '-'}</span>
              </div>
              <div className="pl-gantt-lane" style={{ gridColumn: `span ${meses.length}` }}>
                <i style={{ left: `${(startIdx / meses.length) * 100}%`, width: `${Math.max(((endIdx - startIdx + 1) / meses.length) * 100, 5)}%`, background: r.faseCor }}>
                  {r.fase || 'Cronograma'}
                </i>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function Badge({ color, children }) {
  return <StatusBadge style={{ color, background: `${color}18` }}>{children}</StatusBadge>
}

const css = `
.pl-page{min-height:100vh;background:${THEME.bg};padding:30px 34px 52px;color:${THEME.ink};font-family:var(--font-sans);box-sizing:border-box}
.pl-header{max-width:1480px;margin:0 auto 20px;display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
.pl-eyebrow{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${THEME.gold};font-weight:800;margin-bottom:7px}
.pl-header h1{font-family:var(--font-serif);font-size:40px;line-height:1.05;font-weight:500;margin:0;color:${THEME.ink}}
.pl-header p{margin:7px 0 0;font-size:13px;color:${THEME.muted}}
.pl-month-nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.pl-month-nav strong{min-width:180px;text-align:center;font-size:14px}
.pl-month-nav button,.pl-tabs button{border:1px solid ${THEME.border};background:#fff;color:${THEME.ink};border-radius:10px;padding:10px 13px;font-size:12px;font-weight:800;cursor:pointer}
.pl-alert{max-width:1480px;margin:0 auto 14px;border:1px solid #F0C8C8;background:#FFF7F7;color:${THEME.danger};border-radius:12px;padding:11px 14px;font-size:13px;font-weight:700}
.pl-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:1200;background:${THEME.ink};color:#fff;border-left:3px solid ${THEME.gold};border-radius:13px;padding:12px 18px;font-size:13px;font-weight:800;box-shadow:0 14px 34px rgba(29,28,25,.18)}
.pl-kpis{max-width:1480px;margin:0 auto 16px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}
.pl-kpi{background:#fff;border:1px solid ${THEME.border};border-top:3px solid ${THEME.gold};border-radius:14px;padding:15px 16px}
.pl-kpi.danger{border-top-color:${THEME.danger}}
.pl-kpi span{display:block;font-size:10px;letter-spacing:1.7px;text-transform:uppercase;color:${THEME.gold};font-weight:800;margin-bottom:9px;white-space:nowrap}
.pl-kpi.danger span{color:${THEME.danger}}
.pl-kpi strong{display:block;font-size:32px;line-height:1;color:${THEME.ink}}
.pl-tabs{max-width:1480px;margin:0 auto 16px;display:flex;gap:8px;overflow-x:auto;padding-bottom:2px}
.pl-tabs button.active{background:${THEME.ink};border-color:${THEME.ink};color:#fff}
.pl-attention{max-width:1480px;margin:0 auto 16px;background:#fff;border:1px solid ${THEME.border};border-radius:18px;padding:16px 18px;box-shadow:0 14px 34px rgba(29,28,25,.045)}
.pl-attention-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.pl-attention-list button{border:1px solid ${THEME.border};background:#FFFEFC;border-radius:13px;padding:12px;text-align:left;display:flex;gap:10px;align-items:flex-start;cursor:pointer;font-family:inherit}
.pl-attention-list i{width:8px;height:8px;border-radius:999px;margin-top:5px;flex-shrink:0}
.pl-attention-list strong{display:block;font-size:12px;color:${THEME.ink};margin-bottom:3px}
.pl-attention-list span{display:block;font-size:11.5px;color:${THEME.muted};line-height:1.35}
.pl-attention-empty{padding:18px 0;text-align:center;color:#A79F93;font-size:13px}
.pl-card{max-width:1480px;margin:0 auto;background:#fff;border:1px solid ${THEME.border};border-radius:18px;padding:18px 20px;box-shadow:0 14px 34px rgba(29,28,25,.05);box-sizing:border-box}
.pl-card-head{display:flex;justify-content:space-between;gap:14px;align-items:center;margin-bottom:15px}
.pl-card-head h2{font-size:15px;margin:0;font-weight:900;color:${THEME.ink}}
.pl-card-head span{font-size:12px;color:${THEME.gold};font-weight:900}
.pl-weekdays{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:8px}
.pl-weekdays div{font-size:11px;color:${THEME.muted};font-weight:900;text-align:center}
.pl-calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
.pl-day{min-height:132px;border:1px solid ${THEME.border};background:#FFFEFC;border-radius:13px;padding:9px;min-width:0;cursor:pointer;transition:border-color .15s,box-shadow .15s}
.pl-day:hover{border-color:${THEME.gold};box-shadow:0 10px 24px rgba(29,28,25,.06)}
.pl-day.outside{opacity:.45;background:#F9F6F0}
.pl-day-num{font-size:12px;font-weight:900;color:${THEME.gold};margin-bottom:7px}
.pl-day-items{display:flex;flex-direction:column;gap:6px}
.pl-day-items button{border:0;background:#F6F1E8;border-left:3px solid ${THEME.gold};border-radius:9px;padding:7px 8px;text-align:left;cursor:pointer;font-family:inherit;min-width:0}
.pl-day-items strong{display:block;font-size:11.5px;color:${THEME.ink};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pl-day-items span,.pl-day-items small{display:block;font-size:10.5px;color:${THEME.muted};margin-top:2px}
.pl-day-items em{display:inline-flex;margin-top:5px;border-radius:999px;background:#fff;color:${THEME.gold};font-style:normal;font-size:9.5px;font-weight:900;padding:2px 6px}
.pl-filters{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin-bottom:14px}
.pl-filters input,.pl-filters select{width:100%;box-sizing:border-box;border:1px solid ${THEME.border};background:#FFFEFC;border-radius:10px;padding:10px 11px;font-family:inherit;font-size:12.5px;color:${THEME.ink}}
.pl-table-wrap{overflow:auto;border:1px solid ${THEME.border};border-radius:14px}
.pl-table{width:100%;border-collapse:collapse;min-width:1120px}
.pl-table th{background:#F9F6F0;color:${THEME.muted};font-size:10px;letter-spacing:1.2px;text-transform:uppercase;text-align:left;padding:11px 12px;white-space:nowrap}
.pl-table td{border-top:1px solid ${THEME.border};padding:12px;font-size:12.5px;color:${THEME.ink};vertical-align:middle}
.pl-table tr{cursor:pointer}
.pl-table tr:hover{background:#FFF9EF}
.pl-table td strong{display:block;font-size:13px}
.pl-table td small{display:block;color:${THEME.muted};font-size:11px;margin-top:3px}
.pl-badge{display:inline-flex;border-radius:999px;padding:5px 8px;font-size:10.5px;font-weight:900;white-space:nowrap}
.pl-gantt{overflow:auto;border:1px solid ${THEME.border};border-radius:14px}
.pl-gantt-head,.pl-gantt-row{display:grid;grid-template-columns:260px repeat(var(--cols),120px);min-width:max-content}
.pl-gantt-head{background:#F9F6F0;color:${THEME.muted};font-size:10px;letter-spacing:1.2px;text-transform:uppercase;font-weight:900}
.pl-gantt-head>div{padding:11px 12px;border-right:1px solid ${THEME.border}}
.pl-gantt-row{width:100%;border:0;background:#fff;border-top:1px solid ${THEME.border};text-align:left;font-family:inherit;cursor:pointer;padding:0}
.pl-gantt-row:hover{background:#FFF9EF}
.pl-gantt-name{padding:12px;border-right:1px solid ${THEME.border};position:sticky;left:0;background:inherit;z-index:2}
.pl-gantt-name strong{display:block;font-size:13px;color:${THEME.ink}}
.pl-gantt-name span{display:block;font-size:11px;color:${THEME.muted};margin-top:3px}
.pl-gantt-lane{position:relative;height:54px;background:repeating-linear-gradient(90deg,#fff 0,#fff 119px,${THEME.border} 120px)}
.pl-gantt-lane i{position:absolute;top:16px;height:22px;border-radius:999px;color:#fff;font-style:normal;font-size:10px;font-weight:900;padding:5px 10px;box-sizing:border-box;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;box-shadow:0 8px 18px rgba(29,28,25,.12)}
.pl-empty{max-width:1480px;margin:0 auto;background:#fff;border:1px solid ${THEME.border};border-radius:16px;padding:42px;text-align:center;color:${THEME.muted}}
.pl-modal-bg{position:fixed;inset:0;background:rgba(29,28,25,.48);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)}
.pl-modal{width:100%;max-width:780px;max-height:92vh;background:#fff;border:1px solid ${THEME.border};border-radius:18px;box-shadow:0 28px 80px rgba(29,28,25,.22);display:flex;flex-direction:column;overflow:hidden}
.pl-modal-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:22px 24px 0}
.pl-modal-head span{display:block;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${THEME.gold};font-weight:900;margin-bottom:5px}
.pl-modal-head h2{font-family:var(--font-serif);font-size:28px;line-height:1.05;font-weight:500;margin:0;color:${THEME.ink}}
.pl-modal-head button{border:1px solid ${THEME.border};background:#fff;border-radius:10px;color:${THEME.muted};font-size:12px;font-weight:900;padding:8px 10px;cursor:pointer}
.pl-modal-body{padding:22px 24px;overflow:auto}
.pl-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.pl-form-grid label,.pl-observacao{display:flex;flex-direction:column;gap:6px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${THEME.muted};font-weight:900}
.pl-form-grid input,.pl-form-grid select,.pl-observacao textarea{width:100%;box-sizing:border-box;border:1px solid ${THEME.border};background:#FFFEFC;border-radius:10px;padding:10px 11px;font-family:inherit;font-size:13px;color:${THEME.ink};outline:none}
.pl-montadores{margin:16px 0;border:1px solid ${THEME.border};background:#FFFEFC;border-radius:14px;padding:14px}
.pl-montadores>span{display:block;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${THEME.gold};font-weight:900;margin-bottom:9px}
.pl-montadores small{display:block;font-size:12px;color:${THEME.muted}}
.pl-montadores>div{display:flex;gap:8px;flex-wrap:wrap}
.pl-montadores button{border:1px solid ${THEME.border};background:#fff;color:${THEME.ink};border-radius:999px;padding:8px 11px;font-size:12px;font-weight:800;cursor:pointer}
.pl-montadores button.active{background:${THEME.ink};border-color:${THEME.ink};color:#fff}
.pl-modal-foot{display:flex;justify-content:flex-end;gap:10px;padding:16px 24px;border-top:1px solid ${THEME.border};background:#FFFEFC}
.pl-modal-foot button{border:1px solid ${THEME.border};background:#fff;color:${THEME.muted};border-radius:10px;padding:10px 15px;font-size:13px;font-weight:800;cursor:pointer}
.pl-modal-foot button.primary{background:${THEME.gold};border-color:${THEME.gold};color:#fff}
@media (max-width:1100px){.pl-kpis{grid-template-columns:repeat(3,1fr)}.pl-attention-list{grid-template-columns:1fr 1fr}.pl-filters{grid-template-columns:repeat(2,1fr)}.pl-calendar{grid-template-columns:repeat(2,1fr)}.pl-weekdays{display:none}.pl-day{min-height:auto}.pl-day.outside{display:none}.pl-form-grid{grid-template-columns:1fr 1fr}}
@media (max-width:760px){.pl-page{padding:18px 14px 34px}.pl-header{display:block}.pl-header h1{font-size:31px}.pl-month-nav{justify-content:flex-start;margin-top:14px}.pl-month-nav strong{text-align:left;min-width:140px}.pl-kpis{display:flex;overflow-x:auto;padding-bottom:6px}.pl-kpi{min-width:172px}.pl-attention{padding:15px 13px;border-radius:15px}.pl-attention-list{grid-template-columns:1fr}.pl-card{padding:15px 13px;border-radius:15px}.pl-calendar{grid-template-columns:1fr}.pl-day{min-height:108px}.pl-filters{grid-template-columns:1fr}.pl-gantt-head,.pl-gantt-row{grid-template-columns:190px repeat(var(--cols),100px)}.pl-modal-bg{align-items:flex-end;padding:8px}.pl-modal{max-height:94vh;border-radius:18px 18px 0 0}.pl-modal-head{padding:20px 18px 0}.pl-modal-body{padding:18px}.pl-modal-foot{padding:14px 18px}.pl-form-grid{grid-template-columns:1fr}}
`
