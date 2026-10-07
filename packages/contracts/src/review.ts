import { z } from 'zod';
import { Cents, IsoDate, TotalCents, Uuid } from './money';
import { Transaction } from './transactions';

export const ReviewGroup = z.object({
  key: z.string(),
  sign: z.enum(['out', 'in']),
  label: z.string(),
  count: z.number().int(),
  totalCents: TotalCents,
  suggestedCategoryId: Uuid.nullable(),
  confidence: z.number().nullable(),
  transactionIds: z.array(Uuid),
  latestDate: IsoDate,
});
export type ReviewGroup = z.infer<typeof ReviewGroup>;

export const Review = z.object({
  needsYou: z.array(ReviewGroup),
  likely: z.array(ReviewGroup),
  counts: z.object({ needsYou: z.number().int(), likely: z.number().int() }),
});
export type Review = z.infer<typeof Review>;

export const ConfirmBatch = z.object({
  ids: z.array(Uuid).min(1).max(200),
  categoryId: Uuid,
});
export type ConfirmBatch = z.infer<typeof ConfirmBatch>;

export const SimilarItem = z.object({
  transaction: Transaction,
  currentCategoryLabel: z.string().nullable(),
  preselected: z.boolean(),
});
export type SimilarItem = z.infer<typeof SimilarItem>;
export const SimilarList = z.array(SimilarItem);

export const RuleSuggestion = z.object({
  id: z.string().regex(/^[0-9a-f]{16}$/),
  pattern: z.string(),
  categoryId: Uuid,
  categoryLabel: z.string(),
  minAmountCents: Cents.nullable(),
  maxAmountCents: Cents.nullable(),
  basedOn: z.number().int(),
});
export type RuleSuggestion = z.infer<typeof RuleSuggestion>;
export const RuleSuggestionList = z.array(RuleSuggestion);
export const DismissRuleSuggestion = z.object({ id: z.string().regex(/^[0-9a-f]{16}$/) });
