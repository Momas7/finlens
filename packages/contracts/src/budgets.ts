import { z } from 'zod';
import { Cents, TotalCents, Uuid } from './money';

export const BudgetState = z.enum(['ok', 'warning', 'over']);
export type BudgetState = z.infer<typeof BudgetState>;

export const BudgetItem = z.object({
  categoryId: Uuid,
  label: z.string(),
  limitCents: TotalCents.nullable(),
  spentCents: TotalCents,
  share: z.number().nullable(),
  state: BudgetState.nullable(),
  pace: z
    .object({
      projectedCents: TotalCents,
      overOnDay: z.number().int().nullable(),
      dailyAllowanceCents: TotalCents.nullable(),
    })
    .nullable(),
  suggestion: z.object({ amountCents: TotalCents, months: z.number().int() }).nullable(),
});
export type BudgetItem = z.infer<typeof BudgetItem>;

export const BudgetMonth = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  isCurrent: z.boolean(),
  editable: z.boolean(),
  asOfDay: z.number().int().nullable(),
  totals: z.object({ budgetedCents: TotalCents, spentCents: TotalCents }),
  items: z.array(BudgetItem),
});
export type BudgetMonth = z.infer<typeof BudgetMonth>;

export const BudgetSet = z.object({
  amountCents: Cents.refine((v) => BigInt(v) > 0n, 'Informe um valor maior que zero.'),
});
export type BudgetSet = z.infer<typeof BudgetSet>;
