import { categories, type Tx, transactions } from '@finlens/db';
import {
  type InsightContext,
  type InsightExpense,
  lastMonths,
  MERCHANTS,
  type Month,
  monthRange,
  previousMonth,
} from '@finlens/domain';
import { and, eq, lt } from 'drizzle-orm';
import { activeMonths, inPeriod, notMovement, rootTotals } from '../analytics/aggregate';
import { loadBudgetMonth } from '../budgets/queries';

const HISTORY_MONTHS = 7;
const TOTALS_MONTHS = 5;
const MERCHANT_NAMES = new Map(MERCHANTS.map((m) => [m.key, m.name]));

/** Dados que os geradores de insight precisam, buscados sob RLS. */
export async function loadInsightContext(tx: Tx, today: string): Promise<InsightContext> {
  const month = today.slice(0, 7) as Month;
  const window = lastMonths(month, HISTORY_MONTHS);
  const closed = lastMonths(previousMonth(month), 6);

  const [rows, names, totals, active, budgetMonth] = await Promise.all([
    tx
      .select({
        id: transactions.id,
        postedDate: transactions.postedDate,
        amountCents: transactions.amountCents,
        accountId: transactions.accountId,
        description: transactions.description,
        merchantKey: transactions.merchantKey,
        normalized: transactions.descriptionNormalized,
        categoryId: transactions.categoryId,
        parentId: categories.parentId,
        systemKey: categories.systemKey,
      })
      .from(transactions)
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .where(
        and(
          lt(transactions.amountCents, 0n),
          inPeriod(monthRange(window[0] as Month).from, monthRange(month).to),
          notMovement,
        ),
      ),
    tx.select({ id: categories.id, name: categories.name }).from(categories),
    rootTotals(tx, lastMonths(month, TOTALS_MONTHS)[0] as Month, month),
    activeMonths(tx, closed[0] as Month, closed.at(-1) as Month),
    loadBudgetMonth(tx, month, today),
  ]);

  const label = new Map(names.map((c) => [c.id, c.name]));
  const expenses: InsightExpense[] = rows.map((r) => {
    const rootId = r.categoryId ? (r.parentId ?? r.categoryId) : null;
    const groupKey = r.merchantKey
      ? `m:${r.merchantKey}`
      : r.normalized
        ? `d:${r.normalized}`
        : null;
    return {
      id: r.id,
      postedDate: r.postedDate,
      amountCents: -r.amountCents,
      accountId: r.accountId,
      description: r.description,
      groupKey,
      groupLabel:
        (r.merchantKey && MERCHANT_NAMES.get(r.merchantKey)) || r.normalized || r.description,
      rootId,
      rootLabel: rootId ? (label.get(rootId) ?? null) : null,
      categoryKey: r.systemKey,
    };
  });

  const monthTotals = new Map<Month, { income: bigint; expense: bigint }>();
  for (const t of totals) {
    const entry = monthTotals.get(t.month) ?? { income: 0n, expense: 0n };
    entry.income += t.income;
    entry.expense += t.expense;
    monthTotals.set(t.month, entry);
  }

  return {
    month,
    today,
    day: Number(today.slice(8)),
    expenses,
    monthTotals: [...monthTotals].map(([m, v]) => ({
      month: m,
      incomeCents: v.income,
      expenseCents: v.expense,
    })),
    activeMonths: closed.filter((m) => active.has(m)),
    budgets: budgetMonth.items
      .filter((i) => i.limitCents !== null && i.state !== null)
      .map((i) => ({
        categoryId: i.categoryId,
        label: i.label,
        limitCents: BigInt(i.limitCents as string),
        spentCents: BigInt(i.spentCents),
        state: i.state as 'ok' | 'warning' | 'over',
        overOnDay: i.pace?.overOnDay ?? null,
        projectedCents: i.pace ? BigInt(i.pace.projectedCents) : null,
      })),
  };
}
