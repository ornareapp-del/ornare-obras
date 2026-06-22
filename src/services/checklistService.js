import { MODELOS_CAMPO_ORNARE } from '../constants/checklistOrnare'
import { supabase } from '../lib/supabase'

function normalizar(valor) {
  return (valor || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function montarModeloPadrao(modelo) {
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

function montarModeloPadraoBasico(modelo) {
  return {
    descricao: modelo.descricao,
    fase: modelo.fase,
    categoria_ambiente: modelo.ambiente || 'Geral',
    ordem: modelo.ordem,
  }
}

async function buscarModelosPadrao() {
  return supabase
    .from('checklist_padrao')
    .select('*')
    .order('ordem', { ascending: true })
}

async function garantirBibliotecaPadrao(modelosAtuais = []) {
  if (modelosAtuais?.length) return { modelos: modelosAtuais, error: null }

  const { data: modelosExistentes, error: erroBusca } = await buscarModelosPadrao()
  if (erroBusca) return { modelos: [], error: erroBusca }
  if (modelosExistentes?.length) return { modelos: modelosExistentes, error: null }

  const { error: erroInsert } = await supabase
    .from('checklist_padrao')
    .insert(MODELOS_CAMPO_ORNARE.map(montarModeloPadrao))

  if (erroInsert) {
    const { error: erroFallback } = await supabase
      .from('checklist_padrao')
      .insert(MODELOS_CAMPO_ORNARE.map(montarModeloPadraoBasico))

    if (erroFallback) return { modelos: [], error: erroFallback }
  }

  const { data: modelosCriados, error: erroRecarregar } = await buscarModelosPadrao()
  return { modelos: modelosCriados || [], error: erroRecarregar }
}

/**
 * Copia todos os itens do checklist_padrao para checklist_items de uma obra.
 * Deve ser chamado logo apos a criacao da obra.
 *
 * @param {string} obraId - UUID da obra recem criada
 * @returns {Promise<{ count: number, error: any }>}
 */
export async function copiarChecklistPadrao(obraId) {
  const [{ data: itensIniciais, error: errBusca }, { data: ambientes }] = await Promise.all([
    buscarModelosPadrao(),
    supabase
      .from('obra_ambientes')
      .select('id, nome')
      .eq('obra_id', obraId),
  ])

  if (errBusca) {
    return { count: 0, error: errBusca }
  }

  const { modelos: itens, error: erroBiblioteca } = await garantirBibliotecaPadrao(itensIniciais || [])
  if (erroBiblioteca || !itens.length) return { count: 0, error: erroBiblioteca }

  const ambientesNormalizados = (ambientes || []).map(a => ({ ...a, nomeNormalizado: normalizar(a.nome) }))
  const rows = []

  itens.forEach(item => {
    const categoria = normalizar(item.categoria_ambiente)
    const ambiente = categoria
      ? ambientesNormalizados.find(a => a.nomeNormalizado === categoria || a.nomeNormalizado.includes(categoria) || categoria.includes(a.nomeNormalizado))
      : null

    rows.push({
      obra_id:      obraId,
      ambiente_id:  ambiente?.id || null,
      descricao:    item.descricao,
      concluido:    false,
    })
  })

  const { error: errInsert } = await supabase
    .from('checklist_items')
    .insert(rows)

  return { count: rows.length, error: errInsert }
}

function valorAmbientePadrao(item) {
  return item.ambiente || item.categoria_ambiente || item.categoria || ''
}

function montarItemObra(item, obraId, ambienteId) {
  return {
    obra_id: obraId,
    ambiente_id: ambienteId || null,
    descricao: item.descricao,
    concluido: false,
    fase: item.fase || null,
    responsavel_perfil: item.responsavel || item.perfil_responsavel || null,
    criticidade: item.criticidade || null,
    status: 'pendente',
  }
}

function montarItemObraBasico(item, obraId, ambienteId) {
  return {
    obra_id: obraId,
    ambiente_id: ambienteId || null,
    descricao: item.descricao,
    concluido: false,
  }
}

function destinoAmbientes(item, ambientesNormalizados) {
  const ambientePadrao = normalizar(valorAmbientePadrao(item))

  if (!ambientePadrao || ambientePadrao === 'geral') return [null]

  const encontrados = ambientesNormalizados.filter(a => (
    a.nomeNormalizado === ambientePadrao ||
    a.nomeNormalizado.includes(ambientePadrao) ||
    ambientePadrao.includes(a.nomeNormalizado)
  ))

  return encontrados.length ? encontrados.map(a => a.id) : [null]
}

/**
 * Aplica a Biblioteca Mestre em uma obra sem duplicar descricao + ambiente.
 *
 * @param {string} obraId
 * @param {{ fase?: string, ambiente?: string }} filtros
 * @returns {Promise<{ count: number, skipped: number, error: any }>}
 */
export async function aplicarBibliotecaChecklist(obraId, filtros = {}) {
  const [{ data: modelosIniciais, error: errModelos }, { data: ambientes }, { data: existentes }] = await Promise.all([
    buscarModelosPadrao(),
    supabase
      .from('obra_ambientes')
      .select('id, nome')
      .eq('obra_id', obraId),
    supabase
      .from('checklist_items')
      .select('id, ambiente_id, descricao')
      .eq('obra_id', obraId),
  ])

  if (errModelos) return { count: 0, skipped: 0, error: errModelos }

  const { modelos, error: erroBiblioteca } = await garantirBibliotecaPadrao(modelosIniciais || [])
  if (erroBiblioteca) return { count: 0, skipped: 0, error: erroBiblioteca }

  const faseFiltro = normalizar(filtros.fase)
  const ambienteFiltro = normalizar(filtros.ambiente)
  const ambientesNormalizados = (ambientes || []).map(a => ({ ...a, nomeNormalizado: normalizar(a.nome) }))
  const chavesExistentes = new Set((existentes || []).map(i => `${i.ambiente_id || 'geral'}::${normalizar(i.descricao)}`))
  const rows = []
  let skipped = 0

  ;(modelos || [])
    .filter(item => item.descricao)
    .filter(item => item.ativo !== false)
    .filter(item => !faseFiltro || normalizar(item.fase) === faseFiltro)
    .filter(item => !ambienteFiltro || normalizar(valorAmbientePadrao(item)) === ambienteFiltro)
    .forEach(item => {
      destinoAmbientes(item, ambientesNormalizados).forEach(ambienteId => {
        const chave = `${ambienteId || 'geral'}::${normalizar(item.descricao)}`
        if (chavesExistentes.has(chave)) {
          skipped += 1
          return
        }
        chavesExistentes.add(chave)
        rows.push(montarItemObra(item, obraId, ambienteId))
      })
    })

  if (rows.length === 0) return { count: 0, skipped, error: null }

  const { error } = await supabase.from('checklist_items').insert(rows)

  if (!error) return { count: rows.length, skipped, error: null }

  const fallbackRows = rows.map(row => montarItemObraBasico(row, row.obra_id, row.ambiente_id))
  const { error: fallbackError } = await supabase.from('checklist_items').insert(fallbackRows)

  return { count: fallbackError ? 0 : fallbackRows.length, skipped, error: fallbackError || null }
}
