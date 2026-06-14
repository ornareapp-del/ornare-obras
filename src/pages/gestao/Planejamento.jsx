import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

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

const MESES = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']

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
  const [mesAtual, setMesAtual] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [visao, setVisao] = useState('calendario')
  const [filtros, setFiltros] = useState({ mes: monthKey(new Date()), supervisor: '', montador: '', status: '', cidade: '' })

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setLoading(true)
      setErro('')

      const [cronogramas, obras, profiles, montadores, agenda] = await Promise.all([
        supabase.from('obra_cronograma').select('*').order('data_inicio_prevista', { ascending: true }),
        supabase.from('obras').select('id, nome, cliente_nome, cidade, uf, status, supervisor_id, comercial_id').order('nome'),
        supabase.from('profiles').select('id, full_name, email, role'),
        supabase.from('obra_montadores').select('obra_id, montador_id'),
        supabase.from('agenda').select('id, obra_id, tipo, titulo, data, data_fim'),
      ])

      if (!ativo) return

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

    carregar()
    return () => { ativo = false }
  }, [])

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

    const mesInicio = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1)
    const mesFim = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0)
    const dias = []
    const calInicio = startOfCalendar(mesAtual)
    const calFim = endOfCalendar(mesAtual)
    for (const d = new Date(calInicio); d <= calFim; d.setDate(d.getDate() + 1)) {
      const atual = new Date(d)
      dias.push({
        data: atual,
        key: isoDate(atual),
        noMes: atual.getMonth() === mesAtual.getMonth(),
        obras: registros.filter(r => r.inicio && r.fim && atual >= r.inicio && atual <= r.fim),
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

    const ativos = registros.filter(r => !norm(r.status_operacional).includes('conclu'))
    const kpis = {
      ativas: ativos.length,
      montagem: registros.filter(r => norm(r.fase).includes('montagem') && !norm(r.fase).includes('pre')).length,
      producao: registros.filter(r => norm(r.fase).includes('producao')).length,
      travadas: registros.filter(r => r.travado).length,
      inicios: registros.filter(r => r.inicio && r.inicio >= mesInicio && r.inicio <= mesFim).length,
      entregas: registros.filter(r => r.fim && r.fim >= mesInicio && r.fim <= mesFim).length,
    }

    return {
      registros,
      dias,
      filtrados,
      mesesGantt,
      kpis,
      supervisores: dados.profiles.filter(p => ['gestao', 'supervisor'].includes(p.role)),
      montadores: dados.profiles.filter(p => p.role === 'montador'),
      cidades: [...new Set(dados.obras.map(o => o.cidade).filter(Boolean))].sort(),
      statuses: [...new Set(dados.cronogramas.map(c => c.status_operacional).filter(Boolean))].sort(),
      agendaMes: dados.agenda.filter(a => a.data && a.data.slice(0, 7) === monthKey(mesAtual)),
    }
  }, [dados, filtros, mesAtual])

  function abrirObra(id) {
    if (id) navigate(`/obras/${id}`)
  }

  return (
    <div className="pl-page">
      <style>{css}</style>

      <header className="pl-header">
        <div>
          <div className="pl-eyebrow">Ornare Works</div>
          <h1>Planejamento</h1>
          <p>Central de Planejamento Operacional da Ornare</p>
        </div>
        <div className="pl-month-nav">
          <button onClick={() => setMesAtual(m => addMonths(m, -1))}>Anterior</button>
          <strong>{MESES[mesAtual.getMonth()]} {mesAtual.getFullYear()}</strong>
          <button onClick={() => setMesAtual(m => addMonths(m, 1))}>Proximo</button>
        </div>
      </header>

      {erro && <div className="pl-alert">Alguns dados nao foram carregados: {erro}</div>}

      <section className="pl-kpis">
        <Kpi label="Obras Ativas" value={vm.kpis.ativas} />
        <Kpi label="Em Montagem" value={vm.kpis.montagem} />
        <Kpi label="Em Producao" value={vm.kpis.producao} />
        <Kpi label="Travadas" value={vm.kpis.travadas} danger />
        <Kpi label="Inicios no Mes" value={vm.kpis.inicios} />
        <Kpi label="Entregas no Mes" value={vm.kpis.entregas} />
      </section>

      <nav className="pl-tabs">
        {[
          ['calendario', 'Calendario Mensal'],
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
          {visao === 'calendario' && <Calendario dias={vm.dias} mesAtual={mesAtual} abrirObra={abrirObra} />}
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
  return (
    <div className={danger ? 'pl-kpi danger' : 'pl-kpi'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Calendario({ dias, mesAtual, abrirObra }) {
  return (
    <section className="pl-card">
      <div className="pl-card-head">
        <h2>Calendario mensal</h2>
        <span>{MESES[mesAtual.getMonth()]} {mesAtual.getFullYear()}</span>
      </div>
      <div className="pl-weekdays">
        {DIAS.map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="pl-calendar">
        {dias.map(dia => (
          <div key={dia.key} className={dia.noMes ? 'pl-day' : 'pl-day outside'}>
            <div className="pl-day-num">{dia.data.getDate()}</div>
            <div className="pl-day-items">
              {dia.obras.slice(0, 4).map(item => (
                <button key={`${dia.key}-${item.id}`} onClick={() => abrirObra(item.obra_id)}>
                  <strong>{item.obra.nome || 'Obra'}</strong>
                  <span>{nomePessoa(item.supervisor)}</span>
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
  return <span className="pl-badge" style={{ color, background: `${color}18` }}>{children}</span>
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
.pl-kpis{max-width:1480px;margin:0 auto 16px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}
.pl-kpi{background:#fff;border:1px solid ${THEME.border};border-top:3px solid ${THEME.gold};border-radius:14px;padding:15px 16px}
.pl-kpi.danger{border-top-color:${THEME.danger}}
.pl-kpi span{display:block;font-size:10px;letter-spacing:1.7px;text-transform:uppercase;color:${THEME.gold};font-weight:800;margin-bottom:9px;white-space:nowrap}
.pl-kpi.danger span{color:${THEME.danger}}
.pl-kpi strong{display:block;font-size:32px;line-height:1;color:${THEME.ink}}
.pl-tabs{max-width:1480px;margin:0 auto 16px;display:flex;gap:8px;overflow-x:auto;padding-bottom:2px}
.pl-tabs button.active{background:${THEME.ink};border-color:${THEME.ink};color:#fff}
.pl-card{max-width:1480px;margin:0 auto;background:#fff;border:1px solid ${THEME.border};border-radius:18px;padding:18px 20px;box-shadow:0 14px 34px rgba(29,28,25,.05);box-sizing:border-box}
.pl-card-head{display:flex;justify-content:space-between;gap:14px;align-items:center;margin-bottom:15px}
.pl-card-head h2{font-size:15px;margin:0;font-weight:900;color:${THEME.ink}}
.pl-card-head span{font-size:12px;color:${THEME.gold};font-weight:900}
.pl-weekdays{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:8px}
.pl-weekdays div{font-size:11px;color:${THEME.muted};font-weight:900;text-align:center}
.pl-calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
.pl-day{min-height:132px;border:1px solid ${THEME.border};background:#FFFEFC;border-radius:13px;padding:9px;min-width:0}
.pl-day.outside{opacity:.45;background:#F9F6F0}
.pl-day-num{font-size:12px;font-weight:900;color:${THEME.gold};margin-bottom:7px}
.pl-day-items{display:flex;flex-direction:column;gap:6px}
.pl-day-items button{border:0;background:#F6F1E8;border-left:3px solid ${THEME.gold};border-radius:9px;padding:7px 8px;text-align:left;cursor:pointer;font-family:inherit;min-width:0}
.pl-day-items strong{display:block;font-size:11.5px;color:${THEME.ink};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pl-day-items span,.pl-day-items small{display:block;font-size:10.5px;color:${THEME.muted};margin-top:2px}
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
@media (max-width:1100px){.pl-kpis{grid-template-columns:repeat(3,1fr)}.pl-filters{grid-template-columns:repeat(2,1fr)}.pl-calendar{grid-template-columns:repeat(2,1fr)}.pl-weekdays{display:none}.pl-day{min-height:auto}.pl-day.outside{display:none}}
@media (max-width:760px){.pl-page{padding:18px 14px 34px}.pl-header{display:block}.pl-header h1{font-size:31px}.pl-month-nav{justify-content:flex-start;margin-top:14px}.pl-month-nav strong{text-align:left;min-width:140px}.pl-kpis{display:flex;overflow-x:auto;padding-bottom:6px}.pl-kpi{min-width:150px}.pl-card{padding:15px 13px;border-radius:15px}.pl-calendar{grid-template-columns:1fr}.pl-filters{grid-template-columns:1fr}.pl-gantt-head,.pl-gantt-row{grid-template-columns:190px repeat(var(--cols),100px)}}
`
