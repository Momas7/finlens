import { type ClassificationResult, ClassifyQuery } from '@finlens/contracts';
import { type Db, withTenant } from '@finlens/db';
import type { FastifyInstance } from 'fastify';
import { classifyFor } from './service';

export async function classificationRoutes(app: FastifyInstance, opts: { db: Db }) {
  app.get(
    '/v1/classify',
    { preHandler: app.requireAuth },
    async (request): Promise<ClassificationResult> => {
      const query = ClassifyQuery.parse(request.query);
      const result = await withTenant(opts.db, request.tenant, (tx) =>
        classifyFor(tx, {
          description: query.description,
          amountCents: BigInt(query.amountCents),
          accountId: query.accountId ?? null,
        }),
      );
      return {
        categoryId: result.category,
        categoryLabel: result.category
          ? (result.categories.get(result.category)?.label ?? null)
          : null,
        confidence: result.confidence,
        status: result.status,
        source: result.source,
        explanation: result.explanation,
        merchantKey: result.merchantKey,
      };
    },
  );
}
