import {
  type AmountBucket,
  amountBucket,
  type Classification,
  classify,
  DEFAULT_CATEGORIES,
  type Evidence,
  type HistoryRow,
  matchMerchant,
  type Neighbor,
  normalize,
  type Source,
  trigramSimilarity,
} from '@finlens/domain';
import type { Sample } from './dataset';

const KIND = new Map(DEFAULT_CATEGORIES.map((c) => [c.key, c.kind]));

type Confirmed = { key: string; bucket: AmountBucket; category: string; normalized: string };

export type Report = {
  total: number;
  auto: number;
  likely: number;
  suggested: number;
  none: number;
  autoPrecision: number;
  likelyPrecision: number;
  bySource: Record<string, { count: number; correct: number }>;
  calibration: { range: string; count: number; accuracy: number }[];
  firstHundredAccuracy: number;
  lastHundredAccuracy: number;
};

const NEIGHBOR_THRESHOLD = 0.45;
const ratio = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 1000) / 1000);
const CALIBRATION = [
  [0.7, 0.8],
  [0.8, 0.9],
  [0.9, 0.95],
  [0.95, 1.01],
] as const;

/** Evidência em memória, equivalente ao que a API busca no banco. Categorias = system_key. */
function evidenceFor(description: string, confirmed: Confirmed[]): Evidence {
  const n = normalize(description).normalized;
  const key = matchMerchant(n)?.key ?? n;
  const counts = new Map<string, HistoryRow>();
  for (const c of confirmed.filter((c) => c.key === key)) {
    const id = `${c.category}|${c.bucket}`;
    const row = counts.get(id) ?? {
      categoryId: c.category,
      categoryName: c.category,
      bucket: c.bucket,
      count: 0,
    };
    row.count += 1;
    counts.set(id, row);
  }
  const neighbors: Neighbor[] = confirmed
    .map((c) => ({
      categoryId: c.category,
      categoryName: c.category,
      similarity: trigramSimilarity(n, c.normalized),
    }))
    .filter((x) => x.similarity > NEIGHBOR_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10);
  return {
    rules: [],
    history: [...counts.values()],
    neighbors,
    resolveSystemKey: (k) => ({ id: k, name: k }),
    kindOf: (id) => KIND.get(id) ?? null,
  };
}

/**
 * Classifica cada lançamento na ordem e, logo depois, simula o usuário confirmando a categoria
 * correta — que passa a ensinar o histórico e os vizinhos dos próximos.
 */
export function run(dataset: Sample[]): Report {
  const confirmed: Confirmed[] = [];
  const results: { result: Classification; expected: string }[] = [];
  for (const sample of dataset) {
    const result = classify(
      { description: sample.description, amountCents: sample.amountCents, accountId: null },
      evidenceFor(sample.description, confirmed),
    );
    results.push({ result, expected: sample.expected });
    confirmed.push({
      key: result.merchantKey ?? result.normalized,
      bucket: amountBucket(sample.amountCents),
      category: sample.expected,
      normalized: result.normalized,
    });
  }

  const correct = (r: (typeof results)[number]) => r.result.category === r.expected;
  const withStatus = (s: Classification['status']) => results.filter((r) => r.result.status === s);
  const bySource: Report['bySource'] = {};
  for (const r of results.filter((r) => r.result.source && r.result.status !== 'suggested')) {
    const s = bySource[r.result.source as Source] ?? { count: 0, correct: 0 };
    s.count += 1;
    if (correct(r)) s.correct += 1;
    bySource[r.result.source as Source] = s;
  }
  const accuracy = (slice: typeof results) => ratio(slice.filter(correct).length, slice.length);

  return {
    total: results.length,
    auto: withStatus('auto').length,
    likely: withStatus('likely').length,
    suggested: withStatus('suggested').length,
    none: withStatus('none').length,
    autoPrecision: accuracy(withStatus('auto')),
    likelyPrecision: accuracy(withStatus('likely')),
    bySource,
    calibration: CALIBRATION.map(([lo, hi]) => {
      const inRange = results.filter((r) => r.result.confidence >= lo && r.result.confidence < hi);
      return {
        range: `${lo.toFixed(2)}–${Math.min(hi, 1).toFixed(2)}`,
        count: inRange.length,
        accuracy: accuracy(inRange),
      };
    }),
    firstHundredAccuracy: accuracy(results.slice(0, 100)),
    lastHundredAccuracy: accuracy(results.slice(-100)),
  };
}

const pct = (v: number) => `${(v * 100).toFixed(1).replace('.', ',')}%`;

export function toMarkdown(report: Report, generatedAt: string): string {
  const share = (n: number) => pct(n / report.total);
  const lines = [
    '# Avaliação do classificador',
    '',
    `> Gerado por \`pnpm eval:classifier\` em ${generatedAt}. Dataset sintético de ${report.total} lançamentos (\`tools/classifier-eval/src/dataset.ts\`); depois de cada classificação, a simulação confirma a categoria correta, como um usuário faria.`,
    '',
    '## Resumo',
    '',
    `- Aplicados automaticamente: **${share(report.auto)}**, com precisão de **${pct(report.autoPrecision)}**.`,
    `- Prováveis (aplicados e marcados): ${share(report.likely)}, precisão de ${pct(report.likelyPrecision)}.`,
    `- Só sugeridos ou sem sugestão: ${share(report.suggested + report.none)}.`,
    `- Acerto nas primeiras 100 contra as últimas 100: ${pct(report.firstHundredAccuracy)} → ${pct(report.lastHundredAccuracy)}.`,
    '',
    '## Por status',
    '',
    '| Status | Lançamentos | Parte |',
    '|---|---|---|',
    `| Automático (≥ 0,90) | ${report.auto} | ${share(report.auto)} |`,
    `| Provável (0,70–0,90) | ${report.likely} | ${share(report.likely)} |`,
    `| Sugestão (< 0,70) | ${report.suggested} | ${share(report.suggested)} |`,
    `| Sem sugestão | ${report.none} | ${share(report.none)} |`,
    '',
    '## Precisão por fonte (automáticos e prováveis)',
    '',
    '| Fonte | Lançamentos | Precisão |',
    '|---|---|---|',
    ...Object.entries(report.bySource)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([source, s]) => `| ${source} | ${s.count} | ${pct(ratio(s.correct, s.count))} |`),
    '',
    '## Calibração',
    '',
    'Confiança prometida contra acerto real.',
    '',
    '| Confiança | Lançamentos | Acerto |',
    '|---|---|---|',
    ...report.calibration.map(
      (c) => `| ${c.range.replace(/\./g, ',')} | ${c.count} | ${pct(c.accuracy)} |`,
    ),
    '',
  ];
  return lines.join('\n');
}
