-- Biblioteca Mestre Ornare
-- Rode este SQL no Supabase SQL Editor.
-- Ele nao apaga dados existentes e nao altera RLS/policies.

alter table public.checklist_padrao
  add column if not exists fase text,
  add column if not exists categoria_ambiente text default 'Geral',
  add column if not exists perfil_responsavel text,
  add column if not exists perfil_validador text,
  add column if not exists obrigatorio boolean default true,
  add column if not exists exige_foto boolean default false,
  add column if not exists exige_observacao boolean default false,
  add column if not exists exige_validacao_supervisor boolean default false,
  add column if not exists exige_validacao_cliente boolean default false,
  add column if not exists bloqueia_avanco boolean default false,
  add column if not exists criticidade text default 'media',
  add column if not exists ativo boolean default true,
  add column if not exists gera_automaticamente boolean default true,
  add column if not exists visivel_cliente boolean default false;

alter table public.checklist_items
  add column if not exists fase text,
  add column if not exists responsavel_perfil text,
  add column if not exists responsavel_id uuid,
  add column if not exists validado_supervisor boolean default false,
  add column if not exists validado_supervisor_por uuid,
  add column if not exists validado_supervisor_em timestamp with time zone,
  add column if not exists validado_cliente boolean default false,
  add column if not exists validado_cliente_em timestamp with time zone,
  add column if not exists exige_foto boolean default false,
  add column if not exists exige_observacao boolean default false,
  add column if not exists observacao text,
  add column if not exists status text default 'pendente',
  add column if not exists criticidade text default 'media';

create index if not exists idx_checklist_padrao_fase
  on public.checklist_padrao (fase);

create index if not exists idx_checklist_padrao_categoria_ambiente
  on public.checklist_padrao (categoria_ambiente);

create index if not exists idx_checklist_padrao_ativo
  on public.checklist_padrao (ativo);

create index if not exists idx_checklist_items_obra_fase
  on public.checklist_items (obra_id, fase);

create index if not exists idx_checklist_items_obra_status
  on public.checklist_items (obra_id, status);

create index if not exists idx_checklist_items_responsavel
  on public.checklist_items (responsavel_id);

-- Atualiza registros antigos com defaults seguros.
update public.checklist_padrao
set
  categoria_ambiente = coalesce(categoria_ambiente, 'Geral'),
  criticidade = coalesce(criticidade, 'media'),
  ativo = coalesce(ativo, true),
  obrigatorio = coalesce(obrigatorio, true),
  gera_automaticamente = coalesce(gera_automaticamente, true),
  exige_foto = coalesce(exige_foto, false),
  exige_observacao = coalesce(exige_observacao, false),
  exige_validacao_supervisor = coalesce(exige_validacao_supervisor, false),
  exige_validacao_cliente = coalesce(exige_validacao_cliente, false),
  bloqueia_avanco = coalesce(bloqueia_avanco, false),
  visivel_cliente = coalesce(visivel_cliente, false);

update public.checklist_items
set
  status = coalesce(status, case when concluido then 'concluido' else 'pendente' end),
  criticidade = coalesce(criticidade, 'media'),
  exige_foto = coalesce(exige_foto, false),
  exige_observacao = coalesce(exige_observacao, false),
  validado_supervisor = coalesce(validado_supervisor, false),
  validado_cliente = coalesce(validado_cliente, false);

-- Forca o PostgREST/Supabase API a recarregar o schema cache.
notify pgrst, 'reload schema';
