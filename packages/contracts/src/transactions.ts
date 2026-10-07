import { z } from 'zod';
import { ClassificationSource, ClassificationStatus } from './classification';
import { Cents, IsoDate, NonZeroCents, Uuid } from './money';

const Description = z
  .string()
  .trim()
  .min(1, 'Informe uma descrição.')
  .max(140, 'Use até 140 caracteres.');
const Notes = z.string().trim().max(500, 'Use até 500 caracteres.').nullish();

/** "auto": o servidor classifica; UUID: escolha do usuário (confirmada); null: sem categoria. */
export const CategoryChoice = z.union([z.literal('auto'), Uuid, z.null()]);

export const TransactionCreate = z.object({
  accountId: Uuid,
  categoryId: CategoryChoice.default('auto'),
  postedDate: IsoDate,
  amountCents: NonZeroCents,
  description: Description,
  notes: Notes,
});
export type TransactionCreate = z.infer<typeof TransactionCreate>;

export const TransactionUpdate = TransactionCreate.extend({ categoryId: CategoryChoice })
  .partial()
  .strict()
  .refine((input) => Object.keys(input).length > 0, 'Informe ao menos um campo para alterar.');
export type TransactionUpdate = z.infer<typeof TransactionUpdate>;

export const Transaction = z.object({
  id: Uuid,
  accountId: Uuid,
  categoryId: Uuid.nullable(),
  postedDate: IsoDate,
  statementMonth: IsoDate.nullable(),
  amountCents: Cents,
  description: z.string(),
  notes: z.string().nullable(),
  source: z.literal('manual'),
  classificationStatus: ClassificationStatus,
  classificationSource: ClassificationSource.nullable(),
  classificationConfidence: z.number().nullable(),
  classificationExplanation: z.string().nullable(),
  suggestedCategoryId: Uuid.nullable(),
  merchantKey: z.string().nullable(),
});
export type Transaction = z.infer<typeof Transaction>;

export const TransactionQuery = z.object({
  accountId: Uuid.optional(),
  categoryId: Uuid.optional(),
  from: IsoDate.optional(),
  to: IsoDate.optional(),
  q: z.string().trim().max(100).optional(),
  cursor: z.string().max(200).optional(),
});
export type TransactionQuery = z.infer<typeof TransactionQuery>;

export const TransactionPage = z.object({
  items: z.array(Transaction),
  nextCursor: z.string().nullable(),
});
export type TransactionPage = z.infer<typeof TransactionPage>;
