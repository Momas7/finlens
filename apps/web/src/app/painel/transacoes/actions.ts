'use server';

import { redirect } from 'next/navigation';
import { apiSend, UnauthorizedError } from '@/lib/api';
import { parseAmountInput } from '@/lib/money';

export type FormState = { fieldErrors?: Record<string, string>; formError?: string };

const FIELD_ALIASES: Record<string, string> = { amountCents: 'amount' };
const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/auth/clear-session');
    throw err;
  }
}

export async function saveTransaction(_prev: FormState, form: FormData): Promise<FormState> {
  const id = text(form, 'id');
  const abs = parseAmountInput(text(form, 'amount'));
  if (abs === null) {
    return { fieldErrors: { amount: 'Informe um valor maior que zero, como 45,90.' } };
  }
  const payload = {
    accountId: text(form, 'accountId'),
    categoryId: text(form, 'categoryId') || null,
    postedDate: text(form, 'postedDate'),
    amountCents: text(form, 'kind') === 'income' ? abs : `-${abs}`,
    description: text(form, 'description'),
    notes: text(form, 'notes') || null,
  };
  const result = await guard(() =>
    id
      ? apiSend('PATCH', `/v1/transactions/${id}`, payload)
      : apiSend('POST', '/v1/transactions', payload),
  );
  if (!result.ok) {
    const fieldErrors = Object.fromEntries(
      Object.entries(result.error.fields ?? {}).map(([k, v]) => [FIELD_ALIASES[k] ?? k, v]),
    );
    return { fieldErrors, formError: result.error.fields ? undefined : result.error.message };
  }
  redirect('/painel/transacoes');
}

export async function deleteTransaction(id: string): Promise<void> {
  await guard(() => apiSend('DELETE', `/v1/transactions/${id}`));
  redirect('/painel/transacoes');
}
