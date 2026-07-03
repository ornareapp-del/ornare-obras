# Offline simples para montador

## Objetivo

O painel do montador detecta queda de conexao, mostra aviso discreto e evita que a intencao de acoes criticas seja perdida. Esta fase nao cria sincronizacao automatica complexa.

## Comportamento implementado

- Quando offline, o painel mostra uma faixa fixa informando que acoes criticas precisam ser refeitas ao voltar a internet.
- Check-in e check-out offline ficam registrados como lembretes locais no aparelho.
- Alteracoes de checklist offline ficam registradas como lembretes locais.
- Novo item de checklist offline fica registrado como lembrete local.
- Tentativa de envio de foto offline guarda os metadados preenchidos, mas o arquivo precisa ser selecionado novamente quando a conexao voltar.
- Quando a conexao volta, uma faixa informa quantas acoes locais existem e permite limpar os lembretes depois de refazer as operacoes.

## Armazenamento local

Os lembretes usam `localStorage` na chave:

```text
ornare_montador_acoes_offline
```

Cada registro guarda apenas contexto operacional basico, como tipo da acao, obra, checklist, categoria de foto, horario local e identificadores. Nao ha senha, token, conteudo de arquivo ou sincronizacao automatica.

## Limites assumidos

- Check-in/check-out continuam exigindo internet para gravar no Supabase.
- Fotos nao sao armazenadas em cache local, porque guardar arquivos grandes com seguranca exigiria fluxo de sincronizacao maior.
- O montador deve refazer a acao quando voltar online e limpar os lembretes locais apos conferir.

## Arquivos alterados

- `src/pages/montador/MontadorDashboard.jsx`
- `docs/offline-montador.md`
