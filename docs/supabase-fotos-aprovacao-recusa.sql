-- Ornare Obras - fluxo de aprovacao/recusa de fotos
-- Aplicar manualmente no Supabase SQL Editor.
-- Script incremental e idempotente.

begin;

alter table if exists public.fotos
  add column if not exists status_aprovacao text not null default 'pendente',
  add column if not exists motivo_recusa text;

update public.fotos
set status_aprovacao = case
  when aprovada = true and aprovada_gestao = true then 'aprovada'
  when status_aprovacao is null or status_aprovacao = '' then 'pendente'
  else status_aprovacao
end;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fotos_status_aprovacao_check'
      and conrelid = 'public.fotos'::regclass
  ) then
    alter table public.fotos
      add constraint fotos_status_aprovacao_check
      check (status_aprovacao in ('pendente', 'aprovada', 'recusada'));
  end if;
end $$;

create index if not exists idx_fotos_obra_status_aprovacao
  on public.fotos (obra_id, status_aprovacao);

commit;
