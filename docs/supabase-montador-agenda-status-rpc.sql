-- Ornare Obras - RPC segura para status da agenda pelo montador
-- Rode este SQL no Supabase SQL Editor.
--
-- Objetivo:
-- - Permitir que um usuario autenticado com profiles.role = 'montador'
--   atualize somente public.agenda.status.
-- - Restringir a atualizacao a compromissos de obras vinculadas ao montador
--   em public.obra_montadores.
-- - Aceitar somente status operacionais seguros usados no check-in/check-out.

begin;

alter table if exists public.profiles
  add column if not exists ativo boolean not null default true;

create or replace function public.montador_atualizar_status_agenda(
  p_agenda_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_obra_id uuid;
begin
  if v_user_id is null then
    raise exception 'Usuario nao autenticado.'
      using errcode = '28000';
  end if;

  if p_agenda_id is null then
    raise exception 'Agenda obrigatoria.'
      using errcode = '22023';
  end if;

  if p_status not in ('em andamento', 'realizada') then
    raise exception 'Status de agenda nao permitido: %.', p_status
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and p.role = 'montador'
      and coalesce(p.ativo, true) = true
  ) then
    raise exception 'Usuario nao e montador ativo.'
      using errcode = '42501';
  end if;

  select a.obra_id
    into v_obra_id
  from public.agenda a
  where a.id = p_agenda_id;

  if v_obra_id is null then
    raise exception 'Compromisso da agenda nao encontrado.'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.obra_montadores om
    where om.obra_id = v_obra_id
      and om.montador_id = v_user_id
  ) then
    raise exception 'Montador sem vinculo com a obra da agenda.'
      using errcode = '42501';
  end if;

  update public.agenda
     set status = p_status
   where id = p_agenda_id;
end;
$$;

revoke all on function public.montador_atualizar_status_agenda(uuid, text) from public;
revoke all on function public.montador_atualizar_status_agenda(uuid, text) from anon;
grant execute on function public.montador_atualizar_status_agenda(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;
