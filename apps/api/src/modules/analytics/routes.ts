import { MonthQuery } from '@finlens/contracts';
import { type Db, withTenant } from '@finlens/db';
import { todayInSaoPaulo } from '@finlens/domain';
import type { FastifyInstance } from 'fastify';
import { resolveMonth } from './month-param';
import { loadMonthSummary } from './queries';

export async function analyticsRoutes(app: FastifyInstance, opts: { db: Db }) {
  app.get('/v1/analytics/month', { preHandler: app.requireAuth }, async (request) => {
    const query = MonthQuery.parse(request.query);
    const today = todayInSaoPaulo();
    const month = resolveMonth(query.month, today);
    return withTenant(opts.db, request.tenant, (tx) => loadMonthSummary(tx, month, today));
  });
}
