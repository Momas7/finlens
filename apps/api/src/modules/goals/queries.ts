import type { Goal } from '@finlens/contracts';
import { financialAccounts, goals, type Tx, transactions } from '@finlens/db';
import {
  addMonths,
  goalStatus,
  lastMonths,
  type Month,
  monthlyPace,
  monthlyRate,
  monthRange,
  monthsBetween,
  monthsToTarget,
  previousMonth,
  requiredMonthly,
} from '@finlens/domain';
import { asc, eq, inArray, isNull, sql } from 'drizzle-orm';

const PACE_POINTS = 4;

export const percentFromBp = (bp: number | null) =>
  bp === null ? null : (bp / 100).toFixed(2).replace('.', ',');
export const bpFromPercent = (text: string) => Math.round(Number(text.replace(',', '.')) * 100);

/** Metas com saldo da conta, ritmo pelos fins de mês e projeções. */
export async function loadGoals(tx: Tx, today: string, includeArchived = false): Promise<Goal[]> {
  const current = today.slice(0, 7) as Month;
  const ends = lastMonths(previousMonth(current), PACE_POINTS).map((m) => monthRange(m).to);
  const rows = await tx
    .select({
      goal: goals,
      accountName: financialAccounts.name,
      openingCents: financialAccounts.openingBalanceCents,
      openingDate: financialAccounts.openingBalanceDate,
    })
    .from(goals)
    .innerJoin(financialAccounts, eq(financialAccounts.id, goals.accountId))
    .where(includeArchived ? undefined : isNull(goals.archivedAt))
    .orderBy(asc(goals.createdAt));
  if (rows.length === 0) return [];

  const accountIds = [...new Set(rows.map((r) => r.goal.accountId))];
  const sinceOpening = sql`${transactions.postedDate} >= ${financialAccounts.openingBalanceDate}`;
  const sums = await tx
    .select({
      accountId: transactions.accountId,
      total: sql<string>`coalesce(sum(${transactions.amountCents}) filter (where ${sinceOpening}), 0)`,
      ends: sql<string[]>`array[${sql.join(
        ends.map(
          (end) =>
            sql`coalesce(sum(${transactions.amountCents}) filter (where ${sinceOpening} and ${transactions.postedDate} <= ${end}), 0)::text`,
        ),
        sql`, `,
      )}]`,
    })
    .from(transactions)
    .innerJoin(financialAccounts, eq(financialAccounts.id, transactions.accountId))
    .where(inArray(transactions.accountId, accountIds))
    .groupBy(transactions.accountId);
  const byAccount = new Map(sums.map((s) => [s.accountId, s]));

  return rows.map(({ goal, accountName, openingCents, openingDate }) => {
    const s = byAccount.get(goal.accountId);
    const opening = openingCents;
    const balance = opening + BigInt(s?.total ?? 0);
    // Fins de mês anteriores ao saldo inicial não existem para a conta.
    const points = ends
      .map((end, i) => ({ end, value: opening + BigInt(s?.ends[i] ?? 0) }))
      .filter((p) => openingDate !== null && p.end >= openingDate)
      .map((p) => p.value);
    const pace = monthlyPace(points);
    const rate = monthlyRate(goal.annualRateBp);
    const n = monthsToTarget(balance, goal.targetCents, pace, rate);
    const projectedMonth = n === null ? null : addMonths(current, n);
    const targetMonth = goal.targetDate?.slice(0, 7) ?? null;
    const required = targetMonth
      ? requiredMonthly(
          balance,
          goal.targetCents,
          goal.targetDate && goal.targetDate < today && targetMonth < current
            ? -1
            : monthsBetween(current, targetMonth),
          rate,
        )
      : null;
    const { status, delayMonths } = goalStatus({
      balance,
      target: goal.targetCents,
      targetMonth,
      projectedMonth,
    });
    const remaining = goal.targetCents - balance;
    const progress = Math.min(1, Math.max(0, Number(balance) / Number(goal.targetCents)));
    return {
      id: goal.id,
      name: goal.name,
      targetCents: goal.targetCents.toString(),
      targetDate: goal.targetDate,
      annualRatePercent: percentFromBp(goal.annualRateBp),
      accountId: goal.accountId,
      accountName,
      balanceCents: balance.toString(),
      progress,
      remainingCents: (remaining > 0n ? remaining : 0n).toString(),
      monthlyPaceCents: pace?.toString() ?? null,
      projectedMonth,
      requiredMonthlyCents: required?.toString() ?? null,
      status,
      delayMonths,
      archived: goal.archivedAt !== null,
    };
  });
}
