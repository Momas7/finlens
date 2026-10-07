import { describe, expect, it } from 'vitest';
import { classify, type Evidence } from './classify';

const categories: Record<string, { id: string; name: string }> = {
  'food.delivery': { id: 'cat-delivery', name: 'Delivery' },
  'food.restaurants': { id: 'cat-rest', name: 'Restaurante' },
  'transport.fuel': { id: 'cat-fuel', name: 'Combustível' },
};
const empty: Evidence = {
  rules: [],
  history: [],
  neighbors: [],
  resolveSystemKey: (k) => categories[k] ?? null,
};

describe('classify', () => {
  it('IFOOD*REST sem histórico = Delivery 0,90 pelo dicionário', () => {
    expect(
      classify({ description: 'IFOOD*REST', amountCents: -4590n, accountId: null }, empty),
    ).toMatchObject({
      category: 'cat-delivery',
      confidence: 0.9,
      status: 'auto',
      source: 'merchant',
      merchantKey: 'ifood',
      normalized: 'IFOOD REST',
      explanation: 'iFood costuma ser Delivery.',
    });
  });
  it('histórico do usuário vence o dicionário', () => {
    const r = classify(
      { description: 'IFOOD*REST', amountCents: -4590n, accountId: null },
      {
        ...empty,
        history: [{ categoryId: 'cat-rest', categoryName: 'Restaurante', bucket: 'xs', count: 1 }],
      },
    );
    expect(r).toMatchObject({
      category: 'cat-rest',
      confidence: 0.75,
      status: 'likely',
      source: 'history',
    });
  });
  it('palavra-chave para comércio desconhecido', () =>
    expect(
      classify(
        { description: 'AUTO POSTO BOA VIAGEM', amountCents: -20000n, accountId: null },
        empty,
      ),
    ).toMatchObject({
      category: 'cat-fuel',
      source: 'keyword',
      status: 'likely',
    }));
  it('categoria do dicionário não resolvida é descartada', () =>
    expect(
      classify(
        { description: 'IFOOD*REST', amountCents: -4590n, accountId: null },
        { ...empty, resolveSystemKey: () => null },
      ),
    ).toMatchObject({ category: null, status: 'none' }));
  it('descrição vazia = none', () =>
    expect(
      classify({ description: 'PIX ENVIADO', amountCents: -100n, accountId: null }, empty),
    ).toMatchObject({
      status: 'none',
      normalized: '',
      merchantKey: null,
    }));
});
