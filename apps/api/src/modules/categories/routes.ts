import type { CategoryNode } from '@finlens/contracts';
import { categories, type Db, withTenant } from '@finlens/db';
import { asc, isNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

const byName = (a: CategoryNode, b: CategoryNode) => a.name.localeCompare(b.name, 'pt-BR');

export async function categoryRoutes(app: FastifyInstance, opts: { db: Db }) {
  app.get('/v1/categories', { preHandler: app.requireAuth }, async (request) => {
    const rows = await withTenant(opts.db, request.tenant, (tx) =>
      tx
        .select()
        .from(categories)
        .where(isNull(categories.archivedAt))
        .orderBy(asc(categories.name)),
    );
    const nodes = new Map<string, CategoryNode>(
      rows.map((r) => [
        r.id,
        { id: r.id, name: r.name, kind: r.kind, systemKey: r.systemKey, children: [] },
      ]),
    );
    const roots: CategoryNode[] = [];
    for (const r of rows) {
      const node = nodes.get(r.id) as CategoryNode;
      const parent = r.parentId ? nodes.get(r.parentId) : undefined;
      (parent ? parent.children : roots).push(node);
    }
    for (const n of nodes.values()) n.children.sort(byName);
    return roots.sort(byName);
  });
}
