import {
  ConfirmBatch,
  TransactionCreate,
  TransactionQuery,
  TransactionUpdate,
  Uuid,
} from '@finlens/contracts';
import { type Db, type Tx, transactions, withTenant } from '@finlens/db';
import { statementMonth } from '@finlens/domain';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiError, notFound } from '../../http/errors';
import { findAccount } from '../accounts/repository';
import { type CategoryDecision, categorize, recordFeedback } from './categorize';
import { confirmTransactions } from './confirm';
import { categoryExists, findTransaction, listTransactions, toTransactionDto } from './repository';
import { findSimilar } from './similar';

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
  const account = await findAccount(tx, accountId, true);
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

  app.post('/v1/transactions/confirm', auth, async (request) => {
    const input = ConfirmBatch.parse(request.body);
    const confirmed = await withTenant(opts.db, request.tenant, (tx) =>
      confirmTransactions(tx, request.tenant.workspaceId, input.ids, input.categoryId),
    );
    return { confirmed };
  });

  app.get('/v1/transactions/:id/similar', auth, async (request) => {
    const id = transactionId(request);
    const categoryId = Uuid.parse((request.query as { categoryId?: string }).categoryId);
    return withTenant(opts.db, request.tenant, async (tx) => {
      const ref = await findTransaction(tx, id);
      if (!ref) throw notFound('Lançamento');
      return findSimilar(tx, ref, categoryId);
    });
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
      const chosen = input.categoryId === 'auto' ? undefined : input.categoryId;
      const month = await resolveRefs(tx, input.accountId, chosen, input.postedDate);
      const decision: CategoryDecision =
        input.categoryId === 'auto'
          ? 'auto'
          : input.categoryId === null
            ? null
            : { chosen: input.categoryId };
      const amountCents = BigInt(input.amountCents);
      const { fields, feedback } = await categorize(tx, decision, {
        description: input.description,
        amountCents,
        accountId: input.accountId,
      });
      const [row] = await tx
        .insert(transactions)
        .values({
          workspaceId: request.tenant.workspaceId,
          accountId: input.accountId,
          postedDate: input.postedDate,
          statementMonth: month,
          amountCents,
          description: input.description,
          notes: input.notes ?? null,
          source: 'manual',
          ...fields,
        })
        .returning();
      if (row) await recordFeedback(tx, request.tenant.workspaceId, row.id, feedback);
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
      const description = input.description ?? current.description;
      const amountCents =
        input.amountCents !== undefined ? BigInt(input.amountCents) : current.amountCents;
      const chosen =
        typeof input.categoryId === 'string' && input.categoryId !== 'auto'
          ? input.categoryId
          : undefined;
      const month = await resolveRefs(tx, accountId, chosen, postedDate, current.accountId);

      const inputsChanged =
        description !== current.description ||
        amountCents !== current.amountCents ||
        accountId !== current.accountId;
      let decision: CategoryDecision;
      if (input.categoryId === 'auto' || input.categoryId === null) decision = input.categoryId;
      else if (chosen) {
        // Reenviar a mesma categoria já confirmada não gera feedback repetido.
        decision =
          chosen === current.categoryId && current.classificationStatus === 'confirmed'
            ? 'keep'
            : { chosen };
      } else if (current.classificationStatus === 'confirmed' || !inputsChanged) decision = 'keep';
      else decision = 'auto';

      const { fields, feedback } = await categorize(tx, decision, {
        description,
        amountCents,
        accountId,
        transactionId: id,
      });
      const [row] = await tx
        .update(transactions)
        .set({
          accountId,
          postedDate,
          description,
          amountCents,
          statementMonth: month,
          ...(input.notes !== undefined && { notes: input.notes }),
          ...fields,
        })
        .where(eq(transactions.id, id))
        .returning();
      if (!row) throw notFound('Lançamento');
      await recordFeedback(tx, request.tenant.workspaceId, id, feedback);
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
