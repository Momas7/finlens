import 'server-only';
import { cookies } from 'next/headers';
import type { ZodType } from 'zod';

const apiUrl = process.env.API_URL ?? 'http://localhost:3333';

export class UnauthorizedError extends Error {}

/** Chama a API a partir de Server Components, repassando o cookie de sessão do usuário. */
export async function apiFetch<T>(path: string, schema: ZodType<T>): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (response.status === 401) throw new UnauthorizedError();
  if (!response.ok) throw new Error(`API ${path} respondeu ${response.status}`);
  return schema.parse(await response.json());
}
