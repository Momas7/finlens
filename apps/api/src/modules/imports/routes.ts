import { ImportPreviewRequest, Uuid } from '@finlens/contracts';
import type { Db } from '@finlens/db';
import type { FastifyInstance } from 'fastify';
import { notFound } from '../../http/errors';
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
    return commitImport(opts.db, request.tenant, id.data);
  });
}
