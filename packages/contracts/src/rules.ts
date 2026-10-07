import { z } from 'zod';
import { Cents, Uuid } from './money';

export const ClassificationRuleCreate = z.object({
  categoryId: Uuid,
  pattern: z.string().trim().min(1, 'Informe o texto da regra.').max(140),
  minAmountCents: Cents.optional(),
  maxAmountCents: Cents.optional(),
  accountId: Uuid.optional(),
});
export type ClassificationRuleCreate = z.infer<typeof ClassificationRuleCreate>;

export const ClassificationRule = z.object({
  id: Uuid,
  categoryId: Uuid,
  categoryLabel: z.string(),
  pattern: z.string(),
  minAmountCents: Cents.nullable(),
  maxAmountCents: Cents.nullable(),
  accountId: Uuid.nullable(),
  createdAt: z.string(),
});
export type ClassificationRule = z.infer<typeof ClassificationRule>;
export const ClassificationRuleList = z.array(ClassificationRule);
