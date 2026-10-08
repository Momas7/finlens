'use server';

import { Transaction } from '@finlens/contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, apiSend, UnauthorizedError } from '@/lib/api';
import { parseId } from '@/lib/ids';
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

/** "auto" classifica no servidor; vazio = sem categoria; UUID = escolha da pessoa. */
function categoryChoice(raw: string): 'auto' | string | null {
  if (raw === 'auto') return 'auto';
  if (raw === '') return null;
  return parseId(raw) ?? 'auto';
}

export async function saveTransaction(_prev: FormState, form: FormData): Promise<FormState> {
  const rawId = text(form, 'id');
  const id = rawId ? parseId(rawId) : '';
  if (id === null) return { formError: 'Lançamento inválido. Recarregue a página.' };
  const abs = parseAmountInput(text(form, 'amount'));
  if (abs === null) {
    return { fieldErrors: { amount: 'Informe um valor maior que zero, como 45,90.' } };
  }
  const payload = {
    accountId: text(form, 'accountId'),
    categoryId: categoryChoice(text(form, 'categoryId')),
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
  // O contador de revisão fica no layout.
  revalidatePath('/painel', 'layout');
  // Categoria escolhida diferente da anterior: oferece aplicar aos parecidos.
  const chosen = payload.categoryId;
  if (id && chosen && chosen !== 'auto' && chosen !== text(form, 'previousCategoryId')) {
    redirect(`/painel/transacoes/${id}/semelhantes?categoria=${chosen}`);
  }
  redirect('/painel/transacoes');
}

export async function deleteTransaction(rawId: string): Promise<void> {
  const id = parseId(rawId);
  if (!id) redirect('/painel/transacoes');
  await guard(() => apiSend('DELETE', `/v1/transactions/${id}`));
  revalidatePath('/painel', 'layout');
  redirect('/painel/transacoes');
}

export type RuleState = { done?: boolean; message?: string };

/** "Sempre classificar assim": regra com a descrição do lançamento e a categoria atual. */
export async function createRuleFromTransaction(
  rawId: string,
  _prev: RuleState,
): Promise<RuleState> {
  const id = parseId(rawId);
  if (!id) return { message: 'Lançamento inválido. Recarregue a página.' };
  return guard(async () => {
    const tx = await apiFetch(`/v1/transactions/${id}`, Transaction);
    const categoryId = tx.categoryId ?? tx.suggestedCategoryId;
    if (!categoryId) return { message: 'Escolha uma categoria antes de criar a regra.' };
    const result = await apiSend('POST', '/v1/classification-rules', {
      categoryId,
      pattern: tx.description,
    });
    if (!result.ok) return { message: result.error.fields?.pattern ?? result.error.message };
    return { done: true, message: 'Regra criada.' };
  });
}

export type ApplyState = { error?: string };

/** Destino depois da tela de semelhantes: a revisão, se veio dela; senão a lista. */
export async function backFromSimilar(from: string | undefined): Promise<string> {
  return from === 'revisao' ? '/painel/revisao' : '/painel/transacoes';
}

/** Confirma os semelhantes marcados na categoria da correção. */
export async function applyToSimilar(
  rawCategoryId: string,
  from: string | undefined,
  _prev: ApplyState,
  form: FormData,
): Promise<ApplyState> {
  const categoryId = parseId(rawCategoryId);
  if (!categoryId) return { error: 'Categoria inválida. Recarregue a página.' };
  const ids = form.getAll('ids').map((v) => parseId(String(v)));
  if (ids.length === 0) return { error: 'Marque ao menos um lançamento.' };
  if (ids.some((v) => v === null)) return { error: 'Lançamento inválido. Recarregue a página.' };
  const result = await guard(() =>
    apiSend('POST', '/v1/transactions/confirm', { ids, categoryId }),
  );
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/painel', 'layout');
  redirect(await backFromSimilar(from));
}
