import { type LlmStatus, type LlmSuggestion, LlmSuggestRequest } from '@finlens/contracts';
import { type Db, transactions, withTenant } from '@finlens/db';
import { buildLlmPrompt, parseLlmAnswer } from '@finlens/domain';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Config } from '../../config';
import { notFound } from '../../http/errors';
import { activeCategories } from '../classification/evidence';
import { askLlm } from './client';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 1000;

export async function llmRoutes(app: FastifyInstance, opts: { db: Db; config: Config }) {
  const llm = opts.config.llm;
  // Resposta do modelo por workspace + sentido + texto (as categorias vêm do workspace).
  const cache = new Map<string, { at: number; value: LlmSuggestion }>();

  app.get(
    '/v1/llm/status',
    { preHandler: app.requireAuth },
    async (): Promise<LlmStatus> => ({
      enabled: llm !== null,
    }),
  );

  app.post(
    '/v1/llm/suggest',
    {
      preHandler: app.requireAuth,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request): Promise<LlmSuggestion> => {
      if (!llm) throw notFound('Recurso');
      const { transactionId } = LlmSuggestRequest.parse(request.body);
      const { workspaceId } = request.tenant;

      const context = await withTenant(opts.db, request.tenant, async (tx) => {
        const [row] = await tx
          .select({
            normalized: transactions.descriptionNormalized,
            amountCents: transactions.amountCents,
          })
          .from(transactions)
          .where(eq(transactions.id, transactionId));
        if (!row) return null;
        const sign = row.amountCents < 0n ? ('out' as const) : ('in' as const);
        const kind = sign === 'out' ? 'expense' : 'income';
        const options = [...(await activeCategories(tx)).values()].filter((c) => c.kind === kind);
        return { normalized: row.normalized, sign, options };
      });
      if (!context) throw notFound('Lançamento');

      const none: LlmSuggestion = { categoryId: null };
      if (!context.normalized || context.options.length === 0) return none;

      const key = `${workspaceId}|${context.sign}|${context.normalized}`;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

      const labels = context.options.map((c) => c.label);
      const answer = await askLlm(llm, buildLlmPrompt(context.normalized, context.sign, labels));
      if (answer === null) return none; // falha ou demora: sem erro e sem cache
      const parsed = parseLlmAnswer(answer, labels);
      const chosen = parsed ? context.options.find((c) => c.label === parsed.category) : undefined;
      const value: LlmSuggestion =
        parsed && chosen
          ? {
              categoryId: chosen.id,
              label: chosen.label,
              confidence: parsed.confidence,
              explanation: 'Sugestão da IA local. Revise antes de confirmar.',
            }
          : none;

      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
      cache.set(key, { at: Date.now(), value });
      return value;
    },
  );
}
