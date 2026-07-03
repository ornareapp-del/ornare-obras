# Upload de fotos

## Objetivo

Melhorar o envio de fotos e comprovantes sem adicionar dependencias novas e sem alterar regras de aprovacao, visibilidade ou vinculo com obra.

## Onde foi aplicado

- `src/pages/montador/MontadorDashboard.jsx`
  - Seleciona a foto antes de enviar.
  - Mostra preview, nome e tamanho do arquivo.
  - Envia somente apos o botao `Enviar foto`.
  - Comprime imagens JPEG, PNG e WebP no navegador antes do upload quando a compressao reduz o tamanho.
  - Mantem o fluxo offline simples: se estiver sem conexao, registra o lembrete local e orienta selecionar novamente quando voltar.

- `src/pages/gestao/ObraDetalhe.jsx`
  - Aba `Fotos` ganhou selecao com preview antes do envio.
  - O upload mostra estados de preparacao, compressao, envio, sucesso e erro.
  - Comprovantes de gastos lancados pela aba `Gastos` tambem tentam comprimir imagem antes de anexar.

- `src/pages/gestao/Gastos.jsx`
  - Comprovantes em foto sao preparados com a mesma compressao antes do upload.
  - PDFs continuam sendo enviados sem compressao.
  - O modal mostra nome e tamanho do arquivo selecionado.

- `src/utils/imageUpload.js`
  - Utilitario compartilhado para detectar imagem, formatar tamanho e comprimir usando canvas nativo do browser.

## Comportamento de compressao

- Tenta reduzir JPEG, PNG e WebP para ate 1600-1800 px no maior lado, com qualidade controlada.
- Se a imagem comprimida ficar maior que o arquivo original, o original e usado.
- Se o navegador nao suportar algum passo de canvas/File, o upload segue com o arquivo original.
- PDF e outros arquivos nao-imagem nao sao modificados.

## Estados exibidos

- Selecionado: mostra nome, tamanho e preview.
- Preparando: informa que a imagem esta sendo preparada/comprimida.
- Enviando: informa o envio ao Storage.
- Enviado: confirma vinculo com a obra ou gasto.
- Erro: mostra falha de Storage/Supabase sem apagar a selecao local quando ainda for possivel tentar novamente.

## Limites conhecidos

- Fotos offline nao sao armazenadas como arquivo local por seguranca e tamanho; o montador deve selecionar novamente quando voltar a conexao.
- A compressao remove metadados do arquivo gerado pelo canvas.
- A validacao real de permissao continua dependente das policies do Supabase Storage e das tabelas relacionadas.
