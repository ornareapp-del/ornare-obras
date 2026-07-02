import { supabase } from '../lib/supabase'

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

function safeArray(result) {
  return result?.data || []
}

function dinheiro(value) {
  const n = Number(value || 0)
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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

function statusGasto(gasto) {
  const status = normalizar(gasto?.status || 'aprovado').trim()
  if (status === 'pendente') return 'pendente_aprovacao'
  if (['aprovado', 'pendente_aprovacao', 'recusado'].includes(status)) return status
  return 'aprovado'
}

function gastoRealizado(gasto) {
  return statusGasto(gasto) === 'aprovado'
}

function valorAmbiente(item, ambientesPorId) {
  return ambientesPorId.get(item.ambiente_id)?.nome || 'Geral'
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
  const { jsPDF } = await import('jspdf')
  return new PdfBuilder(jsPDF, titulo, subtitulo)
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
    supabase.from('obras').select('*').eq('id', obraId).single(),
    supabase.from('obra_cronograma').select('*').eq('obra_id', obraId).maybeSingle(),
    supabase.from('profiles').select('id, full_name, email, role'),
    supabase.from('obra_montadores').select('obra_id, montador_id').eq('obra_id', obraId),
    supabase.from('obra_ambientes').select('id, nome').eq('obra_id', obraId),
    supabase.from('checklist_items').select('*').eq('obra_id', obraId).order('descricao'),
    supabase.from('agenda').select('*').eq('obra_id', obraId).order('data'),
    supabase.from('fotos').select('*').eq('obra_id', obraId).order('created_at', { ascending: false }),
    supabase.from('ocorrencias').select('*').eq('obra_id', obraId).order('created_at', { ascending: false }),
    supabase.from('gastos').select('*').eq('obra_id', obraId).order('created_at', { ascending: false }),
    supabase.from('historico_obra').select('*').eq('obra_id', obraId).order('created_at', { ascending: false }),
  ])

  if (obra.error) throw obra.error

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
  }
}

function dadosBase(ctx) {
  const { obra, cronograma, supervisor, comercial, montadores } = ctx
  return [
    { label: 'Cliente', value: obra.cliente_nome },
    { label: 'Obra', value: obra.nome },
    { label: 'Supervisor', value: nomePessoa(supervisor) },
    { label: 'Equipe', value: montadores.map(nomePessoa).join(', ') || '-' },
    { label: 'Fase', value: cronograma.fase || obra.status },
    { label: 'Status', value: cronograma.status_operacional || obra.status },
    { label: 'Prioridade', value: cronograma.prioridade || '-' },
    { label: 'Risco', value: cronograma.risco || '-' },
    { label: 'Percentual', value: `${cronograma.percentual_concluido ?? obra.progresso ?? 0}%` },
    { label: 'Pós-venda', value: nomePessoa(comercial) },
  ]
}

function adicionarResumoFinanceiro(pdf, gastos) {
  const realizados = gastos.filter(gastoRealizado)
  const pendentes = gastos.filter(g => statusGasto(g) === 'pendente_aprovacao')
  const recusados = gastos.filter(g => statusGasto(g) === 'recusado')
  const total = realizados.reduce((sum, g) => sum + Number(g.valor || 0), 0)
  const totalPendente = pendentes.reduce((sum, g) => sum + Number(g.valor || 0), 0)
  pdf.grid([
    { label: 'Gastos realizados', value: realizados.length },
    { label: 'Total operacional', value: dinheiro(total) },
    { label: 'Pendentes de aprovação', value: `${pendentes.length} (${dinheiro(totalPendente)})` },
    { label: 'Recusados', value: recusados.length },
  ])
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
      { label: 'Fase atual', value: ctx.cronograma.fase || ctx.obra.status },
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
    detail: `${r.fase || '-'} · ${r.status_operacional || '-'} · ${r.percentual_concluido ?? 0}%`,
  })), 'Nenhuma obra no cronograma.')

  pdf.section('Agenda do período')
  pdf.list(agenda.slice(0, 40).map(a => ({
    title: a.obra?.nome || a.titulo || a.tipo || 'Compromisso',
    meta: dataBR(a.data),
    detail: [a.tipo, a.supervisor?.full_name || a.supervisor?.email].filter(Boolean).join(' · '),
  })), 'Nenhum compromisso encontrado.')

  pdf.save(`planejamento-ornare-${nomeArquivo(mes)}.pdf`)
}
