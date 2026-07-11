# Checklist piloto - Portal Cliente

## 1. Preparacao do banco

- Confirmar que o ambiente de producao esta no projeto Supabase correto.
- Fazer backup ou snapshot antes de aplicar scripts de compatibilidade/RLS.
- Validar que `profiles` possui o usuario gestor que executara o piloto.
- Confirmar que o cliente acessara pelo login normal do app, nao por link publico anonimo.

## 2. SQLs obrigatorios

Execute nesta ordem no Supabase SQL Editor:

1. `docs/supabase-compat-obras-fase-atual.sql`
2. `docs/supabase-portal-cliente-rls.sql`

Depois execute o bloco `Diagnostico de acesso do Portal Cliente` no fim de `docs/supabase-portal-cliente-rls.sql`, trocando:

- `cliente@email.com` pelo e-mail real do cliente.
- `00000000-0000-0000-0000-000000000000` pelo `id` real da obra piloto.

Resultado esperado:

- `profile`: `OK`, com `role = cliente`, `ativo = true` e `obra_id` correto.
- `obra`: retorna a obra piloto.
- `cronograma_visivel`: ao menos uma linha `OK` quando o cronograma for liberado.
- `fotos_liberadas`, `agenda_liberada` e `checklist_liberado`: contagens coerentes com o que foi liberado.

## 3. Dados minimos para uma obra piloto

- Obra em `public.obras` com `id`, `nome`, `cliente_nome`, `cidade`, `uf`, `supervisor_id` e, se aplicavel, `comercial_id`.
- Um registro em `public.obra_cronograma` para a obra, com `fase`, `percentual_concluido`, `data_fim_prevista` e `visivel_cliente`.
- Um profile de cliente em `public.profiles` com `role = cliente`, `ativo = true`, `email` preenchido e `obra_id` da obra piloto.
- Pelo menos uma foto aprovada, um compromisso de agenda, um item de checklist concluido e um comunicado/contato opcional para validar todas as abas.

## 4. Como liberar conteudo

Cronograma:

- Abra Gestao > Obras > Obra Detalhe > Cronograma.
- Preencha fase, percentual e previsao.
- Marque `Visivel ao cliente`.
- Salve e confirme se Dashboard, Obras, Obras ao Vivo e Obra Detalhe mostram a mesma fase/progresso/previsao.

Fotos:

- Envie ou selecione uma foto da obra.
- Aprove a foto pela gestao, garantindo `aprovada = true` e `aprovada_gestao = true`.
- Clique para liberar ao cliente.
- Fotos recusadas, pendentes ou nao liberadas nao devem aparecer no portal.

Checklist:

- Conclua o item.
- Libere ao cliente.
- Itens pendentes ou internos nao devem aparecer no portal.

Agenda:

- Crie um compromisso vinculado a obra.
- Nao marque como reuniao interna.
- Libere ao cliente.
- Reunioes internas devem permanecer bloqueadas para liberacao.

Mensagens, comunicados, contatos e documentos:

- Comunicados, contatos e documentos precisam estar vinculados a obra e marcados com `visivel_cliente = true`, `visibilidade = cliente/publica` ou `publico_cliente = true`.
- Mensagens enviadas pelo cliente devem aparecer para a gestao como `tipo = cliente`.
- Solicitacoes de reagendamento devem aparecer como `tipo = reagendamento`.

## 5. Como testar como gestor

- Em Equipe, crie ou edite o usuario do cliente.
- Confirme `role = cliente`, `ativo = true` e obra vinculada.
- Reenvie o acesso se necessario.
- Em Obra Detalhe, valide as abas Cronograma, Agenda, Fotos, Checklist e Cliente.
- No Dashboard Gestao, Obras e Obras ao Vivo, confira se fase, progresso, proxima fase e previsao batem com `obra_cronograma`.
- Confirme que gastos, ocorrencias internas, alertas internos, trava, motivo de trava e observacoes internas nao foram liberados ao cliente.

## 6. Como testar como cliente

- Acesse em aba anonima pela URL de producao.
- Faça login com o e-mail do cliente ou magic link recebido.
- A URL esperada e `/cliente/{obra_id}`.
- Valide as abas Obra, Etapas, Agenda, Fotos, Mensagens, Contatos e Docs.
- Confirme presenca em um compromisso liberado.
- Solicite reagendamento com uma mensagem curta.
- Envie uma mensagem pela aba Mensagens.
- Verifique que somente cronograma visivel, fotos aprovadas/liberadas, checklist concluido/liberado e agenda nao interna aparecem.

## 7. Problemas esperados e diagnostico

- "Acesso nao autorizado": conferir `profiles.role`, `profiles.ativo`, `profiles.obra_id` e se a URL usa o mesmo `obra_id`.
- Portal vazio: rodar o diagnostico do SQL de RLS e conferir flags `visivel_cliente`, `visibilidade` e `publico_cliente`.
- Cronograma divergente da gestao: conferir `public.obra_cronograma`; esta e a fonte operacional correta.
- Foto nao aparece: confirmar `aprovada = true`, `aprovada_gestao = true` e `visivel_cliente = true`.
- Agenda nao aparece: confirmar `visivel_cliente = true` e `reuniao_interna = false`.
- Checklist nao aparece: confirmar `concluido = true` e `visivel_cliente = true`.
- Erro de coluna ou schema cache: reaplicar `docs/supabase-compat-obras-fase-atual.sql`, aguardar o cache do PostgREST atualizar e repetir o teste.
- Cliente nao consegue enviar mensagem: conferir RLS de `mensagens`, `remetente_id = auth.uid()` e `tipo in ('cliente', 'reagendamento')`.
