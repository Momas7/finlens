import type { InstallmentList } from '@finlens/contracts';
import type { Tx } from '@finlens/db';
import {
  commitmentByMonth,
  detectInstallmentPlans,
  nextMonth as followingMonth,
  type InstallmentPlan,
  type Month,
} from '@finlens/domain';
import { loadExpenseBase } from '../recurrences/queries';

/** Parcelamentos detectados (as saídas com marca "PARC n/N"). */
export async function loadInstallmentPlansRaw(tx: Tx, today: string): Promise<InstallmentPlan[]> {
  const expenses = (await loadExpenseBase(tx, today)).flatMap((e) =>
    e.installment ? [{ ...e, installment: e.installment }] : [],
  );
  return detectInstallmentPlans(expenses, today);
}

export async function loadInstallments(tx: Tx, today: string): Promise<InstallmentList> {
  const plans = await loadInstallmentPlansRaw(tx, today);
  const month = today.slice(0, 7) as Month;
  const byMonth = commitmentByMonth(plans, month);
  const active = plans.filter((p) => p.status === 'active');
  const next = followingMonth(month);
  return {
    plans: plans.map((p) => ({
      key: p.key,
      label: p.label,
      accountId: p.accountId,
      sampleDescription: p.sampleDescription,
      total: p.total,
      lastSeen: p.lastSeen,
      seenCount: p.seenCount,
      installmentCents: p.installmentCents.toString(),
      remaining: p.remaining,
      lastSeenDate: p.lastSeenDate,
      nextDate: p.nextDate,
      endDate: p.endDate,
      remainingCents: p.remainingCents.toString(),
      status: p.status,
    })),
    totals: {
      remainingCents: active.reduce((s, p) => s + p.remainingCents, 0n).toString(),
      nextMonthCents: (byMonth.find((m) => m.month === next)?.cents ?? 0n).toString(),
      count: active.length,
    },
    byMonth: byMonth.map((m) => ({ month: m.month, cents: m.cents.toString() })),
  };
}
