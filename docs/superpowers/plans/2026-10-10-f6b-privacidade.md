# F6b — Privacidade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exportar (JSON completo e CSV de lançamentos) e excluir a conta com senha + "EXCLUIR".

**Architecture:** Formatador CSV puro no domínio; rotas em `apps/api/src/modules/me/`; exclusão apaga `user` e confia na cascata do Postgres; página `/painel/conta` com downloads diretos e Server Action de exclusão.

**Tech Stack:** Fastify, Drizzle/Postgres RLS, argon2, Next.js 16, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-f6b-privacidade-design.md`

## Global Constraints

- Nada de auth no export (senha, hash, sessões, tokens, tabelas `account`/`verification`).
- CSV: BOM, `;`, valor `-1234,56`, escape RFC 4180 com `"`.
- Exclusão só com senha correta e `confirm === 'EXCLUIR'`; limite de autenticação.
- Sem `Co-Authored-By` nem rodapé de ferramenta.

## Review Focus

1. **Cascata sob FORCE RLS**: apagar `user` precisa levar todas as linhas de tenant (ações referenciais não passam pela RLS) — Task 2 verifica tabela por tabela com o role owner.
2. **FKs compostas "no action" entre tabelas do mesmo workspace** (transações→contas, budgets→categories) não podem bloquear a cascata — Task 2 com dados em todas as tabelas (usa o seed da demo).
3. **Descrição com `;`, aspas e quebra de linha** no CSV — Task 1.
4. **Sessão antiga depois da exclusão** devolve 401, e a web limpa cookies (clear-session) em vez de entrar em loop — Task 2/3.
5. **Export de usuário sem dados** devolve coleções vazias, sem erro — Task 2.

---

### Task 1: Domínio — CSV de lançamentos

**Files:** Create `packages/domain/src/export/{csv.ts,csv.test.ts,index.ts}`; Modify `packages/domain/src/index.ts`.

**Produces:** `csvField(value: string): string`, `centsToCsv(cents: bigint): string` ("-1234,56"), `transactionsCsv(rows: { postedDate: string; account: string; description: string; amountCents: bigint; category: string | null; status: string }[]): string` (BOM + cabeçalho + linhas `\r\n`), `statusLabel(status)`.

- [ ] Testes: `centsToCsv(-123456n) === '-1234,56'`, `centsToCsv(5n) === '0,05'`, `centsToCsv(-5n) === '-0,05'`; `csvField('a;b') === '"a;b"'`, `csvField('diz "oi"') === '"diz ""oi"""'`, `csvField('a\nb') === '"a\nb"'`, `csvField('simples') === 'simples'`; `transactionsCsv([])` começa com `﻿` e é só o cabeçalho; status `confirmed→confirmada`, `auto→automática`, `likely→provável`, `suggested→sugestão`, `none→sem categoria`.
- [ ] RED → implementar → GREEN → `git commit -m "feat(domain): transactions csv"`

### Task 2: API — export e exclusão

**Files:** Create `apps/api/src/modules/me/{export,delete}.ts`, `apps/api/test/privacy.integration.test.ts`; Modify `apps/api/src/modules/me/routes.ts`, `packages/contracts/src/me.ts` (`DeleteAccount = { password: string; confirm: string }`).

- [ ] Testes (usuário populado com `runDemoSeed` + segundo usuário populado manualmente): JSON — chaves da spec, `user.email`, sem `password`/`token` em lugar nenhum (busca no texto), contagem de lançamentos igual à do plano demo, nenhuma linha do segundo usuário; CSV — BOM, cabeçalho, linha com `-45,90` de uma saída criada, descrição `CAFE; "BOM"` escapada; usuário novo exporta coleções vazias; DELETE com `confirm: 'excluir'` → 400; senha errada → 400 e dados intactos; válida → 204, todas as tabelas de tenant sem linhas do workspace (owner `select count(*) where workspace_id = $1` em cada tabela de `tablesWithoutForcedRls`-irmã: listar via `information_schema.columns where column_name = 'workspace_id'`), `user`/`session`/`account` sem o usuário, segundo usuário intacto, `GET /v1/me` com o cookie antigo → 401, sign-in → não 200.
- [ ] RED → implementar (export lê cada tabela sob `withTenant`; CSV junta nomes de conta/categoria; delete: zod → busca `account` credential → `verify` argon2 → `db.delete(user)`; aplicar `config: { rateLimit: { max: authRateLimitPerMinute } }` na rota como nas de auth) → GREEN → `git commit -m "feat(api): export data and delete account"`

### Task 3: Web — "Sua conta"

**Files:** Create `apps/web/src/app/painel/conta/{page,actions,delete-form}.tsx|ts`, `apps/web/e2e/conta.spec.ts`; Modify `apps/web/src/app/painel/layout.tsx` (link), `apps/web/src/app/auth/clear-session/route.ts` (`?next=excluida` → `/?conta=excluida`), landing (mensagem), `e2e/a11y.spec.ts`.

- [ ] Downloads: links `<a href="/v1/me/export" download>` (mesma origem pelo rewrite) — nomes "Baixar tudo (JSON)" e "Baixar lançamentos (CSV)".
- [ ] Exclusão: Server Action `deleteAccount(prev, form)` → `apiSend('POST','/v1/me/delete')`; erros de campo; sucesso → `redirect('/auth/clear-session?next=excluida')`.
- [ ] E2E: downloads (Playwright `waitForEvent('download')`, nome e trecho do conteúdo); exclusão → `/` com "Sua conta foi excluída." → login com a conta falha; senha errada mostra "Senha incorreta."; a11y `/painel/conta`.
- [ ] RED → implementar → GREEN → `git commit -m "feat(web): account page with export and deletion"`

### Task 4: Verificação final

- [ ] Suíte completa PASS; README (roadmap F6b ✅ e linha em Segurança).
