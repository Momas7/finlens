import { TransactionCreate, TransactionQuery, TransactionUpdate, Uuid } from '@finlens/contracts';
import { type Db, type Tx, transactions, withTenant } from '@finlens/db';
import { statementMonth } from '@finlens/domain';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiError, notFound } from '../../http/errors';
import { findAccount } from '../accounts/repository';
import { categoryExists, findTransaction, listTransactions, toTransactionDto } from './repository';

function transactionId(request: FastifyRequest): string {
  const parsed = Uuid.safeParse((request.params as { id?: string }).id);
  if (!parsed.success) throw notFound('Lançamento');
  return parsed.data;
}

/** Confere conta e categoria no workspace (RLS) e devolve o mês da fatura, se for cartão. */
async function resolveRefs(
  tx: Tx,
  accountId: string,
  categoryId: string | null | undefined,
  postedDate: string,
  currentAccountId?: string,
): Promise<string | null> {
  const account = await findAccount(tx, accountId);
  if (!account) throw notFound('Conta');
  // Conta arquivada não recebe lançamentos novos, mas os antigos continuam editáveis nela.
  if (account.archivedAt && accountId !== currentAccountId) {
    throw new ApiError(409, 'conflict', 'Esta conta está arquivada e não aceita lançamentos.', {
      accountId: 'Conta arquivada.',
    });
  }
  if (categoryId && !(await categoryExists(tx, categoryId))) throw notFound('Categoria');
  return account.type === 'credit_card'
    ? statementMonth(postedDate, account.closingDay ?? 31)
    : null;
}

export async function transactionRoutes(app: FastifyInstance, opts: { db: Db }) {
  const auth = { preHandler: app.requireAuth };

  app.get('/v1/transactions', auth, async (request) => {
    const query = TransactionQuery.parse(request.query);
    return withTenant(opts.db, request.tenant, (tx) => listTransactions(tx, query));
  });

  app.get('/v1/transactions/:id', auth, async (request) => {
    const id = transactionId(request);
    const row = await withTenant(opts.db, request.tenant, (tx) => findTransaction(tx, id));
    if (!row) throw notFound('Lançamento');
    return toTransactionDto(row);
  });

  app.post('/v1/transactions', auth, async (request, reply) => {
    const input = TransactionCreate.parse(request.body);
    const created = await withTenant(opts.db, request.tenant, async (tx) => {
      const month = await resolveRefs(tx, input.accountId, input.categoryId, input.postedDate);
      const [row] = await tx
        .insert(transactions)
        .values({
          workspaceId: request.tenant.workspaceId,
          accountId: input.accountId,
          categoryId: input.categoryId ?? null,
          postedDate: input.postedDate,
          statementMonth: month,
          amountCents: BigInt(input.amountCents),
          description: input.description,
          notes: input.notes ?? null,
          source: 'manual',
        })
        .returning();
      return row;
    });
    return reply.status(201).send(created && toTransactionDto(created));
  });

  app.patch('/v1/transactions/:id', auth, async (request) => {
    const id = transactionId(request);
    const input = TransactionUpdate.parse(request.body);
    return withTenant(opts.db, request.tenant, async (tx) => {
      const current = await findTransaction(tx, id);
      if (!current) throw notFound('Lançamento');
      const accountId = input.accountId ?? current.accountId;
      const postedDate = input.postedDate ?? current.postedDate;
      const categoryId = input.categoryId === undefined ? current.categoryId : input.categoryId;
      const month = await resolveRefs(tx, accountId, categoryId, postedDate, current.accountId);
      const [row] = await tx
        .update(transactions)
        .set({
          accountId,
          postedDate,
          categoryId,
          statementMonth: month,
          ...(input.amountCents !== undefined && { amountCents: BigInt(input.amountCents) }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.notes !== undefined && { notes: input.notes }),
        })
        .where(eq(transactions.id, id))
        .returning();
      if (!row) throw notFound('Lançamento');
      return toTransactionDto(row);
    });
  });

  app.delete('/v1/transactions/:id', auth, async (request, reply) => {
    const id = transactionId(request);
    await withTenant(opts.db, request.tenant, async (tx) => {
      const deleted = await tx
        .delete(transactions)
        .where(eq(transactions.id, id))
        .returning({ id: transactions.id });
      if (deleted.length === 0) throw notFound('Lançamento');
    });
    return reply.status(204).send();
  });
}
