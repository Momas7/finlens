import { describe, expect, it } from 'vitest';
import type { Recurrence } from '../recurrences/detect';
import { newSubscription, priceIncrease, recurrenceMissing } from './recurrence-generators';
import { ctx } from './test-helpers';

const rec = (over: Partial<Recurrence> = {}): Recurrence => ({
  key: 'm:netflix',
  label: 'Netflix',
  accountId: 'acc',
  cadence: 'monthly',
  typicalCents: 5590n,
  monthlyCents: 5590n,
  firstDate: '2026-05-03',
  lastDate: '2026-09-03',
  nextExpectedDate: '2026-10-03',
  occurrences: 5,
  intervalDays: 30,
  status: 'active',
  priceChange: null,
  isNew: false,
  ...over,
});

describe('recurrenceMissing', () => {
  it('só para atrasadas', () => {
    expect(recurrenceMissing(ctx({ recurrences: [rec()] }))).toEqual([]);
    const [i] = recurrenceMissing(ctx({ recurrences: [rec({ status: 'late' })] }));
    expect(i).toMatchObject({
      kind: 'recurrence_missing',
      severity: 'warning',
      impactCents: 5590n,
      dedupeKey: 'recurrence_missing:m:netflix:2026-10',
      title: 'Netflix não apareceu',
      body: 'Netflix costuma cobrar R$ 55,90 por volta do dia 3; não apareceu este mês.',
    });
    expect(i?.action?.href).toBe('/painel/transacoes?q=Netflix&from=2026-05-03');
  });
});

describe('priceIncrease', () => {
  it('anualiza a diferença pela cadência', () => {
    const change = { fromCents: 5590n, toCents: 5990n };
    const [i] = priceIncrease(ctx({ recurrences: [rec({ priceChange: change })] }));
    expect(i).toMatchObject({
      kind: 'price_increase',
      severity: 'warning',
      impactCents: 4800n,
      dedupeKey: 'price_increase:m:netflix:5990',
      body: 'Netflix subiu de R$ 55,90 para R$ 59,90 (+R$ 48,00 por ano).',
    });
    const weekly = priceIncrease(
      ctx({ recurrences: [rec({ cadence: 'weekly', priceChange: change })] }),
    );
    expect(weekly[0]?.impactCents).toBe(20800n);
    expect(priceIncrease(ctx({ recurrences: [rec()] }))).toEqual([]);
  });
});

describe('newSubscription', () => {
  it('só novas e ativas', () => {
    expect(newSubscription(ctx({ recurrences: [rec()] }))).toEqual([]);
    expect(newSubscription(ctx({ recurrences: [rec({ isNew: true, status: 'late' })] }))).toEqual(
      [],
    );
    const [i] = newSubscription(
      ctx({
        recurrences: [
          rec({
            key: 'm:spotify',
            label: 'Spotify',
            isNew: true,
            typicalCents: 2190n,
            monthlyCents: 2190n,
          }),
        ],
      }),
    );
    expect(i).toMatchObject({
      kind: 'new_subscription',
      severity: 'info',
      impactCents: 26280n,
      dedupeKey: 'new_subscription:m:spotify',
      body: 'Nova assinatura: Spotify, R$ 21,90 por mês.',
    });
  });
});
