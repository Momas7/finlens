import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Auth } from '../auth';
import type { Config } from '../config';

/** Encaminha /api/auth/* para o handler Fetch do Better Auth. */
export async function authRoutes(app: FastifyInstance, opts: { auth: Auth; config: Config }) {
  const STRICT_LIMIT = {
    rateLimit: { max: opts.config.authRateLimitPerMinute, timeWindow: '1 minute' },
  };
  const handler = async (request: FastifyRequest, reply: FastifyReply) => {
    const url = new URL(request.url, opts.config.betterAuthUrl);
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (value === undefined) continue;
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
    const hasBody = request.body !== undefined && request.body !== null;
    const response = await opts.auth.handler(
      new Request(url, {
        method: request.method,
        headers,
        body: hasBody ? JSON.stringify(request.body) : undefined,
      }),
    );

    reply.status(response.status);
    response.headers.forEach((value, key) => {
      if (key !== 'set-cookie') reply.header(key, value);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length > 0) reply.header('set-cookie', cookies);
    return reply.send(response.body ? await response.text() : null);
  };

  app.post('/api/auth/sign-in/email', { config: STRICT_LIMIT }, handler);
  app.post('/api/auth/sign-up/email', { config: STRICT_LIMIT }, handler);
  app.route({ method: ['GET', 'POST'], url: '/api/auth/*', handler });
}
