-- Módulo de Logística Ornare Works
-- Execute uma vez no SQL Editor do Supabase. O script é idempotente.
create extension if not exists pgcrypto;

create table if not exists public.logistica_entregas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  tipo text not null default 'Entrega de móveis',
  status text not null default 'rascunho',
  transportadora text, motorista_nome text, motorista_telefone text,
  veiculo text, placa text,
  data_entrega date not null, hora_inicio time, hora_fim time,
  endereco_origem text, endereco_destino text,
  responsavel_recebimento_id uuid references public.profiles(id) on delete set null,
  descricao_carga text, nota_fiscal text, romaneio text, pedido text,
  instrucoes_acesso text, observacao text,
  visivel_montador boolean not null default true,
  visivel_cliente boolean not null default false,
  confirmado_em timestamptz, saiu_em timestamptz, chegou_em timestamptz,
  recebido_em timestamptz, recebido_por uuid references public.profiles(id) on delete set null,
  recebimento_status text, recebimento_observacao text,
  comprovante_url text, criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint logistica_status_check check (status in ('rascunho','aguardando_transportadora','confirmado','em_transito','chegou','conferencia','concluida','reagendada','atrasada','parcial','recusada','cancelada','avaria')),
  constraint logistica_horario_check check (hora_fim is null or hora_inicio is null or hora_fim >= hora_inicio)
);

create table if not exists public.logistica_montadores (
  logistica_id uuid not null references public.logistica_entregas(id) on delete cascade,
  montador_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (logistica_id, montador_id)
);

create table if not exists public.logistica_historico (
  id uuid primary key default gen_random_uuid(),
  logistica_id uuid not null references public.logistica_entregas(id) on delete cascade,
  status_anterior text, status_novo text not null, observacao text,
  alterado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_logistica_data on public.logistica_entregas(data_entrega);
create index if not exists idx_logistica_obra on public.logistica_entregas(obra_id);
create index if not exists idx_logistica_status on public.logistica_entregas(status);

create or replace function public.logistica_before_update() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if old.status is distinct from new.status then
    insert into public.logistica_historico(logistica_id,status_anterior,status_novo,alterado_por)
    values(new.id,old.status,new.status,auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists trg_logistica_before_update on public.logistica_entregas;
create trigger trg_logistica_before_update before update on public.logistica_entregas for each row execute function public.logistica_before_update();

alter table public.logistica_entregas enable row level security;
alter table public.logistica_montadores enable row level security;
alter table public.logistica_historico enable row level security;

drop policy if exists "logistica equipe leitura" on public.logistica_entregas;
create policy "logistica equipe leitura" on public.logistica_entregas for select to authenticated using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('gestao','supervisor','pos_venda','vendedor'))
  or (visivel_montador and exists(select 1 from public.logistica_montadores lm where lm.logistica_id=id and lm.montador_id=auth.uid()))
  or (visivel_cliente and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='cliente' and p.obra_id=obra_id))
);
drop policy if exists "logistica gestores escrita" on public.logistica_entregas;
create policy "logistica gestores escrita" on public.logistica_entregas for all to authenticated using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('gestao','supervisor'))
) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('gestao','supervisor')));

drop policy if exists "logistica vinculos leitura" on public.logistica_montadores;
create policy "logistica vinculos leitura" on public.logistica_montadores for select to authenticated using (
  montador_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('gestao','supervisor','pos_venda','vendedor'))
);
drop policy if exists "logistica vinculos escrita" on public.logistica_montadores;
create policy "logistica vinculos escrita" on public.logistica_montadores for all to authenticated using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('gestao','supervisor'))
) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('gestao','supervisor')));

drop policy if exists "logistica historico leitura" on public.logistica_historico;
create policy "logistica historico leitura" on public.logistica_historico for select to authenticated using (
  exists(select 1 from public.logistica_entregas le where le.id=logistica_id)
);

create or replace function public.montador_confirmar_logistica(p_logistica_id uuid, p_status text, p_observacao text default null)
returns public.logistica_entregas language plpgsql security definer set search_path=public as $$
declare v_item public.logistica_entregas;
begin
  if p_status not in ('concluida','parcial','avaria','recusada') then raise exception 'Status de recebimento inválido'; end if;
  if not exists(select 1 from public.logistica_montadores where logistica_id=p_logistica_id and montador_id=auth.uid()) then raise exception 'Entrega não vinculada ao montador'; end if;
  update public.logistica_entregas set status=p_status, recebimento_status=p_status, recebimento_observacao=p_observacao,
    recebido_em=case when p_status='concluida' then now() else recebido_em end, recebido_por=auth.uid()
  where id=p_logistica_id returning * into v_item;
  return v_item;
end $$;
grant execute on function public.montador_confirmar_logistica(uuid,text,text) to authenticated;

grant select,insert,update,delete on public.logistica_entregas to authenticated;
grant select,insert,update,delete on public.logistica_montadores to authenticated;
grant select on public.logistica_historico to authenticated;
