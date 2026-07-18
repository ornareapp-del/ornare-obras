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

class PlanejamentoPdf {
  constructor(jsPDF, mes) {
    this.doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    this.mes = mes; this.page = 1; this.header()
  }
  header() {
    const d = this.doc
    d.setFillColor(THEME.ink); d.rect(0, 0, 297, 29, 'F')
    d.setTextColor('#FFFFFF'); d.setFont('helvetica', 'bold'); d.setFontSize(17); d.text('ORNARE', 14, 13)
    d.setTextColor(THEME.gold); d.setFontSize(6.5); d.text('WORKS  /  FLORIANOPOLIS', 14, 19)
    d.setTextColor('#FFFFFF'); d.setFontSize(14); d.text('PLANEJAMENTO EXECUTIVO', 78, 12.5)
    d.setFont('helvetica', 'normal'); d.setTextColor('#DDD5C9'); d.setFontSize(8); d.text(`Carteira de obras e agenda operacional  -  ${this.mes}`, 78, 19)
    d.setDrawColor(THEME.gold); d.setLineWidth(0.8); d.line(14, 26, 283, 26); this.y = 37
  }
  footer() {
    const d = this.doc; d.setDrawColor(THEME.border); d.line(14, 199, 283, 199)
    d.setTextColor(THEME.muted); d.setFont('helvetica', 'normal'); d.setFontSize(6.5)
    d.text(`Atualizado em ${new Date().toLocaleString('pt-BR')}  |  Ornare Works`, 14, 204); d.text(`Pagina ${this.page}`, 272, 204)
  }
  addPage(title) { this.footer(); this.doc.addPage(); this.page += 1; this.header(); if (title) this.section(title) }
  ensure(h, title) { if (this.y + h > 195) this.addPage(title) }
  fit(v, w) { return this.doc.splitTextToSize(String(v ?? '-'), w)[0] || '-' }
  title(t, s) { this.doc.setTextColor(THEME.ink); this.doc.setFont('helvetica', 'bold'); this.doc.setFontSize(17); this.doc.text(t, 14, this.y); this.doc.setFont('helvetica', 'normal'); this.doc.setTextColor(THEME.muted); this.doc.setFontSize(8); this.doc.text(s, 14, this.y + 5); this.y += 12 }
  section(t, note = '') { this.ensure(14); const d = this.doc; d.setFillColor(THEME.soft); d.rect(14, this.y, 269, 9, 'F'); d.setFillColor(THEME.gold); d.rect(14, this.y, 2, 9, 'F'); d.setTextColor(THEME.ink); d.setFont('helvetica', 'bold'); d.setFontSize(9.5); d.text(t, 20, this.y + 5.8); if (note) { d.setFont('helvetica', 'normal'); d.setTextColor(THEME.muted); d.setFontSize(6.5); d.text(note, 280, this.y + 5.8, { align: 'right' }) } this.y += 13 }
  kpis(items) { const gap = 3, w = (269 - gap * (items.length - 1)) / items.length; items.forEach((it, i) => { const x = 14 + i * (w + gap), d = this.doc; d.setDrawColor(it.danger ? THEME.danger : THEME.border); d.setLineWidth(it.danger ? .7 : .25); d.roundedRect(x, this.y, w, 20, 2, 2); d.setTextColor(it.danger ? THEME.danger : THEME.gold); d.setFont('helvetica', 'bold'); d.setFontSize(6.2); d.text(String(it.label).toUpperCase(), x + 4, this.y + 6); d.setTextColor(THEME.ink); d.setFontSize(15); d.text(String(it.value), x + 4, this.y + 15) }); this.y += 26 }
  table(cols, rows, title = 'Continuacao') {
    const head = () => { let x = 14; const d = this.doc; d.setFillColor(THEME.ink); d.rect(14, this.y, 269, 8, 'F'); cols.forEach(c => { d.setTextColor('#FFF'); d.setFont('helvetica', 'bold'); d.setFontSize(6.3); d.text(c.label, x + 2, this.y + 5.2); x += c.width }); this.y += 8 }
    head(); if (!rows.length) { this.doc.setTextColor(THEME.muted); this.doc.setFontSize(7.5); this.doc.text('Nenhum registro encontrado.', 16, this.y + 7); this.y += 12; return }
    rows.forEach((row, i) => { if (this.y + 11 > 195) { this.addPage(title); head() } const d = this.doc; if (i % 2) { d.setFillColor('#F5F2ED'); d.rect(14, this.y, 269, 11, 'F') } let x = 14; cols.forEach(c => { const v = c.get(row); d.setTextColor(c.color ? c.color(row) : THEME.ink); d.setFont('helvetica', c.bold ? 'bold' : 'normal'); d.setFontSize(6.7); d.text(this.fit(v || '-', c.width - 4), x + 2, this.y + 6.5); x += c.width }); d.setDrawColor(THEME.border); d.line(14, this.y + 11, 283, this.y + 11); this.y += 11 }); this.y += 5
  }
  save(name) { this.footer(); this.doc.save(name) }
}

function alertaPlanejamento(r, ocorrencias) {
  const a = []
  if (r.travado) a.push('Obra travada')
  if (['alto', 'critico'].includes(normalizar(r.risco))) a.push(`Risco ${r.risco}`)
  const abertas = ocorrencias.filter(o => o.obra_id === r.obra_id && !['resolvida', 'concluida', 'cancelada'].includes(normalizar(o.status)))
  if (abertas.length) a.push(`${abertas.length} ocorrencia(s)`)
  if (!r.montadores?.length) a.push('Equipe nao alocada')
  return a.join(' | ') || 'OK - sem pendencias criticas'
}

export async function exportarPlanejamentoPdf({ registros = [], agenda = [], mesAtual = new Date() }) {
  const mes = mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  try {
    const ids = [...new Set(registros.map(r => r.obra_id).filter(Boolean))]
    const [obrasResult, ocorrenciasResult] = await Promise.all([
      ids.length ? consultaSupabase('obras', supabase.from('obras').select('*').in('id', ids)) : { data: [] },
      ids.length ? consultaSupabase('ocorrencias', supabase.from('ocorrencias').select('*').in('obra_id', ids)) : { data: [] },
    ])
    const obras = safeArray(obrasResult), ocorrencias = safeArray(ocorrenciasResult), obraPorId = new Map(obras.map(o => [o.id, o]))
    const carteira = registros.map(r => ({ ...r, obra: { ...(r.obra || {}), ...(obraPorId.get(r.obra_id) || {}) } }))
    const travadas = carteira.filter(r => r.travado || normalizar(r.status_operacional).includes('trav'))
    const riscos = carteira.filter(r => ['alto', 'critico'].includes(normalizar(r.risco)))
    const equipes = new Set(agenda.flatMap(a => (a.montadores || []).map(nomePessoa)).filter(n => n !== '-'))
    const { jsPDF } = await import('jspdf'); const pdf = new PlanejamentoPdf(jsPDF, mes)
    pdf.title('Dashboard da operacao', 'Leitura executiva da carteira, dos riscos e da mobilizacao das equipes.')
    pdf.kpis([{ label: 'Obras ativas', value: ids.length }, { label: 'Execucoes / agenda', value: agenda.length }, { label: 'Equipes mobilizadas', value: equipes.size }, { label: 'Obras travadas', value: travadas.length, danger: travadas.length > 0 }, { label: 'Risco alto', value: riscos.length, danger: riscos.length > 0 }])
    pdf.section('Visao rapida por obra', `${carteira.length} registros no cronograma`)
    pdf.table([
      { label: 'OBRA / CLIENTE', width: 52, get: r => r.obra?.nome, bold: true }, { label: 'STATUS', width: 31, get: r => r.status_operacional || r.obra?.status }, { label: 'FASE ATUAL', width: 37, get: r => r.faseLabel || r.fase }, { label: 'PROG.', width: 16, get: r => `${r.percentual_concluido ?? 0}%`, bold: true }, { label: 'PERIODO PREVISTO', width: 43, get: r => `${dataBR(r.data_inicio_prevista)} - ${dataBR(r.data_fim_prevista)}` }, { label: 'RESPONSAVEL / EQUIPE', width: 44, get: r => (r.montadores || []).map(nomePessoa).join(', ') || nomePessoa(r.supervisor) }, { label: 'ALERTAS', width: 46, get: r => alertaPlanejamento(r, ocorrencias), color: r => alertaPlanejamento(r, ocorrencias).startsWith('OK') ? '#2D7A4A' : THEME.danger, bold: true },
    ], carteira, 'Carteira de obras - continuacao')
    pdf.section('Agenda operacional do mes', 'Periodos de execucao e compromissos confirmados')
    pdf.table([
      { label: 'DATA / HORARIO', width: 38, get: a => `${dataBR(a.data)}${a.hora_inicio ? `  ${String(a.hora_inicio).slice(0, 5)}` : ''}`, bold: true }, { label: 'OBRA', width: 54, get: a => a.obra?.nome || a.titulo || 'Interno', bold: true }, { label: 'ATIVIDADE', width: 43, get: a => a.compromissoTipo || a.tipo }, { label: 'PERIODO', width: 42, get: a => a.data_fim && a.data_fim !== a.data ? `${dataBR(a.data)} - ${dataBR(a.data_fim)}` : 'No dia' }, { label: 'RESPONSAVEL', width: 43, get: a => nomePessoa(a.supervisor) }, { label: 'EQUIPE ALOCADA', width: 49, get: a => (a.montadores || []).map(nomePessoa).join(', ') || 'Sem equipe definida' },
    ], [...agenda].sort((a, b) => String(a.data).localeCompare(String(b.data))), 'Agenda operacional - continuacao')
    pdf.section('Dados de cliente e local da obra', 'Apoio para logistica e contato')
    pdf.table([
      { label: 'OBRA / CLIENTE', width: 58, get: o => o.nome || o.cliente_nome, bold: true }, { label: 'CONTATO', width: 58, get: o => [o.cliente_telefone, o.cliente_email].filter(Boolean).join(' | ') }, { label: 'ENDERECO DA OBRA', width: 89, get: o => o.endereco || [o.cidade, o.uf].filter(Boolean).join(' / ') }, { label: 'CONTRATO', width: 34, get: o => o.numero_contrato }, { label: 'PREVISAO', width: 30, get: o => dataBR(o.data_previsao || o.data_previsao_entrega) },
    ], obras, 'Clientes e locais - continuacao')
    pdf.section('Pontos de atencao', 'Prioridades para a reuniao de planejamento')
    pdf.table([
      { label: 'OBRA', width: 58, get: r => r.obra?.nome, bold: true }, { label: 'RISCO / STATUS', width: 51, get: r => `${r.risco || 'nao informado'} | ${r.status_operacional || '-'}` }, { label: 'PENDENCIA', width: 91, get: r => alertaPlanejamento(r, ocorrencias), color: () => THEME.danger, bold: true }, { label: 'ACAO RECOMENDADA', width: 69, get: r => r.acao_recomendada || 'Definir responsavel e proximo passo' },
    ], carteira.filter(r => !alertaPlanejamento(r, ocorrencias).startsWith('OK')), 'Pontos de atencao - continuacao')
    pdf.save(`planejamento-executivo-ornare-${nomeArquivo(mes)}.pdf`)
  } catch (error) {
    throw new Error(`Nao foi possivel gerar o PDF de planejamento. ${erroMensagem(error)}`, { cause: error })
  }
}
