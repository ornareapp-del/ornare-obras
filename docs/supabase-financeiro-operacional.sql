-- Ornare Obras - compatibilidade do financeiro operacional
-- Aplicar manualmente no Supabase SQL Editor.
-- Script incremental e idempotente para gastos, comprovantes, notificacoes e RLS.

begin;

create extension if not exists pgcrypto;

alter table if exists public.gastos
  add column if not exists obra_id uuid references public.obras(id) on delete set null,
  add column if not exists responsavel_id uuid references public.profiles(id) on delete set null,
  add column if not exists criado_por uuid references public.profiles(id) on delete set null,
  add column if not exists descricao text,
  add column if not exists categoria text,
  add column if not exists valor numeric(12,2),
  add column if not exists data date,
  add column if not exists observacao text,
  add column if not exists status text not null default 'aprovado',
  add column if not exists comprovante text,
  add column if not exists storage_path text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.gastos
set status = 'pendente_aprovacao'
where status = 'pendente';

update public.gastos
set status = 'aprovado'
where status is null or status = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gastos_status_check'
      and conrelid = 'public.gastos'::regclass
  ) then
    alter table public.gastos
      add constraint gastos_status_check
      check (status in ('aprovado', 'pendente_aprovacao', 'recusado'));
  end if;
end $$;

create index if not exists idx_gastos_obra_data on public.gastos (obra_id, data desc);
create index if not exists idx_gastos_status on public.gastos (status);
create index if not exists idx_gastos_responsavel on public.gastos (responsavel_id);

insert into storage.buckets (id, name, public)
values ('fotos-obras', 'fotos-obras', true)
on conflict (id) do update set public = excluded.public;

alter table if exists public.gastos enable row level security;

create or replace function public.ornare_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and coalesce(p.ativo, true) = true
  limit 1
$$;

create or replace function public.ornare_is_gestao()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.ornare_role() = 'gestao'
$$;

create or replace function public.ornare_is_supervisor_da_obra(obra_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.obras o
    where o.id = obra_uuid
      and o.supervisor_id = auth.uid()
      and public.ornare_role() in ('supervisor', 'gestao')
  )
$$;

create or replace function public.ornare_is_montador_da_obra(obra_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.obra_montadores om
    join public.profiles p on p.id = auth.uid()
    where om.obra_id = obra_uuid
      and om.montador_id = auth.uid()
      and p.role = 'montador'
      and coalesce(p.ativo, true) = true
  )
$$;

drop policy if exists "gastos_select_gestao_supervisor" on public.gastos;
drop policy if exists "gastos_write_gestao_supervisor" on public.gastos;
drop policy if exists "gastos_select_financeiro_operacional" on public.gastos;
drop policy if exists "gastos_insert_financeiro_operacional" on public.gastos;
drop policy if exists "gastos_update_financeiro_operacional" on public.gastos;
drop policy if exists "gastos_delete_gestao_supervisor" on public.gastos;

create policy "gastos_select_financeiro_operacional"
on public.gastos for select
to authenticated
using (
  public.ornare_is_gestao()
  or public.ornare_is_supervisor_da_obra(obra_id)
  or public.ornare_is_montador_da_obra(obra_id)
  or responsavel_id = auth.uid()
  or criado_por = auth.uid()
);

create policy "gastos_insert_financeiro_operacional"
on public.gastos for insert
to authenticated
with check (
  public.ornare_is_gestao()
  or public.ornare_is_supervisor_da_obra(obra_id)
  or public.ornare_is_montador_da_obra(obra_id)
  or responsavel_id = auth.uid()
  or criado_por = auth.uid()
);

create policy "gastos_update_financeiro_operacional"
on public.gastos for update
to authenticated
using (
  public.ornare_is_gestao()
  or public.ornare_is_supervisor_da_obra(obra_id)
  or (
    status <> 'aprovado'
    and (responsavel_id = auth.uid() or criado_por = auth.uid() or public.ornare_is_montador_da_obra(obra_id))
  )
)
with check (
  public.ornare_is_gestao()
  or public.ornare_is_supervisor_da_obra(obra_id)
  or (
    status <> 'aprovado'
    and (responsavel_id = auth.uid() or criado_por = auth.uid() or public.ornare_is_montador_da_obra(obra_id))
  )
);

create policy "gastos_delete_gestao_supervisor"
on public.gastos for delete
to authenticated
using (
  public.ornare_is_gestao()
  or public.ornare_is_supervisor_da_obra(obra_id)
);

drop policy if exists "storage_gastos_select_fotos_obras" on storage.objects;
drop policy if exists "storage_gastos_insert_fotos_obras" on storage.objects;
drop policy if exists "storage_gastos_update_fotos_obras" on storage.objects;

create policy "storage_gastos_select_fotos_obras"
on storage.objects for select
to authenticated
using (bucket_id = 'fotos-obras' and name like 'gastos/%');

create policy "storage_gastos_insert_fotos_obras"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'fotos-obras'
  and name like 'gastos/%'
  and public.ornare_role() in ('gestao', 'supervisor', 'montador')
);

create policy "storage_gastos_update_fotos_obras"
on storage.objects for update
to authenticated
using (
  bucket_id = 'fotos-obras'
  and name like 'gastos/%'
  and public.ornare_role() in ('gestao', 'supervisor', 'montador')
)
with check (
  bucket_id = 'fotos-obras'
  and name like 'gastos/%'
  and public.ornare_role() in ('gestao', 'supervisor', 'montador')
);

commit;
