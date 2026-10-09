import { createHash } from 'node:crypto';
import { DismissInsight, type Insight, InsightQuery } from '@finlens/contracts';
import { type Db, insightStates, type Tx, withTenant } from '@finlens/db';
import { generateInsights, rankInsights, todayInSaoPaulo } from '@finlens/domain';
import { inArray, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { loadInsightContext } from './context';

const MAX_ITEMS = 20;
const insightId = (key: string) => createHash('sha1').update(key).digest('hex').slice(0, 16);

async function candidates(tx: Tx) {
  return generateInsights(await loadInsightContext(tx, todayInSaoPaulo()));
}

/** Insights atuais, ranqueados; registra quando cada um apareceu pela primeira vez. */
async function currentInsights(tx: Tx, workspaceId: string, limit: number): Promise<Insight[]> {
  const all = await candidates(tx);
  const keys = all.map((c) => c.dedupeKey);
  const rows = keys.length
    ? await tx.select().from(insightStates).where(inArray(insightStates.dedupeKey, keys))
    : [];
  const states = new Map(
    rows.map((r) => [
      r.dedupeKey,
      { firstSeenAt: r.firstSeenAt, dismissed: r.dismissedAt !== null },
    ]),
  );
  const ranked = rankInsights(all, states, new Date(), limit);
  if (ranked.length > 0) {
    await tx
      .insert(insightStates)
      .values(ranked.map((r) => ({ workspaceId, dedupeKey: r.dedupeKey })))
      .onConflictDoNothing();
  }
  return ranked.map((r) => ({
    id: insightId(r.dedupeKey),
    kind: r.kind,
    severity: r.severity,
    title: r.title,
    body: r.body,
    impactCents: r.impactCents.toString(),
    isNew: r.isNew,
    action: r.action,
  }));
}

export async function insightRoutes(app: FastifyInstance, opts: { db: Db }) {
  const auth = { preHandler: app.requireAuth };

  app.get('/v1/insights', auth, async (request) => {
    const { limit = MAX_ITEMS } = InsightQuery.parse(request.query);
    const items = await withTenant(opts.db, request.tenant, (tx) =>
      currentInsights(tx, request.tenant.workspaceId, limit),
    );
    return { items };
  });

  app.post('/v1/insights/dismiss', auth, async (request, reply) => {
    const { id } = DismissInsight.parse(request.body);
    await withTenant(opts.db, request.tenant, async (tx) => {
      const match = (await candidates(tx)).find((c) => insightId(c.dedupeKey) === id);
      if (!match) return;
      await tx
        .insert(insightStates)
        .values({
          workspaceId: request.tenant.workspaceId,
          dedupeKey: match.dedupeKey,
          dismissedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [insightStates.workspaceId, insightStates.dedupeKey],
          set: { dismissedAt: sql`now()` },
        });
    });
    return reply.status(204).send();
  });
}
