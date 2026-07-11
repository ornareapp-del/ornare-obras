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
