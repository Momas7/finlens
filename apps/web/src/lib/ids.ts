import { Uuid } from '@finlens/contracts';

/** Id vindo de campo oculto do formulário: só UUID entra na URL da API. */
export function parseId(value: string): string | null {
  const parsed = Uuid.safeParse(value);
  return parsed.success ? parsed.data : null;
}
