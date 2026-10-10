'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiSend, UnauthorizedError } from '@/lib/api';

export type DeleteState = { fieldErrors?: Record<string, string>; formError?: string };

/** Exclui a conta, limpa os cookies de sessão e leva para a página inicial com o aviso. */
export async function deleteAccount(_prev: DeleteState, form: FormData): Promise<DeleteState> {
  let result: Awaited<ReturnType<typeof apiSend>>;
  try {
    result = await apiSend('POST', '/v1/me/delete', {
      password: String(form.get('password') ?? ''),
      confirm: String(form.get('confirm') ?? '').trim(),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/auth/clear-session');
    throw err;
  }
  if (!result.ok) {
    return result.error.fields
      ? { fieldErrors: result.error.fields }
      : { formError: result.error.message };
  }
  // A sessão não existe mais: apaga os cookies do Better Auth aqui, na própria ação.
  const jar = await cookies();
  for (const { name } of jar.getAll()) {
    if (name.startsWith('better-auth.') || name.startsWith('__Secure-better-auth.')) {
      jar.set(name, '', { maxAge: 0, path: '/', secure: name.startsWith('__Secure-') });
    }
  }
  redirect('/?conta=excluida');
}
