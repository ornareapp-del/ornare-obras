import { supabase } from '../lib/supabase'

function rpcIndisponivel(error) {
  return ['PGRST202', '42883'].includes(error?.code)
    || String(error?.message || '').toLowerCase().includes('ornare_atualizar_resumo_obra')
}

export const obrasService = {
  async atualizarResumo({ obra, cronogramaId, percentual }) {
    const payload = {
      p_obra_id: obra.id,
      p_nome: obra.nome,
      p_status: obra.status,
      p_percentual: percentual,
      p_data_fim_prevista: obra.data_previsao || null,
      p_cliente_nome: obra.cliente_nome || null,
      p_observacoes: obra.observacoes || null,
    }

    const rpc = await supabase.rpc('ornare_atualizar_resumo_obra', payload)
    if (!rpc.error) return rpc
    if (!rpcIndisponivel(rpc.error)) return rpc

    const obraResult = await supabase.from('obras').update({
      nome: obra.nome,
      status: obra.status,
      ...(!cronogramaId ? {
        progresso: percentual,
        data_previsao: obra.data_previsao || null,
      } : {}),
      cliente_nome: obra.cliente_nome || null,
      observacoes: obra.observacoes || null,
    }).eq('id', obra.id)
    if (obraResult.error) return obraResult

    if (!cronogramaId) return obraResult
    return supabase.from('obra_cronograma').update({
      percentual_concluido: percentual,
      data_fim_prevista: obra.data_previsao || null,
    }).eq('id', cronogramaId)
  },
}
