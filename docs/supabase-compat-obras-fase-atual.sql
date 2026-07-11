-- Ornare Obras - compatibilidade legado obras.fase_atual
-- Aplicar manualmente no Supabase SQL Editor.
--
-- Por que existe:
-- - A fonte operacional atual e public.obra_cronograma.fase.
-- - Algumas builds antigas ou caches do app ainda podem consultar public.obras.fase_atual.
-- - Este script evita erro "column obras.fase_atual does not exist" sem mudar a fonte da verdade.

begin;

alter table if exists public.obras
  add column if not exists fase_atual text;

update public.obras o
set fase_atual = c.fase
from public.obra_cronograma c
where c.obra_id = o.id
  and c.fase is not null
  and o.fase_atual is distinct from c.fase;

create or replace function public.ornare_sync_obras_fase_atual()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.obras
  set fase_atual = new.fase
  where id = new.obra_id
    and new.fase is not null
    and fase_atual is distinct from new.fase;

  return new;
end;
$$;

drop trigger if exists trg_ornare_sync_obras_fase_atual on public.obra_cronograma;
create trigger trg_ornare_sync_obras_fase_atual
after insert or update of fase on public.obra_cronograma
for each row
execute function public.ornare_sync_obras_fase_atual();

-- Conferencia rapida: deve retornar as obras que ainda nao possuem fase legada preenchida.
-- Isso nao e erro se a obra nao tem cronograma.
select o.id, o.nome, o.fase_atual, c.fase as fase_cronograma
from public.obras o
left join public.obra_cronograma c on c.obra_id = o.id
where o.fase_atual is null
order by o.created_at desc nulls last
limit 20;

commit;
