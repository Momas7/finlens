import type { CategoryKind } from '../categories/default-categories';
import { combine, type Status } from './combine';
import { matchKeyword } from './keywords';
import {
  type Candidate,
  type HistoryRow,
  historyCandidates,
  type Neighbor,
  type Rule,
  ruleMatches,
  type Source,
  similarCandidates,
} from './layers';
import { matchMerchant } from './merchants';
import { amountBucket, normalize } from './normalize';

export type Evidence = {
  /** Regras do usuário com categoria ativa. */
  rules: Rule[];
  /** Histórico de confirmados do mesmo estabelecimento (ou descrição normalizada). */
  history: HistoryRow[];
  /** Confirmados parecidos (similaridade > 0,45). */
  neighbors: Neighbor[];
  /** Categoria ativa do workspace para uma system_key; null se arquivada ou inexistente. */
  resolveSystemKey(key: string): { id: string; name: string } | null;
  /** Tipo da categoria (despesa, receita, movimentação); null se desconhecida. */
  kindOf(categoryId: string): CategoryKind | null;
};

/** Saída só aceita despesa; entrada só aceita receita; movimentação vale para os dois. */
function kindFits(kind: CategoryKind | null, amountCents: bigint): boolean {
  if (kind === null || kind === 'movement') return true;
  return kind === (amountCents < 0n ? 'expense' : 'income');
}

export type Classification = {
  category: string | null;
  confidence: number;
  status: Status;
  source: Source | null;
  explanation: string | null;
  merchantKey: string | null;
  normalized: string;
};

export function classify(
  input: { description: string; amountCents: bigint; accountId: string | null },
  evidence: Evidence,
): Classification {
  const n = normalize(input.description);
  const merchant = matchMerchant(n.normalized);
  const merchantKey = merchant?.key ?? null;
  const base = { merchantKey, normalized: n.normalized };
  if (n.normalized === '') {
    return {
      category: null,
      confidence: 0,
      status: 'none',
      source: null,
      explanation: null,
      ...base,
    };
  }

  const candidates: Candidate[] = [];
  const rule = ruleMatches(evidence.rules, {
    normalized: n.normalized,
    merchantKey,
    amountCents: input.amountCents,
    accountId: input.accountId,
  });
  if (rule) {
    candidates.push({
      category: rule.categoryId,
      confidence: 0.99,
      source: 'rule',
      detail: { categoryName: rule.categoryName, pattern: rule.pattern },
    });
  }
  candidates.push(
    ...historyCandidates(
      evidence.history,
      amountBucket(input.amountCents),
      merchant?.name ?? n.normalized,
    ),
    ...similarCandidates(evidence.neighbors),
  );
  if (merchant) {
    const category = evidence.resolveSystemKey(merchant.categoryKey);
    if (category) {
      candidates.push({
        category: category.id,
        confidence: 0.9,
        source: 'merchant',
        detail: { categoryName: category.name, merchantName: merchant.name },
      });
    }
  }
  const keyword = matchKeyword(n.tokens);
  if (keyword) {
    const category = evidence.resolveSystemKey(keyword.categoryKey);
    if (category) {
      candidates.push({
        category: category.id,
        confidence: keyword.confidence,
        source: 'keyword',
        detail: { categoryName: category.name, keyword: keyword.keyword },
      });
    }
  }

  const fitting = candidates.filter((c) =>
    kindFits(evidence.kindOf(c.category), input.amountCents),
  );
  return { ...combine(fitting), ...base };
}
