import type { MeResponse } from '@finlens/contracts';
import { type Db, withTenant, workspaces } from '@finlens/db';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

export async function meRoutes(app: FastifyInstance, opts: { db: Db }) {
  app.get('/v1/me', { preHandler: app.requireAuth }, async (request): Promise<MeResponse> => {
    const { userId, workspaceId } = request.tenant;
    const [workspace] = await withTenant(opts.db, { userId, workspaceId }, (tx) =>
      tx
        .select({ id: workspaces.id, name: workspaces.name })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId)),
    );
    if (!workspace) throw new Error('Workspace do tenant não encontrado');
    return { user: request.sessionUser, workspace };
  });
}
