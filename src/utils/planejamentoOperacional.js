export const MOTIVOS_PAUSA = [
  'Aguardando material',
  'Aguardando cliente',
  'Equipe em outra obra',
  'Pendência técnica',
  'Ambiente indisponível',
  'Retorno planejado',
  'Outro',
]

export const TIPOS_DEPENDENCIA = [
  'Material entregue',
  'Aprovação técnica',
  'Ambiente liberado',
  'Vistoria concluída',
  'Pagamento aprovado',
  'Período anterior concluído',
  'Outro',
]

export const MODELOS_EXECUCAO = {
  simples: {
    label: 'Montagem simples',
    etapas: [{ atividade: 'Montagem', deslocamento: 0, duracao: 5, retorno_necessario: false }],
  },
  desmontagem: {
    label: 'Montagem com desmontagem',
    etapas: [
      { atividade: 'Desmontagem', deslocamento: 0, duracao: 2, retorno_necessario: true },
      { atividade: 'Montagem', deslocamento: 7, duracao: 5, retorno_necessario: false },
    ],
  },
  duas_etapas: {
    label: 'Montagem em duas etapas',
    etapas: [
      { atividade: 'Montagem parcial', deslocamento: 0, duracao: 4, retorno_necessario: true },
      { atividade: 'Retorno / finalização', deslocamento: 14, duracao: 3, retorno_necessario: false },
    ],
  },
  assistencia: {
    label: 'Assistência técnica',
    etapas: [{ atividade: 'Assistência técnica', deslocamento: 0, duracao: 1, retorno_necessario: false }],
  },
  pos_venda: {
    label: 'Pós-venda',
    etapas: [{ atividade: 'Vistoria', deslocamento: 0, duracao: 1, retorno_necessario: false }],
  },
}

export function isoLocal(data) {
  const date = data instanceof Date ? data : new Date(`${data}T12:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function adicionarDias(data, quantidade) {
  const date = new Date(`${data}T12:00:00`)
  date.setDate(date.getDate() + Number(quantidade || 0))
  return isoLocal(date)
}

export function intervaloSobrepoe(inicioA, fimA, inicioB, fimB) {
  return Boolean(inicioA && inicioB && inicioA <= (fimB || inicioB) && (fimA || inicioA) >= inicioB)
}

export function diasOperacionaisEntre(inicio, fim, excecoes = []) {
  if (!inicio) return []
  const excecaoPorData = new Map((excecoes || []).map(item => [item.data, item]))
  const atual = new Date(`${inicio}T12:00:00`)
  const limite = new Date(`${fim || inicio}T12:00:00`)
  const dias = []
  while (atual <= limite) {
    const data = isoLocal(atual)
    const excecao = excecaoPorData.get(data)
    const fimDeSemana = [0, 6].includes(atual.getDay())
    if (excecao ? excecao.dia_util : !fimDeSemana) dias.push(data)
    atual.setDate(atual.getDate() + 1)
  }
  return dias
}

export function metricasPeriodos(periodos = [], excecoes = []) {
  const datas = new Set()
  let pesoTotal = 0
  let realizado = 0
  periodos.filter(item => item?.data && item.status !== 'cancelada').forEach(item => {
    const dias = diasOperacionaisEntre(item.data, item.data_fim || item.data, excecoes)
    dias.forEach(data => datas.add(data))
    const peso = Math.max(1, dias.length)
    const percentual = Math.max(0, Math.min(100, Number(item.percentual_concluido) || 0))
    pesoTotal += peso
    realizado += peso * percentual
  })
  return { dias: datas.size, percentual: pesoTotal ? Math.round(realizado / pesoTotal) : 0 }
}

export function criarPeriodosDoModelo(modeloKey, dataInicial) {
  const modelo = MODELOS_EXECUCAO[modeloKey]
  if (!modelo || !dataInicial) return []
  return modelo.etapas.map(etapa => {
    const data = adicionarDias(dataInicial, etapa.deslocamento)
    return { ...etapa, data, data_fim: adicionarDias(data, etapa.duracao - 1) }
  })
}

export function validarEncerramento({ checklist = [], fotos = [], ocorrencias = [], checkins = [], retornoNecessario = false }) {
  const pendencias = []
  if (checklist.some(item => !item.concluido)) pendencias.push('Checklist possui itens pendentes')
  if (!fotos.length) pendencias.push('Nenhuma foto foi registrada')
  if (ocorrencias.some(item => !['resolvida', 'concluida', 'cancelada'].includes(String(item.status || '').toLowerCase()))) pendencias.push('Existem ocorrências abertas')
  if (checkins.some(item => item.entrada && !item.saida)) pendencias.push('Existe check-in sem check-out')
  if (retornoNecessario) pendencias.push('O período ainda exige retorno')
  return { podeEncerrar: pendencias.length === 0, pendencias }
}
