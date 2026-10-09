import { formatBRL, parseBRL } from '@finlens/domain';

/** "-4590" -> "−R$ 45,90" (sinal de menos tipográfico). */
export function formatCents(cents: string): string {
  return formatBRL(BigInt(cents)).replace(/^-/, '−');
}

/** Valor digitado ("1.234,56") em centavos absolutos; inválido ou zero -> null. */
export function parseAmountInput(input: string): string | null {
  try {
    const cents = parseBRL(input);
    const abs = cents < 0n ? -cents : cents;
    return abs === 0n ? null : abs.toString();
  } catch {
    return null;
  }
}

/** Valor com sinal e zero permitidos (saldo inicial); inválido -> null. */
export function parseSignedInput(input: string): string | null {
  try {
    return parseBRL(input.trim() === '' ? '0' : input).toString();
  } catch {
    return null;
  }
}

/** Centavos para o formato do campo de valor: "65000" -> "650,00". */
export function centsToInput(cents: string): string {
  const abs = cents.replace('-', '').padStart(3, '0');
  return `${Number(abs.slice(0, -2)).toLocaleString('pt-BR')},${abs.slice(-2)}`;
}
