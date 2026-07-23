# Execução da auditoria — 23/07/2026

## Resultado

Primeiro ciclo dos 26 itens concluído no repositório.

## Itens executados

1. Progresso operacional unificado na edição rápida.
2. Edição rápida alinhada ao cronograma.
3. Matriz central de permissões criada.
4. Ações de obra protegidas por perfil.
5. Exclusão de obra substituída por arquivamento/restauração.
6. Estrutura de migrations criada.
7. Governança do schema documentada.
8. RPC transacional para resumo da obra criada.
9. Auditoria operacional de alterações criada.
10. Registro central de erro conectado ao novo fluxo.
11. Testes das regras operacionais implantados.
12. Testes da matriz de permissões implantados.
13. Smoke tests das rotas implantados.
14. Consultas da Central de Obras restringidas a colunas necessárias.
15. Histórico da obra paginado.
16. Índices operacionais preparados.
17. Offline do montador esclarecido e fila local extraída.
18. Central de Pendências criada.
19. Encerramento formal com validações implantado.
20. Decisão de reagendamento criada na Agenda.
21. Evidências obrigatórias de checklist implantadas.
22. Progresso físico, jornada geral e aceite separados.
23. Serviços de obra e encerramento extraídos do Detalhe.
24. Serviço de fila offline extraído do Painel do Montador.
25. Acessibilidade global ampliada.
26. Lint, testes, build e verificação de whitespace aprovados.

## Migrations preparadas

1. `202607230001_core_governance.sql`
2. `202607230002_operacoes_transacionais.sql`
3. `202607230003_auditoria_operacional.sql`
4. `202607230004_indices_operacionais.sql`
5. `202607230005_fluxo_reagendamento.sql`
6. `202607230006_evidencias_checklist.sql`
7. `202607230007_progresso_fisico_aceite.sql`

Aplicar na ordem acima, primeiro em homologação. As migrations não foram executadas em um Supabase remoto nesta tarefa.

## Validação local

- ESLint: aprovado.
- Testes: 11 aprovados.
- Build Vite: aprovado.
- `git diff --check`: aprovado.

## Teste de homologação obrigatório

1. Aplicar as sete migrations.
2. Testar gestão, supervisor, pós-venda, montador e cliente.
3. Confirmar que pós-venda não altera registros pela API.
4. Arquivar e restaurar uma obra de teste.
5. Testar percentual manual e percentual calculado por períodos.
6. Solicitar, aprovar e recusar um reagendamento.
7. Concluir checklist com foto e observação obrigatórias.
8. Validar item como supervisor.
9. Tentar encerrar uma obra com pendências e depois sem pendências.
10. Conferir a Central de Pendências.
