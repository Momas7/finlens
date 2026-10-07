const invalid = (input: string) => new Error(`Valor inválido: "${input}"`);

/**
 * Converte um valor monetário em texto para centavos, sem passar por float.
 * Aceita formato brasileiro ("1.234,56", "R$ 59,90") e ponto decimal ("1234.56", usado em OFX).
 */
export function parseBRL(input: string): bigint {
  let text = input.trim().replace(/^R\$\s*/, '');
  let negative = false;
  if (text.startsWith('-')) {
    negative = true;
    text = text.slice(1).replace(/^R\$\s*/, '');
  }

  let integerPart: string;
  let fraction: string;
  if (text.includes(',')) {
    const match = /^(\d{1,3}(?:\.\d{3})*|\d+),(\d{1,2})$/.exec(text);
    if (!match) throw invalid(input);
    integerPart = (match[1] ?? '').replaceAll('.', '');
    fraction = match[2] ?? '';
  } else {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
    if (!match) throw invalid(input);
    integerPart = match[1] ?? '';
    fraction = match[2] ?? '';
  }

  const cents = BigInt(integerPart) * 100n + BigInt(fraction.padEnd(2, '0'));
  return negative ? -cents : cents;
}

/** Formata centavos como moeda brasileira: 123456n -> "R$ 1.234,56". */
export function formatBRL(cents: bigint): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const integerPart = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}R$ ${integerPart},${fraction}`;
}
