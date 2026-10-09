import { describe, expect, it } from 'vitest';
import { monthLabel, monthName, shortMonth } from './month-label';

describe('rótulos de mês', () => {
  it('formata em português', () => {
    expect(monthLabel('2026-10')).toBe('outubro de 2026');
    expect(monthName('2026-03')).toBe('março');
    expect(shortMonth('2026-12')).toBe('dez');
  });
});
