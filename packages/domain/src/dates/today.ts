const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Data de hoje (YYYY-MM-DD) no fuso de São Paulo, independente do fuso do servidor. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return formatter.format(now);
}
