-- Ornare Obras - Portal Cliente com Supabase Auth + RLS
-- Aplicar manualmente no Supabase SQL Editor.
-- Este script e idempotente para colunas/funcoes/policies nomeadas abaixo.

begin;

-- 1) Colunas necessarias para vinculo e visibilidade
alter table if exists public.profiles
  add column if not exists obra_id uuid references public.obras(id) on delete set null,
  add column if not exists ativo boolean not null default true;

alter table if exists public.fotos
  add column if not exists aprovada boolean not null default false,
  add column if not exists aprovada_gestao boolean not null default false,
  add column if not exists visivel_cliente boolean not null default false,
  add column if not exists visibilidade text not null default 'interna';

alter table if exists public.checklist_items
  add column if not exists concluido boolean not null default false,
  add column if not exists visivel_cliente boolean not null default false,
  add column if not exists visibilidade text not null default 'interna',
  add column if not exists aprovado_cliente boolean not null default false,
  add column if not exists aprovado_gestao boolean not null default false,
  add column if not exists validado_supervisor boolean not null default false;

alter table if exists public.agenda
  add column if not exists visivel_cliente boolean not null default false,
  add column if not exists visibilidade text not null default 'interna',
  add column if not exists reuniao_interna boolean not null default false,
  add column if not exists confirmado_cliente boolean not null default false,
  add column if not exists descricao_cliente text,
  add column if not exists observacao_publica text;

alter table if exists public.obra_cronograma
  add column if not exists visivel_cliente boolean not null default false;

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

-- 2) Helpers sem recursao de RLS.
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

create or replace function public.ornare_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.ornare_role() in ('gestao', 'supervisor', 'pos_venda', 'vendedor')
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

create or replace function public.ornare_is_comercial_da_obra(obra_uuid uuid)
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
      and o.comercial_id = auth.uid()
      and public.ornare_role() in ('pos_venda', 'vendedor', 'gestao')
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

create or replace function public.ornare_is_cliente_da_obra(obra_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'cliente'
      and coalesce(p.ativo, true) = true
      and p.obra_id = obra_uuid
  )
$$;

-- 3) RLS
alter table if exists public.profiles enable row level security;
alter table if exists public.obras enable row level security;
alter table if exists public.obra_montadores enable row level security;
alter table if exists public.obra_cronograma enable row level security;
alter table if exists public.fotos enable row level security;
alter table if exists public.checklist_items enable row level security;
alter table if exists public.agenda enable row level security;
alter table if exists public.gastos enable row level security;
alter table if exists public.ocorrencias enable row level security;
alter table if exists public.mensagens enable row level security;
alter table if exists public.mensagens_obra enable row level security;
alter table if exists public.comunicados_cliente enable row level security;
alter table if exists public.contatos_cliente enable row level security;
alter table if exists public.documentos enable row level security;

-- profiles
drop policy if exists "profiles_select_ornare" on public.profiles;
create policy "profiles_select_ornare"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or public.ornare_role() in ('gestao', 'supervisor')
);

drop policy if exists "profiles_insert_gestao" on public.profiles;
create policy "profiles_insert_gestao"
on public.profiles for insert
to authenticated
with check (public.ornare_is_gestao());

drop policy if exists "profiles_update_gestao_supervisor" on public.profiles;
create policy "profiles_update_gestao_supervisor"
on public.profiles for update
to authenticated
using (
  public.ornare_is_gestao()
  or (
    public.ornare_role() = 'supervisor'
    and role = 'montador'
    and (supervisor_id is null or supervisor_id = auth.uid())
  )
)
with check (
  public.ornare_is_gestao()
  or (
    public.ornare_role() = 'supervisor'
    and role = 'montador'
    and supervisor_id = auth.uid()
  )
);

-- obras
drop policy if exists "obras_select_ornare" on public.obras;
create policy "obras_select_ornare"
on public.obras for select
to authenticated
using (
  public.ornare_is_gestao()
  or public.ornare_is_supervisor_da_obra(id)
  or public.ornare_is_comercial_da_obra(id)
  or public.ornare_is_montador_da_obra(id)
  or public.ornare_is_cliente_da_obra(id)
);

drop policy if exists "obras_write_staff" on public.obras;
create policy "obras_write_staff"
on public.obras for all
to authenticated
using (public.ornare_role() in ('gestao', 'supervisor', 'pos_venda', 'vendedor'))
with check (public.ornare_role() in ('gestao', 'supervisor', 'pos_venda', 'vendedor'));

-- obra_montadores
drop policy if exists "obra_montadores_select_ornare" on public.obra_montadores;
create policy "obra_montadores_select_ornare"
on public.obra_montadores for select
to authenticated
using (
  public.ornare_is_staff()
  or montador_id = auth.uid()
);

drop policy if exists "obra_montadores_write_staff" on public.obra_montadores;
create policy "obra_montadores_write_staff"
on public.obra_montadores for all
to authenticated
using (public.ornare_role() in ('gestao', 'supervisor'))
with check (public.ornare_role() in ('gestao', 'supervisor'));

-- obra_cronograma
drop policy if exists "obra_cronograma_select_ornare" on public.obra_cronograma;
create policy "obra_cronograma_select_ornare"
on public.obra_cronograma for select
to authenticated
using (
  public.ornare_is_gestao()
  or public.ornare_is_supervisor_da_obra(obra_id)
  or public.ornare_is_comercial_da_obra(obra_id)
  or public.ornare_is_montador_da_obra(obra_id)
  or (public.ornare_is_cliente_da_obra(obra_id) and visivel_cliente = true)
);

drop policy if exists "obra_cronograma_write_staff" on public.obra_cronograma;
create policy "obra_cronograma_write_staff"
on public.obra_cronograma for all
to authenticated
using (public.ornare_role() in ('gestao', 'supervisor', 'pos_venda', 'vendedor'))
with check (public.ornare_role() in ('gestao', 'supervisor', 'pos_venda', 'vendedor'));

-- fotos: cliente so ve aprovada=true, aprovada_gestao=true, visivel_cliente=true
drop policy if exists "fotos_select_ornare" on public.fotos;
create policy "fotos_select_ornare"
on public.fotos for select
to authenticated
using (
  public.ornare_is_gestao()
  or public.ornare_is_supervisor_da_obra(obra_id)
  or public.ornare_is_montador_da_obra(obra_id)
  or (
    public.ornare_is_cliente_da_obra(obra_id)
    and aprovada = true
    and aprovada_gestao = true
    and visivel_cliente = true
  )
);

drop policy if exists "fotos_write_equipe" on public.fotos;
create policy "fotos_write_equipe"
on public.fotos for all
to authenticated
using (
  public.ornare_is_gestao()
  or public.ornare_is_supervisor_da_obra(obra_id)
  or public.ornare_is_montador_da_obra(obra_id)
)
with check (
  public.ornare_is_gestao()
  or public.ornare_is_supervisor_da_obra(obra_id)
  or public.ornare_is_montador_da_obra(obra_id)
);

-- checklist_items: cliente so ve concluido=true e visivel_cliente=true
drop policy if exists "checklist_items_select_ornare" on public.checklist_items;
create policy "checklist_items_select_ornare"
on public.checklist_items for select
to authenticated
using (
  public.ornare_is_gestao()
  or public.ornare_is_supervisor_da_obra(obra_id)
  or public.ornare_is_montador_da_obra(obra_id)
  or (
    public.ornare_is_cliente_da_obra(obra_id)
    and concluido = true
    and visivel_cliente = true
  )
);

drop policy if exists "checklist_items_write_equipe" on public.checklist_items;
create policy "checklist_items_write_equipe"
on public.checklist_items for all
to authenticated
using (
  public.ornare_is_gestao()
  or public.ornare_is_supervisor_da_obra(obra_id)
  or public.ornare_is_montador_da_obra(obra_id)
)
with check (
  public.ornare_is_gestao()
  or public.ornare_is_supervisor_da_obra(obra_id)
  or public.ornare_is_montador_da_obra(obra_id)
);

-- agenda: cliente so ve visivel_cliente=true e reuniao_interna=false
drop policy if exists "agenda_select_ornare" on public.agenda;
create policy "agenda_select_ornare"
on public.agenda for select
to authenticated
using (
  public.ornare_is_gestao()
  or public.ornare_is_supervisor_da_obra(obra_id)
  or public.ornare_is_comercial_da_obra(obra_id)
  or public.ornare_is_montador_da_obra(obra_id)
  or (
    public.ornare_is_cliente_da_obra(obra_id)
    and visivel_cliente = true
    and reuniao_interna = false
  )
);

drop policy if exists "agenda_write_staff" on public.agenda;
create policy "agenda_write_staff"
on public.agenda for all
to authenticated
using (public.ornare_role() in ('gestao', 'supervisor', 'pos_venda', 'vendedor'))
with check (public.ornare_role() in ('gestao', 'supervisor', 'pos_venda', 'vendedor'));

drop policy if exists "agenda_cliente_confirma_visivel" on public.agenda;
create policy "agenda_cliente_confirma_visivel"
on public.agenda for update
to authenticated
using (
  public.ornare_is_cliente_da_obra(obra_id)
  and visivel_cliente = true
  and reuniao_interna = false
)
with check (
  public.ornare_is_cliente_da_obra(obra_id)
  and visivel_cliente = true
  and reuniao_interna = false
);

-- gastos: cliente nao tem policy de leitura; apenas gestao/supervisor acessam
drop policy if exists "gastos_select_gestao_supervisor" on public.gastos;
create policy "gastos_select_gestao_supervisor"
on public.gastos for select
to authenticated
using (
  public.ornare_is_gestao()
  or public.ornare_is_supervisor_da_obra(obra_id)
);

drop policy if exists "gastos_write_gestao_supervisor" on public.gastos;
create policy "gastos_write_gestao_supervisor"
on public.gastos for all
to authenticated
using (
  public.ornare_is_gestao()
  or public.ornare_is_supervisor_da_obra(obra_id)
)
with check (
  public.ornare_is_gestao()
  or public.ornare_is_supervisor_da_obra(obra_id)
);

-- ocorrencias internas: sem acesso para cliente
drop policy if exists "ocorrencias_select_equipe" on public.ocorrencias;
create policy "ocorrencias_select_equipe"
on public.ocorrencias for select
to authenticated
using (
  public.ornare_is_gestao()
  or public.ornare_is_supervisor_da_obra(obra_id)
  or public.ornare_is_montador_da_obra(obra_id)
);

drop policy if exists "ocorrencias_write_equipe" on public.ocorrencias;
create policy "ocorrencias_write_equipe"
on public.ocorrencias for all
to authenticated
using (
  public.ornare_is_gestao()
  or public.ornare_is_supervisor_da_obra(obra_id)
  or public.ornare_is_montador_da_obra(obra_id)
)
with check (
  public.ornare_is_gestao()
  or public.ornare_is_supervisor_da_obra(obra_id)
  or public.ornare_is_montador_da_obra(obra_id)
);

-- mensagens do portal
drop policy if exists "mensagens_select_ornare" on public.mensagens;
create policy "mensagens_select_ornare"
on public.mensagens for select
to authenticated
using (
  public.ornare_is_staff()
  or public.ornare_is_supervisor_da_obra(obra_id)
  or public.ornare_is_cliente_da_obra(obra_id)
);

drop policy if exists "mensagens_insert_cliente_obra" on public.mensagens;
create policy "mensagens_insert_cliente_obra"
on public.mensagens for insert
to authenticated
with check (
  (
    public.ornare_is_cliente_da_obra(obra_id)
    and remetente_id = auth.uid()
    and tipo in ('cliente', 'reagendamento')
  )
  or public.ornare_is_staff()
);

drop policy if exists "mensagens_obra_select_ornare" on public.mensagens_obra;
create policy "mensagens_obra_select_ornare"
on public.mensagens_obra for select
to authenticated
using (
  public.ornare_is_staff()
  or public.ornare_is_supervisor_da_obra(obra_id)
  or (
    public.ornare_is_cliente_da_obra(obra_id)
    and (visivel_cliente = true or publico_cliente = true)
  )
);

drop policy if exists "mensagens_obra_write_staff" on public.mensagens_obra;
create policy "mensagens_obra_write_staff"
on public.mensagens_obra for all
to authenticated
using (public.ornare_is_staff())
with check (public.ornare_is_staff());

-- tabelas publicas do portal, sempre restringidas por obra vinculada.
-- Estes blocos sao condicionais porque alguns schemas ainda nao possuem todas as tabelas opcionais.
do $$
begin
  if to_regclass('public.comunicados_cliente') is not null then
    drop policy if exists "comunicados_cliente_select_ornare" on public.comunicados_cliente;
    create policy "comunicados_cliente_select_ornare"
    on public.comunicados_cliente for select
    to authenticated
    using (
      public.ornare_is_staff()
      or public.ornare_is_supervisor_da_obra(obra_id)
      or public.ornare_is_cliente_da_obra(obra_id)
    );

    drop policy if exists "comunicados_cliente_write_staff" on public.comunicados_cliente;
    create policy "comunicados_cliente_write_staff"
    on public.comunicados_cliente for all
    to authenticated
    using (public.ornare_is_staff())
    with check (public.ornare_is_staff());
  end if;
end $$;

do $$
begin
  if to_regclass('public.contatos_cliente') is not null then
    drop policy if exists "contatos_cliente_select_ornare" on public.contatos_cliente;
    create policy "contatos_cliente_select_ornare"
    on public.contatos_cliente for select
    to authenticated
    using (
      public.ornare_is_staff()
      or public.ornare_is_supervisor_da_obra(obra_id)
      or public.ornare_is_cliente_da_obra(obra_id)
    );

    drop policy if exists "contatos_cliente_write_staff" on public.contatos_cliente;
    create policy "contatos_cliente_write_staff"
    on public.contatos_cliente for all
    to authenticated
    using (public.ornare_is_staff())
    with check (public.ornare_is_staff());
  end if;
end $$;

do $$
begin
  if to_regclass('public.documentos') is not null then
    drop policy if exists "documentos_select_ornare" on public.documentos;
    create policy "documentos_select_ornare"
    on public.documentos for select
    to authenticated
    using (
      public.ornare_is_staff()
      or public.ornare_is_supervisor_da_obra(obra_id)
      or (
        public.ornare_is_cliente_da_obra(obra_id)
        and (visivel_cliente = true or publico_cliente = true)
      )
    );

    drop policy if exists "documentos_write_staff" on public.documentos;
    create policy "documentos_write_staff"
    on public.documentos for all
    to authenticated
    using (public.ornare_is_staff())
    with check (public.ornare_is_staff());
  end if;
end $$;

commit;
