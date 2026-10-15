import type { InstallmentList } from '@finlens/contracts';
import type { Tx } from '@finlens/db';
import {
  commitmentByMonth,
  detectInstallmentPlans,
  nextMonth as followingMonth,
  type InstallmentPlan,
  type Month,
} from '@finlens/domain';
import { type BaseExpense, loadExpenseBase } from '../recurrences/queries';

const EXPLICIT_MARK = /\b(PARC|PARCELA|PARCELAS)\b|\d\s*DE\s*\d/;

/** Parcelamentos detectados (as saídas com marca "PARC n/N"). */
export async function loadInstallmentPlansRaw(
  tx: Tx,
  today: string,
  base?: BaseExpense[],
): Promise<InstallmentPlan[]> {
  const all = base ?? (await loadExpenseBase(tx, today));
  const expenses = all.flatMap((e) => {
    if (!e.installment) return [];
    const explicit = EXPLICIT_MARK.test(
      e.description
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toUpperCase(),
    );
    // Um "05/10" no fim da descrição, no dia 5 de outubro, é a data da compra, não uma parcela.
    const isPurchaseDate =
      !explicit &&
      e.installment.current === Number(e.postedDate.slice(8, 10)) &&
      e.installment.total === Number(e.postedDate.slice(5, 7));
    return isPurchaseDate ? [] : [{ ...e, installment: e.installment, explicit }];
  });
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
