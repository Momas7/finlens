import { lastMonths, type Month, monthRange, previousMonth } from '../analytics/month';
import { formatBRL } from '../money/money';
import { highCommitment, installmentEnding } from './installment-generators';
import { newSubscription, priceIncrease, recurrenceMissing } from './recurrence-generators';
import { median, robustZ } from './stats';
import type { InsightCandidate, InsightContext, InsightExpense } from './types';

const SPIKE_RATIO_X10 = 13n;
const SPIKE_MIN = 10000n;
const SPIKE_MIN_MONTHS = 3;
const SMALL_BELOW = 3000n;
const SMALL_MIN_COUNT = 10;
const SMALL_MIN_TOTAL = 15000n;
const ANOMALY_MIN_HISTORY = 5;
const ANOMALY_Z = 3.5;
const ANOMALY_MIN_GAP = 5000n;
const DUPLICATE_MAX_DAYS = 2;
const FEE_KEYS = new Set(['financial.fees', 'financial.interest', 'financial.iof']);
const SAVINGS_DROP = 0.1;
const SAVINGS_MONTHS = 3;

const monthNameFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' });
const monthName = (m: Month) => monthNameFmt.format(new Date(`${m}-15T12:00:00Z`));
const ddmm = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
const monthOf = (date: string) => date.slice(0, 7);
const dayOf = (date: string) => Number(date.slice(8, 10));
const lastDay = (m: Month) => Number(monthRange(m).to.slice(8, 10));
const sum = (values: bigint[]) => values.reduce((s, v) => s + v, 0n);

function monthQuery(month: Month, extra: Record<string, string> = {}) {
  const { from, to } = monthRange(month);
  return new URLSearchParams({ ...extra, from, to }).toString();
}

const inMonth = (ctx: InsightContext) =>
  ctx.expenses.filter((x) => monthOf(x.postedDate) === ctx.month);

/** Categoria principal acima da mediana do mesmo recorte (até o mesmo dia) nos meses de uso. */
export function categorySpike(ctx: InsightContext): InsightCandidate[] {
  if (ctx.activeMonths.length < SPIKE_MIN_MONTHS) return [];
  const upTo = (root: string, m: Month) => {
    const cutoff = Math.min(ctx.day, lastDay(m));
    return sum(
      ctx.expenses
        .filter(
          (x) => x.rootId === root && monthOf(x.postedDate) === m && dayOf(x.postedDate) <= cutoff,
        )
        .map((x) => x.amountCents),
    );
  };
  const roots = new Map<string, string>();
  for (const x of inMonth(ctx)) if (x.rootId) roots.set(x.rootId, x.rootLabel ?? 'Categoria');
  const out: InsightCandidate[] = [];
  for (const [root, label] of roots) {
    const current = upTo(root, ctx.month);
    const reference = median(ctx.activeMonths.map((m) => upTo(root, m)));
    // Sem gasto no recorte de referência não há "normal" (categoria nova ou gasto que costuma vir depois).
    if (reference === 0n) continue;
    const gap = current - reference;
    if (current * 10n < reference * SPIKE_RATIO_X10 || gap < SPIKE_MIN) continue;
    out.push({
      kind: 'category_spike',
      severity: 'warning',
      dedupeKey: `category_spike:${ctx.month}:${root}`,
      title: `${label} acima do normal`,
      body: `${formatBRL(current)} até o dia ${ctx.day}, ${formatBRL(gap)} acima do normal para esta altura do mês.`,
      impactCents: gap,
      action: {
        label: 'Ver lançamentos',
        href: `/painel/transacoes?${monthQuery(ctx.month, { categoryId: root })}`,
      },
    });
  }
  return out;
}

export function smallPurchases(ctx: InsightContext): InsightCandidate[] {
  const small = inMonth(ctx).filter((x) => x.amountCents < SMALL_BELOW);
  const total = sum(small.map((x) => x.amountCents));
  if (small.length < SMALL_MIN_COUNT || total < SMALL_MIN_TOTAL) return [];
  return [
    {
      kind: 'small_purchases',
      severity: 'info',
      dedupeKey: `small_purchases:${ctx.month}`,
      title: 'Pequenas compras somam',
      body: `${small.length} compras abaixo de R$ 30 somam ${formatBRL(total)} este mês.`,
      impactCents: total,
      action: { label: 'Ver lançamentos', href: `/painel/transacoes?${monthQuery(ctx.month)}` },
    },
  ];
}

export function anomalies(ctx: InsightContext): InsightCandidate[] {
  const out: InsightCandidate[] = [];
  for (const x of inMonth(ctx)) {
    if (!x.groupKey) continue;
    const history = ctx.expenses
      .filter((h) => h.groupKey === x.groupKey && monthOf(h.postedDate) < ctx.month)
      .map((h) => h.amountCents);
    if (history.length < ANOMALY_MIN_HISTORY) continue;
    const med = median(history);
    const gap = x.amountCents - med;
    if (gap < ANOMALY_MIN_GAP) continue;
    const z = robustZ(x.amountCents, history);
    const unusual = z === null ? x.amountCents >= med * 2n : z >= ANOMALY_Z;
    if (!unusual) continue;
    out.push({
      kind: 'anomaly',
      severity: 'warning',
      dedupeKey: `anomaly:${x.id}`,
      title: 'Valor fora do padrão',
      body: `${x.groupLabel}: ${formatBRL(x.amountCents)} em ${ddmm(x.postedDate)}, normalmente ${formatBRL(med)}.`,
      impactCents: gap,
      action: {
        label: 'Ver lançamentos',
        href: `/painel/transacoes?${monthQuery(ctx.month, { q: x.description })}`,
      },
    });
  }
  return out;
}

export function fees(ctx: InsightContext): InsightCandidate[] {
  const items = inMonth(ctx).filter((x) => x.categoryKey && FEE_KEYS.has(x.categoryKey));
  const total = sum(items.map((x) => x.amountCents));
  if (total === 0n) return [];
  const root = items.find((x) => x.rootId)?.rootId;
  return [
    {
      kind: 'fees',
      severity: items.some((x) => x.categoryKey === 'financial.interest') ? 'warning' : 'info',
      dedupeKey: `fees:${ctx.month}`,
      title: 'Tarifas, juros e IOF',
      body: `Você pagou ${formatBRL(total)} em tarifas, juros e IOF este mês.`,
      impactCents: total,
      action: root
        ? {
            label: 'Ver lançamentos',
            href: `/painel/transacoes?${monthQuery(ctx.month, { categoryId: root })}`,
          }
        : null,
    },
  ];
}

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export function duplicates(ctx: InsightContext): InsightCandidate[] {
  const groups = new Map<string, InsightExpense[]>();
  for (const x of inMonth(ctx)) {
    if (!x.groupKey) continue;
    const key = `${x.accountId}|${x.amountCents}|${x.groupKey}`;
    groups.set(key, [...(groups.get(key) ?? []), x]);
  }
  const out: InsightCandidate[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort(
      (a, b) => a.postedDate.localeCompare(b.postedDate) || a.id.localeCompare(b.id),
    );
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1] as InsightExpense;
      const b = sorted[i] as InsightExpense;
      if (daysBetween(a.postedDate, b.postedDate) > DUPLICATE_MAX_DAYS) continue;
      const ids = [a.id, b.id].sort();
      out.push({
        kind: 'duplicate',
        severity: 'warning',
        dedupeKey: `duplicate:${ids[0]}:${ids[1]}`,
        title: 'Possível cobrança duplicada',
        body: `${a.groupLabel} ${formatBRL(a.amountCents)} apareceu em ${ddmm(a.postedDate)} e ${ddmm(b.postedDate)}.`,
        impactCents: a.amountCents,
        action: {
          label: 'Ver lançamentos',
          href: `/painel/transacoes?${monthQuery(ctx.month, { q: a.description })}`,
        },
      });
    }
  }
  return out;
}

export function budgetPace(ctx: InsightContext): InsightCandidate[] {
  const action = { label: 'Ver orçamento', href: '/painel/orcamentos' };
  const out: InsightCandidate[] = [];
  for (const b of ctx.budgets) {
    if (b.state === 'over' && b.spentCents > b.limitCents) {
      // Chave própria: dispensar a previsão não pode esconder o estouro.
      out.push({
        kind: 'budget_pace',
        severity: 'warning',
        dedupeKey: `budget_over:${ctx.month}:${b.categoryId}`,
        title: `${b.label} passou do orçamento`,
        body: `${formatBRL(b.spentCents - b.limitCents)} acima do limite de ${formatBRL(b.limitCents)}.`,
        impactCents: b.spentCents - b.limitCents,
        action,
      });
    } else if (b.overOnDay !== null && b.projectedCents !== null) {
      out.push({
        kind: 'budget_pace',
        severity: 'warning',
        dedupeKey: `budget_pace:${ctx.month}:${b.categoryId}`,
        title: `${b.label} deve passar do orçamento`,
        body: `No ritmo atual, passa do limite por volta do dia ${b.overOnDay} e fecha em ${formatBRL(b.projectedCents)}.`,
        impactCents: b.projectedCents - b.limitCents,
        action,
      });
    }
  }
  return out;
}

export function savings(ctx: InsightContext): InsightCandidate[] {
  const closed = previousMonth(ctx.month);
  const totals = new Map(ctx.monthTotals.map((t) => [t.month, t]));
  const last = totals.get(closed);
  if (!last || last.incomeCents <= 0n) return [];
  const name = monthName(closed);
  const base = {
    kind: 'savings' as const,
    dedupeKey: `savings:${closed}`,
    action: { label: 'Ver mês', href: `/painel?mes=${closed}` },
  };
  const net = last.incomeCents - last.expenseCents;
  // Falta só faz sentido com uso contínuo e renda lançada (quem só acompanha o cartão tem
  // como "entrada" apenas estornos).
  const continuous =
    ctx.activeMonths.includes(closed) && ctx.activeMonths.includes(previousMonth(closed));
  if (net < 0n && (!continuous || last.incomeCents * 2n < last.expenseCents)) return [];
  if (net < 0n) {
    return [
      {
        ...base,
        severity: 'warning',
        title: `Faltou dinheiro em ${name}`,
        body: `Em ${name} saiu ${formatBRL(-net)} a mais do que entrou.`,
        impactCents: -net,
      },
    ];
  }
  const rate = Number(net) / Number(last.incomeCents);
  const previous = lastMonths(previousMonth(closed), SAVINGS_MONTHS)
    .map((m) => totals.get(m))
    .filter((t): t is NonNullable<typeof t> => !!t && t.incomeCents > 0n)
    .map((t) => Number(t.incomeCents - t.expenseCents) / Number(t.incomeCents));
  if (previous.length < SAVINGS_MONTHS) return [];
  const sorted = [...previous].sort((a, b) => a - b);
  const reference = sorted[Math.floor(sorted.length / 2)] as number;
  // Tolerância de ponto flutuante: 0,25 − 0,15 precisa contar como 10 p.p.
  if (reference - rate < SAVINGS_DROP - 1e-9) return [];
  return [
    {
      ...base,
      severity: 'info',
      title: `Sobrou menos em ${name}`,
      body: `Sobrou ${Math.round(rate * 100)}% da renda em ${name}, abaixo dos ${Math.round(reference * 100)}% de costume.`,
      impactCents: BigInt(Math.round((reference - rate) * Number(last.incomeCents))),
    },
  ];
}

export function generateInsights(ctx: InsightContext): InsightCandidate[] {
  return [
    ...categorySpike(ctx),
    ...smallPurchases(ctx),
    ...anomalies(ctx),
    ...fees(ctx),
    ...duplicates(ctx),
    ...budgetPace(ctx),
    ...savings(ctx),
    ...recurrenceMissing(ctx),
    ...priceIncrease(ctx),
    ...newSubscription(ctx),
    ...highCommitment(ctx),
    ...installmentEnding(ctx),
  ];
}
