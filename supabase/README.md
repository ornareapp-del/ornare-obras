# Banco de dados

As mudanças de schema e segurança passam a ser versionadas em `supabase/migrations`.

Regras:

1. Nunca editar uma migration que já foi aplicada.
2. Criar uma nova migration com timestamp crescente.
3. Aplicar primeiro em homologação.
4. Executar os testes por perfil antes de produção.
5. Registrar no relatório de implantação o último timestamp aplicado.

Os SQLs antigos em `docs/` permanecem como histórico e material de compatibilidade. Novas alterações devem entrar exclusivamente em migrations.
