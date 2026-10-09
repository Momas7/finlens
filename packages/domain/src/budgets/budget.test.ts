import { describe, expect, it } from 'vitest';
import { budgetState, limitFor, pace, suggestBudget } from './budget';

describe('limitFor', () => {
  const v = [
    { effectiveFrom: '2026-08', amountCents: 50000n },
    { effectiveFrom: '2026-10', amountCents: 75000n },
  ];
  it('usa a versão mais recente até o mês', () => {
    expect(limitFor(v, '2026-09')).toBe(50000n);
    expect(limitFor(v, '2026-10')).toBe(75000n);
    expect(limitFor(v, '2026-12')).toBe(75000n);
    expect(limitFor(v, '2026-07')).toBeNull();
  });
  it('remoção vale a partir do mês', () => {
    const removed = [...v, { effectiveFrom: '2026-11', amountCents: null }];
    expect(limitFor(removed, '2026-11')).toBeNull();
    expect(limitFor(removed, '2026-10')).toBe(75000n);
  });
});

describe('budgetState', () => {
  it('limiares de 80% e 100%', () => {
    expect(budgetState(7999n, 10000n)).toBe('ok');
    expect(budgetState(8000n, 10000n)).toBe('warning');
    expect(budgetState(9999n, 10000n)).toBe('warning');
    expect(budgetState(10000n, 10000n)).toBe('over');
  });
});

describe('pace', () => {
  it('antes do dia 5 não projeta', () => expect(pace(10000n, 50000n, 4, 31)).toBeNull());
  it('projeta e diz quando estoura', () =>
    expect(pace(30000n, 50000n, 10, 31)).toEqual({
      projectedCents: 93000n,
      overOnDay: 17,
      dailyAllowanceCents: 909n,
    }));
  it('já passou: sem dia nem folga', () =>
    expect(pace(60000n, 50000n, 10, 30)).toEqual({
      projectedCents: 180000n,
      overOnDay: null,
      dailyAllowanceCents: null,
    }));
  it('último dia divide por um dia', () =>
    expect(pace(1000n, 50000n, 31, 31)?.dailyAllowanceCents).toBe(49000n));
  it('no ritmo sem estourar: sem dia', () =>
    expect(pace(10000n, 50000n, 10, 30)?.overOnDay).toBeNull());
});

describe('suggestBudget', () => {
  it('exige 3 meses', () => expect(suggestBudget([60000n, 70000n])).toBeNull());
  it('mediana ímpar, com mês zerado', () =>
    expect(suggestBudget([60000n, 0n, 72000n])).toBe(60000n));
  it('mediana par arredonda para cima em R$ 50', () =>
    expect(suggestBudget([61000n, 70000n, 52000n, 90000n])).toBe(70000n));
  it('mínimo de R$ 50', () => expect(suggestBudget([100n, 100n, 0n])).toBe(5000n));
  it('categoria que não costuma ter gasto não recebe sugestão', () =>
    expect(suggestBudget([100n, 0n, 0n])).toBeNull());
});
