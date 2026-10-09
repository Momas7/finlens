import { describe, expect, it } from 'vitest';
import {
  addMonths,
  goalStatus,
  monthlyPace,
  monthlyRate,
  monthsBetween,
  monthsToTarget,
  requiredMonthly,
} from './goal';

describe('taxa e ritmo', () => {
  it('monthlyRate', () => {
    expect(monthlyRate(null)).toBe(0);
    expect(monthlyRate(0)).toBe(0);
    expect(monthlyRate(1050)).toBeCloseTo(0.008355, 5);
  });
  it('monthlyPace', () => {
    expect(monthlyPace([100000n, 150000n, 210000n])).toBe(55000n);
    expect(monthlyPace([100000n, 80000n])).toBe(-20000n);
    expect(monthlyPace([100000n])).toBeNull();
    expect(monthlyPace([])).toBeNull();
  });
});

describe('monthsToTarget', () => {
  it('sem taxa', () => expect(monthsToTarget(620000n, 1000000n, 50000n, 0)).toBe(8));
  it('já atingiu', () => expect(monthsToTarget(1000000n, 1000000n, 0n, 0)).toBe(0));
  it('sem aporte e sem taxa nunca chega', () => {
    expect(monthsToTarget(620000n, 1000000n, 0n, 0)).toBeNull();
    expect(monthsToTarget(620000n, 1000000n, null, 0)).toBeNull();
  });
  it('rendimento antecipa e sozinho também chega', () => {
    expect(monthsToTarget(620000n, 1000000n, 50000n, monthlyRate(1050)) as number).toBeLessThan(8);
    expect(monthsToTarget(900000n, 1000000n, 0n, monthlyRate(1050))).toBe(13);
  });
  it('acima de 600 meses é null; saldo negativo segue a fórmula', () =>
    expect(monthsToTarget(-50000n, 1000000n, 1n, 0)).toBeNull());
});

describe('requiredMonthly', () => {
  it('sem taxa, arredonda para cima', () =>
    expect(requiredMonthly(200000n, 1000000n, 14, 0)).toBe(57143n));
  it('com taxa é menor; rendimento basta dá zero', () => {
    expect(requiredMonthly(200000n, 1000000n, 14, monthlyRate(1050)) as bigint).toBeLessThan(
      57143n,
    );
    expect(requiredMonthly(990000n, 1000000n, 24, monthlyRate(1050))).toBe(0n);
  });
  it('data passada e mês corrente', () => {
    expect(requiredMonthly(200000n, 1000000n, -1, 0)).toBeNull();
    expect(requiredMonthly(200000n, 1000000n, 0, 0)).toBe(800000n);
  });
});

describe('meses e status', () => {
  it('aritmética de meses', () => {
    expect(addMonths('2026-10', 8)).toBe('2027-06');
    expect(monthsBetween('2026-10', '2027-12')).toBe(14);
  });
  it('status', () => {
    expect(
      goalStatus({
        balance: 1000000n,
        target: 1000000n,
        targetMonth: '2027-12',
        projectedMonth: '2026-10',
      }),
    ).toEqual({ status: 'done', delayMonths: null });
    expect(
      goalStatus({ balance: 1n, target: 9n, targetMonth: null, projectedMonth: '2027-01' }).status,
    ).toBe('no_date');
    expect(
      goalStatus({ balance: 1n, target: 9n, targetMonth: '2027-12', projectedMonth: null }).status,
    ).toBe('no_pace');
    expect(
      goalStatus({ balance: 1n, target: 9n, targetMonth: '2027-12', projectedMonth: '2027-06' })
        .status,
    ).toBe('on_track');
    expect(
      goalStatus({ balance: 1n, target: 9n, targetMonth: '2027-06', projectedMonth: '2027-10' }),
    ).toEqual({ status: 'behind', delayMonths: 4 });
  });
});
