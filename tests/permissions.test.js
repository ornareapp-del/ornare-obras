import test from 'node:test'
import assert from 'node:assert/strict'
import { ACTIONS, can, normalizeRole } from '../src/constants/permissions.js'

test('gestão possui todas as ações administrativas', () => {
  Object.values(ACTIONS).forEach(action => assert.equal(can('gestao', action), true))
})

test('pós-venda e vendedor ficam em consulta de obra', () => {
  for (const role of ['pos_venda', 'vendedor']) {
    assert.equal(can(role, ACTIONS.OBRA_VIEW), true)
    assert.equal(can(role, ACTIONS.OBRA_EDIT), false)
    assert.equal(can(role, ACTIONS.OBRA_CREATE), false)
    assert.equal(can(role, ACTIONS.OBRA_ARCHIVE), false)
  }
})

test('somente gestão pode arquivar ou criar obras', () => {
  for (const role of ['supervisor', 'pos_venda', 'montador', 'cliente', 'sem_acesso']) {
    assert.equal(can(role, ACTIONS.OBRA_CREATE), false)
    assert.equal(can(role, ACTIONS.OBRA_ARCHIVE), false)
  }
})

test('alias vendedor é normalizado para pós-venda', () => {
  assert.equal(normalizeRole('vendedor'), 'pos_venda')
})
