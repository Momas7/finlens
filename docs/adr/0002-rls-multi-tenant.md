# ADR 0002 — Isolamento de tenant com Row-Level Security

- Status: aceito
- Data: 2026-10-06

## Contexto

Dados financeiros de um workspace nunca podem aparecer para outro. Filtrar por `workspace_id` em toda query da aplicação funciona, mas um único esquecimento (IDOR) vaza dados.

## Decisão

- Toda tabela de tenant tem `workspace_id` e `ENABLE` + `FORCE ROW LEVEL SECURITY`. `FORCE` faz a política valer também para o dono da tabela.
- Dois roles: `finlens_owner` (dono do schema, roda migrations) e `finlens_app` (`NOSUPERUSER NOBYPASSRLS`, apenas DML). A API conecta sempre como `finlens_app`.
- O contexto é definido por transação em `withTenant()` com `set_config('app.user_id', …, true)` e `set_config('app.workspace_id', …, true)`. O parâmetro `true` limita o valor à transação; nada vaza entre conexões do pool.
- `app_workspace_id()` só devolve o workspace se o usuário do contexto for membro dele. Um `workspace_id` errado vindo da aplicação não abre acesso.
- `workspace_members` só aceita INSERT do próprio usuário como `owner` do próprio workspace pessoal; UPDATE e DELETE não têm policy. Sem isso, um usuário poderia se inserir em qualquer workspace e passar na checagem de `app_workspace_id()`. Convites (F futura) entram por uma função dedicada.
- Sem contexto, as políticas não casam e as queries retornam zero linhas.
- Políticas chamam as funções como `(SELECT app_workspace_id())` para o Postgres avaliar uma vez por query, não por linha.

Padrão para tabelas novas:

```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <t> FORCE ROW LEVEL SECURITY;
CREATE POLICY <t>_tenant ON <t>
  USING (workspace_id = (SELECT app_workspace_id()))
  WITH CHECK (workspace_id = (SELECT app_workspace_id()));
```

## Consequências

- A aplicação ainda filtra por `workspace_id`; RLS é defesa em profundidade, não substituto.
- Toda query de tenant precisa rodar dentro de `withTenant()`. Esquecer resulta em zero linhas, não em vazamento.
- Tabelas do Better Auth (`user`, `session`, `account`, `verification`) não são de tenant e não têm RLS.
- Testes de integração verificam que `finlens_app` não é superuser nem tem `BYPASSRLS`.
