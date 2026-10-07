import 'server-only';
import { MeResponse } from '@finlens/contracts';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { apiFetch, UnauthorizedError } from './api';

/** Usuário e workspace da sessão atual. Sem sessão válida, redireciona para /login. */
export const getMe = cache(async (): Promise<MeResponse> => {
  try {
    return await apiFetch('/v1/me', MeResponse);
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/auth/clear-session');
    throw err;
  }
});
