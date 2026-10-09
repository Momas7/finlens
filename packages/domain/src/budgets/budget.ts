import type { Month } from '../analytics/month';

export type BudgetState = 'ok' | 'warning' | 'over';
export type BudgetVersion = { effectiveFrom: Month; amountCents: bigint | null };
export type BudgetPace = {
  projectedCents: bigint;
  /** Dia em que o limite estoura no ritmo atual; null se não estoura ou já estourou. */
  overOnDay: number | null;
  /** Quanto ainda dá para gastar por dia até o fim do mês; null se já passou. */
  dailyAllowanceCents: bigint | null;
};

const PACE_FROM_DAY = 5;
const MIN_MONTHS = 3;
const ROUND_TO = 5000n;

/** Limite vigente no mês: a versão mais recente com início até ele (null = sem orçamento). */
export function limitFor(versions: BudgetVersion[], month: Month): bigint | null {
  let best: BudgetVersion | null = null;
  for (const v of versions) {
    if (v.effectiveFrom <= month && (!best || v.effectiveFrom > best.effectiveFrom)) best = v;
  }
  return best?.amountCents ?? null;
}

/** ok abaixo de 80%; warning de 80% a 100%; over a partir de 100%. */
export function budgetState(spentCents: bigint, limitCents: bigint): BudgetState {
  if (spentCents >= limitCents) return 'over';
  if (spentCents * 10n >= limitCents * 8n) return 'warning';
  return 'ok';
}

/** Projeção linear do mês corrente; antes do dia 5 é ruído e devolve null. */
export function pace(
  spentCents: bigint,
  limitCents: bigint,
  day: number,
  daysInMonth: number,
): BudgetPace | null {
  if (day < PACE_FROM_DAY) return null;
  const d = BigInt(day);
  const projectedCents = (spentCents * BigInt(daysInMonth) + d / 2n) / d;
  if (spentCents >= limitCents)
    return { projectedCents, overOnDay: null, dailyAllowanceCents: null };
  const overOnDay =
    projectedCents > limitCents && spentCents > 0n
      ? Math.min(daysInMonth, Math.ceil(Number(limitCents) / (Number(spentCents) / day)))
      : null;
  const remainingDays = BigInt(daysInMonth - day + 1);
  return {
    projectedCents,
    overOnDay,
    dailyAllowanceCents: (limitCents - spentCents) / remainingDays,
  };
}

/** Mediana dos meses, arredondada para cima a R$ 50; null com menos de 3 meses ou mediana zero. */
export function suggestBudget(monthlySpentCents: bigint[]): bigint | null {
  if (monthlySpentCents.length < MIN_MONTHS) return null;
  const sorted = [...monthlySpentCents].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? (sorted[mid] as bigint)
      : ((sorted[mid - 1] as bigint) + (sorted[mid] as bigint) + 1n) / 2n;
  // Mediana zero: a categoria não costuma ter gasto; sugerir R$ 50 seria ruído.
  if (median === 0n) return null;
  const rounded = ((median + ROUND_TO - 1n) / ROUND_TO) * ROUND_TO;
  return rounded < ROUND_TO ? ROUND_TO : rounded;
}
