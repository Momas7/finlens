import { normalize } from '../classification/normalize';

// Transferência entre pessoas: o que sobra da descrição é o nome de alguém.
const PERSON_TRANSFER_RE = /^(TED|DOC|TRANSF\w*)\b/;

/**
 * Texto que pode sair para o LLM: a descrição normalizada sem nenhum token com dígito (CPF, CNPJ,
 * números curtos). Devolve null quando sobraria nome de pessoa (PIX, TED, DOC, transferência) ou
 * nada. Nunca devolve valor, data nem identificador.
 */
export function textForLlm(raw: string): string | null {
  const stripped = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  if (PERSON_TRANSFER_RE.test(stripped)) return null;
  const { normalized, counterparty } = normalize(raw);
  if (counterparty !== null) return null;
  const text = normalized
    .split(' ')
    .filter((t) => t !== '' && !/\d/.test(t))
    .join(' ');
  return text === '' ? null : text;
}
