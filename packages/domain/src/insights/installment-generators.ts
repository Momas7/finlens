import { addMonths } from '../goals/goal';
import { commitmentByMonth } from '../installments/plans';
import { formatBRL } from '../money/money';
import { median } from './stats';
import type { InsightCandidate, InsightContext } from './types';

const COMMITMENT_SHARE_PCT = 30n;
const MIN_INCOME_MONTHS = 2;
const INCOME_MONTHS = 3;
const ACTION = { label: 'Ver parcelas', href: '/painel/parcelas' };

const monthNameFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' });
const monthName = (month: string) => monthNameFmt.format(new Date(`${month}-15T12:00:00Z`));

/** Parcelas do mês seguinte acima de 30% da renda mediana dos últimos meses. */
export function highCommitment(ctx: InsightContext): InsightCandidate[] {
  const next = addMonths(ctx.month, 1);
  const commitment = commitmentByMonth(ctx.installments, ctx.month).find((m) => m.month === next);
  if (!commitment || commitment.cents === 0n) return [];
  const incomes = ctx.monthTotals
    .filter((t) => t.month < ctx.month && t.incomeCents > 0n)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-INCOME_MONTHS)
    .map((t) => t.incomeCents);
  if (incomes.length < MIN_INCOME_MONTHS) return [];
  const income = median(incomes);
  if (commitment.cents * 100n <= income * COMMITMENT_SHARE_PCT) return [];
  const percent = Number((commitment.cents * 100n) / income);
  const name = monthName(next);
  return [
    {
      kind: 'high_commitment',
      severity: 'warning',
      dedupeKey: `high_commitment:${next}`,
      title: `Parcelas pesam em ${name}`,
      body: `As parcelas somam ${formatBRL(commitment.cents)} em ${name}, ${percent}% da sua renda mediana (${formatBRL(income)}).`,
      impactCents: commitment.cents,
      action: ACTION,
    },
  ];
}

/** Parcelamento ativo cuja última parcela cai no mês seguinte. */
export function installmentEnding(ctx: InsightContext): InsightCandidate[] {
  const next = addMonths(ctx.month, 1);
  return ctx.installments
    .filter((p) => p.status === 'active' && p.endDate.slice(0, 7) === next)
    .map((p) => ({
      kind: 'installment_ending' as const,
      severity: 'info' as const,
      dedupeKey: `installment_ending:${p.key}:${next}`,
      title: `Parcelamento termina: ${p.label}`,
      body: `Em ${monthName(next)} termina a parcela de ${formatBRL(p.installmentCents)} de ${p.label}.`,
      impactCents: p.installmentCents,
      action: ACTION,
    }));
}
