'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiSend, UnauthorizedError } from '@/lib/api';
import { parseId } from '@/lib/ids';

export type ReviewState = { error?: string };

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/auth/clear-session');
    throw err;
  }
}

function parseIds(raw: string): string[] | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length === 0) return null;
    const ids = value.map((v) => (typeof v === 'string' ? parseId(v) : null));
    return ids.every((id): id is string => id !== null) ? ids : null;
  } catch {
    return null;
  }
}

/** Confirma todos os lançamentos de um grupo na categoria escolhida. */
export async function confirmGroup(_prev: ReviewState, form: FormData): Promise<ReviewState> {
  const ids = parseIds(String(form.get('ids') ?? ''));
  if (!ids) return { error: 'Grupo inválido. Recarregue a página.' };
  const rawCategory = String(form.get('categoryId') ?? '');
  if (!rawCategory) return { error: 'Escolha a categoria.' };
  const categoryId = parseId(rawCategory);
  if (!categoryId) return { error: 'Categoria inválida. Recarregue a página.' };
  const result = await guard(() =>
    apiSend('POST', '/v1/transactions/confirm', { ids, categoryId }),
  );
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/painel', 'layout');
  redirect(`/painel/transacoes/${ids[0]}/semelhantes?categoria=${categoryId}&de=revisao`);
}

export type SuggestionInput = {
  id: string;
  pattern: string;
  categoryId: string;
  minAmountCents: string | null;
  maxAmountCents: string | null;
};

/** Aceita a regra sugerida criando-a como regra do usuário. */
export async function acceptRuleSuggestion(s: SuggestionInput): Promise<ReviewState> {
  const categoryId = parseId(s.categoryId);
  if (!categoryId) return { error: 'Sugestão inválida. Recarregue a página.' };
  const result = await guard(() =>
    apiSend('POST', '/v1/classification-rules', {
      categoryId,
      pattern: s.pattern,
      ...(s.minAmountCents && { minAmountCents: s.minAmountCents }),
      ...(s.maxAmountCents && { maxAmountCents: s.maxAmountCents }),
    }),
  );
  if (!result.ok) return { error: result.error.fields?.pattern ?? result.error.message };
  revalidatePath('/painel', 'layout');
  return {};
}

export async function dismissRuleSuggestion(id: string): Promise<ReviewState> {
  const result = await guard(() => apiSend('POST', '/v1/rule-suggestions/dismiss', { id }));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/painel', 'layout');
  return {};
}

/** Liga as duas pontas como transferência (ou pagamento de fatura). */
export async function linkTransfer(a: string, b: string): Promise<ReviewState> {
  const idA = parseId(a);
  const idB = parseId(b);
  if (!idA || !idB) return { error: 'Lançamento inválido. Recarregue a página.' };
  const result = await guard(() => apiSend('POST', '/v1/transfers/link', { a: idA, b: idB }));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/painel', 'layout');
  return {};
}

export async function dismissTransfer(id: string): Promise<ReviewState> {
  const result = await guard(() => apiSend('POST', '/v1/transfers/dismiss', { id }));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/painel', 'layout');
  return {};
}

export type AiSuggestion = { categoryId: string; confidence: number } | { categoryId: null };

/** Pede à IA local uma categoria para o grupo. Nada é gravado; falha vira "sem sugestão". */
export async function suggestWithAi(transactionId: string): Promise<AiSuggestion> {
  const id = parseId(transactionId);
  if (!id) return { categoryId: null };
  let result: Awaited<ReturnType<typeof apiSend>>;
  try {
    result = await apiSend('POST', '/v1/llm/suggest', { transactionId: id });
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/auth/clear-session');
    return { categoryId: null };
  }
  if (!result.ok) return { categoryId: null };
  const data = result.data as { categoryId: string | null; confidence?: number };
  return data.categoryId === null
    ? { categoryId: null }
    : { categoryId: data.categoryId, confidence: data.confidence ?? 0 };
}
