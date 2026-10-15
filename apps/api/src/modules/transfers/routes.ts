import { TransferDismiss, TransferLink, Uuid } from '@finlens/contracts';
import { type Db, withTenant } from '@finlens/db';
import { todayInSaoPaulo } from '@finlens/domain';
import type { FastifyInstance } from 'fastify';
import { notFound } from '../../http/errors';
import { dismissSuggestion, linkPair, loadSuggestions, unlinkPair } from './queries';

export async function transferRoutes(app: FastifyInstance, opts: { db: Db }) {
  const auth = { preHandler: app.requireAuth };

  app.get('/v1/transfers/suggestions', auth, async (request) =>
    withTenant(opts.db, request.tenant, (tx) => loadSuggestions(tx, todayInSaoPaulo())),
  );

  app.post('/v1/transfers/link', auth, async (request, reply) => {
    const { a, b } = TransferLink.parse(request.body);
    await withTenant(opts.db, request.tenant, (tx) =>
      linkPair(tx, request.tenant.workspaceId, a, b),
    );
    return reply.status(204).send();
  });

  app.post('/v1/transfers/dismiss', auth, async (request, reply) => {
    const { id } = TransferDismiss.parse(request.body);
    await withTenant(opts.db, request.tenant, (tx) =>
      dismissSuggestion(tx, request.tenant.workspaceId, todayInSaoPaulo(), id),
    );
    return reply.status(204).send();
  });

  app.post('/v1/transactions/:id/unlink', auth, async (request, reply) => {
    const parsed = Uuid.safeParse((request.params as { id?: string }).id);
    if (!parsed.success) throw notFound('Lançamento');
    await withTenant(opts.db, request.tenant, (tx) => unlinkPair(tx, parsed.data));
    return reply.status(204).send();
  });
}
