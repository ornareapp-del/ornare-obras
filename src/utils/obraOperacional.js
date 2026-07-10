import { FASES_ORNARE, faseOrnarePorKey, faseOrnarePorTexto, indiceFaseOrnare } from '../constants/fasesOrnare'

function numeroPercentual(valor, fallback = 0) {
  const numero = Number(valor ?? fallback ?? 0)
  if (!Number.isFinite(numero)) return 0
  return Math.max(0, Math.min(100, numero))
}

export function resolverOperacaoObra(obra = {}, cronograma = null) {
  const faseBase = cronograma?.fase
    || cronograma?.status_operacional
    || obra?.fase
    || obra?.fase_atual
    || obra?.etapa
    || obra?.status

  const fase = faseOrnarePorKey(faseBase) || faseOrnarePorTexto(faseBase) || null
  const faseIndex = fase ? indiceFaseOrnare(fase.key) : -1
  const proximaFase = faseIndex >= 0 ? FASES_ORNARE[Math.min(faseIndex + 1, FASES_ORNARE.length - 1)] : null
  const progresso = numeroPercentual(cronograma?.percentual_concluido, obra?.progresso)

  return {
    fase,
    faseKey: fase?.key || null,
    faseLabel: fase?.label || cronograma?.status_operacional || obra?.fase || obra?.fase_atual || obra?.status || 'Sem fase',
    faseCliente: fase?.label_cliente || fase?.label || obra?.status || 'Em acompanhamento',
    faseDescricao: fase?.descricao || cronograma?.etapa_atual || obra?.status || '',
    etapaAtual: cronograma?.etapa_atual || fase?.descricao || obra?.etapa || obra?.status || '-',
    proximaFase,
    proximaFaseLabel: proximaFase && proximaFase.key !== fase?.key ? proximaFase.label : 'Obra concluída',
    proximaFaseCliente: proximaFase && proximaFase.key !== fase?.key ? proximaFase.label_cliente : 'Obra entregue',
    progresso,
    inicioPrevisto: cronograma?.data_inicio_prevista || obra?.data_inicio_prevista || obra?.data_previsao_inicio || obra?.data_inicio || null,
    inicioReal: cronograma?.data_inicio_real || obra?.data_inicio_real || null,
    fimPrevisto: cronograma?.data_fim_prevista || obra?.data_fim_prevista || obra?.data_previsao || obra?.data_previsao_entrega || obra?.data_previsao_fim || null,
    fimReal: cronograma?.data_fim_real || obra?.data_fim_real || null,
    prioridade: cronograma?.prioridade || obra?.prioridade || '-',
    risco: cronograma?.risco || obra?.risco || '-',
    travado: Boolean(cronograma?.travado),
    cronograma,
  }
}

export function mapearCronogramasPorObra(cronogramas = []) {
  return new Map((cronogramas || []).filter(item => item?.obra_id).map(item => [item.obra_id, item]))
}
