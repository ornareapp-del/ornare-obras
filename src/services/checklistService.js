import { supabase } from '../lib/supabase'

function normalizar(valor) {
  return (valor || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

/**
 * Copia todos os itens do checklist_padrao para checklist_items de uma obra.
 * Deve ser chamado logo apos a criacao da obra.
 *
 * @param {string} obraId - UUID da obra recem criada
 * @returns {Promise<{ count: number, error: any }>}
 */
export async function copiarChecklistPadrao(obraId) {
  const [{ data: itens, error: errBusca }, { data: ambientes }] = await Promise.all([
    supabase
      .from('checklist_padrao')
      .select('descricao, ordem, categoria_ambiente')
      .order('ordem', { ascending: true }),
    supabase
      .from('obra_ambientes')
      .select('id, nome')
      .eq('obra_id', obraId),
  ])

  if (errBusca || !itens || itens.length === 0) {
    return { count: 0, error: errBusca }
  }

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
