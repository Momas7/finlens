import { describe, expect, it } from 'vitest';
import { median, robustZ } from './stats';

describe('estatística', () => {
  it('mediana', () => {
    expect(median([3n, 1n, 2n])).toBe(2n);
    expect(median([1n, 2n, 3n, 4n])).toBe(2n);
  });
  it('z robusto', () => {
    expect(robustZ(48000n, [15000n, 15000n, 15000n, 15000n, 15000n])).toBeNull();
    expect(robustZ(30000n, [10000n, 11000n, 9000n, 10000n, 12000n])).toBeCloseTo(
      20000 / (1.4826 * 1000),
      3,
    );
  });
});
