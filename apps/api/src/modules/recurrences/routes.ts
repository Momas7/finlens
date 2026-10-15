import { type Db, withTenant } from '@finlens/db';
import { todayInSaoPaulo } from '@finlens/domain';
import type { FastifyInstance } from 'fastify';
import { loadRecurrences } from './queries';

export async function recurrenceRoutes(app: FastifyInstance, opts: { db: Db }) {
  app.get('/v1/recurrences', { preHandler: app.requireAuth }, async (request) =>
    withTenant(opts.db, request.tenant, (tx) => loadRecurrences(tx, todayInSaoPaulo())),
  );
}
