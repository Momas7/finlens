import type { MeResponse } from '@finlens/contracts';
import { type Db, withTenant, workspaces } from '@finlens/db';
import { todayInSaoPaulo } from '@finlens/domain';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Config } from '../../config';
import { deleteAccount } from './delete';
import { exportCsv, exportData } from './export';

export async function meRoutes(app: FastifyInstance, opts: { db: Db; config: Config }) {
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

  app.get('/v1/me/export', { preHandler: app.requireAuth }, async (request, reply) => {
    const data = await withTenant(opts.db, request.tenant, async (tx) => {
      const [workspace] = await tx
        .select({ name: workspaces.name })
        .from(workspaces)
        .where(eq(workspaces.id, request.tenant.workspaceId));
      return exportData(tx, request.sessionUser, workspace?.name ?? '');
    });
    return reply
      .header('content-disposition', `attachment; filename="finlens-${todayInSaoPaulo()}.json"`)
      .send(data);
  });

  app.get('/v1/me/export.csv', { preHandler: app.requireAuth }, async (request, reply) => {
    const csv = await withTenant(opts.db, request.tenant, (tx) => exportCsv(tx));
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header(
        'content-disposition',
        `attachment; filename="finlens-lancamentos-${todayInSaoPaulo()}.csv"`,
      )
      .send(csv);
  });

  app.post(
    '/v1/me/delete',
    {
      preHandler: app.requireAuth,
      // Mesmo limite do login: a rota confere senha.
      config: { rateLimit: { max: opts.config.authRateLimitPerMinute, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      await deleteAccount(opts.db, request.tenant.userId, request.body);
      request.log.info({ userId: request.tenant.userId }, 'conta excluída');
      return reply.status(204).send();
    },
  );
}
