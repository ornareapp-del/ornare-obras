# Fase 14 - Preparacao para Producao

## Decisao sobre o Portal Cliente

O portal em `/cliente/:id` continua sendo uma rota publica. Antes desta fase, algumas secoes tentavam filtrar dados no Supabase e, em caso de erro de schema, buscavam registros por `obra_id` e filtravam no frontend. Esse fallback foi removido para fotos e mensagens, e as demais secoes sensiveis passaram a usar consultas server-side com filtros de visibilidade.

Decisao local aplicada: fail closed. Se uma consulta publica filtrada falhar por coluna ausente, schema cache ou policy incorreta, a secao fica vazia e registra erro no console, em vez de buscar tudo e filtrar no browser.

Isso reduz exposicao acidental no frontend, mas nao substitui RLS. Para go-live com cliente real, `/cliente/:id` publico ainda deve ser tratado como bloqueador ate existir RLS mais token ou login de cliente.

## Riscos restantes

- A rota `/cliente/:id` e adivinhavel se o `id` da obra vazar.
- O frontend ainda usa a anon key, entao toda seguranca real depende de RLS e policies no Supabase.
- Buckets publicos podem expor arquivos se o `storage_path` for conhecido.
- `comunicados_cliente` e `contatos_cliente` sao assumidos como tabelas publicas por natureza; ainda precisam de RLS por obra/token/cliente.
- Inserts/updates feitos pelo cliente em `mensagens` e `agenda` precisam de policies restritas para evitar escrita em obra de terceiros.
- A consulta da obra publica deve continuar limitada a colunas de apresentacao; dados financeiros e observacoes internas nao devem estar liberados por policy.

## Opcao recomendada de acesso

Preferencia para producao:

1. Cliente acessa com Supabase Auth via magic link ou login.
2. `profiles.role = 'cliente'` e `profiles.obra_id` ou tabela `cliente_obras` vincula usuario a obra.
3. RLS libera leitura/escrita apenas para obras vinculadas.

Alternativa para link publico controlado:

1. Criar tabela `portal_cliente_tokens` com `obra_id`, `token_hash`, `expires_at`, `revoked_at`.
2. Enviar link `/cliente/:id?token=...`.
3. Validar token em Edge Function ou RPC security definer que retorna apenas dados permitidos.
4. Evitar consulta direta do frontend a tabelas internas com token bruto.

## Policies minimas sugeridas

Estas instrucoes sao pseudopolicies e devem ser ajustadas aos nomes reais de colunas, FKs e roles antes de aplicar.

```sql
-- Helpers conceituais:
-- is_gestao(): usuario autenticado com profiles.role = 'gestao'
-- is_supervisor_da_obra(obra_id): obra.supervisor_id = auth.uid()
-- is_montador_da_obra(obra_id): existe obra_montadores para auth.uid()
-- is_cliente_da_obra(obra_id): existe profiles.role='cliente' vinculado a obra_id

alter table obras enable row level security;
alter table fotos enable row level security;
alter table checklist_items enable row level security;
alter table agenda enable row level security;
alter table gastos enable row level security;
alter table ocorrencias enable row level security;
alter table obra_montadores enable row level security;

create policy "gestao le tudo em obras"
on obras for select
using (is_gestao());

create policy "supervisor le obras sob responsabilidade"
on obras for select
using (is_gestao() or supervisor_id = auth.uid());

create policy "montador le obras alocadas"
on obras for select
using (is_gestao() or exists (
  select 1 from obra_montadores om
  where om.obra_id = obras.id and om.montador_id = auth.uid()
));

create policy "cliente le somente obra vinculada"
on obras for select
using (is_gestao() or exists (
  select 1 from profiles p
  where p.id = auth.uid() and p.role = 'cliente' and p.obra_id = obras.id
));

create policy "cliente le fotos aprovadas e visiveis"
on fotos for select
using (
  is_gestao()
  or is_supervisor_da_obra(obra_id)
  or is_montador_da_obra(obra_id)
  or (
    is_cliente_da_obra(obra_id)
    and aprovada = true
    and coalesce(aprovada_gestao, true) = true
    and visivel_cliente = true
  )
);

create policy "cliente le checklist liberado"
on checklist_items for select
using (
  is_gestao()
  or is_supervisor_da_obra(obra_id)
  or (
    is_cliente_da_obra(obra_id)
    and concluido = true
    and visivel_cliente = true
    and coalesce(aprovado_cliente, aprovado_gestao, validado_supervisor, true) = true
  )
);

create policy "cliente le agenda visivel"
on agenda for select
using (
  is_gestao()
  or is_supervisor_da_obra(obra_id)
  or is_montador_da_obra(obra_id)
  or (
    is_cliente_da_obra(obra_id)
    and visivel_cliente = true
    and coalesce(reuniao_interna, false) = false
  )
);

create policy "cliente nunca le gastos internos"
on gastos for select
using (
  is_gestao()
  or is_supervisor_da_obra(obra_id)
);
```

## Storage

- Preferir bucket privado para `fotos-obras`.
- Entregar imagem do cliente por signed URL curto ou policy de storage vinculada a `storage.objects.name` com prefixo da obra.
- Fotos internas, gastos e anexos financeiros nunca devem compartilhar path publico previsivel.

## Checklist de go-live

Tabelas e campos minimos:

- `profiles`: `id`, `role`, `full_name`, `email`, `telefone`, `ativo`, vinculo de cliente com obra.
- `obras`: responsaveis, cliente, status/fase, datas, sem exposicao publica de campos internos.
- `obra_cronograma`: `visivel_cliente`, fase, percentual e datas publicas.
- `agenda`: `visivel_cliente`, `visibilidade`, `reuniao_interna`, campos publicos separados de observacoes internas.
- `fotos`: `aprovada`, `aprovada_gestao`, `visivel_cliente`, `visibilidade`, `storage_path`.
- `checklist_items`: `concluido`, `visivel_cliente`, flags de aprovacao.
- `mensagens`, `mensagens_obra`, `comunicados_cliente`, `contatos_cliente`, `documentos`.
- `gastos`: RLS sem leitura para cliente.

Usuarios iniciais:

- Pelo menos 1 gestao.
- Pelo menos 1 supervisor.
- Pelo menos 1 montador.
- Pelo menos 1 cliente de teste vinculado a uma obra, se optar por Auth.

Teste ponta a ponta obrigatorio:

1. Gestao cria obra.
2. Supervisor e montador sao alocados.
3. Montador faz check-in.
4. Montador envia foto.
5. Gestao aprova e libera foto.
6. Cliente ve somente conteudo liberado.
7. Gasto e lancado e aprovado sem aparecer para cliente.
8. Dashboard reflete pendencias.

## Backup e rollback

- Fazer backup do Supabase antes de qualquer alteracao de schema/RLS.
- Criar tag ou branch antes do deploy.
- Validar rollback do frontend para build anterior.
- Manter SQL de reversao para cada policy/migration aplicada.
