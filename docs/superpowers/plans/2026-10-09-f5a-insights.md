# F5a — Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sete geradores de insight puros, ranking com novidade e dispensa, API calculando na hora e telas na Início e em `/painel/insights`.

**Architecture:** Domínio puro recebe `InsightContext` com as saídas cruas dos últimos 7 meses e agrega sozinho; a API só busca dados (uma consulta de saídas + `rootTotals`/`activeMonths`/`loadBudgetMonth`) e cruza com `insight_states`.

**Tech Stack:** TypeScript, Drizzle/Postgres RLS, Fastify, Next.js 16, Vitest, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-09-f5a-insights-design.md`

## Global Constraints

- Limiares exatos da spec: spike ×1,3 e ≥ R$ 100 com ≥ 3 meses; pequenas < R$ 30, ≥ 10 e ≥ R$ 150; anomalia z ≥ 3,5 (MAD×1,4826), ≥ 5 históricos, ≥ R$ 50, MAD 0 → ≥ 2×med; duplicata ≤ 2 dias, mesma conta/valor/grupo; poupança queda ≥ 0,10 com 3 meses; filtro impacto ≥ R$ 20; peso warning 1,5, novo 1,3 (< 3 dias); limite 20; Início mostra 3.
- Textos fixos da spec (títulos, corpos, ações, "O que mudou", vazio, erro, "Dispensar: {título}", "Ver todos ({n})", "novo").
- Dinheiro bigint; API em string. Mês civil de São Paulo.
- RLS ENABLE+FORCE em migração própria.
- Sem `Co-Authored-By` nem rodapé de ferramenta.

## Review Focus

1. **Descrição normalizada vazia** (ex.: "123456"): `groupKey` nulo → nunca agrupa em anomalia/duplicata. — Task 1 testa.
2. **Mesmo lançamento disparando anomalia e duplicata**: ambos aparecem, chaves diferentes; dispensar um não some o outro. — Task 3.
3. **Dia 31 vs meses de 30 no recorte do spike**: recorte usa `min(day, último dia)`. — Task 1.
4. **Insight dispensado cujo id muda** (ex.: duplicata ganha terceiro lançamento → novo par): par antigo continua dispensado; novo par aparece. — Task 1 (pares consecutivos) + Task 3.
5. **Usuário sem nenhum lançamento**: `items: []`, sem erro de mediana vazia. — Task 1 e 3.

---

### Task 1: Domínio — geradores e ranking

**Files:** Create `packages/domain/src/insights/{types,stats,generators,rank,index}.ts` + `generators.test.ts`, `rank.test.ts`, `stats.test.ts`; Modify `packages/domain/src/index.ts`.

**Interfaces — Produces:**
- Tipos `InsightContext`, `InsightExpense`, `InsightCandidate`, `InsightSeverity`, `InsightKind` (forma da spec).
- `median(values: bigint[]): bigint` (par = média arredondando para baixo), `robustZ(x: bigint, history: bigint[]): number | null` (null se MAD = 0).
- `generateInsights(ctx): InsightCandidate[]` (roda os 7) e cada gerador exportado: `categorySpike`, `smallPurchases`, `anomalies`, `fees`, `duplicates`, `budgetPace`, `savings`.
- `rankInsights(candidates, states: Map<string, { firstSeenAt: Date; dismissed: boolean }>, now: Date, limit: number): (InsightCandidate & { isNew: boolean })[]`.
- Helper de teste: `ctx(overrides)` com `month '2026-10'`, `today '2026-10-20'`, `day 20`, listas vazias.

- [ ] **Step 1: Testes que falham** (valores em centavos; `e(id, date, amount, extra?)` monta `InsightExpense`):
  - `median([3n,1n,2n]) = 2n`; `median([1n,2n,3n,4n]) = 2n`; `robustZ(48000n, [15000n×5]) = null`; `robustZ(30000n,[10000n,11000n,9000n,10000n,12000n])` ≈ (30000−10000)/(1,4826×1000).
  - spike: Alimentação com 60000 até dia 20 em out e 40000/42000/38000 (até dia 20) em jul/ago/set (activeMonths 3) → 1 candidato, impacto 20000, warning, chave `category_spike:2026-10:food`; com só 2 meses ativos → nada; 51000 (≥ ×1,3 falha) → nada; ×1,3 mas diferença 9000 → nada; gasto de set no dia 25 não entra no recorte.
  - pequenas: 10 × 1500 → impacto 15000 info; 9 × 2000 → nada; 10 × 1400 → nada (soma 14000); 3000 exatos não conta.
  - anomalia: histórico 5 × 15000 do grupo `m:shell` + 48000 em out → dispara (MAD 0, ≥ 2×), impacto 33000, corpo "Shell: R$ 480,00 em 05/10, normalmente R$ 150,00."; 4 históricos → nada; 29000 (< 2×) → nada; `groupKey null` → nada.
  - tarifas: 1200 em `fees` → info; + 3000 `interest` → warning, impacto 4200.
  - duplicata: dois 5590 `d:netflix` mesma conta em 03/10 e 04/10 → 1, chave `duplicate:a:b` ordenada; 3 dias → nada; contas diferentes → nada; três (03,04,05) → 2 pares.
  - orçamento: over 18000/15000 → "Lazer passou do orçamento", impacto 3000; overOnDay 23 → impacto projetado − limite; sem estes → nada.
  - poupança: set income 500000 expense 532000 → warning impacto 32000; taxas jun/jul/ago 0,30/0,25/0,20 e set 0,10 → info, impacto `(0,25−0,10)×inc`; sem entrada em set → nada.
  - rank: impacto 1999 descartado; warning×1,5 supera info maior por < 1,5×; novo (firstSeen ausente ou < 3 dias) ganha ×1,3 e `isNew`; dispensado some; limit respeitado.
- [ ] **Step 2:** `pnpm --filter @finlens/domain test` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** `git commit -m "feat(domain): insight generators and ranking"`

---

### Task 2: Banco — `insight_states`

**Files:** Modify `packages/db/src/schema/finance.ts`; migrations `0012_*` (gerada) + `0013_insight_states_rls.sql` (`drizzle-kit generate --custom`); Create `packages/db/test/insights.integration.test.ts`.

**Produces:** `insightStates` (`id, workspaceId, dedupeKey, firstSeenAt, dismissedAt`), exportado.

- [ ] **Step 1:** Teste (padrão `budgets.integration.test.ts`): isolamento por workspace; não grava em outro workspace; chave duplicada no mesmo workspace falha.
- [ ] **Step 2:** FAIL. **Step 3:** schema + migrações. **Step 4:** `pnpm --filter @finlens/db test:integration` PASS (inclui cobertura de RLS). Aplicar no dev: `pnpm --filter @finlens/db db:migrate`.
- [ ] **Step 5:** `git commit -m "feat(db): insight states"`

---

### Task 3: API — `/v1/insights`

**Files:** Create `packages/contracts/src/insights.ts`, `apps/api/src/modules/insights/{context,routes}.ts`, `apps/api/test/insights.integration.test.ts`; Modify `packages/contracts/src/index.ts`, `apps/api/src/app.ts`.

**Interfaces:**
- Consumes: Task 1, Task 2, `rootTotals`, `activeMonths` (`analytics/aggregate.ts`), `loadBudgetMonth`, `groupKey` (`review/queries.ts`), `MERCHANTS` para rótulo.
- Produces: contratos `Insight`, `InsightList = { items: Insight[] }`, `InsightQuery = { limit?: 1..20 }` (coerce), `DismissInsight = { id: 16 hex }`; `loadInsightContext(tx, today): Promise<InsightContext>`; `currentInsights(tx, today, limit)`.
- `expenses`: uma consulta em `transactions` left join `categories c` (e a raiz via `coalesce(c.parent_id, c.id)` + nome da raiz numa segunda busca de categorias), `amount_cents < 0`, `c.kind is distinct from 'movement'`, de `monthRange(lastMonths(month,7)[0]).from` até `monthRange(month).to`.
- GET grava `first_seen_at` dos itens servidos (insert on conflict do nothing) **depois** de ranquear (o `isNew` da primeira resposta vem do estado ausente).

- [ ] **Step 1: Testes que falham** (`insights.integration.test.ts`, usuário novo por teste):
  - 'duplicata': dois −5590 'NETFLIX' na mesma conta em dias consecutivos do mês corrente (use dias `01`/`02` se hoje ≥ 2; senão hoje e ontem não existe → pular com `it.skipIf(day < 2)`) → item `kind 'duplicate'`, `severity 'warning'`, `impactCents '5590'`, `isNew true`, `action.label 'Ver lançamentos'`.
  - 'sem lançamentos' → `{ items: [] }`.
  - 'novidade': segunda leitura ainda `isNew` (< 3 dias); alterar `first_seen_at` para 4 dias atrás via `withTenant` → `isNew false`.
  - 'dispensar': POST dismiss → 204; GET sem o item; dispensar de novo → 204; id inexistente válido → 204; `id: 'x'` → 400.
  - 'anomalia e duplicata independentes': histórico de 5 × −15000 'POSTO SHELL' em meses anteriores + dois −48000 no mês em dias seguidos → aparecem `anomaly` (2) e `duplicate`; dispensar a duplicata mantém as anomalias.
  - 'tarifas': −1200 em Financeiro › Tarifas + −3000 em Financeiro › Juros → `fees` warning impacto 4200.
  - 'isolado': outro usuário vê `[]` e seu dismiss do id alheio não afeta o dono.
  - `?limit=0` e `?limit=21` → 400.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** `pnpm --filter @finlens/api test:integration` PASS.
- [ ] **Step 5:** `git commit -m "feat(api): insights computed on demand"`

---

### Task 4: Web — Início e `/painel/insights`

**Files:** Create `apps/web/src/app/painel/insights/{page,actions}.tsx|ts`, `apps/web/src/components/insight-card.tsx` (+ client `dismiss-button.tsx`), `apps/web/e2e/insights.spec.ts`; Modify `apps/web/src/app/painel/{page,nav}.tsx`, `e2e/a11y.spec.ts`.

**Interfaces:** `InsightCard({ insight })` server; `DismissButton({ id, title })` client chamando `dismissInsight(id)` (Server Action, `revalidatePath('/painel','layout')`). Início busca `/v1/insights?limit=20` com `.catch` (UnauthorizedError relança) só quando `month === current`; mostra 3 e "Ver todos (n)" se n > 3.

- [ ] **Step 1: Testes que falham** (`insights.spec.ts`):
  - 'duplicata aparece na Início e some ao dispensar': conta; `addExpense('NETFLIX','55,90','Assinaturas › Streaming de vídeo', dia1)` e `dia2` (datas do mês corrente: `01` e `02`; `test.skip` se hoje for dia 1) → região "O que mudou" contém "Possível cobrança duplicada" e "NETFLIX R$ 55,90 apareceu em 01/"; botão "Dispensar: Possível cobrança duplicada" → região some.
  - 'ação abre a lista': clicar "Ver lançamentos" do cartão → URL `/painel/transacoes?q=` e linha NETFLIX visível.
  - 'página e vazio': usuário novo `/painel/insights` → "Nada fora do comum por enquanto."; com a duplicata → item listado com selo "novo".
  - a11y: `/painel` com insight e `/painel/insights` (claro/escuro).
- [ ] **Step 2:** RED. **Step 3:** Implementar (frontend-design: cartão com fita lateral de severidade, sem SaaS-card genérico). **Step 4:** `pnpm --filter @finlens/web test && pnpm --filter @finlens/web test:e2e insights.spec.ts painel.spec.ts a11y.spec.ts` PASS.
- [ ] **Step 5:** `git commit -m "feat(web): insights on home and insights page"`

---

### Task 5: Verificação final

- [ ] Capturas (Início com insights, `/painel/insights`; 1440/375; claro/escuro) e ajustes.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm eval:classifier --check && pnpm --filter @finlens/web build && pnpm --filter @finlens/web test:e2e` PASS.
- [ ] Commit de ajustes.
