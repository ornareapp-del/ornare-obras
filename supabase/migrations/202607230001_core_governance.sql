begin;

-- Arquivamento recuperável de obras.
alter table public.obras
  add column if not exists arquivada_em timestamptz,
  add column if not exists arquivada_por uuid references public.profiles(id);

create index if not exists obras_ativas_created_at_idx
  on public.obras (created_at desc)
  where arquivada_em is null;

-- O frontend nunca deve ser a única barreira de autorização.
drop policy if exists "obras_write_staff" on public.obras;
drop policy if exists "obras_insert_gestao" on public.obras;
drop policy if exists "obras_update_gestao_supervisor" on public.obras;
drop policy if exists "obras_delete_gestao" on public.obras;

create policy "obras_insert_gestao"
on public.obras for insert
to authenticated
with check (public.ornare_role() = 'gestao');

create policy "obras_update_gestao_supervisor"
on public.obras for update
to authenticated
using (
  public.ornare_role() = 'gestao'
  or (
    public.ornare_role() = 'supervisor'
    and supervisor_id = auth.uid()
    and arquivada_em is null
  )
)
with check (
  public.ornare_role() = 'gestao'
  or (
    public.ornare_role() = 'supervisor'
    and supervisor_id = auth.uid()
    and arquivada_em is null
    and arquivada_por is null
  )
);

-- Exclusão física fica restrita à gestão; a aplicação usa arquivamento.
create policy "obras_delete_gestao"
on public.obras for delete
to authenticated
using (public.ornare_role() = 'gestao');

commit;
