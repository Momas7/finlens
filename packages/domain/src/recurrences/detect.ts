import { median } from '../insights/stats';

export type RecurrenceCadence = 'weekly' | 'monthly' | 'quarterly' | 'annual';
export type RecurrenceStatus = 'active' | 'late' | 'ended';

export type RecurrenceExpense = {
  id: string;
  postedDate: string;
  /** Valor absoluto da saída. */
  amountCents: bigint;
  accountId: string;
  groupKey: string | null;
  groupLabel: string;
};

export type Recurrence = {
  key: string;
  label: string;
  accountId: string;
  cadence: RecurrenceCadence;
  /** Mediana das últimas 3 ocorrências. */
  typicalCents: bigint;
  /** Custo mensal equivalente. */
  monthlyCents: bigint;
  firstDate: string;
  lastDate: string;
  nextExpectedDate: string;
  occurrences: number;
  intervalDays: number;
  status: RecurrenceStatus;
  priceChange: { fromCents: bigint; toCents: bigint } | null;
  isNew: boolean;
};

const CADENCES: { cadence: RecurrenceCadence; days: number; tolerance: number }[] = [
  { cadence: 'weekly', days: 7, tolerance: 2 },
  { cadence: 'monthly', days: 30, tolerance: 5 },
  { cadence: 'quarterly', days: 91, tolerance: 8 },
  { cadence: 'annual', days: 365, tolerance: 15 },
];
const MIN_OCCURRENCES = 3;
const MIN_REGULAR_SHARE = 0.7;
const VALUE_TOLERANCE_PCT = 15n;
const PRICE_RISE_PCT = 105n;
const PRICE_RISE_MIN = 200n;
const SAME_LEVEL_PCT = 2n;
const NEW_WITHIN_DAYS = 60;

const day = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
const addDays = (date: string, n: number) =>
  new Date((day(date) + n) * 86_400_000).toISOString().slice(0, 10);
const medianInt = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : Math.floor(((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2);
};

function monthlyEquivalent(cadence: RecurrenceCadence, cents: bigint): bigint {
  switch (cadence) {
    case 'weekly':
      return (cents * 52n * 2n + 12n) / 24n;
    case 'monthly':
      return cents;
    case 'quarterly':
      return (cents * 2n + 3n) / 6n;
    case 'annual':
      return (cents * 2n + 12n) / 24n;
  }
}

function detectGroup(key: string, items: RecurrenceExpense[], today: string): Recurrence | null {
  // Ocorrências no mesmo dia contam como uma (a primeira por id).
  const byDate = new Map<string, RecurrenceExpense>();
  for (const e of [...items].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!byDate.has(e.postedDate)) byDate.set(e.postedDate, e);
  }
  const occ = [...byDate.values()].sort((a, b) => a.postedDate.localeCompare(b.postedDate));
  if (occ.length < MIN_OCCURRENCES) return null;

  const intervals = occ
    .slice(1)
    .map((e, i) => day(e.postedDate) - day((occ[i] as RecurrenceExpense).postedDate));
  const interval = medianInt(intervals);
  const shape = CADENCES.find((c) => Math.abs(interval - c.days) <= c.tolerance);
  if (!shape) return null;
  const regular = intervals.filter((i) => Math.abs(i - shape.days) <= shape.tolerance).length;
  if (regular / intervals.length < MIN_REGULAR_SHARE) return null;

  const values = occ.map((e) => e.amountCents);
  const mid = median(values);
  const similar = values.filter(
    (v) => (v > mid ? v - mid : mid - v) * 100n <= mid * VALUE_TOLERANCE_PCT,
  ).length;
  if (similar / values.length < MIN_REGULAR_SHARE) return null;

  const last = occ.at(-1) as RecurrenceExpense;
  const first = occ[0] as RecurrenceExpense;
  const typicalCents = median(values.slice(-3));
  const nextExpectedDate = addDays(last.postedDate, interval);
  let status: RecurrenceStatus = 'active';
  if (day(today) > day(last.postedDate) + 2 * interval) status = 'ended';
  else if (
    (shape.cadence === 'weekly' || shape.cadence === 'monthly') &&
    day(today) > day(nextExpectedDate) + shape.tolerance
  ) {
    status = 'late';
  }

  // Patamar novo: a sequência final de valores a até 2% do último.
  const lastValue = last.amountCents;
  let runStart = occ.length - 1;
  while (runStart > 0) {
    const v = (occ[runStart - 1] as RecurrenceExpense).amountCents;
    if ((v > lastValue ? v - lastValue : lastValue - v) * 100n <= lastValue * SAME_LEVEL_PCT)
      runStart--;
    else break;
  }
  let priceChange: Recurrence['priceChange'] = null;
  if (runStart >= 2) {
    const fromCents = median(values.slice(0, runStart));
    const runDate = (occ[runStart] as RecurrenceExpense).postedDate;
    if (
      lastValue * 100n >= fromCents * PRICE_RISE_PCT &&
      lastValue - fromCents >= PRICE_RISE_MIN &&
      day(today) - day(runDate) <= 2 * interval
    ) {
      priceChange = { fromCents, toCents: lastValue };
    }
  }

  return {
    key,
    label: last.groupLabel,
    accountId: last.accountId,
    cadence: shape.cadence,
    typicalCents,
    monthlyCents: monthlyEquivalent(shape.cadence, typicalCents),
    firstDate: first.postedDate,
    lastDate: last.postedDate,
    nextExpectedDate,
    occurrences: occ.length,
    intervalDays: interval,
    status,
    priceChange,
    isNew: day(today) - day(first.postedDate) <= NEW_WITHIN_DAYS,
  };
}

/** Cobranças que se repetem (assinaturas, aluguel, planos), a partir do histórico de saídas. */
export function detectRecurrences(expenses: RecurrenceExpense[], today: string): Recurrence[] {
  const groups = new Map<string, RecurrenceExpense[]>();
  for (const e of expenses) {
    if (!e.groupKey) continue;
    groups.set(e.groupKey, [...(groups.get(e.groupKey) ?? []), e]);
  }
  const result: Recurrence[] = [];
  for (const [key, items] of groups) {
    const r = detectGroup(key, items, today);
    if (r) result.push(r);
  }
  return result.sort(
    (a, b) =>
      (b.monthlyCents > a.monthlyCents ? 1 : b.monthlyCents < a.monthlyCents ? -1 : 0) ||
      a.label.localeCompare(b.label),
  );
}
