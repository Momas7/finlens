# F3b — Recorrências Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detectar recorrências a partir do histórico de saídas, listá-las e gerar insights de cobrança ausente, aumento de preço e assinatura nova.

**Architecture:** `detectRecurrences` puro no domínio; endpoint e contexto de insights usam o mesmo carregador de saídas; tela nova em Server Component. Sem migração.

**Tech Stack:** TypeScript, Fastify, Drizzle, Next.js 16, Vitest, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-15-f3b-recorrencias-design.md`

## Global Constraints

- Tolerâncias e limiares da spec (7±2, 30±5, 91±8, 365±15; 70%; ±15%; 5% e R$ 2; 60 dias; patamar a 2%).
- Movimentação e pares ligados ficam de fora; só saídas.
- Textos fixos da spec. Sem `Co-Authored-By` nem rodapé de ferramenta.

## Review Focus

1. **Duas cobranças no mesmo dia** (duplicata): contam como uma ocorrência, não quebram o intervalo. — Task 1.
2. **Aumento seguido de volta ao normal** (valor isolado): não é aumento de preço. — Task 1.
3. **Recorrência trimestral atrasada**: não gera "não apareceu" (só semanal e mensal). — Task 1.
4. **Dia 31 / fim de mês**: intervalos de 28–31 dias seguem mensais. — Task 1.
5. **Usuário sem saídas**: lista vazia, totais zero. — Task 2.

---

### Task 1: Domínio — detecção e geradores

**Files:** Create `packages/domain/src/recurrences/{detect.ts,detect.test.ts,index.ts}`, `packages/domain/src/insights/recurrence-generators.ts` (+ testes em `recurrence-generators.test.ts`); Modify `packages/domain/src/insights/{types,generators}.ts`, `packages/domain/src/insights/test-helpers.ts` (`recurrences: []`), `packages/domain/src/index.ts`.

**Produces:** `Recurrence`, `RecurrenceExpense`, `detectRecurrences(expenses, today)`, `recurrenceMissing(ctx)`, `priceIncrease(ctx)`, `newSubscription(ctx)`; `InsightContext.recurrences`; novos `InsightKind`: `recurrence_missing | price_increase | new_subscription`.

- [ ] Testes que falham (datas em ISO): mensal clássico (6 cobranças, 30/31 dias, valor fixo); semanal; trimestral; 2 ocorrências → nada; valores variáveis → nada; intervalos irregulares → nada; variação ±10% passa, ±30% não; estados `late`/`active`/`ended`; trimestral atrasada fica `active`; aumento 5% e R$ 2 nas duas últimas; valor isolado que volta ao normal não vale; aumento < R$ 2 não vale; `isNew`; duplicata no mesmo dia vira 1 ocorrência; ordem de entrada embaralhada dá o mesmo resultado; vazio → `[]`; geradores: textos, impactos, chaves, severidades.
- [ ] RED → implementar → GREEN → `git commit -m "feat(domain): recurrence detection and insights"`

### Task 2: API

**Files:** Create `packages/contracts/src/recurrences.ts`, `apps/api/src/modules/recurrences/{queries,routes}.ts`, `apps/api/test/recurrences.integration.test.ts`; Modify `packages/contracts/src/index.ts`, `apps/api/src/modules/insights/context.ts`, `apps/api/src/app.ts`.

- [ ] Testes (usuário novo por cenário, `createTestApp({ AUTH_RATE_LIMIT_PER_MINUTE: '100' })`): Netflix 5 meses antes + aumento nos 2 últimos → item mensal, `priceChange`, `totals.monthlyCents`; mercado variável fora; transferência ligada fora; Spotify com 3 cobranças a cada 28 dias terminando há 3 dias → `isNew`; `/v1/insights` traz `price_increase` e `new_subscription`; cobrança que não veio (6 cobranças mensais terminando há ~45 dias) → `late` e insight `recurrence_missing`; isolamento; usuário sem saídas → `{ items: [], totals: { monthlyCents: '0', count: 0 } }`.
- [ ] RED → implementar (loader compartilhado) → GREEN (`pnpm --filter @finlens/api test:integration`) → `git commit -m "feat(api): recurrences endpoint and insights"`

### Task 3: Web

**Files:** Create `apps/web/src/app/painel/recorrencias/page.tsx`, `apps/web/e2e/recorrencias.spec.ts`; Modify `apps/web/src/app/painel/nav.tsx`, `apps/web/e2e/a11y.spec.ts`.

- [ ] E2E: lançamentos com datas passadas montam Netflix (aumento) e Spotify (nova); a página mostra o total mensal, "Próxima por volta de", "subiu de" e "nova"; estado vazio; insight "Aumento de preço" na Início e dispensável; a11y.
- [ ] RED → implementar → GREEN → `git commit -m "feat(web): recurrences page"`

### Task 4: Demo, README e verificação final

- [ ] Plano demo (Spotify novo, Netflix R$ 59,90 no mês corrente); testes do gerador e da integração da demo atualizados; README (roadmap F3b ✅).
- [ ] Suíte completa PASS.
