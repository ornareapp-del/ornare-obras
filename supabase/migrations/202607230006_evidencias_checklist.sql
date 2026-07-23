begin;

alter table public.checklist_padrao
  add column if not exists exige_foto boolean not null default false,
  add column if not exists exige_observacao boolean not null default false,
  add column if not exists exige_validacao_supervisor boolean not null default false;

alter table public.checklist_items
  add column if not exists exige_foto boolean not null default false,
  add column if not exists exige_observacao boolean not null default false,
  add column if not exists exige_validacao_supervisor boolean not null default false,
  add column if not exists observacao_execucao text;

alter table public.fotos
  add column if not exists checklist_item_id uuid references public.checklist_items(id) on delete set null;

create index if not exists fotos_checklist_item_idx
  on public.fotos (checklist_item_id)
  where checklist_item_id is not null;

commit;
