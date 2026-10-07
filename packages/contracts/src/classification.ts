import { z } from 'zod';
import { Cents, Uuid } from './money';

export const ClassificationStatus = z.enum(['auto', 'likely', 'suggested', 'confirmed', 'none']);
export type ClassificationStatus = z.infer<typeof ClassificationStatus>;
export const ClassificationSource = z.enum([
  'rule',
  'history',
  'similar',
  'merchant',
  'keyword',
  'user',
]);
export type ClassificationSource = z.infer<typeof ClassificationSource>;

export const ClassifyQuery = z.object({
  description: z.string().trim().min(1).max(140),
  amountCents: Cents,
  accountId: Uuid.optional(),
});
export type ClassifyQuery = z.infer<typeof ClassifyQuery>;

export const ClassificationResult = z.object({
  categoryId: Uuid.nullable(),
  categoryLabel: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  status: ClassificationStatus.exclude(['confirmed']),
  source: ClassificationSource.exclude(['user']).nullable(),
  explanation: z.string().nullable(),
  merchantKey: z.string().nullable(),
});
export type ClassificationResult = z.infer<typeof ClassificationResult>;
