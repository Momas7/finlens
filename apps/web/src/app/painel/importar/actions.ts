'use server';

import type { ImportCommitResult, ImportPreview } from '@finlens/contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiSend, UnauthorizedError } from '@/lib/api';
import { decodeText } from '@/lib/decode';
import { parseId } from '@/lib/ids';

export type ImportState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  preview?: Extract<ImportPreview, { batchId: string }>;
  needsMapping?: Extract<ImportPreview, { needsMapping: unknown }>['needsMapping'];
};

const MAX_BYTES = 5 * 1024 * 1024;

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/auth/clear-session');
    throw err;
  }
}

function mappingFrom(form: FormData) {
  if (form.get('mapDate') === null) return undefined;
  return {
    date: Number(form.get('mapDate')),
    description: Number(form.get('mapDescription')),
    amount: Number(form.get('mapAmount')),
    dateFormat: String(form.get('mapDateFormat') ?? ''),
    decimal: String(form.get('mapDecimal') ?? ''),
    expenseSign: String(form.get('mapExpenseSign') ?? ''),
  };
}

/** Lê o arquivo e devolve a prévia (ou o pedido de mapeamento). Nada é gravado. */
export async function previewStatement(_prev: ImportState, form: FormData): Promise<ImportState> {
  const accountId = parseId(String(form.get('accountId') ?? ''));
  if (!accountId) return { fieldErrors: { accountId: 'Escolha a conta.' } };
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { fieldErrors: { file: 'Escolha o arquivo do extrato.' } };
  }
  if (file.size > MAX_BYTES) return { fieldErrors: { file: 'O arquivo passa de 5 MB.' } };
  const content = decodeText(await file.arrayBuffer());

  const result = await guard(() =>
    apiSend<ImportPreview>('POST', '/v1/imports/preview', {
      accountId,
      filename: file.name.slice(0, 200) || 'extrato',
      content,
      mapping: mappingFrom(form),
    }),
  );
  if (!result.ok) {
    const fields = result.error.fields ?? {};
    if (fields.content) return { fieldErrors: { file: fields.content } };
    return { error: result.error.message, fieldErrors: fields };
  }
  if ('needsMapping' in result.data) return { needsMapping: result.data.needsMapping };
  return { preview: result.data };
}

export type CommitState = { error?: string };

/** Grava as linhas novas da prévia e segue para a Revisão. */
export async function commitStatement(_prev: CommitState, form: FormData): Promise<CommitState> {
  const batchId = parseId(String(form.get('batchId') ?? ''));
  if (!batchId) return { error: 'Importação inválida. Envie o arquivo de novo.' };
  const result = await guard(() =>
    apiSend<ImportCommitResult>('POST', `/v1/imports/${batchId}/commit`),
  );
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/painel', 'layout');
  redirect(`/painel/revisao?importados=${result.data.imported}`);
}
