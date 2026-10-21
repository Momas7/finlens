import { ImportPreviewRequest, Uuid } from '@finlens/contracts';
import type { Db } from '@finlens/db';
import type { FastifyInstance } from 'fastify';
import { notFound } from '../../http/errors';
import { recordAudit } from '../audit/record';
import { commitImport, previewImport } from './service';

const BODY_LIMIT = 6 * 1024 * 1024;

export async function importRoutes(app: FastifyInstance, opts: { db: Db }) {
  app.post(
    '/v1/imports/preview',
    { preHandler: app.requireAuth, bodyLimit: BODY_LIMIT },
    async (request) => {
      const input = ImportPreviewRequest.parse(request.body);
      return previewImport(
        opts.db,
        { ...request.tenant, workspaceId: request.tenant.workspaceId },
        input,
      );
    },
  );

  app.post('/v1/imports/:id/commit', { preHandler: app.requireAuth }, async (request) => {
    const id = Uuid.safeParse((request.params as { id?: string }).id);
    if (!id.success) throw notFound('Importação');
    const result = await commitImport(opts.db, request.tenant, id.data);
    await recordAudit(opts.db, request.log, {
      userId: request.tenant.userId,
      event: 'import_committed',
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      meta: { imported: result.imported },
    });
    return result;
  });
}
