begin;

alter table public.agenda
  add column if not exists reagendamento_status text
    check (reagendamento_status is null or reagendamento_status in ('solicitado', 'aprovado', 'recusado')),
  add column if not exists reagendamento_resposta text,
  add column if not exists reagendamento_respondido_em timestamptz,
  add column if not exists reagendamento_respondido_por uuid references public.profiles(id);

create index if not exists agenda_reagendamento_pendente_idx
  on public.agenda (obra_id, solicitacao_reagendamento_em)
  where solicitacao_reagendamento_cliente is not null
    and coalesce(reagendamento_status, 'solicitado') = 'solicitado';

update public.agenda
set reagendamento_status = 'solicitado'
where solicitacao_reagendamento_cliente is not null
  and reagendamento_status is null;

commit;
