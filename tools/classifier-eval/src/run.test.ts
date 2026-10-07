import { DEFAULT_CATEGORIES } from '@finlens/domain';
import { describe, expect, it } from 'vitest';
import { DATASET } from './dataset';
import { run } from './run';

describe('harness do classificador', () => {
  const report = run(DATASET);

  it('dataset com ao menos 300 lançamentos e categorias válidas', () => {
    expect(DATASET.length).toBeGreaterThanOrEqual(300);
    const keys = new Set(DEFAULT_CATEGORIES.map((c) => c.key));
    for (const s of DATASET) expect(keys.has(s.expected), s.expected).toBe(true);
  });

  it('relatório consistente', () => {
    expect(report.total).toBe(DATASET.length);
    expect(report.auto + report.likely + report.suggested + report.none).toBe(report.total);
  });

  it('precisão do automático ≥ 95%', () =>
    expect(report.autoPrecision).toBeGreaterThanOrEqual(0.95));

  it('aprende: acerto das últimas 100 ≥ primeiras 100', () =>
    expect(report.lastHundredAccuracy).toBeGreaterThanOrEqual(report.firstHundredAccuracy));

  it('determinístico', () => expect(run(DATASET)).toEqual(report));
});
