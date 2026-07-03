# Convite de cliente

## Objetivo

Permitir criar, vincular e reenviar acesso de clientes ao portal sem expor dados internos e sem aplicar SQL automaticamente.

## Fluxo implementado

- A tela `Equipe` permite perfil `Cliente`.
- Cliente precisa ter `obra_id` vinculado antes de salvar ou receber acesso.
- Ao criar cliente:
  - Nome, e-mail, perfil e obra sao obrigatorios.
  - Senha inicial e opcional para cliente.
  - Se a senha ficar vazia, o app gera uma senha temporaria interna apenas para criar o usuario no Supabase Auth.
  - Depois de gravar o perfil com `role = cliente` e `obra_id`, o app envia um magic link para o e-mail cadastrado.
- Ao listar clientes:
  - O card mostra quantas obras estao vinculadas.
  - Clientes possuem acao `Reenviar acesso`.
- Ao editar cliente:
  - A obra vinculada continua editavel.
  - A acao de senha envia link de acesso ao portal quando o perfil e cliente.
- Para equipe interna:
  - O fluxo de senha inicial e redefinicao de senha continua disponivel.

## Login

- O login tradicional continua usando e-mail e senha.
- Foi adicionada a opcao `Sou cliente / receber link`.
- O cliente informa o e-mail cadastrado e recebe link de acesso por `supabase.auth.signInWithOtp`.
- O magic link usa `shouldCreateUser: false`, portanto nao cria cliente sem cadastro previo.

## Configuracao necessaria no Supabase

No painel do Supabase Auth, confirme que os redirects abaixo estao liberados:

- `https://SEU_DOMINIO/login`
- `http://localhost:5173/login` para desenvolvimento local, se usado.

## Observacoes de seguranca

- Cliente sem `obra_id` nao recebe acesso pela tela de equipe.
- O roteamento do app continua levando cliente apenas para `/cliente/:obra_id`.
- A protecao definitiva depende das policies RLS ja previstas para o portal do cliente.
- O app nao aplica SQL e nao altera configuracoes de Auth automaticamente.

## Limites conhecidos

- `signUp` pelo client ainda depende das regras do Supabase Auth do projeto.
- Em producao, o fluxo ideal de convite administrativo seria uma Edge Function ou backend com service role para `inviteUserByEmail`; esta fase manteve a solucao sem nova infraestrutura.
