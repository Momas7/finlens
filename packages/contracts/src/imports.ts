import { z } from 'zod';
import { Cents, IsoDate, Uuid } from './money';

export const ImportMapping = z.object({
  date: z.number().int().min(0).max(50),
  description: z.number().int().min(0).max(50),
  amount: z.number().int().min(0).max(50),
  dateFormat: z.enum(['dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy']),
  decimal: z.enum(['comma', 'dot']),
  expenseSign: z.enum(['negative', 'positive']),
});
export type ImportMapping = z.infer<typeof ImportMapping>;

export const ImportPreviewRequest = z.object({
  accountId: Uuid,
  filename: z.string().trim().min(1).max(200),
  /** Texto do arquivo, já decodificado. */
  content: z
    .string()
    .min(1)
    .max(5 * 1024 * 1024),
  mapping: ImportMapping.optional(),
});
export type ImportPreviewRequest = z.infer<typeof ImportPreviewRequest>;

export const ImportRowStatus = z.enum(['new', 'imported', 'existing']);
export type ImportRowStatus = z.infer<typeof ImportRowStatus>;

export const ImportPreviewRow = z.object({
  postedDate: IsoDate,
  description: z.string(),
  amountCents: Cents,
  status: ImportRowStatus,
});
export type ImportPreviewRow = z.infer<typeof ImportPreviewRow>;

export const ImportSummary = z.object({
  total: z.number().int(),
  new: z.number().int(),
  imported: z.number().int(),
  existing: z.number().int(),
  /** Entradas numa conta de cartão: pagamentos de fatura e estornos. */
  payments: z.number().int(),
  ignored: z.number().int(),
});
export type ImportSummary = z.infer<typeof ImportSummary>;

export const ImportPreview = z.union([
  z.object({
    needsMapping: z.object({ headers: z.array(z.string()), sample: z.array(z.array(z.string())) }),
  }),
  z.object({
    batchId: Uuid,
    format: z.enum(['ofx', 'csv']),
    summary: ImportSummary,
    rows: z.array(ImportPreviewRow),
  }),
]);
export type ImportPreview = z.infer<typeof ImportPreview>;

export const ImportCommitResult = z.object({
  imported: z.number().int(),
  skippedImported: z.number().int(),
  skippedExisting: z.number().int(),
});
export type ImportCommitResult = z.infer<typeof ImportCommitResult>;
