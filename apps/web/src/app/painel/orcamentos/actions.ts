'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiSend, UnauthorizedError } from '@/lib/api';
import { parseId } from '@/lib/ids';
import { parseAmountInput } from '@/lib/money';

export type BudgetFormState = { error?: string; done?: boolean };

const INVALID_AMOUNT = 'Informe um valor maior que zero, como 750,00.';

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/auth/clear-session');
    throw err;
  }
}

/** Define ou altera o limite do mês corrente. */
export async function setBudget(
  rawCategoryId: string,
  _prev: BudgetFormState,
  form: FormData,
): Promise<BudgetFormState> {
  const categoryId = parseId(rawCategoryId);
  if (!categoryId) return { error: 'Categoria inválida. Recarregue a página.' };
  const amountCents = parseAmountInput(String(form.get('amount') ?? ''));
  if (!amountCents) return { error: INVALID_AMOUNT };
  const result = await guard(() => apiSend('PUT', `/v1/budgets/${categoryId}`, { amountCents }));
  if (!result.ok) return { error: result.error.fields?.amountCents ?? result.error.message };
  revalidatePath('/painel', 'layout');
  return { done: true };
}

export async function removeBudget(rawCategoryId: string): Promise<void> {
  const categoryId = parseId(rawCategoryId);
  if (!categoryId) return;
  await guard(() => apiSend('DELETE', `/v1/budgets/${categoryId}`));
  revalidatePath('/painel', 'layout');
}

export async function applySuggestions(): Promise<void> {
  await guard(() => apiSend('POST', '/v1/budgets/apply-suggestions'));
  revalidatePath('/painel', 'layout');
}
