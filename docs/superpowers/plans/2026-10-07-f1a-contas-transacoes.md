# F1a — Contas, categorias e lançamentos manuais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Contas e cartões com saldo/fatura, taxonomia de categorias padrão e lançamentos manuais com lista filtrada e paginada, ponta a ponta (banco, API, web).

**Architecture:** Regras puras em `packages/domain`; tabelas com RLS em `packages/db`; contratos Zod em `packages/contracts`; módulos Fastify `accounts`, `categories`, `transactions` em `apps/api`; telas em `apps/web/src/app/painel/*` com Server Components (leitura via `apiFetch`) e Server Actions (escrita via `apiSend`).

**Tech Stack:** TypeScript, Drizzle + PostgreSQL 17 (RLS), Fastify 5 + Zod 4, Next.js 16, Vitest, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-07-f1a-contas-transacoes-design.md`

## Global Constraints

- Dinheiro: `bigint` centavos no banco/domínio; na API, string de inteiro com sinal (`"-4590"`), regex `^-?\d{1,15}$`.
- Datas: strings `YYYY-MM-DD`; "hoje" no fuso `America/Sao_Paulo`.
- Tabelas novas: `workspace_id`, `ENABLE` + `FORCE ROW LEVEL SECURITY`, policy `workspace_id = (SELECT app_workspace_id())` em `USING` e `WITH CHECK`.
- Toda query de tenant dentro de `withTenant(db, request.tenant, …)`; `workspaceId` só vem da sessão.
- Erro da API: `{ error: { code: 'validation' | 'not_found' | 'conflict', message, fields? } }` com 400/404/409.
- Limites: nome de conta 1–60, instituição ≤ 60, descrição 1–140, observação ≤ 500, dias 1–31, página 50.
- Tipos de conta: `checking` | `savings` | `cash` | `credit_card`. Tipo de categoria: `expense` | `income` | `movement`. `source`: `manual`.
- Identidade visual da spec anterior (tokens, `Field`, `Button`, `Panel`, `Figure`); textos em pt-BR, sentence case.
- Commits sem linha de coautoria.

## Review Focus

1. **Transação apontando para conta/categoria de outro workspace** (FKs ignoram RLS): esperado 404, nunca gravar. — Task 2 (FK composta) e Task 4 (teste de API).
2. **Mudar o tipo de uma conta depois de criada** (ex.: corrente → cartão): esperado 400; tipo é imutável. — Task 3.
3. **Alterar o dia de fechamento de um cartão com lançamentos**: esperado recalcular `statement_month` dos lançamentos daquele cartão. — Task 3.
4. **Busca com `%` ou `_`** ("50%"): esperado busca literal. — Task 4.
5. **Valor inválido** (`"0"`, `"-0"`, maior que 15 dígitos, `"12,5"` na API): esperado 400 com `fields.amountCents`. — Task 4.

---

## File Structure

```
packages/domain/src/
  dates/today.ts                 todayInSaoPaulo()
  accounts/statement-month.ts    statementMonth()
  accounts/balance.ts            accountBalance(), openInvoice()
  categories/default-categories.ts  DEFAULT_CATEGORIES
packages/db/
  src/schema/finance.ts          financialAccounts, categories, transactions
  src/categories.ts              seedDefaultCategories(tx, workspaceId)
  src/workspaces.ts              (modifica) semeia categorias ao criar workspace
  migrations/0003_*.sql (gerada) + 0004_finance_rls.sql (custom)
  test/finance-rls.integration.test.ts
packages/contracts/src/
  money.ts, accounts.ts, categories.ts, transactions.ts, errors.ts
apps/api/src/
  http/errors.ts                 ApiError, errorHandler
  modules/accounts/{routes,repository}.ts
  modules/categories/routes.ts
  modules/transactions/{routes,repository,cursor}.ts
apps/api/test/{accounts,transactions}.integration.test.ts, test/helpers.ts
apps/web/src/
  lib/api.ts                     (modifica) + apiSend()
  lib/money.ts                   formatCents(), parseAmountInput()
  app/painel/nav.tsx
  app/painel/contas/{page,nova/page,[id]/page,account-form,actions}.tsx|ts
  app/painel/transacoes/{page,nova/page,[id]/page,transaction-form,filters,actions}.tsx|ts
  e2e/{contas,transacoes}.spec.ts
```

---

### Task 1: Regras de domínio

**Files:** Create os arquivos de `packages/domain/src` acima e exporte em `src/index.ts`. Test: `*.test.ts` ao lado de cada arquivo.

**Interfaces — Produces:**
- `todayInSaoPaulo(now?: Date): string` — `YYYY-MM-DD` via `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })`.
- `statementMonth(postedDate: string, closingDay: number): string` — `YYYY-MM-01`.
- `accountBalance(openingCents: bigint, openingDate: string, txs: { postedDate: string; amountCents: bigint }[]): bigint`
- `openInvoice(txs: { statementMonth: string | null; amountCents: bigint }[], month: string): bigint` — valor devido (positivo quando há compras).
- `type DefaultCategory = { key: string; name: string; kind: 'expense' | 'income' | 'movement'; parentKey?: string }`; `DEFAULT_CATEGORIES: readonly DefaultCategory[]` com a árvore de `docs/architecture.md` §10; chaves em inglês com ponto (`food`, `food.delivery`, `transport.fuel`, `movement.transfer` …).

- [ ] **Step 1: Write the failing tests**

```ts
it.each([
  ['2026-10-10', 10, '2026-10-01'],
  ['2026-10-11', 10, '2026-11-01'],
  ['2026-12-20', 15, '2027-01-01'],
  ['2026-02-28', 31, '2026-02-01'],
  ['2026-03-01', 31, '2026-03-01'],
  ['2026-04-30', 31, '2026-04-01'],
])('statementMonth(%s, %i) = %s', (d, c, m) => expect(statementMonth(d, c)).toBe(m));

it('accountBalance soma só a partir da data inicial', () =>
  expect(accountBalance(100000n, '2026-10-01', [
    { postedDate: '2026-09-30', amountCents: -5000n },
    { postedDate: '2026-10-01', amountCents: -2500n },
    { postedDate: '2026-10-05', amountCents: 10000n },
  ])).toBe(107500n));

it('openInvoice', () =>
  expect(openInvoice([
    { statementMonth: '2026-10-01', amountCents: -4590n },
    { statementMonth: '2026-10-01', amountCents: -1000n },
    { statementMonth: '2026-11-01', amountCents: -999n },
    { statementMonth: '2026-10-01', amountCents: 590n }, // estorno
  ], '2026-10-01')).toBe(5000n));

it('todayInSaoPaulo usa o fuso', () =>
  expect(todayInSaoPaulo(new Date('2026-10-08T02:30:00Z'))).toBe('2026-10-07'));

it('DEFAULT_CATEGORIES íntegra', () => {
  const keys = DEFAULT_CATEGORIES.map((c) => c.key);
  expect(new Set(keys).size).toBe(keys.length);
  for (const c of DEFAULT_CATEGORIES) {
    if (!c.parentKey) continue;
    const parent = DEFAULT_CATEGORIES.find((p) => p.key === c.parentKey);
    expect(parent).toBeDefined();
    expect(parent?.parentKey).toBeUndefined();
    expect(parent?.kind).toBe(c.kind);
  }
  expect(keys).toEqual(expect.arrayContaining(['food.delivery', 'transport.fuel', 'subscriptions.streaming', 'income.salary', 'movement.transfer', 'movement.card_payment']));
});
```

- [ ] **Step 2: Run** `pnpm --filter @finlens/domain test` — Expected: FAIL (módulos inexistentes).
- [ ] **Step 3: Implement** (datas com aritmética de `Date.UTC`, sem fuso local).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(domain): add statement month, balances and default categories`

---

### Task 2: Schema, RLS e semente de categorias

**Files:** Create `packages/db/src/schema/finance.ts`, `packages/db/src/categories.ts`, migrations; Modify `packages/db/src/schema/index.ts`, `packages/db/src/workspaces.ts`, `packages/db/src/index.ts`, `packages/db/package.json` (dep `@finlens/domain`). Test: `packages/db/test/finance-rls.integration.test.ts`, `packages/db/test/workspaces.integration.test.ts`.

**Interfaces:**
- Consumes: `DEFAULT_CATEGORIES` (Task 1), `withTenant`.
- Produces: tabelas Drizzle `financialAccounts`, `categories`, `transactions` (colunas do spec, camelCase no TS); `seedDefaultCategories(tx: Tx, workspaceId: string): Promise<void>`; `ensurePersonalWorkspace` semeia categorias **só** na chamada que inseriu o workspace.
- FKs compostas: `UNIQUE (workspace_id, id)` em `financial_accounts` e `categories`; `transactions (workspace_id, account_id) → financial_accounts (workspace_id, id)` e `(workspace_id, category_id) → categories (workspace_id, id)` (`MATCH SIMPLE`, categoria nula permitida); `categories (workspace_id, parent_id) → categories (workspace_id, id)`. `UNIQUE (workspace_id, system_key)` em categorias. CHECKs: `type in (...)`, `kind in (...)`, `source in ('manual')`, `amount_cents <> 0`, dias entre 1 e 31, cartão exige `closing_day` e `due_day`, não-cartão exige `opening_balance_date`.

- [ ] **Step 1: Write the failing tests**

```ts
// finance-rls.integration.test.ts (seed: u1/w1 e u2/w2 via ensurePersonalWorkspace; conta A1 em w1)
it('sem contexto não vê contas, categorias nem transações', …toHaveLength(0) nas três);
it('categorias padrão semeadas uma vez', async () => {
  const rows = await withTenant(db, { userId: u1, workspaceId: w1 }, (tx) => tx.select().from(categories));
  expect(rows.length).toBe(DEFAULT_CATEGORIES.length);
});
it('transação não referencia conta de outro workspace', async () => {
  await expect(withTenant(db, { userId: u2, workspaceId: w2 }, (tx) =>
    tx.insert(transactions).values({ workspaceId: w2, accountId: a1, postedDate: '2026-10-01', amountCents: -100n, description: 'x', source: 'manual' }),
  )).rejects.toMatchObject({ cause: { message: expect.stringMatching(/foreign key/) } });
});
it('não grava em outro workspace', …insert com workspaceId: w1 sob contexto u2/w2 rejeita /row-level security/);

// workspaces.integration.test.ts (acrescentar)
it('chamadas concorrentes semeiam categorias uma vez', …Promise.all de 5 ensurePersonalWorkspace para usuário novo; count = DEFAULT_CATEGORIES.length);
```

- [ ] **Step 2: Run** `pnpm --filter @finlens/db test:integration` — Expected: FAIL.
- [ ] **Step 3: Implement** — `db:generate` para as tabelas; migration custom `finance_rls` com RLS das três tabelas (padrão do ADR 0002). Em `ensurePersonalWorkspace`, usar `.returning()` no insert do workspace; se retornou linha, inserir membership, fazer `set_config('app.workspace_id', id, true)` e `seedDefaultCategories` na mesma transação (pais antes dos filhos).
- [ ] **Step 4: Run** — Expected: PASS (inclui testes antigos de RLS e workspaces). Rodar `pnpm --filter @finlens/db db:migrate` no banco de dev.
- [ ] **Step 5: Commit** — `feat(db): add accounts, categories and transactions with RLS`

---

### Task 3: Contratos, erros da API e contas

**Files:** Create `packages/contracts/src/{money,errors,accounts,categories,transactions}.ts`, `apps/api/src/http/errors.ts`, `apps/api/src/modules/accounts/{routes,repository}.ts`, `apps/api/test/helpers.ts`; Modify `apps/api/src/app.ts`. Test: `apps/api/test/accounts.integration.test.ts`.

**Interfaces:**
- Produces (contracts):
  - `Cents = z.string().regex(/^-?\d{1,15}$/)`; `NonZeroCents` recusa `"0"` e `"-0"`; `IsoDate = z.iso.date()`.
  - `AccountType`, `Account = { id, name, type, institution: string|null, openingBalanceCents: Cents, openingBalanceDate: IsoDate|null, closingDay: number|null, dueDay: number|null, balanceCents: Cents|null, openInvoiceCents: Cents|null, currentStatementMonth: IsoDate|null }`.
  - `AccountCreate` (union discriminada por `type`: cartão exige `closingDay`, `dueDay`; demais exigem `openingBalanceDate`, `openingBalanceCents` padrão `"0"`), `AccountUpdate` (parcial, **sem** `type`, `.strict()`).
  - `ApiErrorBody = { error: { code, message, fields?: Record<string,string> } }`.
- Produces (api): `class ApiError(status: 400|404|409, code, message, fields?)`; `errorHandler` registra `setErrorHandler` convertendo `ZodError` em 400 `validation` com `fields` por caminho; erros desconhecidos → 500 sem detalhes.
- Rotas `/v1/accounts` do spec. `PATCH` com `closingDay` diferente recalcula `statement_month` de todas as transações da conta na mesma transação (via `statementMonth`).
- `apps/api/test/helpers.ts`: `createTestApp(): Promise<{ app, ownerDb, db, signUp(email): Promise<{ cookie, userId }>, close() }>` reaproveitando o padrão de `auth.integration.test.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
it('cria conta corrente e devolve saldo inicial', …POST {name:'Inter', type:'checking', institution:'Banco Inter', openingBalanceCents:'150000', openingBalanceDate:'2026-10-01'} → 201; GET lista contém balanceCents '150000', openInvoiceCents null);
it('cria cartão e exige dias', …POST type credit_card sem closingDay → 400 com fields.closingDay; com closingDay 10, dueDay 17 → 201, currentStatementMonth preenchido);
it('tipo é imutável', …PATCH {type:'credit_card'} → 400);
it('mudar fechamento recalcula faturas', …cartão closingDay 10, transação em 2026-10-15 (statement 2026-11-01); PATCH closingDay 20 → transação passa a 2026-10-01);
it('conta de outro usuário é 404', …PATCH/DELETE com cookie de outro usuário → 404 not_found);
it('arquivar some da lista', …DELETE → 204; GET não lista);
```

(O teste de recálculo insere a transação direto via `ownerDb` com contexto, pois a rota de transações é da Task 4.)

- [ ] **Step 2: Run** `pnpm --filter @finlens/api test:integration` — Expected: FAIL.
- [ ] **Step 3: Implement**. Saldo calculado em SQL: `opening_balance_cents + coalesce(sum(amount_cents) filter (where posted_date >= opening_balance_date), 0)`; fatura: `-sum(amount_cents) filter (where statement_month = :month)` com `:month = statementMonth(todayInSaoPaulo(), closing_day)` calculado por conta no TS.
- [ ] **Step 4: Run** — Expected: PASS (inclui `auth.integration.test.ts`).
- [ ] **Step 5: Commit** — `feat(api): add accounts endpoints and error format`

---

### Task 4: Categorias e transações na API

**Files:** Create `apps/api/src/modules/categories/routes.ts`, `apps/api/src/modules/transactions/{routes,repository,cursor}.ts`; Modify `apps/api/src/app.ts`. Test: `apps/api/test/transactions.integration.test.ts`, `apps/api/src/modules/transactions/cursor.test.ts`.

**Interfaces:**
- Consumes: contratos e `ApiError` (Task 3), `statementMonth` (Task 1).
- Produces:
  - `CategoryNode = { id, name, kind, systemKey: string|null, children: CategoryNode[] }`; `GET /v1/categories` → `CategoryNode[]` (raízes ordenadas por nome, filhos por nome, sem arquivadas).
  - `Transaction = { id, accountId, categoryId: string|null, postedDate, statementMonth: IsoDate|null, amountCents: Cents, description, notes: string|null, source: 'manual' }`.
  - `TransactionCreate = { accountId: uuid, categoryId?: uuid|null, postedDate: IsoDate, amountCents: NonZeroCents, description: 1–140, notes?: ≤500 }`; `TransactionUpdate` parcial `.strict()`.
  - `TransactionPage = { items: Transaction[], nextCursor: string | null }`; query `TransactionQuery = { accountId?, categoryId?, from?, to?, q? (≤100), cursor? }`.
  - `encodeCursor(postedDate: string, id: string): string` / `decodeCursor(c: string): { postedDate: string; id: string } | null` (base64url; inválido → `null` → 400).
- Regras: conta/categoria inexistente no workspace → 404 `not_found` (checar com SELECT sob RLS antes do insert; FK composta é a rede de segurança); conta arquivada → 409; `statement_month` calculado se a conta é cartão; `q` com `%`, `_` e `\` escapados (`ILIKE … ESCAPE '\'`); página 50 com keyset `(posted_date, id) < (cursor)`.

- [ ] **Step 1: Write the failing tests**

```ts
// cursor.test.ts
it('ida e volta', () => expect(decodeCursor(encodeCursor('2026-10-07', id))).toEqual({ postedDate: '2026-10-07', id }));
it('inválido', () => expect(decodeCursor('@@@')).toBeNull());

// transactions.integration.test.ts
it('categorias em árvore', …GET → raízes com children; contém Alimentação > Delivery);
it('cria saída em cartão com statementMonth', …cartão closingDay 10; POST postedDate 2026-10-15 → statementMonth '2026-11-01');
it('valores inválidos', …para '0', '-0', '1234567890123456', '12,5' → 400 com fields.amountCents);
it('conta de outro usuário → 404 e nada gravado', …usuário B posta com accountId da conta de A → 404; contagem de transações de A inalterada);
it('categoria de outro usuário → 404');
it('conta arquivada → 409');
it('paginação sem repetição nem buraco', …cria 120 transações (60 na mesma data); percorre cursores; ids únicos = 120, ordem posted_date desc, id desc);
it('filtros', …accountId, categoryId, from/to, q case-insensitive);
it('busca literal com %', …descrições '50% off' e '500 reais'; q='50%' → só '50% off');
it('editar e excluir', …PATCH description/amount; DELETE → 204; GET :id ausente da lista; DELETE de outro usuário → 404);
it('saldo reflete lançamentos', …conta corrente com saldo 1000,00 em 2026-10-01; saída -45,90 em 2026-10-02 → GET /v1/accounts balanceCents '95410');
```

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm --filter @finlens/api test && pnpm --filter @finlens/api test:integration` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(api): add categories and transactions endpoints`

---

### Task 5: Web — navegação e contas

**Files:** Modify `apps/web/src/lib/api.ts` (+ `apiSend`), `apps/web/src/app/painel/layout.tsx`, `apps/web/src/app/painel/page.tsx`; Create `apps/web/src/lib/money.ts` (+ test), `apps/web/src/app/painel/nav.tsx`, `apps/web/src/app/painel/contas/*`; Test: `apps/web/src/lib/money.test.ts`, `apps/web/e2e/contas.spec.ts`; Modify `apps/web/e2e/a11y.spec.ts`.

**Interfaces:**
- Consumes: contratos (Tasks 3–4), `parseBRL`/`formatBRL` de `@finlens/domain`.
- Produces:
  - `apiSend<T>(method: 'POST'|'PATCH'|'DELETE', path: string, body: unknown, schema?: ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; status: number; error: ApiErrorBody['error'] }>`; 401 → `UnauthorizedError`.
  - `formatCents(cents: string): string` (`"-4590"` → `"−R$ 45,90"`, com sinal de menos tipográfico U+2212; positivo sem sinal) e `parseAmountInput(input: string): string | null` (usa `parseBRL`, devolve centavos absolutos como string; inválido → `null`).
  - Server Actions com `useActionState`: estado `{ fieldErrors?: Record<string,string>; formError?: string }`; sucesso → `redirect('/painel/contas')`.
  - Navegação: `Início` (`/painel`), `Transações` (`/painel/transacoes`), `Contas` (`/painel/contas`), `aria-current="page"` no item ativo.

- [ ] **Step 1: Write the failing tests**

```ts
// money.test.ts
it('formatCents', () => { expect(formatCents('-4590')).toBe('−R$ 45,90'); expect(formatCents('150000')).toBe('R$ 1.500,00'); });
it('parseAmountInput', () => { expect(parseAmountInput('1.234,56')).toBe('123456'); expect(parseAmountInput('-10')).toBe('1000'); expect(parseAmountInput('abc')).toBeNull(); expect(parseAmountInput('0')).toBeNull(); });

// contas.spec.ts
test('criar conta corrente e cartão', async ({ page }) => {
  await signUp(page);
  await page.getByRole('link', { name: 'Contas' }).click();
  await page.getByRole('link', { name: 'Nova conta' }).click();
  await page.getByLabel('Nome').fill('Inter');
  await page.getByLabel('Tipo').selectOption('checking');
  await page.getByLabel('Instituição').fill('Banco Inter');
  await page.getByLabel('Saldo inicial').fill('1.500,00');
  await page.getByLabel('Data do saldo').fill('2026-10-01');
  await page.getByRole('button', { name: 'Salvar conta' }).click();
  await expect(page.getByRole('row', { name: /Inter.*R\$ 1\.500,00/ })).toBeVisible();
  // cartão
  await page.getByRole('link', { name: 'Nova conta' }).click();
  await page.getByLabel('Nome').fill('Mercado Pago');
  await page.getByLabel('Tipo').selectOption('credit_card');
  await page.getByLabel('Dia de fechamento').fill('10');
  await page.getByLabel('Dia de vencimento').fill('17');
  await page.getByRole('button', { name: 'Salvar conta' }).click();
  await expect(page.getByRole('row', { name: /Mercado Pago.*Fatura aberta/ })).toBeVisible();
});
test('validação mostra erro no campo', …cartão sem fechamento → texto de erro ligado ao campo "Dia de fechamento");
// a11y.spec.ts: incluir /painel/contas e /painel/contas/nova (logado, claro e escuro)
```

- [ ] **Step 2: Run** `pnpm --filter @finlens/web test && pnpm --filter @finlens/web test:e2e` — Expected: FAIL.
- [ ] **Step 3: Implement.** Layout com nav lateral ≥ 1024px e barra horizontal rolável abaixo disso. Tabela de contas com `<table>` semântico. Formulário: `<select>` de tipo; campos condicionais renderizados no servidor a partir de `?tipo=` e trocados no cliente por um pequeno componente controlado. Estado vazio de `/painel`: sem contas → `ButtonLink` "Cadastrar conta"; com contas → "Lançar transação".
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): add navigation and accounts screens`

---

### Task 6: Web — transações

**Files:** Create `apps/web/src/app/painel/transacoes/*`; Test: `apps/web/e2e/transacoes.spec.ts`; Modify `apps/web/e2e/a11y.spec.ts`.

**Interfaces:** Consumes `apiFetch`, `apiSend`, `formatCents`, `parseAmountInput`, `todayInSaoPaulo`, contratos.

- [ ] **Step 1: Write the failing e2e**

```ts
test('lançar, filtrar, editar e excluir', async ({ page }) => {
  await signUp(page);
  // cria conta Inter (helper createAccount no e2e/helpers.ts)
  await page.goto('/painel/transacoes');
  await page.getByRole('link', { name: 'Novo lançamento' }).click();
  await page.getByRole('radio', { name: 'Saída' }).check();
  await page.getByLabel('Valor').fill('45,90');
  await page.getByLabel('Descrição').fill('iFood jantar');
  await page.getByLabel('Conta').selectOption({ label: 'Inter' });
  await page.getByLabel('Categoria').selectOption({ label: 'Alimentação › Delivery' });
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(page.getByRole('row', { name: /iFood jantar.*−R\$ 45,90/ })).toBeVisible();
  // entrada
  …'Salário' +R$ 5.000,00 categoria 'Receitas › Salário'; linha mostra 'R$ 5.000,00'
  // filtro
  await page.getByLabel('Buscar').fill('ifood'); await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page).toHaveURL(/q=ifood/);
  await expect(page.getByRole('row', { name: /Salário/ })).toHaveCount(0);
  // editar e excluir
  await page.getByRole('link', { name: 'iFood jantar' }).click();
  await page.getByLabel('Descrição').fill('iFood almoço');
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(page.getByRole('row', { name: /iFood almoço/ })).toBeVisible();
  await page.getByRole('link', { name: 'iFood almoço' }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Excluir lançamento' }).click();
  await expect(page.getByRole('row', { name: /iFood/ })).toHaveCount(0);
});
test('saldo da conta reflete lançamento', …conta com 1.500,00; saída 45,90 → em Contas a linha mostra R$ 1.454,10);
test('valor inválido mostra erro', …Valor 'abc' → erro "Informe um valor maior que zero, como 45,90." no campo);
// a11y: /painel/transacoes e /painel/transacoes/nova
```

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** Sinal vem do rádio Saída/Entrada (`amountCents = -abs` ou `+abs`). Seletor de categoria em `<optgroup>` por raiz, rótulo `Raiz › Filha`, filtrado pelo tipo escolhido (renderizar as duas listas e alternar no cliente). Filtros num `<form method="get">`. "Carregar mais" é um link com `?cursor=` preservando filtros. Data padrão `todayInSaoPaulo()`. Excluir usa `confirm()` no cliente antes da Server Action.
- [ ] **Step 4: Run** `pnpm --filter @finlens/web test:e2e` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): add transactions list and manual entry`

---

### Task 7: Revisão visual e verificação final

- [ ] **Step 1:** Capturas (script temporário no scratchpad) de `/painel/contas`, `/painel/contas/nova`, `/painel/transacoes`, `/painel/transacoes/nova` em 1440 e 375, claro e escuro, com dados de exemplo; revisar e corrigir.
- [ ] **Step 2:** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm --filter @finlens/web build && pnpm --filter @finlens/web test:e2e` — Expected: tudo PASS.
- [ ] **Step 3:** Commit de ajustes, se houver — `fix(web): visual polish for accounts and transactions`
