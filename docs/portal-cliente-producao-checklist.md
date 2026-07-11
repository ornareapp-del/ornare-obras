# Portal Cliente - Checklist de producao

## SQL obrigatorio

1. Rode `docs/supabase-compat-obras-fase-atual.sql` no Supabase SQL Editor.
2. Rode `docs/supabase-portal-cliente-rls.sql` no Supabase SQL Editor.
3. No bloco `Diagnostico de acesso do Portal Cliente`, troque:
   - `cliente@email.com` pelo e-mail real do cliente.
   - `00000000-0000-0000-0000-000000000000` pelo `id` da obra.
4. Execute o diagnostico e confirme que `profile`, `obra` e `cronograma_visivel` retornam `OK`.

## Criar cliente em Equipe

1. Acesse Gestao > Equipe.
2. Crie um novo usuario com `role = cliente`.
3. Informe o e-mail do cliente.
4. Selecione a obra vinculada antes de salvar.
5. Confirme que o profile ficou com:
   - `role = cliente`
   - `obra_id = id da obra`
   - `ativo = true`

## Vincular cliente a obra

1. Em Gestao > Equipe, edite o usuario do cliente.
2. Selecione a obra correta no campo de obra vinculada.
3. Salve e reenvie o acesso, se necessario.
4. O link esperado e `/cliente/{obra_id}`.

## Liberar conteudo ao cliente

Cronograma:
1. Abra a obra na gestao.
2. Va em Cronograma.
3. Marque `Visivel ao cliente`.

Fotos:
1. Aprove a foto na gestao.
2. Garanta `aprovada = true` e `aprovada_gestao = true`.
3. Marque a foto como visivel ao cliente.

Checklist:
1. Conclua o item.
2. Marque o item como visivel ao cliente.
3. Itens pendentes nao devem aparecer no portal.

Agenda:
1. Crie o compromisso vinculado a obra.
2. Nao marque como reuniao interna.
3. Marque `Visivel para cliente`.

Documentos, contatos e comunicados:
1. Cadastre o item vinculado a obra.
2. Marque `visivel_cliente = true` ou `visibilidade = cliente/publica`.
3. Nao use dados internos em itens liberados.

## Teste em aba anonima

1. Abra uma aba anonima.
2. Acesse a URL de producao.
3. Entre com o e-mail do cliente ou use o magic link enviado.
4. Confirme que a URL redireciona para `/cliente/{obra_id}`.
5. Verifique as abas Obra, Etapas, Agenda, Fotos, Mensagens, Contato e Docs.
6. Confirme que conteudo nao liberado nao aparece.
