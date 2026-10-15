import { formatBRL } from '../money/money';
import type { Recurrence } from '../recurrences/detect';
import type { InsightCandidate, InsightContext } from './types';

const YEARLY_FACTOR: Record<Recurrence['cadence'], bigint> = {
  weekly: 52n,
  monthly: 12n,
  quarterly: 4n,
  annual: 1n,
};

const searchAction = (r: Recurrence) => ({
  label: 'Ver lançamentos',
  href: `/painel/transacoes?${new URLSearchParams({ q: r.label, from: r.firstDate })}`,
});

/** Assinatura ou conta que costuma cobrar e não apareceu na data esperada. */
export function recurrenceMissing(ctx: InsightContext): InsightCandidate[] {
  return ctx.recurrences
    .filter((r) => r.status === 'late')
    .map((r) => ({
      kind: 'recurrence_missing' as const,
      severity: 'warning' as const,
      dedupeKey: `recurrence_missing:${r.key}:${r.nextExpectedDate.slice(0, 7)}`,
      title: `${r.label} não apareceu`,
      body: `${r.label} costuma cobrar ${formatBRL(r.typicalCents)} por volta do dia ${Number(r.nextExpectedDate.slice(8))}; não apareceu este mês.`,
      impactCents: r.typicalCents,
      action: searchAction(r),
    }));
}

/** Cobrança recorrente que subiu de valor; o impacto é a diferença por ano. */
export function priceIncrease(ctx: InsightContext): InsightCandidate[] {
  return ctx.recurrences.flatMap((r) => {
    if (!r.priceChange) return [];
    const { fromCents, toCents } = r.priceChange;
    const perYear = (toCents - fromCents) * YEARLY_FACTOR[r.cadence];
    return [
      {
        kind: 'price_increase' as const,
        severity: 'warning' as const,
        dedupeKey: `price_increase:${r.key}:${toCents}`,
        title: `${r.label} ficou mais cara`,
        body: `${r.label} subiu de ${formatBRL(fromCents)} para ${formatBRL(toCents)} (+${formatBRL(perYear)} por ano).`,
        impactCents: perYear,
        action: searchAction(r),
      },
    ];
  });
}

/** Cobrança que começou a se repetir há pouco. */
export function newSubscription(ctx: InsightContext): InsightCandidate[] {
  return ctx.recurrences
    .filter((r) => r.isNew && r.status === 'active')
    .map((r) => ({
      kind: 'new_subscription' as const,
      severity: 'info' as const,
      dedupeKey: `new_subscription:${r.key}`,
      title: `Nova assinatura: ${r.label}`,
      body: `Nova assinatura: ${r.label}, ${formatBRL(r.monthlyCents)} por mês.`,
      impactCents: r.monthlyCents * 12n,
      action: searchAction(r),
    }));
}
