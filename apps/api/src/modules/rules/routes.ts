import { type ClassificationRule, ClassificationRuleCreate, Uuid } from '@finlens/contracts';
import { classificationRules, type Db, type Tx, withTenant } from '@finlens/db';
import { normalize } from '@finlens/domain';
import { desc, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiError, notFound } from '../../http/errors';
import { findAccount } from '../accounts/repository';
import { type ActiveCategory, activeCategories } from '../classification/evidence';

function ruleId(request: FastifyRequest): string {
  const parsed = Uuid.safeParse((request.params as { id?: string }).id);
  if (!parsed.success) throw notFound('Regra');
  return parsed.data;
}

const toDto = (
  row: typeof classificationRules.$inferSelect,
  active: Map<string, ActiveCategory>,
): ClassificationRule => ({
  id: row.id,
  categoryId: row.categoryId,
  categoryLabel: active.get(row.categoryId)?.label ?? 'Categoria arquivada',
  pattern: row.pattern,
  minAmountCents: row.minAmountCents?.toString() ?? null,
  maxAmountCents: row.maxAmountCents?.toString() ?? null,
  accountId: row.accountId,
  createdAt: row.createdAt.toISOString(),
});

async function listRules(tx: Tx) {
  const [rows, active] = await Promise.all([
    tx.select().from(classificationRules).orderBy(desc(classificationRules.createdAt)),
    activeCategories(tx),
  ]);
  return rows.map((r) => toDto(r, active));
}

export async function ruleRoutes(app: FastifyInstance, opts: { db: Db }) {
  const auth = { preHandler: app.requireAuth };

  app.get('/v1/classification-rules', auth, async (request) =>
    withTenant(opts.db, request.tenant, (tx) => listRules(tx)),
  );

  app.post('/v1/classification-rules', auth, async (request, reply) => {
    const input = ClassificationRuleCreate.parse(request.body);
    const pattern = normalize(input.pattern).normalized;
    if (pattern.length < 2 || pattern.length > 100) {
      throw new ApiError(400, 'validation', 'Verifique os campos.', {
        pattern: 'Use um texto com letras ou números, como PADARIA SAO JOAO.',
      });
    }
    const created = await withTenant(opts.db, request.tenant, async (tx) => {
      const active = await activeCategories(tx);
      if (!active.has(input.categoryId)) throw notFound('Categoria');
      if (input.accountId && !(await findAccount(tx, input.accountId))) throw notFound('Conta');
      const [row] = await tx
        .insert(classificationRules)
        .values({
          workspaceId: request.tenant.workspaceId,
          categoryId: input.categoryId,
          pattern,
          minAmountCents: input.minAmountCents ? BigInt(input.minAmountCents) : null,
          maxAmountCents: input.maxAmountCents ? BigInt(input.maxAmountCents) : null,
          accountId: input.accountId ?? null,
        })
        .returning();
      return row && toDto(row, active);
    });
    return reply.status(201).send(created);
  });

  app.delete('/v1/classification-rules/:id', auth, async (request, reply) => {
    const id = ruleId(request);
    await withTenant(opts.db, request.tenant, async (tx) => {
      const deleted = await tx
        .delete(classificationRules)
        .where(eq(classificationRules.id, id))
        .returning({ id: classificationRules.id });
      if (deleted.length === 0) throw notFound('Regra');
    });
    return reply.status(204).send();
  });
}
