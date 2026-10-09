import type { Month } from '../analytics/month';

const MAX_MONTHS = 600;

export type GoalStatus = 'done' | 'on_track' | 'behind' | 'no_pace' | 'no_date';

/** Taxa mensal equivalente a uma taxa anual em pontos-base (10,5% = 1050). */
export function monthlyRate(annualBp: number | null): number {
  if (!annualBp) return 0;
  return (1 + annualBp / 10000) ** (1 / 12) - 1;
}

/** Média das variações entre saldos de fim de mês consecutivos; null com menos de 2 pontos. */
export function monthlyPace(monthEndBalances: bigint[]): bigint | null {
  if (monthEndBalances.length < 2) return null;
  const first = monthEndBalances[0] as bigint;
  const last = monthEndBalances.at(-1) as bigint;
  return (last - first) / BigInt(monthEndBalances.length - 1);
}

/** Meses até o saldo alcançar o alvo, aportando `pace` por mês com rendimento `rate`. */
export function monthsToTarget(
  balance: bigint,
  target: bigint,
  pace: bigint | null,
  rate: number,
): number | null {
  if (balance >= target) return 0;
  const contribution = Number(pace ?? 0n);
  if (contribution <= 0 && rate === 0) return null;
  let b = Number(balance);
  for (let n = 1; n <= MAX_MONTHS; n++) {
    b = b * (1 + rate) + contribution;
    if (b >= Number(target)) return n;
  }
  return null;
}

/** Aporte mensal para alcançar o alvo em `months` meses; 0 se o rendimento basta; null se a data passou. */
export function requiredMonthly(
  balance: bigint,
  target: bigint,
  months: number,
  rate: number,
): bigint | null {
  if (months < 0) return null;
  const n = Math.max(1, months);
  const value =
    rate === 0
      ? Number(target - balance) / n
      : ((Number(target) - Number(balance) * (1 + rate) ** n) * rate) / ((1 + rate) ** n - 1);
  return value <= 0 ? 0n : BigInt(Math.ceil(value - 1e-9));
}

export function addMonths(month: Month, n: number): Month {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export function monthsBetween(from: Month, to: Month): number {
  const [fy, fm] = from.split('-').map(Number) as [number, number];
  const [ty, tm] = to.split('-').map(Number) as [number, number];
  return (ty - fy) * 12 + (tm - fm);
}

export function goalStatus(input: {
  balance: bigint;
  target: bigint;
  targetMonth: Month | null;
  projectedMonth: Month | null;
}): { status: GoalStatus; delayMonths: number | null } {
  if (input.balance >= input.target) return { status: 'done', delayMonths: null };
  if (!input.targetMonth) return { status: 'no_date', delayMonths: null };
  if (!input.projectedMonth) return { status: 'no_pace', delayMonths: null };
  const delay = monthsBetween(input.targetMonth, input.projectedMonth);
  return delay > 0
    ? { status: 'behind', delayMonths: delay }
    : { status: 'on_track', delayMonths: null };
}
