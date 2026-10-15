import type { InsightContext, InsightExpense } from './types';

export function ctx(overrides: Partial<InsightContext> = {}): InsightContext {
  return {
    month: '2026-10',
    today: '2026-10-20',
    day: 20,
    expenses: [],
    monthTotals: [],
    activeMonths: [],
    budgets: [],
    recurrences: [],
    ...overrides,
  };
}

export function e(
  id: string,
  postedDate: string,
  amountCents: bigint,
  extra: Partial<InsightExpense> = {},
): InsightExpense {
  return {
    id,
    postedDate,
    amountCents,
    accountId: 'acc',
    description: 'COMPRA',
    groupKey: null,
    groupLabel: 'COMPRA',
    rootId: null,
    rootLabel: null,
    categoryKey: null,
    ...extra,
  };
}
