const HEADER = ['data', 'conta', 'descrição', 'valor', 'categoria', 'situação'];
const STATUS: Record<string, string> = {
  confirmed: 'confirmada',
  auto: 'automática',
  likely: 'provável',
  suggested: 'sugestão',
  none: 'sem categoria',
};

export type CsvTransaction = {
  postedDate: string;
  account: string;
  description: string;
  amountCents: bigint;
  category: string | null;
  status: string;
};

/** Campo CSV: entre aspas (com aspas duplicadas) quando tem `;`, aspas ou quebra de linha. */
export function csvField(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Centavos no formato de planilha em português, sem separador de milhar: -1234,56. */
export function centsToCsv(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  return `${negative ? '-' : ''}${abs / 100n},${String(abs % 100n).padStart(2, '0')}`;
}

export const statusLabel = (status: string) => STATUS[status] ?? status;

/** CSV de lançamentos para Excel em português: BOM, `;` e linhas terminadas em CRLF. */
export function transactionsCsv(rows: CsvTransaction[]): string {
  const lines = rows.map((r) =>
    [
      r.postedDate,
      csvField(r.account),
      csvField(r.description),
      centsToCsv(r.amountCents),
      csvField(r.category ?? ''),
      statusLabel(r.status),
    ].join(';'),
  );
  return `﻿${[HEADER.join(';'), ...lines].map((l) => `${l}\r\n`).join('')}`;
}
