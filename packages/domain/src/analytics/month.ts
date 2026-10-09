/** Mês civil no formato YYYY-MM. */
export type Month = string;

const pad = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (year: number, month1: number) =>
  new Date(Date.UTC(year, month1, 0)).getUTCDate();
const split = (month: Month) => month.split('-').map(Number) as [number, number];
const join = (year: number, month1: number): Month => `${year}-${pad(month1)}`;

export function parseMonth(text: string): Month | null {
  const match = /^(\d{4})-(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return text;
}

/** Primeiro e último dia do mês (YYYY-MM-DD). */
export function monthRange(month: Month): { from: string; to: string } {
  const [y, m] = split(month);
  return { from: `${month}-01`, to: `${month}-${pad(daysInMonth(y, m))}` };
}

export function previousMonth(month: Month): Month {
  const [y, m] = split(month);
  return m === 1 ? join(y - 1, 12) : join(y, m - 1);
}

export function nextMonth(month: Month): Month {
  const [y, m] = split(month);
  return m === 12 ? join(y + 1, 1) : join(y, m + 1);
}

/** Os `n` meses que terminam em `month`, do mais antigo para o mais recente. */
export function lastMonths(month: Month, n: number): Month[] {
  const result = [month];
  while (result.length < n) result.unshift(previousMonth(result[0] as Month));
  return result;
}

/** Mesmo dia no mês anterior, limitado ao último dia dele (31/03 → 28/02). */
export function comparisonCutoff(month: Month, day: number): string {
  const prev = previousMonth(month);
  const [y, m] = split(prev);
  return `${prev}-${pad(Math.min(day, daysInMonth(y, m)))}`;
}

/** Fração da renda já gasta (1 = 100%); sem entradas, `null`. */
export function spentShare(incomeCents: bigint, expenseCents: bigint): number | null {
  if (incomeCents <= 0n) return null;
  return Number(expenseCents) / Number(incomeCents);
}

/** Diferença em pontos percentuais inteiros entre duas frações. */
export function deltaPoints(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return Math.round((current - previous) * 100);
}
