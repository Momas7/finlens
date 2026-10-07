/** Saldo da conta: saldo inicial + transações a partir da data do saldo inicial (inclusive). */
export function accountBalance(
  openingCents: bigint,
  openingDate: string,
  txs: { postedDate: string; amountCents: bigint }[],
): bigint {
  return txs.reduce(
    (sum, tx) => (tx.postedDate >= openingDate ? sum + tx.amountCents : sum),
    openingCents,
  );
}

/** Valor devido da fatura `month` (positivo quando há compras). */
export function openInvoice(
  txs: { statementMonth: string | null; amountCents: bigint }[],
  month: string,
): bigint {
  return -txs.reduce((sum, tx) => (tx.statementMonth === month ? sum + tx.amountCents : sum), 0n);
}
