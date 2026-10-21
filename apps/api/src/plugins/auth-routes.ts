import type { AuditEvent } from '@finlens/contracts';
import type { Db } from '@finlens/db';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Auth } from '../auth';
import type { Config } from '../config';
import { recordAudit } from '../modules/audit/record';

/** Encaminha /api/auth/* para o handler Fetch do Better Auth. */
// Só o fluxo que a tela usa. O resto do plugin (get-totp-uri devolve o segredo; send-otp e
// verify-otp não estão configurados) fica fechado.
const TWO_FACTOR_ALLOWED = new Set([
  'enable',
  'disable',
  'verify-totp',
  'verify-backup-code',
  'generate-backup-codes',
]);

export async function authRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; config: Config; db: Db },
) {
  const STRICT_LIMIT = {
    rateLimit: { max: opts.config.authRateLimitPerMinute, timeWindow: '1 minute' },
  };
  const handler = async (request: FastifyRequest, reply: FastifyReply) => {
    const url = new URL(request.url, opts.config.betterAuthUrl);
    const rawPath = request.url.split('?')[0] ?? '';
    // O Fastify casa o caminho cru e o Better Auth o normalizado: segmentos `..` escapariam do
    // limite estrito de tentativas.
    if (/\.\.|%2e/i.test(rawPath)) return reply.status(404).send({ error: 'not_found' });
    if (url.pathname.startsWith('/api/auth/two-factor/')) {
      const name = url.pathname.slice('/api/auth/two-factor/'.length);
      if (!TWO_FACTOR_ALLOWED.has(name)) return reply.status(404).send({ error: 'not_found' });
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (value === undefined) continue;
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
    const path = url.pathname;
    // Quem já tinha sessão antes da chamada (ativação, desativação, novos códigos).
    const before = path.startsWith('/api/auth/two-factor/')
      ? await opts.auth.api.getSession({ headers }).catch(() => null)
      : null;
    // "Confiar neste dispositivo" pularia o 2FA por 30 dias; `disableSession` devolve 200 sem
    // sessão. A tela não usa nenhum dos dois.
    let body = request.body;
    if (path.startsWith('/api/auth/two-factor/verify-') && body && typeof body === 'object') {
      const {
        trustDevice: _trust,
        disableSession: _disable,
        ...rest
      } = body as Record<string, unknown>;
      body = rest;
    }
    const hasBody = body !== undefined && body !== null;
    const response = await opts.auth.handler(
      new Request(url, {
        method: request.method,
        headers,
        body: hasBody ? JSON.stringify(body) : undefined,
      }),
    );

    reply.status(response.status);
    response.headers.forEach((value, key) => {
      if (key !== 'set-cookie') reply.header(key, value);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length > 0) reply.header('set-cookie', cookies);
    const text = response.body ? await response.text() : null;
    if (response.ok) await audit(request, path, text, before?.user ?? null);
    return reply.send(text);
  };

  /** Registra o que importa para a atividade da conta. Nunca lê nem grava segredos. */
  async function audit(
    request: FastifyRequest,
    path: string,
    text: string | null,
    sessionUser: { id: string; twoFactorEnabled?: boolean | null } | null,
  ) {
    let body: { user?: { id?: string }; twoFactorRedirect?: boolean } = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      // resposta sem JSON: nada a registrar a partir do corpo
    }
    let event: AuditEvent | null = null;
    let userId: string | undefined;
    if (path === '/api/auth/sign-in/email' && !body.twoFactorRedirect) {
      event = 'sign_in';
      userId = body.user?.id;
    } else if (
      path === '/api/auth/two-factor/verify-totp' ||
      path === '/api/auth/two-factor/verify-backup-code'
    ) {
      if (!sessionUser) {
        event = 'sign_in';
        userId = body.user?.id;
      } else if (path.endsWith('verify-totp') && !sessionUser.twoFactorEnabled) {
        event = 'two_factor_enabled';
        userId = sessionUser.id;
      }
    } else if (sessionUser && path === '/api/auth/two-factor/disable') {
      event = 'two_factor_disabled';
      userId = sessionUser.id;
    } else if (sessionUser && path === '/api/auth/two-factor/generate-backup-codes') {
      event = 'backup_codes_regenerated';
      userId = sessionUser.id;
    }
    if (!event || !userId) return;
    await recordAudit(opts.db, request.log, {
      userId,
      event,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  app.post('/api/auth/sign-in/email', { config: STRICT_LIMIT }, handler);
  app.post('/api/auth/sign-up/email', { config: STRICT_LIMIT }, handler);
  app.post('/api/auth/two-factor/*', { config: STRICT_LIMIT }, handler);
  app.route({ method: ['GET', 'POST'], url: '/api/auth/*', handler });
}
