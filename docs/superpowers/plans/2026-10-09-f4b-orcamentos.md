# F4b — Orçamentos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Orçamento mensal por categoria principal de despesa, com vigência por mês, estado, ritmo, sugestão pela mediana e reflexo na Início.

**Architecture:** Regras puras em `packages/domain/src/budgets`; tabela `budgets` versionada por mês sob RLS; API reaproveita a agregação por raiz da F4a (extraída para `analytics/aggregate.ts`); tela `/painel/orcamentos` em Server Components com Server Actions.

**Tech Stack:** Fastify 5 + Zod 4 + Drizzle (Postgres 17, RLS), Next.js 16, Vitest, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-09-f4b-orcamentos-design.md`

## Global Constraints

- Dinheiro bigint centavos; API em string (`Cents` para entrada, `TotalCents` para saída).
- Mês civil de São Paulo; `effective_from` sempre dia 1; só o mês corrente é editável.
- Estados: `ok` < 0,8 ≤ `warning` < 1 ≤ `over`. Ritmo só no mês corrente a partir do dia 5. Sugestão: ≥ 3 meses com lançamentos entre os 6 fechados; mediana arredondada para cima a 5000; mínimo 5000.
- Erros: 404 categoria inexistente/arquivada/de outro workspace; 409 "Orçamento é por categoria principal de despesa."; 400 mês inválido/futuro e valor ≤ 0.
- Textos fixos da spec ("Orçamentos de {mês}", "Com orçamento", "Sem orçamento", "Definir orçamento", "Alterar", "Remover", "Usar sugestões", "Passou R$ X", "{p}%, atenção", "No ritmo atual, fecha em R$ X", "deve passar do limite por volta do dia N", "Dá pra gastar R$ Y por dia", "Orçamentos de meses passados não mudam.", "Passou do orçamento", "Informe um valor maior que zero, como 750,00.").
- RLS ENABLE+FORCE na tabela nova, migração separada; FK composta com `workspace_id`.
- Sem `Co-Authored-By` nem rodapé de ferramenta.

## Review Focus

1. **Limite definido no mês em que a categoria foi arquivada e depois reativada/renomeada**: renomear não perde orçamento (mesmo id). — coberto pelo uso de `category_id`; Task 3 testa PUT após `PATCH` de nome.
2. **Gastar exatamente o limite** (100,00 de 100,00): estado `over` e "Passou R$ 0,00" não pode aparecer — texto vira "100% usado, limite atingido". — Task 1 (`budgetState`) e Task 4 (e2e copy).
3. **Último dia do mês** (`day = daysInMonth`): `dailyAllowance` divide por 1 dia, nunca por 0. — Task 1.
4. **Dois PUT concorrentes no mesmo mês** (clique duplo): upsert por `(workspace, category, effective_from)`, sem 500. — Task 3 (`onConflictDoUpdate`, teste com dois PUT em `Promise.all`).
5. **Sugestão com mês de gasto zero no meio** (usou o app mas não gastou na categoria): conta como 0 na mediana. — Task 1/Task 3.

---

### Task 1: Domínio — regras de orçamento

**Files:** Create `packages/domain/src/budgets/{budget.ts,budget.test.ts,index.ts}`; Modify `packages/domain/src/index.ts`.

**Interfaces — Produces:** as quatro funções da spec (`limitFor`, `budgetState`, `pace`, `suggestBudget`), mais `type BudgetState = 'ok' | 'warning' | 'over'`.

- [ ] **Step 1: Testes que falham**

```ts
const v = [{ effectiveFrom: '2026-08', amountCents: 50000n }, { effectiveFrom: '2026-10', amountCents: 75000n }];
expect(limitFor(v, '2026-09')).toBe(50000n); expect(limitFor(v, '2026-10')).toBe(75000n); expect(limitFor(v, '2026-12')).toBe(75000n);
expect(limitFor(v, '2026-07')).toBeNull();
expect(limitFor([...v, { effectiveFrom: '2026-11', amountCents: null }], '2026-11')).toBeNull();
expect(budgetState(7999n, 10000n)).toBe('ok'); expect(budgetState(8000n, 10000n)).toBe('warning'); expect(budgetState(10000n, 10000n)).toBe('over');
expect(pace(10000n, 50000n, 4, 31)).toBeNull();
expect(pace(30000n, 50000n, 10, 31)).toEqual({ projectedCents: 93000n, overOnDay: 17, dailyAllowanceCents: 909n }); // 20000/22
expect(pace(60000n, 50000n, 10, 30)).toEqual({ projectedCents: 180000n, overOnDay: null, dailyAllowanceCents: null });
expect(pace(1000n, 50000n, 31, 31)?.dailyAllowanceCents).toBe(49000n);
expect(suggestBudget([60000n, 70000n])).toBeNull();
expect(suggestBudget([60000n, 0n, 72000n])).toBe(60000n);
expect(suggestBudget([61000n, 70000n, 52000n, 90000n])).toBe(70000n); // mediana 65500 → 70000
expect(suggestBudget([100n, 0n, 0n])).toBe(5000n);
```

- [ ] **Step 2:** `pnpm --filter @finlens/domain test` → FAIL.
- [ ] **Step 3:** Implementar. `limitFor`: maior `effectiveFrom ≤ month` (comparação de string `YYYY-MM`). Mediana par = média dos dois do meio (bigint, `/ 2n` arredondando para cima antes do teto de 5000 é irrelevante — aplicar teto ao resultado).
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** `git commit -m "feat(domain): budget rules"`

---

### Task 2: Banco — tabela `budgets`

**Files:** Modify `packages/db/src/schema/finance.ts`; generate `packages/db/migrations/0010_*.sql` (`pnpm --filter @finlens/db db:generate`) + create `0011_budgets_rls.sql` (com entrada no `meta/_journal.json`, igual a 0009); Create `packages/db/test/budgets.integration.test.ts`.

**Interfaces — Produces:** `budgets` (Drizzle: `id, workspaceId, categoryId, effectiveFrom (date, mode string), amountCents (bigint nullable), createdAt, updatedAt`), exportado em `@finlens/db`.

- [ ] **Step 1: Teste que falha** — padrão de `review.integration.test.ts`: dois workspaces; categoria criada via `ensurePersonalWorkspace` (seed padrão) — pegar uma raiz de despesa do workspace 1; inserir budget sob `withTenant`; asserts: sem tenant 0 linhas; workspace 2 vê 0; workspace 1 vê 1; inserir com `workspaceId` de outro workspace falha; `effective_from = '2026-10-15'` viola o check; `amount_cents = 0` viola o check.
- [ ] **Step 2:** `pnpm --filter @finlens/db test:integration` → FAIL.
- [ ] **Step 3:** Schema + migrações (RLS no padrão de 0009). `rls-coverage` deve continuar passando.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** `git commit -m "feat(db): budgets table"`

---

### Task 3: API — orçamentos e analytics

**Files:** Create `packages/contracts/src/budgets.ts`, `apps/api/src/modules/analytics/aggregate.ts`, `apps/api/src/modules/budgets/{queries,routes}.ts`, `apps/api/test/budgets.integration.test.ts`; Modify `packages/contracts/src/{index,analytics}.ts`, `apps/api/src/modules/analytics/{queries,routes}.ts`, `apps/api/src/app.ts`, `apps/api/test/analytics.integration.test.ts`.

**Interfaces:**
- Consumes: Task 1, Task 2; `parseMonth`, `lastMonths`, `monthRange` (F4a).
- Produces:
  - `aggregate.ts`: `rootTotals(tx, fromMonth, toMonth): Promise<{ month: Month; root: string | null; income: bigint; expense: bigint; count: number }[]>` (a consulta da F4a, movida) e `activeMonths(tx, fromMonth, toMonth): Promise<Set<Month>>` (meses com qualquer transação, inclusive movimentação).
  - `budgets/queries.ts`: `loadBudgetMonth(tx, month, today): Promise<BudgetMonth>`, `limitsFor(tx, month): Promise<Map<string, bigint>>`.
  - Contratos `BudgetMonth`, `BudgetItem`, `BudgetSet = { amountCents: Cents }` (positivo), `MonthCategory.limitCents: TotalCents.nullable()`, `MonthSummary.budgetAlerts: { warning: int, over: int }`.
- Mês da rota: mesma validação da analytics (extrair `resolveMonth(query.month, today)` para `analytics/month-param.ts` e usar nas duas).
- Validação de categoria para PUT/DELETE: buscar em `activeCategories` e na tabela (`parentId`); fora de ativas → 404; `parentId` não nulo ou `kind !== 'expense'` → 409.
- PUT: `insert … onConflictDoUpdate` no alvo `(workspace_id, category_id, effective_from)` setando `amountCents` e `updatedAt`.

- [ ] **Step 1: Testes que falham** (`budgets.integration.test.ts`, usuário novo por teste; helpers como em analytics):
  - 'define e lista': PUT Alimentação `{ amountCents: '75000' }` → 200; gasto −61200 em Alimentação › Mercado hoje; GET → item Alimentação `{ limitCents: '75000', spentCents: '61200', state: 'warning', share ≈ 0.816 }` primeiro da lista; `totals = { budgetedCents: '75000', spentCents: '61200' }`; `editable: true`.
  - 'PUT de novo no mesmo mês sobrescreve; concorrente não quebra': `Promise.all` de dois PUT → ambos 200; GET mostra um único limite.
  - 'vigência': inserir via `withTenant` uma versão `effective_from = <mês anterior>-01` com 50000; PUT 75000 agora; GET `?month=<anterior>` → 50000 e `editable: false`, `suggestion: null`; GET atual → 75000.
  - 'remover': DELETE → 204; GET atual → `limitCents: null`; DELETE de novo → 404; mês anterior mantém.
  - 'categoria inválida': PUT em subcategoria, em "Receitas", em "Movimentação" → 409; em uuid aleatório e em categoria arquivada → 404; `amountCents: '0'` → 400.
  - 'sugestão': lançar gastos em Alimentação nos 3 meses fechados anteriores (60000, 0 com uma entrada qualquer no mês, 72000) → item sem limite tem `suggestion = { amountCents: '60000', months: 3 }`; com só 2 meses → `null`.
  - 'apply-suggestions': com o histórico acima → `{ created: 1 }`; GET mostra limite 60000.
  - 'isolado': outro usuário não vê limites.
  - analytics: `categories[].limitCents` e `budgetAlerts = { warning: 1, over: 0 }` no cenário 'define e lista'.
- [ ] **Step 2:** `pnpm --filter @finlens/api test:integration` → FAIL.
- [ ] **Step 3:** Implementar (mover agregação sem mudar comportamento; os testes de analytics existentes continuam verdes).
- [ ] **Step 4:** PASS (todos os arquivos).
- [ ] **Step 5:** `git commit -m "feat(api): budgets with monthly versions and suggestions"`

---

### Task 4: Web — tela de orçamentos e Início

**Files:** Create `apps/web/src/app/painel/orcamentos/{page,actions,budget-forms}.tsx|ts`, `apps/web/src/components/month-nav.tsx` (extraída da Início), `apps/web/e2e/orcamentos.spec.ts`; Modify `apps/web/src/app/painel/{page,nav}.tsx`, `month-summary/{headline,where-it-went}.tsx`, `e2e/a11y.spec.ts`, `e2e/helpers.ts` (`addExpense` aceita `date?`).

**Interfaces:**
- Consumes: `BudgetMonth`, `MonthSummary.limitCents/budgetAlerts`, `parseAmountInput`, `Scale`.
- Server Actions: `setBudget(categoryId, prev, form)` (campo `amount`; erro de campo com o texto fixo), `removeBudget(categoryId)`, `applySuggestions()`; todas com `revalidatePath('/painel', 'layout')`.
- `MonthNav({ month, current, basePath })` usada pela Início e pelos orçamentos.
- Copy de estado: `over` com gasto = limite → "100% usado, limite atingido"; `over` com gasto > limite → "Passou R$ X"; `warning` → "{p}%, atenção"; `ok` → "{p}% usado".

- [ ] **Step 1: Testes que falham** (`orcamentos.spec.ts`):
  - 'definir a partir da sugestão': conta; gastos em Alimentação › Mercado com datas nos 3 meses anteriores (600,00; 650,00; 720,00) via `addExpense(..., date)`; `/painel/orcamentos` → campo "Limite mensal para Alimentação" com valor "650,00" e dica "mediana de 3 meses"; "Definir orçamento" → seção "Com orçamento" mostra "R$ 0,00 de R$ 650,00".
  - 'alterar e passar do limite': definir 100,00; gasto 120,00 hoje em Alimentação › Mercado → linha mostra "Passou R$ 20,00"; meter da categoria com `aria-valuetext` contendo "120%"; Início mostra link "1 passou" e "Passou do orçamento" em "Para onde foi"; "Alterar" para 200,00 → "60%" ou "{p}% usado".
  - 'mês passado só leitura': `?mes=<anterior>` → "Orçamentos de meses passados não mudam." e nenhum botão "Alterar"/"Definir orçamento".
  - 'remover': definir, "Remover" (aceita confirm) → categoria volta para "Sem orçamento".
  - 'valor inválido': "0" → "Informe um valor maior que zero, como 750,00."
  - a11y: `/painel/orcamentos` com um orçamento definido (claro/escuro).
- [ ] **Step 2:** RED.
- [ ] **Step 3:** Implementar (identidade Fita métrica; régua por linha; traço do limite em "Para onde foi").
- [ ] **Step 4:** `pnpm --filter @finlens/web test && pnpm --filter @finlens/web test:e2e orcamentos.spec.ts painel.spec.ts a11y.spec.ts` → PASS.
- [ ] **Step 5:** `git commit -m "feat(web): budgets page and home alerts"`

---

### Task 5: Verificação final

- [ ] Capturas de `/painel/orcamentos` e da Início com alertas (1440/375, claro/escuro) e ajustes.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm eval:classifier --check && pnpm --filter @finlens/web build && pnpm --filter @finlens/web test:e2e` — PASS.
- [ ] Commit de ajustes.
