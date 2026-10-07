import { categories, classificationRules, type Tx, transactions } from '@finlens/db';
import type { AmountBucket, Evidence, HistoryRow, Neighbor, Rule } from '@finlens/domain';
import { and, desc, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm';

const NEIGHBOR_THRESHOLD = 0.45;
const NEIGHBOR_LIMIT = 10;

export type ActiveCategory = {
  id: string;
  name: string;
  label: string;
  systemKey: string | null;
  kind: 'expense' | 'income' | 'movement';
};

/** Categorias ativas do workspace, com rótulo "Raiz › Filha". */
export async function activeCategories(tx: Tx): Promise<Map<string, ActiveCategory>> {
  const rows = await tx
    .select({
      id: categories.id,
      name: categories.name,
      parentId: categories.parentId,
      systemKey: categories.systemKey,
      kind: categories.kind,
    })
    .from(categories)
    .where(isNull(categories.archivedAt));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const result = new Map<string, ActiveCategory>();
  for (const r of rows) {
    const parent = r.parentId ? byId.get(r.parentId) : undefined;
    // Filha de raiz arquivada não está ativa.
    if (r.parentId && !parent) continue;
    result.set(r.id, {
      id: r.id,
      name: r.name,
      label: parent ? `${parent.name} › ${r.name}` : r.name,
      systemKey: r.systemKey,
      kind: r.kind,
    });
  }
  return result;
}

const bucketSql = sql<AmountBucket>`case
  when abs(${transactions.amountCents}) < 5000 then 'xs'
  when abs(${transactions.amountCents}) < 20000 then 'sm'
  when abs(${transactions.amountCents}) < 100000 then 'md'
  else 'lg' end`;

/** Busca, sob RLS, tudo que as camadas do classificador precisam para esta descrição. */
export async function loadEvidence(
  tx: Tx,
  ctx: { normalized: string; merchantKey: string | null; excludeTransactionId?: string },
  active: Map<string, ActiveCategory>,
): Promise<Evidence> {
  const resolveSystemKey = (key: string) => {
    for (const c of active.values()) if (c.systemKey === key) return { id: c.id, name: c.name };
    return null;
  };
  const kindOf = (id: string) => active.get(id)?.kind ?? null;
  if (ctx.normalized === '')
    return { rules: [], history: [], neighbors: [], resolveSystemKey, kindOf };

  const confirmed = and(
    eq(transactions.classificationStatus, 'confirmed'),
    isNotNull(transactions.categoryId),
    ctx.excludeTransactionId ? ne(transactions.id, ctx.excludeTransactionId) : undefined,
  );

  // O operador % usa o índice trigram; o limiar vale só nesta transação.
  await tx.execute(
    sql`select set_config('pg_trgm.similarity_threshold', ${String(NEIGHBOR_THRESHOLD)}, true)`,
  );
  const [ruleRows, historyRows, neighborRows] = await Promise.all([
    tx
      .select()
      .from(classificationRules)
      .orderBy(desc(classificationRules.priority), desc(classificationRules.createdAt)),
    tx
      .select({
        categoryId: transactions.categoryId,
        bucket: bucketSql,
        count: sql<number>`count(*)::int`,
      })
      .from(transactions)
      .where(
        and(
          confirmed,
          ctx.merchantKey
            ? eq(transactions.merchantKey, ctx.merchantKey)
            : and(
                isNull(transactions.merchantKey),
                eq(transactions.descriptionNormalized, ctx.normalized),
              ),
        ),
      )
      .groupBy(transactions.categoryId, bucketSql),
    tx
      .select({
        categoryId: transactions.categoryId,
        similarity: sql<number>`similarity(${transactions.descriptionNormalized}, ${ctx.normalized})`,
      })
      .from(transactions)
      .where(
        and(
          confirmed,
          ne(transactions.descriptionNormalized, ''),
          sql`${transactions.descriptionNormalized} % ${ctx.normalized}`,
        ),
      )
      .orderBy(desc(sql`similarity(${transactions.descriptionNormalized}, ${ctx.normalized})`))
      .limit(NEIGHBOR_LIMIT),
  ]);

  const rules: Rule[] = ruleRows
    .filter((r) => active.has(r.categoryId))
    .map((r) => ({
      id: r.id,
      categoryId: r.categoryId,
      categoryName: active.get(r.categoryId)?.name ?? '',
      pattern: r.pattern,
      minAmountCents: r.minAmountCents,
      maxAmountCents: r.maxAmountCents,
      accountId: r.accountId,
      priority: r.priority,
      createdAt: r.createdAt.toISOString(),
    }));
  const history: HistoryRow[] = historyRows
    .filter((r) => r.categoryId && active.has(r.categoryId))
    .map((r) => ({
      categoryId: r.categoryId as string,
      categoryName: active.get(r.categoryId as string)?.name ?? '',
      bucket: r.bucket,
      count: Number(r.count),
    }));
  const neighbors: Neighbor[] = neighborRows
    .filter((r) => r.categoryId && active.has(r.categoryId))
    .map((r) => ({
      categoryId: r.categoryId as string,
      categoryName: active.get(r.categoryId as string)?.name ?? '',
      similarity: Number(r.similarity),
    }));

  return { rules, history, neighbors, resolveSystemKey, kindOf };
}
