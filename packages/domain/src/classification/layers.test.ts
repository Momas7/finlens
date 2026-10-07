import { describe, expect, it } from 'vitest';
import { historyCandidates, type Rule, ruleMatches, similarCandidates } from './layers';

const row = (categoryId: string, bucket: 'xs' | 'sm' | 'md' | 'lg', count: number) => ({
  categoryId,
  categoryName: categoryId,
  bucket,
  count,
});

describe('historyCandidates', () => {
  const best = (rows: ReturnType<typeof row>[], bucket: 'xs' | 'md') =>
    historyCandidates(rows, bucket, 'iFood').sort((a, b) => b.confidence - a.confidence)[0];
  it('uma confirmação na faixa = 0,75', () =>
    expect(best([row('d', 'xs', 1)], 'xs')?.confidence).toBeCloseTo(0.75, 3));
  it('três confirmações = 0,9375', () =>
    expect(best([row('d', 'xs', 3)], 'xs')?.confidence).toBeCloseTo(0.9375, 4));
  it('dez mais uma correção na faixa = 0,903', () => {
    const top = best([row('d', 'xs', 10), row('x', 'xs', 1)], 'xs');
    expect(top?.category).toBe('d');
    expect(top?.confidence).toBeCloseTo(0.9028, 3);
  });
  it('outra faixa = P(c|m)', () =>
    expect(best([row('d', 'xs', 3)], 'md')?.confidence).toBeCloseTo(0.75, 3));
  it('detalhe para explicação', () =>
    expect(best([row('d', 'xs', 3)], 'xs')).toMatchObject({
      source: 'history',
      detail: { merchantName: 'iFood', count: 3 },
    }));
});

describe('similarCandidates', () => {
  const n = (categoryId: string, similarity: number) => ({
    categoryId,
    categoryName: categoryId,
    similarity,
  });
  it('três vizinhos iguais = teto 0,85', () =>
    expect(similarCandidates([n('a', 0.9), n('a', 0.9), n('a', 0.9)])[0]?.confidence).toBeCloseTo(
      0.85,
      3,
    ));
  it('um vizinho = 0,85/3', () =>
    expect(similarCandidates([n('a', 0.6)])[0]?.confidence).toBeCloseTo(0.85 / 3, 3));
  it('voto ponderado', () => {
    const c = similarCandidates([n('a', 0.9), n('a', 0.9), n('a', 0.9), n('b', 0.5)]);
    expect(c.find((x) => x.category === 'a')?.confidence).toBeCloseTo((2.7 / 3.2) * 0.85, 3);
  });
  it('sem vizinhos', () => expect(similarCandidates([])).toEqual([]));
});

describe('ruleMatches', () => {
  const rule = (pattern: string, extra: Partial<Rule> = {}): Rule => ({
    id: pattern,
    categoryId: 'c',
    categoryName: 'C',
    pattern,
    minAmountCents: null,
    maxAmountCents: null,
    accountId: null,
    priority: 0,
    createdAt: '2026-10-01T00:00:00Z',
    ...extra,
  });
  const ctx = (normalized: string, amountCents = -1000n, accountId: string | null = null) => ({
    normalized,
    merchantKey: null,
    amountCents,
    accountId,
  });
  it('casamento literal com caracteres especiais', () => {
    expect(ruleMatches([rule('50% OFF')], ctx('LOJA 50% OFF'))?.id).toBe('50% OFF');
    expect(ruleMatches([rule('C&A')], ctx('C&A MODAS'))?.id).toBe('C&A');
    expect(ruleMatches([rule('A.B')], ctx('AXB'))).toBeNull();
  });
  it('faixa de valor (absoluto) e conta', () => {
    const r = rule('LOJA', { minAmountCents: 5000n, maxAmountCents: 10000n, accountId: 'acc' });
    expect(ruleMatches([r], ctx('LOJA', -7000n, 'acc'))).not.toBeNull();
    expect(ruleMatches([r], ctx('LOJA', -1000n, 'acc'))).toBeNull();
    expect(ruleMatches([r], ctx('LOJA', -7000n, 'outra'))).toBeNull();
  });
  it('prioridade e depois a mais recente', () => {
    const a = rule('LOJA', { id: 'a', priority: 0, createdAt: '2026-10-02T00:00:00Z' });
    const b = rule('LOJA', { id: 'b', priority: 1, createdAt: '2026-10-01T00:00:00Z' });
    const c = rule('LOJA', { id: 'c', priority: 0, createdAt: '2026-10-03T00:00:00Z' });
    expect(ruleMatches([a, b, c], ctx('LOJA'))?.id).toBe('b');
    expect(ruleMatches([a, c], ctx('LOJA'))?.id).toBe('c');
  });
});
