import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocalQueue } from '../src/services/offlineQueue.js'

test('fila local é inofensiva fora do navegador', () => {
  const queue = createLocalQueue('teste')
  assert.deepEqual(queue.read(), [])
  assert.deepEqual(queue.clear(), [])
})
