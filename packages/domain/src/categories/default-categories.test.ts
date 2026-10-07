import { expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from './default-categories';

it('DEFAULT_CATEGORIES íntegra', () => {
  const keys = DEFAULT_CATEGORIES.map((c) => c.key);
  expect(new Set(keys).size).toBe(keys.length);
  for (const c of DEFAULT_CATEGORIES) {
    if (!c.parentKey) continue;
    const parent = DEFAULT_CATEGORIES.find((p) => p.key === c.parentKey);
    expect(parent).toBeDefined();
    expect(parent?.parentKey).toBeUndefined();
    expect(parent?.kind).toBe(c.kind);
  }
  expect(keys).toEqual(
    expect.arrayContaining([
      'food.delivery',
      'transport.fuel',
      'subscriptions.streaming',
      'income.salary',
      'movement.transfer',
      'movement.card_payment',
    ]),
  );
});
