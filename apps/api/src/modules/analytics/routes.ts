import { MonthQuery } from '@finlens/contracts';
import { type Db, withTenant } from '@finlens/db';
import { parseMonth, todayInSaoPaulo } from '@finlens/domain';
import type { FastifyInstance } from 'fastify';
import { ApiError } from '../../http/errors';
import { loadMonthSummary } from './queries';

export async function analyticsRoutes(app: FastifyInstance, opts: { db: Db }) {
  app.get('/v1/analytics/month', { preHandler: app.requireAuth }, async (request) => {
    const query = MonthQuery.parse(request.query);
    const today = todayInSaoPaulo();
    const currentMonth = today.slice(0, 7);
    const month = query.month === undefined ? currentMonth : parseMonth(query.month);
    if (!month || month > currentMonth) {
      throw new ApiError(400, 'validation', 'Verifique os campos.', {
        month: 'Use um mês no formato AAAA-MM, até o mês atual.',
      });
    }
    return withTenant(opts.db, request.tenant, (tx) => loadMonthSummary(tx, month, today));
  });
}
