-- Ornare Obras - Equipes e progresso dos períodos de execução
-- Aplicar no Supabase SQL Editor. Script idempotente.

begin;

alter table if exists public.agenda
  add column if not exists percentual_concluido numeric not null default 0 check (percentual_concluido between 0 and 100),
  add column if not exists retorno_necessario boolean not null default false;

create table if not exists public.agenda_periodo_montadores (
  agenda_id uuid not null references public.agenda(id) on delete cascade,
  montador_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (agenda_id, montador_id)
);

create index if not exists idx_agenda_periodo_montadores_montador
  on public.agenda_periodo_montadores (montador_id);

alter table public.agenda_periodo_montadores enable row level security;

drop policy if exists "agenda_periodo_montadores_select" on public.agenda_periodo_montadores;
create policy "agenda_periodo_montadores_select"
on public.agenda_periodo_montadores for select to authenticated
using (exists (select 1 from public.agenda a where a.id = agenda_id));

drop policy if exists "agenda_periodo_montadores_write" on public.agenda_periodo_montadores;
create policy "agenda_periodo_montadores_write"
on public.agenda_periodo_montadores for all to authenticated
using (public.ornare_role() in ('gestao', 'supervisor', 'pos_venda', 'vendedor'))
with check (public.ornare_role() in ('gestao', 'supervisor', 'pos_venda', 'vendedor'));

notify pgrst, 'reload schema';
commit;
