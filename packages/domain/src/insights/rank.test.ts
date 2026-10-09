import { describe, expect, it } from 'vitest';
import { rankInsights } from './rank';
import type { InsightCandidate } from './types';

const c = (
  key: string,
  impact: bigint,
  severity: 'info' | 'warning' = 'info',
): InsightCandidate => ({
  kind: 'fees',
  severity,
  dedupeKey: key,
  title: key,
  body: key,
  impactCents: impact,
  action: null,
});
const now = new Date('2026-10-20T12:00:00Z');
const old = { firstSeenAt: new Date('2026-10-10T12:00:00Z'), dismissed: false };

describe('rankInsights', () => {
  it('filtra impacto pequeno e dispensados', () => {
    const states = new Map([
      ['a', old],
      ['b', { ...old, dismissed: true }],
    ]);
    expect(
      rankInsights([c('a', 1999n), c('b', 50000n), c('c', 2000n)], states, now, 20).map(
        (i) => i.dedupeKey,
      ),
    ).toEqual(['c']);
  });
  it('atenção pesa 1,5 e novidade 1,3', () => {
    const states = new Map([
      ['info', old],
      ['warn', old],
    ]);
    const ranked = rankInsights([c('info', 14000n), c('warn', 10000n, 'warning')], states, now, 20);
    expect(ranked.map((i) => i.dedupeKey)).toEqual(['warn', 'info']);
    expect(ranked.every((i) => !i.isNew)).toBe(true);
    const fresh = rankInsights(
      [c('info', 14000n), c('new', 12000n)],
      new Map([['info', old]]),
      now,
      20,
    );
    expect(fresh.map((i) => [i.dedupeKey, i.isNew])).toEqual([
      ['new', true],
      ['info', false],
    ]);
  });
  it('respeita o limite', () =>
    expect(
      rankInsights([c('a', 9000n), c('b', 8000n), c('c', 7000n)], new Map(), now, 2),
    ).toHaveLength(2));
});
