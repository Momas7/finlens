import { describe, expect, it } from 'vitest';
import { accountBalance, openInvoice } from './balance';

describe('accountBalance', () => {
  it('soma só a partir da data inicial', () =>
    expect(
      accountBalance(100000n, '2026-10-01', [
        { postedDate: '2026-09-30', amountCents: -5000n },
        { postedDate: '2026-10-01', amountCents: -2500n },
        { postedDate: '2026-10-05', amountCents: 10000n },
      ]),
    ).toBe(107500n));
});

describe('openInvoice', () => {
  it('soma compras e estornos do mês da fatura', () =>
    expect(
      openInvoice(
        [
          { statementMonth: '2026-10-01', amountCents: -4590n },
          { statementMonth: '2026-10-01', amountCents: -1000n },
          { statementMonth: '2026-11-01', amountCents: -999n },
          { statementMonth: '2026-10-01', amountCents: 590n },
        ],
        '2026-10-01',
      ),
    ).toBe(5000n));
});
