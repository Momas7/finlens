import { DEFAULT_CATEGORIES } from '@finlens/domain';
import type { Tx } from './client';
import { categories } from './schema';

/** Cria a taxonomia padrão no workspace. Chamar dentro de withTenant com o workspace no contexto. */
export async function seedDefaultCategories(tx: Tx, workspaceId: string): Promise<void> {
  const roots = DEFAULT_CATEGORIES.filter((c) => !c.parentKey);
  const inserted = await tx
    .insert(categories)
    .values(roots.map((c) => ({ workspaceId, name: c.name, kind: c.kind, systemKey: c.key })))
    .onConflictDoNothing()
    .returning({ id: categories.id, systemKey: categories.systemKey });
  const parentIds = new Map(inserted.map((r) => [r.systemKey, r.id]));

  const children = DEFAULT_CATEGORIES.filter((c) => c.parentKey && parentIds.has(c.parentKey));
  if (children.length === 0) return;
  await tx
    .insert(categories)
    .values(
      children.map((c) => ({
        workspaceId,
        parentId: parentIds.get(c.parentKey as string),
        name: c.name,
        kind: c.kind,
        systemKey: c.key,
      })),
    )
    .onConflictDoNothing();
}
