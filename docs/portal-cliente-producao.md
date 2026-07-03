# Portal Cliente em producao

Este guia ativa o Portal Cliente com login e senha pelo Supabase Auth. O cliente acessa o sistema, faz login e e redirecionado automaticamente para a obra vinculada em `profiles.obra_id`.

## 1. Aplicar o SQL no Supabase

1. Acesse o painel do Supabase do projeto.
2. Abra `SQL Editor`.
3. Crie uma nova query.
4. Cole todo o conteudo de `docs/supabase-portal-cliente-rls.sql`.
5. Clique em `Run`.
6. Se alguma tabela opcional nao existir no seu banco, ajuste/remova apenas o bloco daquela tabela e rode novamente.

O SQL cria a coluna `profiles.obra_id`, adiciona colunas de visibilidade quando faltarem e ativa RLS nas tabelas usadas pelo portal.

## 2. Criar cliente em Equipe

1. Entre no Ornare Obras com um usuario de gestao.
2. Abra `Equipe`.
3. Clique em `Novo Usuario`.
4. Preencha nome, e-mail e senha inicial.
5. Em `Perfil`, escolha `Cliente`.
6. Em `Obra vinculada`, selecione a obra correta.
7. Clique em `Criar Usuario`.

O sistema grava o usuario no Supabase Auth e salva `profiles.role = 'cliente'` com `profiles.obra_id` apontando para a obra selecionada.

## 3. Editar ou vincular cliente existente

1. Abra `Equipe`.
2. Filtre ou localize o usuario.
3. Clique em `Editar`.
4. Defina `Perfil = Cliente`.
5. Selecione a `Obra vinculada`.
6. Salve.

Cliente sem obra vinculada nao acessa o portal. Cliente tentando abrir outra obra recebe acesso nao autorizado.

## 4. Link para enviar ao cliente

Envie o link principal do sistema:

```text
https://SEU-DOMINIO/login
```

Depois do login, o app redireciona automaticamente para:

```text
https://SEU-DOMINIO/cliente/{profiles.obra_id}
```

Se quiser enviar o link direto da obra, tambem funciona:

```text
https://SEU-DOMINIO/cliente/ID-DA-OBRA
```

O cliente ainda precisa estar autenticado e o `ID-DA-OBRA` precisa ser igual ao `profiles.obra_id`.

## 5. Trocar senha

1. Abra `Equipe`.
2. Edite o usuario cliente.
3. Clique em `Enviar redefinicao de senha`.
4. O Supabase envia o e-mail de reset para o cliente.

Tambem e possivel trocar pelo painel do Supabase em `Authentication > Users`, selecionando o usuario e usando as acoes de senha conforme sua configuracao do Auth.

## 6. Conteudo que o cliente pode ver

O portal renderiza somente dados liberados para a obra vinculada:

- Obra vinculada ao proprio `profiles.obra_id`.
- Fotos com `aprovada = true`, `aprovada_gestao = true` e `visivel_cliente = true`.
- Checklist com `concluido = true` e `visivel_cliente = true`.
- Agenda com `visivel_cliente = true` e `reuniao_interna = false`.
- Comunicados, contatos, documentos e mensagens liberadas pela policy da obra.

O cliente nao deve ver:

- Gastos.
- Ocorrencias internas.
- Fotos nao aprovadas pela gestao.
- Checklist nao concluido ou nao liberado.
- Reunioes internas.
- Obras de outros clientes.

## 7. Teste antes de enviar para cliente real

1. Crie uma obra de teste.
2. Crie um usuario cliente em `Equipe` e vincule essa obra.
3. Entre em uma janela anonima.
4. Acesse `/login` e faca login com o usuario cliente.
5. Confirme que o app abre `/cliente/{obra_id}` automaticamente.
6. Tente trocar a URL para outra obra: deve aparecer acesso nao autorizado.
7. Cadastre fotos sem aprovacao ou sem `visivel_cliente`: nao devem aparecer.
8. Aprove a foto e marque `visivel_cliente`: deve aparecer.
9. Crie checklist nao concluido ou nao visivel: nao deve aparecer.
10. Conclua e libere o checklist: deve aparecer.
11. Crie agenda interna: nao deve aparecer.
12. Crie agenda visivel ao cliente e nao interna: deve aparecer.
13. Cadastre gasto e ocorrencia interna: nao devem aparecer para o cliente.

## 8. Observacao importante

O frontend ajuda a navegar corretamente, mas a seguranca real fica no Supabase RLS. Nao envie acesso ao cliente antes de aplicar o SQL e testar com um usuario cliente real.
