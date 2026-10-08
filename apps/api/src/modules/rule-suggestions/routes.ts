import { createHash } from 'node:crypto';
import { DismissRuleSuggestion, type RuleSuggestion } from '@finlens/contracts';
import {
  classificationRules,
  type Db,
  ruleSuggestionDismissals,
  type Tx,
  transactions,
  withTenant,
} from '@finlens/db';
import { amountBucket, type Confirmation, suggestRule } from '@finlens/domain';
import { and, eq, isNotNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { activeCategories } from '../classification/evidence';
import { groupKey, signOf } from '../review/queries';

const MAX_SUGGESTIONS = 10;

const suggestionId = (key: string, categoryId: string, bucketKey: string) =>
  createHash('sha1').update(`${key}|${categoryId}|${bucketKey}`).digest('hex').slice(0, 16);

/** Regras propostas a partir de confirmações consistentes, sem as dispensadas. */
export async function loadRuleSuggestions(tx: Tx): Promise<RuleSuggestion[]> {
  const [rows, rules, dismissed, active] = await Promise.all([
    tx
      .select()
      .from(transactions)
      .where(
        and(eq(transactions.classificationStatus, 'confirmed'), isNotNull(transactions.categoryId)),
      ),
    tx
      .select({ pattern: classificationRules.pattern, categoryId: classificationRules.categoryId })
      .from(classificationRules),
    tx.select({ id: ruleSuggestionDismissals.suggestionId }).from(ruleSuggestionDismissals),
    activeCategories(tx),
  ]);
  const dismissedIds = new Set(dismissed.map((d) => d.id));
  const groups = new Map<string, Confirmation[]>();
  for (const r of rows) {
    if (!r.descriptionNormalized) continue;
    const key = `${groupKey(r)}|${signOf(r.amountCents)}`;
    const list = groups.get(key) ?? [];
    list.push({
      normalized: r.descriptionNormalized,
      categoryId: r.categoryId as string,
      bucket: amountBucket(r.amountCents),
    });
    groups.set(key, list);
  }
  const result: RuleSuggestion[] = [];
  for (const [key, confirmations] of groups) {
    const draft = suggestRule(confirmations, rules);
    if (!draft) continue;
    const category = active.get(draft.categoryId);
    const id = suggestionId(key, draft.categoryId, draft.bucketKey);
    if (!category || dismissedIds.has(id)) continue;
    result.push({
      id,
      pattern: draft.pattern,
      categoryId: draft.categoryId,
      categoryLabel: category.label,
      minAmountCents: draft.minAmountCents?.toString() ?? null,
      maxAmountCents: draft.maxAmountCents?.toString() ?? null,
      basedOn: draft.basedOn,
    });
  }
  return result
    .sort((a, b) => b.basedOn - a.basedOn || a.pattern.localeCompare(b.pattern))
    .slice(0, MAX_SUGGESTIONS);
}

export async function ruleSuggestionRoutes(app: FastifyInstance, opts: { db: Db }) {
  const auth = { preHandler: app.requireAuth };

  app.get('/v1/rule-suggestions', auth, async (request) =>
    withTenant(opts.db, request.tenant, (tx) => loadRuleSuggestions(tx)),
  );

  app.post('/v1/rule-suggestions/dismiss', auth, async (request, reply) => {
    const { id } = DismissRuleSuggestion.parse(request.body);
    await withTenant(opts.db, request.tenant, (tx) =>
      tx
        .insert(ruleSuggestionDismissals)
        .values({ workspaceId: request.tenant.workspaceId, suggestionId: id })
        .onConflictDoNothing(),
    );
    return reply.status(204).send();
  });
}
