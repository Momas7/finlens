import { GoalCreate, GoalUpdate, Uuid } from '@finlens/contracts';
import { type Db, financialAccounts, goals, type Tx, withTenant } from '@finlens/db';
import { todayInSaoPaulo } from '@finlens/domain';
import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiError, notFound } from '../../http/errors';
import { bpFromPercent, loadGoals } from './queries';

const ALREADY = 'Esta conta já tem uma meta.';

function goalId(request: FastifyRequest): string {
  const parsed = Uuid.safeParse((request.params as { id?: string }).id);
  if (!parsed.success) throw notFound('Meta');
  return parsed.data;
}

function assertFutureDate(date: string | null | undefined, today: string) {
  if (date && date < today) {
    throw new ApiError(400, 'validation', 'Verifique os campos.', {
      targetDate: 'Escolha uma data a partir de hoje.',
    });
  }
}

const isUniqueViolation = (err: unknown) => {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === '23505' || e?.cause?.code === '23505';
};

async function findGoal(tx: Tx, today: string, id: string) {
  const found = (await loadGoals(tx, today, true)).find((g) => g.id === id);
  if (!found) throw notFound('Meta');
  return found;
}

export async function goalRoutes(app: FastifyInstance, opts: { db: Db }) {
  const auth = { preHandler: app.requireAuth };

  app.get('/v1/goals', auth, async (request) => {
    const archived = (request.query as { archived?: string }).archived === 'true';
    return withTenant(opts.db, request.tenant, (tx) => loadGoals(tx, todayInSaoPaulo(), archived));
  });

  app.post('/v1/goals', auth, async (request, reply) => {
    const input = GoalCreate.parse(request.body);
    const today = todayInSaoPaulo();
    assertFutureDate(input.targetDate, today);
    const created = await withTenant(opts.db, request.tenant, async (tx) => {
      const [account] = await tx
        .select({ type: financialAccounts.type })
        .from(financialAccounts)
        .where(eq(financialAccounts.id, input.accountId));
      if (!account) throw notFound('Conta');
      if (account.type === 'credit_card') {
        throw new ApiError(409, 'conflict', 'Escolha uma conta corrente, poupança ou dinheiro.');
      }
      const [active] = await tx
        .select({ id: goals.id })
        .from(goals)
        .where(and(eq(goals.accountId, input.accountId), isNull(goals.archivedAt)));
      if (active) throw new ApiError(409, 'conflict', ALREADY);
      try {
        const [row] = await tx
          .insert(goals)
          .values({
            workspaceId: request.tenant.workspaceId,
            accountId: input.accountId,
            name: input.name,
            targetCents: BigInt(input.targetCents),
            targetDate: input.targetDate ?? null,
            annualRateBp: input.annualRatePercent ? bpFromPercent(input.annualRatePercent) : null,
          })
          .returning({ id: goals.id });
        return findGoal(tx, today, row?.id as string);
      } catch (err) {
        if (isUniqueViolation(err)) throw new ApiError(409, 'conflict', ALREADY);
        throw err;
      }
    });
    return reply.status(201).send(created);
  });

  app.patch('/v1/goals/:id', auth, async (request) => {
    const id = goalId(request);
    const input = GoalUpdate.parse(request.body);
    const today = todayInSaoPaulo();
    return withTenant(opts.db, request.tenant, async (tx) => {
      // Só valida a data quando ela muda: editar o nome de uma meta vencida não pode falhar.
      const [stored] = await tx
        .select({ targetDate: goals.targetDate })
        .from(goals)
        .where(and(eq(goals.id, id), isNull(goals.archivedAt)));
      if (!stored) throw notFound('Meta');
      if (input.targetDate !== stored.targetDate) assertFutureDate(input.targetDate, today);
      const updated = await tx
        .update(goals)
        .set({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.targetCents !== undefined && { targetCents: BigInt(input.targetCents) }),
          ...(input.targetDate !== undefined && { targetDate: input.targetDate }),
          ...(input.annualRatePercent !== undefined && {
            annualRateBp:
              input.annualRatePercent === null ? null : bpFromPercent(input.annualRatePercent),
          }),
        })
        .where(and(eq(goals.id, id), isNull(goals.archivedAt)))
        .returning({ id: goals.id });
      if (updated.length === 0) throw notFound('Meta');
      return findGoal(tx, today, id);
    });
  });

  app.delete('/v1/goals/:id', auth, async (request, reply) => {
    const id = goalId(request);
    await withTenant(opts.db, request.tenant, async (tx) => {
      const archived = await tx
        .update(goals)
        .set({ archivedAt: new Date() })
        .where(and(eq(goals.id, id), isNull(goals.archivedAt)))
        .returning({ id: goals.id });
      if (archived.length === 0) throw notFound('Meta');
    });
    return reply.status(204).send();
  });
}
