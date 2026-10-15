import type { RecurrenceList } from '@finlens/contracts';
import { categories, type Tx, transactions } from '@finlens/db';
import {
  detectRecurrences,
  MERCHANTS,
  type Month,
  monthRange,
  normalize,
  previousMonth,
  type Recurrence,
  type RecurrenceExpense,
} from '@finlens/domain';
import { and, eq, lt, max } from 'drizzle-orm';
import { inPeriod, notMovement } from '../analytics/aggregate';

// 26 meses: o bastante para ver três cobranças anuais.
const HISTORY_MONTHS = 26;
const MERCHANT_NAMES = new Map(MERCHANTS.map((m) => [m.key, m.name]));

/** Saídas dos últimos 13 meses, sem movimentação (transferências e faturas ligadas ficam de fora). */
export async function loadRecurrenceExpenses(tx: Tx, today: string): Promise<RecurrenceExpense[]> {
  let from = today.slice(0, 7) as Month;
  for (let i = 1; i < HISTORY_MONTHS; i++) from = previousMonth(from);
  const rows = await tx
    .select({
      id: transactions.id,
      postedDate: transactions.postedDate,
      amountCents: transactions.amountCents,
      accountId: transactions.accountId,
      description: transactions.description,
      merchantKey: transactions.merchantKey,
      normalized: transactions.descriptionNormalized,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(lt(transactions.amountCents, 0n), inPeriod(monthRange(from).from, today), notMovement),
    );
  return (
    rows
      // Parcelas ("PARC 03/10") são de uma compra só, não de uma assinatura.
      .filter((r) => normalize(r.description).installment === null)
      .map((r) => ({
        id: r.id,
        postedDate: r.postedDate,
        amountCents: -r.amountCents,
        accountId: r.accountId,
        description: r.description,
        groupKey: r.merchantKey ? `m:${r.merchantKey}` : r.normalized ? `d:${r.normalized}` : null,
        groupLabel:
          (r.merchantKey && MERCHANT_NAMES.get(r.merchantKey)) || r.normalized || r.description,
      }))
  );
}

/** Data do lançamento mais recente de cada conta (qualquer tipo). */
async function latestByAccount(tx: Tx): Promise<Map<string, string>> {
  const rows = await tx
    .select({ accountId: transactions.accountId, last: max(transactions.postedDate) })
    .from(transactions)
    .groupBy(transactions.accountId);
  return new Map(rows.flatMap((r) => (r.last ? [[r.accountId, r.last] as const] : [])));
}

export async function loadRecurrencesRaw(tx: Tx, today: string): Promise<Recurrence[]> {
  const [expenses, latest] = await Promise.all([
    loadRecurrenceExpenses(tx, today),
    latestByAccount(tx),
  ]);
  return detectRecurrences(expenses, today, latest);
}

/** Lista para a API: valores em string e totais só das ativas e atrasadas. */
export async function loadRecurrences(tx: Tx, today: string): Promise<RecurrenceList> {
  const all = await loadRecurrencesRaw(tx, today);
  // Encerradas vão ao final.
  const sorted = [...all].sort(
    (a, b) => Number(a.status === 'ended') - Number(b.status === 'ended'),
  );
  const running = all.filter((r) => r.status !== 'ended');
  return {
    items: sorted.map((r) => ({
      key: r.key,
      label: r.label,
      accountId: r.accountId,
      sampleDescription: r.sampleDescription,
      cadence: r.cadence,
      typicalCents: r.typicalCents.toString(),
      monthlyCents: r.monthlyCents.toString(),
      firstDate: r.firstDate,
      lastDate: r.lastDate,
      nextExpectedDate: r.nextExpectedDate,
      occurrences: r.occurrences,
      intervalDays: r.intervalDays,
      status: r.status,
      priceChange: r.priceChange && {
        fromCents: r.priceChange.fromCents.toString(),
        toCents: r.priceChange.toCents.toString(),
      },
      isNew: r.isNew,
    })),
    totals: {
      monthlyCents: running.reduce((s, r) => s + r.monthlyCents, 0n).toString(),
      count: running.length,
    },
  };
}
