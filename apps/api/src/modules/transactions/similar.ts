import type { SimilarItem } from '@finlens/contracts';
import { type Tx, transactions } from '@finlens/db';
import { amountBucket } from '@finlens/domain';
import { and, desc, eq, gt, lt, ne, or, sql } from 'drizzle-orm';
import { activeCategories } from '../classification/evidence';
import { toTransactionDto } from './repository';

const SIMILARITY = 0.6;
const LIMIT = 50;

/**
 * Lançamentos não confirmados parecidos com `ref` (mesma chave ou similaridade ≥ 0,60, mesmo
 * sinal) que ainda não estão em `categoryId`. Pré-seleção desligada quando o histórico
 * confirmado da chave varia por faixa e o item está em outra faixa.
 */
export async function findSimilar(
  tx: Tx,
  ref: typeof transactions.$inferSelect,
  categoryId: string,
): Promise<SimilarItem[]> {
  if (!ref.descriptionNormalized) return [];
  const sameSign =
    ref.amountCents < 0n ? lt(transactions.amountCents, 0n) : gt(transactions.amountCents, 0n);
  const sameKey = ref.merchantKey
    ? eq(transactions.merchantKey, ref.merchantKey)
    : eq(transactions.descriptionNormalized, ref.descriptionNormalized);
  const rows = await tx
    .select()
    .from(transactions)
    .where(
      and(
        ne(transactions.id, ref.id),
        ne(transactions.classificationStatus, 'confirmed'),
        ne(transactions.descriptionNormalized, ''),
        sql`${transactions.categoryId} is distinct from ${categoryId}`,
        sameSign,
        or(
          sameKey,
          sql`similarity(${transactions.descriptionNormalized}, ${ref.descriptionNormalized}) >= ${SIMILARITY}`,
        ),
      ),
    )
    .orderBy(desc(transactions.postedDate), desc(transactions.id))
    .limit(LIMIT);

  const history = await tx
    .select({ amountCents: transactions.amountCents, categoryId: transactions.categoryId })
    .from(transactions)
    .where(and(eq(transactions.classificationStatus, 'confirmed'), sameKey, sameSign));
  const categoriesByBucket = new Map<string, Set<string>>();
  for (const h of history) {
    if (!h.categoryId) continue;
    const b = amountBucket(h.amountCents);
    categoriesByBucket.set(b, (categoriesByBucket.get(b) ?? new Set()).add(h.categoryId));
  }
  const distinct = new Set(history.map((h) => h.categoryId).filter(Boolean));
  const variesByBucket = distinct.size > 1 && categoriesByBucket.size > 1;
  const refBucket = amountBucket(ref.amountCents);

  const labels = await activeCategories(tx);
  return rows.map((row) => ({
    transaction: toTransactionDto(row),
    currentCategoryLabel: row.categoryId ? (labels.get(row.categoryId)?.label ?? null) : null,
    preselected: !variesByBucket || amountBucket(row.amountCents) === refBucket,
  }));
}
