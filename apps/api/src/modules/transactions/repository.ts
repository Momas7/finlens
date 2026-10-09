import type { Transaction, TransactionQuery } from '@finlens/contracts';
import { categories, type Tx, transactions } from '@finlens/db';
import { and, desc, eq, gte, ilike, inArray, isNull, lte, or, type SQL, sql } from 'drizzle-orm';
import { ApiError } from '../../http/errors';
import { decodeCursor, encodeCursor } from './cursor';

export const PAGE_SIZE = 50;

type Row = typeof transactions.$inferSelect;

export function toTransactionDto(row: Row): Transaction {
  return {
    id: row.id,
    accountId: row.accountId,
    categoryId: row.categoryId,
    postedDate: row.postedDate,
    statementMonth: row.statementMonth,
    amountCents: row.amountCents.toString(),
    description: row.description,
    notes: row.notes,
    source: row.source,
    classificationStatus: row.classificationStatus,
    classificationSource: row.classificationSource,
    classificationConfidence:
      row.classificationConfidence === null ? null : Number(row.classificationConfidence),
    classificationExplanation: row.classificationExplanation,
    suggestedCategoryId: row.suggestedCategoryId,
    merchantKey: row.merchantKey,
  };
}

/** Escapa curingas do LIKE para a busca ser literal. */
export const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listTransactions(tx: Tx, query: TransactionQuery) {
  const filters: (SQL | undefined)[] = [
    query.accountId ? eq(transactions.accountId, query.accountId) : undefined,
    // Categoria raiz inclui as filhas.
    query.categoryId
      ? inArray(
          transactions.categoryId,
          tx
            .select({ id: categories.id })
            .from(categories)
            .where(
              or(eq(categories.id, query.categoryId), eq(categories.parentId, query.categoryId)),
            ),
        )
      : undefined,
    query.from ? gte(transactions.postedDate, query.from) : undefined,
    query.to ? lte(transactions.postedDate, query.to) : undefined,
    query.q ? ilike(transactions.description, `%${escapeLike(query.q)}%`) : undefined,
  ];
  if (query.cursor) {
    const cursor = decodeCursor(query.cursor);
    if (!cursor)
      throw new ApiError(400, 'validation', 'Cursor inválido.', { cursor: 'Cursor inválido.' });
    filters.push(
      or(
        sql`${transactions.postedDate} < ${cursor.postedDate}`,
        and(eq(transactions.postedDate, cursor.postedDate), sql`${transactions.id} < ${cursor.id}`),
      ),
    );
  }
  const rows = await tx
    .select()
    .from(transactions)
    .where(and(...filters))
    .orderBy(desc(transactions.postedDate), desc(transactions.id))
    .limit(PAGE_SIZE + 1);
  const page = rows.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  return {
    items: page.map(toTransactionDto),
    nextCursor: rows.length > PAGE_SIZE && last ? encodeCursor(last.postedDate, last.id) : null,
  };
}

export async function findTransaction(tx: Tx, id: string): Promise<Row | undefined> {
  const [row] = await tx.select().from(transactions).where(eq(transactions.id, id));
  return row;
}

export async function categoryExists(tx: Tx, id: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, id), isNull(categories.archivedAt)));
  return Boolean(row);
}
