# Checklist — Planejamento operacional avançado

## Banco

- [ ] Aplicar `docs/supabase-periodos-execucao.sql` no Supabase SQL Editor.
- [ ] Confirmar as tabelas `agenda_periodo_montadores`, `agenda_periodo_dependencias`, `agenda_reagendamentos` e `calendario_operacional`.

## Cronograma da obra

- [ ] Aplicar um modelo de execução e confirmar a criação de todos os períodos.
- [ ] Selecionar líder e dois montadores em um período.
- [ ] Criar uma dependência pendente e confirmar que o período não pode ser iniciado.
- [ ] Marcar a dependência como concluída e iniciar o período.
- [ ] Cadastrar uma pausa e conferir o motivo na edição.
- [ ] Alterar datas e testar reagendamento somente do período e em cascata.
- [ ] Confirmar próxima mobilização, retorno necessário, pausas, equipe ausente e bloqueios.

## Capacidade

- [ ] Abrir Planejamento > Capacidade das Equipes.
- [ ] Confirmar montadores nas linhas e dias nas colunas.
- [ ] Criar sobreposição e confirmar destaque vermelho.
- [ ] Arrastar um bloco para outro dia e conferir o histórico em `agenda_reagendamentos`.
- [ ] Cadastrar feriado e plantão no calendário operacional.

## Execução real

- [ ] Fazer check-in e confirmar status “Em andamento” e data inicial real.
- [ ] Fazer check-out e confirmar horas realizadas e sugestão de encerramento.
- [ ] Tentar encerrar com checklist, foto, ocorrência ou check-out pendente.
- [ ] Resolver as pendências e confirmar encerramento controlado.
- [ ] Conferir progresso consolidado e dias úteis no cronograma da obra.
