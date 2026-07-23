export const ACTIONS = Object.freeze({
  OBRA_VIEW: 'obra.view',
  OBRA_CREATE: 'obra.create',
  OBRA_EDIT: 'obra.edit',
  OBRA_ARCHIVE: 'obra.archive',
  CRONOGRAMA_EDIT: 'cronograma.edit',
  AGENDA_EDIT: 'agenda.edit',
  FINANCEIRO_VIEW: 'financeiro.view',
  FINANCEIRO_EDIT: 'financeiro.edit',
  EQUIPE_EDIT: 'equipe.edit',
  APROVACAO_EDIT: 'aprovacao.edit',
})

const ROLE_ALIASES = Object.freeze({ vendedor: 'pos_venda' })

const ROLE_PERMISSIONS = Object.freeze({
  gestao: Object.values(ACTIONS),
  supervisor: [
    ACTIONS.OBRA_VIEW,
    ACTIONS.OBRA_EDIT,
    ACTIONS.CRONOGRAMA_EDIT,
    ACTIONS.AGENDA_EDIT,
    ACTIONS.FINANCEIRO_VIEW,
    ACTIONS.FINANCEIRO_EDIT,
    ACTIONS.EQUIPE_EDIT,
    ACTIONS.APROVACAO_EDIT,
  ],
  pos_venda: [ACTIONS.OBRA_VIEW],
  montador: [],
  cliente: [],
})

export function normalizeRole(role) {
  return ROLE_ALIASES[role] || role || 'sem_acesso'
}

export function can(role, action) {
  return Boolean(ROLE_PERMISSIONS[normalizeRole(role)]?.includes(action))
}

export function permissionsFor(role) {
  return new Set(ROLE_PERMISSIONS[normalizeRole(role)] || [])
}
