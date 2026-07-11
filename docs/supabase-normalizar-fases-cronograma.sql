-- Ornare Obras - normalizacao das fases operacionais do cronograma
-- Aplicar manualmente no Supabase SQL Editor.
--
-- Objetivo:
-- - manter public.obras.status como status administrativo/legado;
-- - padronizar public.obra_cronograma.fase com as keys oficiais usadas pelo app;
-- - manter public.obra_cronograma.status_operacional como rotulo legivel para gestao.

begin;

with fases_normalizadas as (
  select
    id,
    fase as fase_anterior,
    case
      when fase in (
        'vistoria_medida',
        'executivo',
        'producao',
        'vistoria_tecnica',
        'entrega_moveis',
        'montagem',
        'montagem_finalizada',
        'vistoria_final',
        'obra_concluida'
      ) then fase
      when lower(trim(fase)) in (
        'aguardando inicio',
        'aguardando início',
        'medicao agendada',
        'medição agendada',
        'em medicao',
        'em medição',
        'vistoria medida fina',
        'pre-obra',
        'pre obra'
      ) then 'vistoria_medida'
      when lower(trim(fase)) in (
        'executivo',
        'projeto em conferencia',
        'projeto em conferência'
      ) then 'executivo'
      when lower(trim(fase)) in (
        'producao',
        'produção',
        'em producao',
        'em produção'
      ) then 'producao'
      when lower(trim(fase)) in (
        'pronta para entrega',
        'vistoria tecnica',
        'vistoria técnica',
        'aguardando liberacao',
        'aguardando liberação'
      ) then 'vistoria_tecnica'
      when lower(trim(fase)) in (
        'entrega',
        'entrega dos moveis',
        'entrega dos móveis',
        'moveis a caminho',
        'móveis a caminho',
        'aguardando montagem'
      ) then 'entrega_moveis'
      when lower(trim(fase)) in (
        'montagem',
        'em montagem',
        'montagem agendada'
      ) then 'montagem'
      when lower(trim(fase)) = 'montagem finalizada' then 'montagem_finalizada'
      when lower(trim(fase)) = 'vistoria final' then 'vistoria_final'
      when lower(trim(fase)) in (
        'pos-venda',
        'pós-venda',
        'pos venda',
        'pós venda',
        'concluida',
        'concluída',
        'concluido',
        'concluído',
        'obra concluida',
        'obra concluída',
        'entregue'
      ) then 'obra_concluida'
      else null
    end as fase_nova
  from public.obra_cronograma
  where fase is not null
)
update public.obra_cronograma cronograma
set
  fase = normalizada.fase_nova,
  status_operacional = case
    when normalizada.fase_nova = 'vistoria_medida' then 'Vistoria Medida Fina'
    when normalizada.fase_nova = 'executivo' then 'Executivo'
    when normalizada.fase_nova = 'producao' then 'Produção'
    when normalizada.fase_nova = 'vistoria_tecnica' then 'Vistoria Técnica'
    when normalizada.fase_nova = 'entrega_moveis' then 'Entrega dos Móveis'
    when normalizada.fase_nova = 'montagem' then 'Montagem'
    when normalizada.fase_nova = 'montagem_finalizada' then 'Montagem Finalizada'
    when normalizada.fase_nova = 'vistoria_final' then 'Vistoria Final'
    when normalizada.fase_nova = 'obra_concluida' then 'Obra Concluída'
    else cronograma.status_operacional
  end
from fases_normalizadas normalizada
where cronograma.id = normalizada.id
  and normalizada.fase_nova is not null
  and cronograma.fase is distinct from normalizada.fase_nova;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'obra_cronograma_fase_key_check'
      and conrelid = 'public.obra_cronograma'::regclass
  ) then
    alter table public.obra_cronograma
      add constraint obra_cronograma_fase_key_check
      check (
        fase is null or fase in (
          'vistoria_medida',
          'executivo',
          'producao',
          'vistoria_tecnica',
          'entrega_moveis',
          'montagem',
          'montagem_finalizada',
          'vistoria_final',
          'obra_concluida'
        )
      )
      not valid;
  end if;
end $$;

-- Conferencia: se retornar linhas, existem fases antigas sem mapeamento automatico.
select id, obra_id, fase, status_operacional
from public.obra_cronograma
where fase is not null
  and fase not in (
    'vistoria_medida',
    'executivo',
    'producao',
    'vistoria_tecnica',
    'entrega_moveis',
    'montagem',
    'montagem_finalizada',
    'vistoria_final',
    'obra_concluida'
  )
order by updated_at desc nulls last, created_at desc nulls last;

commit;
