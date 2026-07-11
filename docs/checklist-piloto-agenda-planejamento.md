# Checklist piloto: Agenda + Planejamento

## SQL necessário

1. Aplicar `docs/supabase-portal-cliente-rls.sql` se o ambiente ainda não tiver as funções `ornare_*` e policies do Portal Cliente.
2. Aplicar `docs/supabase-agenda-planejamento-compat.sql`.
3. No diagnóstico final do SQL, trocar o UUID da obra piloto e validar:
   - evento interno aparece como `BLOQUEADO_INTERNO`;
   - evento não liberado aparece como `BLOQUEADO_NAO_LIBERADO`;
   - evento liberado ao cliente aparece como `VISIVEL_CLIENTE`.

## Criar evento interno

1. Entrar em Gestão > Agenda.
2. Criar novo evento com tipo `Reunião Interna` ou marcar `Reunião interna`.
3. Confirmar que `Obra vinculada`, `Visível para montador` e `Visível para cliente` ficam desabilitados/ocultos conforme aplicável.
4. Salvar e validar que o evento aparece para Gestão, mas não aparece no Portal Cliente.

## Criar evento visível ao cliente

1. Entrar em Gestão > Agenda.
2. Criar evento com obra vinculada, data, horário, responsável e tipo operacional.
3. Marcar `Visível para cliente`.
4. Preencher `Descrição para o cliente` com texto claro e sem informação interna.
5. Salvar e validar no diagnóstico SQL que `visivel_cliente = true` e `reuniao_interna = false`.

## Confirmar presença como cliente

1. Entrar no Portal Cliente da obra piloto.
2. Abrir a aba `Agenda`.
3. Clicar em `Confirmar presença`.
4. Validar que o status muda para `Confirmado`.
5. No SQL, conferir `confirmado_cliente = true` e, quando a compatibilidade estiver aplicada, `confirmado_cliente_em` preenchido.

## Solicitar reagendamento

1. No Portal Cliente, abrir `Agenda`.
2. Clicar em `Solicitar reagendamento`.
3. Informar motivo ou sugestão de nova data.
4. Validar que a solicitação aparece em mensagens do cliente e que a agenda recebe `solicitacao_reagendamento_cliente`.
5. A Gestão deve reagendar manualmente na Agenda, mantendo ou atualizando a descrição liberada ao cliente.

## Validar no Dashboard Gestão

1. Abrir Dashboard Gestão.
2. Validar `Agenda hoje` e `Cliente sem confirmação` no card `Foco do período`.
3. Validar que eventos atrasados, de hoje e com cliente pendente sobem na lista de prioridade.
4. Usar o botão `Agenda` para abrir a central e conferir filtros por período, obra, responsável, tipo, status e busca.

## Validar no Portal Cliente

1. Confirmar que só aparecem eventos com `visivel_cliente = true` e `reuniao_interna = false`.
2. Confirmar que a descrição exibida vem de `descricao_cliente` ou `observacao_publica`.
3. Validar confirmação de presença e solicitação de reagendamento.
4. Confirmar que reuniões internas e eventos não liberados não aparecem.

## Validar no Supervisor/Montador

1. Supervisor deve ver eventos das obras sob sua responsabilidade.
2. Montador deve ver somente eventos da obra/equipe com `visivel_montador = true` ou legado operacional permitido.
3. Validar que reunião interna não aparece para montador.
4. Validar check-in/check-out do compromisso quando aplicável.

## Critérios de aceite

- `obra_cronograma` segue como fonte operacional da obra.
- Agenda diferencia claramente interno, campo e cliente.
- Portal Cliente nunca exibe reunião interna.
- Planejamento mostra atrasos e cronogramas sem data.
- Obras Ao Vivo aponta o próximo compromisso da obra.
- Gestão consegue filtrar agenda por período, obra, responsável, tipo, status e busca textual.
