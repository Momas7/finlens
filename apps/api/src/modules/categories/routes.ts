import { CategoryCreate, type CategoryNode, CategoryUpdate, Uuid } from '@finlens/contracts';
import { categories, type Db, type Tx, withTenant } from '@finlens/db';
import { and, asc, eq, isNull, ne, or, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiError, notFound } from '../../http/errors';

const byName = (a: CategoryNode, b: CategoryNode) => a.name.localeCompare(b.name, 'pt-BR');

function categoryId(request: FastifyRequest): string {
  const parsed = Uuid.safeParse((request.params as { id?: string }).id);
  if (!parsed.success) throw notFound('Categoria');
  return parsed.data;
}

async function findActive(tx: Tx, id: string) {
  const [row] = await tx
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), isNull(categories.archivedAt)));
  return row;
}

/** Nome único entre irmãs ativas (o índice único também garante; aqui vira mensagem no campo). */
async function assertUniqueName(tx: Tx, name: string, parentId: string | null, exceptId?: string) {
  const [clash] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        isNull(categories.archivedAt),
        parentId ? eq(categories.parentId, parentId) : isNull(categories.parentId),
        sql`lower(${categories.name}) = lower(${name})`,
        exceptId ? ne(categories.id, exceptId) : undefined,
      ),
    );
  if (clash) {
    throw new ApiError(409, 'conflict', 'Já existe uma categoria com esse nome aqui.', {
      name: 'Já existe uma categoria com esse nome aqui.',
    });
  }
}

const toNode = (row: typeof categories.$inferSelect): CategoryNode => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  systemKey: row.systemKey,
  children: [],
});

export async function categoryRoutes(app: FastifyInstance, opts: { db: Db }) {
  const auth = { preHandler: app.requireAuth };

  app.get('/v1/categories', auth, async (request) => {
    const rows = await withTenant(opts.db, request.tenant, (tx) =>
      tx
        .select()
        .from(categories)
        .where(isNull(categories.archivedAt))
        .orderBy(asc(categories.name)),
    );
    const nodes = new Map<string, CategoryNode>(rows.map((r) => [r.id, toNode(r)]));
    const roots: CategoryNode[] = [];
    for (const r of rows) {
      const node = nodes.get(r.id) as CategoryNode;
      if (!r.parentId) roots.push(node);
      else nodes.get(r.parentId)?.children.push(node);
    }
    for (const n of nodes.values()) n.children.sort(byName);
    return roots.sort(byName);
  });

  app.post('/v1/categories', auth, async (request, reply) => {
    const input = CategoryCreate.parse(request.body);
    const created = await withTenant(opts.db, request.tenant, async (tx) => {
      let kind: 'expense' | 'income' | 'movement' = 'expense';
      if (input.parentId) {
        const [parent] = await tx
          .select()
          .from(categories)
          .where(eq(categories.id, input.parentId));
        if (!parent) throw notFound('Categoria');
        if (parent.archivedAt) {
          throw new ApiError(409, 'conflict', 'A categoria mãe está arquivada.', {
            parentId: 'Categoria arquivada.',
          });
        }
        if (parent.parentId) {
          throw new ApiError(409, 'conflict', 'Use no máximo dois níveis de categoria.', {
            parentId: 'Subcategorias não podem ter filhas.',
          });
        }
        kind = parent.kind;
      }
      await assertUniqueName(tx, input.name, input.parentId ?? null);
      const [row] = await tx
        .insert(categories)
        .values({
          workspaceId: request.tenant.workspaceId,
          name: input.name,
          parentId: input.parentId ?? null,
          kind,
        })
        .returning();
      return row;
    });
    return reply.status(201).send(created && toNode(created));
  });

  app.patch('/v1/categories/:id', auth, async (request) => {
    const id = categoryId(request);
    const input = CategoryUpdate.parse(request.body);
    return withTenant(opts.db, request.tenant, async (tx) => {
      const current = await findActive(tx, id);
      if (!current) throw notFound('Categoria');
      await assertUniqueName(tx, input.name, current.parentId, id);
      const [row] = await tx
        .update(categories)
        .set({ name: input.name })
        .where(eq(categories.id, id))
        .returning();
      return row && toNode(row);
    });
  });

  app.delete('/v1/categories/:id', auth, async (request, reply) => {
    const id = categoryId(request);
    await withTenant(opts.db, request.tenant, async (tx) => {
      if (!(await findActive(tx, id))) throw notFound('Categoria');
      // Arquiva junto as filhas; lançamentos antigos mantêm a referência.
      await tx
        .update(categories)
        .set({ archivedAt: new Date() })
        .where(
          and(
            isNull(categories.archivedAt),
            or(eq(categories.id, id), eq(categories.parentId, id)),
          ),
        );
    });
    return reply.status(204).send();
  });
}
