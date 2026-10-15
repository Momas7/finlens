import { describe, expect, it } from 'vitest';
import { findTransferPairs, type TransferAccount, type TransferCandidate } from './pairs';

const accounts: TransferAccount[] = [
  { id: 'inter', name: 'Inter', type: 'checking' },
  { id: 'reserva', name: 'Reserva', type: 'savings' },
  { id: 'mp', name: 'Mercado Pago', type: 'credit_card' },
  { id: 'nu', name: 'Nubank', type: 'credit_card' },
];

const c = (
  id: string,
  accountId: string,
  postedDate: string,
  amountCents: bigint,
  descriptionNormalized = 'COMPRA',
): TransferCandidate => ({ id, accountId, postedDate, amountCents, descriptionNormalized });

const find = (candidates: TransferCandidate[], dismissed = new Set<string>()) =>
  findTransferPairs({ candidates, accounts, dismissed });

describe('findTransferPairs', () => {
  it('liga sozinho: valores opostos, 1 dia, PIX no texto, par único', () => {
    const { auto, suggested } = find([
      c('a', 'inter', '2026-10-12', -50000n, 'PIX RESERVA'),
      c('b', 'reserva', '2026-10-13', 50000n, 'PIX RECEBIDO'),
    ]);
    expect(suggested).toEqual([]);
    expect(auto).toHaveLength(1);
    expect(auto[0]).toMatchObject({ kind: 'transfer', key: 'a:b' });
    expect(auto[0]?.a.id).toBe('a');
    expect(auto[0]?.b.id).toBe('b');
    expect(auto[0]?.reason).toBe('Valores iguais e opostos em 12/10 e 13/10, com PIX no texto.');
  });

  it('sem menção ou com 2 dias vira sugestão', () => {
    const noText = find([
      c('a', 'inter', '2026-10-12', -5000n),
      c('b', 'reserva', '2026-10-12', 5000n),
    ]);
    expect(noText.auto).toEqual([]);
    expect(noText.suggested).toHaveLength(1);
    expect(noText.suggested[0]?.reason).toBe('Valores iguais e opostos em 12/10 e 12/10.');
    const twoDays = find([
      c('a', 'inter', '2026-10-12', -5000n, 'TED'),
      c('b', 'reserva', '2026-10-14', 5000n, 'TED'),
    ]);
    expect(twoDays.auto).toEqual([]);
    expect(twoDays.suggested).toHaveLength(1);
    expect(
      find([
        c('a', 'inter', '2026-10-12', -5000n, 'TED'),
        c('b', 'reserva', '2026-10-15', 5000n, 'TED'),
      ]).suggested,
    ).toEqual([]);
  });

  it('ambíguo (duas saídas iguais) nunca liga sozinho', () => {
    const { auto, suggested } = find([
      c('a1', 'inter', '2026-10-12', -5000n, 'PIX'),
      c('a2', 'inter', '2026-10-12', -5000n, 'PIX'),
      c('b', 'reserva', '2026-10-12', 5000n, 'PIX'),
    ]);
    expect(auto).toEqual([]);
    expect(suggested.map((p) => p.key).sort()).toEqual(['a1:b', 'a2:b']);
  });

  it('não forma par: mesma conta, 1 centavo, dois cartões, cartão no lado negativo', () => {
    expect(
      find([
        c('a', 'inter', '2026-10-12', -5000n, 'PIX'),
        c('b', 'inter', '2026-10-12', 5000n, 'PIX'),
      ]),
    ).toEqual({ auto: [], suggested: [] });
    expect(
      find([
        c('a', 'inter', '2026-10-12', -5000n, 'PIX'),
        c('b', 'reserva', '2026-10-12', 5001n, 'PIX'),
      ]),
    ).toEqual({ auto: [], suggested: [] });
    expect(find([c('a', 'mp', '2026-10-12', -5000n), c('b', 'nu', '2026-10-12', 5000n)])).toEqual({
      auto: [],
      suggested: [],
    });
    // compra no cartão (negativa) + entrada na corrente: não é pagamento de fatura
    expect(
      find([c('a', 'mp', '2026-10-12', -5000n), c('b', 'inter', '2026-10-12', 5000n, 'PIX')]),
    ).toEqual({ auto: [], suggested: [] });
  });

  it('pagamento de fatura: corrente − e cartão +', () => {
    const { auto } = find([
      c('a', 'inter', '2026-10-12', -120000n, 'PAGAMENTO FATURA'),
      c('b', 'mp', '2026-10-12', 120000n, 'PAGAMENTO RECEBIDO'),
    ]);
    expect(auto).toHaveLength(1);
    expect(auto[0]?.kind).toBe('card_payment');
    expect(auto[0]?.reason).toContain('com FATURA no texto');
  });

  it('o nome da outra conta no texto conta como menção', () => {
    const { auto } = find([
      c('a', 'inter', '2026-10-12', -9000n, 'ENVIO PARA RESERVA'),
      c('b', 'reserva', '2026-10-12', 9000n, 'ENTRADA'),
    ]);
    expect(auto).toHaveLength(1);
    expect(auto[0]?.reason).toContain('com RESERVA no texto');
  });

  it('ignora pares dispensados', () => {
    expect(
      find(
        [
          c('a', 'inter', '2026-10-12', -5000n, 'PIX'),
          c('b', 'reserva', '2026-10-12', 5000n, 'PIX'),
        ],
        new Set(['a:b']),
      ),
    ).toEqual({ auto: [], suggested: [] });
  });

  it('sem candidatos não quebra', () => expect(find([])).toEqual({ auto: [], suggested: [] }));
});
