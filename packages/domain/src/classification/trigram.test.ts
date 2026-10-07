import { expect, it } from 'vitest';
import { trigramSimilarity } from './trigram';

it('igual, disjunto e parecido', () => {
  expect(trigramSimilarity('MARIA CLARA', 'MARIA CLARA')).toBe(1);
  expect(trigramSimilarity('ABC', 'XYZ')).toBe(0);
  expect(trigramSimilarity('MARIA CL', 'MARIA CLARA')).toBeCloseTo(8 / 13, 4);
  expect(trigramSimilarity('', 'X')).toBe(0);
});
