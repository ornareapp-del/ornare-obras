begin;

create index if not exists obra_cronograma_obra_id_idx
  on public.obra_cronograma (obra_id);
create index if not exists obra_cronograma_fim_risco_idx
  on public.obra_cronograma (data_fim_prevista, risco)
  where data_fim_real is null;

create index if not exists agenda_obra_data_idx
  on public.agenda (obra_id, data desc);
create index if not exists agenda_responsavel_data_idx
  on public.agenda (responsavel_id, data, data_fim)
  where status <> 'cancelada';

create index if not exists checkins_obra_entrada_idx
  on public.checkins (obra_id, entrada desc);
create index if not exists checkins_usuario_aberto_idx
  on public.checkins (user_id, entrada desc)
  where saida is null;

create index if not exists checklist_items_obra_pendente_idx
  on public.checklist_items (obra_id)
  where concluido is not true;
create index if not exists fotos_obra_created_idx
  on public.fotos (obra_id, created_at desc);
create index if not exists fotos_aprovacao_pendente_idx
  on public.fotos (obra_id, created_at desc)
  where aprovada_gestao is not true;
create index if not exists ocorrencias_obra_status_idx
  on public.ocorrencias (obra_id, status);
create index if not exists gastos_obra_status_idx
  on public.gastos (obra_id, status);
create index if not exists notificacoes_usuario_status_idx
  on public.notificacoes (usuario_id, status, created_at desc);

commit;
