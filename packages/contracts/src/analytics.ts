import { z } from 'zod';
import { TotalCents, Uuid } from './money';

const MonthText = z.string().regex(/^\d{4}-\d{2}$/);

export const MonthQuery = z.object({ month: z.string().max(10).optional() });
export type MonthQuery = z.infer<typeof MonthQuery>;

export const MonthCategory = z.object({
  categoryId: Uuid.nullable(),
  label: z.string(),
  expenseCents: TotalCents,
  count: z.number().int(),
  limitCents: TotalCents.nullable(),
});
export type MonthCategory = z.infer<typeof MonthCategory>;

export const MonthSummary = z.object({
  month: MonthText,
  isCurrent: z.boolean(),
  asOfDay: z.number().int().nullable(),
  incomeCents: TotalCents,
  expenseCents: TotalCents,
  netCents: TotalCents,
  comparison: z.object({
    month: MonthText,
    upToDay: z.number().int().nullable(),
    incomeCents: TotalCents,
    expenseCents: TotalCents,
  }),
  categories: z.array(MonthCategory),
  pendingReview: z.number().int(),
  budgetAlerts: z.object({ warning: z.number().int(), over: z.number().int() }),
  history: z.array(
    z.object({ month: MonthText, incomeCents: TotalCents, expenseCents: TotalCents }),
  ),
});
export type MonthSummary = z.infer<typeof MonthSummary>;
