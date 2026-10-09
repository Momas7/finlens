import type { BudgetItem, BudgetMonth } from '@finlens/contracts';
import { budgets, categories, type Tx } from '@finlens/db';
import {
  type BudgetVersion,
  budgetState,
  lastMonths,
  limitFor,
  type Month,
  monthRange,
  pace,
  previousMonth,
  suggestBudget,
} from '@finlens/domain';
import { and, eq, isNull, lte } from 'drizzle-orm';
import { activeMonths, rootTotals } from '../analytics/aggregate';

const SUGGESTION_MONTHS = 6;
/** Com poucas saídas (ex.: só o aluguel), projeção linear engana. */
const PACE_MIN_EXPENSES = 3;

/** Categorias principais de despesa ativas: as únicas que aceitam orçamento. */
export function budgetableRoots(tx: Tx) {
  return tx
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(
      and(
        isNull(categories.parentId),
        isNull(categories.archivedAt),
        eq(categories.kind, 'expense'),
      ),
    );
}

/** Versões de orçamento com início até o mês, agrupadas por categoria. */
async function versionsUpTo(tx: Tx, month: Month): Promise<Map<string, BudgetVersion[]>> {
  const rows = await tx
    .select({
      categoryId: budgets.categoryId,
      effectiveFrom: budgets.effectiveFrom,
      amountCents: budgets.amountCents,
    })
    .from(budgets)
    .where(lte(budgets.effectiveFrom, monthRange(month).from));
  const byCategory = new Map<string, BudgetVersion[]>();
  for (const r of rows) {
    const list = byCategory.get(r.categoryId) ?? [];
    list.push({ effectiveFrom: r.effectiveFrom.slice(0, 7), amountCents: r.amountCents });
    byCategory.set(r.categoryId, list);
  }
  return byCategory;
}

/** Limite vigente no mês por categoria principal ativa (só as que têm limite). */
export async function limitsFor(tx: Tx, month: Month): Promise<Map<string, bigint>> {
  const [roots, versions] = await Promise.all([budgetableRoots(tx), versionsUpTo(tx, month)]);
  const limits = new Map<string, bigint>();
  for (const root of roots) {
    const limit = limitFor(versions.get(root.id) ?? [], month);
    if (limit !== null) limits.set(root.id, limit);
  }
  return limits;
}

const stateRank = { over: 0, warning: 1, ok: 2 } as const;

/** Orçamentos do mês: limite, gasto, estado, ritmo (mês corrente) e sugestão (sem limite). */
export async function loadBudgetMonth(tx: Tx, month: Month, today: string): Promise<BudgetMonth> {
  const isCurrent = today.slice(0, 7) === month;
  const day = Number(today.slice(8));
  const daysInMonth = Number(monthRange(month).to.slice(8));
  const window = lastMonths(previousMonth(month), SUGGESTION_MONTHS);
  const from = isCurrent ? (window[0] as Month) : month;

  const [roots, versions, totals, active] = await Promise.all([
    budgetableRoots(tx),
    versionsUpTo(tx, month),
    rootTotals(tx, from, month),
    isCurrent ? activeMonths(tx, window[0] as Month, window.at(-1) as Month) : new Set<Month>(),
  ]);
  const spent = new Map<string, Map<Month, bigint>>();
  const expenseCount = new Map<string, number>();
  for (const r of totals) {
    if (!r.root) continue;
    if (r.month === month) expenseCount.set(r.root, (expenseCount.get(r.root) ?? 0) + r.count);
    const byMonth = spent.get(r.root) ?? new Map<Month, bigint>();
    byMonth.set(r.month, (byMonth.get(r.month) ?? 0n) + r.expense);
    spent.set(r.root, byMonth);
  }
  const usedMonths = window.filter((m) => active.has(m));

  const items: (BudgetItem & { rank: number; sortShare: number; sortSpent: bigint })[] = roots.map(
    (root) => {
      const spentCents = spent.get(root.id)?.get(month) ?? 0n;
      const limit = limitFor(versions.get(root.id) ?? [], month);
      const state = limit === null ? null : budgetState(spentCents, limit);
      const share = limit === null ? null : Number(spentCents) / Number(limit);
      const p =
        limit !== null && isCurrent && (expenseCount.get(root.id) ?? 0) >= PACE_MIN_EXPENSES
          ? pace(spentCents, limit, day, daysInMonth)
          : null;
      const suggested =
        limit === null && isCurrent
          ? suggestBudget(usedMonths.map((m) => spent.get(root.id)?.get(m) ?? 0n))
          : null;
      return {
        categoryId: root.id,
        label: root.name,
        limitCents: limit?.toString() ?? null,
        spentCents: spentCents.toString(),
        share,
        state,
        pace: p && {
          projectedCents: p.projectedCents.toString(),
          overOnDay: p.overOnDay,
          dailyAllowanceCents: p.dailyAllowanceCents?.toString() ?? null,
        },
        suggestion:
          suggested === null
            ? null
            : { amountCents: suggested.toString(), months: usedMonths.length },
        rank: state === null ? 3 : stateRank[state],
        sortShare: share ?? 0,
        sortSpent: spentCents,
      };
    },
  );

  items.sort(
    (a, b) =>
      a.rank - b.rank ||
      (a.rank < 3
        ? b.sortShare - a.sortShare
        : b.sortSpent > a.sortSpent
          ? 1
          : b.sortSpent < a.sortSpent
            ? -1
            : 0) ||
      a.label.localeCompare(b.label),
  );
  const withLimit = items.filter((i) => i.limitCents !== null);
  return {
    month,
    isCurrent,
    editable: isCurrent,
    asOfDay: isCurrent ? day : null,
    totals: {
      budgetedCents: withLimit.reduce((s, i) => s + BigInt(i.limitCents as string), 0n).toString(),
      spentCents: withLimit.reduce((s, i) => s + BigInt(i.spentCents), 0n).toString(),
    },
    items: items.map(({ rank: _r, sortShare: _s, sortSpent: _p, ...item }) => item),
  };
}

/** Grava a versão do mês corrente (sobrescreve se já houver uma no mesmo mês). */
export async function saveVersion(
  tx: Tx,
  workspaceId: string,
  categoryId: string,
  month: Month,
  amountCents: bigint | null,
) {
  await tx
    .insert(budgets)
    .values({ workspaceId, categoryId, effectiveFrom: monthRange(month).from, amountCents })
    .onConflictDoUpdate({
      target: [budgets.workspaceId, budgets.categoryId, budgets.effectiveFrom],
      set: { amountCents, updatedAt: new Date() },
    });
}
