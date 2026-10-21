import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { Db } from '@finlens/db';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { createAuth } from './auth';
import type { Config } from './config';
import { registerErrorHandler } from './http/errors';
import { accountRoutes } from './modules/accounts/routes';
import { analyticsRoutes } from './modules/analytics/routes';
import { budgetRoutes } from './modules/budgets/routes';
import { categoryRoutes } from './modules/categories/routes';
import { classificationRoutes } from './modules/classification/routes';
import { goalRoutes } from './modules/goals/routes';
import { healthRoutes } from './modules/health/routes';
import { importRoutes } from './modules/imports/routes';
import { insightRoutes } from './modules/insights/routes';
import { installmentRoutes } from './modules/installments/routes';
import { llmRoutes } from './modules/llm/routes';
import { meRoutes } from './modules/me/routes';
import { recurrenceRoutes } from './modules/recurrences/routes';
import { reviewRoutes } from './modules/review/routes';
import { ruleSuggestionRoutes } from './modules/rule-suggestions/routes';
import { ruleRoutes } from './modules/rules/routes';
import { transactionRoutes } from './modules/transactions/routes';
import { transferRoutes } from './modules/transfers/routes';
import { authRoutes } from './plugins/auth-routes';
import { tenantPlugin } from './plugins/tenant';

const REDACT = {
  paths: [
    'req.headers.cookie',
    'req.headers.authorization',
    'res.headers["set-cookie"]',
    '*.password',
    'body.password',
  ],
  censor: '[redacted]',
};

export async function buildApp(deps: {
  config: Config;
  db: Db;
  logger?: FastifyServerOptions['logger'];
}): Promise<FastifyInstance> {
  const { config, db } = deps;
  const logger =
    deps.logger && typeof deps.logger === 'object'
      ? { ...deps.logger, redact: REDACT }
      : { level: config.logLevel, redact: REDACT };

  // Só proxies listados podem informar o IP do cliente; os demais usam o IP da conexão.
  const app = Fastify({ logger, bodyLimit: 1024 * 1024, trustProxy: config.trustedProxies });

  await app.register(helmet);
  await app.register(cors, { origin: config.webOrigin, credentials: true });
  await app.register(rateLimit, {
    global: true,
    max: config.rateLimitPerMinute,
    timeWindow: '1 minute',
  });

  registerErrorHandler(app);

  const auth = createAuth(db, config, app.log);
  await app.register(tenantPlugin, { auth, db });
  await app.register(healthRoutes, { db });
  await app.register(authRoutes, { auth, config });
  await app.register(meRoutes, { db, config });
  await app.register(accountRoutes, { db });
  await app.register(categoryRoutes, { db });
  await app.register(transactionRoutes, { db });
  await app.register(classificationRoutes, { db });
  await app.register(ruleRoutes, { db });
  await app.register(reviewRoutes, { db });
  await app.register(analyticsRoutes, { db });
  await app.register(budgetRoutes, { db });
  await app.register(insightRoutes, { db });
  await app.register(transferRoutes, { db });
  await app.register(recurrenceRoutes, { db });
  await app.register(installmentRoutes, { db });
  await app.register(goalRoutes, { db });
  await app.register(importRoutes, { db });
  await app.register(llmRoutes, { db, config });
  await app.register(ruleSuggestionRoutes, { db });

  return app;
}
