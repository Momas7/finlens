import { describe, expect, it } from 'vitest';
import {
  comparisonCutoff,
  deltaPoints,
  lastMonths,
  monthRange,
  nextMonth,
  parseMonth,
  previousMonth,
  spentShare,
} from './month';

describe('meses', () => {
  it('parseMonth', () => {
    expect(parseMonth('2026-10')).toBe('2026-10');
    expect(parseMonth('2026-13')).toBeNull();
    expect(parseMonth('2026-00')).toBeNull();
    expect(parseMonth('abc')).toBeNull();
    expect(parseMonth('1999-05')).toBeNull();
  });
  it('monthRange', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange('2028-02').to).toBe('2028-02-29');
    expect(monthRange('2026-04').to).toBe('2026-04-30');
    expect(monthRange('2026-12').to).toBe('2026-12-31');
  });
  it('anterior, seguinte e últimos meses na virada de ano', () => {
    expect(previousMonth('2026-01')).toBe('2025-12');
    expect(nextMonth('2026-12')).toBe('2027-01');
    expect(lastMonths('2026-02', 6)).toEqual([
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });
  it('comparisonCutoff limita ao último dia do mês anterior', () => {
    expect(comparisonCutoff('2026-03', 31)).toBe('2026-02-28');
    expect(comparisonCutoff('2028-03', 31)).toBe('2028-02-29');
    expect(comparisonCutoff('2026-10', 15)).toBe('2026-09-15');
    expect(comparisonCutoff('2026-01', 31)).toBe('2025-12-31');
  });
});

describe('percentuais', () => {
  it('spentShare', () => {
    expect(spentShare(0n, 500n)).toBeNull();
    expect(spentShare(1000n, 1500n)).toBe(1.5);
    expect(spentShare(720000n, 485985n)).toBeCloseTo(0.675, 3);
  });
  it('deltaPoints', () => {
    expect(deltaPoints(0.67, 0.58)).toBe(9);
    expect(deltaPoints(0.5, 0.62)).toBe(-12);
    expect(deltaPoints(null, 0.5)).toBeNull();
    expect(deltaPoints(0.5, null)).toBeNull();
  });
});
