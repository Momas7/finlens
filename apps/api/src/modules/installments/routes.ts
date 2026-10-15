import { type Db, withTenant } from '@finlens/db';
import { todayInSaoPaulo } from '@finlens/domain';
import type { FastifyInstance } from 'fastify';
import { loadInstallments } from './queries';

export async function installmentRoutes(app: FastifyInstance, opts: { db: Db }) {
  app.get('/v1/installments', { preHandler: app.requireAuth }, async (request) =>
    withTenant(opts.db, request.tenant, (tx) => loadInstallments(tx, todayInSaoPaulo())),
  );
}
