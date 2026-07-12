# Checklist final de produção

## Status da auditoria

- [x] `git status --short` executado antes da auditoria.
- [x] `git diff` executado antes da auditoria.
- [x] Fonte operacional validada como `obra_cronograma`.
- [x] Dashboard Gestão, Obras, Obras ao Vivo e Portal Cliente conferidos contra `resolverOperacaoObra`.
- [x] Dashboard Supervisor alinhado ao `obra_cronograma` para fase, progresso, previsão, risco e travas.
- [x] Portal Cliente conferido para exibir apenas cronograma, agenda, fotos, checklist, mensagens, comunicados, contatos e documentos liberados.
- [x] Selects do Portal Cliente conferidos com fallback compatível quando tabelas/colunas opcionais ainda não existem.
- [x] SQLs `docs/supabase-*.sql` revisados como pacote de compatibilidade antes de produção.

## SQLs para rodar no Supabase

Rodar em ambiente de homologação primeiro e depois em produção, nesta ordem:

1. `docs/supabase-compat-obras-fase-atual.sql`
2. `docs/supabase-normalizar-fases-cronograma.sql`
3. `docs/supabase-agenda-planejamento-compat.sql`
4. `docs/supabase-fotos-aprovacao-recusa.sql`
5. `docs/supabase-financeiro-operacional.sql`
6. `docs/supabase-montador-agenda-status-rpc.sql`
7. `docs/supabase-portal-cliente-rls.sql`

## Validação funcional obrigatória

- [ ] Criar ou escolher uma obra com registro em `obra_cronograma`.
- [ ] Confirmar que Dashboard Gestão, Central de Obras, Obras ao Vivo, Detalhe da Obra, Planejamento e Dashboard Supervisor mostram a mesma fase, progresso e previsão.
- [ ] Confirmar que o Portal Cliente só mostra cronograma quando `obra_cronograma.visivel_cliente = true`.
- [ ] Confirmar que fotos do cliente exigem `aprovada = true`, `aprovada_gestao = true` e `visivel_cliente = true`.
- [ ] Confirmar que agenda do cliente exige `visivel_cliente = true` e `reuniao_interna = false`.
- [ ] Confirmar que checklist do cliente exige item concluído e `visivel_cliente = true`.
- [ ] Confirmar que gastos recusados não entram no realizado financeiro.
- [ ] Confirmar que gastos pendentes aparecem para aprovação e não entram no realizado.
- [ ] Confirmar que montador vê apenas agenda operacional liberada para montador.

## Validação técnica

- [ ] `npm.cmd run lint`
- [ ] `git diff --check`
- [ ] `npm.cmd run build`
- [ ] Se o build falhar por `EPERM` em `node_modules/.vite-temp`, repetir o build com permissão elevada.

## Go/no-go

- [ ] RLS do Portal Cliente aplicada e testada com usuário `cliente`.
- [ ] Usuário cliente sem vínculo com a obra não acessa `/cliente/:id`.
- [ ] Storage de fotos/comprovantes testado em upload e visualização.
- [ ] Backup ou export do schema feito antes de rodar os SQLs em produção.
- [ ] Smoke test mobile feito em Gestão, Portal Cliente e Montador.
