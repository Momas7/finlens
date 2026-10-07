import { type Tx, transactions } from '@finlens/db';
import { eq, inArray } from 'drizzle-orm';
import { ApiError, notFound } from '../../http/errors';
import { activeCategories } from '../classification/evidence';
import { categorize, recordFeedback } from './categorize';

/**
 * Confirma vários lançamentos numa categoria, de forma atômica: ids de fora do workspace (404)
 * ou categoria incompatível com algum sinal (409) não alteram nada. Já confirmados na mesma
 * categoria são ignorados.
 */
export async function confirmTransactions(
  tx: Tx,
  workspaceId: string,
  rawIds: string[],
  categoryId: string,
) {
  const ids = [...new Set(rawIds)];
  const rows = await tx.select().from(transactions).where(inArray(transactions.id, ids));
  if (rows.length !== ids.length) throw notFound('Lançamento');

  const category = (await activeCategories(tx)).get(categoryId);
  if (!category) throw notFound('Categoria');
  const incompatible = rows.some(
    (r) =>
      category.kind !== 'movement' && category.kind !== (r.amountCents < 0n ? 'expense' : 'income'),
  );
  if (incompatible) {
    throw new ApiError(409, 'conflict', 'A categoria não combina com o tipo de algum lançamento.', {
      categoryId: 'Use uma categoria de despesa para saídas e de receita para entradas.',
    });
  }

  let confirmed = 0;
  for (const row of rows) {
    if (row.classificationStatus === 'confirmed' && row.categoryId === categoryId) continue;
    const { fields, feedback } = await categorize(
      tx,
      { chosen: categoryId },
      {
        description: row.description,
        amountCents: row.amountCents,
        accountId: row.accountId,
        transactionId: row.id,
      },
    );
    await tx.update(transactions).set(fields).where(eq(transactions.id, row.id));
    await recordFeedback(tx, workspaceId, row.id, feedback);
    confirmed++;
  }
  return confirmed;
}
