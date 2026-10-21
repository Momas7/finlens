import type { ActivityList, MeResponse } from '@finlens/contracts';
import { auditLogs, type Db, withTenant, workspaces } from '@finlens/db';
import { todayInSaoPaulo } from '@finlens/domain';
import { desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Config } from '../../config';
import { recordAudit } from '../audit/record';
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

  app.get(
    '/v1/me/activity',
    { preHandler: app.requireAuth },
    async (request): Promise<ActivityList> => {
      const rows = await withTenant(opts.db, request.tenant, (tx) =>
        tx.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(20),
      );
      return rows.map((r) => ({
        id: r.id,
        event: r.event as ActivityList[number]['event'],
        ip: r.ip,
        createdAt: r.createdAt.toISOString(),
        meta: r.meta,
      }));
    },
  );

  app.get('/v1/me/export', { preHandler: app.requireAuth }, async (request, reply) => {
    const data = await withTenant(opts.db, request.tenant, async (tx) => {
      const [workspace] = await tx
        .select({ name: workspaces.name })
        .from(workspaces)
        .where(eq(workspaces.id, request.tenant.workspaceId));
      return exportData(tx, request.sessionUser, workspace?.name ?? '');
    });
    await recordAudit(opts.db, request.log, {
      userId: request.tenant.userId,
      event: 'data_exported',
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      meta: { format: 'json' },
    });
    return reply
      .header('content-disposition', `attachment; filename="finlens-${todayInSaoPaulo()}.json"`)
      .send(data);
  });

  app.get('/v1/me/export.csv', { preHandler: app.requireAuth }, async (request, reply) => {
    const csv = await withTenant(opts.db, request.tenant, (tx) => exportCsv(tx));
    await recordAudit(opts.db, request.log, {
      userId: request.tenant.userId,
      event: 'data_exported',
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      meta: { format: 'csv' },
    });
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
