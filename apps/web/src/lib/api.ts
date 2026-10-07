import 'server-only';
import type { ApiErrorBody } from '@finlens/contracts';
import { cookies } from 'next/headers';
import type { ZodType } from 'zod';

const apiUrl = process.env.API_URL ?? 'http://localhost:3333';

export class UnauthorizedError extends Error {}

async function cookieHeader() {
  return (await cookies()).toString();
}

/** Chama a API a partir de Server Components, repassando o cookie de sessão do usuário. */
export async function apiFetch<T>(path: string, schema: ZodType<T>): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { cookie: await cookieHeader() },
    cache: 'no-store',
  });
  if (response.status === 401) throw new UnauthorizedError();
  if (!response.ok) throw new Error(`API ${path} respondeu ${response.status}`);
  return schema.parse(await response.json());
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: ApiErrorBody['error'] };

/** Escrita na API a partir de Server Actions. Erros 4xx voltam como dado para o formulário. */
export async function apiSend<T = unknown>(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  schema?: ZodType<T>,
): Promise<ApiResult<T>> {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      cookie: await cookieHeader(),
      ...(body !== undefined && { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  if (response.status === 401) throw new UnauthorizedError();
  if (response.status === 204) return { ok: true, data: undefined as T };
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (json as ApiErrorBody | null)?.error ?? {
      code: 'error',
      message: 'Não foi possível concluir. Tente novamente.',
    };
    if (response.status >= 500) throw new Error(`API ${path} respondeu ${response.status}`);
    return { ok: false, status: response.status, error };
  }
  return { ok: true, data: schema ? schema.parse(json) : (json as T) };
}
