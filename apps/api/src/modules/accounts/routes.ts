import { AccountCreate, AccountUpdate, Uuid } from '@finlens/contracts';
import { type Db, withTenant } from '@finlens/db';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiError, notFound } from '../../http/errors';
import {
  archiveAccount,
  createAccount,
  findActiveAccount,
  getAccount,
  listAccounts,
  updateAccount,
} from './repository';

const ACCOUNT = 'Conta';

function accountId(request: FastifyRequest): string {
  const parsed = Uuid.safeParse((request.params as { id?: string }).id);
  if (!parsed.success) throw notFound(ACCOUNT);
  return parsed.data;
}

export async function accountRoutes(app: FastifyInstance, opts: { db: Db }) {
  const auth = { preHandler: app.requireAuth };

  app.get('/v1/accounts', auth, async (request) =>
    withTenant(opts.db, request.tenant, (tx) => listAccounts(tx)),
  );

  app.post('/v1/accounts', auth, async (request, reply) => {
    const input = AccountCreate.parse(request.body);
    const account = await withTenant(opts.db, request.tenant, async (tx) => {
      const id = await createAccount(tx, request.tenant.workspaceId, input);
      return getAccount(tx, id);
    });
    return reply.status(201).send(account);
  });

  app.patch('/v1/accounts/:id', auth, async (request) => {
    const id = accountId(request);
    const input = AccountUpdate.parse(request.body);
    return withTenant(opts.db, request.tenant, async (tx) => {
      const row = await findActiveAccount(tx, id);
      if (!row) throw notFound(ACCOUNT);
      const isCard = row.type === 'credit_card';
      const invalid = isCard
        ? (['openingBalanceCents', 'openingBalanceDate'] as const).find(
            (k) => input[k] !== undefined,
          )
        : (['closingDay', 'dueDay'] as const).find((k) => input[k] !== undefined);
      if (invalid) {
        throw new ApiError(400, 'validation', 'Verifique os campos.', {
          [invalid]: 'Campo não se aplica a este tipo de conta.',
        });
      }
      await updateAccount(tx, row, input);
      return getAccount(tx, id);
    });
  });

  app.delete('/v1/accounts/:id', auth, async (request, reply) => {
    const id = accountId(request);
    await withTenant(opts.db, request.tenant, async (tx) => {
      if (!(await findActiveAccount(tx, id))) throw notFound(ACCOUNT);
      await archiveAccount(tx, id);
    });
    return reply.status(204).send();
  });
}
