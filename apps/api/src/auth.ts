import * as schema from '@finlens/db';
import { type Db, ensurePersonalWorkspace } from '@finlens/db';
import { hash, verify } from '@node-rs/argon2';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { FastifyBaseLogger } from 'fastify';
import { betterAuthLogger } from './better-auth-logger';
import type { Config } from './config';

// Parâmetros argon2id recomendados pela OWASP (19 MiB, 2 iterações, paralelismo 1).
const ARGON2_OPTIONS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function createAuth(db: Db, config: Config, log: FastifyBaseLogger) {
  return betterAuth({
    baseURL: config.betterAuthUrl,
    secret: config.betterAuthSecret,
    trustedOrigins: [config.webOrigin],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      password: {
        hash: (password) => hash(password, ARGON2_OPTIONS),
        verify: ({ hash: stored, password }) => verify(stored, password),
      },
    },
    // Rate limit é feito pelo Fastify, que conhece o IP real da requisição.
    rateLimit: { enabled: false },
    telemetry: { enabled: false },
    // Logs do Better Auth vão para o pino (estrutura, redaction e serialização de erros).
    logger: betterAuthLogger(log),
    advanced: { useSecureCookies: config.secureCookies },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            // Falha aqui não pode impedir o cadastro: requireAuth cria o workspace sob demanda.
            try {
              await ensurePersonalWorkspace(db, user.id);
            } catch (err) {
              log.warn({ err, userId: user.id }, 'falha ao criar workspace pessoal no cadastro');
            }
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
