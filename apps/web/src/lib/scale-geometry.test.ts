import { describe, expect, it } from 'vitest';
import { scaleGeometry } from './scale-geometry';

describe('scaleGeometry', () => {
  it('dentro do limite', () =>
    expect(scaleGeometry({ value: 612, max: 750 })).toMatchObject({
      filledPct: 81.6,
      overPct: 0,
      markerPct: 81.6,
      limitPct: null,
    }));

  it('acima do limite', () =>
    expect(scaleGeometry({ value: 900, max: 1000, limit: 750 })).toMatchObject({
      filledPct: 75,
      overPct: 15,
      markerPct: 90,
      limitPct: 75,
    }));

  it('acima do máximo reescala a régua e mostra o excedente', () =>
    expect(scaleGeometry({ value: 1200, max: 750, limit: 750 })).toMatchObject({
      axisMax: 1200,
      filledPct: 62.5,
      overPct: 37.5,
      markerPct: 100,
      limitPct: 62.5,
    }));

  it('dentro do máximo mantém o eixo', () =>
    expect(scaleGeometry({ value: 612, max: 750 }).axisMax).toBe(750));

  it('excedente além do máximo vai até o fim da régua estendida', () =>
    expect(scaleGeometry({ value: 2000, max: 1000, limit: 600 })).toMatchObject({
      axisMax: 2000,
      filledPct: 30,
      overPct: 70,
      limitPct: 30,
    }));

  it.each([[{ value: 10, max: 0 }], [{ value: -5, max: 100 }], [{ value: Number.NaN, max: 100 }]])(
    'degenerado %j',
    (input) => {
      const g = scaleGeometry(input);
      expect(g.filledPct).toBe(0);
      expect(g.overPct).toBe(0);
      expect(g.markerPct).toBe(0);
    },
  );

  it('traços', () =>
    expect(scaleGeometry({ value: 1, max: 4, ticks: 4 }).tickPcts).toEqual([0, 25, 50, 75, 100]));
});
