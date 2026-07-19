import { supabase } from '../lib/supabase'

export function resolverDestinoNotificacao(notificacao = {}) {
  if (notificacao.rota) return notificacao.rota

  const tipo = String(notificacao.entidade_tipo || notificacao.tipo || '').toLowerCase()
  const entidadeId = notificacao.entidade_id
  const obraId = notificacao.obra_id

  if (tipo.includes('logistica') || tipo.includes('entrega') || tipo.includes('transporte')) {
    return entidadeId ? `/logistica?entrega=${entidadeId}` : '/logistica'
  }

  if (tipo.includes('agenda') || tipo.includes('compromisso') || tipo.includes('vistoria') || tipo.includes('checkin') || tipo.includes('checkout')) {
    return entidadeId ? `/agenda?compromisso=${entidadeId}` : '/agenda'
  }

  if (tipo.includes('foto')) {
    return obraId ? `/obras/${obraId}?aba=Fotos${entidadeId ? `&foto=${entidadeId}` : ''}` : '/obras?filtro=fotos'
  }

  if (tipo.includes('checklist')) {
    return obraId ? `/obras/${obraId}?aba=Checklist${entidadeId ? `&checklist=${entidadeId}` : ''}` : '/obras?filtro=checklist'
  }

  if (tipo.includes('ocorr')) {
    return obraId ? `/obras/${obraId}?aba=Ocorrencias${entidadeId ? `&ocorrencia=${entidadeId}` : ''}` : '/ocorrencias'
  }

  if (tipo.includes('cronograma')) {
    return obraId ? `/obras/${obraId}?aba=Cronograma${entidadeId ? `&cronograma=${entidadeId}` : ''}` : '/planejamento'
  }

  if (tipo.includes('gasto')) {
    return obraId ? `/obras/${obraId}?aba=Gastos${entidadeId ? `&gasto=${entidadeId}` : ''}` : '/gastos'
  }

  if (tipo.includes('tarefa')) {
    return entidadeId ? `/tarefas?tarefa=${entidadeId}` : '/tarefas'
  }

  if (tipo.includes('montador') || tipo.includes('obra_montadores')) {
    return '/montador'
  }

  if (tipo.includes('obra')) {
    return obraId || entidadeId ? `/obras/${obraId || entidadeId}` : '/obras'
  }

  return obraId ? `/obras/${obraId}` : '/'
}

function normalizarNotificacao(item) {
  const registro = {
    usuario_id: item.usuario_id,
    obra_id: item.obra_id || null,
    tipo: item.tipo || item.entidade_tipo || 'acao',
    titulo: item.titulo,
    descricao: item.descricao || null,
    prioridade: item.prioridade || 'normal',
    status: item.status || 'nao_lida',
    rota: item.rota || resolverDestinoNotificacao(item),
    entidade_tipo: item.entidade_tipo || item.tipo || 'acao',
    entidade_id: item.entidade_id || null,
  }

  return registro.usuario_id && registro.titulo ? registro : null
}

export async function criarNotificacoes(registros = []) {
  const normalizadas = registros.map(normalizarNotificacao).filter(Boolean)
  if (!normalizadas.length) return { data: [], error: null, inserted: 0, skipped: 0 }

  const porChave = new Map()
  normalizadas.forEach(item => {
    const chave = [
      item.usuario_id,
      item.tipo,
      item.obra_id || '',
      item.entidade_tipo || '',
      item.entidade_id || '',
      item.rota || '',
    ].join('|')
    if (!porChave.has(chave)) porChave.set(chave, item)
  })

  const candidatas = [...porChave.values()]
  const comEntidade = candidatas.filter(item => item.entidade_tipo && item.entidade_id)
  let existentes = []

  if (comEntidade.length) {
    const usuarios = [...new Set(comEntidade.map(item => item.usuario_id))]
    const entidades = [...new Set(comEntidade.map(item => item.entidade_id))]
    const tiposEntidade = [...new Set(comEntidade.map(item => item.entidade_tipo))]
    const tipos = [...new Set(comEntidade.map(item => item.tipo))]

    const { data, error } = await supabase
      .from('notificacoes')
      .select('usuario_id, tipo, entidade_tipo, entidade_id, status')
      .in('usuario_id', usuarios)
      .in('tipo', tipos)
      .in('entidade_tipo', tiposEntidade)
      .in('entidade_id', entidades)
      .neq('status', 'lida')

    if (error) return { data: null, error, inserted: 0, skipped: 0 }
    existentes = data || []
  }

  const chavesExistentes = new Set(existentes.map(item => [
    item.usuario_id,
    item.tipo,
    item.entidade_tipo || '',
    item.entidade_id || '',
  ].join('|')))

  const paraInserir = candidatas.filter(item => {
    if (!item.entidade_tipo || !item.entidade_id) return true
    return !chavesExistentes.has([
      item.usuario_id,
      item.tipo,
      item.entidade_tipo || '',
      item.entidade_id || '',
    ].join('|'))
  })

  if (!paraInserir.length) {
    return { data: [], error: null, inserted: 0, skipped: candidatas.length }
  }

  const { error } = await supabase.from('notificacoes').insert(paraInserir)
  return {
    data: error ? null : [],
    error,
    inserted: error ? 0 : paraInserir.length,
    skipped: candidatas.length - paraInserir.length,
  }
}
