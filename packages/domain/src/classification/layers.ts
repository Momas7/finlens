import type { AmountBucket } from './normalize';

export type Source = 'rule' | 'history' | 'similar' | 'merchant' | 'keyword';

export type ExplainDetail = {
  categoryName: string;
  pattern?: string;
  merchantName?: string;
  count?: number;
  neighbors?: number;
  keyword?: string;
};

export type Candidate = {
  category: string;
  confidence: number;
  source: Source;
  detail: ExplainDetail;
};

export type Rule = {
  id: string;
  categoryId: string;
  categoryName: string;
  pattern: string;
  minAmountCents: bigint | null;
  maxAmountCents: bigint | null;
  accountId: string | null;
  priority: number;
  createdAt: string;
};

export type HistoryRow = {
  categoryId: string;
  categoryName: string;
  bucket: AmountBucket;
  count: number;
};
export type Neighbor = { categoryId: string; categoryName: string; similarity: number };

const abs = (v: bigint) => (v < 0n ? -v : v);

/** Regra do usuário que casa: maior prioridade, depois a mais recente. Casamento literal. */
export function ruleMatches(
  rules: Rule[],
  ctx: {
    normalized: string;
    merchantKey: string | null;
    amountCents: bigint;
    accountId: string | null;
  },
): Rule | null {
  const amount = abs(ctx.amountCents);
  // Palavra inteira: uma regra "BAR" não pode decidir "BARBEARIA".
  const padded = ` ${ctx.normalized} `;
  const matching = rules.filter(
    (r) =>
      padded.includes(` ${r.pattern} `) &&
      (r.minAmountCents === null || amount >= r.minAmountCents) &&
      (r.maxAmountCents === null || amount <= r.maxAmountCents) &&
      (r.accountId === null || r.accountId === ctx.accountId),
  );
  matching.sort((a, b) => b.priority - a.priority || b.createdAt.localeCompare(a.createdAt));
  return matching[0] ?? null;
}

/**
 * Histórico com suavização (α = β = 1):
 *   P(c|m)   = n_c / (n + 1)
 *   P(c|m,b) = (n_c,b + P(c|m)) / (n_b + 1)
 */
export function historyCandidates(
  rows: HistoryRow[],
  bucket: AmountBucket,
  merchantName: string,
): Candidate[] {
  const n = rows.reduce((s, r) => s + r.count, 0);
  if (n === 0) return [];
  const nb = rows.filter((r) => r.bucket === bucket).reduce((s, r) => s + r.count, 0);
  const byCategory = new Map<string, { name: string; total: number; inBucket: number }>();
  for (const r of rows) {
    const entry = byCategory.get(r.categoryId) ?? { name: r.categoryName, total: 0, inBucket: 0 };
    entry.total += r.count;
    if (r.bucket === bucket) entry.inBucket += r.count;
    byCategory.set(r.categoryId, entry);
  }
  return [...byCategory.entries()].map(([category, e]) => {
    const pm = e.total / (n + 1);
    return {
      category,
      confidence: (e.inBucket + pm) / (nb + 1),
      source: 'history' as const,
      detail: { categoryName: e.name, merchantName, count: e.total },
    };
  });
}

/** Voto ponderado pela similaridade, com teto 0,85 e exigência de 3 vizinhos para confiança cheia. */
export function similarCandidates(neighbors: Neighbor[]): Candidate[] {
  const total = neighbors.reduce((s, n) => s + n.similarity, 0);
  if (total === 0) return [];
  const byCategory = new Map<string, { name: string; weight: number; count: number }>();
  for (const n of neighbors) {
    const entry = byCategory.get(n.categoryId) ?? { name: n.categoryName, weight: 0, count: 0 };
    entry.weight += n.similarity;
    entry.count += 1;
    byCategory.set(n.categoryId, entry);
  }
  return [...byCategory.entries()].map(([category, e]) => ({
    category,
    confidence: (e.weight / total) * Math.min(1, e.count / 3) * 0.85,
    source: 'similar' as const,
    detail: { categoryName: e.name, neighbors: e.count },
  }));
}
