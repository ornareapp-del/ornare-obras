import { supabase } from '../lib/supabase'
import { resolverOperacaoObra } from '../utils/obraOperacional'

const THEME = {
  ink: '#1D1C19',
  muted: '#6D675E',
  gold: '#B8965E',
  border: '#E7E0D5',
  soft: '#F6F3EE',
  danger: '#B84040',
}

const RELATORIOS = {
  executivo: 'Relatório Executivo',
  operacional: 'Relatório Operacional',
  cliente: 'Relatório do Cliente',
}

RELATORIOS.financeiro = 'Relatorio Financeiro Interno'

const TIPOS_RELATORIO = Object.keys(RELATORIOS)

function safeArray(result) {
  return result?.data || []
}

function erroMensagem(error) {
  return error?.message || error?.details || 'Nao foi possivel gerar o PDF.'
}

function dinheiro(value) {
  const n = Number(value || 0)
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function numero(value) {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function dataBR(value) {
  if (!value) return '-'
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR')
}

function nomePessoa(profile) {
  return profile?.full_name || profile?.email || '-'
}

function normalizar(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function operacaoObra(ctx) {
  return resolverOperacaoObra(ctx?.obra || {}, ctx?.cronograma || {})
}

function faseGestao(ctx) {
  return operacaoObra(ctx).faseLabel
}

function faseCliente(ctx) {
  return operacaoObra(ctx).faseCliente
}

function statusGasto(gasto) {
  const status = normalizar(gasto?.status || 'aprovado').trim()
  if (status === 'pendente') return 'pendente_aprovacao'
  if (['aprovado', 'pendente_aprovacao', 'recusado'].includes(status)) return status
  return 'aprovado'
}

function gastoRealizado(gasto) {
  return statusGasto(gasto) === 'aprovado'
}

function labelStatusGasto(gasto) {
  const status = statusGasto(gasto)
  if (status === 'pendente_aprovacao') return 'Pendente'
  if (status === 'recusado') return 'Recusado'
  return 'Aprovado'
}

function valorAmbiente(item, ambientesPorId) {
  return ambientesPorId.get(item.ambiente_id)?.nome || 'Geral'
}

function isClienteVisivel(item) {
  return item?.visivel_cliente === true || item?.visibilidade === 'cliente' || item?.visibilidade === 'publica'
}

function isFotoCliente(foto) {
  const aprovada = foto?.aprovada === true && (foto?.aprovada_gestao === true || foto?.aprovada_gestao === undefined)
  return aprovada && isClienteVisivel(foto)
}

function isChecklistCliente(item) {
  return item?.concluido === true && isClienteVisivel(item)
}

function isAgendaCliente(item) {
  return !item?.reuniao_interna && isClienteVisivel(item)
}

function isOcorrenciaInterna(item) {
  const texto = normalizar([item?.tipo, item?.categoria, item?.visibilidade, item?.observacao_interna].filter(Boolean).join(' '))
  return item?.interno === true || texto.includes('intern')
}

function fotoReferencia(foto) {
  if (foto?.url) return foto.url
  if (!foto?.storage_path) return 'Imagem sem arquivo vinculado.'
  try {
    return supabase.storage.from('fotos-obras').getPublicUrl(foto.storage_path).data.publicUrl || 'Imagem indisponivel; PDF gerado sem bloquear.'
  } catch (error) {
    console.error('Erro ao resolver URL publica da foto para PDF:', error)
    return 'Imagem indisponivel; PDF gerado sem bloquear.'
  }
}

function nomeArquivo(texto) {
  return String(texto || 'ornare')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

class PdfBuilder {
  constructor(jsPDF, titulo, subtitulo) {
    this.doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    this.page = 1
    this.y = 18
    this.titulo = titulo
    this.subtitulo = subtitulo
    this.header()
  }

  header() {
    const { doc } = this
    doc.setFillColor(THEME.ink)
    doc.rect(0, 0, 210, 34, 'F')
    doc.setTextColor('#FFFFFF')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('ORNARE', 16, 15)
    doc.setFontSize(7)
    doc.setTextColor(THEME.gold)
    doc.text('WORKS', 16, 21)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor('#FFFFFF')
    doc.setFontSize(13)
    doc.text(this.titulo, 64, 15)
    doc.setFontSize(8)
    doc.setTextColor('#E8E0D5')
    doc.text(this.subtitulo || 'Gestão operacional de obras', 64, 21)
    doc.setDrawColor(THEME.gold)
    doc.setLineWidth(0.8)
    doc.line(16, 31, 194, 31)
    this.y = 44
  }

  footer() {
    const { doc } = this
    doc.setDrawColor(THEME.border)
    doc.line(16, 284, 194, 284)
    doc.setTextColor(THEME.muted)
    doc.setFontSize(7)
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 16, 290)
    doc.text(`Página ${this.page}`, 182, 290)
  }

  addPage() {
    this.footer()
    this.doc.addPage()
    this.page += 1
    this.header()
  }

  ensure(height = 18) {
    if (this.y + height > 276) this.addPage()
  }

  section(title) {
    this.ensure(18)
    this.doc.setFillColor(THEME.soft)
    this.doc.roundedRect(16, this.y, 178, 10, 2, 2, 'F')
    this.doc.setTextColor(THEME.ink)
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(10)
    this.doc.text(title, 20, this.y + 6.5)
    this.y += 16
  }

  grid(items) {
    const colW = 86
    items.forEach((item, index) => {
      const col = index % 2
      if (col === 0) this.ensure(17)
      const x = 16 + col * 92
      this.doc.setDrawColor(THEME.border)
      this.doc.roundedRect(x, this.y, colW, 13, 2, 2)
      this.doc.setTextColor(THEME.muted)
      this.doc.setFont('helvetica', 'bold')
      this.doc.setFontSize(6.5)
      this.doc.text(String(item.label || '').toUpperCase(), x + 4, this.y + 4.4)
      this.doc.setTextColor(THEME.ink)
      this.doc.setFont('helvetica', 'normal')
      this.doc.setFontSize(9)
      this.doc.text(this.fit(item.value || '-', colW - 8), x + 4, this.y + 9.5)
      if (col === 1 || index === items.length - 1) this.y += 17
    })
  }

  paragraph(text) {
    this.ensure(18)
    this.doc.setTextColor(THEME.muted)
    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(9)
    const lines = this.doc.splitTextToSize(text || '-', 178)
    lines.forEach(line => {
      this.ensure(6)
      this.doc.text(line, 16, this.y)
      this.y += 5
    })
    this.y += 3
  }

  list(items, empty = 'Nenhum registro encontrado.') {
    if (!items.length) {
      this.paragraph(empty)
      return
    }
    items.forEach(item => {
      this.ensure(14)
      this.doc.setDrawColor(THEME.border)
      this.doc.roundedRect(16, this.y, 178, 11, 2, 2)
      this.doc.setTextColor(THEME.ink)
      this.doc.setFont('helvetica', 'bold')
      this.doc.setFontSize(8.5)
      this.doc.text(this.fit(item.title || '-', 110), 20, this.y + 4.4)
      this.doc.setFont('helvetica', 'normal')
      this.doc.setTextColor(THEME.muted)
      this.doc.setFontSize(7.5)
      this.doc.text(this.fit(item.meta || '', 58), 132, this.y + 4.4)
      if (item.detail) this.doc.text(this.fit(item.detail, 154), 20, this.y + 8.3)
      this.y += 14
    })
  }

  note(text) {
    this.ensure(10)
    this.doc.setTextColor(THEME.muted)
    this.doc.setFont('helvetica', 'italic')
    this.doc.setFontSize(7.5)
    this.doc.text(this.fit(text, 178), 16, this.y)
    this.y += 7
  }

  fit(value, maxWidth) {
    const text = String(value ?? '-')
    return this.doc.splitTextToSize(text, maxWidth)[0] || '-'
  }

  save(filename) {
    this.footer()
    this.doc.save(filename)
  }
}

async function criarPdf(titulo, subtitulo) {
  try {
    const { jsPDF } = await import('jspdf')
    return new PdfBuilder(jsPDF, titulo, subtitulo)
  } catch (error) {
    throw new Error(`Nao foi possivel carregar o gerador de PDF: ${erroMensagem(error)}`, { cause: error })
  }
}

async function consultaSupabase(label, query, { obrigatoria = false, valorVazio = [] } = {}) {
  try {
    const result = await query
    if (result.error) {
      if (obrigatoria) throw result.error
      return { data: valorVazio, error: result.error, label }
    }
    return { data: result.data ?? valorVazio, error: null, label }
  } catch (error) {
    if (obrigatoria) throw error
    return { data: valorVazio, error, label }
  }
}

async function carregarDadosObra(obraId) {
  const [
    obra,
    cronograma,
    profiles,
    vinculos,
    ambientes,
    checklist,
    agenda,
    fotos,
    ocorrencias,
    gastos,
    historico,
  ] = await Promise.all([
    consultaSupabase('obra', supabase.from('obras').select('*').eq('id', obraId).single(), { obrigatoria: true, valorVazio: {} }),
    consultaSupabase('cronograma', supabase.from('obra_cronograma').select('*').eq('obra_id', obraId).maybeSingle(), { valorVazio: {} }),
    consultaSupabase('profiles', supabase.from('profiles').select('id, full_name, email, role')),
    consultaSupabase('vinculos', supabase.from('obra_montadores').select('obra_id, montador_id').eq('obra_id', obraId)),
    consultaSupabase('ambientes', supabase.from('obra_ambientes').select('id, nome').eq('obra_id', obraId)),
    consultaSupabase('checklist', supabase.from('checklist_items').select('*').eq('obra_id', obraId).order('descricao')),
    consultaSupabase('agenda', supabase.from('agenda').select('*').eq('obra_id', obraId).order('data')),
    consultaSupabase('fotos', supabase.from('fotos').select('*').eq('obra_id', obraId).order('created_at', { ascending: false })),
    consultaSupabase('ocorrencias', supabase.from('ocorrencias').select('*').eq('obra_id', obraId).order('created_at', { ascending: false })),
    consultaSupabase('gastos', supabase.from('gastos').select('*').eq('obra_id', obraId).order('created_at', { ascending: false })),
    consultaSupabase('historico', supabase.from('historico_obra').select('*').eq('obra_id', obraId).order('created_at', { ascending: false })),
  ])

  const profilesData = safeArray(profiles)
  const profilesPorId = new Map(profilesData.map(p => [p.id, p]))
  const ambientesData = safeArray(ambientes)
  const ambientesPorId = new Map(ambientesData.map(a => [a.id, a]))
  const obraData = obra.data || {}
  const cronogramaData = cronograma.data || {}
  const montadores = safeArray(vinculos).map(v => profilesPorId.get(v.montador_id)).filter(Boolean)
  const supervisor = profilesPorId.get(cronogramaData.supervisor_id || obraData.supervisor_id)
  const comercial = profilesPorId.get(cronogramaData.comercial_id || obraData.comercial_id)

  return {
    obra: obraData,
    cronograma: cronogramaData,
    profiles: profilesData,
    supervisor,
    comercial,
    montadores,
    ambientes: ambientesData,
    ambientesPorId,
    checklist: safeArray(checklist),
    agenda: safeArray(agenda),
    fotos: safeArray(fotos),
    ocorrencias: safeArray(ocorrencias),
    gastos: safeArray(gastos),
    historico: safeArray(historico),
    avisos: [cronograma, profiles, vinculos, ambientes, checklist, agenda, fotos, ocorrencias, gastos, historico]
      .filter(result => result.error)
      .map(result => `${result.label}: ${erroMensagem(result.error)}`),
  }
}

function dadosBase(ctx) {
  const { obra, cronograma, supervisor, comercial, montadores } = ctx
  return [
    { label: 'Cliente', value: obra.cliente_nome },
    { label: 'Obra', value: obra.nome },
    { label: 'Supervisor', value: nomePessoa(supervisor) },
    { label: 'Equipe', value: montadores.map(nomePessoa).join(', ') || '-' },
    { label: 'Fase', value: faseGestao(ctx) },
    { label: 'Status', value: cronograma.status_operacional || obra.status },
    { label: 'Prioridade', value: cronograma.prioridade || '-' },
    { label: 'Risco', value: cronograma.risco || '-' },
    { label: 'Percentual', value: `${cronograma.percentual_concluido ?? obra.progresso ?? 0}%` },
    { label: 'Pós-venda', value: nomePessoa(comercial) },
  ]
}

function dadosCliente(ctx) {
  const { obra, cronograma } = ctx
  return [
    { label: 'Cliente', value: obra.cliente_nome },
    { label: 'Obra', value: obra.nome },
    { label: 'Status', value: obra.status_cliente || obra.status },
    { label: 'Fase atual', value: faseCliente(ctx) },
    { label: 'Percentual', value: `${cronograma.percentual_concluido ?? obra.progresso ?? 0}%` },
    { label: 'Previsao', value: dataBR(cronograma.data_fim_prevista || obra.data_previsao) },
  ]
}

function adicionarResumoFinanceiro(pdf, gastos) {
  const realizados = gastos.filter(gastoRealizado)
  const pendentes = gastos.filter(g => statusGasto(g) === 'pendente_aprovacao')
  const recusados = gastos.filter(g => statusGasto(g) === 'recusado')
  const total = realizados.reduce((sum, g) => sum + numero(g.valor), 0)
  const totalPendente = pendentes.reduce((sum, g) => sum + numero(g.valor), 0)
  pdf.grid([
    { label: 'Gastos realizados', value: realizados.length },
    { label: 'Total operacional', value: dinheiro(total) },
    { label: 'Pendentes de aprovação', value: `${pendentes.length} (${dinheiro(totalPendente)})` },
    { label: 'Recusados', value: recusados.length },
  ])
}

function adicionarFinanceiroInterno(pdf, ctx) {
  const gastos = ctx.gastos || []
  const aprovados = gastos.filter(gastoRealizado)
  const pendentes = gastos.filter(g => statusGasto(g) === 'pendente_aprovacao')
  const recusados = gastos.filter(g => statusGasto(g) === 'recusado')
  const totalAprovado = aprovados.reduce((sum, g) => sum + numero(g.valor), 0)
  const totalPendente = pendentes.reduce((sum, g) => sum + numero(g.valor), 0)
  const meta = numero(ctx.obra.gasto_meta || ctx.cronograma.gasto_meta)
  const usoMeta = meta > 0 ? Math.round((totalAprovado / meta) * 100) : null

  pdf.grid([
    { label: 'Total aprovado', value: dinheiro(totalAprovado) },
    { label: 'Pendente aprovacao', value: dinheiro(totalPendente) },
    { label: 'Lancamentos', value: gastos.length },
    { label: 'Uso da meta', value: usoMeta === null ? 'Meta nao cadastrada' : `${usoMeta}%` },
  ])

  pdf.section('Resumo por status')
  pdf.list([
    { title: 'Aprovados', meta: `${aprovados.length} lancamento${aprovados.length === 1 ? '' : 's'}`, detail: dinheiro(totalAprovado) },
    { title: 'Pendentes', meta: `${pendentes.length} lancamento${pendentes.length === 1 ? '' : 's'}`, detail: dinheiro(totalPendente) },
    { title: 'Recusados', meta: `${recusados.length} lancamento${recusados.length === 1 ? '' : 's'}`, detail: dinheiro(recusados.reduce((sum, g) => sum + numero(g.valor), 0)) },
  ])

  const porCategoria = gastos.reduce((acc, gasto) => {
    const categoria = gasto.categoria || gasto.tipo || 'Sem categoria'
    const atual = acc.get(categoria) || { total: 0, count: 0 }
    acc.set(categoria, { total: atual.total + numero(gasto.valor), count: atual.count + 1 })
    return acc
  }, new Map())

  pdf.section('Categorias')
  pdf.list([...porCategoria.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([categoria, resumo]) => ({
      title: categoria,
      meta: `${resumo.count} lancamento${resumo.count === 1 ? '' : 's'}`,
      detail: dinheiro(resumo.total),
    })), 'Nenhum gasto categorizado.')

  pdf.section('Lancamentos internos')
  pdf.list(gastos.slice(0, 40).map(g => ({
    title: g.descricao || g.categoria || 'Gasto',
    meta: `${labelStatusGasto(g)} - ${dataBR(g.data || g.created_at)}`,
    detail: [dinheiro(g.valor), g.observacao, g.comprovante_url || g.comprovante_path ? 'com comprovante' : 'sem comprovante'].filter(Boolean).join(' - '),
  })), 'Nenhum gasto registrado.')
}

function adicionarChecklistPorAmbiente(pdf, ctx) {
  const grupos = new Map()
  ctx.checklist.forEach(item => {
    const ambiente = valorAmbiente(item, ctx.ambientesPorId)
    const lista = grupos.get(ambiente) || []
    lista.push(item)
    grupos.set(ambiente, lista)
  })

  if (!grupos.size) {
    pdf.paragraph('Nenhum item de checklist registrado.')
    return
  }

  Array.from(grupos.entries()).forEach(([ambiente, itens]) => {
    const concluidos = itens.filter(i => i.concluido).length
    pdf.list([{
      title: ambiente,
      meta: `${concluidos}/${itens.length} concluídos`,
      detail: itens.slice(0, 5).map(i => `${i.concluido ? 'OK' : 'Pendente'} - ${i.descricao}`).join(' | '),
    }])
  })
}

export async function exportarRelatorioObra(obraId, tipo = 'executivo') {
  if (!obraId) throw new Error('Obra nao informada para gerar o PDF.')
  const tipoRelatorio = TIPOS_RELATORIO.includes(tipo) ? tipo : 'executivo'

  try {
    const ctx = await carregarDadosObra(obraId)
    const titulo = RELATORIOS[tipoRelatorio]
    const pdf = await criarPdf(titulo, ctx.obra.nome || 'Obra Ornare')

    pdf.section('Identificacao')
    pdf.grid(tipoRelatorio === 'cliente' ? dadosCliente(ctx) : dadosBase(ctx))

    if (ctx.avisos.length && tipoRelatorio !== 'cliente') {
      pdf.note('Alguns dados auxiliares nao foram carregados; o relatorio foi gerado com as informacoes disponiveis.')
    }

    if (tipoRelatorio === 'executivo') {
      pdf.section('Resumo da obra')
      pdf.paragraph(ctx.obra.observacoes || ctx.cronograma.observacao || 'Resumo operacional nao informado.')

      pdf.section('Progresso e riscos')
      pdf.grid([
        { label: 'Progresso', value: `${ctx.cronograma.percentual_concluido ?? ctx.obra.progresso ?? 0}%` },
        { label: 'Status', value: ctx.cronograma.status_operacional || ctx.obra.status },
        { label: 'Risco', value: ctx.cronograma.risco || '-' },
        { label: 'Prioridade', value: ctx.cronograma.prioridade || '-' },
      ])

      pdf.section('Prazos')
      pdf.grid([
        { label: 'Inicio previsto', value: dataBR(ctx.cronograma.data_inicio_prevista || ctx.obra.data_inicio) },
        { label: 'Fim previsto', value: dataBR(ctx.cronograma.data_fim_prevista || ctx.obra.data_previsao) },
        { label: 'Travado', value: ctx.cronograma.travado ? 'Sim' : 'Nao' },
        { label: 'Acao recomendada', value: ctx.cronograma.acao_recomendada || '-' },
      ])
      if (ctx.cronograma.motivo_trava) pdf.paragraph(`Motivo da trava: ${ctx.cronograma.motivo_trava}`)

      pdf.section('Ocorrencias relevantes')
      pdf.list(ctx.ocorrencias.filter(o => !isOcorrenciaInterna(o)).slice(0, 10).map(o => ({
        title: o.titulo || o.categoria || 'Ocorrencia',
        meta: o.status || o.gravidade || dataBR(o.created_at),
        detail: o.descricao || o.observacao || '',
      })))

      pdf.section('Financeiro')
      adicionarResumoFinanceiro(pdf, ctx.gastos)
    }

    if (tipoRelatorio === 'operacional') {
      pdf.section('Status da obra')
      pdf.grid([
        { label: 'Status', value: ctx.cronograma.status_operacional || ctx.obra.status },
        { label: 'Fase atual', value: faseGestao(ctx) },
        { label: 'Progresso', value: `${ctx.cronograma.percentual_concluido ?? ctx.obra.progresso ?? 0}%` },
        { label: 'Risco', value: ctx.cronograma.risco || '-' },
      ])

      pdf.section('Equipe e montadores')
      pdf.list(ctx.montadores.map(m => ({
        title: nomePessoa(m),
        meta: m.role || 'montador',
        detail: m.email || '',
      })), 'Nenhum montador vinculado.')

      pdf.section('Cronograma')
      pdf.grid([
        { label: 'Inicio previsto', value: dataBR(ctx.cronograma.data_inicio_prevista || ctx.obra.data_inicio) },
        { label: 'Fim previsto', value: dataBR(ctx.cronograma.data_fim_prevista || ctx.obra.data_previsao) },
        { label: 'Acao recomendada', value: ctx.cronograma.acao_recomendada || '-' },
        { label: 'Travado', value: ctx.cronograma.travado ? 'Sim' : 'Nao' },
      ])

      pdf.section('Checklist por ambiente')
      adicionarChecklistPorAmbiente(pdf, ctx)

      pdf.section('Agenda')
      pdf.list(ctx.agenda.map(a => ({ title: a.titulo || a.tipo || 'Compromisso', meta: dataBR(a.data), detail: a.observacao || '' })))

      pdf.section('Fotos e evidencias')
      pdf.list(ctx.fotos.slice(0, 12).map(f => ({
        title: f.categoria || f.etapa || 'Foto',
        meta: dataBR(f.created_at),
        detail: [f.observacao, f.aprovada_gestao || f.aprovada ? 'aprovada' : 'aguardando aprovacao', fotoReferencia(f)].filter(Boolean).join(' - '),
      })), 'Nenhuma foto registrada.')

      pdf.section('Ocorrencias e historico')
      pdf.list(ctx.ocorrencias.map(o => ({ title: o.titulo || 'Ocorrencia', meta: o.status || o.gravidade || '-', detail: o.descricao || '' })))
      pdf.list(ctx.historico.slice(0, 8).map(h => ({ title: h.titulo || h.acao || 'Historico', meta: dataBR(h.created_at), detail: h.descricao || h.observacao || '' })), 'Nenhum historico registrado.')

      pdf.section('Gastos')
      adicionarResumoFinanceiro(pdf, ctx.gastos)
    }

    if (tipoRelatorio === 'cliente') {
      pdf.section('Andamento da obra')
      pdf.grid([
        { label: 'Status', value: ctx.obra.status_cliente || ctx.obra.status },
        { label: 'Fase atual', value: faseCliente(ctx) },
        { label: 'Percentual', value: `${ctx.cronograma.percentual_concluido ?? ctx.obra.progresso ?? 0}%` },
        { label: 'Previsao', value: dataBR(ctx.cronograma.data_fim_prevista || ctx.obra.data_previsao) },
      ])

      pdf.section('Proximas etapas')
      pdf.paragraph(ctx.cronograma.acao_cliente || ctx.obra.mensagem_cliente || 'A equipe Ornare seguira acompanhando as proximas etapas da obra.')

      pdf.section('Agenda liberada')
      pdf.list(ctx.agenda.filter(isAgendaCliente).map(a => ({
        title: a.titulo || a.tipo || 'Compromisso',
        meta: dataBR(a.data),
        detail: a.observacao_publica || a.descricao_cliente || '',
      })), 'Nenhum compromisso liberado ao cliente.')

      pdf.section('Checklist liberado')
      pdf.list(ctx.checklist.filter(isChecklistCliente).map(item => ({
        title: item.descricao || item.titulo || 'Item de checklist',
        meta: valorAmbiente(item, ctx.ambientesPorId),
        detail: item.observacao_cliente || 'Concluido e liberado ao cliente.',
      })), 'Nenhum checklist liberado ao cliente.')

      pdf.section('Fotos aprovadas')
      pdf.list(ctx.fotos.filter(isFotoCliente).slice(0, 12).map(f => ({
        title: f.categoria || f.etapa || 'Foto',
        meta: dataBR(f.created_at),
        detail: [f.observacao_cliente || '', fotoReferencia(f)].filter(Boolean).join(' - '),
      })), 'Nenhuma foto aprovada para o cliente.')
    }

    if (tipoRelatorio === 'financeiro') {
      pdf.section('Resumo financeiro interno')
      adicionarFinanceiroInterno(pdf, ctx)

      pdf.section('Pendencias financeiras')
      pdf.list(ctx.gastos.filter(g => statusGasto(g) === 'pendente_aprovacao').slice(0, 15).map(g => ({
        title: g.descricao || g.categoria || 'Gasto pendente',
        meta: dinheiro(g.valor),
        detail: [dataBR(g.data || g.created_at), g.observacao].filter(Boolean).join(' - '),
      })), 'Nenhum gasto pendente de aprovacao.')
    }

    const filename = `${nomeArquivo(titulo)}-${nomeArquivo(ctx.obra.nome)}.pdf`
    pdf.save(filename)
    return { filename, tipo: tipoRelatorio, titulo, avisos: ctx.avisos }
  } catch (error) {
    throw new Error(`Nao foi possivel gerar o PDF. ${erroMensagem(error)}`, { cause: error })
  }
}

// eslint-disable-next-line no-unused-vars
async function exportarRelatorioObraLegado(obraId, tipo = 'executivo') {
  const ctx = await carregarDadosObra(obraId)
  const titulo = RELATORIOS[tipo] || RELATORIOS.executivo
  const pdf = await criarPdf(titulo, ctx.obra.nome || 'Obra Ornare')

  pdf.section('Identificação')
  pdf.grid(dadosBase(ctx))

  if (tipo === 'executivo') {
    pdf.section('Cronograma')
    pdf.grid([
      { label: 'Início previsto', value: dataBR(ctx.cronograma.data_inicio_prevista || ctx.obra.data_inicio) },
      { label: 'Fim previsto', value: dataBR(ctx.cronograma.data_fim_prevista || ctx.obra.data_previsao) },
      { label: 'Travado', value: ctx.cronograma.travado ? 'Sim' : 'Não' },
      { label: 'Ação recomendada', value: ctx.cronograma.acao_recomendada || '-' },
    ])
    if (ctx.cronograma.motivo_trava) pdf.paragraph(`Motivo da trava: ${ctx.cronograma.motivo_trava}`)

    pdf.section('Ocorrências')
    pdf.list(ctx.ocorrencias.slice(0, 10).map(o => ({
      title: o.titulo || o.categoria || 'Ocorrência',
      meta: o.status || o.gravidade || dataBR(o.created_at),
      detail: o.descricao || o.observacao || '',
    })))

    pdf.section('Gastos')
    adicionarResumoFinanceiro(pdf, ctx.gastos)
  }

  if (tipo === 'operacional') {
    pdf.section('Checklist por ambiente')
    adicionarChecklistPorAmbiente(pdf, ctx)

    pdf.section('Agenda')
    pdf.list(ctx.agenda.map(a => ({ title: a.titulo || a.tipo || 'Compromisso', meta: dataBR(a.data), detail: a.observacao || '' })))

    pdf.section('Fotos')
    pdf.list(ctx.fotos.slice(0, 12).map(f => ({
      title: f.categoria || f.etapa || 'Foto',
      meta: dataBR(f.created_at),
      detail: [f.observacao, f.aprovada_gestao || f.aprovada ? 'aprovada' : 'aguardando aprovação'].filter(Boolean).join(' · '),
    })), 'Nenhuma foto registrada.')

    pdf.section('Ocorrências e Histórico')
    pdf.list(ctx.ocorrencias.map(o => ({ title: o.titulo || 'Ocorrência', meta: o.status || o.gravidade || '-', detail: o.descricao || '' })))
    pdf.list(ctx.historico.slice(0, 8).map(h => ({ title: h.titulo || h.acao || 'Histórico', meta: dataBR(h.created_at), detail: h.descricao || h.observacao || '' })), 'Nenhum histórico registrado.')

    pdf.section('Gastos')
    adicionarResumoFinanceiro(pdf, ctx.gastos)
  }

  if (tipo === 'cliente') {
    pdf.section('Andamento da obra')
    pdf.grid([
      { label: 'Status', value: ctx.cronograma.status_operacional || ctx.obra.status },
      { label: 'Fase atual', value: faseGestao(ctx) },
      { label: 'Percentual', value: `${ctx.cronograma.percentual_concluido ?? ctx.obra.progresso ?? 0}%` },
      { label: 'Previsão', value: dataBR(ctx.cronograma.data_fim_prevista || ctx.obra.data_previsao) },
    ])

    pdf.section('Próximas etapas')
    pdf.paragraph(ctx.cronograma.acao_recomendada || 'A equipe Ornare seguirá acompanhando as próximas etapas da obra.')

    pdf.section('Agenda liberada')
    pdf.list(ctx.agenda.filter(a => a.visivel_cliente === true || a.visibilidade === 'cliente' || a.visibilidade === 'publica').map(a => ({
      title: a.titulo || a.tipo || 'Compromisso',
      meta: dataBR(a.data),
      detail: a.observacao || '',
    })), 'Nenhum compromisso liberado ao cliente.')

    pdf.section('Fotos aprovadas')
    pdf.list(ctx.fotos.filter(f => (f.visivel_cliente || f.visibilidade === 'cliente') && (f.aprovada_gestao || f.aprovada)).slice(0, 12).map(f => ({
      title: f.categoria || f.etapa || 'Foto',
      meta: dataBR(f.created_at),
      detail: f.observacao || '',
    })), 'Nenhuma foto aprovada para o cliente.')
  }

  pdf.save(`${nomeArquivo(titulo)}-${nomeArquivo(ctx.obra.nome)}.pdf`)
}

export async function exportarPlanejamentoPdf({ registros = [], agenda = [], mesAtual = new Date() }) {
  const pdf = await criarPdf('Relatório de Planejamento', 'Central de Planejamento Operacional')
  const mes = mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const obrasIds = new Set(registros.map(r => r.obra_id).filter(Boolean))
  const travadas = registros.filter(r => r.travado || normalizar(r.status_operacional).includes('trav'))
  const riscos = registros.filter(r => ['alto', 'critico'].includes(normalizar(r.risco)))

  pdf.section(`Resumo do mês - ${mes}`)
  pdf.grid([
    { label: 'Obras no cronograma', value: obrasIds.size },
    { label: 'Compromissos', value: agenda.length },
    { label: 'Travadas', value: travadas.length },
    { label: 'Risco alto', value: riscos.length },
  ])

  pdf.section('Cronograma operacional')
  pdf.list(registros.slice(0, 40).map(r => ({
    title: r.obra?.nome || r.obra_nome || 'Obra',
    meta: `${dataBR(r.data_inicio_prevista)} - ${dataBR(r.data_fim_prevista)}`,
    detail: `${r.faseLabel || r.fase || '-'} · ${r.status_operacional || '-'} · ${r.percentual_concluido ?? 0}%`,
  })), 'Nenhuma obra no cronograma.')

  pdf.section('Agenda do período')
  pdf.list(agenda.slice(0, 40).map(a => ({
    title: a.obra?.nome || a.titulo || a.tipo || 'Compromisso',
    meta: dataBR(a.data),
    detail: [a.tipo, a.supervisor?.full_name || a.supervisor?.email].filter(Boolean).join(' · '),
  })), 'Nenhum compromisso encontrado.')

  try {
    pdf.save(`planejamento-ornare-${nomeArquivo(mes)}.pdf`)
  } catch (error) {
    throw new Error(`Nao foi possivel gerar o PDF de planejamento. ${erroMensagem(error)}`, { cause: error })
  }
}
