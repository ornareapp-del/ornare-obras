# Auditoria final de producao

## Escopo

Auditoria final do Ornare Obras PWA apos as fases:

- Dashboard de produtividade.
- Relatorios PDF.
- Refatoracao incremental.
- Logs de erro.
- Offline simples do montador.
- Upload de fotos.
- Convite de cliente.
- Piloto pos-RLS.
- Guias de treinamento.

Nao foi feito commit, deploy ou aplicacao de SQL.

## Validacoes tecnicas

| Validacao | Status | Observacao |
| --- | --- | --- |
| `npm.cmd run lint` | Aprovado | Executado com sucesso. |
| `git diff --check` | Aprovado | Executado sem apontar whitespace errors. |
| `npm.cmd run build` | Aprovado | Primeira execucao bloqueada por `EPERM` no cache temporario do Vite; repetido com permissao elevada e compilado com sucesso. |

## Supabase e RLS

### Conferido

- `App.jsx` redireciona cliente para `/cliente/{profiles.obra_id}`.
- `ClienteRoute` bloqueia:
  - usuario sem login;
  - usuario que nao tem `role = cliente`;
  - cliente sem `obra_id`;
  - cliente tentando abrir obra diferente da obra vinculada.
- `PortalCliente.jsx` nao consulta `gastos`.
- `PortalCliente.jsx` nao lista `ocorrencias` internas.
- Fotos do cliente exigem aprovacao e visibilidade.
- Checklist do cliente exige conclusao e visibilidade.
- Agenda do cliente filtra itens internos.
- Fotos enviadas pelo montador nascem internas por padrao.

### Riscos

- A seguranca definitiva depende das policies RLS no Supabase.
- O frontend reduz risco de navegacao errada, mas nao substitui RLS.
- Fluxo de convite por client-side `signUp`/`signInWithOtp` depende das configuracoes de Auth do projeto.
- Em producao, convites administrativos com service role seriam mais robustos via backend ou Edge Function.

### Antes de cliente real

- Aplicar e revisar `docs/supabase-portal-cliente-rls.sql` manualmente.
- Confirmar redirects do Supabase Auth para `/login`.
- Rodar o roteiro de `docs/checklist-piloto-producao.md`.
- Testar usuario cliente real em janela anonima.

## Botoes e acoes

### Conferido

- Cards de dashboard navegam para rotas/abas operacionais.
- Botao de liberar foto ao cliente fica bloqueado quando foto nao esta aprovada.
- Checklist nao concluido nao deve ser liberado ao cliente.
- Montador tem acoes de check-in, check-out, foto, checklist e ocorrencia.
- Equipe tem reenvio de acesso para cliente.
- Exportacao de PDF tem feedback de processamento.

### Riscos

- Algumas telas antigas ainda usam estilos inline extensos, o que dificulta revisao visual completa.
- A auditoria estatica nao substitui clique manual em todos os botoes no navegador.

### Teste manual recomendado

- Abrir dashboard gestao e clicar todos os cards.
- Abrir dashboard supervisor e clicar todos os cards.
- Abrir `ObraDetalhe` e testar abas: Fotos, Checklist, Gastos, Cronograma, Ocorrencias.
- No mobile, testar bottom nav de cliente e montador.

## Mobile

### Conferido

- `Login.jsx` possui media queries para telas pequenas.
- `PortalCliente.jsx` possui bottom navigation e layout mobile.
- `MontadorDashboard.jsx` foi desenhado como fluxo mobile-first.
- `DashboardGestao.jsx` e `DashboardSupervisor.jsx` possuem grids responsivos.
- `Gastos.jsx`, `Agenda.jsx`, `Equipe.jsx` e `Planejamento.jsx` possuem ajustes mobile.

### Riscos

- Sem Playwright/screenshot nesta fase, a validacao visual final ainda deve ser manual.
- Componentes com muitos dados podem exigir revisao em celulares pequenos.

### Roteiro rapido

- Testar em largura aproximada de 360 px.
- Verificar que botoes nao sobrepoem texto.
- Conferir que nav inferior nao cobre formularios importantes.
- Testar upload de foto no montador em celular real.

## Permissoes visuais

### Conferido

- Cliente e montador nao entram no layout privado da gestao.
- Cliente acessa somente rota `/cliente/:id`.
- Montador acessa somente painel do montador.
- Sidebar filtra itens por role.
- Portal cliente exibe apenas secoes publicas/liberadas.

### Riscos

- Role `vendedor` e normalizado para `pos_venda`; manter consistencia em dados existentes.
- Qualquer role fora do esperado cai em `sem_acesso`, mas deve ser monitorada em producao.

## Arquivos grandes restantes

Arquivos acima de 500 linhas identificados:

| Arquivo | Linhas aproximadas | Observacao |
| --- | ---: | --- |
| `src/pages/gestao/ObraDetalhe.jsx` | 2926 | Ainda e o principal alvo de refatoracao futura. Nesta rodada houve extracao segura de controles de PDF. |
| `src/pages/montador/MontadorDashboard.jsx` | 1781 | Fluxo mobile complexo; separar componentes por aba em proxima rodada. |
| `src/pages/supervisor/DashboardSupervisor.jsx` | 1097 | Dashboard denso; considerar extrair cards/listas. |
| `src/pages/cliente/PortalCliente.jsx` | 1026 | Portal esta funcional, mas pode ganhar componentes por aba. |
| `src/pages/gestao/Agenda.jsx` | 994 | Candidato a refatoracao futura. |
| `src/pages/gestao/DashboardGestao.jsx` | 920 | Candidato a extrair componentes de KPI/listas. |
| `src/pages/gestao/Planejamento.jsx` | 915 | Contem alteracao pre-existente no workspace; nao foi alterado nesta sequencia. |
| `src/pages/gestao/Gastos.jsx` | 803 | Pode separar modal e listas financeiras. |
| `src/services/pdfService.js` | 622 | Pode separar builders por tipo de relatorio. |
| `src/pages/gestao/Equipe.jsx` | 561 | Pode separar modal e formulario de edicao. |

## Logs de erro

### Conferido

- `src/services/logService.js` cria logging defensivo.
- Dados sensiveis sao sanitizados.
- Falhas criticas instrumentadas:
  - login;
  - reset/magic link;
  - upload;
  - check-in/check-out;
  - gastos e checklist criticos.

### Risco

- Se a tabela `app_logs` nao existir, o servico cai para `console.error`.
- Criar tabela em producao somente apos revisar o SQL sugerido em `docs/logs-producao.md`.

## Relatorios e privacidade

### Conferido

- Relatorio cliente usa dados publicos/liberados.
- Relatorio financeiro interno separado.
- Falha de imagem nao deve bloquear PDF.

### Risco

- Revisar visualmente PDFs reais antes de enviar a cliente.
- Garantir que usuarios usem o tipo `Cliente` quando o destinatario for cliente.

## Offline e upload

### Conferido

- Montador recebe aviso offline.
- Check-in/check-out/checklist/foto registram lembrete local quando offline.
- Fotos nao sao armazenadas offline como arquivo local.
- Upload mostra preview e comprime imagem quando possivel.

### Risco

- Nao ha sincronizacao automatica complexa.
- Usuario deve refazer a acao quando voltar a conexao.

## Checklist final antes do deploy

1. Aplicar SQL/RLS manualmente no Supabase.
2. Confirmar redirects de Auth.
3. Rodar `npm.cmd run lint`.
4. Rodar `npm.cmd run build`.
5. Testar login de gestao, supervisor, montador e cliente.
6. Rodar piloto pos-RLS completo.
7. Testar upload de foto em celular real.
8. Exportar PDFs de cada tipo em uma obra real.
9. Validar que cliente nao ve gastos, ocorrencias internas ou fotos nao liberadas.
10. Revisar logs em producao apos primeiras operacoes.

## Decisao da auditoria

O projeto esta pronto para um piloto controlado pos-RLS, desde que as policies sejam aplicadas manualmente e o roteiro de teste seja executado antes de enviar acesso a cliente real.

Nao recomendado liberar para todos os clientes antes de:

- concluir o piloto;
- revisar PDFs reais;
- validar mobile em pelo menos um celular;
- confirmar que RLS bloqueia acesso direto por API.
