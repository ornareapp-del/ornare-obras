-- RLS para Biblioteca Mestre / checklist_padrao
-- Rode este SQL no Supabase SQL Editor.
-- Ele nao altera schema de dados, nao apaga registros e nao desativa RLS.

-- 1) Funcoes auxiliares seguras para ler o perfil do usuario logado.
create or replace function public.get_my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.is_gestao()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.get_my_role() = 'gestao'
$$;

-- 2) Garante RLS ativo.
alter table public.checklist_padrao enable row level security;

-- 3) Remove policies antigas com estes nomes, se existirem.
drop policy if exists "checklist_padrao_select_authenticated" on public.checklist_padrao;
drop policy if exists "checklist_padrao_insert_gestao" on public.checklist_padrao;
drop policy if exists "checklist_padrao_update_gestao" on public.checklist_padrao;
drop policy if exists "checklist_padrao_delete_gestao" on public.checklist_padrao;

-- 4) Leitura:
-- Todos os usuarios autenticados podem ler modelos ativos.
-- Gestao pode ler tudo, inclusive modelos inativos.
create policy "checklist_padrao_select_authenticated"
on public.checklist_padrao
for select
to authenticated
using (
  public.is_gestao()
  or coalesce(ativo, true) = true
);

-- 5) Escrita administrativa:
-- Somente gestao pode criar modelos na Biblioteca Mestre.
create policy "checklist_padrao_insert_gestao"
on public.checklist_padrao
for insert
to authenticated
with check (
  public.is_gestao()
);

-- 6) Edicao administrativa:
-- Somente gestao pode editar modelos.
create policy "checklist_padrao_update_gestao"
on public.checklist_padrao
for update
to authenticated
using (
  public.is_gestao()
)
with check (
  public.is_gestao()
);

-- 7) Exclusao administrativa:
-- Somente gestao pode excluir modelos.
create policy "checklist_padrao_delete_gestao"
on public.checklist_padrao
for delete
to authenticated
using (
  public.is_gestao()
);

-- 8) Recarrega schema/policies no PostgREST.
notify pgrst, 'reload schema';

-- 9) Consulta de conferencia.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'checklist_padrao'
order by policyname;
