import { type Db, ensurePersonalWorkspace } from '@finlens/db';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { Auth } from '../auth';

export type Tenant = { userId: string; workspaceId: string };
export type SessionUser = { id: string; name: string; email: string };

declare module 'fastify' {
  interface FastifyRequest {
    tenant: Tenant;
    sessionUser: SessionUser;
  }
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

function toHeaders(request: FastifyRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  return headers;
}

/**
 * Decora `requireAuth`: valida a sessão do Better Auth e define `request.tenant`.
 * O workspace vem sempre da sessão, nunca de parâmetros da requisição.
 */
export const tenantPlugin = fp(async (app: FastifyInstance, opts: { auth: Auth; db: Db }) => {
  app.decorateRequest('tenant', null as unknown as Tenant);
  app.decorateRequest('sessionUser', null as unknown as SessionUser);
  app.decorate('requireAuth', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await opts.auth.api.getSession({ headers: toHeaders(request) });
    if (!session) {
      await reply.status(401).send({ error: 'unauthorized' });
      return;
    }
    const workspace = await ensurePersonalWorkspace(opts.db, session.user.id);
    request.sessionUser = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    };
    request.tenant = { userId: session.user.id, workspaceId: workspace.id };
  });
});
