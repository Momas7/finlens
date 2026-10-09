import { z } from 'zod';
import { Cents, IsoDate, TotalCents, Uuid } from './money';

const Positive = Cents.refine((v) => BigInt(v) > 0n, 'Informe um valor maior que zero.');
const RatePercent = z
  .string()
  .trim()
  .regex(/^\d{1,3}([,.]\d{1,2})?$/, 'Use um número como 10,5.')
  .refine((v) => Number(v.replace(',', '.')) <= 100, 'Use no máximo 100%.');
const Name = z.string().trim().min(1, 'Dê um nome à meta.').max(60, 'Use até 60 caracteres.');

export const GoalCreate = z.object({
  name: Name,
  targetCents: Positive,
  accountId: Uuid,
  targetDate: IsoDate.nullable().optional(),
  annualRatePercent: RatePercent.nullable().optional(),
});
export type GoalCreate = z.infer<typeof GoalCreate>;

export const GoalUpdate = z.object({
  name: Name.optional(),
  targetCents: Positive.optional(),
  targetDate: IsoDate.nullable().optional(),
  annualRatePercent: RatePercent.nullable().optional(),
});
export type GoalUpdate = z.infer<typeof GoalUpdate>;

export const GoalStatus = z.enum(['done', 'on_track', 'behind', 'no_pace', 'no_date']);

export const Goal = z.object({
  id: Uuid,
  name: z.string(),
  targetCents: TotalCents,
  targetDate: IsoDate.nullable(),
  annualRatePercent: z.string().nullable(),
  accountId: Uuid,
  accountName: z.string(),
  balanceCents: TotalCents,
  progress: z.number(),
  remainingCents: TotalCents,
  monthlyPaceCents: TotalCents.nullable(),
  projectedMonth: z.string().nullable(),
  requiredMonthlyCents: TotalCents.nullable(),
  status: GoalStatus,
  delayMonths: z.number().int().nullable(),
  archived: z.boolean(),
});
export type Goal = z.infer<typeof Goal>;
export const GoalList = z.array(Goal);
