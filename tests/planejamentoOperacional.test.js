import test from 'node:test'
import assert from 'node:assert/strict'
import {
  diasOperacionaisEntre,
  intervaloSobrepoe,
  metricasPeriodos,
  validarEncerramento,
} from '../src/utils/planejamentoOperacional.js'

test('intervalos consideram conflito nas bordas', () => {
  assert.equal(intervaloSobrepoe('2026-07-01', '2026-07-03', '2026-07-03', '2026-07-05'), true)
  assert.equal(intervaloSobrepoe('2026-07-01', '2026-07-02', '2026-07-03', '2026-07-05'), false)
})

test('dias operacionais ignoram fim de semana e aceitam exceções', () => {
  assert.deepEqual(
    diasOperacionaisEntre('2026-07-03', '2026-07-06'),
    ['2026-07-03', '2026-07-06'],
  )
  assert.deepEqual(
    diasOperacionaisEntre('2026-07-03', '2026-07-06', [{ data: '2026-07-04', dia_util: true }]),
    ['2026-07-03', '2026-07-04', '2026-07-06'],
  )
})

test('progresso dos períodos é ponderado pela duração', () => {
  const resultado = metricasPeriodos([
    { data: '2026-07-20', data_fim: '2026-07-21', percentual_concluido: 100 },
    { data: '2026-07-22', data_fim: '2026-07-24', percentual_concluido: 0 },
  ])
  assert.deepEqual(resultado, { dias: 5, percentual: 40 })
})

test('encerramento bloqueia pendências operacionais', () => {
  const bloqueado = validarEncerramento({
    checklist: [{ concluido: false }],
    fotos: [],
    ocorrencias: [{ status: 'aberta' }],
    checkins: [{ entrada: '2026-07-23T08:00:00Z', saida: null }],
    retornoNecessario: true,
  })
  assert.equal(bloqueado.podeEncerrar, false)
  assert.equal(bloqueado.pendencias.length, 5)

  const liberado = validarEncerramento({
    checklist: [{ concluido: true }],
    fotos: [{ id: 'foto-1' }],
    ocorrencias: [{ status: 'resolvida' }],
    checkins: [{ entrada: '2026-07-23T08:00:00Z', saida: '2026-07-23T17:00:00Z' }],
  })
  assert.deepEqual(liberado, { podeEncerrar: true, pendencias: [] })
})
