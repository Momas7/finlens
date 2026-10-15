import { z } from 'zod';
import { IsoDate, TotalCents, Uuid } from './money';

export const RecurrenceItem = z.object({
  key: z.string(),
  label: z.string(),
  accountId: Uuid,
  sampleDescription: z.string(),
  cadence: z.enum(['weekly', 'monthly', 'quarterly', 'annual']),
  typicalCents: TotalCents,
  monthlyCents: TotalCents,
  firstDate: IsoDate,
  lastDate: IsoDate,
  nextExpectedDate: IsoDate,
  occurrences: z.number().int(),
  intervalDays: z.number().int(),
  status: z.enum(['active', 'late', 'ended']),
  priceChange: z.object({ fromCents: TotalCents, toCents: TotalCents }).nullable(),
  isNew: z.boolean(),
});
export type RecurrenceItem = z.infer<typeof RecurrenceItem>;

export const RecurrenceList = z.object({
  items: z.array(RecurrenceItem),
  totals: z.object({ monthlyCents: TotalCents, count: z.number().int() }),
});
export type RecurrenceList = z.infer<typeof RecurrenceList>;
