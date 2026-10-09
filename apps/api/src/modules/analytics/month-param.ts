import { type Month, parseMonth } from '@finlens/domain';
import { ApiError } from '../../http/errors';

/** Mês pedido na query: ausente = corrente; inválido ou futuro = 400. */
export function resolveMonth(raw: string | undefined, today: string): Month {
  const current = today.slice(0, 7);
  const month = raw === undefined ? current : parseMonth(raw);
  if (!month || month > current) {
    throw new ApiError(400, 'validation', 'Verifique os campos.', {
      month: 'Use um mês no formato AAAA-MM, até o mês atual.',
    });
  }
  return month;
}
