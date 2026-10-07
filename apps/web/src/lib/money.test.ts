import { describe, expect, it } from 'vitest';
import { formatCents, parseAmountInput } from './money';

describe('formatCents', () => {
  it('formata com sinal tipográfico', () => {
    expect(formatCents('-4590')).toBe('−R$ 45,90');
    expect(formatCents('150000')).toBe('R$ 1.500,00');
  });
});

describe('parseAmountInput', () => {
  it('converte para centavos absolutos', () => {
    expect(parseAmountInput('1.234,56')).toBe('123456');
    expect(parseAmountInput('-10')).toBe('1000');
  });
  it('recusa inválido ou zero', () => {
    expect(parseAmountInput('abc')).toBeNull();
    expect(parseAmountInput('0')).toBeNull();
    expect(parseAmountInput('')).toBeNull();
  });
});
