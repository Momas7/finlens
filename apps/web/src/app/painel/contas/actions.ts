'use server';

import { redirect } from 'next/navigation';
import { apiSend, UnauthorizedError } from '@/lib/api';
import { parseId } from '@/lib/ids';
import { parseSignedInput } from '@/lib/money';

export type FormState = { fieldErrors?: Record<string, string>; formError?: string };

// Nomes de campo da API -> nomes dos inputs do formulário.
const FIELD_ALIASES: Record<string, string> = { openingBalanceCents: 'openingBalance' };

const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
// Vazio vira null: na criação e na edição a API responde com erro no campo, em vez de o
// valor antigo continuar valendo em silêncio.
const day = (form: FormData, key: string) => {
  const value = text(form, key);
  return value === '' ? null : Number(value);
};

export async function saveAccount(_prev: FormState, form: FormData): Promise<FormState> {
  const rawId = text(form, 'id');
  const id = rawId ? parseId(rawId) : '';
  if (id === null) return { formError: 'Conta inválida. Recarregue a página.' };
  const type = text(form, 'type');
  const isCard = type === 'credit_card';
  const payload: Record<string, unknown> = {
    name: text(form, 'name'),
    institution: text(form, 'institution') || null,
  };
  if (!id) payload.type = type;
  if (isCard) {
    payload.closingDay = day(form, 'closingDay');
    payload.dueDay = day(form, 'dueDay');
  } else {
    const balance = parseSignedInput(text(form, 'openingBalance'));
    if (balance === null) {
      return { fieldErrors: { openingBalance: 'Informe um valor como 1.500,00.' } };
    }
    payload.openingBalanceCents = balance;
    payload.openingBalanceDate = text(form, 'openingBalanceDate') || null;
  }

  try {
    const result = id
      ? await apiSend('PATCH', `/v1/accounts/${id}`, payload)
      : await apiSend('POST', '/v1/accounts', payload);
    if (!result.ok) {
      const fieldErrors = Object.fromEntries(
        Object.entries(result.error.fields ?? {}).map(([k, v]) => [FIELD_ALIASES[k] ?? k, v]),
      );
      return { fieldErrors, formError: result.error.fields ? undefined : result.error.message };
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/auth/clear-session');
    throw err;
  }
  redirect('/painel/contas');
}

export async function archiveAccount(rawId: string): Promise<void> {
  const id = parseId(rawId);
  if (!id) redirect('/painel/contas');
  try {
    await apiSend('DELETE', `/v1/accounts/${id}`);
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/auth/clear-session');
    throw err;
  }
  redirect('/painel/contas');
}
