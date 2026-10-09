import { categories, type Tx, transactions } from '@finlens/db';
import { type Month, monthRange } from '@finlens/domain';
import { and, eq, gte, isNull, lte, ne, or, sql } from 'drizzle-orm';

export const income = sql<string>`coalesce(sum(case when ${transactions.amountCents} > 0 then ${transactions.amountCents} else 0 end), 0)`;
export const expense = sql<string>`coalesce(sum(case when ${transactions.amountCents} < 0 then -${transactions.amountCents} else 0 end), 0)`;
// Movimentação (transferências, fatura, aplicações) não é entrada nem saída.
export const notMovement = or(isNull(categories.kind), ne(categories.kind, 'movement'));
export const inPeriod = (from: string, to: string) =>
  and(gte(transactions.postedDate, from), lte(transactions.postedDate, to));

const monthOf = sql<string>`to_char(${transactions.postedDate}, 'YYYY-MM')`;

export type RootTotal = {
  month: Month;
  /** Categoria raiz; null = sem categoria. */
  root: string | null;
  income: bigint;
  expense: bigint;
  /** Quantidade de saídas. */
  count: number;
};

/** Entradas e saídas por mês e categoria raiz, sem movimentação, de `fromMonth` a `toMonth`. */
export async function rootTotals(tx: Tx, fromMonth: Month, toMonth: Month): Promise<RootTotal[]> {
  const root = sql<string | null>`coalesce(${categories.parentId}, ${categories.id})`;
  const rows = await tx
    .select({
      month: monthOf,
      root,
      income,
      expense,
      count: sql<number>`(count(*) filter (where ${transactions.amountCents} < 0))::int`,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(inPeriod(monthRange(fromMonth).from, monthRange(toMonth).to), notMovement))
    .groupBy(monthOf, root);
  return rows.map((r) => ({ ...r, income: BigInt(r.income), expense: BigInt(r.expense) }));
}

/** Meses com qualquer lançamento (inclusive movimentação) — indicam que o app estava em uso. */
export async function activeMonths(tx: Tx, fromMonth: Month, toMonth: Month): Promise<Set<Month>> {
  const rows = await tx
    .selectDistinct({ month: monthOf })
    .from(transactions)
    .where(inPeriod(monthRange(fromMonth).from, monthRange(toMonth).to));
  return new Set(rows.map((r) => r.month));
}
