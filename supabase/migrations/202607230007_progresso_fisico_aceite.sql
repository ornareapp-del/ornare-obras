begin;

alter table public.obra_cronograma
  add column if not exists progresso_fisico numeric not null default 0
    check (progresso_fisico between 0 and 100),
  add column if not exists aceite_status text not null default 'pendente'
    check (aceite_status in ('pendente', 'aprovado', 'reprovado', 'nao_se_aplica')),
  add column if not exists aceite_em timestamptz,
  add column if not exists aceite_por uuid references public.profiles(id),
  add column if not exists aceite_observacao text;

update public.obra_cronograma
set progresso_fisico = coalesce(percentual_concluido, 0)
where progresso_fisico = 0
  and coalesce(percentual_concluido, 0) > 0;

commit;
