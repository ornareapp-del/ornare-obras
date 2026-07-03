# Relatorios PDF

## Tipos disponiveis

- Cliente: visao publica da obra, sem gastos, sem historico interno, sem ocorrencias internas e sem dados de equipe. Usa somente agenda, checklist e fotos marcados como visiveis/liberados ao cliente.
- Operacional: visao de execucao da obra, com equipe, cronograma, checklist por ambiente, agenda, fotos/evidencias, ocorrencias, historico e resumo de gastos.
- Executivo: resumo gerencial com progresso, risco, prazos, ocorrencias relevantes e financeiro consolidado.
- Financeiro interno: relatorio reservado para gestao com totais aprovados, pendentes, recusados, uso de meta, categorias e lancamentos internos.

## Privacidade do cliente

O relatorio do cliente nao renderiza dados financeiros, ocorrencias internas, historico operacional, montadores, supervisor, prioridade, risco, motivo de trava ou acao recomendada interna. Fotos e checklist entram apenas quando estiverem aprovados/concluidos e marcados como visiveis para cliente/publico.

## Imagens

As fotos entram como referencia textual/URL publica. Se o arquivo estiver sem `storage_path`, sem URL publica ou se a resolucao da URL falhar, o PDF continua sendo gerado e mostra uma mensagem de imagem indisponivel. A exportacao nao deve ser bloqueada por falha isolada de imagem.

## Feedback de exportacao

Em `ObraDetalhe.jsx`, a exportacao mostra:

- inicio do processamento com o tipo selecionado;
- sucesso com nome do arquivo;
- aviso quando o PDF saiu com dados auxiliares parciais;
- erro visivel quando a geracao falha.

## Arquivos alterados

- `src/services/pdfService.js`
- `src/pages/gestao/ObraDetalhe.jsx`
- `docs/relatorios-pdf.md`
