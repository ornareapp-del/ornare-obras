# Auditoria de fluxos operacionais

## Gestao

### Ao abrir a Central de Gestao

Ordem esperada de leitura:

1. Exigem atencao agora.
2. Obras ao vivo.
3. Indicadores operacionais.
4. Campo hoje, pendencias por obra, atrasos e metas.
5. Aprovacoes pendentes.
6. Saude, agenda, equipe, fluxo, operacao, financeiro e atividade recente.

### Cliques principais

- `Exigem atencao agora` abre a obra.
- `Obras travadas` abre a obra travada.
- `Pendencias criticas` abre a rota exata da pendencia quando existir, ou a obra.
- `Obras em risco` abre a obra.
- `Fotos para aprovar` abre a aba Fotos da obra.
- `Checklist pendente` abre a aba Checklist da obra.
- `Vistorias pendentes` abre a Agenda no compromisso.
- `Gastos pendentes` abre Gastos da obra ou a tela de Gastos.
- `Cronogramas travados` abre Cronograma da obra.
- `Obras ao vivo` abre a obra e resume status, montador, check-in, inicio, termino, prazo, progresso, proximo compromisso e pendencias.

### Vistoria

Fluxo esperado:

1. Agenda cria compromisso de tipo `Vistoria`.
2. Check-in do compromisso muda `agenda.status` para `em andamento`.
3. Check-out do compromisso muda `agenda.status` para `realizada`.
4. Dashboard nao deve mais contar a vistoria como pendente quando o status for `realizada`, `realizado`, `concluida`, `concluido`, `finalizada` ou `finalizado`.

Se uma vistoria continuar aparecendo como pendente apos check-in/check-out, conferir:

- se o check-out foi feito no compromisso certo da Agenda;
- se o registro de `checkins` ficou vinculado ao `agenda_id`;
- se `agenda.status` foi atualizado para `realizada`;
- se houve erro de permissao/RLS ao atualizar a agenda.

## Supervisor

### Ao abrir a Central do Supervisor

Ordem esperada:

1. Filtro de periodo.
2. KPIs principais da carteira.
3. Indicadores complementares quando abertos.
4. Campo hoje, fotos/checklist, atrasos/metas.
5. Fluxo por status, prioridades e aprovacoes.
6. Agenda da semana, minhas obras, pendencias e atividade.

### Cliques principais

- `Montadores em campo` abre o modal da equipe.
- `Pendencias` abre Tarefas.
- `Travadas` filtra obras travadas.
- `Fotos pendentes` abre Fotos da obra.
- `Sem check-in recente` abre Equipe da obra.
- `Vistorias pendentes` abre Agenda no compromisso.
- Linhas de `Minhas obras` abrem a obra.

## Montador

### Fluxo habitual em campo

1. Montador entra em `/montador`.
2. Seleciona ou usa a obra ativa.
3. Faz check-in.
4. Executa checklist.
5. Envia fotos com categoria, ambiente e compromisso quando aplicavel.
6. Registra ocorrencia se houver problema.
7. Faz check-out.

### Pontos de atencao

- Check-in e check-out da tela do montador registram trabalho na obra.
- Check-in e check-out da Agenda registram compromisso especifico, como vistoria.
- Para uma vistoria sair das pendencias da gestao, o status da Agenda precisa chegar a `realizada`.

## Cliente

### Fluxo esperado

1. Cliente entra apenas em `/cliente/:obraId`.
2. Cliente ve somente dados liberados.
3. Agenda do cliente mostra compromissos visiveis para cliente e nao internos.
4. Fotos precisam estar aprovadas/liberadas.
5. Checklist precisa estar concluido/liberado.

## Conclusao

O fluxo principal esta coerente: gestao e supervisor partem das pendencias, montador executa campo, cliente recebe somente o que foi liberado. O ajuste aplicado nesta auditoria corrige a divergencia em que uma vistoria com status `realizada` ainda podia ser contada como pendente na Central de Gestao.
