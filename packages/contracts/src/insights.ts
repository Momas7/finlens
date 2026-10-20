import { z } from 'zod';
import { TotalCents } from './money';

const InsightId = z.string().regex(/^[0-9a-f]{16}$/);

export const Insight = z.object({
  id: InsightId,
  kind: z.enum([
    'category_spike',
    'small_purchases',
    'anomaly',
    'fees',
    'duplicate',
    'budget_pace',
    'savings',
    'recurrence_missing',
    'price_increase',
    'new_subscription',
    'high_commitment',
    'installment_ending',
  ]),
  severity: z.enum(['info', 'warning']),
  title: z.string(),
  body: z.string(),
  impactCents: TotalCents,
  isNew: z.boolean(),
  action: z.object({ label: z.string(), href: z.string() }).nullable(),
});
export type Insight = z.infer<typeof Insight>;

export const InsightList = z.object({ items: z.array(Insight) });
export type InsightList = z.infer<typeof InsightList>;

export const InsightQuery = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export const DismissInsight = z.object({ id: InsightId });
