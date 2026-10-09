import { describe, expect, it } from 'vitest';
import { budgetPercent } from './budget-percent';

describe('budgetPercent', () => {
  it('arredonda para baixo, para não contradizer o estado', () => {
    expect(budgetPercent(0.996)).toBe(99);
    expect(budgetPercent(0.796)).toBe(79);
    expect(budgetPercent(1.2)).toBe(120);
    expect(budgetPercent(null)).toBe(0);
  });
});
