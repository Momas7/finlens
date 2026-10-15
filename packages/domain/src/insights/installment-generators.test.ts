import { describe, expect, it } from 'vitest';
import type { InstallmentPlan } from '../installments/plans';
import { highCommitment, installmentEnding } from './installment-generators';
import { ctx } from './test-helpers';

const plan = (over: Partial<InstallmentPlan> = {}): InstallmentPlan => ({
  key: 'd:MAGALU:10:19900',
  label: 'MAGALU',
  accountId: 'acc',
  sampleDescription: 'MAGALU PARC 08/10',
  total: 10,
  lastSeen: 8,
  seenCount: 3,
  installmentCents: 19900n,
  remaining: 2,
  lastSeenDate: '2026-10-05',
  nextDate: '2026-11-05',
  endDate: '2026-12-05',
  remainingCents: 39800n,
  status: 'active',
  schedule: [
    { date: '2026-11-05', cents: 19900n },
    { date: '2026-12-05', cents: 19900n },
  ],
  ...over,
});
const totals = (rows: [string, number][]) =>
  rows.map(([month, income]) => ({ month, incomeCents: BigInt(income), expenseCents: 0n }));

describe('highCommitment', () => {
  const income = totals([
    ['2026-07', 100000],
    ['2026-08', 100000],
    ['2026-09', 100000],
  ]);
  it('dispara acima de 30% da renda mediana do mês seguinte', () => {
    const big = plan({
      installmentCents: 35000n,
      schedule: [{ date: '2026-11-05', cents: 35000n }],
    });
    const [i] = highCommitment(ctx({ installments: [big], monthTotals: income }));
    expect(i).toMatchObject({
      kind: 'high_commitment',
      severity: 'warning',
      impactCents: 35000n,
      dedupeKey: 'high_commitment:2026-11',
      title: 'Parcelas pesam em novembro',
      body: 'As parcelas somam R$ 350,00 em novembro, 35% da sua renda mediana (R$ 1.000,00).',
    });
    expect(i?.action?.href).toBe('/painel/parcelas');
  });
  it('não dispara com 30% ou menos, sem renda ou com planos parados', () => {
    const edge = plan({ schedule: [{ date: '2026-11-05', cents: 30000n }] });
    expect(highCommitment(ctx({ installments: [edge], monthTotals: income }))).toEqual([]);
    const big = plan({ schedule: [{ date: '2026-11-05', cents: 90000n }] });
    expect(highCommitment(ctx({ installments: [big], monthTotals: [] }))).toEqual([]);
    expect(
      highCommitment(ctx({ installments: [{ ...big, status: 'stale' }], monthTotals: income })),
    ).toEqual([]);
  });
});

describe('installmentEnding', () => {
  it('só planos ativos que terminam no mês seguinte', () => {
    const ending = plan({
      remaining: 1,
      endDate: '2026-11-05',
      schedule: [{ date: '2026-11-05', cents: 19900n }],
    });
    const [i] = installmentEnding(ctx({ installments: [ending] }));
    expect(i).toMatchObject({
      kind: 'installment_ending',
      severity: 'info',
      impactCents: 19900n,
      dedupeKey: 'installment_ending:d:MAGALU:10:19900:2026-11',
      title: 'Parcelamento termina: MAGALU',
      body: 'Em novembro termina a parcela de R$ 199,00 de MAGALU.',
    });
    expect(installmentEnding(ctx({ installments: [plan()] }))).toEqual([]);
    expect(installmentEnding(ctx({ installments: [{ ...ending, status: 'stale' }] }))).toEqual([]);
  });
});
