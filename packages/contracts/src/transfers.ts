import { z } from 'zod';
import { IsoDate, TotalCents, Uuid } from './money';

export const TransferKind = z.enum(['transfer', 'card_payment']);
export type TransferKind = z.infer<typeof TransferKind>;

const Side = z.object({
  id: Uuid,
  accountName: z.string(),
  postedDate: IsoDate,
  amountCents: TotalCents,
  description: z.string(),
});

export const TransferSuggestion = z.object({
  id: z.string().regex(/^[0-9a-f]{16}$/),
  kind: TransferKind,
  reason: z.string(),
  /** A saída. */
  a: Side,
  /** A entrada. */
  b: Side,
});
export type TransferSuggestion = z.infer<typeof TransferSuggestion>;
export const TransferSuggestionList = z.array(TransferSuggestion);

export const TransferLink = z.object({ a: Uuid, b: Uuid });
export const TransferDismiss = z.object({ id: z.string().regex(/^[0-9a-f]{16}$/) });

/** Resumo da ligação de um lançamento a sua outra ponta. */
export const TransactionTransfer = z.object({
  pairId: Uuid,
  withAccount: z.string(),
  kind: TransferKind,
});
export type TransactionTransfer = z.infer<typeof TransactionTransfer>;
