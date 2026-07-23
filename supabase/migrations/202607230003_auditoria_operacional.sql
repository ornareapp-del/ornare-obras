begin;

create table if not exists public.auditoria_operacional (
  id bigint generated always as identity primary key,
  tabela text not null,
  registro_id text,
  operacao text not null check (operacao in ('INSERT', 'UPDATE', 'DELETE')),
  obra_id uuid,
  usuario_id uuid,
  dados_anteriores jsonb,
  dados_novos jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists auditoria_operacional_obra_criado_idx
  on public.auditoria_operacional (obra_id, criado_em desc);
create index if not exists auditoria_operacional_registro_idx
  on public.auditoria_operacional (tabela, registro_id, criado_em desc);

alter table public.auditoria_operacional enable row level security;

drop policy if exists "auditoria_select_gestao" on public.auditoria_operacional;
create policy "auditoria_select_gestao"
on public.auditoria_operacional for select
to authenticated
using (public.ornare_role() = 'gestao');

create or replace function public.ornare_registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
begin
  insert into public.auditoria_operacional (
    tabela,
    registro_id,
    operacao,
    obra_id,
    usuario_id,
    dados_anteriores,
    dados_novos
  ) values (
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'data'),
    tg_op,
    nullif(v_row ->> 'obra_id', '')::uuid,
    auth.uid(),
    v_old,
    v_new
  );
  return coalesce(new, old);
end;
$$;

do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array[
    'obras',
    'obra_cronograma',
    'agenda',
    'gastos',
    'ocorrencias',
    'checklist_items',
    'fotos',
    'obra_montadores'
  ]
  loop
    if to_regclass('public.' || v_tabela) is not null then
      execute format('drop trigger if exists trg_auditoria_%I on public.%I', v_tabela, v_tabela);
      execute format(
        'create trigger trg_auditoria_%I after insert or update or delete on public.%I for each row execute function public.ornare_registrar_auditoria()',
        v_tabela,
        v_tabela
      );
    end if;
  end loop;
end;
$$;

commit;
