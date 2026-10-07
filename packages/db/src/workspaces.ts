import { and, eq, sql } from 'drizzle-orm';
import { seedDefaultCategories } from './categories';
import type { Db } from './client';
import { workspaceMembers, workspaces } from './schema';
import { withTenant } from './tenant';

const PERSONAL_WORKSPACE_NAME = 'Pessoal';

/**
 * Garante que o usuário tenha um workspace pessoal e seja `owner` dele.
 * Idempotente e seguro sob concorrência: `personal_owner_id` é único e os inserts
 * usam ON CONFLICT DO NOTHING.
 */
export async function ensurePersonalWorkspace(
  db: Db,
  userId: string,
): Promise<{ id: string; name: string }> {
  return withTenant(db, { userId }, async (tx) => {
    const created = await tx
      .insert(workspaces)
      .values({ name: PERSONAL_WORKSPACE_NAME, personalOwnerId: userId })
      .onConflictDoNothing({ target: workspaces.personalOwnerId })
      .returning({ id: workspaces.id });

    const [workspace] = await tx
      .select({ id: workspaces.id, name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.personalOwnerId, userId));
    if (!workspace) throw new Error('Workspace pessoal não encontrado após criação');

    await tx
      .insert(workspaceMembers)
      .values({ workspaceId: workspace.id, userId, role: 'owner' })
      .onConflictDoNothing();

    // Só quem criou o workspace semeia as categorias: chamadas concorrentes não duplicam.
    if (created.length > 0) {
      await tx.execute(sql`select set_config('app.workspace_id', ${workspace.id}, true)`);
      await seedDefaultCategories(tx, workspace.id);
    }

    return workspace;
  });
}

/**
 * Workspace pessoal do usuário, se já existir e ele for membro. Só leitura: usado em toda
 * requisição autenticada antes de recorrer a ensurePersonalWorkspace.
 */
export async function findPersonalWorkspace(
  db: Db,
  userId: string,
): Promise<{ id: string; name: string } | undefined> {
  return withTenant(db, { userId }, async (tx) => {
    const [row] = await tx
      .select({ id: workspaces.id, name: workspaces.name })
      .from(workspaces)
      .innerJoin(
        workspaceMembers,
        and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, userId)),
      )
      .where(eq(workspaces.personalOwnerId, userId));
    return row;
  });
}
