import { type Db, withTenant } from '@finlens/db';
import type { FastifyInstance } from 'fastify';
import { loadReview } from './queries';

export async function reviewRoutes(app: FastifyInstance, opts: { db: Db }) {
  app.get('/v1/review', { preHandler: app.requireAuth }, async (request) =>
    withTenant(opts.db, request.tenant, (tx) => loadReview(tx)),
  );
}
