const MAX_CENTS = 999_999_999_999_999n;

/** "R$ 1.267,64", "-R$ 217,50", "1267,64" → centavos. null se não for dinheiro. */
export function parseBrMoney(text: string): bigint | null {
  return parseDecimalMoney(text, 'comma');
}

/** `comma`: 1.234,56 (ponto separa milhar). `dot`: 1,234.56 (vírgula separa milhar). */
export function parseDecimalMoney(text: string, decimal: 'comma' | 'dot'): bigint | null {
  let s = text.replace(/R\$/gi, '').replace(/\s+/g, '');
  let negative = false;
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('-')) negative = !negative;
  s = s.replace(/^-/, '');
  const [thousands, point] = decimal === 'comma' ? ['.', ','] : [',', '.'];
  const [intPart = '', fracPart = '', ...rest] = s.split(point);
  if (rest.length > 0) return null;
  const grouped = new RegExp(`^\\d{1,3}(\\${thousands}\\d{3})+$`);
  if (!/^\d+$/.test(intPart) && !grouped.test(intPart)) return null;
  if (fracPart !== '' && !/^\d{1,2}$/.test(fracPart)) return null;
  const whole = BigInt(intPart.split(thousands).join(''));
  const cents = whole * 100n + BigInt(fracPart.padEnd(2, '0') || '0');
  // Mesmo teto da digitação manual (15 dígitos): acima disso o bigint do banco estoura.
  if (cents > MAX_CENTS) return null;
  return negative ? -cents : cents;
}
