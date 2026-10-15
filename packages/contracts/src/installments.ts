import { z } from 'zod';
import { IsoDate, TotalCents, Uuid } from './money';

export const InstallmentPlanItem = z.object({
  key: z.string(),
  label: z.string(),
  accountId: Uuid,
  sampleDescription: z.string(),
  total: z.number().int(),
  lastSeen: z.number().int(),
  seenCount: z.number().int(),
  installmentCents: TotalCents,
  remaining: z.number().int(),
  lastSeenDate: IsoDate,
  nextDate: IsoDate.nullable(),
  endDate: IsoDate,
  remainingCents: TotalCents,
  status: z.enum(['active', 'done', 'stale']),
});
export type InstallmentPlanItem = z.infer<typeof InstallmentPlanItem>;

export const InstallmentList = z.object({
  plans: z.array(InstallmentPlanItem),
  totals: z.object({
    remainingCents: TotalCents,
    nextMonthCents: TotalCents,
    count: z.number().int(),
  }),
  byMonth: z.array(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), cents: TotalCents })),
});
export type InstallmentList = z.infer<typeof InstallmentList>;
