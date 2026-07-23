begin;

create or replace function public.ornare_atualizar_resumo_obra(
  p_obra_id uuid,
  p_nome text,
  p_status text,
  p_percentual numeric,
  p_data_fim_prevista date,
  p_cliente_nome text,
  p_observacoes text
)
returns public.obras
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_obra public.obras;
  v_percentual integer := greatest(0, least(100, coalesce(round(p_percentual), 0)));
begin
  if public.ornare_role() not in ('gestao', 'supervisor') then
    raise exception 'Perfil sem permissão para editar obra';
  end if;

  update public.obras
  set
    nome = p_nome,
    status = p_status,
    cliente_nome = p_cliente_nome,
    observacoes = p_observacoes,
    updated_at = now()
  where id = p_obra_id
    and arquivada_em is null
  returning * into v_obra;

  if v_obra.id is null then
    raise exception 'Obra não encontrada ou arquivada';
  end if;

  if exists (select 1 from public.obra_cronograma where obra_id = p_obra_id) then
    update public.obra_cronograma
    set
      percentual_concluido = v_percentual,
      data_fim_prevista = p_data_fim_prevista
    where obra_id = p_obra_id;
  else
    update public.obras
    set progresso = v_percentual, data_previsao = p_data_fim_prevista
    where id = p_obra_id
    returning * into v_obra;
  end if;

  select * into v_obra from public.obras where id = p_obra_id;
  return v_obra;
end;
$$;

revoke all on function public.ornare_atualizar_resumo_obra(uuid, text, text, numeric, date, text, text) from public;
grant execute on function public.ornare_atualizar_resumo_obra(uuid, text, text, numeric, date, text, text) to authenticated;

commit;
