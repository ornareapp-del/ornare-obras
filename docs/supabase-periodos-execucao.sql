-- Ornare Obras - Equipes e progresso dos períodos de execução
-- Aplicar no Supabase SQL Editor. Script idempotente.

begin;

alter table if exists public.agenda
  add column if not exists percentual_concluido numeric not null default 0 check (percentual_concluido between 0 and 100),
  add column if not exists retorno_necessario boolean not null default false,
  add column if not exists motivo_pausa text,
  add column if not exists data_inicio_real date,
  add column if not exists data_fim_real date,
  add column if not exists minutos_realizados integer not null default 0 check (minutos_realizados >= 0),
  add column if not exists encerramento_validado boolean not null default false,
  add column if not exists encerramento_validado_em timestamptz,
  add column if not exists encerramento_validado_por uuid references public.profiles(id) on delete set null;

alter table if exists public.ocorrencias
  add column if not exists agenda_id uuid references public.agenda(id) on delete set null;
create index if not exists idx_ocorrencias_agenda on public.ocorrencias (agenda_id);

create or replace function public.ornare_sync_periodo_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agenda_id uuid;
  v_primeira_entrada date;
  v_ultima_saida date;
  v_minutos integer;
begin
  v_agenda_id := new.agenda_id;
  if v_agenda_id is null then return new; end if;
  if not exists (select 1 from public.agenda a where a.id = v_agenda_id and lower(a.tipo) in ('período de execução', 'periodo de execucao')) then return new; end if;

  select
    min(c.entrada)::date,
    max(c.saida)::date,
    coalesce(sum(case when c.entrada is not null and c.saida is not null then extract(epoch from (c.saida - c.entrada)) / 60 else 0 end), 0)::integer
  into v_primeira_entrada, v_ultima_saida, v_minutos
  from public.checkins c
  where c.agenda_id = v_agenda_id;

  update public.agenda
  set
    status = case when status in ('realizada', 'cancelada') then status else 'em andamento' end,
    data_inicio_real = coalesce(v_primeira_entrada, data_inicio_real),
    data_fim_real = coalesce(v_ultima_saida, data_fim_real),
    minutos_realizados = v_minutos
  where id = v_agenda_id;
  return new;
end;
$$;

drop trigger if exists trg_ornare_sync_periodo_checkin on public.checkins;
create trigger trg_ornare_sync_periodo_checkin
after insert or update of entrada, saida, agenda_id on public.checkins
for each row execute function public.ornare_sync_periodo_checkin();

create or replace function public.ornare_periodos_schema_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'agenda_avancada', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'agenda' and column_name = 'encerramento_validado'),
    'equipes', to_regclass('public.agenda_periodo_montadores') is not null,
    'dependencias', to_regclass('public.agenda_periodo_dependencias') is not null,
    'reagendamentos', to_regclass('public.agenda_reagendamentos') is not null,
    'calendario', to_regclass('public.calendario_operacional') is not null,
    'trigger_checkin', exists (select 1 from pg_trigger where tgname = 'trg_ornare_sync_periodo_checkin' and not tgisinternal)
  );
$$;

-- A função expõe somente indicadores booleanos de instalação. Liberar para anon
-- permite validar a migração com a mesma chave pública usada pelo frontend.
grant execute on function public.ornare_periodos_schema_status() to anon, authenticated;

create table if not exists public.agenda_periodo_montadores (
  agenda_id uuid not null references public.agenda(id) on delete cascade,
  montador_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (agenda_id, montador_id)
);

create index if not exists idx_agenda_periodo_montadores_montador
  on public.agenda_periodo_montadores (montador_id);

create table if not exists public.agenda_periodo_dependencias (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null references public.agenda(id) on delete cascade,
  tipo text not null,
  descricao text not null,
  concluida boolean not null default false,
  concluida_em timestamptz,
  concluida_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_agenda_periodo_dependencias_agenda
  on public.agenda_periodo_dependencias (agenda_id);

create table if not exists public.agenda_reagendamentos (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null references public.agenda(id) on delete cascade,
  data_anterior date not null,
  data_fim_anterior date,
  data_nova date not null,
  data_fim_nova date,
  motivo text not null,
  escopo text not null default 'periodo' check (escopo in ('periodo', 'seguintes')),
  alterado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_agenda_reagendamentos_agenda
  on public.agenda_reagendamentos (agenda_id, created_at desc);

create table if not exists public.calendario_operacional (
  id uuid primary key default gen_random_uuid(),
  data date not null unique,
  descricao text not null,
  dia_util boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.agenda_periodo_montadores enable row level security;
alter table public.agenda_periodo_dependencias enable row level security;
alter table public.agenda_reagendamentos enable row level security;
alter table public.calendario_operacional enable row level security;

drop policy if exists "agenda_periodo_montadores_select" on public.agenda_periodo_montadores;
create policy "agenda_periodo_montadores_select"
on public.agenda_periodo_montadores for select to authenticated
using (exists (select 1 from public.agenda a where a.id = agenda_id));

drop policy if exists "agenda_periodo_montadores_write" on public.agenda_periodo_montadores;
create policy "agenda_periodo_montadores_write"
on public.agenda_periodo_montadores for all to authenticated
using (public.ornare_role() in ('gestao', 'supervisor', 'pos_venda', 'vendedor'))
with check (public.ornare_role() in ('gestao', 'supervisor', 'pos_venda', 'vendedor'));

drop policy if exists "agenda_periodo_dependencias_select" on public.agenda_periodo_dependencias;
create policy "agenda_periodo_dependencias_select" on public.agenda_periodo_dependencias
for select to authenticated using (exists (select 1 from public.agenda a where a.id = agenda_id));
drop policy if exists "agenda_periodo_dependencias_write" on public.agenda_periodo_dependencias;
create policy "agenda_periodo_dependencias_write" on public.agenda_periodo_dependencias
for all to authenticated using (public.ornare_role() in ('gestao', 'supervisor', 'pos_venda', 'vendedor'))
with check (public.ornare_role() in ('gestao', 'supervisor', 'pos_venda', 'vendedor'));

drop policy if exists "agenda_reagendamentos_select" on public.agenda_reagendamentos;
create policy "agenda_reagendamentos_select" on public.agenda_reagendamentos
for select to authenticated using (exists (select 1 from public.agenda a where a.id = agenda_id));
drop policy if exists "agenda_reagendamentos_write" on public.agenda_reagendamentos;
create policy "agenda_reagendamentos_write" on public.agenda_reagendamentos
for all to authenticated using (public.ornare_role() in ('gestao', 'supervisor', 'pos_venda', 'vendedor'))
with check (public.ornare_role() in ('gestao', 'supervisor', 'pos_venda', 'vendedor'));

drop policy if exists "calendario_operacional_select" on public.calendario_operacional;
create policy "calendario_operacional_select" on public.calendario_operacional
for select to authenticated using (true);
drop policy if exists "calendario_operacional_write" on public.calendario_operacional;
create policy "calendario_operacional_write" on public.calendario_operacional
for all to authenticated using (public.ornare_role() = 'gestao')
with check (public.ornare_role() = 'gestao');

notify pgrst, 'reload schema';
commit;
