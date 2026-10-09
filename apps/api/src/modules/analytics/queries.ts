import type { MonthSummary } from '@finlens/contracts';
import { categories, type Tx, transactions } from '@finlens/db';
import {
  budgetState,
  comparisonCutoff,
  lastMonths,
  type Month,
  monthRange,
  previousMonth,
} from '@finlens/domain';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { limitsFor } from '../budgets/queries';
import { expense, income, inPeriod, notMovement, rootTotals } from './aggregate';

const HISTORY_MONTHS = 6;

/** Resumo do mês: totais, comparação, saídas por categoria raiz e histórico. */
export async function loadMonthSummary(tx: Tx, month: Month, today: string): Promise<MonthSummary> {
  const months = lastMonths(month, HISTORY_MONTHS);
  const isCurrent = today.slice(0, 7) === month;
  const day = Number(today.slice(8));
  const prev = previousMonth(month);
  const prevRange = monthRange(prev);
  const prevTo = isCurrent ? comparisonCutoff(month, day) : prevRange.to;

  const [rows, [comparison], labels, [pending], limits] = await Promise.all([
    rootTotals(tx, months[0] as Month, month),
    tx
      .select({ income, expense })
      .from(transactions)
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .where(and(inPeriod(prevRange.from, prevTo), notMovement)),
    tx.select({ id: categories.id, name: categories.name }).from(categories),
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(inArray(transactions.classificationStatus, ['suggested', 'none'])),
    limitsFor(tx, month),
  ]);

  const names = new Map(labels.map((c) => [c.id, c.name]));
  const totals = new Map(months.map((m) => [m, { income: 0n, expense: 0n }]));
  const byRoot = new Map<string | null, { expense: bigint; count: number }>();
  for (const r of rows) {
    const t = totals.get(r.month);
    if (t) {
      t.income += BigInt(r.income);
      t.expense += BigInt(r.expense);
    }
    if (r.month === month && BigInt(r.expense) > 0n) {
      const entry = byRoot.get(r.root) ?? { expense: 0n, count: 0 };
      entry.expense += BigInt(r.expense);
      entry.count += r.count;
      byRoot.set(r.root, entry);
    }
  }
  const current = totals.get(month) ?? { income: 0n, expense: 0n };
  const budgetAlerts = { warning: 0, over: 0 };
  for (const [id, limit] of limits) {
    const state = budgetState(byRoot.get(id)?.expense ?? 0n, limit);
    if (state !== 'ok') budgetAlerts[state]++;
  }

  return {
    month,
    isCurrent,
    asOfDay: isCurrent ? day : null,
    incomeCents: current.income.toString(),
    expenseCents: current.expense.toString(),
    netCents: (current.income - current.expense).toString(),
    comparison: {
      month: prev,
      upToDay: isCurrent ? day : null,
      incomeCents: BigInt(comparison?.income ?? 0).toString(),
      expenseCents: BigInt(comparison?.expense ?? 0).toString(),
    },
    categories: [...byRoot.entries()]
      .map(([id, v]) => ({
        categoryId: id,
        label: id ? (names.get(id) ?? 'Categoria') : 'Sem categoria',
        expenseCents: v.expense.toString(),
        count: v.count,
        limitCents: id ? (limits.get(id)?.toString() ?? null) : null,
        sort: v.expense,
      }))
      .sort((a, b) => (b.sort > a.sort ? 1 : b.sort < a.sort ? -1 : a.label.localeCompare(b.label)))
      .map(({ sort: _sort, ...c }) => c),
    pendingReview: pending?.count ?? 0,
    budgetAlerts,
    history: months.map((m) => {
      const t = totals.get(m) ?? { income: 0n, expense: 0n };
      return { month: m, incomeCents: t.income.toString(), expenseCents: t.expense.toString() };
    }),
  };
}
