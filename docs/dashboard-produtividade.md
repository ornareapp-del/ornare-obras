# Dashboard de produtividade

## Objetivo

Os dashboards de gestao e supervisor passaram a priorizar leitura operacional do dia: equipe em campo, check-ins, pendencias por obra, atrasos, travas e gastos perto da meta. Os cards principais sao acionaveis e levam para a obra, aba ou modulo de apoio mais proximo da decisao.

## Indicadores cobertos

- Montadores em campo hoje: check-ins de hoje sem saida registrada.
- Check-ins hoje: total de entradas registradas no dia.
- Obras sem check-in recente: obras ativas sem check-in ou com ultimo check-in ha mais de 2 dias.
- Fotos pendentes por obra/supervisor: fotos sem aprovacao completa.
- Checklist pendente por obra: itens de checklist ainda nao concluidos.
- Obras atrasadas por fase: obras com previsao vencida agrupadas pela fase Ornare.
- Obras travadas: status de obra pausada/travada e cronogramas travados ou com risco alto.
- Gastos proximos/acima da meta: obras com gasto aprovado a partir de 70% da meta cadastrada.

## Navegacao dos cards

- Fotos pendentes abrem a aba `Fotos` da primeira obra pendente, com o id da foto na URL quando disponivel.
- Checklist pendente abre a aba `Checklist` da obra, com o id do item quando disponivel.
- Sem check-in recente abre a aba `Equipe` da obra.
- Travadas levam ao planejamento ou lista de obras filtrada por status.
- Gastos proximos/acima da meta abrem a aba `Gastos` da obra ou o modulo de gastos.
- Indicadores de equipe no supervisor abrem o modal de montadores alocados.

## Observacoes tecnicas

- A fase nao adiciona tabelas novas nem altera SQL.
- Os calculos usam dados ja carregados nos dashboards: `obras`, `checkins`, `fotos`, `checklist_items`, `gastos`, `obra_cronograma`, `profiles` e `obra_montadores`.
- Gastos considerados na meta usam apenas status aprovado; pendentes continuam aparecendo como aprovacao operacional.
- A regra de check-in recente usa janela simples de 2 dias para sinalizar falta de visita em obra ativa.

## Arquivos alterados

- `src/pages/gestao/DashboardGestao.jsx`
- `src/pages/supervisor/DashboardSupervisor.jsx`
- `docs/dashboard-produtividade.md`
