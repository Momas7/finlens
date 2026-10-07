import { expect, it } from 'vitest';
import { matchKeyword } from './keywords';

it.each([
  [['POSTO', 'BOA', 'VIAGEM'], 'transport.fuel', 0.8],
  [['DROGARIA', 'POPULAR'], 'health.pharmacy', 0.8],
  [['PADARIA', 'SAO', 'JOAO'], 'food.bakery', 0.78],
  [['PAGAMENTO', 'FATURA'], 'movement.card_payment', 0.8],
  [['IOF', 'COMPRA', 'INTERNACIONAL'], 'financial.iof', 0.8],
])('%j → %s', (tokens, categoryKey, confidence) =>
  expect(matchKeyword(tokens)).toMatchObject({ categoryKey, confidence }),
);
it('sem palavra-chave', () => expect(matchKeyword(['MARIA', 'CLARA'])).toBeNull());
