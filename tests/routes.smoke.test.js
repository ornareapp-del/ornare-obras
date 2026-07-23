import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const APP_SOURCE = new URL('../src/App.jsx', import.meta.url)

test('rotas essenciais dos quatro perfis permanecem registradas', async () => {
  const source = await readFile(APP_SOURCE, 'utf8')
  for (const route of ['/dashboard', '/supervisor', '/montador', '/cliente/:id', '/obras', '/agenda', '/pendencias']) {
    assert.match(source, new RegExp(`path=["']${route.replace('/', '\\/')}["']`))
  }
})

test('criação de obra permanece exclusiva da gestão na rota', async () => {
  const source = await readFile(APP_SOURCE, 'utf8')
  const routeStart = source.indexOf('path="/obras/nova"')
  assert.notEqual(routeStart, -1)
  const routeBlock = source.slice(routeStart, routeStart + 220)
  assert.match(routeBlock, /allowedRoles=\{\['gestao'\]\}/)
})
