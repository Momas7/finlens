# F3c — Parcelas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detectar parcelamentos, projetar as parcelas que faltam e mostrar o compromisso mês a mês, com dois insights.

**Architecture:** `detectInstallmentPlans` e `commitmentByMonth` puros no domínio; carregador de saídas compartilhado com as recorrências; página nova em Server Component. Sem migração.

**Tech Stack:** TypeScript, Fastify, Drizzle, Next.js 16, Vitest, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-16-f3c-parcelas-design.md`

## Global Constraints

- Regras da spec (15% por valor, 62 dias para `stale`, até 24 parcelas e meses, 30% da renda mediana).
- Textos fixos da spec. Sem `Co-Authored-By` nem rodapé de ferramenta.

## Review Focus

1. **Parcela não lançada** (a esperada já passou): cronograma começa no primeiro mês com data ≥ hoje. — Task 1.
2. **Dois parcelamentos do mesmo estabelecimento com valores diferentes** viram dois planos; com o mesmo valor mas parcelas repetidas, também. — Task 1.
3. **Dia 31 / fevereiro / virada de ano** no cronograma. — Task 1.
4. **Compra única "03/10" sem relação com parcela** (marca inválida): ignorada. — Task 1/2.
5. **Usuário sem parcelas**: lista vazia, totais zero. — Task 2.

---

### Task 1: Domínio

**Files:** Create `packages/domain/src/installments/{plans.ts,plans.test.ts,index.ts}`, `packages/domain/src/insights/installment-generators.ts` (+ `.test.ts`); Modify `insights/{types,generators,test-helpers}.ts`, `packages/domain/src/index.ts`.

**Produces:** `InstallmentExpense`, `InstallmentPlan`, `detectInstallmentPlans`, `commitmentByMonth`, `highCommitment`, `installmentEnding`; `InsightContext.installments`; kinds `high_commitment | installment_ending`.

- [ ] Testes que falham, RED → implementar → GREEN → `git commit -m "feat(domain): installment plans and insights"`

### Task 2: API

**Files:** Create `packages/contracts/src/installments.ts`, `apps/api/src/modules/installments/{queries,routes}.ts`, `apps/api/test/installments.integration.test.ts`; Modify `apps/api/src/modules/recurrences/queries.ts` (base compartilhada), `insights/context.ts`, `app.ts`, `packages/contracts/src/{index,insights}.ts`.

- [ ] Testes (usuário novo por cenário): Magalu 1/10..3/10 → plano ativo; notebook concluído (10/10) em `done`; parcela vista há 4 meses em `stale` fora do compromisso; vazio; isolamento; recorrências seguem ignorando; insights. RED → implementar → GREEN → `git commit -m "feat(api): installments endpoint and insights"`

### Task 3: Web

**Files:** Create `apps/web/src/app/painel/parcelas/page.tsx`, `apps/web/e2e/parcelas.spec.ts`; Modify `nav.tsx`, `e2e/a11y.spec.ts`.

- [ ] E2E (página, mês a mês, encerradas, vazio, insight dispensável, axe). RED → implementar → GREEN → `git commit -m "feat(web): installments page"`

### Task 4: Demo, README e verificação final

- [ ] Plano demo (Magalu e Notebook) e testes; README (roadmap F3c ✅); suíte completa PASS.
