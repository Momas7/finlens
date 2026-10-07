import type { AmountBucket } from './normalize';

export type Confirmation = { normalized: string; categoryId: string; bucket: AmountBucket };

export type RuleSuggestionDraft = {
  pattern: string;
  categoryId: string;
  minAmountCents: bigint | null;
  maxAmountCents: bigint | null;
  /** Quantas confirmações sustentam a sugestão. */
  basedOn: number;
  /** "all" ou faixas cobertas, como "md-lg". */
  bucketKey: string;
};

const BUCKETS: AmountBucket[] = ['xs', 'sm', 'md', 'lg'];
export const BUCKET_RANGES: Record<AmountBucket, { min: bigint; max: bigint | null }> = {
  xs: { min: 0n, max: 4999n },
  sm: { min: 5000n, max: 19999n },
  md: { min: 20000n, max: 99999n },
  lg: { min: 100000n, max: null },
};

const MIN_CONFIRMATIONS = 3;
const MIN_PATTERN_LENGTH = 3;

/** Maior sequência de palavras iniciais em comum. */
export function commonWordPrefix(texts: string[]): string {
  if (texts.length === 0) return '';
  const words = texts.map((t) => t.split(' ').filter(Boolean));
  const first = words[0] as string[];
  const prefix: string[] = [];
  for (let i = 0; i < first.length; i++) {
    if (words.every((w) => w[i] === first[i])) prefix.push(first[i] as string);
    else break;
  }
  return prefix.join(' ');
}

/** Padrão a partir das descrições que começam pela primeira palavra mais frequente. */
function patternFor(confirmations: Confirmation[]): string {
  const counts = new Map<string, number>();
  for (const c of confirmations) {
    const word = c.normalized.split(' ')[0] ?? '';
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const [topWord] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [''];
  return commonWordPrefix(
    confirmations.filter((c) => c.normalized.split(' ')[0] === topWord).map((c) => c.normalized),
  );
}

const covers = (existing: string, pattern: string) => ` ${pattern} `.includes(` ${existing} `);

/**
 * Propõe uma regra quando as confirmações de uma chave são consistentes: todas na mesma
 * categoria (sem faixa) ou numa sequência contínua de faixas de valor (com faixa).
 */
export function suggestRule(
  confirmations: Confirmation[],
  existing: { pattern: string; categoryId: string }[],
): RuleSuggestionDraft | null {
  if (confirmations.length < MIN_CONFIRMATIONS) return null;
  const pattern = patternFor(confirmations);
  if (pattern.length < MIN_PATTERN_LENGTH) return null;

  let draft: RuleSuggestionDraft | null = null;
  const categories = new Set(confirmations.map((c) => c.categoryId));
  if (categories.size === 1) {
    draft = {
      pattern,
      categoryId: confirmations[0]?.categoryId as string,
      minAmountCents: null,
      maxAmountCents: null,
      basedOn: confirmations.length,
      bucketKey: 'all',
    };
  } else {
    // Categoria única por faixa; procura a maior sequência contínua de faixas com a mesma categoria.
    const byBucket = new Map<AmountBucket, { category: string | null; count: number }>();
    for (const b of BUCKETS) {
      const inBucket = confirmations.filter((c) => c.bucket === b);
      if (inBucket.length === 0) continue;
      const cats = new Set(inBucket.map((c) => c.categoryId));
      byBucket.set(b, {
        category: cats.size === 1 ? (inBucket[0]?.categoryId as string) : null,
        count: inBucket.length,
      });
    }
    let best: { start: number; end: number; category: string; count: number } | null = null;
    let run: { start: number; end: number; category: string; count: number } | null = null;
    for (let i = 0; i < BUCKETS.length; i++) {
      const info = byBucket.get(BUCKETS[i] as AmountBucket);
      if (info?.category && run && run.category === info.category && run.end === i - 1) {
        run = { ...run, end: i, count: run.count + info.count };
      } else if (info?.category) {
        run = { start: i, end: i, category: info.category, count: info.count };
      } else if (!info) {
        // Faixa sem confirmações não quebra a sequência.
        if (run) run = { ...run, end: i };
        continue;
      } else {
        run = null;
      }
      if (run && (!best || run.count > best.count)) best = { ...run };
    }
    if (best && best.count >= MIN_CONFIRMATIONS) {
      // Corta faixas vazias das pontas.
      let start = best.start;
      let end = best.end;
      while (!byBucket.has(BUCKETS[start] as AmountBucket)) start++;
      while (!byBucket.has(BUCKETS[end] as AmountBucket) && end > start) end--;
      const first = BUCKETS[start] as AmountBucket;
      const last = BUCKETS[end] as AmountBucket;
      draft = {
        pattern,
        categoryId: best.category,
        minAmountCents: BUCKET_RANGES[first].min,
        maxAmountCents: BUCKET_RANGES[last].max,
        basedOn: best.count,
        bucketKey: start === end ? first : `${first}-${BUCKETS[end]}`,
      };
    }
  }

  if (!draft) return null;
  const alreadyCovered = existing.some(
    (r) => r.categoryId === draft.categoryId && covers(r.pattern, draft.pattern),
  );
  return alreadyCovered ? null : draft;
}
