import { classificationFeedback, type Tx, type transactions } from '@finlens/db';
import { amountBucket, matchMerchant, normalize } from '@finlens/domain';
import { classifyFor } from '../classification/service';

type ClassificationFields = Pick<
  typeof transactions.$inferInsert,
  | 'categoryId'
  | 'suggestedCategoryId'
  | 'classificationStatus'
  | 'classificationSource'
  | 'classificationConfidence'
  | 'classificationExplanation'
  | 'descriptionNormalized'
  | 'merchantKey'
>;

/** "keep": mantém a categoria atual (lançamento confirmado ou nada relevante mudou). */
export type CategoryDecision = 'auto' | 'keep' | null | { chosen: string };

export type Feedback = Omit<
  typeof classificationFeedback.$inferInsert,
  'workspaceId' | 'transactionId'
>;

/**
 * Decide os campos de classificação de um lançamento. Escolha do usuário vira "confirmed" e
 * gera feedback com o que o motor teria previsto (sem contar o próprio lançamento).
 */
export async function categorize(
  tx: Tx,
  decision: CategoryDecision,
  input: { description: string; amountCents: bigint; accountId: string; transactionId?: string },
): Promise<{ fields: ClassificationFields; feedback: Feedback | null }> {
  const normalized = normalize(input.description).normalized;
  const merchantKey = matchMerchant(normalized)?.key ?? null;
  const base = { descriptionNormalized: normalized, merchantKey };

  if (decision === 'keep') return { fields: base, feedback: null };

  if (decision === null) {
    return {
      fields: {
        ...base,
        categoryId: null,
        suggestedCategoryId: null,
        classificationStatus: 'none',
        classificationSource: null,
        classificationConfidence: null,
        classificationExplanation: null,
      },
      feedback: null,
    };
  }

  const prediction = await classifyFor(tx, {
    description: input.description,
    amountCents: input.amountCents,
    accountId: input.accountId,
    excludeTransactionId: input.transactionId,
  });

  if (decision === 'auto') {
    const applied = prediction.status === 'auto' || prediction.status === 'likely';
    return {
      fields: {
        ...base,
        categoryId: applied ? prediction.category : null,
        suggestedCategoryId: prediction.status === 'suggested' ? prediction.category : null,
        classificationStatus: prediction.status,
        classificationSource: prediction.source,
        classificationConfidence: prediction.status === 'none' ? null : prediction.confidence,
        classificationExplanation: prediction.explanation,
      },
      feedback: null,
    };
  }

  return {
    fields: {
      ...base,
      categoryId: decision.chosen,
      suggestedCategoryId: null,
      classificationStatus: 'confirmed',
      classificationSource: 'user',
      classificationConfidence: 1,
      classificationExplanation: null,
    },
    feedback: {
      predictedCategoryId: prediction.category,
      predictedConfidence: prediction.status === 'none' ? null : prediction.confidence,
      predictedSource: prediction.source,
      chosenCategoryId: decision.chosen,
      merchantKey,
      descriptionNormalized: normalized,
      amountBucket: amountBucket(input.amountCents),
    },
  };
}

export async function recordFeedback(
  tx: Tx,
  workspaceId: string,
  transactionId: string,
  feedback: Feedback | null,
) {
  if (!feedback) return;
  await tx.insert(classificationFeedback).values({ ...feedback, workspaceId, transactionId });
}
