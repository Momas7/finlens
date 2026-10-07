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

  const active = await activeCategories(tx);
  const category = active.get(categoryId);
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

  // Prevê tudo antes de gravar: o feedback guarda o que o motor diria antes do lote, sem que
  // as primeiras linhas confirmadas virem histórico das seguintes.
  const pending = rows.filter(
    (r) => !(r.classificationStatus === 'confirmed' && r.categoryId === categoryId),
  );
  const decided = [];
  for (const row of pending) {
    decided.push({
      id: row.id,
      ...(await categorize(
        tx,
        { chosen: categoryId },
        {
          description: row.description,
          amountCents: row.amountCents,
          accountId: row.accountId,
          transactionId: row.id,
        },
        active,
      )),
    });
  }
  for (const { id, fields, feedback } of decided) {
    await tx.update(transactions).set(fields).where(eq(transactions.id, id));
    await recordFeedback(tx, workspaceId, id, feedback);
  }
  const confirmed = decided.length;
  return confirmed;
}
