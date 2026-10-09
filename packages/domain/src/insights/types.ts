import type { Month } from '../analytics/month';
import type { BudgetState } from '../budgets/budget';

export type InsightSeverity = 'info' | 'warning';
export type InsightKind =
  | 'category_spike'
  | 'small_purchases'
  | 'anomaly'
  | 'fees'
  | 'duplicate'
  | 'budget_pace'
  | 'savings';

/** Saída (valor absoluto), sem movimentação, do mês corrente ou dos 6 anteriores. */
export type InsightExpense = {
  id: string;
  postedDate: string;
  amountCents: bigint;
  accountId: string;
  description: string;
  /** 'm:<estabelecimento>' ou 'd:<normalizado>'; null quando a descrição normalizada é vazia. */
  groupKey: string | null;
  groupLabel: string;
  rootId: string | null;
  rootLabel: string | null;
  /** system_key da categoria do lançamento (ex.: 'fees'). */
  categoryKey: string | null;
};

export type InsightBudget = {
  categoryId: string;
  label: string;
  limitCents: bigint;
  spentCents: bigint;
  state: BudgetState;
  overOnDay: number | null;
  projectedCents: bigint | null;
};

export type InsightContext = {
  month: Month;
  today: string;
  day: number;
  expenses: InsightExpense[];
  monthTotals: { month: Month; incomeCents: bigint; expenseCents: bigint }[];
  /** Dos 6 meses fechados, os que tiveram qualquer lançamento. */
  activeMonths: Month[];
  budgets: InsightBudget[];
};

export type InsightCandidate = {
  kind: InsightKind;
  severity: InsightSeverity;
  dedupeKey: string;
  title: string;
  body: string;
  impactCents: bigint;
  action: { label: string; href: string } | null;
};
