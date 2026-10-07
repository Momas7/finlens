import { describe, expect, it } from 'vitest';
import type { AmountBucket } from './normalize';
import { commonWordPrefix, suggestRule } from './suggest-rules';

const c = (normalized: string, categoryId: string, bucket: AmountBucket) => ({
  normalized,
  categoryId,
  bucket,
});

describe('commonWordPrefix', () => {
  it('prefixo comum por palavras', () => {
    expect(commonWordPrefix(['AMAZON BR', 'AMAZON MKTPLACE PMTS'])).toBe('AMAZON');
    expect(commonWordPrefix(['PADARIA SAO JOAO', 'PADARIA SAO JOAO'])).toBe('PADARIA SAO JOAO');
    expect(commonWordPrefix(['ABC', 'XYZ'])).toBe('');
    expect(commonWordPrefix([])).toBe('');
  });
});

describe('suggestRule', () => {
  it('consistente sem faixa', () =>
    expect(
      suggestRule(
        [
          c('PADARIA SAO JOAO', 'p', 'xs'),
          c('PADARIA SAO JOAO', 'p', 'xs'),
          c('PADARIA SAO JOAO', 'p', 'sm'),
        ],
        [],
      ),
    ).toEqual({
      pattern: 'PADARIA SAO JOAO',
      categoryId: 'p',
      minAmountCents: null,
      maxAmountCents: null,
      basedOn: 3,
      bucketKey: 'all',
    }));

  it('por faixa contínua', () =>
    expect(
      suggestRule(
        [
          c('AMAZON BR', 'o', 'xs'),
          c('AMAZON BR', 'o', 'xs'),
          c('AMAZON BR', 'casa', 'md'),
          c('AMAZON MKTPLACE', 'casa', 'md'),
          c('AMAZON BR', 'casa', 'lg'),
        ],
        [],
      ),
    ).toEqual({
      pattern: 'AMAZON',
      categoryId: 'casa',
      minAmountCents: 20000n,
      maxAmountCents: null,
      basedOn: 3,
      bucketKey: 'md-lg',
    }));

  it('primeira palavra mais frequente', () =>
    expect(
      suggestRule(
        [c('AMAZON BR', 'o', 'xs'), c('AMAZON X', 'o', 'xs'), c('AMZN MKTP', 'o', 'xs')],
        [],
      )?.pattern,
    ).toBe('AMAZON'));

  it('menos de 3 confirmações', () =>
    expect(suggestRule([c('X LOJA', 'a', 'xs'), c('X LOJA', 'a', 'xs')], [])).toBeNull());

  it('padrão curto', () =>
    expect(
      suggestRule([c('AB', 'a', 'xs'), c('AB', 'a', 'xs'), c('AB', 'a', 'xs')], []),
    ).toBeNull());

  it('regra igual já existe', () =>
    expect(
      suggestRule(
        [c('PADARIA X', 'p', 'xs'), c('PADARIA X', 'p', 'xs'), c('PADARIA X', 'p', 'xs')],
        [{ pattern: 'PADARIA X', categoryId: 'p' }],
      ),
    ).toBeNull());

  it('regra mais geral da mesma categoria cobre', () =>
    expect(
      suggestRule(
        [c('PADARIA X', 'p', 'xs'), c('PADARIA X', 'p', 'xs'), c('PADARIA X', 'p', 'xs')],
        [{ pattern: 'PADARIA', categoryId: 'p' }],
      ),
    ).toBeNull());

  it('regra de outra categoria não impede', () =>
    expect(
      suggestRule(
        [c('PADARIA X', 'p', 'xs'), c('PADARIA X', 'p', 'xs'), c('PADARIA X', 'p', 'xs')],
        [{ pattern: 'PADARIA X', categoryId: 'outra' }],
      ),
    ).not.toBeNull());

  it('categorias misturadas sem faixa dominante', () =>
    expect(
      suggestRule([c('LOJA Z', 'a', 'xs'), c('LOJA Z', 'b', 'xs'), c('LOJA Z', 'a', 'xs')], []),
    ).toBeNull());
});
