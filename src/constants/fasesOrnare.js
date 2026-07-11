export const FASES_ORNARE = [
  {
    id: 1,
    key: 'vistoria_medida',
    label: 'Vistoria Medida Fina',
    descricao: 'Aguardando conclusão da medida in loco',
    label_cliente: 'Medição',
    cor: '#9070C0',
  },
  {
    id: 2,
    key: 'executivo',
    label: 'Executivo',
    descricao: 'Aprovação do caderno executivo',
    label_cliente: 'Projeto aprovado',
    cor: '#4A90D9',
  },
  {
    id: 3,
    key: 'producao',
    label: 'Produção',
    descricao: 'Produção fabril em andamento',
    label_cliente: 'Em produção',
    cor: '#E8A020',
  },
  {
    id: 4,
    key: 'vistoria_tecnica',
    label: 'Vistoria Técnica',
    descricao: 'Liberação técnica para montagem',
    label_cliente: 'Aguardando liberação',
    cor: '#D9704A',
  },
  {
    id: 5,
    key: 'entrega_moveis',
    label: 'Entrega dos Móveis',
    descricao: 'Programação logística e entrega',
    label_cliente: 'Móveis a caminho',
    cor: '#B09A7A',
  },
  {
    id: 6,
    key: 'montagem',
    label: 'Montagem',
    descricao: 'Equipe in loco realizando montagem',
    label_cliente: 'Em montagem',
    cor: '#C9A96E',
  },
  {
    id: 7,
    key: 'montagem_finalizada',
    label: 'Montagem Finalizada',
    descricao: 'Montagem concluída, aguardando vistoria',
    label_cliente: 'Montagem concluída',
    cor: '#5AAB6E',
  },
  {
    id: 8,
    key: 'vistoria_final',
    label: 'Vistoria Final',
    descricao: 'Aprovação com o cliente',
    label_cliente: 'Vistoria final',
    cor: '#3A7D4F',
  },
  {
    id: 9,
    key: 'obra_concluida',
    label: 'Obra Concluída',
    descricao: 'Obra encerrada com sucesso',
    label_cliente: 'Entregue',
    cor: '#2D7A4A',
  },
]

export function faseOrnarePorKey(key) {
  return FASES_ORNARE.find(fase => fase.key === key) || null
}

export function faseOrnarePorTexto(texto) {
  const normalizado = String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  const mapaLegado = {
    'aguardando inicio': 'vistoria_medida',
    'medicao agendada': 'vistoria_medida',
    'em medicao': 'vistoria_medida',
    'vistoria medida fina': 'vistoria_medida',
    'pre-obra': 'vistoria_medida',
    'pre obra': 'vistoria_medida',
    'projeto em conferencia': 'executivo',
    executivo: 'executivo',
    producao: 'producao',
    'em producao': 'producao',
    'pronta para entrega': 'vistoria_tecnica',
    'vistoria tecnica': 'vistoria_tecnica',
    'aguardando liberacao': 'vistoria_tecnica',
    entrega: 'entrega_moveis',
    'entrega dos moveis': 'entrega_moveis',
    'moveis a caminho': 'entrega_moveis',
    'aguardando montagem': 'entrega_moveis',
    'montagem agendada': 'montagem',
    montagem: 'montagem',
    'em montagem': 'montagem',
    'montagem finalizada': 'montagem_finalizada',
    'vistoria final': 'vistoria_final',
    'pos-venda': 'obra_concluida',
    'pos venda': 'obra_concluida',
    concluida: 'obra_concluida',
    concluido: 'obra_concluida',
    'obra concluida': 'obra_concluida',
    entregue: 'obra_concluida',
  }

  const keyLegada = mapaLegado[normalizado]
  if (keyLegada) return faseOrnarePorKey(keyLegada)

  return FASES_ORNARE.find(fase => (
    fase.key === texto ||
    normalizado === fase.label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ||
    normalizado === fase.label_cliente.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  )) || null
}

export function indiceFaseOrnare(keyOuTexto) {
  const fase = faseOrnarePorKey(keyOuTexto) || faseOrnarePorTexto(keyOuTexto)
  return fase ? FASES_ORNARE.findIndex(item => item.key === fase.key) : -1
}
