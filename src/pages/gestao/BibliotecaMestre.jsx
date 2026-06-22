import { useEffect, useMemo, useRef, useState } from 'react'
import { KpiCard as DesignKpiCard, StatusBadge } from '../../components/DesignSystem'
import { AMBIENTES_CHECKLIST_ORNARE, CRITICIDADES_CHECKLIST_ORNARE, FASES_CHECKLIST_ORNARE, MODELOS_CAMPO_ORNARE, RESPONSAVEIS_CHECKLIST_ORNARE } from '../../constants/checklistOrnare'
import { supabase } from '../../lib/supabase'

const THEME = {
  bg: '#F6F3EE',
  card: '#FFFFFF',
  border: '#E7E0D5',
  ink: '#1D1C19',
  muted: '#6D675E',
  gold: '#B8965E',
  danger: '#B84040',
}

const FASES = FASES_CHECKLIST_ORNARE
const AMBIENTES = AMBIENTES_CHECKLIST_ORNARE
const CRITICIDADES = CRITICIDADES_CHECKLIST_ORNARE
const RESPONSAVEIS = RESPONSAVEIS_CHECKLIST_ORNARE
const CRITICIDADE_LABEL = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' }
const RESPONSAVEL_LABEL = { gestao: 'Gestão', pos_venda: 'Pós-venda', supervisor: 'Supervisor', montador: 'Montador' }

function normalizar(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function labelCriticidade(valor) {
  return CRITICIDADE_LABEL[normalizar(valor)] || valor || 'Média'
}

function labelResponsavel(valor) {
  return RESPONSAVEL_LABEL[normalizar(valor)] || valor || ''
}

function descricaoComAcentos(texto) {
  const bruto = String(texto || '')
  const mapa = {
    'Foto antes da obra - ambiente completo': 'Foto antes da obra - ambiente completo',
    'Isolamento de piso': 'Isolamento de piso',
    'Isolamento de portas': 'Isolamento de portas',
    'Identificacao dos ambientes': 'Identificação dos ambientes',
    'Conferencia das pecas recebidas': 'Conferência das peças recebidas',
    'Conferencia de avarias': 'Conferência de avarias',
    'Protecao de piso instalada': 'Proteção de piso instalada',
    'Cantoneiras de protecao instaladas': 'Cantoneiras de proteção instaladas',
    'Ambiente limpo e desimpedido': 'Ambiente limpo e desimpedido',
    'Fotos de vistoria por ambiente': 'Fotos de vistoria por ambiente',
    'Pendencias registradas': 'Pendências registradas',
  }
  return mapa[bruto] || bruto
}

function valorAmbiente(item) {
  return item.ambiente || item.categoria_ambiente || item.categoria || 'Geral'
}

function valorAtivo(item) {
  return item.ativo !== false
}

function novoForm() {
  return {
    descricao: '',
    fase: FASES[1],
    ambiente: 'Geral',
    ordem: '',
    criticidade: 'media',
    responsavel: 'montador',
    obrigatorio: true,
    ativo: true,
  }
}

function montarRow(form) {
  return {
    descricao: form.descricao.trim(),
    fase: form.fase || null,
    categoria_ambiente: form.ambiente || 'Geral',
    ordem: form.ordem ? Number(form.ordem) : null,
    criticidade: form.criticidade || null,
    perfil_responsavel: form.responsavel || null,
    obrigatorio: form.obrigatorio,
    ativo: form.ativo,
    gera_automaticamente: true,
  }
}

function montarRowImportacao(modelo) {
  return {
    descricao: modelo.descricao,
    fase: modelo.fase,
    categoria_ambiente: modelo.ambiente || 'Geral',
    ordem: modelo.ordem,
    criticidade: modelo.criticidade || 'media',
    perfil_responsavel: modelo.responsavel || 'montador',
    obrigatorio: true,
    ativo: true,
    gera_automaticamente: true,
    exige_foto: Boolean(modelo.exige_foto),
    exige_observacao: Boolean(modelo.exige_observacao),
    exige_validacao_supervisor: modelo.responsavel === 'montador',
    visivel_cliente: false,
  }
}

function montarRowImportacaoBasico(modelo) {
  return {
    descricao: modelo.descricao,
    ordem: modelo.ordem,
  }
}

function montarRowBasico(form) {
  return {
    descricao: form.descricao.trim(),
    ordem: form.ordem ? Number(form.ordem) : null,
  }
}

function mensagemErroBiblioteca(error) {
  const msg = error?.message || ''
  if (msg.includes("Could not find the 'fase' column") || msg.includes("Could not find the 'categoria_ambiente' column")) {
    return 'A Biblioteca Mestre precisa da atualização de schema no Supabase para usar fase e ambiente. Enquanto isso, os modelos serão importados com descrição e ordem.'
  }
  return msg || 'Não foi possível concluir a operação.'
}

export default function BibliotecaMestre() {
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [toast, setToast] = useState('')
  const [filtros, setFiltros] = useState({ fase: '', ambiente: '', status: '' })
  const [form, setForm] = useState(novoForm)
  const autoImportouRef = useRef(false)

  async function carregar({ tentarAutoImportar = true } = {}) {
    setLoading(true)
    setErro('')
    const { data, error } = await supabase
      .from('checklist_padrao')
      .select('*')
      .order('ordem', { ascending: true })

    if (error) {
      setErro(error.message)
      setItens([])
      setLoading(false)
      return
    }

    if (tentarAutoImportar && !autoImportouRef.current && (!data || data.length === 0)) {
      autoImportouRef.current = true
      await importarModelosCampo(data || [], true)
      return
    }

    setItens(data || [])
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { carregar() }, [])

  const vm = useMemo(() => {
    const temFaseNosItens = itens.some(item => item.fase)
    const temAmbienteNosItens = itens.some(item => valorAmbiente(item))
    const filtrados = itens.filter(item => {
      const porFase = !filtros.fase || !temFaseNosItens || item.fase === filtros.fase
      const porAmbiente = !filtros.ambiente || !temAmbienteNosItens || valorAmbiente(item) === filtros.ambiente
      const porStatus = !filtros.status || (filtros.status === 'ativo' ? valorAtivo(item) : !valorAtivo(item))
      return porFase && porAmbiente && porStatus
    })

    return {
      filtrados,
      ambientes: [...new Set(itens.map(valorAmbiente).filter(Boolean))].sort(),
      kpis: {
        total: itens.length,
        ambientes: new Set(itens.map(valorAmbiente).filter(Boolean)).size,
        ativos: itens.filter(valorAtivo).length,
        criticos: itens.filter(i => ['alta', 'critica'].includes(normalizar(i.criticidade))).length,
      },
    }
  }, [itens, filtros])

  function setCampo(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  function mostrarToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3200)
  }

  async function salvarModelo() {
    if (!form.descricao.trim()) return
    setSalvando(true)
    setErro('')

    const { error } = await supabase.from('checklist_padrao').insert([montarRow(form)])

    if (error) {
      const { error: fallbackError } = await supabase.from('checklist_padrao').insert([montarRowBasico(form)])
      if (fallbackError) setErro(mensagemErroBiblioteca(fallbackError))
      else {
        setForm(novoForm())
        mostrarToast('Modelo criado com os campos compatíveis do banco atual.')
        await carregar({ tentarAutoImportar: false })
      }
    } else {
      setForm(novoForm())
      mostrarToast('Modelo adicionado à Biblioteca Mestre.')
      await carregar({ tentarAutoImportar: false })
    }

    setSalvando(false)
  }

  async function importarModelosCampo(baseItens = itens, automatico = false) {
    setSalvando(true)
    setErro('')

    const existentes = new Set(baseItens.map(item => normalizar(`${item.descricao}|${item.fase || ''}|${valorAmbiente(item)}`)))
    const novos = MODELOS_CAMPO_ORNARE.filter(modelo => !existentes.has(normalizar(`${modelo.descricao}|${modelo.fase}|${modelo.ambiente || 'Geral'}`)))

    if (novos.length === 0) {
      if (!automatico) mostrarToast('Biblioteca de campo já está importada.')
      setSalvando(false)
      setLoading(false)
      return
    }

    const { error } = await supabase.from('checklist_padrao').insert(novos.map(montarRowImportacao))

    if (error) {
      const { error: fallbackError } = await supabase.from('checklist_padrao').insert(novos.map(montarRowImportacaoBasico))
      if (fallbackError) {
        setErro(mensagemErroBiblioteca(fallbackError))
        setLoading(false)
      } else {
        mostrarToast(automatico ? 'Biblioteca Mestre inicializada com modelos compatíveis.' : `${novos.length} modelos de campo importados com campos compatíveis.`)
        await carregar({ tentarAutoImportar: false })
      }
    } else {
      mostrarToast(automatico ? 'Biblioteca Mestre inicializada com checklist operacional Ornare.' : `${novos.length} modelos de campo importados.`)
      await carregar({ tentarAutoImportar: false })
    }

    setSalvando(false)
  }

  async function alternarAtivo(item) {
    if (!('ativo' in item)) {
      setErro('A coluna ativo não está disponível no checklist_padrao atual.')
      return
    }

    const { error } = await supabase
      .from('checklist_padrao')
      .update({ ativo: !valorAtivo(item) })
      .eq('id', item.id)

    if (error) setErro(error.message)
    else {
      mostrarToast('Status do modelo atualizado.')
      await carregar({ tentarAutoImportar: false })
    }
  }

  return (
    <div className="bm-page">
      <style>{css}</style>
      {toast && <div className="bm-toast">{toast}</div>}

      <header className="bm-header">
        <div>
          <span>Biblioteca Mestre Ornare</span>
          <h1>Modelos de checklist operacional</h1>
          <p>Itens padrão por fase, ambiente e responsável para gerar checklists de obra sem retrabalho manual.</p>
        </div>
        <button className="bm-import" onClick={() => importarModelosCampo()} disabled={salvando}>
          {salvando ? 'Importando...' : 'Importar checklist de campo'}
        </button>
      </header>

      {erro && <div className="bm-alert">{erro}</div>}

      <section className="bm-kpis">
        <Kpi label="Total de modelos" value={vm.kpis.total} />
        <Kpi label="Ambientes" value={vm.kpis.ambientes} />
        <Kpi label="Itens ativos" value={vm.kpis.ativos} />
        <Kpi label="Itens críticos" value={vm.kpis.criticos} danger />
      </section>

      <section className="bm-layout">
        <div className="bm-card bm-form">
          <div className="bm-card-head">
            <h2>Novo modelo</h2>
            <span>Biblioteca v1</span>
          </div>
          <label className="bm-full">
            <span>Descrição</span>
            <textarea rows={4} value={form.descricao} onChange={e => setCampo('descricao', e.target.value)} placeholder="Ex: Conferir nivelamento e fixação dos módulos do ambiente." />
          </label>
          <div className="bm-form-grid">
            <label>
              <span>Fase</span>
              <select value={form.fase} onChange={e => setCampo('fase', e.target.value)}>
                {FASES.map(fase => <option key={fase} value={fase}>{fase}</option>)}
              </select>
            </label>
            <label>
              <span>Ambiente</span>
              <select value={form.ambiente} onChange={e => setCampo('ambiente', e.target.value)}>
                {AMBIENTES.map(ambiente => <option key={ambiente} value={ambiente}>{ambiente}</option>)}
              </select>
            </label>
            <label>
              <span>Ordem</span>
              <input type="number" value={form.ordem} onChange={e => setCampo('ordem', e.target.value)} placeholder="10" />
            </label>
            <label>
              <span>Criticidade</span>
              <select value={form.criticidade} onChange={e => setCampo('criticidade', e.target.value)}>
                {CRITICIDADES.map(c => <option key={c} value={c}>{labelCriticidade(c)}</option>)}
              </select>
            </label>
            <label>
              <span>Responsável</span>
              <select value={form.responsavel} onChange={e => setCampo('responsavel', e.target.value)}>
                {RESPONSAVEIS.map(r => <option key={r} value={r}>{labelResponsavel(r)}</option>)}
              </select>
            </label>
          </div>
          <div className="bm-switches">
            <label><input type="checkbox" checked={form.obrigatorio} onChange={e => setCampo('obrigatorio', e.target.checked)} /> Obrigatório</label>
            <label><input type="checkbox" checked={form.ativo} onChange={e => setCampo('ativo', e.target.checked)} /> Ativo</label>
          </div>
          <button className="bm-primary" onClick={salvarModelo} disabled={salvando || !form.descricao.trim()}>
            {salvando ? 'Salvando...' : 'Adicionar modelo'}
          </button>
        </div>

        <div className="bm-card">
          <div className="bm-card-head">
            <h2>Biblioteca atual</h2>
            <span>{vm.filtrados.length} itens</span>
          </div>
          <div className="bm-filters">
            <select value={filtros.fase} onChange={e => setFiltros(p => ({ ...p, fase: e.target.value }))}>
              <option value="">Todas as fases</option>
              {FASES.map(fase => <option key={fase} value={fase}>{fase}</option>)}
            </select>
            <select value={filtros.ambiente} onChange={e => setFiltros(p => ({ ...p, ambiente: e.target.value }))}>
              <option value="">Todos os ambientes</option>
              {[...new Set([...AMBIENTES, ...vm.ambientes])].map(ambiente => <option key={ambiente} value={ambiente}>{ambiente}</option>)}
            </select>
            <select value={filtros.status} onChange={e => setFiltros(p => ({ ...p, status: e.target.value }))}>
              <option value="">Todos os status</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
          </div>

          {loading ? (
            <div className="bm-empty">Carregando biblioteca...</div>
          ) : vm.filtrados.length === 0 ? (
            <div className="bm-empty">Nenhum modelo encontrado.</div>
          ) : (
            <div className="bm-list">
              {vm.filtrados.map(item => (
                <article key={item.id} className="bm-item">
                  <div>
                    <div className="bm-item-top">
                      <Badge>{item.fase || 'Sem fase'}</Badge>
                      <Badge muted>{valorAmbiente(item)}</Badge>
                      {item.criticidade && <Badge danger={['alta', 'critica'].includes(normalizar(item.criticidade))}>{labelCriticidade(item.criticidade)}</Badge>}
                    </div>
                    <strong>{descricaoComAcentos(item.descricao)}</strong>
                    <small>
                      Ordem {item.ordem || '-'}{labelResponsavel(item.perfil_responsavel || item.responsavel) ? ` - Responsável: ${labelResponsavel(item.perfil_responsavel || item.responsavel)}` : ''} - {valorAtivo(item) ? 'Ativo' : 'Inativo'}
                    </small>
                  </div>
                  <button onClick={() => alternarAtivo(item)}>{valorAtivo(item) ? 'Desativar' : 'Ativar'}</button>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function Kpi({ label, value, danger }) {
  return <DesignKpiCard label={label} value={value} danger={danger} />
}

function Badge({ children, muted, danger }) {
  return <StatusBadge tone={danger ? 'danger' : muted ? 'info' : 'gold'}>{children}</StatusBadge>
}

const css = `
.bm-page{min-height:100vh;background:${THEME.bg};padding:32px 40px 56px;box-sizing:border-box;color:${THEME.ink}}
.bm-header,.bm-kpis,.bm-layout,.bm-alert{max-width:1480px;margin-left:auto;margin-right:auto}
.bm-header{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:18px}
.bm-header span{display:block;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${THEME.gold};font-weight:900;margin-bottom:8px}
.bm-header h1{font-family:var(--font-serif);font-size:42px;line-height:1.05;font-weight:500;margin:0;color:${THEME.ink}}
.bm-header p{font-size:14px;color:${THEME.muted};margin:10px 0 0;max-width:760px;line-height:1.55}
.bm-import{border:0;background:${THEME.ink};color:#fff;border-radius:12px;padding:12px 18px;font-family:inherit;font-size:13px;font-weight:900;cursor:pointer;white-space:nowrap}
.bm-import:disabled{opacity:.55;cursor:not-allowed}
.bm-alert{border:1px solid #F0C8C8;background:#FFF7F7;color:${THEME.danger};border-radius:12px;padding:11px 14px;font-size:13px;font-weight:700;margin-bottom:14px}
.bm-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:1200;background:${THEME.ink};color:#fff;border-left:3px solid ${THEME.gold};border-radius:13px;padding:12px 18px;font-size:13px;font-weight:800;box-shadow:0 14px 34px rgba(29,28,25,.18)}
.bm-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}
.bm-layout{display:grid;grid-template-columns:minmax(320px,.46fr) minmax(0,1fr);gap:16px;align-items:start}
.bm-card{background:#fff;border:1px solid ${THEME.border};border-radius:18px;padding:18px 20px;box-shadow:0 14px 34px rgba(29,28,25,.05);box-sizing:border-box}
.bm-card-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:15px}
.bm-card-head h2{font-size:15px;margin:0;font-weight:900;color:${THEME.ink}}
.bm-card-head span{font-size:11px;color:${THEME.muted};font-weight:800}
.bm-form{position:sticky;top:20px}
.bm-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.bm-form label{display:flex;flex-direction:column;gap:6px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${THEME.muted};font-weight:900}
.bm-form label.bm-full{margin-bottom:11px}
.bm-form input,.bm-form select,.bm-form textarea,.bm-filters select{width:100%;box-sizing:border-box;border:1px solid ${THEME.border};background:#FFFEFC;border-radius:10px;padding:10px 11px;font-family:inherit;font-size:13px;color:${THEME.ink};outline:none}
.bm-form textarea{resize:vertical;line-height:1.45;text-transform:none;letter-spacing:0}
.bm-switches{display:flex;gap:14px;flex-wrap:wrap;margin:14px 0}
.bm-switches label{flex-direction:row;align-items:center;text-transform:none;letter-spacing:0;font-size:12px;color:${THEME.ink}}
.bm-primary{width:100%;border:0;background:${THEME.ink};color:#fff;border-radius:11px;padding:12px 16px;font-size:13px;font-weight:900;cursor:pointer}
.bm-primary:disabled{opacity:.5;cursor:not-allowed}
.bm-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:14px}
.bm-list{display:grid;gap:10px}
.bm-item{border:1px solid ${THEME.border};background:#FFFEFC;border-radius:14px;padding:14px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.bm-item strong{display:block;font-size:14px;color:${THEME.ink};line-height:1.45;margin:8px 0 7px}
.bm-item small{display:block;font-size:11.5px;color:${THEME.muted}}
.bm-item button{border:1px solid ${THEME.border};background:#fff;color:${THEME.muted};border-radius:10px;padding:8px 10px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap}
.bm-item-top{display:flex;gap:6px;flex-wrap:wrap}
.bm-empty{text-align:center;padding:52px 0;color:#A79F93;font-size:13px}
@media (max-width:980px){.bm-layout{grid-template-columns:1fr}.bm-form{position:static}.bm-kpis{grid-template-columns:repeat(2,1fr)}}
@media (max-width:640px){.bm-page{padding:20px 14px 40px}.bm-header{display:block}.bm-header h1{font-size:32px}.bm-import{width:100%;margin-top:14px}.bm-kpis{display:flex;overflow-x:auto;padding-bottom:5px}.bm-kpis>*{min-width:166px}.bm-card{padding:15px 13px;border-radius:15px}.bm-form-grid,.bm-filters{grid-template-columns:1fr}.bm-item{display:block}.bm-item button{margin-top:12px;width:100%}}
`
