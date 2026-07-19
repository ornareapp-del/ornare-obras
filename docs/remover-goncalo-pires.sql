-- Remocao definitiva e protegida de Goncalo Pires.
-- Execute no SQL Editor do Supabase com permissao administrativa.
-- O bloco aborta e desfaz tudo se encontrar zero/mais de um candidato
-- ou se o usuario ainda estiver responsavel por alguma obra.

begin;

-- Conferencia visivel antes da exclusao.
select id, full_name, email, role, ativo
from public.profiles
where lower(trim(full_name)) = lower(trim('Gonçalo Pires'))
order by full_name;

do $$
declare
  v_id uuid;
  v_total integer;
begin
  select count(*)
    into v_total
  from public.profiles
  where lower(trim(full_name)) = lower(trim('Gonçalo Pires'));

  if v_total <> 1 then
    raise exception 'Exclusao cancelada: esperava 1 Gonçalo Pires, encontrei %.', v_total;
  end if;

  select id
    into v_id
  from public.profiles
  where lower(trim(full_name)) = lower(trim('Gonçalo Pires'));

  if auth.uid() is not null and v_id = auth.uid() then
    raise exception 'Exclusao cancelada: o usuario alvo e a sessao administrativa atual.';
  end if;

  if exists (
    select 1
    from public.obras
    where supervisor_id = v_id or comercial_id = v_id
  ) then
    raise exception 'Exclusao cancelada: Gonçalo ainda esta responsavel por uma ou mais obras. Realoque-as primeiro.';
  end if;

  -- Preserva as ocorrencias e apenas remove o vinculo com o autor excluido.
  -- A ocorrencia continua existindo normalmente no historico da obra.
  update public.ocorrencias
  set criado_por = null
  where criado_por = v_id;

  -- Remove primeiro o perfil do aplicativo. FKs configuradas com cascade/set null
  -- tratam vinculos operacionais; qualquer FK restritiva cancela a transacao inteira.
  delete from public.profiles where id = v_id;

  -- Remove tambem a credencial para impedir login futuro.
  delete from auth.users where id = v_id;

  raise notice 'Gonçalo Pires removido. ID: %', v_id;
end
$$;

commit;

-- Deve retornar zero linhas depois da conclusao.
select id, full_name, email, role, ativo
from public.profiles
where lower(trim(full_name)) = lower(trim('Gonçalo Pires'));
