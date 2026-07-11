# Checklist piloto financeiro operacional

## SQL necessário

1. Aplicar `docs/supabase-financeiro-operacional.sql` no Supabase SQL Editor.
2. Confirmar que a tabela `gastos` tem: `obra_id`, `responsavel_id`, `criado_por`, `descricao`, `categoria`, `valor`, `data`, `observacao`, `status`, `comprovante`, `storage_path`, `created_at`, `updated_at`.
3. Confirmar que o bucket `fotos-obras` existe e aceita objetos em `gastos/%`.
4. Confirmar RLS para gestão/supervisor ver e aprovar, montador/responsável lançar e acompanhar os próprios gastos.

## Como lançar gasto normal

1. Acessar Gestão > Gastos ou Obra Detalhe > Gastos.
2. Clicar em `Lançar Gasto`.
3. Escolher obra, categoria, responsável, descrição, valor e data.
4. Usar categoria abaixo do limite ou fora das categorias que exigem aprovação.
5. Salvar e validar status `Aprovado`.

## Como lançar gasto que exige aprovação

1. Lançar gasto em `Terceiros`, `Hospedagem` ou `Frete`.
2. Informar valor acima de R$ 500,00.
3. Salvar e validar status `Pendente`.
4. Validar que aparece em Gestão > Dashboard no bloco de aprovações e em Gestão > Gastos.

## Como anexar comprovante

1. No lançamento, selecionar foto ou PDF em `Comprovante`.
2. Salvar o gasto.
3. Abrir o link `Abrir comprovante` na tabela/lista.
4. Confirmar que a URL pública vem do bucket `fotos-obras` e caminho `gastos/`.

## Como aprovar

1. Entrar como gestão ou supervisor da obra.
2. Abrir Gestão > Gastos ou Dashboard > Gastos pendentes.
3. Clicar em `Aprovar / recusar` ou `Aprovar`.
4. Informar observação se necessário e confirmar.
5. Validar status `Aprovado` e soma no realizado financeiro da obra.

## Como recusar

1. Entrar como gestão ou supervisor da obra.
2. Abrir o gasto pendente.
3. Clicar em `Recusar`.
4. Informar motivo obrigatório.
5. Validar status `Recusado` e motivo visível no gasto.

## Como validar notificação

1. Lançar gasto pendente com responsável diferente do aprovador.
2. Aprovar ou recusar.
3. Entrar com o responsável.
4. Confirmar notificação `Gasto aprovado` ou `Gasto recusado`.
5. Abrir a notificação e validar rota para `Obra Detalhe > Gastos`.

## Como validar em Dashboard e Obra Detalhe

1. Dashboard Gestão: confirmar contagem em `Gastos pendentes`.
2. Dashboard Gestão: clicar no item pendente e validar navegação para a obra/gasto.
3. Obra Detalhe: abrir aba `Gastos`.
4. Validar cards de total, meta, utilizado e pendentes.
5. Validar status claro por item: `Aprovado`, `Pendente`, `Recusado`.
6. Confirmar que gastos recusados não entram no total realizado e exibem motivo.
