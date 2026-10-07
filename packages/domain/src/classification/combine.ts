import { explain } from './explain';
import type { Candidate, Source } from './layers';

export type Status = 'auto' | 'likely' | 'suggested' | 'none';

export type Combined = {
  category: string | null;
  confidence: number;
  status: Status;
  source: Source | null;
  explanation: string | null;
};

export const AUTO_THRESHOLD = 0.9;
export const LIKELY_THRESHOLD = 0.7;
const CONFLICT_THRESHOLD = 0.8;
const CONFLICT_CAP = 0.69;
const MAX_CONFIDENCE = 0.99;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function statusFor(confidence: number): Status {
  if (confidence <= 0) return 'none';
  if (confidence >= AUTO_THRESHOLD) return 'auto';
  if (confidence >= LIKELY_THRESHOLD) return 'likely';
  return 'suggested';
}

const NONE: Combined = {
  category: null,
  confidence: 0,
  status: 'none',
  source: null,
  explanation: null,
};

/**
 * Junta os candidatos das camadas:
 * 1. regra decide sozinha;
 * 2. havendo histórico/similares do usuário, dicionário e palavra-chave que discordam são ignorados;
 * 3. candidatos da mesma categoria se reforçam (noisy-OR, teto 0,99);
 * 4. outra camada apontando outra categoria com ≥ 0,80 derruba para 0,69.
 */
export function combine(candidates: Candidate[]): Combined {
  const rule = candidates.find((c) => c.source === 'rule');
  if (rule) {
    return {
      category: rule.category,
      confidence: rule.confidence,
      status: statusFor(rule.confidence),
      source: 'rule',
      explanation: explain(rule, []),
    };
  }

  // Havendo evidência do próprio usuário, dicionário e palavra-chave só entram se concordarem
  // com ela: discordando, valem menos que o histórico; concordando, reforçam a confiança.
  const personal = candidates.filter((c) => c.source === 'history' || c.source === 'similar');
  const personalCategories = new Set(personal.map((c) => c.category));
  const pool = (
    personal.length > 0
      ? candidates.filter((c) => personal.includes(c) || personalCategories.has(c.category))
      : candidates
  ).filter((c) => c.confidence > 0);
  if (pool.length === 0) return NONE;

  const groups = new Map<string, Candidate[]>();
  for (const c of pool) groups.set(c.category, [...(groups.get(c.category) ?? []), c]);

  const scored = [...groups.entries()]
    .map(([category, list]) => {
      const sorted = [...list].sort((a, b) => b.confidence - a.confidence);
      const confidence = Math.min(
        MAX_CONFIDENCE,
        1 - sorted.reduce((p, c) => p * (1 - c.confidence), 1),
      );
      return { category, list: sorted, confidence };
    })
    .sort((a, b) => b.confidence - a.confidence);

  const best = scored[0] as (typeof scored)[number];
  const decisive = best.list[0] as Candidate;
  let confidence = round3(best.confidence);

  const rival = scored
    .slice(1)
    .flatMap((g) => g.list)
    .find((c) => c.confidence >= CONFLICT_THRESHOLD && c.source !== decisive.source);
  if (rival) confidence = Math.min(confidence, CONFLICT_CAP);

  return {
    category: best.category,
    confidence,
    status: statusFor(confidence),
    source: decisive.source,
    explanation: explain(
      decisive,
      best.list.slice(1).map((c) => c.source),
    ),
  };
}
