import { describe, expect, it } from 'vitest';
import { formatBRL, parseBRL } from './money';

describe('parseBRL', () => {
  it.each([
    ['1.234,56', 123456n],
    ['-1.234,56', -123456n],
    ['R$ 59,90', 5990n],
    ['0,5', 50n],
    ['10', 1000n],
    ['1234.56', 123456n], // ponto decimal (formato OFX)
  ])('%s -> %s', (input, cents) => expect(parseBRL(input)).toBe(cents));

  it.each(['', 'abc', '1,234,5', '12,345'])('rejeita %s', (input) =>
    expect(() => parseBRL(input)).toThrow(/valor inválido/i),
  );
});

describe('formatBRL', () => {
  it('formata centavos', () => {
    expect(formatBRL(123456n)).toBe('R$ 1.234,56');
    expect(formatBRL(-5990n)).toBe('-R$ 59,90');
    expect(formatBRL(0n)).toBe('R$ 0,00');
  });
});
