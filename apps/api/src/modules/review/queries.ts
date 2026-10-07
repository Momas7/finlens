import type { Review, ReviewGroup } from '@finlens/contracts';
import { type Tx, transactions } from '@finlens/db';
import { MERCHANTS } from '@finlens/domain';
import { desc, inArray } from 'drizzle-orm';

const MAX_GROUPS = 100;
const MAX_IDS = 200;
const MERCHANT_NAMES = new Map(MERCHANTS.map((m) => [m.key, m.name]));

type Row = typeof transactions.$inferSelect;

/** Chave de agrupamento: estabelecimento, senão descrição normalizada; vazia nunca agrupa. */
export function groupKey(row: Pick<Row, 'id' | 'merchantKey' | 'descriptionNormalized'>): string {
  if (row.merchantKey) return `m:${row.merchantKey}`;
  if (row.descriptionNormalized) return `d:${row.descriptionNormalized}`;
  return `t:${row.id}`;
}

export const signOf = (amountCents: bigint): 'out' | 'in' => (amountCents < 0n ? 'out' : 'in');

function mostCommon<T>(values: T[]): T | null {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function toGroups(rows: Row[], categoryOf: (r: Row) => string | null): ReviewGroup[] {
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${groupKey(r)}|${signOf(r.amountCents)}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const first = list[0] as Row;
      const suggested = mostCommon(list.map(categoryOf).filter((c): c is string => c !== null));
      const confidences = list
        .filter((r) => suggested && categoryOf(r) === suggested)
        .map((r) => r.classificationConfidence)
        .filter((c): c is number => c !== null);
      const label =
        (first.merchantKey && MERCHANT_NAMES.get(first.merchantKey)) ||
        mostCommon(list.map((r) => r.descriptionNormalized).filter(Boolean)) ||
        first.description;
      const total = list.reduce((s, r) => s + r.amountCents, 0n);
      return {
        key,
        sign: signOf(first.amountCents),
        label,
        count: list.length,
        totalCents: total.toString(),
        suggestedCategoryId: suggested,
        confidence: confidences.length > 0 ? Math.max(...confidences.map(Number)) : null,
        transactionIds: list.slice(0, MAX_IDS).map((r) => r.id),
        latestDate: list
          .map((r) => r.postedDate)
          .sort()
          .at(-1) as string,
        abs: total < 0n ? -total : total,
      };
    })
    .sort((a, b) => b.count - a.count || (b.abs > a.abs ? 1 : b.abs < a.abs ? -1 : 0))
    .slice(0, MAX_GROUPS)
    .map(({ abs: _abs, ...group }) => group);
}

/** Pendentes agrupados: sugestão/sem categoria ("precisam de você") e prováveis. */
export async function loadReview(tx: Tx): Promise<Review> {
  const rows = await tx
    .select()
    .from(transactions)
    .where(inArray(transactions.classificationStatus, ['suggested', 'none', 'likely']))
    .orderBy(desc(transactions.postedDate), desc(transactions.id));
  const needsYou = rows.filter((r) => r.classificationStatus !== 'likely');
  const likely = rows.filter((r) => r.classificationStatus === 'likely');
  return {
    needsYou: toGroups(needsYou, (r) => r.suggestedCategoryId),
    likely: toGroups(likely, (r) => r.categoryId),
    counts: { needsYou: needsYou.length, likely: likely.length },
  };
}
