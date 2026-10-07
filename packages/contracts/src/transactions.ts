import { z } from 'zod';
import { Cents, IsoDate, NonZeroCents, Uuid } from './money';

const Description = z
  .string()
  .trim()
  .min(1, 'Informe uma descrição.')
  .max(140, 'Use até 140 caracteres.');
const Notes = z.string().trim().max(500, 'Use até 500 caracteres.').nullish();

export const TransactionCreate = z.object({
  accountId: Uuid,
  categoryId: Uuid.nullish(),
  postedDate: IsoDate,
  amountCents: NonZeroCents,
  description: Description,
  notes: Notes,
});
export type TransactionCreate = z.infer<typeof TransactionCreate>;

export const TransactionUpdate = TransactionCreate.partial().strict();
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
