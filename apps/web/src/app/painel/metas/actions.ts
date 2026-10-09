'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiSend, UnauthorizedError } from '@/lib/api';
import { parseId } from '@/lib/ids';
import { parseAmountInput } from '@/lib/money';

export type GoalFormState = {
  fieldErrors?: Record<string, string>;
  formError?: string;
  done?: boolean;
};

const FIELD_ALIASES: Record<string, string> = {
  targetCents: 'target',
  annualRatePercent: 'rate',
};
const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const INVALID_TARGET = 'Informe um valor maior que zero, como 10.000,00.';

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/auth/clear-session');
    throw err;
  }
}

function toState(error: { message: string; fields?: Record<string, string> }): GoalFormState {
  if (!error.fields) return { formError: error.message };
  return {
    fieldErrors: Object.fromEntries(
      Object.entries(error.fields).map(([k, v]) => [FIELD_ALIASES[k] ?? k, v]),
    ),
  };
}

function common(form: FormData) {
  return {
    name: text(form, 'name'),
    targetDate: text(form, 'targetDate') || null,
    annualRatePercent: text(form, 'rate') || null,
  };
}

export async function createGoal(_prev: GoalFormState, form: FormData): Promise<GoalFormState> {
  const targetCents = parseAmountInput(text(form, 'target'));
  if (!targetCents) return { fieldErrors: { target: INVALID_TARGET } };
  const accountId = parseId(text(form, 'accountId'));
  if (!accountId) return { fieldErrors: { accountId: 'Escolha a conta da meta.' } };
  const result = await guard(() =>
    apiSend('POST', '/v1/goals', { ...common(form), targetCents, accountId }),
  );
  if (!result.ok) return toState(result.error);
  revalidatePath('/painel', 'layout');
  return { done: true };
}

export async function updateGoal(
  rawId: string,
  _prev: GoalFormState,
  form: FormData,
): Promise<GoalFormState> {
  const id = parseId(rawId);
  if (!id) return { formError: 'Meta inválida. Recarregue a página.' };
  const targetCents = parseAmountInput(text(form, 'target'));
  if (!targetCents) return { fieldErrors: { target: INVALID_TARGET } };
  const result = await guard(() =>
    apiSend('PATCH', `/v1/goals/${id}`, { ...common(form), targetCents }),
  );
  if (!result.ok) return toState(result.error);
  revalidatePath('/painel', 'layout');
  return { done: true };
}

export async function archiveGoal(rawId: string): Promise<void> {
  const id = parseId(rawId);
  if (!id) return;
  await guard(() => apiSend('DELETE', `/v1/goals/${id}`));
  revalidatePath('/painel', 'layout');
}
