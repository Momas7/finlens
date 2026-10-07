import type { Db } from '@finlens/db';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance, opts: { db: Db }) {
  app.get('/health', async (_request, reply) => {
    try {
      await opts.db.execute(sql`select 1`);
      return { status: 'ok', db: 'ok' };
    } catch (err) {
      app.log.error({ err }, 'health check: banco indisponível');
      return reply.status(503).send({ status: 'error', db: 'unavailable' });
    }
  });
}
