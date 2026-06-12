import { supabase } from '../lib/supabase'

/**
 * Copia todos os itens do checklist_padrao para checklist_items de uma obra.
 * Deve ser chamado logo apos a criacao da obra.
 *
 * @param {string} obraId - UUID da obra recem criada
 * @returns {Promise<{ count: number, error: any }>}
 */
export async function copiarChecklistPadrao(obraId) {
  // busca itens padrao ordenados
  const { data: itens, error: errBusca } = await supabase
    .from('checklist_padrao')
    .select('descricao, ordem')
    .order('ordem', { ascending: true })

  if (errBusca || !itens || itens.length === 0) {
    return { count: 0, error: errBusca }
  }

  const rows = itens.map(item => ({
    obra_id:   obraId,
    descricao: item.descricao,
    concluido: false,
    ordem:     item.ordem ?? 0,
  }))

  const { error: errInsert } = await supabase
    .from('checklist_items')
    .insert(rows)

  return { count: rows.length, error: errInsert }
}