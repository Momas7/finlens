const pad = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (year: number, month1: number) =>
  new Date(Date.UTC(year, month1, 0)).getUTCDate();

/**
 * Mês da fatura (YYYY-MM-01) de uma compra no cartão.
 * O fechamento efetivo é `min(closingDay, último dia do mês)`: compra até ele entra na
 * fatura do mês; depois dele, na do mês seguinte.
 */
export function statementMonth(postedDate: string, closingDay: number): string {
  const [y, m, d] = postedDate.split('-').map(Number) as [number, number, number];
  const effectiveClosing = Math.min(closingDay, daysInMonth(y, m));
  let year = y;
  let month = m;
  if (d > effectiveClosing) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return `${year}-${pad(month)}-01`;
}
