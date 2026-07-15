-- Ornare Obras - fotos internas visiveis para montadores da obra
-- Aplicar no Supabase SQL Editor.
--
-- Regra:
-- - montador ve as próprias fotos enquanto aguardam aprovação;
-- - montador vinculado à obra ve fotos aprovadas pela empresa/supervisor,
--   mesmo quando foram enviadas por outro montador;
-- - cliente continua vendo somente o que estiver aprovado e liberado ao cliente.

begin;

alter table if exists public.fotos
  add column if not exists enviada_por uuid references public.profiles(id) on delete set null,
  add column if not exists aprovada boolean not null default false,
  add column if not exists aprovada_gestao boolean not null default false,
  add column if not exists visivel_cliente boolean not null default false,
  add column if not exists status_aprovacao text not null default 'pendente';

alter table if exists public.fotos enable row level security;

drop policy if exists "fotos_select_ornare" on public.fotos;
create policy "fotos_select_ornare"
on public.fotos for select
to authenticated
using (
  public.ornare_is_gestao()
  or public.ornare_is_supervisor_da_obra(obra_id)
  or (
    public.ornare_is_montador_da_obra(obra_id)
    and (
      enviada_por = auth.uid()
      or aprovada = true
      or aprovada_gestao = true
      or status_aprovacao = 'aprovada'
    )
  )
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

create index if not exists idx_fotos_obra_aprovacao_empresa
  on public.fotos (obra_id, aprovada_gestao, aprovada, status_aprovacao);

create index if not exists idx_fotos_enviada_por
  on public.fotos (enviada_por);

notify pgrst, 'reload schema';

commit;

