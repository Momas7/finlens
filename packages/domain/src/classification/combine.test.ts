import { describe, expect, it } from 'vitest';
import { combine, statusFor } from './combine';
import type { Candidate } from './layers';

const cand = (
  category: string,
  confidence: number,
  source: Candidate['source'],
  extra = {},
): Candidate => ({
  category,
  confidence,
  source,
  detail: {
    categoryName: category,
    merchantName: 'iFood',
    keyword: 'POSTO',
    count: 2,
    neighbors: 2,
    pattern: 'X',
    ...extra,
  },
});

describe('combine', () => {
  it('reforço noisy-OR', () => {
    const r = combine([cand('a', 0.9, 'merchant'), cand('a', 0.75, 'keyword')]);
    expect(r.confidence).toBeCloseTo(0.975, 3);
    expect(r.category).toBe('a');
    expect(r.source).toBe('merchant');
    expect(r.explanation).toBe('iFood costuma ser a. Confirmado por palavra-chave.');
  });
  it('teto 0,99', () =>
    expect(combine([cand('a', 0.98, 'history'), cand('a', 0.85, 'similar')]).confidence).toBe(
      0.99,
    ));
  it('conflito ≥ 0,80 de outra camada derruba para 0,69', () => {
    const r = combine([cand('a', 0.94, 'history'), cand('b', 0.82, 'similar')]);
    expect(r.category).toBe('a');
    expect(r.confidence).toBe(0.69);
    expect(r.status).toBe('suggested');
  });
  it('regra decide sozinha', () => {
    const r = combine([
      cand('r', 0.99, 'rule', { pattern: 'PADARIA X' }),
      cand('a', 0.97, 'history'),
    ]);
    expect(r).toMatchObject({
      category: 'r',
      confidence: 0.99,
      status: 'auto',
      source: 'rule',
      explanation: 'Regra: descrição contém "PADARIA X".',
    });
  });
  it('histórico do usuário anula dicionário e palavra-chave', () => {
    const r = combine([
      cand('rest', 0.75, 'history', { merchantName: 'iFood', count: 1 }),
      cand('deliv', 0.9, 'merchant'),
    ]);
    expect(r).toMatchObject({
      category: 'rest',
      confidence: 0.75,
      status: 'likely',
      explanation: 'Você classificou iFood como rest 1 vez.',
    });
  });
  it('sem candidatos = none', () =>
    expect(combine([])).toMatchObject({
      category: null,
      status: 'none',
      source: null,
      explanation: null,
      confidence: 0,
    }));
  it('explicações por fonte', () => {
    expect(combine([cand('a', 0.8, 'keyword')]).explanation).toBe('A descrição contém POSTO.');
    expect(combine([cand('a', 0.5, 'similar', { neighbors: 1 })]).explanation).toBe(
      'Parecido com 1 lançamento seu em a.',
    );
    expect(combine([cand('a', 0.85, 'similar', { neighbors: 3 })]).explanation).toBe(
      'Parecido com 3 lançamentos seus em a.',
    );
    expect(combine([cand('a', 0.94, 'history', { count: 3 })]).explanation).toBe(
      'Você classificou iFood como a 3 vezes.',
    );
  });
});

describe('statusFor', () => {
  it('limiares', () => {
    expect(statusFor(0.9)).toBe('auto');
    expect(statusFor(0.899)).toBe('likely');
    expect(statusFor(0.7)).toBe('likely');
    expect(statusFor(0.69)).toBe('suggested');
    expect(statusFor(0)).toBe('none');
  });
});
