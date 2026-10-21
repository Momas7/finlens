# F7 — Segurança Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2FA TOTP no login e registro de atividade da conta.

**Architecture:** Plugin `twoFactor` do Better Auth; eventos de auditoria gravados por um módulo `audit` chamado pelo hook de sessão, pelo proxy de `/api/auth/two-factor/*` e pelas rotas de export/import; telas em "Sua conta" e segundo passo no login.

**Tech Stack:** Better Auth 1.7.7, Drizzle/Postgres RLS, Fastify, Next.js 16, `qrcode`, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-f7-seguranca-design.md`

## Global Constraints

- Nada de segredo TOTP, código de reserva ou senha em log, registro de atividade ou export.
- Registro de atividade é best-effort e nunca derruba a ação.
- Sem `Co-Authored-By` nem rodapé de ferramenta.

## Review Focus

1. Login com 2FA nunca cria sessão antes do segundo passo (cookie de sessão ausente após a senha). — Task 2.
2. Segredo e códigos de reserva não aparecem em respostas além da ativação, nem no export, nem em log. — Task 2.
3. 2FA não verificado (ativação abandonada) não bloqueia o login. — Task 2.
4. Registro de atividade isolado por usuário (RLS) e apagado na exclusão da conta. — Task 1/2.
5. Códigos de reserva de uso único e regeração invalida os antigos. — Task 2.

---

### Task 1: Banco
**Files:** Modify `packages/db/src/schema/auth.ts` (`user.twoFactorEnabled`, tabela `twoFactor` com `id, secret, backupCodes, userId (cascade), verified`), `schema/finance.ts` ou novo `schema/audit.ts` (`auditLogs`), `guards.ts` (`two_factor` em `TABLES_WITHOUT_TENANT`); migrations geradas + `…_audit_logs_rls.sql` (política por `app_user_id()`).
- [ ] Teste: `rls-coverage` verde; teste do db: um usuário não lê `audit_logs` de outro e a exclusão do `user` apaga seus registros.
- [ ] `git commit -m "feat(db): two factor tables and audit logs"`

### Task 2: API
**Files:** Modify `apps/api/src/auth.ts` (plugin `twoFactor({ issuer: 'Finlens' })`, schema no adapter, hook `session.create.after` → `sign_in`), `plugins/auth-routes.ts` (limite estrito em `/api/auth/two-factor/*`; após resposta 2xx com sessão, registrar `two_factor_enabled` em `verify-totp`, `two_factor_disabled`, `backup_codes_regenerated`), `modules/me/routes.ts` (`GET /v1/me/activity`, `data_exported`), `modules/me/export.ts` (`auditLogs`), `modules/imports/routes.ts` (`import_committed`); Create `modules/audit/{record.ts}`, `packages/contracts/src/activity.ts`, `apps/api/test/security.integration.test.ts`.
**Produces:** `recordAudit(db, { userId, event, ip, userAgent, meta? }): Promise<void>` (best-effort, poda 180 dias); `AuditEvent` (contracts).
- [ ] Testes (RED) conforme a spec e o Review Focus (TOTP gerado no teste com a mesma lib do plugin, ou RFC 6238 implementado no helper).
- [ ] RED → implementar → GREEN → `git commit -m "feat(api): two factor auth and activity log"`

### Task 3: Web
**Files:** Modify `apps/web/src/app/(auth)/login/page.tsx` (segundo passo), `painel/conta/page.tsx`; Create `painel/conta/{security.tsx,activity.tsx}`, `apps/web/e2e/seguranca.spec.ts`, helper TOTP em `e2e/totp.ts`; Modify `a11y.spec.ts`; adicionar dependência `qrcode` (+ `@types/qrcode`) ao web.
- [ ] E2E: ativar (código gerado a partir da chave mostrada), sair, entrar com 2FA, entrar com código de reserva (uma vez só), desativar; atividade lista os eventos; axe (claro e escuro) em Sua conta com 2FA ativo/inativo e no segundo passo.
- [ ] RED → implementar → GREEN → `git commit -m "feat(web): two factor setup, login step and activity"`

### Task 4: Verificação final
- [ ] README (seção Segurança: 2FA, atividade, nota de `TRUSTED_PROXIES`; roadmap F7 ✅), suíte completa PASS.
