# Refatoracao de arquivos grandes

## Estrategia

A refatoracao deve ser incremental para reduzir risco em telas criticas. A regra de negocio fica no componente atual ate que cada bloco esteja isolado, validado e facil de comparar. Nao houve alteracao de fluxo, schema ou permissao nesta fase.

## Incremento aplicado

### `ObraDetalhe.jsx`

Foi extraido o controle de exportacao de PDF do cabecalho para:

- `src/pages/gestao/components/ObraPdfExportControls.jsx`

O componente concentra apenas a interface de selecao/exportacao de PDF:

- seletor de tipo de relatorio;
- botao de exportacao;
- mensagem de status/erro da exportacao.

O estado, a funcao `gerarPdf`, os toasts e a regra de exportacao continuam em `ObraDetalhe.jsx`, preservando comportamento.

## Arquivos priorizados

- `ObraDetalhe.jsx`: primeiro alvo, por ser o maior arquivo e concentrar muitos fluxos.
- `MontadorDashboard.jsx`: proximo bom alvo para separar abas de fotos, checklist e check-in/check-out.
- `DashboardGestao.jsx`: bom alvo para separar paineis de produtividade, aprovacoes e listas executivas apos estabilizar os indicadores.

## Proximos incrementos recomendados

- Extrair o cabecalho/resumo de `ObraDetalhe.jsx`.
- Extrair abas grandes de `ObraDetalhe.jsx` uma por vez, com props explicitas.
- Separar em `MontadorDashboard.jsx` os blocos de check-in/check-out, fotos e checklist.
- Separar em `DashboardGestao.jsx` os paineis de produtividade e aprovacoes sem mover os calculos do `useMemo` no mesmo passo.

## Validacao esperada

Ao final de cada incremento:

- `npm.cmd run lint`
- `git diff --check`
- `npm.cmd run build`
