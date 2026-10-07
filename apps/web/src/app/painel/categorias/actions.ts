'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiSend, UnauthorizedError } from '@/lib/api';
import { parseId } from '@/lib/ids';

export type FormState = {
  fieldErrors?: Record<string, string>;
  formError?: string;
  done?: boolean;
};

const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/auth/clear-session');
    throw err;
  }
}

function toState(error: { message: string; fields?: Record<string, string> }): FormState {
  return { fieldErrors: error.fields, formError: error.fields ? undefined : error.message };
}

export async function createCategory(_prev: FormState, form: FormData): Promise<FormState> {
  const rawParent = text(form, 'parentId');
  const parentId = rawParent ? parseId(rawParent) : null;
  if (rawParent && !parentId) return { formError: 'Categoria inválida. Recarregue a página.' };
  const result = await guard(() =>
    apiSend('POST', '/v1/categories', { name: text(form, 'name'), ...(parentId && { parentId }) }),
  );
  if (!result.ok) return toState(result.error);
  revalidatePath('/painel/categorias');
  return { done: true };
}

export async function renameCategory(
  rawId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const id = parseId(rawId);
  if (!id) return { formError: 'Categoria inválida. Recarregue a página.' };
  const result = await guard(() =>
    apiSend('PATCH', `/v1/categories/${id}`, { name: text(form, 'name') }),
  );
  if (!result.ok) return toState(result.error);
  revalidatePath('/painel/categorias');
  return { done: true };
}

export async function archiveCategory(rawId: string): Promise<void> {
  const id = parseId(rawId);
  if (!id) return;
  await guard(() => apiSend('DELETE', `/v1/categories/${id}`));
  revalidatePath('/painel/categorias');
}

export async function deleteRule(rawId: string): Promise<void> {
  const id = parseId(rawId);
  if (!id) return;
  await guard(() => apiSend('DELETE', `/v1/classification-rules/${id}`));
  revalidatePath('/painel/categorias');
}
