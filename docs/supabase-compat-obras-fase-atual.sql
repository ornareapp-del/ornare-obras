-- Ornare Obras - compatibilidade legado public.obras
-- Aplicar manualmente no Supabase SQL Editor.
--
-- Por que existe:
-- - A fonte operacional atual e public.obra_cronograma.fase.
-- - Algumas builds antigas ou caches do app ainda podem consultar colunas legadas em public.obras.
-- - Este script evita erros como "column obras.fase_atual/updated_at does not exist" sem mudar a fonte da verdade.

begin;

alter table if exists public.obras
  add column if not exists fase_atual text,
  add column if not exists progresso integer not null default 0,
  add column if not exists data_previsao date,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.obra_cronograma
  add column if not exists visivel_cliente boolean not null default false;

alter table if exists public.fotos
  add column if not exists observacao_cliente text,
  add column if not exists aprovada boolean not null default false,
  add column if not exists aprovada_gestao boolean not null default false,
  add column if not exists visivel_cliente boolean not null default false,
  add column if not exists visibilidade text not null default 'interna';

alter table if exists public.agenda
  add column if not exists visivel_cliente boolean not null default false,
  add column if not exists visibilidade text not null default 'interna',
  add column if not exists reuniao_interna boolean not null default false,
  add column if not exists confirmado_cliente boolean not null default false,
  add column if not exists descricao_cliente text,
  add column if not exists observacao_publica text;

alter table if exists public.checklist_items
  add column if not exists observacao_cliente text,
  add column if not exists concluido boolean not null default false,
  add column if not exists visivel_cliente boolean not null default false,
  add column if not exists visibilidade text not null default 'interna',
  add column if not exists aprovado_cliente boolean not null default false,
  add column if not exists aprovado_gestao boolean not null default false,
  add column if not exists validado_supervisor boolean not null default false;

alter table if exists public.mensagens
  add column if not exists visivel_cliente boolean not null default false,
  add column if not exists visibilidade text not null default 'interna',
  add column if not exists publico_cliente boolean not null default false,
  add column if not exists lido_cliente boolean not null default false;

alter table if exists public.mensagens_obra
  add column if not exists visivel_cliente boolean not null default false,
  add column if not exists visibilidade text not null default 'interna',
  add column if not exists publico_cliente boolean not null default false;

alter table if exists public.documentos
  add column if not exists visivel_cliente boolean not null default false,
  add column if not exists visibilidade text not null default 'interna',
  add column if not exists publico_cliente boolean not null default false;

alter table if exists public.comunicados_cliente
  add column if not exists visivel_cliente boolean not null default false,
  add column if not exists visibilidade text not null default 'interna',
  add column if not exists publico_cliente boolean not null default false;

alter table if exists public.contatos_cliente
  add column if not exists visivel_cliente boolean not null default false,
  add column if not exists visibilidade text not null default 'interna',
  add column if not exists publico_cliente boolean not null default false;

update public.obras o
set
  fase_atual = c.fase,
  progresso = coalesce(c.percentual_concluido, o.progresso),
  data_previsao = coalesce(c.data_fim_prevista, o.data_previsao),
  updated_at = now()
from public.obra_cronograma c
where c.obra_id = o.id
  and (
    (c.fase is not null and o.fase_atual is distinct from c.fase)
    or (c.percentual_concluido is not null and o.progresso is distinct from c.percentual_concluido)
    or (c.data_fim_prevista is not null and o.data_previsao is distinct from c.data_fim_prevista)
  );

create or replace function public.ornare_sync_obras_fase_atual()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.obras
  set
    fase_atual = coalesce(new.fase, fase_atual),
    progresso = coalesce(new.percentual_concluido, progresso),
    data_previsao = coalesce(new.data_fim_prevista, data_previsao),
    updated_at = now()
  where id = new.obra_id
    and (
      (new.fase is not null and fase_atual is distinct from new.fase)
      or (new.percentual_concluido is not null and progresso is distinct from new.percentual_concluido)
      or (new.data_fim_prevista is not null and data_previsao is distinct from new.data_fim_prevista)
    );

  return new;
end;
$$;

drop trigger if exists trg_ornare_sync_obras_fase_atual on public.obra_cronograma;
create trigger trg_ornare_sync_obras_fase_atual
after insert or update of fase, percentual_concluido, data_fim_prevista on public.obra_cronograma
for each row
execute function public.ornare_sync_obras_fase_atual();

-- Conferencia rapida: mostra obras sem fase legada preenchida.
-- Isso nao e erro se a obra nao tem cronograma.
select o.id, o.nome, o.fase_atual, o.progresso, o.data_previsao, c.fase as fase_cronograma
from public.obras o
left join public.obra_cronograma c on c.obra_id = o.id
where o.fase_atual is null
order by o.created_at desc nulls last
limit 20;

commit;
