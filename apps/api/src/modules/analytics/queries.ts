import type { MonthSummary } from '@finlens/contracts';
import { categories, type Tx, transactions } from '@finlens/db';
import {
  comparisonCutoff,
  lastMonths,
  type Month,
  monthRange,
  previousMonth,
} from '@finlens/domain';
import { and, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';

const HISTORY_MONTHS = 6;

const income = sql<string>`coalesce(sum(case when ${transactions.amountCents} > 0 then ${transactions.amountCents} else 0 end), 0)`;
const expense = sql<string>`coalesce(sum(case when ${transactions.amountCents} < 0 then -${transactions.amountCents} else 0 end), 0)`;
// Movimentação (transferências, fatura, aplicações) não é entrada nem saída.
const notMovement = or(isNull(categories.kind), ne(categories.kind, 'movement'));
const inPeriod = (from: string, to: string) =>
  and(gte(transactions.postedDate, from), lte(transactions.postedDate, to));

/** Resumo do mês: totais, comparação, saídas por categoria raiz e histórico. */
export async function loadMonthSummary(tx: Tx, month: Month, today: string): Promise<MonthSummary> {
  const months = lastMonths(month, HISTORY_MONTHS);
  const range = monthRange(month);
  const isCurrent = today.slice(0, 7) === month;
  const day = Number(today.slice(8));
  const prev = previousMonth(month);
  const prevRange = monthRange(prev);
  const prevTo = isCurrent ? comparisonCutoff(month, day) : prevRange.to;

  const monthOf = sql<string>`to_char(${transactions.postedDate}, 'YYYY-MM')`;
  const root = sql<string | null>`coalesce(${categories.parentId}, ${categories.id})`;
  const [rows, [comparison], labels, [pending]] = await Promise.all([
    tx
      .select({
        month: monthOf,
        root,
        income,
        expense,
        count: sql<number>`(count(*) filter (where ${transactions.amountCents} < 0))::int`,
      })
      .from(transactions)
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .where(and(inPeriod(monthRange(months[0] as Month).from, range.to), notMovement))
      .groupBy(monthOf, root),
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
        sort: v.expense,
      }))
      .sort((a, b) => (b.sort > a.sort ? 1 : b.sort < a.sort ? -1 : a.label.localeCompare(b.label)))
      .map(({ sort: _sort, ...c }) => c),
    pendingReview: pending?.count ?? 0,
    history: months.map((m) => {
      const t = totals.get(m) ?? { income: 0n, expense: 0n };
      return { month: m, incomeCents: t.income.toString(), expenseCents: t.expense.toString() };
    }),
  };
}
