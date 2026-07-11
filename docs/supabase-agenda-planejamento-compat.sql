-- Ornare Obras - Compatibilidade de Agenda + Planejamento
-- Aplicar no Supabase SQL Editor. Script idempotente.

begin;

alter table if exists public.agenda
  add column if not exists visivel_cliente boolean not null default false,
  add column if not exists visibilidade text not null default 'interna',
  add column if not exists descricao_cliente text,
  add column if not exists observacao_publica text,
  add column if not exists confirmado_cliente boolean not null default false,
  add column if not exists confirmado_cliente_em timestamptz,
  add column if not exists confirmado_cliente_por uuid references public.profiles(id) on delete set null,
  add column if not exists solicitacao_reagendamento_cliente text,
  add column if not exists solicitacao_reagendamento_em timestamptz,
  add column if not exists solicitacao_reagendamento_por uuid references public.profiles(id) on delete set null,
  add column if not exists reuniao_interna boolean not null default false,
  add column if not exists visivel_montador boolean not null default false;

alter table if exists public.obra_cronograma
  add column if not exists visivel_cliente boolean not null default false;

update public.agenda
set
  visivel_cliente = false,
  visibilidade = 'interna'
where reuniao_interna = true
  and (visivel_cliente = true or visibilidade <> 'interna');

create index if not exists idx_agenda_obra_data on public.agenda (obra_id, data);
create index if not exists idx_agenda_cliente_visivel on public.agenda (obra_id, data)
  where visivel_cliente = true and reuniao_interna = false;
create index if not exists idx_agenda_responsavel_data on public.agenda (responsavel_id, data);
create index if not exists idx_obra_cronograma_obra_datas on public.obra_cronograma (obra_id, data_inicio_prevista, data_fim_prevista);

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

notify pgrst, 'reload schema';

commit;

-- Diagnostico: eventos visiveis ao cliente por obra.
-- Troque o UUID abaixo pela obra do piloto.
with alvo as (
  select '00000000-0000-0000-0000-000000000000'::uuid as obra_id
)
select
  a.id,
  a.data,
  a.hora_inicio,
  a.tipo,
  a.titulo,
  a.visivel_cliente,
  a.reuniao_interna,
  a.confirmado_cliente,
  a.solicitacao_reagendamento_cliente,
  case
    when a.visivel_cliente = true and a.reuniao_interna = false then 'VISIVEL_CLIENTE'
    when a.reuniao_interna = true then 'BLOQUEADO_INTERNO'
    else 'BLOQUEADO_NAO_LIBERADO'
  end as diagnostico
from public.agenda a
join alvo on alvo.obra_id = a.obra_id
order by a.data, a.hora_inicio nulls last;
