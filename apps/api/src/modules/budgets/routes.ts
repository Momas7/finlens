import { BudgetSet, MonthQuery, Uuid } from '@finlens/contracts';
import { categories, type Db, type Tx, withTenant } from '@finlens/db';
import { todayInSaoPaulo } from '@finlens/domain';
import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiError, notFound } from '../../http/errors';
import { resolveMonth } from '../analytics/month-param';
import { limitsFor, loadBudgetMonth, saveVersion } from './queries';

function categoryParam(request: FastifyRequest): string {
  const parsed = Uuid.safeParse((request.params as { categoryId?: string }).categoryId);
  if (!parsed.success) throw notFound('Categoria');
  return parsed.data;
}

/** Só categoria principal de despesa ativa aceita orçamento. */
async function assertBudgetable(tx: Tx, categoryId: string) {
  const [category] = await tx
    .select({ parentId: categories.parentId, kind: categories.kind })
    .from(categories)
    .where(and(eq(categories.id, categoryId), isNull(categories.archivedAt)));
  if (!category) throw notFound('Categoria');
  if (category.parentId !== null || category.kind !== 'expense') {
    throw new ApiError(409, 'conflict', 'Orçamento é por categoria principal de despesa.');
  }
}

export async function budgetRoutes(app: FastifyInstance, opts: { db: Db }) {
  const auth = { preHandler: app.requireAuth };

  app.get('/v1/budgets', auth, async (request) => {
    const today = todayInSaoPaulo();
    const month = resolveMonth(MonthQuery.parse(request.query).month, today);
    return withTenant(opts.db, request.tenant, (tx) => loadBudgetMonth(tx, month, today));
  });

  app.put('/v1/budgets/:categoryId', auth, async (request) => {
    const categoryId = categoryParam(request);
    const { amountCents } = BudgetSet.parse(request.body);
    const today = todayInSaoPaulo();
    const month = today.slice(0, 7);
    return withTenant(opts.db, request.tenant, async (tx) => {
      await assertBudgetable(tx, categoryId);
      await saveVersion(tx, request.tenant.workspaceId, categoryId, month, BigInt(amountCents));
      const body = await loadBudgetMonth(tx, month, today);
      return body.items.find((i) => i.categoryId === categoryId);
    });
  });

  app.delete('/v1/budgets/:categoryId', auth, async (request, reply) => {
    const categoryId = categoryParam(request);
    const month = todayInSaoPaulo().slice(0, 7);
    await withTenant(opts.db, request.tenant, async (tx) => {
      await assertBudgetable(tx, categoryId);
      if (!(await limitsFor(tx, month)).has(categoryId)) throw notFound('Orçamento');
      await saveVersion(tx, request.tenant.workspaceId, categoryId, month, null);
    });
    return reply.status(204).send();
  });

  app.post('/v1/budgets/apply-suggestions', auth, async (request) => {
    const today = todayInSaoPaulo();
    const month = today.slice(0, 7);
    return withTenant(opts.db, request.tenant, async (tx) => {
      const body = await loadBudgetMonth(tx, month, today);
      const pending = body.items.filter((i) => i.limitCents === null && i.suggestion);
      for (const item of pending) {
        await saveVersion(
          tx,
          request.tenant.workspaceId,
          item.categoryId,
          month,
          BigInt(item.suggestion?.amountCents as string),
        );
      }
      return { created: pending.length };
    });
  });
}
