import type { InsightCandidate } from './types';

const MIN_IMPACT = 2000n;
const WARNING_WEIGHT = 1.5;
const NEW_WEIGHT = 1.3;
const NEW_FOR_MS = 3 * 86_400_000;

export type InsightState = { firstSeenAt: Date; dismissed: boolean };
export type RankedInsight = InsightCandidate & { isNew: boolean };

/** Filtra dispensados e impacto pequeno; ordena por impacto × severidade × novidade. */
export function rankInsights(
  candidates: InsightCandidate[],
  states: Map<string, InsightState>,
  now: Date,
  limit: number,
): RankedInsight[] {
  return candidates
    .filter((c) => c.impactCents >= MIN_IMPACT && !states.get(c.dedupeKey)?.dismissed)
    .map((c) => {
      const seen = states.get(c.dedupeKey)?.firstSeenAt;
      const isNew = !seen || now.getTime() - seen.getTime() < NEW_FOR_MS;
      const score =
        Number(c.impactCents) *
        (c.severity === 'warning' ? WARNING_WEIGHT : 1) *
        (isNew ? NEW_WEIGHT : 1);
      return { ...c, isNew, score };
    })
    .sort((a, b) => b.score - a.score || a.dedupeKey.localeCompare(b.dedupeKey))
    .slice(0, limit)
    .map(({ score: _score, ...rest }) => rest);
}
