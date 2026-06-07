import { supabase } from '../lib/supabase'

export const tarefasService = {
  async listarPorObra(obraId) {
    const { data, error } = await supabase
      .from('tarefas')
      .select(`
        *,
        responsavel:profiles(id, full_name, email)
      `)
      .eq('obra_id', obraId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  async criar(tarefa) {
    const { data, error } = await supabase
      .from('tarefas')
      .insert([tarefa])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async atualizarStatus(id, status) {
    const { data, error } = await supabase
      .from('tarefas')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deletar(id) {
    const { error } = await supabase
      .from('tarefas')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async calcularProgresso(obraId) {
    const { data, error } = await supabase
      .from('tarefas')
      .select('status')
      .eq('obra_id', obraId)

    if (error) throw error
    if (!data || data.length === 0) return 0

    const concluidas = data.filter(t => t.status === 'concluida').length
    return Math.round((concluidas / data.length) * 100)
  }
}