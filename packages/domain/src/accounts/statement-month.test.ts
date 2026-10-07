import { describe, expect, it } from 'vitest';
import { statementMonth } from './statement-month';

describe('statementMonth', () => {
  it.each([
    ['2026-10-10', 10, '2026-10-01'],
    ['2026-10-11', 10, '2026-11-01'],
    ['2026-12-20', 15, '2027-01-01'],
    ['2026-02-28', 31, '2026-02-01'],
    ['2026-03-01', 31, '2026-03-01'],
    ['2026-04-30', 31, '2026-04-01'],
  ])('statementMonth(%s, %i) = %s', (date, closing, month) =>
    expect(statementMonth(date, closing)).toBe(month),
  );
});
