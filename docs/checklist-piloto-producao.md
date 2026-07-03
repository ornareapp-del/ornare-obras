# Checklist piloto pos-RLS

## Objetivo

Rodar um piloto controlado depois da aplicacao das policies RLS, validando acesso de cliente, montador e gestao antes de liberar clientes reais.

Este documento nao aplica SQL nem substitui teste manual em ambiente real. Ele registra o roteiro de validacao e os pontos conferidos no frontend.

## Pre-requisitos

- RLS do portal cliente aplicada no Supabase conforme `docs/supabase-portal-cliente-rls.sql`.
- Redirect de Auth liberado para `/login`.
- Usuario de gestao ativo.
- Usuario montador ativo.
- Cliente criado em `Equipe` com `role = cliente` e `obra_id` preenchido.
- Obra piloto com pelo menos um ambiente, checklist e agenda operacional.

## Conferencia feita no codigo

- `src/App.jsx`
  - Cliente autenticado redireciona para `/cliente/{profiles.obra_id}`.
  - `ClienteRoute` bloqueia usuario sem `role = cliente`.
  - `ClienteRoute` bloqueia cliente tentando abrir obra diferente de `profiles.obra_id`.
  - Cliente nao entra no layout privado da gestao.

- `src/pages/cliente/PortalCliente.jsx`
  - Portal carrega somente a obra do parametro validado contra `profile.obra_id`.
  - Nao ha consulta de `gastos` no portal do cliente.
  - Nao ha consulta/listagem de `ocorrencias` no portal do cliente.
  - Fotos exigem `aprovada = true`, `aprovada_gestao = true` e `visivel_cliente = true`.
  - Checklist exige `concluido = true` e `visivel_cliente = true`.
  - Agenda exige `visivel_cliente = true` e `reuniao_interna = false`.

- `src/pages/montador/MontadorDashboard.jsx`
  - Foto enviada pelo montador nasce como `aprovada = false`, `aprovada_gestao = false`, `visivel_cliente = false` e `visibilidade = interna`.
  - Check-in/check-out seguem no painel do montador.

- `src/pages/gestao/ObraDetalhe.jsx`
  - Gestao aprova foto antes de liberar ao cliente.
  - Botao de visibilidade do cliente fica bloqueado quando a foto ainda nao esta aprovada.
  - Checklist so pode ser liberado ao cliente quando estiver concluido.

## Roteiro do piloto

### 1. Cliente loga

- Criar ou revisar cliente em `Equipe`.
- Confirmar que o cliente possui `obra_id`.
- Enviar ou reenviar acesso ao cliente.
- Em janela anonima, abrir `/login`.
- Entrar com magic link ou senha.
- Resultado esperado: app abre `/cliente/{obra_id}`.

### 2. Cliente ve so a obra dele

- Com cliente logado, abrir a URL direta `/cliente/{obra_id}`.
- Trocar manualmente a URL para outro ID de obra.
- Resultado esperado: acesso nao autorizado para obra diferente.

### 3. Cliente nao ve dados internos

- Na obra piloto, cadastrar ou confirmar:
  - gasto interno;
  - ocorrencia interna;
  - foto nao aprovada;
  - foto aprovada mas nao visivel ao cliente;
  - checklist concluido mas nao visivel ao cliente;
  - agenda marcada como reuniao interna.
- Resultado esperado no portal: esses itens nao aparecem.

### 4. Montador faz check-in

- Entrar como montador.
- Abrir obra vinculada.
- Fazer check-in.
- Resultado esperado: check-in registrado no painel do montador e visivel para gestao/supervisao, sem aparecer no portal do cliente como dado interno.

### 5. Montador envia foto

- Ainda como montador, selecionar foto com categoria e enviar.
- Resultado esperado: foto aparece para gestao como pendente/interna.
- Resultado esperado no portal do cliente: foto ainda nao aparece.

### 6. Gestao libera

- Entrar como gestao.
- Abrir obra piloto em `ObraDetalhe`.
- Na aba `Fotos`, aprovar a foto.
- Depois liberar visibilidade para cliente.
- Resultado esperado: foto fica aprovada e marcada como cliente.

### 7. Cliente ve liberado

- Voltar para o cliente.
- Recarregar portal.
- Resultado esperado: foto liberada aparece na aba `Fotos`.
- Repetir com checklist concluido e liberado.

## Registro do piloto

Preencher durante o teste manual:

| Item | Responsavel | Resultado | Observacao |
| --- | --- | --- | --- |
| Cliente loga |  | Pendente |  |
| Cliente ve so obra vinculada |  | Pendente |  |
| Cliente nao ve gastos |  | Pendente |  |
| Cliente nao ve ocorrencias internas |  | Pendente |  |
| Cliente nao ve fotos internas |  | Pendente |  |
| Montador faz check-in |  | Pendente |  |
| Montador envia foto |  | Pendente |  |
| Gestao aprova/libera foto |  | Pendente |  |
| Cliente ve foto liberada |  | Pendente |  |
| Checklist liberado aparece ao cliente |  | Pendente |  |

## Criterio de aprovacao

O piloto pode seguir para cliente real somente se:

- Cliente nao conseguir abrir outra obra.
- Portal nao exibir gastos, ocorrencias internas ou fotos internas.
- Fotos e checklist aparecerem apenas depois de aprovados/liberados.
- Montador conseguir fazer check-in e enviar foto sem erro.
- Gestao conseguir liberar conteudo ao cliente sem expor dados internos.

## Pendencias aceitaveis antes de cliente real

- Ajustes visuais menores.
- Texto de status publico mais claro.
- Complemento de documentos/comunicados publicos.

## Bloqueadores

- Cliente ver obra errada.
- Cliente ver gastos.
- Cliente ver ocorrencias internas.
- Cliente ver foto nao aprovada.
- Falha de login ou convite.
- Falha de check-in/check-out do montador.
- Erro de RLS impedindo gestao ou montador de operar a obra piloto.
