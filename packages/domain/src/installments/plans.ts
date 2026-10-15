import { type Month, monthRange } from '../analytics/month';
import { addMonths } from '../goals/goal';
import { median } from '../insights/stats';

export type InstallmentExpense = {
  id: string;
  postedDate: string;
  /** Valor absoluto da parcela. */
  amountCents: bigint;
  accountId: string;
  description: string;
  groupKey: string | null;
  groupLabel: string;
  /** Marca "PARC 03/10" já validada pelo `normalize` (1 ≤ atual ≤ total ≤ 24). */
  installment: { current: number; total: number };
  /** A descrição diz "PARC"/"PARCELA"/"n DE N"; sem isso a marca pode ser só uma data (05/10). */
  explicit: boolean;
};

export type InstallmentStatus = 'active' | 'done' | 'stale';

export type InstallmentPlan = {
  key: string;
  label: string;
  accountId: string;
  sampleDescription: string;
  total: number;
  /** Maior número de parcela visto. */
  lastSeen: number;
  seenCount: number;
  installmentCents: bigint;
  remaining: number;
  lastSeenDate: string;
  nextDate: string | null;
  endDate: string;
  remainingCents: bigint;
  status: InstallmentStatus;
  schedule: { date: string; cents: bigint }[];
};

const SAME_VALUE_PCT = 15n;
const STALE_AFTER_DAYS = 62;
const MAX_MONTHS = 24;
const DUPLICATE_WITHIN_DAYS = 5;

const day = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
const pad = (n: number) => String(n).padStart(2, '0');
const lastDayOf = (m: Month) => Number(monthRange(m).to.slice(8, 10));

/** Data no mês `month`, no dia pedido, limitada ao último dia do mês. */
const dateIn = (month: Month, d: number) => `${month}-${pad(Math.min(d, lastDayOf(month)))}`;

const medianInt = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : Math.floor(((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2);
};

const closeTo = (v: bigint, m: bigint) => (v > m ? v - m : m - v) * 100n <= m * SAME_VALUE_PCT;

type Cluster = { items: InstallmentExpense[] };

function buildPlan(items: InstallmentExpense[], today: string): InstallmentPlan {
  const sorted = [...items].sort(
    (a, b) => a.installment.current - b.installment.current || a.id.localeCompare(b.id),
  );
  const last = sorted.at(-1) as InstallmentExpense;
  const total = last.installment.total;
  const installmentCents = median(sorted.map((i) => i.amountCents));
  const dayOfMonth = medianInt(sorted.map((i) => Number(i.postedDate.slice(8, 10))));
  const lastMonth = last.postedDate.slice(0, 7) as Month;
  const remaining = total - last.installment.current;

  // A primeira parcela que falta vence no mês seguinte à última vista; se essa data já passou
  // (parcela não lançada), o cronograma começa no primeiro mês cuja data é hoje ou depois.
  let offset = 1;
  while (dateIn(addMonths(lastMonth, offset), dayOfMonth) < today && offset < 60) offset++;
  const schedule = Array.from({ length: remaining }, (_, i) => ({
    date: dateIn(addMonths(lastMonth, offset + i), dayOfMonth),
    cents: installmentCents,
  }));

  let status: InstallmentStatus = 'active';
  if (remaining === 0) status = 'done';
  else if (day(today) - day(last.postedDate) > STALE_AFTER_DAYS) status = 'stale';

  return {
    key: `${last.groupKey}:${last.accountId}:${total}:${sorted[0]?.postedDate}`,
    label: last.groupLabel,
    accountId: last.accountId,
    sampleDescription: last.description,
    total,
    lastSeen: last.installment.current,
    seenCount: sorted.length,
    installmentCents,
    remaining,
    lastSeenDate: last.postedDate,
    nextDate: schedule[0]?.date ?? null,
    endDate: schedule.at(-1)?.date ?? last.postedDate,
    remainingCents: installmentCents * BigInt(remaining),
    status,
    schedule,
  };
}

/** Parcelamentos em andamento (e concluídos) a partir das saídas com marca "PARC n/N". */
export function detectInstallmentPlans(
  expenses: InstallmentExpense[],
  today: string,
): InstallmentPlan[] {
  const clusters = new Map<string, Cluster[]>();
  const ordered = [...expenses].sort(
    (a, b) => a.postedDate.localeCompare(b.postedDate) || a.id.localeCompare(b.id),
  );
  for (const e of ordered) {
    if (!e.groupKey) continue;
    const bucket = `${e.groupKey}|${e.accountId}|${e.installment.total}`;
    const list = clusters.get(bucket) ?? [];
    // Linha repetida (lançamento em dobro ou extrato sobreposto): mesma parcela, valor e dias próximos.
    const duplicate = list.some((c) =>
      c.items.some(
        (i) =>
          i.installment.current === e.installment.current &&
          closeTo(e.amountCents, i.amountCents) &&
          Math.abs(day(e.postedDate) - day(i.postedDate)) <= DUPLICATE_WITHIN_DAYS,
      ),
    );
    if (duplicate) continue;
    const home = list.find(
      (c) =>
        !c.items.some((i) => i.installment.current === e.installment.current) &&
        closeTo(e.amountCents, median(c.items.map((i) => i.amountCents))),
    );
    if (home) home.items.push(e);
    else list.push({ items: [e] });
    clusters.set(bucket, list);
  }
  const plans = [...clusters.values()]
    .flat()
    // Marca que pode ser só uma data (sem "PARC") precisa de duas parcelas vistas.
    .filter((c) => c.items.some((i) => i.explicit) || c.items.length >= 2)
    .map((c) => buildPlan(c.items, today));
  return plans.sort(
    (a, b) =>
      Number(b.status === 'active') - Number(a.status === 'active') ||
      (b.installmentCents > a.installmentCents
        ? 1
        : b.installmentCents < a.installmentCents
          ? -1
          : 0) ||
      a.label.localeCompare(b.label) ||
      a.key.localeCompare(b.key),
  );
}

/** Compromisso por mês de calendário (só planos ativos), do mês `fromMonth` até a última parcela. */
export function commitmentByMonth(
  plans: InstallmentPlan[],
  fromMonth: Month,
  maxMonths = MAX_MONTHS,
): { month: Month; cents: bigint }[] {
  const byMonth = new Map<Month, bigint>();
  for (const p of plans) {
    if (p.status !== 'active') continue;
    for (const s of p.schedule) {
      const m = s.date.slice(0, 7) as Month;
      byMonth.set(m, (byMonth.get(m) ?? 0n) + s.cents);
    }
  }
  const last = [...byMonth.keys()].sort().at(-1);
  if (!last) return [];
  const result: { month: Month; cents: bigint }[] = [];
  let m = fromMonth;
  while (m <= last && result.length < maxMonths) {
    result.push({ month: m, cents: byMonth.get(m) ?? 0n });
    m = addMonths(m, 1);
  }
  return result;
}
