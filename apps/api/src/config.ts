import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  WEB_ORIGIN: z.url(),
  PORT: z.coerce.number().int().positive().default(3333),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
  // Proxies cujo X-Forwarded-For é aceito (IPs ou CIDRs). Vazio por padrão: o Next.js repassa
  // o X-Forwarded-For que o cliente enviar, então só configure atrás de um proxy reverso que
  // sobrescreva o cabeçalho (nginx, Caddy).
  TRUSTED_PROXIES: z.string().default(''),
});

export type Config = {
  databaseUrl: string;
  betterAuthSecret: string;
  betterAuthUrl: string;
  webOrigin: string;
  port: number;
  logLevel: z.infer<typeof EnvSchema>['LOG_LEVEL'];
  isProduction: boolean;
  /** Tentativas de login/cadastro por minuto por IP. */
  authRateLimitPerMinute: number;
  /** Requisições por minuto por IP em todas as rotas. */
  rateLimitPerMinute: number;
  trustedProxies: string[];
};

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Configuração inválida: ${names.join(', ')}`);
  }
  const e = parsed.data;
  return {
    databaseUrl: e.DATABASE_URL,
    betterAuthSecret: e.BETTER_AUTH_SECRET,
    betterAuthUrl: e.BETTER_AUTH_URL,
    webOrigin: e.WEB_ORIGIN,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    isProduction: e.NODE_ENV === 'production',
    authRateLimitPerMinute: e.AUTH_RATE_LIMIT_PER_MINUTE,
    rateLimitPerMinute: e.RATE_LIMIT_PER_MINUTE,
    trustedProxies: e.TRUSTED_PROXIES.split(',')
      .map((p) => p.trim())
      .filter(Boolean),
  };
}
