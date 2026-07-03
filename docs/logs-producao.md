# Logs de erro em producao

## Objetivo

Foi criado um servico simples de logging para registrar falhas criticas em producao sem expor dados sensiveis. O log tenta inserir em `app_logs`; se a tabela ainda nao existir ou falhar por RLS/schema, o erro fica apenas no console e nao bloqueia o usuario.

## Servico

Arquivo:

- `src/services/logService.js`

Funcao principal:

- `logError(evento, error, contexto)`

O servico remove ou mascara campos sensiveis como `password`, `senha`, `token`, `authorization`, `file` e `arquivo`. Strings longas sao truncadas.

## Fluxos instrumentados

- Login com senha e recuperacao de senha.
- Check-in e check-out do montador.
- Upload de foto do montador.
- Upload de foto pela gestao.
- Upload de comprovante de gasto.
- Salvar/aprovar/recusar gasto.
- Inserir/atualizar/excluir checklist do montador.

## SQL sugerido

Nao aplicado automaticamente. Se a equipe decidir ativar persistencia em banco, aplicar manualmente no Supabase:

```sql
create table if not exists public.app_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  evento text not null,
  nivel text not null default 'error',
  mensagem text,
  codigo text,
  contexto jsonb not null default '{}'::jsonb,
  erro jsonb not null default '{}'::jsonb,
  url text,
  user_agent text
);

alter table public.app_logs enable row level security;

create policy "gestao pode ler app logs"
on public.app_logs
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('gestao', 'admin')
  )
);

create policy "usuarios autenticados podem inserir app logs"
on public.app_logs
for insert
with check (auth.uid() is not null);
```

## Cuidados

- Nao registrar senha, tokens, conteudo de arquivo, justificativas longas ou dados pessoais desnecessarios.
- Usar `obraId`, `gastoId`, `checklistId`, categoria e status como contexto suficiente para investigacao.
- O fallback em console e intencional para nao quebrar o app se `app_logs` ainda nao existir.
