-- Equipe Operacional Ornare: pessoas com ou sem acesso ao aplicativo
create extension if not exists pgcrypto;

create table if not exists public.equipe_operacional (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  nome text not null,
  funcao text not null default 'ajudante',
  telefone text,
  supervisor_id uuid references public.profiles(id) on delete set null,
  especialidades text,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipe_operacional_funcao_check check (funcao in ('montador','ajudante','motorista','tecnico','conferente','terceirizado'))
);

create table if not exists public.obra_equipe_operacional (
  obra_id uuid not null references public.obras(id) on delete cascade,
  pessoa_id uuid not null references public.equipe_operacional(id) on delete cascade,
  funcao_na_obra text,
  data_inicio date,
  data_fim date,
  created_at timestamptz not null default now(),
  primary key (obra_id,pessoa_id)
);

create table if not exists public.agenda_periodo_equipe (
  agenda_id uuid not null references public.agenda(id) on delete cascade,
  pessoa_id uuid not null references public.equipe_operacional(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (agenda_id,pessoa_id)
);

create table if not exists public.logistica_equipe (
  logistica_id uuid not null references public.logistica_entregas(id) on delete cascade,
  pessoa_id uuid not null references public.equipe_operacional(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (logistica_id,pessoa_id)
);

create index if not exists idx_obra_equipe_pessoa on public.obra_equipe_operacional(pessoa_id);
create index if not exists idx_periodo_equipe_pessoa on public.agenda_periodo_equipe(pessoa_id);

insert into public.equipe_operacional(profile_id,nome,funcao,telefone,supervisor_id,ativo)
select p.id,coalesce(p.full_name,p.email,'Montador'),'montador',p.telefone,p.supervisor_id,coalesce(p.ativo,true)
from public.profiles p where p.role='montador'
on conflict(profile_id) do update set nome=excluded.nome,telefone=excluded.telefone,supervisor_id=excluded.supervisor_id,ativo=excluded.ativo;

insert into public.obra_equipe_operacional(obra_id,pessoa_id,funcao_na_obra)
select om.obra_id,eo.id,'montador' from public.obra_montadores om join public.equipe_operacional eo on eo.profile_id=om.montador_id
on conflict do nothing;

insert into public.agenda_periodo_equipe(agenda_id,pessoa_id)
select apm.agenda_id,eo.id from public.agenda_periodo_montadores apm join public.equipe_operacional eo on eo.profile_id=apm.montador_id
on conflict do nothing;

alter table public.equipe_operacional enable row level security;
alter table public.obra_equipe_operacional enable row level security;
alter table public.agenda_periodo_equipe enable row level security;
alter table public.logistica_equipe enable row level security;

do $$ declare t text; begin
  foreach t in array array['equipe_operacional','obra_equipe_operacional','agenda_periodo_equipe','logistica_equipe'] loop
    execute format('drop policy if exists %I on public.%I',t||'_staff_select',t);
    execute format('create policy %I on public.%I for select to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in (''gestao'',''supervisor'',''pos_venda'',''vendedor'')))',t||'_staff_select',t);
    execute format('drop policy if exists %I on public.%I',t||'_staff_write',t);
    execute format('create policy %I on public.%I for all to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in (''gestao'',''supervisor''))) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in (''gestao'',''supervisor'')))',t||'_staff_write',t);
  end loop;
end $$;

grant select,insert,update,delete on public.equipe_operacional,public.obra_equipe_operacional,public.agenda_periodo_equipe,public.logistica_equipe to authenticated;
