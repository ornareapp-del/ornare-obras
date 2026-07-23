import { supabase } from '../lib/supabase'
import { validarEncerramento } from '../utils/planejamentoOperacional'

const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export async function validarEncerramentoObra({ obraId, periodos = [], aceiteStatus = 'pendente' }) {
  let [checklistResult, fotosResult, ocorrenciasResult, checkinsResult, gastosResult] = await Promise.all([
    supabase.from('checklist_items').select('id, concluido, exige_foto, exige_observacao, exige_validacao_supervisor, observacao_execucao, validado_supervisor').eq('obra_id', obraId),
    supabase.from('fotos').select('id, checklist_item_id').eq('obra_id', obraId),
    supabase.from('ocorrencias').select('id, status').eq('obra_id', obraId),
    supabase.from('checkins').select('id, entrada, saida').eq('obra_id', obraId),
    supabase.from('gastos').select('id, status').eq('obra_id', obraId),
  ])
  if (checklistResult.error && ['exige_foto', 'exige_observacao', 'exige_validacao_supervisor', 'observacao_execucao'].some(coluna => String(checklistResult.error.message || '').includes(coluna))) {
    checklistResult = await supabase.from('checklist_items').select('id, concluido, validado_supervisor').eq('obra_id', obraId)
  }
  if (fotosResult.error && String(fotosResult.error.message || '').includes('checklist_item_id')) {
    fotosResult = await supabase.from('fotos').select('id').eq('obra_id', obraId)
  }
  const falha = [checklistResult, fotosResult, ocorrenciasResult, checkinsResult, gastosResult].find(result => result.error)
  if (falha?.error) return { pendencias: [], error: falha.error }

  const checklist = checklistResult.data || []
  const fotos = fotosResult.data || []
  const validacao = validarEncerramento({
    checklist,
    fotos,
    ocorrencias: ocorrenciasResult.data || [],
    checkins: checkinsResult.data || [],
    retornoNecessario: periodos.some(item => item.retorno_necessario),
  })

  if (periodos.some(item => Number(item.percentual_concluido || 0) < 100 || !['realizada', 'concluida'].includes(norm(item.status)))) {
    validacao.pendencias.push('Existem períodos de execução ainda não concluídos')
  }
  if ((gastosResult.data || []).some(item => norm(item.status) === 'pendente')) validacao.pendencias.push('Existem gastos aguardando aprovação')
  if (checklist.some(item => item.exige_foto && !fotos.some(foto => String(foto.checklist_item_id || '') === String(item.id)))) validacao.pendencias.push('Existem itens de checklist sem a foto obrigatória')
  if (checklist.some(item => item.exige_observacao && !item.observacao_execucao)) validacao.pendencias.push('Existem itens de checklist sem a observação obrigatória')
  if (checklist.some(item => item.exige_validacao_supervisor && !item.validado_supervisor)) validacao.pendencias.push('Existem itens aguardando validação do supervisor')
  if (!['aprovado', 'nao_se_aplica'].includes(aceiteStatus || 'pendente')) validacao.pendencias.push('O aceite final ainda não foi aprovado')

  return { pendencias: validacao.pendencias, error: null }
}
