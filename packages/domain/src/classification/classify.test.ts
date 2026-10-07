import { describe, expect, it } from 'vitest';
import { classify, type Evidence } from './classify';

const categories: Record<
  string,
  { id: string; name: string; kind: 'expense' | 'income' | 'movement' }
> = {
  'food.delivery': { id: 'cat-delivery', name: 'Delivery', kind: 'expense' },
  'food.restaurants': { id: 'cat-rest', name: 'Restaurante', kind: 'expense' },
  'transport.fuel': { id: 'cat-fuel', name: 'Combustível', kind: 'expense' },
  'housing.rent': { id: 'cat-rent', name: 'Aluguel', kind: 'expense' },
  'income.other': { id: 'cat-income', name: 'Outras receitas', kind: 'income' },
};
const kinds: Record<string, 'expense' | 'income' | 'movement'> = Object.fromEntries(
  Object.values(categories).map((c) => [c.id, c.kind]),
);
const empty: Evidence = {
  rules: [],
  history: [],
  neighbors: [],
  resolveSystemKey: (k) => categories[k] ?? null,
  kindOf: (id) => kinds[id] ?? null,
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

  it('entrada não recebe categoria de despesa (histórico)', () => {
    const r = classify(
      { description: 'PIX RECEBIDO JOAO SILVA', amountCents: 150000n, accountId: null },
      {
        ...empty,
        history: [{ categoryId: 'cat-rent', categoryName: 'Aluguel', bucket: 'lg', count: 2 }],
      },
    );
    expect(r.category).toBeNull();
    expect(r.status).toBe('none');
  });
  it('entrada não recebe categoria de despesa (dicionário)', () =>
    expect(
      classify({ description: 'ESTORNO IFOOD', amountCents: 4590n, accountId: null }, empty).status,
    ).toBe('none'));
  it('saída mantém categoria de despesa', () =>
    expect(
      classify({ description: 'IFOOD*REST', amountCents: -4590n, accountId: null }, empty).category,
    ).toBe('cat-delivery'));
});
